const express = require('express');
const { sequelizePontoVenda } = require('../config/database');
const router = express.Router();

module.exports = ({ sequelizeUltraSyst }) => {
  router.get('/top_Financeiro', async (req, res) => {
    try {
      const { locCodi } = req.query;

      if (!locCodi) {
        return res.status(400).json({ error: 'Parâmetro locCodi é obrigatório' });
      }

      const resultados = await sequelizeUltraSyst.query(`
        -- Captura os 12 meses mais recentes com base em SCC_DATA
        WITH Ultimos12Meses AS (
          SELECT TOP 12 
            FORMAT(SCC_DATA, 'MMyyyy') AS MES_ANO
          FROM TBMOVCC_SALDO
          WHERE LTRIM(RTRIM(LOC_CODI)) = :locCodi
          GROUP BY FORMAT(SCC_DATA, 'MMyyyy')
          ORDER BY CAST(RIGHT(FORMAT(SCC_DATA, 'MMyyyy'), 4) + LEFT(FORMAT(SCC_DATA, 'MMyyyy'), 2) AS INT) DESC
        )

        SELECT 
          s.LOC_CODI,
          s.EMP_CODI,
          s.PCG_CODI,
          RTRIM(p.PCG_DESC) AS PCG_DESC,
          FORMAT(s.SCC_DATA, 'MMyyyy') AS MES_ANO,
          SUM(s.SCC_SALDO) AS TOTAL_SALDO
        FROM TBMOVCC_SALDO s
        INNER JOIN TBCXAPLANO p ON p.PCG_CODI = s.PCG_CODI
        INNER JOIN Ultimos12Meses u ON FORMAT(s.SCC_DATA, 'MMyyyy') = u.MES_ANO
        WHERE LTRIM(RTRIM(s.LOC_CODI)) = :locCodi
        GROUP BY 
          s.LOC_CODI, s.EMP_CODI, s.PCG_CODI, p.PCG_DESC, FORMAT(s.SCC_DATA, 'MMyyyy')
        ORDER BY 
          CAST(RIGHT(FORMAT(s.SCC_DATA, 'MMyyyy'), 4) + LEFT(FORMAT(s.SCC_DATA, 'MMyyyy'), 2) AS INT) DESC,
          TOTAL_SALDO DESC
      `, {
        type: sequelizeUltraSyst.QueryTypes.SELECT,
        replacements: { locCodi }
      });

      res.json(resultados);
    } catch (error) {
      console.error('Erro ao buscar Top Financeiro:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

   router.get('/top_Financeiro_PontoVenda', async (req, res) => {
    try {
      const { locCodi } = req.query;

      if (!locCodi) {
        return res.status(400).json({ error: 'Parâmetro locCodi é obrigatório' });
      }

      const resultados = await sequelizePontoVenda.query(`
        -- Captura os 12 meses mais recentes com base em SCC_DATA
        WITH Ultimos12Meses AS (
          SELECT TOP 12 
            FORMAT(SCC_DATA, 'MMyyyy') AS MES_ANO
          FROM TBMOVCC_SALDO
          WHERE LTRIM(RTRIM(LOC_CODI)) = :locCodi
          GROUP BY FORMAT(SCC_DATA, 'MMyyyy')
          ORDER BY CAST(RIGHT(FORMAT(SCC_DATA, 'MMyyyy'), 4) + LEFT(FORMAT(SCC_DATA, 'MMyyyy'), 2) AS INT) DESC
        )

        SELECT 
          s.LOC_CODI,
          s.EMP_CODI,
          s.PCG_CODI,
          RTRIM(p.PCG_DESC) AS PCG_DESC,
          FORMAT(s.SCC_DATA, 'MMyyyy') AS MES_ANO,
          SUM(s.SCC_SALDO) AS TOTAL_SALDO
        FROM TBMOVCC_SALDO s
        INNER JOIN TBCXAPLANO p ON p.PCG_CODI = s.PCG_CODI
        INNER JOIN Ultimos12Meses u ON FORMAT(s.SCC_DATA, 'MMyyyy') = u.MES_ANO
        WHERE LTRIM(RTRIM(s.LOC_CODI)) = :locCodi
        GROUP BY 
          s.LOC_CODI, s.EMP_CODI, s.PCG_CODI, p.PCG_DESC, FORMAT(s.SCC_DATA, 'MMyyyy')
        ORDER BY 
          CAST(RIGHT(FORMAT(s.SCC_DATA, 'MMyyyy'), 4) + LEFT(FORMAT(s.SCC_DATA, 'MMyyyy'), 2) AS INT) DESC,
          TOTAL_SALDO DESC
      `, {
        type: sequelizePontoVenda.QueryTypes.SELECT,
        replacements: { locCodi }
      });

      res.json(resultados);
    } catch (error) {
      console.error('Erro ao buscar Top Financeiro:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  return router;
};