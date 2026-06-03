const express = require('express');
const createAuthMiddleware = require('../middlewares/authMiddleware');
module.exports = ({ sequelizePontoVenda, sequelizeUltraSyst }) => {
  const router = express.Router();
  const authMiddleware = createAuthMiddleware(
  sequelizePontoVenda,
  sequelizeUltraSyst);
  
  // Função auxiliar para montar WHERE dinâmico
  function buildWhere(params) {
    const conditions = ['U.US_EMAIL = :email']; // email continua obrigatório
    const replacements = { email: params.email };

    if (params.empCodi) {
      conditions.push('C.EMP_CODI = :empCodi');
      replacements.empCodi = params.empCodi;
    }
    if (params.locCodi) {
      conditions.push('C.LOC_CODI = :locCodi');
      replacements.locCodi = params.locCodi;
    }
    if (params.cxaCodi) {
      conditions.push('C.CXA_CODI = :cxaCodi');
      replacements.cxaCodi = params.cxaCodi;
    }
    if (params.venCodi) {
      conditions.push('C.VEN_CODI = :venCodi');
      replacements.venCodi = params.venCodi;
    }
    if (params.tipoVenda) {
      conditions.push('C.TIPO_VENDA = :tipoVenda');
      replacements.tipoVenda = params.tipoVenda;
    }

    return { where: conditions.join(' AND '), replacements };
  }

 const jwt = require('jsonwebtoken');

router.get('/usuario', async (req, res) => {
  const { email, empCodi, locCodi, cxaCodi, venCodi, tipoVenda } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'O parâmetro email é obrigatório' });
  }

  const { where, replacements } = buildWhere({
    email, empCodi, locCodi, cxaCodi, venCodi, tipoVenda
  });

  try {
    let usuario;
    let instancia;
    let db;

    // 🥇 Tenta UltraSyst
    [usuario] = await sequelizeUltraSyst.query(
      `SELECT U.US_CD, U.US_EMAIL, U.US_ACESSO, U.US_NM,
              C.EMP_CODI, C.LOC_CODI, C.CXA_CODI, C.VEN_CODI, C.TIPO_VENDA
       FROM dbo.USUARIO U
       INNER JOIN dbo.TBUSUARIO_CONFIGURACAOAPP C ON U.US_CD = C.US_CD
       WHERE ${where}`,
      { replacements, type: sequelizeUltraSyst.QueryTypes.SELECT }
    );

    if (usuario) {
      instancia = process.env.DB_ULTRASYST_INSTANCIA || 'Banco1';
      db = sequelizeUltraSyst;
    } else {
      // 🥈 Tenta PontoVenda
      [usuario] = await sequelizePontoVenda.query(
        `SELECT U.US_CD, U.US_EMAIL, U.US_ACESSO, U.US_NM,
                C.EMP_CODI, C.LOC_CODI, C.CXA_CODI, C.VEN_CODI, C.TIPO_VENDA
         FROM dbo.USUARIO U
         INNER JOIN dbo.TBUSUARIO_CONFIGURACAOAPP C ON U.US_CD = C.US_CD
         WHERE ${where}`,
        { replacements, type: sequelizePontoVenda.QueryTypes.SELECT }
      );

      if (usuario) {
        instancia = process.env.DB_PONTOVENDA_INSTANCIA || 'Banco1';
        db = sequelizePontoVenda;
      }
    }

    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado com esses filtros' });
    }

    // 🔎 PARAMETR
    const parametros = await db.query(
      `SELECT EMP_CODI, LOC_CODI, CXA_CODI
       FROM dbo.PARAMETR
       WHERE PAR_CLIDIV = '0000000000'
         AND EMP_CODI = :empCodi
         AND LOC_CODI = :locCodi
         AND CXA_CODI = :cxaCodi`,
      {
        replacements: {
          empCodi: usuario.EMP_CODI,
          locCodi: usuario.LOC_CODI,
          cxaCodi: usuario.CXA_CODI
        },
        type: db.QueryTypes.SELECT
      }
    );

    const validacao = parametros.length > 0;

    // 🔎 TBEMPRESAS — isolada para não travar se tabela não existir
    let empresa = null;
    try {
      [empresa] = await db.query(
        `SELECT EMP_CHAVE_APP FROM TBEMPRESAS WHERE EMP_CODI = :empCodi`,
        {
          replacements: { empCodi: usuario.EMP_CODI },
          type: db.QueryTypes.SELECT
        }
      );
    } catch (e) {
      console.warn('⚠️ TBEMPRESAS não encontrada:', e.message);
    }

    // ✅ GERA O TOKEN
    const token = jwt.sign(
      {
        usCd: usuario.US_CD,
        email: usuario.US_EMAIL,
        instancia, // 'CF_MAURO' ou 'CF_PAULO'
        empCodi: usuario.EMP_CODI,
        locCodi: usuario.LOC_CODI,
        cxaCodi: usuario.CXA_CODI,
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      ...usuario,
      validacaoParametr: validacao
        ? 'Códigos válidos para cliente 000000'
        : 'Não corresponde aos parâmetros do cliente 000000',
      instancia,
      empChaveApp: empresa?.EMP_CHAVE_APP || null,
      token // 🔥 app recebe e guarda
    });

  } catch (error) {
    console.error('Erro ao buscar usuário e validar parâmetros:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/usuario_PontoVenda', async (req, res) => {
  const { email, empCodi, locCodi, cxaCodi, venCodi, tipoVenda } = req.query;

  if (!email) {
    return res.status(400).json({ error: 'O parâmetro email é obrigatório' });
  }

  const { where, replacements } = buildWhere({ email, empCodi, locCodi, cxaCodi, venCodi, tipoVenda });

  try {
    // 1. Busca usuário + configuração no PontoVenda
    const [usuario] = await sequelizePontoVenda.query(
      `
      SELECT U.US_CD, U.US_EMAIL, U.US_ACESSO, U.US_NM,
             C.EMP_CODI, C.LOC_CODI, C.CXA_CODI, C.VEN_CODI, C.TIPO_VENDA
      FROM dbo.USUARIO U
      INNER JOIN dbo.TBUSUARIO_CONFIGURACAOAPP C
        ON U.US_CD = C.US_CD
      WHERE ${where}
      `,
      { replacements, type: sequelizePontoVenda.QueryTypes.SELECT }
    );

    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado com esses filtros' });
    }

    // 2. Verificar na tabela PARAMETR para o cliente 000000
    const parametros = await sequelizePontoVenda.query(
      `
      SELECT EMP_CODI, LOC_CODI, CXA_CODI
      FROM dbo.PARAMETR
      WHERE PAR_CLIDIV = '0000000000'
        AND EMP_CODI = :empCodi
        AND LOC_CODI = :locCodi
        AND CXA_CODI = :cxaCodi
      `,
      {
        replacements: {
          empCodi: usuario.EMP_CODI,
          locCodi: usuario.LOC_CODI,
          cxaCodi: usuario.CXA_CODI
        },
        type: sequelizePontoVenda.QueryTypes.SELECT
      }
    );

    // 3. Marcar se bateu ou não
    const validacao = parametros.length > 0;

    res.status(200).json({
      ...usuario,
      validacaoParametr: validacao ? 'Códigos válidos para cliente 000000' : 'Não corresponde aos parâmetros do cliente 000000'
    });
  } catch (error) {
    console.error('Erro ao buscar usuário e validar parâmetros PontoVenda:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});


// acesso horario 
router.get('/acesso_horario_PontoVenda', async (req, res) => {
  const { empCodi, locCodi, cxaCodi } = req.query;

  if (!empCodi || !locCodi || !cxaCodi) {
    return res.status(400).json({
      error: 'empCodi, locCodi e cxaCodi são obrigatórios'
    });
  }

  try {

    // 🔥 pega data de hoje no formato YYYY-MM-DD
    const hojeStr = new Date().toISOString().split('T')[0];

    let resultado = [];
    let instanciaUsada = null;

    // 🥇 PRIMEIRO: PontoVenda
    resultado = await sequelizePontoVenda.query(
      `
      SELECT 
        CONVERT(varchar(10), PAR_DTAB, 23) AS PAR_DTAB,
        PAR_OPRATV
      FROM dbo.PARAMETR
      WHERE EMP_CODI = :empCodi
      AND LOC_CODI = :locCodi
      AND CXA_CODI = :cxaCodi
      `,
      {
        replacements: { empCodi, locCodi, cxaCodi },
        type: sequelizePontoVenda.QueryTypes.SELECT
      }
    );

    if (resultado.length > 0) {
      instanciaUsada = 'PontoVenda';
    } else {
      // 🥈 DEPOIS: UltraSyst
      resultado = await sequelizeUltraSyst.query(
        `
        SELECT 
          CONVERT(varchar(10), PAR_DTAB, 23) AS PAR_DTAB,
          PAR_OPRATV
        FROM dbo.PARAMETR
        WHERE EMP_CODI = :empCodi
        AND LOC_CODI = :locCodi
        AND CXA_CODI = :cxaCodi
        `,
        {
          replacements: { empCodi, locCodi, cxaCodi },
          type: sequelizeUltraSyst.QueryTypes.SELECT
        }
      );

      if (resultado.length > 0) {
        instanciaUsada = 'UltraSyst';
      }
    }

    // ❌ não encontrou em nenhuma base
    if (resultado.length === 0) {
      return res.status(404).json({
        permitido: false,
        motivo: 'Caixa não encontrado em nenhuma base'
      });
    }

    const caixa = resultado[0];
    const dataBanco = caixa.PAR_DTAB; // já vem como string

    // 🔎 valida data (SEM problema de fuso)
    if (dataBanco !== hojeStr) {
      return res.status(403).json({
        permitido: false,
        motivo: 'Caixa fechado - data de abertura diferente',
        instancia: instanciaUsada,
        debug: {
          hoje: hojeStr,
          dataBanco: dataBanco
        }
      });
    }

    // 🔎 valida operador
    const operadorAtivo =
      caixa.PAR_OPRATV !== null &&
      caixa.PAR_OPRATV !== undefined &&
      caixa.PAR_OPRATV.toString().trim() !== '';

    if (!operadorAtivo) {
      return res.status(403).json({
        permitido: false,
        motivo: 'Caixa fechado - operador não informado',
        instancia: instanciaUsada
      });
    }

    // ✅ tudo certo
    return res.status(200).json({
      permitido: true,
      mensagem: 'Caixa aberto. Venda permitida.',
      instancia: instanciaUsada
    });

  } catch (error) {
    console.error('Erro ao validar acesso horário:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

  return router;
};
