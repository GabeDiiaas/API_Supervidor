const express = require('express');
const { sequelizePontoVenda } = require('../config/database');
const router = express.Router();

module.exports = ({ sequelizeUltraSyst }) => {
  router.get('/top_produtos', async (req, res) => {
    const { locCodi } = req.query;

    if (!locCodi) {
      return res.status(400).json({ error: 'Parâmetro locCodi é obrigatório' });
    }

    try {
      const resultados = await sequelizeUltraSyst.query(`
        SELECT
          P.PRO_CODI,
          RTRIM(P.PRO_DESC) AS PRO_DESC,
          VMA.MMA_MES_ANO,
          SUM(VMA.MMA_VALOR_LIQUIDO) AS TOTAL_FATURAMENTO
        FROM 
          TBMOVTO_VENDA_MES_ANO AS VMA
        INNER JOIN 
          PRODUTO AS P ON VMA.PRO_CODI = P.PRO_CODI
        WHERE 
          VMA.MMA_VALOR_LIQUIDO > 0
          AND VMA.LOC_CODI = :locCodi
          AND TRY_CAST(
                SUBSTRING(VMA.MMA_MES_ANO, 3, 4) + '-' + SUBSTRING(VMA.MMA_MES_ANO, 1, 2) + '-01'
                AS DATE
              ) >= DATEADD(MONTH, -11, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
        GROUP BY
          P.PRO_CODI,
          P.PRO_DESC,
          VMA.MMA_MES_ANO
        ORDER BY 
          SUBSTRING(VMA.MMA_MES_ANO, 3, 4) + SUBSTRING(VMA.MMA_MES_ANO, 1, 2) DESC,
          SUM(VMA.MMA_VALOR_LIQUIDO) DESC
      `, {
        replacements: { locCodi },
        type: sequelizeUltraSyst.QueryTypes.SELECT
      });

      res.json(resultados);
    } catch (error) {
      console.error('Erro ao buscar dados de top produtos:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  //Rotas Ponto de vendas

   router.get('/top_produtos_PontoVenda', async (req, res) => {
    const { locCodi } = req.query;

    if (!locCodi) {
      return res.status(400).json({ error: 'Parâmetro locCodi é obrigatório' });
    }

    try {
      const resultados = await sequelizePontoVenda.query(`
        SELECT
          P.PRO_CODI,
          RTRIM(P.PRO_DESC) AS PRO_DESC,
          VMA.MMA_MES_ANO,
          SUM(VMA.MMA_VALOR_LIQUIDO) AS TOTAL_FATURAMENTO
        FROM 
          TBMOVTO_VENDA_MES_ANO AS VMA
        INNER JOIN 
          PRODUTO AS P ON VMA.PRO_CODI = P.PRO_CODI
        WHERE 
          VMA.MMA_VALOR_LIQUIDO > 0
          AND VMA.LOC_CODI = :locCodi
          AND TRY_CAST(
                SUBSTRING(VMA.MMA_MES_ANO, 3, 4) + '-' + SUBSTRING(VMA.MMA_MES_ANO, 1, 2) + '-01'
                AS DATE
              ) >= DATEADD(MONTH, -11, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
        GROUP BY
          P.PRO_CODI,
          P.PRO_DESC,
          VMA.MMA_MES_ANO
        ORDER BY 
          SUBSTRING(VMA.MMA_MES_ANO, 3, 4) + SUBSTRING(VMA.MMA_MES_ANO, 1, 2) DESC,
          SUM(VMA.MMA_VALOR_LIQUIDO) DESC
      `, {
        replacements: { locCodi },
        type: sequelizePontoVenda.QueryTypes.SELECT
      });

      res.json(resultados);
    } catch (error) {
      console.error('Erro ao buscar dados de top produtos:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  return router;
};