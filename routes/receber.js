const express = require('express');
const { sequelizePontoVenda } = require('../config/database');
const router = express.Router();

module.exports = ({ sequelizeUltraSyst }) => {
  router.get('/', async (req, res) => {
    try {
      const [results] = await sequelizeUltraSyst.query(`SELECT DRC_VDUP FROM TBRECEBER`);
      res.json(results);
    } catch (error) {
      console.error('Erro ao buscar a tabela TBRECEBER:', error);
      res.status(500).json({ error: 'Erro ao consultar o campo' });
    }
  });

  router.get('/receber_dia', async (req, res) => {
    const locCodi = req.query.locCodi;

    if (!locCodi) {
      return res.status(400).json({ error: 'O parâmetro locCodi é obrigatório' });
    }

    try {
      const [resultado] = await sequelizeUltraSyst.query(
        `
        DECLARE @DataAtual DATE = CAST(GETDATE() AS DATE);

        SELECT 
            COUNT(*) AS QuantidadeRegistros,
            SUM(
                COALESCE(R.DRC_VDUP, 0) - 
                CASE 
                    WHEN R.DRC_DTDE <= R.DRC_DTVE THEN COALESCE(R.DRC_VDES, 0)
                    ELSE 0
                END
            ) AS ValorReceber,
            MAX(R.LOC_CODI) AS LOC_CODI_RECEBER,
            MAX(P.LOC_CODI) AS LOC_CODI_RECEBERPA
        FROM 
            TBRECEBER R
        LEFT JOIN 
            TBRECEBERPA P ON R.DRC_NLAN = P.DRC_NLAN AND P.LOC_CODI = :locCodi
        WHERE 
            R.DRC_DTVE = @DataAtual
            AND P.DRC_NLAN IS NULL
            AND (R.DRC_DTRE IS NULL OR R.DRC_DTRE = R.DRC_DTVE)
            AND R.LOC_CODI = :locCodi
        `,
        {
          replacements: { locCodi }
        }
      );

      res.json({ data: resultado[0] });
    } catch (error) {
      console.error('Erro ao buscar o total do dia:', error);
      res.status(500).json({ error: 'Erro ao buscar o total do dia' });
    }
  });


  
  router.get('/receber_dia_PontoVenda', async (req, res) => {
    const locCodi = req.query.locCodi;

    if (!locCodi) {
      return res.status(400).json({ error: 'O parâmetro locCodi é obrigatório' });
    }

    try {
      const [resultado] = await sequelizePontoVenda.query(
        `
        DECLARE @DataAtual DATE = CAST(GETDATE() AS DATE);

        SELECT 
            COUNT(*) AS QuantidadeRegistros,
            SUM(
                COALESCE(R.DRC_VDUP, 0) - 
                CASE 
                    WHEN R.DRC_DTDE <= R.DRC_DTVE THEN COALESCE(R.DRC_VDES, 0)
                    ELSE 0
                END
            ) AS ValorReceber,
            MAX(R.LOC_CODI) AS LOC_CODI_RECEBER,
            MAX(P.LOC_CODI) AS LOC_CODI_RECEBERPA
        FROM 
            TBRECEBER R
        LEFT JOIN 
            TBRECEBERPA P ON R.DRC_NLAN = P.DRC_NLAN AND P.LOC_CODI = :locCodi
        WHERE 
            R.DRC_DTVE = @DataAtual
            AND P.DRC_NLAN IS NULL
            AND (R.DRC_DTRE IS NULL OR R.DRC_DTRE = R.DRC_DTVE)
            AND R.LOC_CODI = :locCodi
        `,
        {
          replacements: { locCodi }
        }
      );

      res.json({ data: resultado[0] });
    } catch (error) {
      console.error('Erro ao buscar o total do dia:', error);
      res.status(500).json({ error: 'Erro ao buscar o total do dia' });
    }
  });
  
  return router;
};