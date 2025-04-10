const express = require('express');
const router = express.Router();

module.exports = (sequelize) => {
  router.get('/', async (req, res) => {
    try {
      const [results] = await sequelize.query(`SELECT DRC_VDUP FROM TBRECEBER`);
      res.json(results);
    } catch (error) {
      console.error('Erro ao buscar a tabela TBRECEBER:', error);
      res.status(500).json({ error: 'Erro ao consultar o campo' });
    }
  });

  router.get('/total-dia', async (req, res) => {
    try {
      const [resultado] = await sequelize.query(`
        DECLARE @DataAtual DATE = CAST(GETDATE() AS DATE);

        SELECT 
            SUM(COALESCE(R.DRC_VDUP, 0) + COALESCE(P.DRP_VPGT, 0)) AS ValorReceber
        FROM 
            TBRECEBER R
        LEFT JOIN 
            TBRECEBERPA P ON R.DRC_NLAN = P.DRC_NLAN
        WHERE
            R.DRC_DTVE = @DataAtual
            AND (R.DRC_DTRE IS NULL OR R.DRC_DTRE = R.DRC_DTVE);
      `);

      res.json({ data: resultado[0] });
    } catch (error) {
      console.error('Erro ao buscar o total do dia:', error);
      res.status(500).json({ error: 'Erro ao buscar o total do dia' });
    }
  });

  return router;
};
module.exports = router;