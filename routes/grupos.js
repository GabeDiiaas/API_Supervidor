const express = require('express');
const { sequelizePontoVenda } = require('../config/database');

module.exports = ({ sequelizeUltraSyst }) => {
  const router = express.Router();

  router.get('/grupos_faturamento', async (req, res) => {
    try {
      const { locCodi } = req.query; 

      // Busca os últimos 12 meses distintos
      const meses = await sequelizeUltraSyst.query(`
        SELECT MMA_MES_ANO FROM (
          SELECT DISTINCT
              MMA_MES_ANO,
              RIGHT(MMA_MES_ANO, 4) AS Ano,
              LEFT(MMA_MES_ANO, 2) AS Mes
          FROM TBMOVTO_VENDA_MES_ANO
          ${locCodi ? 'WHERE LOC_CODI = :locCodi' : ''}
        ) AS sub
        ORDER BY Ano DESC, Mes DESC;
      `, {
        replacements: locCodi ? { locCodi } : {},
        type: sequelizeUltraSyst.QueryTypes.SELECT
      });

      if (!meses || meses.length === 0) {
        return res.status(404).json({ message: 'Nenhum mês/ano encontrado.' });
      }

      const resultadoPorMes = [];

      for (const { MMA_MES_ANO } of meses) {
        const grupos = await sequelizeUltraSyst.query(`
          SELECT 
            G.GRU_CODI,
            RTRIM(G.GRU_DESC) AS GRU_DESC,
            SUM(M.MMA_VALOR_LIQUIDO) AS faturamento
          FROM TBMOVTO_VENDA_MES_ANO M
          INNER JOIN PRODUTO P ON P.PRO_CODI = M.PRO_CODI
          INNER JOIN TBGRUPO G ON G.GRU_CODI = P.GRU_CODI
          WHERE M.MMA_MES_ANO = :mesAno
          ${locCodi ? 'AND M.LOC_CODI = :locCodi' : ''}
          GROUP BY G.GRU_CODI, G.GRU_DESC
          HAVING SUM(M.MMA_VALOR_LIQUIDO) <> 0
          ORDER BY G.GRU_DESC;
        `, {
          replacements: locCodi ? { mesAno: MMA_MES_ANO, locCodi } : { mesAno: MMA_MES_ANO },
          type: sequelizeUltraSyst.QueryTypes.SELECT
        });

        resultadoPorMes.push({
          mesAno: MMA_MES_ANO,
          grupos
        });
      }

      return res.json(resultadoPorMes);

    } catch (error) {
      console.error('Erro na rota /grupos_faturamento:', error);
      return res.status(500).json({ error: 'Erro ao buscar o faturamento por grupo.' });
    }
  });

// rota Ponto de Venda

    router.get('/grupos_faturamento_PontoVenda', async (req, res) => {
    try {
      const { locCodi } = req.query; 

      // Busca os últimos 12 meses distintos
      const meses = await sequelizePontoVenda.query(`
        SELECT MMA_MES_ANO FROM (
          SELECT DISTINCT
              MMA_MES_ANO,
              RIGHT(MMA_MES_ANO, 4) AS Ano,
              LEFT(MMA_MES_ANO, 2) AS Mes
          FROM TBMOVTO_VENDA_MES_ANO
          ${locCodi ? 'WHERE LOC_CODI = :locCodi' : ''}
        ) AS sub
        ORDER BY Ano DESC, Mes DESC;
      `, {
        replacements: locCodi ? { locCodi } : {},
        type: sequelizePontoVenda.QueryTypes.SELECT
      });

      if (!meses || meses.length === 0) {
        return res.status(404).json({ message: 'Nenhum mês/ano encontrado.' });
      }

      const resultadoPorMes = [];

      for (const { MMA_MES_ANO } of meses) {
        const grupos = await sequelizeUltraSyst.query(`
          SELECT 
            G.GRU_CODI,
            RTRIM(G.GRU_DESC) AS GRU_DESC,
            SUM(M.MMA_VALOR_LIQUIDO) AS faturamento
          FROM TBMOVTO_VENDA_MES_ANO M
          INNER JOIN PRODUTO P ON P.PRO_CODI = M.PRO_CODI
          INNER JOIN TBGRUPO G ON G.GRU_CODI = P.GRU_CODI
          WHERE M.MMA_MES_ANO = :mesAno
          ${locCodi ? 'AND M.LOC_CODI = :locCodi' : ''}
          GROUP BY G.GRU_CODI, G.GRU_DESC
          HAVING SUM(M.MMA_VALOR_LIQUIDO) <> 0
          ORDER BY G.GRU_DESC;
        `, {
          replacements: locCodi ? { mesAno: MMA_MES_ANO, locCodi } : { mesAno: MMA_MES_ANO },
          type: sequelizePontoVenda.QueryTypes.SELECT
        });

        resultadoPorMes.push({
          mesAno: MMA_MES_ANO,
          grupos
        });
      }

      return res.json(resultadoPorMes);

    } catch (error) {
      console.error('Erro na rota /grupos_faturamento:', error);
      return res.status(500).json({ error: 'Erro ao buscar o faturamento por grupo.' });
    }
  });


  return router;
};