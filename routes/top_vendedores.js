const express = require('express');
const { sequelizePontoVenda } = require('../config/database');
const router = express.Router();

module.exports = ({ sequelizeUltraSyst }) => {
  router.get('/top_Vendedores', async (req, res) => {
    try {
      const locCodiFiltro = req.query.locCodi?.trim();
      if (!locCodiFiltro) {
        return res.status(400).json({ error: "Parâmetro 'locCodi' é obrigatório" });
      }

      // Calcula yyyyMM de hoje e de 11 meses atrás
      const now = new Date();
      const dataFim = parseInt(now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0'), 10);

      const pastDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const dataInicio = parseInt(pastDate.getFullYear().toString() + String(pastDate.getMonth() + 1).padStart(2, '0'), 10);

      const resultados = await sequelizeUltraSyst.query(`
        SELECT  
            M.VEN_CODI,
            RTRIM(V.VEN_NOME) AS VEN_NOME,
            M.MMA_MES_ANO,
            SUM(M.MMA_VALOR_LIQUIDO) AS faturamento
        FROM TBMOVTO_VENDA_MES_ANO M
        INNER JOIN VENDEDOR V ON V.VEN_CODI = M.VEN_CODI
        WHERE
            CAST(RIGHT(M.MMA_MES_ANO, 4) + LEFT(M.MMA_MES_ANO, 2) AS INT) BETWEEN :dataInicio AND :dataFim
            AND LTRIM(RTRIM(M.LOC_CODI)) = :locCodi
        GROUP BY M.VEN_CODI, V.VEN_NOME, M.MMA_MES_ANO
        HAVING SUM(M.MMA_VALOR_LIQUIDO) <> 0
        ORDER BY M.MMA_MES_ANO DESC, faturamento DESC;
      `, {
        replacements: {
          locCodi: locCodiFiltro,
          dataInicio,
          dataFim
        },
        type: sequelizeUltraSyst.QueryTypes.SELECT
      });

      res.json(resultados);
    } catch (error) {
      console.error('Erro ao buscar faturamento por vendedor:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

// Rota Ponto de vendas


   router.get('/top_Vendedores_PontoVenda', async (req, res) => {
    try {
      const locCodiFiltro = req.query.locCodi?.trim();
      if (!locCodiFiltro) {
        return res.status(400).json({ error: "Parâmetro 'locCodi' é obrigatório" });
      }

      // Calcula yyyyMM de hoje e de 11 meses atrás
      const now = new Date();
      const dataFim = parseInt(now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0'), 10);

      const pastDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const dataInicio = parseInt(pastDate.getFullYear().toString() + String(pastDate.getMonth() + 1).padStart(2, '0'), 10);

      const resultados = await sequelizePontoVenda.query(`
        SELECT  
            M.VEN_CODI,
            RTRIM(V.VEN_NOME) AS VEN_NOME,
            M.MMA_MES_ANO,
            SUM(M.MMA_VALOR_LIQUIDO) AS faturamento
        FROM TBMOVTO_VENDA_MES_ANO M
        INNER JOIN VENDEDOR V ON V.VEN_CODI = M.VEN_CODI
        WHERE
            CAST(RIGHT(M.MMA_MES_ANO, 4) + LEFT(M.MMA_MES_ANO, 2) AS INT) BETWEEN :dataInicio AND :dataFim
            AND LTRIM(RTRIM(M.LOC_CODI)) = :locCodi
        GROUP BY M.VEN_CODI, V.VEN_NOME, M.MMA_MES_ANO
        HAVING SUM(M.MMA_VALOR_LIQUIDO) <> 0
        ORDER BY M.MMA_MES_ANO DESC, faturamento DESC;
      `, {
        replacements: {
          locCodi: locCodiFiltro,
          dataInicio,
          dataFim
        },
        type: sequelizePontoVenda.QueryTypes.SELECT
      });

      res.json(resultados);
    } catch (error) {
      console.error('Erro ao buscar faturamento por vendedor:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  return router;
};