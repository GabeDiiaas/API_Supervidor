 const express = require('express');


module.exports = ({ sequelizePontoVenda, sequelizeUltraSyst, sequelizeLocal }) => {
  const router = express.Router();

router.get('/produtos_Ultrasyst', async (req, res) => {
  try {
    // 🔹 Paginação
    const limit = Math.min(parseInt(req.query.limit) || 5, 100);
    const page = parseInt(req.query.page) || 1;
    const offset = req.query.offset
      ? parseInt(req.query.offset)
      : (page - 1) * limit;

    let search = req.query.search ? req.query.search.trim() : null;

    const tipoBusca = req.query.tipoBusca !== undefined
      ? parseInt(req.query.tipoBusca)
      : null;

    // 🔄 Ajuste EAN (13 → 15 dígitos)
    if (search && /^\d{13}$/.test(search)) {
      search = '00' + search;
      console.log('🔄 EAN ajustado:', search);
    }

    // 🔹 Base WHERE
    let whereClause = `WHERE PRO_SITU = 'A'`;
    const replacements = { offset, limit };

    // ============================================================
    // 🔍 BUSCA POR EAN → (só se NÃO for busca por código)
    // ============================================================
    if (tipoBusca !== 1 && search && /^\d+$/.test(search)) {
      const eapResult = await sequelizeUltraSyst.query(
        `SELECT TOP 1 PRO_CODI FROM TBEANPRODUTO WHERE EAP_CODI = :search`,
        {
          replacements: { search },
          type: sequelizeUltraSyst.QueryTypes.SELECT
        }
      );

      if (eapResult.length > 0) {
        req.query.proCodiFromEap = eapResult[0].PRO_CODI;
      }
    }

    // ============================================================
    // 🎯 PRIORIDADE 1 → EAN encontrado
    // ============================================================
    if (req.query.proCodiFromEap) {
      whereClause += ` AND PRO_CODI = :proCodiFromEap`;
      replacements.proCodiFromEap = req.query.proCodiFromEap;
    }

    // ============================================================
    // 🎯 PRIORIDADE 2 → tipoBusca
    // ============================================================
    else if (search && tipoBusca !== null) {
      const isNumeric = /^\d+$/.test(search);

      switch (tipoBusca) {

        case 0: // 🔎 DESCRIÇÃO
          whereClause += ` AND UPPER(PRO_DESC) LIKE UPPER(:search)`;
          replacements.search = `%${search}%`;
          break;

        case 1: // 🔢 CÓDIGO (CORRIGIDO)
          if (isNumeric) {
            whereClause += `
              AND CAST(PRO_CODI AS VARCHAR) LIKE :search
            `;
            replacements.search = `%${parseInt(search)}%`;
          }
          break;

        case 2: // 🏷️ REFERÊNCIA
          whereClause += ` AND UPPER(PRO_REFE) LIKE UPPER(:search)`;
          replacements.search = `%${search}%`;
          break;
      }
    }

    // ============================================================
    // 🔁 FALLBACK
    // ============================================================
    else if (search) {
      whereClause += `
        AND (
          UPPER(PRO_DESC) LIKE UPPER(:search)
          OR UPPER(PRO_REFE) LIKE UPPER(:search)
        )
      `;
      replacements.search = `%${search}%`;
    }

    // ============================================================
    // 🔢 COUNT
    // ============================================================
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM PRODUTO
      ${whereClause}
    `;

    const [{ total }] = await sequelizeUltraSyst.query(countQuery, {
      replacements,
      type: sequelizeUltraSyst.QueryTypes.SELECT
    });

    // ============================================================
    // 📦 QUERY PRINCIPAL
    // ============================================================
    const query = `
      SELECT 
        PRO_CODI, 
        PRO_DESC, 
        PRO_REFE,
        CONVERT(VARCHAR(10), PRO_DTVA, 120) AS PRO_DTVA
      FROM PRODUTO
      ${whereClause}
      ORDER BY PRO_CODI ASC
      OFFSET :offset ROWS
      FETCH NEXT :limit ROWS ONLY
    `;

    const produtos = await sequelizeUltraSyst.query(query, {
      replacements,
      type: sequelizeUltraSyst.QueryTypes.SELECT
    });

    // ============================================================
    // 📤 RESPOSTA
    // ============================================================
    res.status(200).json({
      data: produtos,
      meta: {
        limit,
        offset,
        page,
        total_items: parseInt(total, 10),
        total_pages: Math.ceil(total / limit),
        has_next_page: offset + limit < total
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar produtos:', error);
    res.status(500).json({
      message: 'Erro ao buscar produtos no banco de dados.'
    });
  }
});


// 🔹 ROTA - Detalhes do produto (com peso)
// 🔹 ROTA - Detalhes do produto (com peso)
router.get('/produtos_Ultrasyst/:id', async (req, res) => {
  const { id } = req.params;

  try {
    console.time('SQL_EXECUTION_DETALHE');

    const proCodiQuery = `
      SELECT PRO_CODI 
      FROM TBEANPRODUTO 
      WHERE EAP_CODI = :id
      UNION
      SELECT :id AS PRO_CODI
    `;

    const proCodiResult = await sequelizeUltraSyst.query(proCodiQuery, {
      replacements: { id },
      type: sequelizeUltraSyst.QueryTypes.SELECT
    });

    if (!proCodiResult.length) {
      return res.status(404).json({ message: 'Produto não encontrado para este código.' });
    }

    const proCodi = proCodiResult[0].PRO_CODI;

    const query = `
      WITH FotoUnica AS (
        SELECT MAT_CODI, MFT_FOTO,
               ROW_NUMBER() OVER (PARTITION BY MAT_CODI ORDER BY MAT_CODI) AS rn
        FROM MATERIAL_FOTO
        WHERE MAT_CODI = :proCodi
      )
      SELECT 
        P.PRO_CODI,
        P.PRO_SITU,
        P.PRO_DESC,
        P.PRO_FRACAO,
        P.TAM_CODI,
        ISNULL(T.TAM_DESR, '') AS TAMANHO,
        P.COR_CODI,
        ISNULL(C.COR_DESR, '') AS COR,
        C.COR_DESC AS COR_DESC,
        P.PRO_REFE,

        -- ✅ PREÇO
        ISNULL(P.PRO_VDTP, 0) AS PRO_VDTP,

        -- ✅ PESO
        ISNULL(M.MAT_PESO, 0) AS MAT_PESO,

        MF.MFT_FOTO,
        DPT.DPT_DESC,
        S.SEC_NOME,
        G.GRU_DESC,
        SG.SGR_DESC,
        F.FAM_DESC,
        FO.FOR_NOME

      FROM PRODUTO P
      LEFT JOIN MATERIAL M ON M.MAT_CODI = P.PRO_CODI
      LEFT JOIN TBCORES C ON C.COR_CODI = P.COR_CODI AND C.FOR_CODI = P.FOR_CODI
      LEFT JOIN TBTAMANHOS T ON T.TAM_CODI = P.TAM_CODI
      LEFT JOIN FotoUnica MF ON MF.MAT_CODI = P.PRO_CODI AND MF.rn = 1
      LEFT JOIN TBDEPARTAMENTO DPT ON DPT.DPT_CODI = P.DPT_CODI
      LEFT JOIN SECAO S ON S.SEC_CODI = P.SEC_CODI
      LEFT JOIN TBGRUPO G ON G.GRU_CODI = P.GRU_CODI
      LEFT JOIN TBSUBGRUPO SG ON SG.SGR_CODI = P.SGR_CODI
      LEFT JOIN TBFAMILIA F ON F.FAM_CODI = P.FAM_CODI
      LEFT JOIN FORNECEDOR FO ON FO.FOR_CODI = P.FOR_CODI
      WHERE P.PRO_SITU = 'A'
        AND P.PRO_CODI = :proCodi
    `;

    const eanQuery = `
      SELECT EAP_CODI, EAP_NOTA
      FROM TBEANPRODUTO
      WHERE PRO_CODI = :proCodi
    `;

    const [produtosBrutos, eanList] = await Promise.all([
      sequelizeUltraSyst.query(query, {
        replacements: { proCodi },
        type: sequelizeUltraSyst.QueryTypes.SELECT
      }),
      sequelizeUltraSyst.query(eanQuery, {
        replacements: { proCodi },
        type: sequelizeUltraSyst.QueryTypes.SELECT
      })
    ]);

    console.timeEnd('SQL_EXECUTION_DETALHE');

    if (!produtosBrutos.length) {
      return res.status(404).json({ message: 'Produto não encontrado' });
    }

    const primeiraLinha = produtosBrutos[0];

    const produtoMap = {
      PRO_CODI: primeiraLinha.PRO_CODI,
      PRO_SITU: primeiraLinha.PRO_SITU,
      PRO_DESC: primeiraLinha.PRO_DESC?.trim(),
      PRO_FRACAO: primeiraLinha.PRO_FRACAO,
      TAM_CODI: primeiraLinha.TAM_CODI,
      TAMANHO: primeiraLinha.TAMANHO?.trim(),
      COR_CODI: primeiraLinha.COR_CODI,
      COR: primeiraLinha.COR?.trim(),
      COR_DESC: primeiraLinha.COR_DESC?.trim(),
      PRO_REFE: primeiraLinha.PRO_REFE,

      // ✅ PREÇO
      PRO_VDTP: primeiraLinha.PRO_VDTP,

      // ✅ PESO
      MAT_PESO: primeiraLinha.MAT_PESO,

      MFT_FOTO: primeiraLinha.MFT_FOTO ? Array.from(primeiraLinha.MFT_FOTO) : null,
      DPT_DESC: primeiraLinha.DPT_DESC?.trim(),
      SEC_NOME: primeiraLinha.SEC_NOME?.trim(),
      GRU_DESC: primeiraLinha.GRU_DESC?.trim(),
      SGR_DESC: primeiraLinha.SGR_DESC?.trim(),
      FAM_DESC: primeiraLinha.FAM_DESC?.trim(),
      FOR_NOME: primeiraLinha.FOR_NOME?.trim(),

      EAP_LIST: eanList.map(e => ({
        EAP_CODI: e.EAP_CODI,
        EAP_NOTA: e.EAP_NOTA?.trim() || null
      }))
    };

    res.status(200).json(produtoMap);

  } catch (error) {
    console.error('🔥 ERRO AO BUSCAR PRODUTO:', error);
    res.status(500).json({ 
      message: 'Erro ao buscar detalhes do produto no banco de dados.',
      error: error.message
    });
  }
});

// 🔹 ROTA 2 - Estoques do produto por localização
router.get('/produtos_Ultrasyst/:id/estoques', async (req, res) => {
  const { id } = req.params;

  try {
    console.time('SQL_EXECUTION_ESTOQUES');

    // 🔹 Descobrir PRO_CODI via EAN se necessário
    const proCodiQuery = `
      SELECT PRO_CODI 
      FROM TBEANPRODUTO 
      WHERE EAP_CODI = :id

      UNION

      SELECT :id AS PRO_CODI
    `;

    const proCodiResult = await sequelizeUltraSyst.query(proCodiQuery, {
      replacements: { id },
      type: sequelizeUltraSyst.QueryTypes.SELECT
    });

    if (!proCodiResult.length) {
      return res.status(404).json({
        message: 'Produto não encontrado para este código.'
      });
    }

    const proCodi = proCodiResult[0].PRO_CODI;

    const estoqueQuery = `
      SELECT 
        E.PRO_CODI,
        E.LOC_CODI,
        E.EMP_CODI,
        SUM(E.EST_QUAN) AS EST_QUAN
      FROM ESTOQUE E

      INNER JOIN TBLOCALIZACAO L
        ON L.LOC_CODI = E.LOC_CODI
       AND L.EMP_CODI = E.EMP_CODI

      WHERE E.PRO_CODI = :proCodi
        AND L.LOC_SITU = 'A'

      GROUP BY 
        E.PRO_CODI,
        E.LOC_CODI,
        E.EMP_CODI
    `;

    const estoques = await sequelizeUltraSyst.query(estoqueQuery, {
      replacements: { proCodi },
      type: sequelizeUltraSyst.QueryTypes.SELECT
    });

    console.timeEnd('SQL_EXECUTION_ESTOQUES');

    const resultado = estoques.map(e => ({
      LOC_CODI: e.LOC_CODI?.trim(),
      EMP_CODI: e.EMP_CODI,
      EST_QUAN: e.EST_QUAN
    }));

    res.status(200).json({
      PRO_CODI: proCodi,
      ESTOQUES: resultado
    });

  } catch (error) {
    console.error('Erro ao buscar estoques do produto:', error);

    res.status(500).json({
      message: 'Erro ao buscar estoques do produto no banco de dados.'
    });
  }
});

router.get('/estoque_Ultrasyst_atual/:id', async (req, res) => {
  const { id } = req.params;
  const locCodiParam = req.query.locCodi; // <-- localização vinda da URL

  try {
    console.time('SQL_EXECUTION_ESTOQUE');

    // 🔹 Buscar configuração do usuário
    const configQuery = `SELECT TOP 1 LOC_CODI, EMP_CODI FROM TBUSUARIO_CONFIGURACAOAPP`;
    const config = await sequelizeUltraSyst.query(configQuery, {
      type: sequelizeUltraSyst.QueryTypes.SELECT
    });

    if (!config.length)
      return res.status(404).json({ message: 'Nenhuma configuração de usuário encontrada.' });

    const { LOC_CODI: defaultLocCodi, EMP_CODI: userEmpCodi } = config[0];

    // 🔹 Caso o usuário envie locCodi pela URL, ele substitui o da config
    const finalLocCodi = locCodiParam ?? defaultLocCodi;

    // 🔹 Descobrir o PRO_CODI caso o ID seja EAP_CODI
    const proQuery = `
      SELECT PRO_CODI 
      FROM TBEANPRODUTO 
      WHERE EAP_CODI = :id

      UNION

      SELECT :id AS PRO_CODI
    `;

    const proResult = await sequelizeUltraSyst.query(proQuery, {
      replacements: { id },
      type: sequelizeUltraSyst.QueryTypes.SELECT
    });

    if (!proResult.length)
      return res.status(404).json({ message: 'Produto não encontrado.' });

    const proCodi = proResult[0].PRO_CODI;

    // 🔹 Buscar estoques
    const estoqueQuery = `
      SELECT 
        E.PRO_CODI,
        E.LOC_CODI,
        E.EMP_CODI,
        E.EST_QUAN,
        P.PRO_VDTP AS TAM_CODI_ESTOQUE
      FROM ESTOQUE_LOCAL E
      LEFT JOIN PRODUTO P ON P.PRO_CODI = E.PRO_CODI
      WHERE E.PRO_CODI = :proCodi
      ORDER BY 
        CASE 
          WHEN E.LOC_CODI = :locCodi AND E.EMP_CODI = :empCodi THEN 0
          ELSE 1
        END,
        E.LOC_CODI
    `;

    const rows = await sequelizeUltraSyst.query(estoqueQuery, {
      replacements: { proCodi, locCodi: finalLocCodi, empCodi: userEmpCodi },
      type: sequelizeUltraSyst.QueryTypes.SELECT
    });

    console.timeEnd('SQL_EXECUTION_ESTOQUE');

    if (!rows.length)
      return res.status(404).json({ message: 'Nenhum estoque encontrado.' });

    // 🔹 Retorno organizado
    const retorno = {
      PRO_CODI: proCodi,
      LOC_PRIORITARIA: finalLocCodi, // <-- localização usada
      ESTOQUES: rows.map(e => ({
        LOC_CODI: e.LOC_CODI,
        EMP_CODI: e.EMP_CODI,
        EST_QUAN: e.EST_QUAN,
        TAM_CODI_ESTOQUE: e.TAM_CODI_ESTOQUE
      }))
    };

    res.status(200).json(retorno);

  } catch (error) {
    console.error('Erro ao buscar estoques:', error);
    res.status(500).json({ message: 'Erro ao buscar estoques do produto.' });
  }
});



router.get('/estoque_Ultrasyst/:proCodi', async (req, res) => {
  const { proCodi } = req.params;

  try {
    console.time('SQL_EXECUTION_ESTOQUE');

    const configQuery = `
      SELECT TOP 1 LOC_CODI, EMP_CODI 
      FROM TBUSUARIO_CONFIGURACAOAPP
    `;
    const config = await sequelizeUltraSyst.query(configQuery, {
      type: sequelizeUltraSyst.QueryTypes.SELECT
    });

    if (!config.length)
      return res.status(404).json({ message: 'Nenhuma configuração de usuário encontrada.' });

    const { LOC_CODI: userLocCodi, EMP_CODI: userEmpCodi } = config[0];

    const estoqueQuery = `
      SELECT 
        E.PRO_CODI,
        E.LOC_CODI,
        E.EMP_CODI,
        E.EST_QUAN,
        M.MAT_ESTNEG AS PRO_ESTNEG,
        M.MAT_CTREST AS PRO_CTREST,
        P.PAR_ESTLOJ,
        P.PAR_CHKEST
      FROM ESTOQUE E
      INNER JOIN MATERIAL M ON M.MAT_CODI = E.PRO_CODI
      LEFT JOIN TBPARAM_EMP P ON P.LOC_CODI = E.LOC_CODI
      WHERE E.PRO_CODI = :proCodi
      ORDER BY 
        CASE 
          WHEN E.LOC_CODI = :userLocCodi AND E.EMP_CODI = :userEmpCodi THEN 0 
          ELSE 1 
        END,
        E.LOC_CODI
    `;

    const result = await sequelizeUltraSyst.query(estoqueQuery, {
      replacements: { proCodi, userLocCodi, userEmpCodi },
      type: sequelizeUltraSyst.QueryTypes.SELECT
    });

    console.timeEnd('SQL_EXECUTION_ESTOQUE');

    if (!result.length)
      return res.status(404).json({ message: 'Nenhum estoque encontrado para este produto.' });

    const response = {
      data: result.map(e => ({
        PRO_CODI: e.PRO_CODI,
        LOC_CODI: e.LOC_CODI,
        EMP_CODI: e.EMP_CODI,
        EST_QUAN: e.EST_QUAN,
        PRO_ESTNEG: e.PRO_ESTNEG ?? "N",
        PRO_CTREST: e.PRO_CTREST ?? "S",
        PAR_ESTLOJ: e.PAR_ESTLOJ ?? "S",
        PAR_CHKEST: e.PAR_CHKEST ?? "S",
      }))
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ Erro ao buscar estoque detalhado:', error);
    res.status(500).json({ message: 'Erro ao buscar estoque detalhado no banco de dados.' });
  }
});

// rota de baixa no estoque




  // Rota GET para buscar todos os clientes do banco PontoVenda
  router.get('/clientes_PontoVenda', async (req, res) => {
    try {
      const query = `
        SELECT 
          C.CLI_NOME,
          C.CLI_CPF,
          C.CLI_TPPESSOA, -- Adicionado para determinar o tipo (Física ou Jurídica)
          C.CLI_ENDE,
          C.CLI_EMAI,
          C.UND_CDNAC,
          C.LOC_CODI,
          C.CLI_FANT,
          C.CLI_SITU,
          C.CLI_LCRE,
          (C.CLI_LCRE - COALESCE(C.CLI_LCREUTZ, 0)) AS SALDO_LIMITE, -- Usando COALESCE para evitar erro com NULL
          C.SIT_CODI,
          S.SIT_DESC,
          C.ATI_CODI,
          A.TPA_NOME
        FROM CLIENTE C
        LEFT JOIN TBSTATUS S ON C.SIT_CODI = S.SIT_CODI
        LEFT JOIN TBTIPO_ATIVIDADE A ON C.ATI_CODI = A.TPA_CODIGO
      `;

      const clientes = await sequelizeUltraSyst.query(query, {
        type: sequelizeUltraSyst.QueryTypes.SELECT
      });

      // Formatar o CLI_CPF para cada cliente
      const clientesFormatados = clientes.map(cliente => ({
        ...cliente,
        CLI_CPF_FORMATADO: formatarDocumento(cliente.CLI_CPF, cliente.CLI_TPPESSOA)
      }));

      res.status(200).json(clientesFormatados);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      res.status(500).json({ message: 'Erro ao buscar clientes no banco de dados.' });
    }
  });


  //rota teste local produtos:

  router.get('/produtos-local', async (req, res) => {
  try {
    console.time('SQL_PRODUTOS_LOCAL');

    const [result] = await sequelizeLocal.query(`
      SELECT *
      FROM PRODUTOS
    `);

    console.timeEnd('SQL_PRODUTOS_LOCAL');

    res.json(result);

  } catch (error) {
    console.error('Erro ao buscar produtos (LOCAL):', error.message);

    res.status(500).json({
      erro: 'Erro ao buscar produtos LOCAL',
      detalhe: error.message
    });
  }
});






  return router;
};