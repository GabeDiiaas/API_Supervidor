const express = require('express');
const { sequelizePontoVenda } = require('../config/database');
const router = express.Router();

module.exports = ({ sequelizeUltraSyst }) => {
  router.get('/', async (req, res) => {
    try {
      const [results] = await sequelizeUltraSyst.query(`SELECT DRP_VPGT FROM TBRECEBERPA`);
      res.json(results);
    } catch (error) {
      console.error('Erro ao buscar a tabela TBRECEBERPA:', error);
      res.status(500).json({ error: 'Erro ao consultar o campo' });
    }
  });

  router.get('/pagar_dia', async (req, res) => {
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
                COALESCE(P.DPG_VDUP, 0)
                - CASE 
                    WHEN P.DPG_DTDE <= P.DPG_DTVE THEN COALESCE(P.DPG_VDES, 0)
                    ELSE 0
                  END
                - CASE 
                    WHEN PP.DPP_DTPG = @DataAtual THEN COALESCE(PP.DPP_VPGT, 0)
                    ELSE 0 
                  END
            ) AS ValorPagar,
            MAX(P.LOC_CODI) AS LOC_CODI_PAGAR,
            MAX(PP.LOC_CODI) AS LOC_CODI_PAGARPA
        FROM 
            TBPAGAR P
        LEFT JOIN 
            TBPAGARPA PP ON P.DPG_NLAN = PP.DPG_NLAN AND PP.LOC_CODI = :locCodi
        WHERE
            P.DPG_DTVE = @DataAtual
            AND (P.DPG_DTPG IS NULL OR P.DPG_DTPG = P.DPG_DTVE)
            AND PP.DPG_NLAN IS NULL
            AND P.LOC_CODI = :locCodi
        `,
        {
          replacements: { locCodi }
        }
      );

      res.json({ data: resultado[0] });
    } catch (error) {
      console.error('Erro ao buscar o total a pagar do dia:', error);
      res.status(500).json({ error: 'Erro ao buscar o total a pagar do dia' });
    }
  });



   router.get('/pagar_dia_PontoVenda', async (req, res) => {
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
                COALESCE(P.DPG_VDUP, 0)
                - CASE 
                    WHEN P.DPG_DTDE <= P.DPG_DTVE THEN COALESCE(P.DPG_VDES, 0)
                    ELSE 0
                  END
                - CASE 
                    WHEN PP.DPP_DTPG = @DataAtual THEN COALESCE(PP.DPP_VPGT, 0)
                    ELSE 0 
                  END
            ) AS ValorPagar,
            MAX(P.LOC_CODI) AS LOC_CODI_PAGAR,
            MAX(PP.LOC_CODI) AS LOC_CODI_PAGARPA
        FROM 
            TBPAGAR P
        LEFT JOIN 
            TBPAGARPA PP ON P.DPG_NLAN = PP.DPG_NLAN AND PP.LOC_CODI = :locCodi
        WHERE
            P.DPG_DTVE = @DataAtual
            AND (P.DPG_DTPG IS NULL OR P.DPG_DTPG = P.DPG_DTVE)
            AND PP.DPG_NLAN IS NULL
            AND P.LOC_CODI = :locCodi
        `,
        {
          replacements: { locCodi }
        }
      );

      res.json({ data: resultado[0] });
    } catch (error) {
      console.error('Erro ao buscar o total a pagar do dia:', error);
      res.status(500).json({ error: 'Erro ao buscar o total a pagar do dia' });
    }
  });

  return router;
};