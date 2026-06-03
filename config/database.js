require('dotenv').config({ path: './config/.env' });

const { AsyncLocalStorage } = require('async_hooks');
const { Sequelize } = require('sequelize');

const dbContext = new AsyncLocalStorage();

// Conexão ASA_FRIO (PontoVenda)
const sequelizePontoVenda = new Sequelize(
  process.env.DB_PONTOVENDA_NAME,
  process.env.DB_PONTOVENDA_USER,
  process.env.DB_PONTOVENDA_PASS,
  {
    host: process.env.DB_PONTOVENDA_HOST,
    dialect: 'mssql',
    port: 1433,
    dialectOptions: {
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    },
    pool: { max: 5, min: 0, acquire: 60000, idle: 10000 },
    logging: false,
  }
);

// Conexão CF_MAURO (UltraSyst)
const sequelizeUltraSyst = new Sequelize(
  process.env.DB_ULTRASYST_NAME,
  process.env.DB_ULTRASYST_USER,
  process.env.DB_ULTRASYST_PASS,
  {
    host: process.env.DB_ULTRASYST_HOST,
    dialect: 'mssql',
    port: 1433,
    dialectOptions: {
      options: {
        encrypt: false,
        trustServerCertificate: true,
        requestTimeout: 60000,
      },
    },
    pool: { max: 5, min: 0, acquire: 60000, idle: 10000 },
    logging: false,
  }
);

// Conexão LOCAL via túnel
const sequelizeLocal = new Sequelize(
  process.env.DB_LOCAL_NAME,
  process.env.DB_LOCAL_USER,
  process.env.DB_LOCAL_PASS,
  {
    host: process.env.DB_LOCAL_HOST,
    dialect: 'mssql',
    port: parseInt(process.env.DB_LOCAL_PORT),
    dialectOptions: {
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    },
    pool: { max: 5, min: 0, acquire: 60000, idle: 10000 },
    logging: false,
  }
);

function normalizeInstancia(instancia) {
  return instancia ? instancia.toString().trim() : '';
}

function sameInstancia(left, right) {
  const leftValue = normalizeInstancia(left).toLowerCase();
  const rightValue = normalizeInstancia(right).toLowerCase();

  return Boolean(leftValue && rightValue && leftValue === rightValue);
}

function resolveDatabase(instancia) {
  const banco1Aliases = [
    'Banco1',
    'PontoVenda',
    'UltraSyst',
    process.env.DB_BANCO1_ALIAS,
    process.env.DB_PONTOVENDA_INSTANCIA,
    process.env.DB_ULTRASYST_INSTANCIA,
    process.env.DB_PONTOVENDA_NAME,
    process.env.DB_ULTRASYST_NAME,
  ];

  const banco2Aliases = [
    'Banco2',
    process.env.DB_BANCO2_ALIAS,
    process.env.DB_LOCAL_INSTANCIA,
    process.env.DB_LOCAL_NAME,
  ];

  if (banco1Aliases.some((alias) => sameInstancia(instancia, alias))) {
    return sequelizePontoVendaRaw;
  }

  if (banco2Aliases.some((alias) => sameInstancia(instancia, alias))) {
    return sequelizeLocalRaw;
  }

  return null;
}

function databaseContextMiddleware(req, res, next) {
  const instancia = req.query.instancia || req.headers.instancia;
  const db = resolveDatabase(instancia);

  if (instancia && !db) {
    return res.status(400).json({
      error: `Instancia invalida: ${instancia}`,
    });
  }

  dbContext.run({ db, instancia: normalizeInstancia(instancia) || null }, next);
}

function getDatabaseFromContext(defaultDatabase) {
  return dbContext.getStore()?.db || defaultDatabase;
}

function createScopedSequelize(defaultDatabase) {
  return new Proxy(defaultDatabase, {
    get(target, prop) {
      const database = getDatabaseFromContext(target);
      const value = database[prop];

      if (typeof value === 'function') {
        return value.bind(database);
      }

      return value;
    },
  });
}

const sequelizePontoVendaRaw = sequelizePontoVenda;
const sequelizeUltraSystRaw = sequelizeUltraSyst;
const sequelizeLocalRaw = sequelizeLocal;

module.exports = { 
  sequelizePontoVenda: createScopedSequelize(sequelizePontoVendaRaw), 
  sequelizeUltraSyst: createScopedSequelize(sequelizeUltraSystRaw),
  sequelizeLocal: sequelizeLocalRaw,
  databaseContextMiddleware,
  resolveDatabase,
};
