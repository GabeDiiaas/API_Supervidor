const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'mssql',
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 1433,
  dialectOptions: {
    encrypt: false,
    trustServerCertificate: true,
  },
});

module.exports = sequelize;
