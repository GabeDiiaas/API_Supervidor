const express = require('express');
require('dotenv').config({
  path: './config/.env'
});

// ===============================
// IMPORTAÇÃO DAS ROTAS
// ===============================
const gruposRoutes = require('./routes/grupos');
const vendasRoutes = require('./routes/vendas');
const receberRoutes = require('./routes/receber');
const pagarRoutes = require('./routes/pagar');
const usuarioRoutes = require('./pontodevenda/usuario');
const localizacaoRoutes = require('./pontodevenda/localizacao');
const topPagamentoRoutes = require('./routes/top_pagamento');
const topVendedoresRoutes = require('./routes/top_vendedores');
const topLocalizacaoRoutes = require('./routes/top_ramos_atividade');
const topClientesRoutes = require('./routes/top_clientes');
const topProdutos = require('./routes/top_produtos');
const topMunicipios = require('./routes/top_municipios');
const topDespesas = require('./routes/top_Despesas');
const topFinanceiro = require('./routes/top_financeiro');
const clientesRoutes = require('./pontodevenda/clientes');
const produtosRoutes = require('./pontodevenda/produtos');
const pontoVendaRoutes = require('./pontodevenda/ponto_venda');
const precosRoutes = require('./pontodevenda/precos');
const balancoRoutes = require('./routes/balancos'); // ✅ NOVO
const limiteCreditoRoutes = require('./pontodevenda/limite_credito');

// ===============================
// BANCO DE DADOS
// ===============================
const connectionManager = require('./config/connectionManager');
const {
  sequelizePontoVenda,
  sequelizeUltraSyst,
  sequelizeLocal,
  databaseContextMiddleware
} = require('./config/database');

// ===============================
// 🔐 MIDDLEWARE DE SEGURANÇA (API KEY)
// ===============================
const verificarAcessoApp = (req, res, next) => {
  const chaveSecreta = process.env.API_KEY || 'ultrasyst';
  const chaveRecebida = req.headers['ultrasyst'];

  if (chaveRecebida && chaveRecebida === chaveSecreta) {
    return next();
  }

  console.log('❌ Tentativa de acesso não autorizado');
  return res.status(401).json({
    erro: 'Acesso negado: Chave de API inválida'
  });
};

// ===============================
// APP
// ===============================
const app = express();

// ===============================
// MIDDLEWARES GLOBAIS
// ===============================
app.use(express.json());

// 🔐 ATIVA A PROTEÇÃO PARA TODA A API
app.use(verificarAcessoApp);
app.use(databaseContextMiddleware);

// ===============================
// ROTAS (TODAS PROTEGIDAS)
// ===============================
app.use('/grupos', gruposRoutes({ sequelizeUltraSyst }));
app.use('/vendas', vendasRoutes);
app.use('/receber', receberRoutes({ sequelizeUltraSyst }));
app.use('/pagar', pagarRoutes({ sequelizeUltraSyst }));
app.use('/usuario', usuarioRoutes({ sequelizePontoVenda, sequelizeUltraSyst }));
app.use('/localizacao', localizacaoRoutes({ sequelizePontoVenda, sequelizeUltraSyst }));
app.use('/top_pagamento', topPagamentoRoutes({ sequelizeUltraSyst }));
app.use('/top_vendedores', topVendedoresRoutes({ sequelizeUltraSyst }));
app.use('/top_ramos_atividade', topLocalizacaoRoutes({ sequelizeUltraSyst }));
app.use('/top_clientes', topClientesRoutes({ sequelizeUltraSyst }));
app.use('/top_produtos', topProdutos({ sequelizeUltraSyst }));
app.use('/top_municipios', topMunicipios({ sequelizeUltraSyst }));
app.use('/top_Despesas', topDespesas({ sequelizeUltraSyst }));
app.use('/top_Financeiro', topFinanceiro({ sequelizeUltraSyst }));
app.use('/clientes', clientesRoutes({
  sequelizePontoVenda,
  sequelizeUltraSyst,
  sequelizeLocal,
}));
app.use('/produtos', produtosRoutes({ sequelizePontoVenda, sequelizeUltraSyst, sequelizeLocal }));
app.use('/ponto_venda', pontoVendaRoutes({ sequelizePontoVenda, sequelizeUltraSyst }));
app.use('/precos', precosRoutes({ sequelizeUltraSyst }));
app.use('/balancos', balancoRoutes({ sequelizePontoVenda })); // ✅ NOVO
app.use('/limite_credito', limiteCreditoRoutes({ sequelizePontoVenda, sequelizeUltraSyst }));

// ===============================
// EXPORT
// ===============================
module.exports = app;
