const express = require('express');
const { sequelizePontoVenda } = require('../config/database');
const router = express.Router();

module.exports = ({ sequelizeUltraSyst }) => {
  router.get('/top_clientes', async (req, res) => {
    try {
      const { locCodi } = req.query;

      if (!locCodi) {
        return res.status(400).json({ error: 'Parâmetro locCodi é obrigatório' });
      }

      const resultados = await sequelizeUltraSyst.query(`
        WITH Ultimos12Meses AS (
          SELECT TOP 12 MMA_MES_ANO
          FROM TBMOVTO_VENDA_MES_ANO
          WHERE LOC_CODI = :locCodi
          GROUP BY MMA_MES_ANO
          ORDER BY CAST(RIGHT(MMA_MES_ANO, 4) + LEFT(MMA_MES_ANO, 2) AS INT) DESC
        )

        SELECT 
          RTRIM(C.CLI_NOME) AS CLI_NOME,
          C.CLI_CODI,
          C.ATI_CODI,
          V.MMA_MES_ANO,
          SUM(V.MMA_VALOR_LIQUIDO) AS MMA_VALOR_LIQUIDO
        FROM TBMOVTO_VENDA_MES_ANO V
        INNER JOIN CLIENTE C ON C.CLI_CODI = V.CLI_CODI
        INNER JOIN Ultimos12Meses U ON V.MMA_MES_ANO = U.MMA_MES_ANO
        WHERE V.LOC_CODI = :locCodi
        GROUP BY 
          C.CLI_NOME, C.CLI_CODI, C.ATI_CODI, V.MMA_MES_ANO
        ORDER BY 
          CAST(RIGHT(V.MMA_MES_ANO, 4) + LEFT(V.MMA_MES_ANO, 2) AS INT) DESC,
          MMA_VALOR_LIQUIDO DESC
      `, {
        type: sequelizeUltraSyst.QueryTypes.SELECT,
        replacements: { locCodi }
      });

      res.json(resultados);
    } catch (error) {
      console.error('Erro ao buscar Top Clientes:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  router.get('/top_clientes_PontoVenda', async (req, res) => {
    try {
      const { locCodi } = req.query;

      if (!locCodi) {
        return res.status(400).json({ error: 'Parâmetro locCodi é obrigatório' });
      }

      const resultados = await sequelizePontoVenda.query(`
        WITH Ultimos12Meses AS (
          SELECT TOP 12 MMA_MES_ANO
          FROM TBMOVTO_VENDA_MES_ANO
          WHERE LOC_CODI = :locCodi
          GROUP BY MMA_MES_ANO
          ORDER BY CAST(RIGHT(MMA_MES_ANO, 4) + LEFT(MMA_MES_ANO, 2) AS INT) DESC
        )

        SELECT 
          RTRIM(C.CLI_NOME) AS CLI_NOME,
          C.CLI_CODI,
          C.ATI_CODI,
          V.MMA_MES_ANO,
          SUM(V.MMA_VALOR_LIQUIDO) AS MMA_VALOR_LIQUIDO
        FROM TBMOVTO_VENDA_MES_ANO V
        INNER JOIN CLIENTE C ON C.CLI_CODI = V.CLI_CODI
        INNER JOIN Ultimos12Meses U ON V.MMA_MES_ANO = U.MMA_MES_ANO
        WHERE V.LOC_CODI = :locCodi
        GROUP BY 
          C.CLI_NOME, C.CLI_CODI, C.ATI_CODI, V.MMA_MES_ANO
        ORDER BY 
          CAST(RIGHT(V.MMA_MES_ANO, 4) + LEFT(V.MMA_MES_ANO, 2) AS INT) DESC,
          MMA_VALOR_LIQUIDO DESC
      `, {
        type: sequelizePontoVenda.QueryTypes.SELECT,
        replacements: { locCodi }
      });

      res.json(resultados);
    } catch (error) {
      console.error('Erro ao buscar Top Clientes:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  return router;
};