const app = require('./app');
const { sequelizePontoVenda, sequelizeUltraSyst, sequelizeLocal } = require('./config/database');

const port = 3232;

async function conectarBanco(nome, sequelize, host, porta) {
  try {
    console.log(`Tentando conectar ao ${nome}: ${host}:${porta}`);

    await sequelize.authenticate();

    console.log(`Conexão com ${nome} bem-sucedida`);

    return true;
  } catch (error) {
    console.error(`Falha ao conectar com ${nome}:`, error.message);

    return false;
  }
}

async function startServer() {

  // tenta conectar individualmente sem derrubar os outros
  const pontoVendaConectado = await conectarBanco(
    'PontoVenda',
    sequelizePontoVenda,
    process.env.DB_PONTOVENDA_HOST,
    1433
  );

  const ultraSystConectado = await conectarBanco(
    'UltraSyst',
    sequelizeUltraSyst,
    process.env.DB_ULTRASYST_HOST,
    1433
  );

  const localConectado = await conectarBanco(
    'LOCAL',
    sequelizeLocal,
    process.env.DB_LOCAL_HOST,
    process.env.DB_LOCAL_PORT
  );

  // sobe servidor mesmo se apenas 1 banco conectar
  if (pontoVendaConectado || ultraSystConectado || localConectado) {

    app.listen(port, () => {
      console.log(`Servidor rodando na porta ${port}`);
    });

  } else {

    console.error('Nenhuma conexão com banco foi bem-sucedida.');
    console.log('Servidor continuará online mesmo sem banco.');

    app.listen(port, () => {
      console.log(`Servidor rodando na porta ${port}`);
    });

  }
}

startServer();