const express = require('express');

module.exports = ({ sequelizePontoVenda, sequelizeUltraSyst }) => {
  const router = express.Router();

// Primeira rota: /localizacao (usa ULTRASYST)
router.get('/localizacao', async (req, res) => {
  const { nome, locCodi } = req.query;

  try {
    let query = `
      SELECT 
        L.LOC_CODI, 
        L.LOC_NOME, 
        L.LOC_ENDE, 
        L.LOC_BAIR,
        UC.US_CD
      FROM 
        dbo.TBLOCALIZACAO L
      LEFT JOIN 
        dbo.TBUSUARIO_CONFIGURACAOAPP UC ON UC.LOC_CODI = L.LOC_CODI
    `;

    const conditions = [];
    const replacements = {};

    if (nome) {
      conditions.push(`L.LOC_NOME = :nome`);
      replacements.nome = nome;
    }

    if (locCodi) {
      conditions.push(`L.LOC_CODI = :locCodi`);
      replacements.locCodi = locCodi;
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    const results = await sequelizeUltraSyst.query(query, {
      replacements,
      type: sequelizeUltraSyst.QueryTypes.SELECT,
    });

    if (results.length === 0) {
      return res.status(404).json({ error: 'Nenhuma localização encontrada' });
    }

    res.status(200).json(results);
  } catch (error) {
    console.error('Erro ao buscar localização:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


 router.get('/localizacao_PontoVenda', async (req, res) => {
  const { 
    nome, 
    loc_codi, 
    us_codi, 
    cxa_codi, 
    vend_codi, 
    emp_codi 
  } = req.query;

  try {

    let baseQuery = `
      SELECT 
        LOC_CODI, 
        LOC_NOME, 
        LOC_ENDE, 
        LOC_FANT
      FROM dbo.TBLOCALIZACAO
    `;

    const conditions = [];
    const replacements = {};

    if (nome) {
      conditions.push(`LOC_NOME = :nome`);
      replacements.nome = nome;
    }

    if (loc_codi) {
      conditions.push(`LOC_CODI = :loc_codi`);
      replacements.loc_codi = loc_codi;
    }

    if (emp_codi) {
      conditions.push(`EMP_CODI = :emp_codi`);
      replacements.emp_codi = emp_codi;
    }

    if (conditions.length > 0) {
      baseQuery += ` WHERE ` + conditions.join(' AND ');
    }

    let results = [];
    let instancia = null;

    // 🥇 tenta UltraSyst
    try {
      results = await sequelizeUltraSyst.query(baseQuery, {
        replacements,
        type: sequelizeUltraSyst.QueryTypes.SELECT,
      });

      if (results.length > 0) {
        instancia = 'UltraSyst';
      }
    } catch (err) {
      console.log('Erro UltraSyst:', err.message);
    }

    // 🥈 se não encontrou, tenta PontoVenda
    if (results.length === 0) {
      try {
        results = await sequelizePontoVenda.query(baseQuery, {
          replacements,
          type: sequelizePontoVenda.QueryTypes.SELECT,
        });

        if (results.length > 0) {
          instancia = 'PontoVenda';
        }
      } catch (err) {
        console.log('Erro PontoVenda:', err.message);
      }
    }

    // ❌ não encontrou em nenhuma
    if (results.length === 0) {
      return res.status(404).json({
        error: 'Nenhuma localização encontrada em nenhuma base'
      });
    }

    res.status(200).json({
      instancia,
      parametrosRecebidos: {
        us_codi,
        cxa_codi,
        loc_codi,
        vend_codi,
        emp_codi
      },
      total: results.length,
      localizacao: results
    });

  } catch (error) {
    console.error('Erro geral:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


  return router;
};