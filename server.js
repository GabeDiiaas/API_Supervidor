// server.js
require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes, Op } = require('sequelize');

const app = express();
const port = process.env.PORT || 3000;


const sequelize = new Sequelize({
  dialect: 'mssql',
  host: process.env.DB_HOST, 
  username: process.env.DB_USER,  
  password: process.env.DB_PASSWORD, 
  database: process.env.DB_NAME,   
  dialectOptions: {
    encrypt: true,  
  },
  logging: false,  
});


const VendaDia = sequelize.define('TBMOVTO_VENDA_DIA', {
  MVD_DIA: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  MVD_QTE_VENDAS: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  MVD_QTE_VENDIDA: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  MVD_VALOR_LIQUIDO: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  }
}, {
  tableName: 'TBMOVTO_VENDA_DIA', 
  timestamps: false,
});


app.get('/vendas', async (req, res) => {
  try {
   
    const vendas = await VendaDia.findAll({
      attributes: ['MVD_DIA', 'MVD_QTE_VENDAS', 'MVD_QTE_VENDIDA', 'MVD_VALOR_LIQUIDO'],
      where: {
        MVD_DIA: {
          [Op.gt]: new Date('2024-01-01') 
        }
      },
      order: [['MVD_DIA', 'DESC']]
    });

   
    res.json(vendas);
  } catch (error) {
    console.error('Erro ao consultar o banco:', error);
    res.status(500).json({ error: 'Erro ao consultar o banco de dados' });
  }
});

app.listen(port, async () => {
  try {
    await sequelize.authenticate();
    console.log('Conexão com o banco de dados estabelecida com sucesso.');
    console.log(`Servidor rodando na porta ${port}`);
  } catch (error) {
    console.error('Erro ao conectar ao banco de dados:', error);
  }
});
