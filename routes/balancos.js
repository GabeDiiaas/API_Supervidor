const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { QueryTypes } = require('sequelize');
console.log('🔥 BALANCO.JS CARREGADO');

console.log('🔥 BALANCO.JS CARREGADO');

// ====================== FUNÇÕES AUXILIARES ====================== //
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    const fake = Buffer.alloc(bufA.length);
    try { crypto.timingSafeEqual(bufA, fake); } catch (e) {}
    return false;
  }
  try {
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (e) {
    return false;
  }
}

function descriptografarSenhaUsuario(psSenha) {
  try {
    const pad = (s, len = 20) => (s + ' '.repeat(len)).substring(0, len);
    const senhaPadded = pad(String(psSenha));
    const arr = [];
    for (let i = 0; i < 20; i++) arr.push(String.fromCharCode(senhaPadded.charCodeAt(i) + 3));
    for (let i = 0; i < 20; i++) if (arr[i] === '-') arr[i] = ' ';
    return arr.slice(8, 18).join('').trim();
  } catch (e) {
    console.error('Erro ao descriptografar senha:', e?.message ?? e);
    return null;
  }
}

function decryptStoredPasswordIfNeeded(storedValue) {
  if (!storedValue || typeof storedValue !== 'string') return null;
  if (!storedValue.startsWith('enc:')) return null;
  try {
    const parts = storedValue.split(':');
    if (parts.length !== 3) return null;
    const iv = Buffer.from(parts[1], 'hex');
    const ciphertext = Buffer.from(parts[2], 'base64');
    const key = Buffer.from(process.env.PASS_KEY, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch (err) {
    console.error('Erro ao descriptografar senha armazenada:', err.message);
    return null;
  }
}

// ====================== FACTORY DE ROTAS ====================== //
module.exports = ({ sequelizePontoVenda }) => {
  const router = express.Router();

  // POST: Registro de usuário
  router.post('/register', async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ error: 'Email e senha são obrigatórios.' });

    try {
      const checkEmail = await sequelizePontoVenda.query(
        `SELECT 1 FROM USUARIO WHERE US_EMAIL = :email`,
        { replacements: { email }, type: QueryTypes.SELECT }
      );

      if (checkEmail.length > 0)
        return res.status(409).json({ error: 'Email já cadastrado.' });

      const hashedSenha = await bcrypt.hash(senha, 10);

      await sequelizePontoVenda.query(
        `INSERT INTO USUARIO (US_CD, US_EMAIL, US_ACESSO) VALUES (:codigo, :email, :senha)`,
        { replacements: { codigo: 201, email, senha: hashedSenha }, type: QueryTypes.INSERT }
      );

      res.status(201).json({ message: 'Usuário cadastrado com sucesso.' });
    } catch (err) {
      console.error('Erro no registro:', err);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  });

  // POST: Login
  router.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ error: 'Envie email e senha no corpo da requisição.' });

    try {
      const result = await sequelizePontoVenda.query(
        `SELECT TOP (1) * FROM USUARIO WHERE US_EMAIL = :email`,
        { replacements: { email }, type: QueryTypes.SELECT }
      );

      if (result.length === 0)
        return res.status(401).json({ error: 'Usuário ou senha inválidos.' });

      const user = result[0];
      const stored = user.US_ACESSO ?? '';
      let senhaValida = false;

      if (typeof stored === 'string' && stored.startsWith('$2')) {
        senhaValida = await bcrypt.compare(senha, stored);
      }

      if (!senhaValida) {
        const decrypted = decryptStoredPasswordIfNeeded(stored);
        if (decrypted !== null && safeCompare(decrypted, senha)) senhaValida = true;
      }

      if (!senhaValida) {
        const senhaDescriptografada = descriptografarSenhaUsuario(stored);
        if (senhaDescriptografada !== null && safeCompare(senhaDescriptografada, senha)) senhaValida = true;
      }

      if (!senhaValida && safeCompare(senha, stored)) senhaValida = true;

      if (!senhaValida) return res.status(401).json({ error: 'Usuário ou senha inválidos.' });

      const safeUser = { ...user };
      delete safeUser.US_ACESSO;
      res.json({ message: 'Login realizado com sucesso', user: safeUser });
    } catch (err) {
      console.error('Erro no login:', err);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  });

  // GET: Balanços abertos
  router.get('/balancos-abertos', async (req, res) => {
    try {
      const result = await sequelizePontoVenda.query(
        `SELECT 
          b.ID, b.BAL_CODI, b.EMP_CODI,
          LTRIM(RTRIM(b.LOC_CODI)) AS LOC_CODI,
          l.LOC_NOME, b.BAL_STAT
        FROM TBBALANCO b
        LEFT JOIN TBLOCALIZACAO l ON LTRIM(RTRIM(l.LOC_CODI)) = LTRIM(RTRIM(b.LOC_CODI))
        WHERE b.BAL_STAT = 'A'`,
        { type: QueryTypes.SELECT }
      );

      res.status(200).json({ registros_abertos: result });
    } catch (err) {
      console.error('Erro ao consultar balanços abertos:', err);
      res.status(500).json({ error: 'Erro ao consultar balanços abertos', detalhes: err.message });
    }
  });

  // POST: Inserir item balanço
  router.post('/inserir-itembalanco', async (req, res) => {
    const d = req.body;
    const quan = parseFloat(d.BAL_QUAN) || 0;

    const balCodiInput = (d.BAL_CODI ?? '').toString().trim().padEnd(5, ' ');
    const empCodiInput = (d.EMP_CODI ?? '').toString().trim().padEnd(3, ' ');
    const locCodiInput = (d.LOC_CODI ?? '').toString().trim().padEnd(3, ' ');
    const balNeanInput = (d.BAL_NEAN ?? '').toString().trim().padEnd(15, ' ');
    const proCodiInput = (d.PRO_CODI ?? '').toString().trim().padEnd(10, ' ');
    const tamCodiInput = (d.TAM_CODI ?? '').toString().trim().padEnd(2, ' ');

    let balNseq = d.BAL_NSEQ;

    try {
      // 1. Custos
      const custo = await sequelizePontoVenda.query(
        `SELECT PRO_PRCR, PRO_PRAQ, PRO_PRIC, PRO_PRCU, PRO_PRMD
         FROM TBCUSTOPROD
         WHERE EMP_CODI = :EMP_CODI AND LOC_CODI = :LOC_CODI AND PRO_CODI = :PRO_CODI`,
        { replacements: { EMP_CODI: empCodiInput, LOC_CODI: locCodiInput, PRO_CODI: proCodiInput }, type: QueryTypes.SELECT }
      );

      if (custo.length === 0)
        return res.status(404).json({ error: 'Custos não encontrados.' });

      const C = custo[0];

      // 2. Tipo de venda
      const produto = await sequelizePontoVenda.query(
        `SELECT PRO_VDTP FROM PRODUTO WHERE PRO_CODI = :PRO_CODI`,
        { replacements: { PRO_CODI: proCodiInput }, type: QueryTypes.SELECT }
      );

      const PRO_VDTP = produto.length > 0 ? produto[0].PRO_VDTP : '';
      const balUnembInput = (PRO_VDTP ?? '').toString().trim().padEnd(3, ' ');

      // 3. Preço de venda
      const precoVenda = await sequelizePontoVenda.query(
        `SELECT TAB_PRC1 FROM TBVENDAPRO WHERE PRO_CODI = :PRO_CODI AND LOC_CODI = :LOC_CODI`,
        { replacements: { PRO_CODI: proCodiInput, LOC_CODI: locCodiInput }, type: QueryTypes.SELECT }
      );

      const BAL_PRV1 = precoVenda.length > 0 ? precoVenda[0].TAB_PRC1 : 0;

      // 4. Sequência
      const seqResult = await sequelizePontoVenda.query(
        `SELECT ISNULL(MAX(BAL_NSEQ), 0) AS ultimoSeq FROM TBITEMBALANCO WHERE BAL_CODI = :BAL_CODI`,
        { replacements: { BAL_CODI: balCodiInput }, type: QueryTypes.SELECT }
      );

      if (!balNseq) balNseq = seqResult[0].ultimoSeq + 1;

      // 5. MERGE
      await sequelizePontoVenda.query(
        `MERGE INTO TBITEMBALANCO AS T
         USING (SELECT 
                  :BAL_CODI AS BAL_CODI, :EMP_CODI AS EMP_CODI, :LOC_CODI AS LOC_CODI,
                  :BAL_NEAN AS BAL_NEAN, :PRO_CODI AS PRO_CODI, :TAM_CODI AS TAM_CODI
                ) AS S
         ON (T.BAL_CODI = S.BAL_CODI AND T.EMP_CODI = S.EMP_CODI AND T.LOC_CODI = S.LOC_CODI
             AND T.BAL_NEAN = S.BAL_NEAN AND T.PRO_CODI = S.PRO_CODI AND T.TAM_CODI = S.TAM_CODI)
         WHEN MATCHED THEN
             UPDATE SET 
                 T.BAL_QUAN = T.BAL_QUAN + :BAL_QUAN,
                 T.BAL_UNEMB = :BAL_UNEMB,
                 T.BAL_PRUC = :BAL_PRUC, T.BAL_PRAQ = :BAL_PRAQ,
                 T.BAL_PRIC = :BAL_PRIC, T.BAL_PRCU = :BAL_PRCU,
                 T.BAL_PRMD = :BAL_PRMD, T.BAL_PRV1 = :BAL_PRV1
         WHEN NOT MATCHED THEN
             INSERT (BAL_CODI, EMP_CODI, LOC_CODI, BAL_NSEQ, BAL_NEAN,
                     PRO_CODI, TAM_CODI, BAL_QUAN, BAL_UNEMB,
                     BAL_PRUC, BAL_PRAQ, BAL_PRIC, BAL_PRCU, BAL_PRMD, BAL_PRV1)
             VALUES (:BAL_CODI, :EMP_CODI, :LOC_CODI, :BAL_NSEQ, :BAL_NEAN,
                     :PRO_CODI, :TAM_CODI, :BAL_QUAN, :BAL_UNEMB,
                     :BAL_PRUC, :BAL_PRAQ, :BAL_PRIC, :BAL_PRCU, :BAL_PRMD, :BAL_PRV1);`,
        {
          replacements: {
            BAL_CODI: balCodiInput, EMP_CODI: empCodiInput, LOC_CODI: locCodiInput,
            BAL_NSEQ: balNseq, BAL_NEAN: balNeanInput, PRO_CODI: proCodiInput,
            TAM_CODI: tamCodiInput, BAL_QUAN: quan, BAL_UNEMB: balUnembInput,
            BAL_PRUC: C.PRO_PRCR, BAL_PRAQ: C.PRO_PRAQ, BAL_PRIC: C.PRO_PRIC,
            BAL_PRCU: C.PRO_PRCU, BAL_PRMD: C.PRO_PRMD, BAL_PRV1,
          },
          type: QueryTypes.RAW
        }
      );

      res.json({ message: 'Item inserido/atualizado com sucesso!', bal_nseq_usado: balNseq, preco_venda_usado: BAL_PRV1 });
    } catch (err) {
      console.error('ERRO GRAVE:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET: Listar balanços
  router.get('/listar-balancos', async (req, res) => {
    try {
      const result = await sequelizePontoVenda.query(
        `SELECT DISTINCT BAL_CODI FROM tbItemBalanco ORDER BY BAL_CODI`,
        { type: QueryTypes.SELECT }
      );

      res.status(200).json(result);
    } catch (err) {
      console.error('Erro ao listar códigos de balanço:', err);
      res.status(500).json({ error: 'Erro ao listar códigos de balanço', detalhes: err.message });
    }
  });

  // GET: Produto por EAN
  router.get('/produto/codbarras/:ean', async (req, res) => {
    const { ean } = req.params;
    if (!ean) return res.status(400).json({ error: 'O parâmetro ean é obrigatório.' });

    try {
      const resultProduto = await sequelizePontoVenda.query(
        `SELECT TOP (1) p.PRO_CODI, p.PRO_DESC, p.PRO_SITU
         FROM PRODUTO p
         JOIN TBEANPRODUTO e ON e.PRO_CODI = p.PRO_CODI
         WHERE LTRIM(RTRIM(e.EAP_CODI)) = :ean AND p.PRO_SITU = 'A'`,
        { replacements: { ean }, type: QueryTypes.SELECT }
      );

      if (resultProduto.length === 0)
        return res.status(404).json({ error: 'Produto ativo não encontrado para o código informado.' });

      const produto = resultProduto[0];

      const resultCodigos = await sequelizePontoVenda.query(
        `SELECT EAP_CODI, EAP_NOTA FROM TBEANPRODUTO WHERE PRO_CODI = :proCodi`,
        { replacements: { proCodi: produto.PRO_CODI }, type: QueryTypes.SELECT }
      );

      res.status(200).json({
        produto: {
          PRO_CODI: produto.PRO_CODI,
          PRO_DESC: produto.PRO_DESC,
          PRO_SITU: produto.PRO_SITU,
          CODIGOS_BARRAS: resultCodigos.map(r => ({ EAP_CODI: r.EAP_CODI, EAP_NOTA: r.EAP_NOTA }))
        }
      });
    } catch (err) {
      console.error('Erro ao buscar produto pelo EAP_CODI:', err);
      res.status(500).json({ error: 'Erro ao buscar produto', detalhes: err.message });
    }
  });

  // GET: Produto completo
  router.get('/produto/busca/:codigo', async (req, res) => {
    const { codigo } = req.params;
    const { bal_codi, loc_codi, us_cd } = req.query;

    console.log(`\nBUSCA PRODUTO → Código: ${codigo} | Balanço: ${bal_codi} | LOC: ${loc_codi} | Usuário: ${us_cd || 'N/A'}`);

    if (!codigo) return res.status(400).json({ error: 'Parâmetro código é obrigatório.' });
    if (!bal_codi || !loc_codi) return res.status(400).json({ error: 'Parâmetros bal_codi e loc_codi são obrigatórios.' });

    try {
      let EMP_CODI = null;
      let LOC_CODI_USUARIO = null;

      if (us_cd) {
        const configResult = await sequelizePontoVenda.query(
          `SELECT EMP_CODI, LOC_CODI FROM TBUSUARIO_CONFIGURACAOAPP WHERE US_CD = :us_cd`,
          { replacements: { us_cd }, type: QueryTypes.SELECT }
        );

        if (configResult.length > 0) {
          EMP_CODI = configResult[0].EMP_CODI;
          LOC_CODI_USUARIO = configResult[0].LOC_CODI;
        } else {
          console.warn('⚠️ US_CD fornecido, mas configuração não encontrada.');
        }
      }

      if (!EMP_CODI) {
        const balancoEmpResult = await sequelizePontoVenda.query(
          `SELECT EMP_CODI FROM TBBALANCO WHERE BAL_CODI = :bal_codi`,
          { replacements: { bal_codi }, type: QueryTypes.SELECT }
        );
        if (balancoEmpResult.length > 0) EMP_CODI = balancoEmpResult[0].EMP_CODI;
      }

      if (!EMP_CODI) {
        EMP_CODI = '001';
        console.warn('⚠️ EMP_CODI não encontrado. Usando padrão: 001');
      }

      const produtoResult = await sequelizePontoVenda.query(
        `SELECT DISTINCT
           P.PRO_CODI, P.PRO_DESC, P.PRO_SITU, P.PRO_REFE,
           P.TAM_CODI, P.PRO_FRACAO, P.COR_CODI, P.PRO_VDTP,
           C.COR_DESR AS COR, C.COR_DESC AS COR_DESC
         FROM PRODUTO P
         LEFT JOIN TBEANPRODUTO E ON P.PRO_CODI = E.PRO_CODI
         LEFT JOIN TBCORES C ON C.COR_CODI = P.COR_CODI
         WHERE (P.PRO_CODI = :codigo OR E.EAP_CODI = :codigo) AND P.PRO_SITU = 'A'`,
        { replacements: { codigo }, type: QueryTypes.SELECT }
      );

      if (produtoResult.length === 0)
        return res.status(404).json({ message: 'Produto não encontrado ou inativo.' });

      const produto = produtoResult[0];

      const codigosResult = await sequelizePontoVenda.query(
        `SELECT EAP_CODI, EAP_NOTA FROM TBEANPRODUTO WHERE PRO_CODI = :proCodi`,
        { replacements: { proCodi: produto.PRO_CODI }, type: QueryTypes.SELECT }
      );

      let codigos = codigosResult || [];
      if (!codigos.some(c => c.EAP_CODI === produto.PRO_CODI.padStart(15, '0'))) {
        codigos.unshift({ PRO_CODI: produto.PRO_CODI, EAP_CODI: produto.PRO_CODI.padStart(15, '0'), EAP_NOTA: 'N', isProdPrincipal: true });
      }

      let balMostraEstoque = 'N';
      const balancoResult = await sequelizePontoVenda.query(
        `SELECT BAL_MOSTRA_ESTATU FROM TBBALANCO WHERE BAL_CODI = :bal_codi`,
        { replacements: { bal_codi }, type: QueryTypes.SELECT }
      );

      if (balancoResult.length > 0) {
        balMostraEstoque = balancoResult[0].BAL_MOSTRA_ESTATU?.trim() || 'N';
      }

      let estoqueAtual = null;
      if (balMostraEstoque === 'S') {
        const estoqueResult = await sequelizePontoVenda.query(
          `SELECT EST_QUAN FROM ESTOQUE_LOCAL
           WHERE PRO_CODI = :pro_codi AND EMP_CODI = :emp_codi AND LOC_CODI = :loc_codi AND DEP_CODI = :dep_codi`,
          { replacements: { pro_codi: produto.PRO_CODI, emp_codi: EMP_CODI, loc_codi, dep_codi: '0001' }, type: QueryTypes.SELECT }
        );
        estoqueAtual = estoqueResult.length > 0 ? Number(estoqueResult[0].EST_QUAN) || 0 : 0;
      }

      let quantidadeContada = 0;
      let itemBalancoExiste = false;

      const itemBalancoResult = await sequelizePontoVenda.query(
        `SELECT TOP 1 BAL_QUAN, BAL_NSEQ FROM TBITEMBALANCO
         WHERE BAL_CODI = :bal_codi AND LOC_CODI = :loc_codi AND PRO_CODI = :pro_codi
         ORDER BY BAL_NSEQ DESC`,
        { replacements: { bal_codi, loc_codi, pro_codi: produto.PRO_CODI }, type: QueryTypes.SELECT }
      );

      if (itemBalancoResult.length > 0) {
        quantidadeContada = Number(itemBalancoResult[0].BAL_QUAN) || 0;
        itemBalancoExiste = true;
      }

      const locCodiParaPreco = loc_codi || LOC_CODI_USUARIO || '001';
      const precoResult = await sequelizePontoVenda.query(
        `SELECT TOP 1 TAB_PRC1 FROM TBVENDAPRO
         WHERE EMP_CODI = :emp_codi AND LOC_CODI = :loc_codi AND PRO_CODI = :pro_codi`,
        { replacements: { emp_codi: EMP_CODI, loc_codi: locCodiParaPreco, pro_codi: produto.PRO_CODI }, type: QueryTypes.SELECT }
      );

      const precoVenda = precoResult.length > 0 ? Number(precoResult[0].TAB_PRC1) : null;

      return res.status(200).json({
        produto: {
          ...produto,
          CODIGOS_BARRAS: codigos,
          quantidadeContada,
          jaContadoNesteBalanco: itemBalancoExiste,
          estoqueAtual,
          preco_venda: precoVenda,
          EMP_CODI,
          LOC_CODI: loc_codi,
          usuario: us_cd || null,
          balanco_mostra_estoque: balMostraEstoque
        }
      });

    } catch (error) {
      console.error('Erro crítico na rota de busca de produto:', error);
      return res.status(500).json({ error: 'Erro interno no servidor', detalhes: error.message });
    }
  });

  // GET: Item balanço por PRO_CODI + BAL_CODI
  router.get('/itembalanco/pro/:pro_codi/bal/:bal_codi', async (req, res) => {
    const { pro_codi, bal_codi } = req.params;

    try {
      const resultado = await sequelizePontoVenda.query(
        `SELECT ID, BAL_CODI, EMP_CODI, LOC_CODI, BAL_NSEQ, PRO_CODI, BAL_NEAN, BAL_QUAN
         FROM TBITEMBALANCO
         WHERE PRO_CODI = :PRO_CODI AND BAL_CODI = :BAL_CODI`,
        { replacements: { PRO_CODI: pro_codi, BAL_CODI: bal_codi }, type: QueryTypes.SELECT }
      );

      if (resultado.length === 0)
        return res.status(404).json({ error: 'Nenhum item encontrado com esses filtros.', filtros: { pro_codi, bal_codi } });

      return res.status(200).json({ message: 'Consulta realizada com sucesso.', total_itens: resultado.length, itens: resultado });
    } catch (err) {
      console.error('❌ Erro ao consultar item:', err);
      return res.status(500).json({ error: 'Erro ao consultar item do balanço.', detalhes: err.message });
    }
  });


 router.get('/teste', (req, res) => {
  res.send('API rodando');
});

  return router;
};