const express = require('express');
const router = express.Router();
const { sequelizeUltraSyst, sequelizePontoVenda } = require('../config/database');
const { Op, literal } = require('sequelize');
const moment = require('moment'); 

// Rota: Valor Líquido do Dia com LOC_CODI
router.get('/liquido_vendas_dia', async (req, res) => {
  try {
    const locCodiFiltro = req.query.locCodi?.trim(); // ex: '001' ou '002'

    const query = `
      SELECT 
        t.LOC_CODI,
        CONVERT(VARCHAR, CAST(t.MVD_DIA AS DATE), 23) AS data_usada,
        SUM(t.MVD_VALOR_LIQUIDO) AS total_valor_liquido
      FROM TBMOVTO_VENDA_DIA t
      WHERE 
        t.MVD_VALOR_LIQUIDO IS NOT NULL
        ${locCodiFiltro ? `AND LTRIM(RTRIM(t.LOC_CODI)) = :locCodi` : `AND t.LOC_CODI IN ('001', '002')`}
        AND CAST(t.MVD_DIA AS DATE) = (
          SELECT MAX(CAST(t2.MVD_DIA AS DATE))
          FROM TBMOVTO_VENDA_DIA t2
          WHERE 
            t2.MVD_VALOR_LIQUIDO IS NOT NULL
            AND LTRIM(RTRIM(t2.LOC_CODI)) = LTRIM(RTRIM(t.LOC_CODI))
        )
      GROUP BY t.LOC_CODI, CAST(t.MVD_DIA AS DATE)
    `;

    const resultados = await sequelizeUltraSyst.query(query, {
      replacements: locCodiFiltro ? { locCodi: locCodiFiltro } : {},
      type: sequelizeUltraSyst.QueryTypes.SELECT
    });

    const resposta = resultados.map(r => ({
      loc_codi: r.LOC_CODI,
      total_valor_liquido: r.total_valor_liquido || 0,
      data_usada: r.data_usada,
      data_inteiro: parseInt(r.data_usada.replace(/-/g, ''))
    }));

    res.json(resposta);

  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: 'Erro ao calcular total por local' });
  }
});

// Rota: Vendas a Prazo e à Vista com LOC_CODI
router.get('/vendas_aprazo_avista', async (req, res) => {
  const locCodi = req.query.locCodi?.trim();
  const locFilter = locCodi ? `AND LOC_CODI = :locCodi` : '';

  try {
    let [result] = await sequelizeUltraSyst.query(`
      SELECT 
        MAX(MVD_DIA) AS data,
        SUM(MVD_VALOR_APRAZO) AS total_valor_aprazo,
        SUM(MVD_VALOR_AVISTA) AS total_valor_avista,
        MAX(LOC_CODI) AS LOC_CODI
      FROM TBMOVTO_VENDA_DIA
      WHERE 
        CAST(MVD_DIA AS DATE) = CAST(GETDATE() AS DATE)
        AND (MVD_VALOR_APRAZO IS NOT NULL OR MVD_VALOR_AVISTA IS NOT NULL)
        ${locFilter}
      GROUP BY CAST(MVD_DIA AS DATE);
    `, {
      replacements: locCodi ? { locCodi } : {},
      type: sequelizeUltraSyst.QueryTypes.SELECT
    });

    if (!result || Object.keys(result).length === 0) {
      [result] = await sequelizeUltraSyst.query(`
        SELECT 
          MAX(MVD_DIA) AS data,
          SUM(MVD_VALOR_APRAZO) AS total_valor_aprazo,
          SUM(MVD_VALOR_AVISTA) AS total_valor_avista,
          MAX(LOC_CODI) AS LOC_CODI
        FROM TBMOVTO_VENDA_DIA
        WHERE 
          CAST(MVD_DIA AS DATE) = (
            SELECT TOP 1 CAST(MVD_DIA AS DATE)
            FROM TBMOVTO_VENDA_DIA
            WHERE (MVD_VALOR_APRAZO IS NOT NULL OR MVD_VALOR_AVISTA IS NOT NULL)
              ${locFilter}
            ORDER BY MVD_DIA DESC
          )
          ${locFilter}
        GROUP BY CAST(MVD_DIA AS DATE);
      `, {
        replacements: locCodi ? { locCodi } : {},
        type: sequelizeUltraSyst.QueryTypes.SELECT
      });
    }

    if (!result || Object.keys(result).length === 0) {
      return res.json({ message: 'Nenhum dado encontrado', data: null });
    }

    res.json({
      data: result.data,
      valor_aprazo: result.total_valor_aprazo || 0,
      valor_avista: result.total_valor_avista || 0,
      loc_codi: result.LOC_CODI || null
    });

  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: 'Erro ao buscar valores de venda do dia' });
  }
});


// rota Ponto de Vendas

router.get('/liquido_vendas_dia_PontoVenda', async (req, res) => {
  try {
    const locCodiFiltro = req.query.locCodi?.trim(); // ex: '001' ou '002'

    const query = `
      SELECT 
        t.LOC_CODI,
        CONVERT(VARCHAR, CAST(t.MVD_DIA AS DATE), 23) AS data_usada,
        SUM(t.MVD_VALOR_LIQUIDO) AS total_valor_liquido
      FROM TBMOVTO_VENDA_DIA t
      WHERE 
        t.MVD_VALOR_LIQUIDO IS NOT NULL
        ${locCodiFiltro ? `AND LTRIM(RTRIM(t.LOC_CODI)) = :locCodi` : `AND t.LOC_CODI IN ('001', '002')`}
        AND CAST(t.MVD_DIA AS DATE) = (
          SELECT MAX(CAST(t2.MVD_DIA AS DATE))
          FROM TBMOVTO_VENDA_DIA t2
          WHERE 
            t2.MVD_VALOR_LIQUIDO IS NOT NULL
            AND LTRIM(RTRIM(t2.LOC_CODI)) = LTRIM(RTRIM(t.LOC_CODI))
        )
      GROUP BY t.LOC_CODI, CAST(t.MVD_DIA AS DATE)
    `;

    const resultados = await sequelizePontoVenda.query(query, {
      replacements: locCodiFiltro ? { locCodi: locCodiFiltro } : {},
      type: sequelizePontoVenda.QueryTypes.SELECT
    });

    const resposta = resultados.map(r => ({
      loc_codi: r.LOC_CODI,
      total_valor_liquido: r.total_valor_liquido || 0,
      data_usada: r.data_usada,
      data_inteiro: parseInt(r.data_usada.replace(/-/g, ''))
    }));

    res.json(resposta);

  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: 'Erro ao calcular total por local' });
  }
});

// Rota: Vendas a Prazo e à Vista com LOC_CODI
router.get('/vendas_aprazo_avista_PontoVenda', async (req, res) => {
  const locCodi = req.query.locCodi?.trim();
  const locFilter = locCodi ? `AND LOC_CODI = :locCodi` : '';

  try {
    let [result] = await sequelizePontoVenda.query(`
      SELECT 
        MAX(MVD_DIA) AS data,
        SUM(MVD_VALOR_APRAZO) AS total_valor_aprazo,
        SUM(MVD_VALOR_AVISTA) AS total_valor_avista,
        MAX(LOC_CODI) AS LOC_CODI
      FROM TBMOVTO_VENDA_DIA
      WHERE 
        CAST(MVD_DIA AS DATE) = CAST(GETDATE() AS DATE)
        AND (MVD_VALOR_APRAZO IS NOT NULL OR MVD_VALOR_AVISTA IS NOT NULL)
        ${locFilter}
      GROUP BY CAST(MVD_DIA AS DATE);
    `, {
      replacements: locCodi ? { locCodi } : {},
      type: sequelizePontoVenda.QueryTypes.SELECT
    });

    if (!result || Object.keys(result).length === 0) {
      [result] = await sequelizePontoVenda.query(`
        SELECT 
          MAX(MVD_DIA) AS data,
          SUM(MVD_VALOR_APRAZO) AS total_valor_aprazo,
          SUM(MVD_VALOR_AVISTA) AS total_valor_avista,
          MAX(LOC_CODI) AS LOC_CODI
        FROM TBMOVTO_VENDA_DIA
        WHERE 
          CAST(MVD_DIA AS DATE) = (
            SELECT TOP 1 CAST(MVD_DIA AS DATE)
            FROM TBMOVTO_VENDA_DIA
            WHERE (MVD_VALOR_APRAZO IS NOT NULL OR MVD_VALOR_AVISTA IS NOT NULL)
              ${locFilter}
            ORDER BY MVD_DIA DESC
          )
          ${locFilter}
        GROUP BY CAST(MVD_DIA AS DATE);
      `, {
        replacements: locCodi ? { locCodi } : {},
        type: sequelizePontoVenda.QueryTypes.SELECT
      });
    }

    if (!result || Object.keys(result).length === 0) {
      return res.json({ message: 'Nenhum dado encontrado', data: null });
    }

    res.json({
      data: result.data,
      valor_aprazo: result.total_valor_aprazo || 0,
      valor_avista: result.total_valor_avista || 0,
      loc_codi: result.LOC_CODI || null
    });

  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: 'Erro ao buscar valores de venda do dia' });
  }
});


module.exports = router;