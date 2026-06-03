const express = require('express');
const { sequelizePontoVenda } = require('../config/database');
const router = express.Router();

module.exports = ({ sequelizeUltraSyst }) => {
  router.get('/top_despesas', async (req, res) => {
    try {
      const { locCodi } = req.query;

      if (!locCodi) {
        return res.status(400).json({ error: 'Parâmetro locCodi é obrigatório' });
      }

      const resultados = await sequelizeUltraSyst.query(`
        -- Últimos 12 meses disponíveis
        WITH Ultimos12Meses AS (
          SELECT TOP 12 
            FORMAT(SRD_DATA, 'MMyyyy') AS MES_ANO
          FROM TBMOVCC_RECDES_SALDO
          WHERE LTRIM(RTRIM(LOC_CODI)) = :locCodi
          GROUP BY FORMAT(SRD_DATA, 'MMyyyy')
          ORDER BY CAST(RIGHT(FORMAT(SRD_DATA, 'MMyyyy'), 4) + LEFT(FORMAT(SRD_DATA, 'MMyyyy'), 2) AS INT) DESC
        )

        SELECT 
          m.LOC_CODI,
          m.EMP_CODI,

          -- Formata CCU_CODI como 03.04.001
          RIGHT('00' + LEFT(m.CCU_CODI, 2), 2) + '.' +
          RIGHT('00' + SUBSTRING(m.CCU_CODI, 3, 2), 2) + '.' +
          RIGHT('000' + RIGHT(m.CCU_CODI, 3), 3) AS CCU_CODI_FORMATADO,

          RTRIM(c.CCU_DESC) AS CCU_DESC,
          FORMAT(m.SRD_DATA, 'MMyyyy') AS MES_ANO,

          -- Soma absoluta dos saldos
          SUM(ABS(m.SRD_SALDO)) AS TOTAL_DESPESA

        FROM TBMOVCC_RECDES_SALDO m
        INNER JOIN TBCCUSTO c ON c.CCU_CODI = m.CCU_CODI
        INNER JOIN Ultimos12Meses u ON FORMAT(m.SRD_DATA, 'MMyyyy') = u.MES_ANO
        WHERE LTRIM(RTRIM(m.LOC_CODI)) = :locCodi
        GROUP BY 
          m.LOC_CODI, m.EMP_CODI, m.CCU_CODI, c.CCU_DESC, FORMAT(m.SRD_DATA, 'MMyyyy')
        ORDER BY 
          CAST(RIGHT(FORMAT(m.SRD_DATA, 'MMyyyy'), 4) + LEFT(FORMAT(m.SRD_DATA, 'MMyyyy'), 2) AS INT) DESC,
          TOTAL_DESPESA DESC
      `, {
        type: sequelizeUltraSyst.QueryTypes.SELECT,
        replacements: { locCodi }
      });

      res.json(resultados);
    } catch (error) {
      console.error('Erro ao buscar Top Despesas:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });


   router.get('/top_despesas_PontoVenda', async (req, res) => {
    try {
      const { locCodi } = req.query;

      if (!locCodi) {
        return res.status(400).json({ error: 'Parâmetro locCodi é obrigatório' });
      }

      const resultados = await sequelizePontoVenda.query(`
        -- Últimos 12 meses disponíveis
        WITH Ultimos12Meses AS (
          SELECT TOP 12 
            FORMAT(SRD_DATA, 'MMyyyy') AS MES_ANO
          FROM TBMOVCC_RECDES_SALDO
          WHERE LTRIM(RTRIM(LOC_CODI)) = :locCodi
          GROUP BY FORMAT(SRD_DATA, 'MMyyyy')
          ORDER BY CAST(RIGHT(FORMAT(SRD_DATA, 'MMyyyy'), 4) + LEFT(FORMAT(SRD_DATA, 'MMyyyy'), 2) AS INT) DESC
        )

        SELECT 
          m.LOC_CODI,
          m.EMP_CODI,

          -- Formata CCU_CODI como 03.04.001
          RIGHT('00' + LEFT(m.CCU_CODI, 2), 2) + '.' +
          RIGHT('00' + SUBSTRING(m.CCU_CODI, 3, 2), 2) + '.' +
          RIGHT('000' + RIGHT(m.CCU_CODI, 3), 3) AS CCU_CODI_FORMATADO,

          RTRIM(c.CCU_DESC) AS CCU_DESC,
          FORMAT(m.SRD_DATA, 'MMyyyy') AS MES_ANO,

          -- Soma absoluta dos saldos
          SUM(ABS(m.SRD_SALDO)) AS TOTAL_DESPESA

        FROM TBMOVCC_RECDES_SALDO m
        INNER JOIN TBCCUSTO c ON c.CCU_CODI = m.CCU_CODI
        INNER JOIN Ultimos12Meses u ON FORMAT(m.SRD_DATA, 'MMyyyy') = u.MES_ANO
        WHERE LTRIM(RTRIM(m.LOC_CODI)) = :locCodi
        GROUP BY 
          m.LOC_CODI, m.EMP_CODI, m.CCU_CODI, c.CCU_DESC, FORMAT(m.SRD_DATA, 'MMyyyy')
        ORDER BY 
          CAST(RIGHT(FORMAT(m.SRD_DATA, 'MMyyyy'), 4) + LEFT(FORMAT(m.SRD_DATA, 'MMyyyy'), 2) AS INT) DESC,
          TOTAL_DESPESA DESC
      `, {
        type: sequelizePontoVenda.QueryTypes.SELECT,
        replacements: { locCodi }
      });

      res.json(resultados);
    } catch (error) {
      console.error('Erro ao buscar Top Despesas:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  return router;
};