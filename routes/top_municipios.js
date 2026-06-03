const express = require('express');
const { sequelizePontoVenda } = require('../config/database');
const router = express.Router();

module.exports = ({ sequelizeUltraSyst }) => {
  router.get('/top_municipios', async (req, res) => {
    const { locCodi } = req.query;

    if (!locCodi) {
      return res.status(400).json({ error: 'Parâmetro locCodi é obrigatório' });
    }

    try {
      const resultados = await sequelizeUltraSyst.query(`
SELECT 
    V.MMA_MES_ANO,
    M.UND_CDNAC,
    C.MUN_CODI,
    RTRIM(M.MUN_NOME) AS MUNICIPIO,
    SUM(V.MMA_VALOR_LIQUIDO) AS FATURAMENTO_TOTAL
FROM 
    TBMOVTO_VENDA_MES_ANO V
INNER JOIN CLIENTE C 
    ON V.CLI_CODI = C.CLI_CODI
INNER JOIN TBMUNICIPIOS M 
    ON C.MUN_CODI = M.MUN_CODI 
   AND C.UND_CDNAC = M.UND_CDNAC
WHERE 
    V.LOC_CODI = :locCodi
    AND V.MMA_VALOR_LIQUIDO > 0
    AND TRY_CAST(
        SUBSTRING(V.MMA_MES_ANO, 3, 4) + '-' + SUBSTRING(V.MMA_MES_ANO, 1, 2) + '-01'
        AS DATE
    ) >= DATEADD(MONTH, -11, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
GROUP BY 
    V.MMA_MES_ANO,
    M.UND_CDNAC,
    C.MUN_CODI,
    M.MUN_NOME
ORDER BY 
    V.MMA_MES_ANO,
    FATURAMENTO_TOTAL DESC;
      `, {
        replacements: { locCodi },
        type: sequelizeUltraSyst.QueryTypes.SELECT
      });

      res.json(resultados);
    } catch (error) {
      console.error('Erro ao buscar faturamento por município:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });


   router.get('/top_municipios_PontoVenda', async (req, res) => {
    const { locCodi } = req.query;

    if (!locCodi) {
      return res.status(400).json({ error: 'Parâmetro locCodi é obrigatório' });
    }

    try {
      const resultados = await sequelizePontoVenda.query(`
SELECT 
    V.MMA_MES_ANO,
    M.UND_CDNAC,
    C.MUN_CODI,
    RTRIM(M.MUN_NOME) AS MUNICIPIO,
    SUM(V.MMA_VALOR_LIQUIDO) AS FATURAMENTO_TOTAL
FROM 
    TBMOVTO_VENDA_MES_ANO V
INNER JOIN CLIENTE C 
    ON V.CLI_CODI = C.CLI_CODI
INNER JOIN TBMUNICIPIOS M 
    ON C.MUN_CODI = M.MUN_CODI 
   AND C.UND_CDNAC = M.UND_CDNAC
WHERE 
    V.LOC_CODI = :locCodi
    AND V.MMA_VALOR_LIQUIDO > 0
    AND TRY_CAST(
        SUBSTRING(V.MMA_MES_ANO, 3, 4) + '-' + SUBSTRING(V.MMA_MES_ANO, 1, 2) + '-01'
        AS DATE
    ) >= DATEADD(MONTH, -11, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
GROUP BY 
    V.MMA_MES_ANO,
    M.UND_CDNAC,
    C.MUN_CODI,
    M.MUN_NOME
ORDER BY 
    V.MMA_MES_ANO,
    FATURAMENTO_TOTAL DESC;
      `, {
        replacements: { locCodi },
        type: sequelizePontoVenda.QueryTypes.SELECT
      });

      res.json(resultados);
    } catch (error) {
      console.error('Erro ao buscar faturamento por município:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  return router;
};