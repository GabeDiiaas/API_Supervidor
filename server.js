require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes, Op, literal } = require('sequelize');

const app = express();
const port = process.env.PORT || 3000;


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


const VendaDia = sequelize.define('TBMOVTO_VENDA_DIA', {
  MVD_DIA: {
    type: DataTypes.INTEGER,
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
  },
<<<<<<< HEAD
  MVD_VALOR_APRAZO: {   
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  MVD_VALOR_AVISTA: {   
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  }
=======
>>>>>>> 56f6c63999e42101d1c0143d0e32e47135cf7fe8
}, {
  tableName: 'TBMOVTO_VENDA_DIA',
  timestamps: false,
});


async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('Conexão com o banco de dados estabelecida com sucesso.');
  } catch (error) {
    console.error('Erro ao conectar ao banco de dados:', error);
    process.exit(1);
  }
}


app.get('/vendas', async (req, res) => {
  try {
    const startDate = '2024-01-01'; 

    const vendas = await VendaDia.findAll({
      attributes: [
        [literal('CONVERT(VARCHAR, MVD_DIA, 120)'), 'MVD_DIA'],
        'MVD_QTE_VENDAS',
        'MVD_QTE_VENDIDA',
<<<<<<< HEAD
        'MVD_VALOR_LIQUIDO',
        'MVD_VALOR_AVISTA',
        'MVD_VALOER_APRAZO'
=======
        'MVD_VALOR_LIQUIDO'
>>>>>>> 56f6c63999e42101d1c0143d0e32e47135cf7fe8
      ],
      where: {
        MVD_DIA: {
          [Op.gte]: startDate,
        }
      },
      order: [['MVD_DIA', 'DESC']],
    });

    res.json(vendas.length ? vendas : { message: 'Nenhum dado encontrado', data: [] });
  } catch (error) {
    console.error('Erro ao buscar vendas:', error);
    res.status(500).json({ error: 'Erro ao consultar o banco de dados' });
  }
});

async function startServer() {
  await testConnection();
  app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
  });
}

startServer().catch((error) => {
  console.error('Erro ao iniciar o servidor:', error);
  process.exit(1);
});
