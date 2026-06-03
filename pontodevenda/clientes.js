const express = require('express');

module.exports = ({ sequelizePontoVenda, sequelizeUltraSyst }) => {
  const router = express.Router();

// Função auxiliar para formatar CPF ou CNPJ
const formatarDocumento = (valor, tipoPessoa) => {
  if (!valor || typeof valor !== 'string') return 'Não informado';
  const numero = valor.trim();
  
  if (tipoPessoa === 'F' && numero.length >= 11) {
    const cpf = numero.slice(-11);
    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
  } else if (tipoPessoa === 'J' && numero.length >= 14) {
    const cnpj = numero.padStart(14, '0').slice(-14);
    return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
  }
  return numero;
};

// Rota GET: Lista simplificada de clientes (rápida)
// Rota GET: Lista simplificada de clientes (rápida)
router.get('/clientes_Ultrasyst', async (req, res) => {
  const limit = parseInt(req.query.limit) || 15;
  const offset = parseInt(req.query.offset) || 0;

  let search = req.query.search ? req.query.search.trim() : null;

  const tipoBusca = req.query.tipoBusca !== undefined
    ? parseInt(req.query.tipoBusca)
    : null;

  try {
    let whereClause = `
      WHERE CLI_SITU = 'A'
    `;
    const replacements = {};

    // ============================================================
    // 🎯 BUSCA CONTROLADA POR tipoBusca
    // ============================================================
    if (search && tipoBusca !== null) {

      const isNumeric = /^\d+$/.test(search);

      switch (tipoBusca) {

        case 0: // 🔎 NOME
          whereClause += `
            AND (
              UPPER(CLI_NOME) LIKE UPPER(:search)
              OR UPPER(CLI_FANT) LIKE UPPER(:search)
            )
          `;
          replacements.search = `%${search}%`;
          break;

        case 1: // 🧾 CPF / CNPJ
          if (isNumeric) {
            whereClause += ` AND CLI_CPF LIKE :search`;
            replacements.search = `%${search}%`;
          }
          break;

        case 2: // 🔢 CÓDIGO (CORRIGIDO)
          if (isNumeric) {
            whereClause += `
              AND CAST(CLI_CODI AS VARCHAR) LIKE :search
            `;
            replacements.search = `%${parseInt(search)}%`;
          }
          break;
      }
    }

    // ============================================================
    // 🔁 FALLBACK (sem tipoBusca)
    // ============================================================
    else if (search) {

      const isNumeric = /^\d+$/.test(search);

      if (isNumeric) {

        // 🔥 Detecta automaticamente CPF/CNPJ ou código
        if (search.length >= 11) {
          // CPF/CNPJ
          whereClause += ` AND CLI_CPF LIKE :search`;
          replacements.search = `%${search}%`;

        } else {
          // Código
          whereClause += `
            AND CAST(CLI_CODI AS VARCHAR) LIKE :search
          `;
          replacements.search = `%${parseInt(search)}%`;
        }

      } else {
        // Nome
        whereClause += `
          AND (
            UPPER(CLI_NOME) LIKE UPPER(:search)
            OR UPPER(CLI_FANT) LIKE UPPER(:search)
          )
        `;
        replacements.search = `%${search}%`;
      }
    }

    // ============================================================
    // 🔢 COUNT
    // ============================================================
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM CLIENTE
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
        CLI_CODI,
        CLI_NOME,
        CLI_CPF,
        CLI_FANT,
        CLI_TPPESSOA,
        UND_CDNAC,
        CLI_SITC,
        LTRIM(RTRIM(CLI_ENDE)) AS CLI_ENDE
      FROM CLIENTE
      ${whereClause}
      ORDER BY CLI_CODI ASC
      OFFSET :offset ROWS
      FETCH NEXT :limit ROWS ONLY
    `;

    const clientes = await sequelizePontoVenda.query(query, {
      replacements: { ...replacements, offset, limit },
      type: sequelizeUltraSyst.QueryTypes.SELECT
    });

    // ============================================================
    // 📤 FORMATAÇÃO
    // ============================================================
    const clientesFormatados = clientes.map(cliente => ({
      ...cliente,
      CLI_CPF_FORMATADO: formatarDocumento(cliente.CLI_CPF, cliente.CLI_TPPESSOA),
      CLI_ENDE: cliente.CLI_ENDE?.trim(),
      UND_CDNAC: cliente.UND_CDNAC?.trim()
    }));

    res.status(200).json({
      data: clientesFormatados,
      meta: {
        limit,
        offset,
        total_items: parseInt(total, 10)
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar clientes:', error);
    res.status(500).json({
      message: 'Erro ao buscar clientes no banco de dados.'
    });
  }
});

// Rota GET: Detalhes completos de um cliente
router.get('/clientes_Ultrasyst/:id', async (req, res) => {
  const { id } = req.params;

  try {
    console.time('SQL_EXECUTION_DETALHE_CLIENTE');

    const query = `
      WITH TelefonesCliente AS (
        SELECT COD_CLIENTE, TELEFONE,
               ROW_NUMBER() OVER (PARTITION BY COD_CLIENTE ORDER BY TELEFONE) AS rn
        FROM P_CLIENTE_TELEFONE
        WHERE COD_CLIENTE = :id
      )
      SELECT 
        C.CLI_NOME,
        C.CLI_CPF,
        C.CLI_CONT,
        C.CLI_FONT,
        C.CLI_FONC,
        C.CLI_TPPESSOA,
        LTRIM(RTRIM(C.CLI_ENDE)) AS CLI_ENDE,
        LTRIM(RTRIM(C.CEP_CODI)) AS CEP_CODI,
        LTRIM(RTRIM(C.CLI_COMP)) AS CLI_COMP,
        LTRIM(RTRIM(C.CLI_BAIR)) AS CLI_BAIR,
        LTRIM(RTRIM(C.CLI_NUME)) AS CLI_NUME,
        C.CLI_EMAI,
        C.UND_CDNAC,
        C.LOC_CODI,
        C.CLI_CODI,
        C.CLI_FANT,
        C.CLI_SITU,
        C.CLI_LCRE,
        (C.CLI_LCRE - COALESCE(C.CLI_LCREUTZ, 0)) AS SALDO_LIMITE,
        C.SIT_CODI,
        S.SIT_DESC,
        C.ATI_CODI,
        A.TPA_NOME,
        T.TELEFONE,
        T.rn AS TELEFONE_RN
      FROM CLIENTE C
      LEFT JOIN TBSTATUS S ON C.SIT_CODI = S.SIT_CODI
      LEFT JOIN TBTIPO_ATIVIDADE A ON C.ATI_CODI = A.TPA_CODIGO
      LEFT JOIN TelefonesCliente T ON T.COD_CLIENTE = C.CLI_CODI
      WHERE C.CLI_SITU = 'A'
        AND C.CLI_CODI = :id
    `;

    const clientesBrutos = await sequelizeUltraSyst.query(query, {
      replacements: { id },
      type: sequelizeUltraSyst.QueryTypes.SELECT
    });

    console.timeEnd('SQL_EXECUTION_DETALHE_CLIENTE');

    if (clientesBrutos.length === 0) {
      return res.status(404).json({ message: 'Cliente não encontrado' });
    }

    const clienteMap = {
      CLI_CODI: clientesBrutos[0].CLI_CODI,
      CLI_NOME: clientesBrutos[0].CLI_NOME?.trim(),
      CLI_CPF: clientesBrutos[0].CLI_CPF,
      CLI_CPF_FORMATADO: formatarDocumento(clientesBrutos[0].CLI_CPF, clientesBrutos[0].CLI_TPPESSOA),
      CLI_CONT: clientesBrutos[0].CLI_CONT,
      CLI_FONT: clientesBrutos[0].CLI_FONT,
      CLI_FONC: clientesBrutos[0].CLI_FONC,
      CLI_TPPESSOA: clientesBrutos[0].CLI_TPPESSOA,
      CLI_ENDE: clientesBrutos[0].CLI_ENDE?.trim(),
      CEP_CODI: clientesBrutos[0].CEP_CODI?.trim(),
      CLI_COMP: clientesBrutos[0].CLI_COMP?.trim(),
      CLI_BAIR: clientesBrutos[0].CLI_BAIR?.trim(),
      CLI_NUME: clientesBrutos[0].CLI_NUME?.trim(),
      CLI_EMAI: clientesBrutos[0].CLI_EMAI?.trim(),
      UND_CDNAC: clientesBrutos[0].UND_CDNAC,
      LOC_CODI: clientesBrutos[0].LOC_CODI,
      CLI_FANT: clientesBrutos[0].CLI_FANT?.trim(),
      CLI_SITU: clientesBrutos[0].CLI_SITU,
      CLI_LCRE: clientesBrutos[0].CLI_LCRE,
      SALDO_LIMITE: clientesBrutos[0].SALDO_LIMITE,
      SIT_CODI: clientesBrutos[0].SIT_CODI,
      SIT_DESC: clientesBrutos[0].SIT_DESC?.trim(),
      ATI_CODI: clientesBrutos[0].ATI_CODI,
      TPA_NOME: clientesBrutos[0].TPA_NOME?.trim(),
      TELEFONES: []
    };

    // Agrupar telefones
    for (const row of clientesBrutos) {
      if (row.TELEFONE) {
        clienteMap.TELEFONES.push({
          TELEFONE: row.TELEFONE?.trim()
        });
      }
    }

    res.status(200).json(clienteMap);

  } catch (error) {
    console.error('Erro ao buscar detalhes do cliente:', error);
    res.status(500).json({ message: 'Erro ao buscar detalhes do cliente no banco de dados.' });
  }
});

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




  return router;
};