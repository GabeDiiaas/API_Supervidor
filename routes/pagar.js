const express = require('express');
const router = express.Router();

module.exports = (sequelize) => {
  router.get('/', async (req, res) => {
    try {
      const [results] = await sequelize.query(`SELECT DRP_VPGT FROM TBRECEBERPA`);
      res.json(results);
    } catch (error) {
      console.error('Erro ao buscar a tabela TBRECEBERPA:', error);
      res.status(500).json({ error: 'Erro ao consultar o campo' });
    }
  });

  return router;
};
module.exports = router;