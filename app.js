const express = require('express');
const vendasRoutes = require('./routes/vendas');
const receberRoutes = require('./routes/receber');
const pagarRoutes = require('./routes/pagar');

const app = express();

app.use('/vendas', vendasRoutes);
app.use('/receber', receberRoutes);
app.use('/pagar', pagarRoutes);

module.exports = app;
