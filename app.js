const express = require('express');
const vendasRoutes = require('./routes/vendas');
const receberRoutes = require('./routes/receber');
const pagarRoutes = require('./routes/pagar');
const sequelize = require('./config/database');

const app = express();

app.use('/vendas', vendasRoutes);
app.use('/receber', receberRoutes(sequelize));
app.use('/pagar', pagarRoutes(sequelize));

module.exports = app;
