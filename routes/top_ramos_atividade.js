const express = require('express');
const { sequelizePontoVenda } = require('../config/database');
const router = express.Router();

module.exports = ({ sequelizeUltraSyst }) => {
  router.get('/top_Ramos', async (req, res) => {
    const { locCodi } = req.query;

    if (!locCodi) {
      return res.status(400).json({ error: 'Parâmetro locCodi é obrigatório' });
    }

    try {
      const resultados = await sequelizeUltraSyst.query(`
        -- CTE 1: Captura os últimos 12 MMA_MES_ANO válidos para a localidade
        WITH MesesDistintos AS (
          SELECT DISTINCT
            MMA_MES_ANO,
            RIGHT(MMA_MES_ANO, 4) AS Ano,
            LEFT(MMA_MES_ANO, 2) AS Mes
          FROM TBMOVTO_VENDA_MES_ANO
          WHERE LOC_CODI = :locCodi
        ),
        Ultimos12Meses AS (
          SELECT TOP 12 MMA_MES_ANO
          FROM MesesDistintos
          ORDER BY Ano DESC, Mes DESC
        ),

        -- CTE 2: Faturamento por GRU_CODI e MMA_MES_ANO
        FaturamentoGrupos AS (
          SELECT
            G.GRU_CODI,
            M.MMA_MES_ANO,
            SUM(M.MMA_VALOR_LIQUIDO) AS FATURAMENTO
          FROM TBMOVTO_VENDA_MES_ANO M
          INNER JOIN PRODUTO P ON P.PRO_CODI = M.PRO_CODI
          INNER JOIN TBGRUPO G ON G.GRU_CODI = P.GRU_CODI
          INNER JOIN Ultimos12Meses U ON U.MMA_MES_ANO = M.MMA_MES_ANO
          WHERE M.LOC_CODI = :locCodi
          GROUP BY G.GRU_CODI, M.MMA_MES_ANO
        )

        -- Consulta final: vincula os GRU_CODI existentes aos TPA_CODIGO correspondentes
        SELECT
          TA.TPA_CODIGO,
          RTRIM(TA.TPA_NOME)    AS TPA_NOME,
          :locCodi              AS LOC_CODI,
          FG.MMA_MES_ANO,
          FG.FATURAMENTO        AS TOTAL_FATURAMENTO
        FROM TBTIPO_ATIVIDADE TA
        INNER JOIN FaturamentoGrupos FG
          ON TA.TPA_CODIGO = FG.GRU_CODI
        ORDER BY FG.MMA_MES_ANO DESC, TA.TPA_CODIGO;
      `, {
        replacements: { locCodi },
        type: sequelizeUltraSyst.QueryTypes.SELECT
      });

      return res.json(resultados);
    } catch (error) {
      console.error('Erro ao buscar dados de top ramos:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });


  // Rota Ponto de Vendas

   router.get('/top_Ramos_PontoVenda', async (req, res) => {
    const { locCodi } = req.query;

    if (!locCodi) {
      return res.status(400).json({ error: 'Parâmetro locCodi é obrigatório' });
    }

    try {
      const resultados = await sequelizePontoVenda.query(`
        -- CTE 1: Captura os últimos 12 MMA_MES_ANO válidos para a localidade
        WITH MesesDistintos AS (
          SELECT DISTINCT
            MMA_MES_ANO,
            RIGHT(MMA_MES_ANO, 4) AS Ano,
            LEFT(MMA_MES_ANO, 2) AS Mes
          FROM TBMOVTO_VENDA_MES_ANO
          WHERE LOC_CODI = :locCodi
        ),
        Ultimos12Meses AS (
          SELECT TOP 12 MMA_MES_ANO
          FROM MesesDistintos
          ORDER BY Ano DESC, Mes DESC
        ),

        -- CTE 2: Faturamento por GRU_CODI e MMA_MES_ANO
        FaturamentoGrupos AS (
          SELECT
            G.GRU_CODI,
            M.MMA_MES_ANO,
            SUM(M.MMA_VALOR_LIQUIDO) AS FATURAMENTO
          FROM TBMOVTO_VENDA_MES_ANO M
          INNER JOIN PRODUTO P ON P.PRO_CODI = M.PRO_CODI
          INNER JOIN TBGRUPO G ON G.GRU_CODI = P.GRU_CODI
          INNER JOIN Ultimos12Meses U ON U.MMA_MES_ANO = M.MMA_MES_ANO
          WHERE M.LOC_CODI = :locCodi
          GROUP BY G.GRU_CODI, M.MMA_MES_ANO
        )

        -- Consulta final: vincula os GRU_CODI existentes aos TPA_CODIGO correspondentes
        SELECT
          TA.TPA_CODIGO,
          RTRIM(TA.TPA_NOME)    AS TPA_NOME,
          :locCodi              AS LOC_CODI,
          FG.MMA_MES_ANO,
          FG.FATURAMENTO        AS TOTAL_FATURAMENTO
        FROM TBTIPO_ATIVIDADE TA
        INNER JOIN FaturamentoGrupos FG
          ON TA.TPA_CODIGO = FG.GRU_CODI
        ORDER BY FG.MMA_MES_ANO DESC, TA.TPA_CODIGO;
      `, {
        replacements: { locCodi },
        type: sequelizePontoVenda.QueryTypes.SELECT
      });

      return res.json(resultados);
    } catch (error) {
      console.error('Erro ao buscar dados de top ramos:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
  return router;
};