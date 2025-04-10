const { DataTypes, literal } = require('sequelize');
const sequelize = require('../config/database');

const VendaDia = sequelize.define('TBMOVTO_VENDA_DIA', {
  MVD_DIA: DataTypes.INTEGER,
  MVD_QTE_VENDAS: DataTypes.INTEGER,
  MVD_QTE_VENDIDA: DataTypes.INTEGER,
  MVD_VALOR_LIQUIDO: DataTypes.DECIMAL(10, 2),
  MVD_VALOR_APRAZO: DataTypes.DECIMAL(10, 2),
  MVD_VALOR_AVISTA: DataTypes.DECIMAL(10, 2),
}, {
  tableName: 'TBMOVTO_VENDA_DIA',
  timestamps: false,
});

module.exports = VendaDia;
