const express = require('express');

module.exports = ({ sequelizePontoVenda, sequelizeUltraSyst }) => {
  const router = express.Router();

  /**
   * GET /limite_cliente
   * Query params: EMP_CODI, loc_codi, CXA_CODI
   * Retorna o campo PAR_VFLIMITE da tabela PARAMETR
   */
  router.get('/limite_cliente', async (req, res) => {
    const { EMP_CODI, loc_codi, CXA_CODI } = req.query;

    // Validação dos parâmetros obrigatórios
    if (!EMP_CODI || !loc_codi || !CXA_CODI) {
      return res.status(400).json({
        error: 'Os parâmetros EMP_CODI, loc_codi e CXA_CODI são obrigatórios'
      });
    }

    const replacements = {
      empCodi: EMP_CODI,
      locCodi: loc_codi,
      cxaCodi: CXA_CODI
    };

    const sql = `
      SELECT PAR_VFLIMITE
      FROM dbo.PARAMETR
      WHERE EMP_CODI = :empCodi
        AND LOC_CODI = :locCodi
        AND CXA_CODI = :cxaCodi
    `;

    try {
      let resultado = [];
      let instanciaUsada = null;

      // 🥇 Tenta UltraSyst primeiro
      resultado = await sequelizeUltraSyst.query(sql, {
        replacements,
        type: sequelizeUltraSyst.QueryTypes.SELECT
      });

      if (resultado.length > 0) {
        instanciaUsada = process.env.DB_ULTRASYST_NAME || 'UltraSyst';
      } else {
        // 🥈 Tenta PontoVenda como fallback
        resultado = await sequelizePontoVenda.query(sql, {
          replacements,
          type: sequelizePontoVenda.QueryTypes.SELECT
        });

        if (resultado.length > 0) {
          instanciaUsada = process.env.DB_PONTOVENDA_NAME || 'PontoVenda';
        }
      }

      // ❌ Não encontrou em nenhuma base
      if (resultado.length === 0) {
        return res.status(404).json({
          error: 'Registro não encontrado para os parâmetros informados'
        });
      }

      const { PAR_VFLIMITE } = resultado[0];

      // ✅ Retorno com o limite e a instância utilizada
      return res.status(200).json({
        EMP_CODI,
        LOC_CODI: loc_codi,
        CXA_CODI,
        PAR_VFLIMITE,
        instancia: instanciaUsada
      });

    } catch (error) {
      console.error('Erro ao buscar limite do cliente:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  return router;
};