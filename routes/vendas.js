const express = require('express');
const router = express.Router();
const VendaDia = require('../models/VendaDia');
const { Op, literal } = require('sequelize');

router.get('/vendas-dia', async (req, res) => {
  try {
    // Primeiro obtém a última data
    const ultimaData = await VendaDia.findOne({
      attributes: [
        [literal('MAX(CONVERT(DATE, MVD_DIA))'), 'ultimaData']
      ],
      raw: true
    });

    if (!ultimaData || !ultimaData.ultimaData) {
      return res.json({ message: 'Nenhum dado encontrado', data: [] });
    }

    // Busca os dados detalhados E a soma para a última data
    const [vendas, soma] = await Promise.all([
      VendaDia.findAll({
        attributes: [
          [literal('CONVERT(VARCHAR, MVD_DIA, 120)'), 'MVD_DIA'],
          'MVD_QTE_VENDAS', 'MVD_QTE_VENDIDA', 'MVD_VALOR_LIQUIDO', 
          'MVD_VALOR_APRAZO', 'MVD_VALOR_AVISTA'
        ],
        where: { 
          MVD_DIA: { 
            [Op.gte]: literal(`CONVERT(DATE, '${ultimaData.ultimaData.toISOString().split('T')[0]}')`)
          }
        },
        order: [['MVD_DIA', 'DESC']],
      }),
      
      VendaDia.findOne({
        attributes: [
          [literal('SUM(MVD_VALOR_LIQUIDO)'), 'total_valor_liquido']
        ],
        where: { 
          MVD_DIA: {
            [Op.gte]: literal(`CONVERT(DATE, '${ultimaData.ultimaData.toISOString().split('T')[0]}')`)
          },
          MVD_VALOR_LIQUIDO: { [Op.not]: null }
        },
        raw: true
      })
    ]);

    res.json({
      ultima_data: ultimaData.ultimaData,
      total_valor_liquido: soma.total_valor_liquido || 0,
      vendas: vendas.length ? vendas : []
    });

  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: 'Erro ao buscar vendas' });
  }
});

router.get('/vendas-dia/total-ultima-data', async (req, res) => {
  try {
    // Obtém a última data
    const ultimaData = await VendaDia.findOne({
      attributes: [
        [literal('MAX(CONVERT(DATE, MVD_DIA))'), 'ultimaData']
      ],
      raw: true
    });

    if (!ultimaData || !ultimaData.ultimaData) {
      return res.json({ 
        ultima_data: null,
        total_valor_liquido: 0,
        message: 'Nenhum dado encontrado' 
      });
    }

    // Obtém apenas a soma para a última data
    const resultado = await VendaDia.findOne({
      attributes: [
        [literal('SUM(MVD_VALOR_LIQUIDO)'), 'total_valor_liquido']
      ],
      where: { 
        MVD_DIA: {
          [Op.gte]: literal(`CONVERT(DATE, '${ultimaData.ultimaData.toISOString().split('T')[0]}')`)
        },
        MVD_VALOR_LIQUIDO: { [Op.not]: null }
      },
      raw: true
    });

    res.json({
      ultima_data: ultimaData.ultimaData,
      total_valor_liquido: resultado.total_valor_liquido || 0
    });

  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: 'Erro ao calcular total' });
  }
});