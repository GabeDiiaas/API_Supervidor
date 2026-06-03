const express = require('express');
const { sequelizePontoVenda } = require('../config/database');
const router = express.Router();

module.exports = ({ sequelizeUltraSyst }) => {
  // ROTA 1: Pagamentos no último dia registrado
  router.get('/top_Pagamentos', async (req, res) => {
    try {
      const locCodiFiltro = req.query.locCodi?.trim();

      if (!locCodiFiltro) {
        return res.status(400).json({ error: "Parâmetro 'locCodi' é obrigatório" });
      }

      const resultados = await sequelizeUltraSyst.query(`
        SELECT 
          v.LOC_CODI,
          v.TCB_CODI,
          v.VTC_DIA,
          v.VTC_VALOR,
          c.TCB_DESC
        FROM TBVENDA_TIPOCOBR v
        INNER JOIN TIPOCOBR c ON v.TCB_CODI = c.TCB_CODI
        WHERE 
          LTRIM(RTRIM(v.LOC_CODI)) = :locCodi
          AND CAST(v.VTC_DIA AS DATE) = (
            SELECT TOP 1 CAST(v2.VTC_DIA AS DATE)
            FROM TBVENDA_TIPOCOBR v2
            WHERE LTRIM(RTRIM(v2.LOC_CODI)) = :locCodi
            ORDER BY 
              CASE 
                WHEN CAST(v2.VTC_DIA AS DATE) = CAST(GETDATE() AS DATE) THEN 0 
                ELSE 1 
              END,
              v2.VTC_DIA DESC
          )
        ORDER BY v.VTC_DIA DESC
      `, {
        replacements: { locCodi: locCodiFiltro },
        type: sequelizeUltraSyst.QueryTypes.SELECT
      });

      res.json(resultados);

    } catch (error) {
      console.error('Erro ao buscar dados tipo pagamentos:', error);
      res.status(500).json({ error: 'Erro ao buscar dados tipo pagamentos' });
    }
  });

  // ROTA 2: Pagamentos dos últimos 12 meses no formato MMyyyy
  router.get('/top_Pagamentos_12meses', async (req, res) => {
    try {
      const locCodiFiltro = req.query.locCodi?.trim();

      if (!locCodiFiltro) {
        return res.status(400).json({ error: "Parâmetro 'locCodi' é obrigatório" });
      }

      const resultados = await sequelizeUltraSyst.query(`
        WITH UltimaData AS (
          SELECT MAX(CAST(VTC_DIA AS DATE)) AS DataMaisRecente
          FROM TBVENDA_TIPOCOBR
          WHERE LTRIM(RTRIM(LOC_CODI)) = :locCodi
        ),
        PeriodoDesejado AS (
          SELECT DATEADD(MONTH, -n.numero, EOMONTH(U.DataMaisRecente)) AS InicioMes
          FROM UltimaData U
          CROSS APPLY (
            SELECT TOP 12 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS numero
            FROM sys.all_objects
          ) n
        )
        SELECT
          v.LOC_CODI,
          v.TCB_CODI,
          FORMAT(v.VTC_DIA, 'MMyyyy') AS MES_ANO,
          SUM(v.VTC_VALOR) AS TOTAL_VALOR,
          c.TCB_DESC
        FROM TBVENDA_TIPOCOBR v
        INNER JOIN TIPOCOBR c ON v.TCB_CODI = c.TCB_CODI
        WHERE 
          LTRIM(RTRIM(v.LOC_CODI)) = :locCodi
          AND FORMAT(v.VTC_DIA, 'yyyy-MM-01') IN (
            SELECT CONVERT(char(7), InicioMes, 120) + '-01' FROM PeriodoDesejado
          )
        GROUP BY 
          v.LOC_CODI, v.TCB_CODI, FORMAT(v.VTC_DIA, 'MMyyyy'), c.TCB_DESC
        ORDER BY MES_ANO DESC
      `, {
        replacements: { locCodi: locCodiFiltro },
        type: sequelizeUltraSyst.QueryTypes.SELECT
      });

      res.json(resultados);

    } catch (error) {
      console.error('Erro ao buscar dados dos últimos 12 meses:', error);
      res.status(500).json({ error: 'Erro ao buscar dados dos últimos 12 meses' });
    }
  });

  // Rota: Vendas a Prazo e à Vista por mês dos últimos 12 meses
  router.get('/vendas_aprazo_avista_12meses', async (req, res) => {
    const locCodi = req.query.locCodi?.trim();
    const locFilter = locCodi ? `AND LOC_CODI = :locCodi` : '';

    try {
      const resultados = await sequelizeUltraSyst.query(`
        WITH UltimaData AS (
          SELECT MAX(MVD_DIA) AS DataMaisRecente
          FROM TBMOVTO_VENDA_DIA
          WHERE (MVD_VALOR_APRAZO IS NOT NULL OR MVD_VALOR_AVISTA IS NOT NULL)
          ${locFilter}
        ),
        PeriodoDesejado AS (
          SELECT DATEADD(MONTH, -n.numero, EOMONTH(U.DataMaisRecente)) AS InicioMes
          FROM UltimaData U
          CROSS APPLY (
            SELECT TOP 12 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS numero
            FROM sys.all_objects
          ) n
        )
        SELECT
          FORMAT(MVD_DIA, 'MMyyyy') AS mesAno,
          SUM(MVD_VALOR_APRAZO) AS valor_aprazo,
          SUM(MVD_VALOR_AVISTA) AS valor_avista,
          MAX(LOC_CODI) AS loc_codi
        FROM TBMOVTO_VENDA_DIA
        WHERE
          (MVD_VALOR_APRAZO IS NOT NULL OR MVD_VALOR_AVISTA IS NOT NULL)
          AND FORMAT(MVD_DIA, 'yyyyMM') IN (
            SELECT FORMAT(InicioMes, 'yyyyMM') FROM PeriodoDesejado
          )
          ${locFilter}
        GROUP BY FORMAT(MVD_DIA, 'MMyyyy')
        ORDER BY mesAno DESC;
      `, {
        replacements: locCodi ? { locCodi } : {},
        type: sequelizeUltraSyst.QueryTypes.SELECT
      });

      res.json(resultados);
    } catch (error) {
      console.error('Erro ao buscar vendas agrupadas por mês:', error);
      res.status(500).json({ error: 'Erro ao buscar vendas agrupadas por mês' });
    }
  });


  //Ponto de Vendas Rotas
  
  router.get('/top_Pagamentos_PontoVenda', async (req, res) => {
    try {
      const locCodiFiltro = req.query.locCodi?.trim();

      if (!locCodiFiltro) {
        return res.status(400).json({ error: "Parâmetro 'locCodi' é obrigatório" });
      }

      const resultados = await sequelizePontoVenda.query(`
        SELECT 
          v.LOC_CODI,
          v.TCB_CODI,
          v.VTC_DIA,
          v.VTC_VALOR,
          c.TCB_DESC
        FROM TBVENDA_TIPOCOBR v
        INNER JOIN TIPOCOBR c ON v.TCB_CODI = c.TCB_CODI
        WHERE 
          LTRIM(RTRIM(v.LOC_CODI)) = :locCodi
          AND CAST(v.VTC_DIA AS DATE) = (
            SELECT TOP 1 CAST(v2.VTC_DIA AS DATE)
            FROM TBVENDA_TIPOCOBR v2
            WHERE LTRIM(RTRIM(v2.LOC_CODI)) = :locCodi
            ORDER BY 
              CASE 
                WHEN CAST(v2.VTC_DIA AS DATE) = CAST(GETDATE() AS DATE) THEN 0 
                ELSE 1 
              END,
              v2.VTC_DIA DESC
          )
        ORDER BY v.VTC_DIA DESC
      `, {
        replacements: { locCodi: locCodiFiltro },
        type: sequelizePontoVenda.QueryTypes.SELECT
      });

      res.json(resultados);

    } catch (error) {
      console.error('Erro ao buscar dados tipo pagamentos:', error);
      res.status(500).json({ error: 'Erro ao buscar dados tipo pagamentos' });
    }
  });

  // ROTA 2: Pagamentos dos últimos 12 meses no formato MMyyyy
  router.get('/top_Pagamentos_12meses_PontoVenda', async (req, res) => {
    try {
      const locCodiFiltro = req.query.locCodi?.trim();

      if (!locCodiFiltro) {
        return res.status(400).json({ error: "Parâmetro 'locCodi' é obrigatório" });
      }

      const resultados = await sequelizePontoVenda.query(`
        WITH UltimaData AS (
          SELECT MAX(CAST(VTC_DIA AS DATE)) AS DataMaisRecente
          FROM TBVENDA_TIPOCOBR
          WHERE LTRIM(RTRIM(LOC_CODI)) = :locCodi
        ),
        PeriodoDesejado AS (
          SELECT DATEADD(MONTH, -n.numero, EOMONTH(U.DataMaisRecente)) AS InicioMes
          FROM UltimaData U
          CROSS APPLY (
            SELECT TOP 12 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS numero
            FROM sys.all_objects
          ) n
        )
        SELECT
          v.LOC_CODI,
          v.TCB_CODI,
          FORMAT(v.VTC_DIA, 'MMyyyy') AS MES_ANO,
          SUM(v.VTC_VALOR) AS TOTAL_VALOR,
          c.TCB_DESC
        FROM TBVENDA_TIPOCOBR v
        INNER JOIN TIPOCOBR c ON v.TCB_CODI = c.TCB_CODI
        WHERE 
          LTRIM(RTRIM(v.LOC_CODI)) = :locCodi
          AND FORMAT(v.VTC_DIA, 'yyyy-MM-01') IN (
            SELECT CONVERT(char(7), InicioMes, 120) + '-01' FROM PeriodoDesejado
          )
        GROUP BY 
          v.LOC_CODI, v.TCB_CODI, FORMAT(v.VTC_DIA, 'MMyyyy'), c.TCB_DESC
        ORDER BY MES_ANO DESC
      `, {
        replacements: { locCodi: locCodiFiltro },
        type: sequelizePontoVenda.QueryTypes.SELECT
      });

      res.json(resultados);

    } catch (error) {
      console.error('Erro ao buscar dados dos últimos 12 meses:', error);
      res.status(500).json({ error: 'Erro ao buscar dados dos últimos 12 meses' });
    }
  });

  // Rota: Vendas a Prazo e à Vista por mês dos últimos 12 meses
  router.get('/vendas_aprazo_avista_12meses_PontoVenda', async (req, res) => {
    const locCodi = req.query.locCodi?.trim();
    const locFilter = locCodi ? `AND LOC_CODI = :locCodi` : '';

    try {
      const resultados = await sequelizePontoVenda.query(`
        WITH UltimaData AS (
          SELECT MAX(MVD_DIA) AS DataMaisRecente
          FROM TBMOVTO_VENDA_DIA
          WHERE (MVD_VALOR_APRAZO IS NOT NULL OR MVD_VALOR_AVISTA IS NOT NULL)
          ${locFilter}
        ),
        PeriodoDesejado AS (
          SELECT DATEADD(MONTH, -n.numero, EOMONTH(U.DataMaisRecente)) AS InicioMes
          FROM UltimaData U
          CROSS APPLY (
            SELECT TOP 12 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS numero
            FROM sys.all_objects
          ) n
        )
        SELECT
          FORMAT(MVD_DIA, 'MMyyyy') AS mesAno,
          SUM(MVD_VALOR_APRAZO) AS valor_aprazo,
          SUM(MVD_VALOR_AVISTA) AS valor_avista,
          MAX(LOC_CODI) AS loc_codi
        FROM TBMOVTO_VENDA_DIA
        WHERE
          (MVD_VALOR_APRAZO IS NOT NULL OR MVD_VALOR_AVISTA IS NOT NULL)
          AND FORMAT(MVD_DIA, 'yyyyMM') IN (
            SELECT FORMAT(InicioMes, 'yyyyMM') FROM PeriodoDesejado
          )
          ${locFilter}
        GROUP BY FORMAT(MVD_DIA, 'MMyyyy')
        ORDER BY mesAno DESC;
      `, {
        replacements: locCodi ? { locCodi } : {},
        type: sequelizePontoVenda.QueryTypes.SELECT
      });

      res.json(resultados);
    } catch (error) {
      console.error('Erro ao buscar vendas agrupadas por mês:', error);
      res.status(500).json({ error: 'Erro ao buscar vendas agrupadas por mês' });
    }
  });


  return router;
};