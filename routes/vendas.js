const express = require('express');
const router = express.Router();
const VendaDia = require('../models/VendaDia');
const { Op, literal } = require('sequelize');

router.get('/vendas-dia', async (req, res) => {
  try {
    const startDate = '2024-01-01';
    const vendas = await VendaDia.findAll({
      attributes: [
        [literal('CONVERT(VARCHAR, MVD_DIA, 120)'), 'MVD_DIA'],
        'MVD_QTE_VENDAS', 'MVD_QTE_VENDIDA', 'MVD_VALOR_LIQUIDO', 'MVD_VALOR_APRAZO', 'MVD_VALOR_AVISTA'
      ],
      where: { MVD_DIA: { [Op.gte]: startDate } },
      order: [['MVD_DIA', 'DESC']],
    });

    res.json(vendas.length ? vendas : { message: 'Nenhum dado encontrado', data: [] });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar vendas' });
  }
});

module.exports = router;

