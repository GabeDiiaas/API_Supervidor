const express = require('express');

module.exports = ({ sequelizeUltraSyst }) => {
  const router = express.Router();

  // -------------------------------
  // Rota: retornar tipos de preço
  // -------------------------------
router.get('/precos_tipos', async (req, res) => {
    const { venCodi } = req.query;

    if (!venCodi) {
        return res.status(400).json({ error: 'venCodi é obrigatório' });
    }

    try {
        // 1️⃣ Busca permissões do vendedor (VEN_TABP1 a VEN_TABP4)
        const vendedorResult = await sequelizeUltraSyst.query(
            `
            SELECT 
                LTRIM(RTRIM(VEN_TABP1)) AS VEN_TABP1,
                LTRIM(RTRIM(VEN_TABP2)) AS VEN_TABP2,
                LTRIM(RTRIM(VEN_TABP3)) AS VEN_TABP3,
                LTRIM(RTRIM(VEN_TABP4)) AS VEN_TABP4
            FROM VENDEDOR
            WHERE LTRIM(RTRIM(VEN_CODI)) = LTRIM(RTRIM(:venCodi))
            `,
            {
                replacements: { venCodi },
                type: sequelizeUltraSyst.QueryTypes.SELECT
            }
        );

        if (!vendedorResult || vendedorResult.length === 0) {
            return res.status(404).json({ error: 'Vendedor não encontrado' });
        }

        const v = vendedorResult[0];

        // 2️⃣ Busca os nomes das tabelas no PARAMETR
        const paramResult = await sequelizeUltraSyst.query(
            `
            SELECT 
                LTRIM(RTRIM(p.PAR_DSPR1)) AS PAR_DSPR1,
                LTRIM(RTRIM(p.PAR_DSPR2)) AS PAR_DSPR2,
                LTRIM(RTRIM(p.PAR_DSPR3)) AS PAR_DSPR3,
                LTRIM(RTRIM(p.PAR_DSPR4)) AS PAR_DSPR4
            FROM PARAMETR p
            INNER JOIN TBUSUARIO_CONFIGURACAOAPP u
                ON LTRIM(RTRIM(u.LOC_CODI)) = LTRIM(RTRIM(p.LOC_CODI))
               AND LTRIM(RTRIM(u.CXA_CODI)) = LTRIM(RTRIM(p.CXA_CODI))
            WHERE LTRIM(RTRIM(u.VEN_CODI)) = LTRIM(RTRIM(:venCodi))
            `,
            {
                replacements: { venCodi },
                type: sequelizeUltraSyst.QueryTypes.SELECT
            }
        );

        if (!paramResult || paramResult.length === 0) {
            return res.status(404).json({ error: 'Configuração de parâmetros não encontrada' });
        }

        const p = paramResult[0];

        // 3️⃣ Monta o mapeamento completo (Tabela 1, 2, 3, 4)
        const tabelas = [];

        // Tabela 1
        if (v.VEN_TABP1 === 'S' && p.PAR_DSPR1) {
            tabelas.push({
                numero: 1,
                nome: p.PAR_DSPR1.trim(),
                permitido: true
            });
        }

        // Tabela 2
        if (v.VEN_TABP2 === 'S' && p.PAR_DSPR2) {
            tabelas.push({
                numero: 2,
                nome: p.PAR_DSPR2.trim(),
                permitido: true
            });
        }

        // Tabela 3
        if (v.VEN_TABP3 === 'S' && p.PAR_DSPR3) {
            tabelas.push({
                numero: 3,
                nome: p.PAR_DSPR3.trim(),
                permitido: true
            });
        }

        // Tabela 4
        if (v.VEN_TABP4 === 'S' && p.PAR_DSPR4) {
            tabelas.push({
                numero: 4,
                nome: p.PAR_DSPR4.trim(),
                permitido: true
            });
        }

        if (tabelas.length === 0) {
            return res.status(404).json({ error: 'Vendedor não possui acesso a nenhuma tabela de preço' });
        }

        // Retorno rico e claro para o app
        res.json({
            sucesso: true,
            tabelas: tabelas,                    // ← Array com número + nome
            quantidadeTabelas: tabelas.length,
            mensagem: `Vendedor possui acesso a ${tabelas.length} tabela(s) de preço`
        });

    } catch (error) {
        console.error('Erro ao buscar tipos de preço:', error);
        res.status(500).json({ 
            sucesso: false,
            error: 'Erro interno ao consultar tabelas de preço',
            detalhes: error.message 
        });
    }
});
  // -------------------------------
 // Rotas separadas para cada tipo de preço

const colunasPreco = ['TAB_PRC1', 'TAB_PRC2', 'TAB_PRC3', 'TAB_PRC4'];
const colunasTipo = ['PAR_DSPR1', 'PAR_DSPR2', 'PAR_DSPR3', 'PAR_DSPR4'];

for (let i = 0; i < 4; i++) {
  const index = i;

  // Rota sem matCodi no path
  router.get(`/precos/${index + 1}`, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;
      const matCodiFilter = req.query.matCodi?.trim();
      const venCodi = req.query.venCodi?.trim() || null;

      if (venCodi) {
        const resultados = await sequelizeUltraSyst.query(
          `SELECT 
            LTRIM(RTRIM(VEN_TABP1)) AS VEN_TABP1,
            LTRIM(RTRIM(VEN_TABP2)) AS VEN_TABP2,
            LTRIM(RTRIM(VEN_TABP3)) AS VEN_TABP3,
            LTRIM(RTRIM(VEN_TABP4)) AS VEN_TABP4
          FROM VENDEDOR
          WHERE LTRIM(RTRIM(VEN_CODI)) = :venCodi`,
          { replacements: { venCodi }, type: sequelizeUltraSyst.QueryTypes.SELECT }
        );

        const vendedor = resultados[0];

        if (!vendedor) {
          return res.status(404).json({ error: 'Vendedor não encontrado', venCodiInformado: venCodi });
        }

        const permissoes = [
          vendedor.VEN_TABP1 || 'N',
          vendedor.VEN_TABP2 || 'N',
          vendedor.VEN_TABP3 || 'N',
          vendedor.VEN_TABP4 || 'N'
        ];

        const permissaoAtual = permissoes[index];
        const tabelasLiberadas = permissoes.map((flag, i) => flag === 'S' ? i + 1 : null).filter(Boolean);

        if (permissaoAtual !== 'S') {
          return res.status(403).json({
            error: `Acesso negado: vendedor não tem permissão para a tabela de preço ${index + 1}`,
            tabelaSolicitada: index + 1,
            tabelasLiberadas: tabelasLiberadas.length > 0 ? tabelasLiberadas : 'nenhuma',
            venCodi,
            mensagem: 'Entre em contato com o administrador para liberar o acesso a esta tabela.'
          });
        }
      } else {
        console.warn(`[PERMISSÃO NÃO VERIFICADA] Acesso a /precos/${index + 1} sem venCodi informado`);
      }

      const registros = await sequelizeUltraSyst.query(
        `SELECT 
          p.PAR_PRECOQT,
          LTRIM(RTRIM(p.PAR_DSPR1)) AS PAR_DSPR1,
          LTRIM(RTRIM(p.PAR_DSPR2)) AS PAR_DSPR2,
          LTRIM(RTRIM(p.PAR_DSPR3)) AS PAR_DSPR3,
          LTRIM(RTRIM(p.PAR_DSPR4)) AS PAR_DSPR4,
          u.LOC_CODI,
          u.CXA_CODI
        FROM PARAMETR p
        INNER JOIN TBUSUARIO_CONFIGURACAOAPP u
          ON LTRIM(RTRIM(u.LOC_CODI)) = LTRIM(RTRIM(p.LOC_CODI))
         AND LTRIM(RTRIM(u.CXA_CODI)) = LTRIM(RTRIM(p.CXA_CODI))`,
        { type: sequelizeUltraSyst.QueryTypes.SELECT }
      );

      const registro = registros[0];
      if (!registro) return res.status(404).json({ error: 'Nenhum tipo de preço encontrado' });

      const tipo = registro[colunasTipo[index]];
      const parPrecoQt = (registro.PAR_PRECOQT || '').trim();
      const camposExtras = parPrecoQt === 'S' ? `, v.TAB_QTD1, v.TAB_QTD2, v.TAB_QTD3, v.TAB_QTD4` : '';

      let sql = `
        SELECT 
          m.MAT_CODI,
          v.${colunasPreco[index]} AS VALOR,
          v.LOC_CODI,
          u.CXA_CODI
          ${camposExtras}
        FROM TBVENDAMAT v
        INNER JOIN MATERIAL m ON m.MAT_CODI = v.MAT_CODI
        INNER JOIN TBUSUARIO_CONFIGURACAOAPP u 
          ON LTRIM(RTRIM(u.LOC_CODI)) = LTRIM(RTRIM(v.LOC_CODI))
        INNER JOIN PARAMETR p
          ON LTRIM(RTRIM(u.LOC_CODI)) = LTRIM(RTRIM(p.LOC_CODI))
         AND LTRIM(RTRIM(u.CXA_CODI)) = LTRIM(RTRIM(p.CXA_CODI))
        WHERE m.MAT_SITU = 'A'
      `;

      const replacements = { limit, offset };

      if (matCodiFilter) {
        sql += ` AND LTRIM(RTRIM(m.MAT_CODI)) LIKE :matCodi `;
        replacements.matCodi = `%${matCodiFilter}%`;
      }

      sql += ` ORDER BY m.MAT_CODI OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;

      const precosRows = await sequelizeUltraSyst.query(sql, {
        replacements,
        type: sequelizeUltraSyst.QueryTypes.SELECT,
      });

      const resultado = precosRows.map((r) => {
        const base = { matCodi: r.MAT_CODI, locCodi: r.LOC_CODI, cxaCodi: r.CXA_CODI, tipo, valor: r.VALOR };
        if (parPrecoQt === 'S') {
          base.tabQtd1 = r.TAB_QTD1;
          base.tabQtd2 = r.TAB_QTD2;
          base.tabQtd3 = r.TAB_QTD3;
          base.tabQtd4 = r.TAB_QTD4;
        }
        return base;
      });

      const totalResultados = await sequelizeUltraSyst.query(
        `SELECT COUNT(*) AS total FROM TBVENDAMAT v INNER JOIN MATERIAL m ON m.MAT_CODI = v.MAT_CODI WHERE m.MAT_SITU = 'A'`,
        { type: sequelizeUltraSyst.QueryTypes.SELECT }
      );

      res.json({
        data: resultado,
        total: totalResultados[0].total,
        limit,
        offset,
        tabela: index + 1,
        verificacaoPermissao: venCodi ? 'realizada' : 'não realizada (venCodi não informado)'
      });

    } catch (error) {
      console.error('Erro ao buscar preços:', error);
      res.status(500).json({ error: 'Erro ao consultar os preços' });
    }
  });
// tela produtos e detalhes
  // Rota COM matCodi no path — mesma lógica
  router.get(`/precos/${index + 1}/:matCodi`, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;
      const matCodiFilter = req.params.matCodi?.trim();  // ← vem do path
      const venCodi = req.query.venCodi?.trim() || null;

      if (venCodi) {
        const resultados = await sequelizeUltraSyst.query(
          `SELECT 
            LTRIM(RTRIM(VEN_TABP1)) AS VEN_TABP1,
            LTRIM(RTRIM(VEN_TABP2)) AS VEN_TABP2,
            LTRIM(RTRIM(VEN_TABP3)) AS VEN_TABP3,
            LTRIM(RTRIM(VEN_TABP4)) AS VEN_TABP4
          FROM VENDEDOR
          WHERE LTRIM(RTRIM(VEN_CODI)) = :venCodi`,
          { replacements: { venCodi }, type: sequelizeUltraSyst.QueryTypes.SELECT }
        );

        const vendedor = resultados[0];

        if (!vendedor) {
          return res.status(404).json({ error: 'Vendedor não encontrado', venCodiInformado: venCodi });
        }

        const permissoes = [
          vendedor.VEN_TABP1 || 'N',
          vendedor.VEN_TABP2 || 'N',
          vendedor.VEN_TABP3 || 'N',
          vendedor.VEN_TABP4 || 'N'
        ];

        const permissaoAtual = permissoes[index];
        const tabelasLiberadas = permissoes.map((flag, i) => flag === 'S' ? i + 1 : null).filter(Boolean);

        if (permissaoAtual !== 'S') {
          return res.status(403).json({
            error: `Acesso negado: vendedor não tem permissão para a tabela de preço ${index + 1}`,
            tabelaSolicitada: index + 1,
            tabelasLiberadas: tabelasLiberadas.length > 0 ? tabelasLiberadas : 'nenhuma',
            venCodi,
            mensagem: 'Entre em contato com o administrador para liberar o acesso a esta tabela.'
          });
        }
      } else {
        console.warn(`[PERMISSÃO NÃO VERIFICADA] Acesso a /precos/${index + 1}/${matCodiFilter} sem venCodi informado`);
      }

      const registros = await sequelizeUltraSyst.query(
        `SELECT 
          p.PAR_PRECOQT,
          LTRIM(RTRIM(p.PAR_DSPR1)) AS PAR_DSPR1,
          LTRIM(RTRIM(p.PAR_DSPR2)) AS PAR_DSPR2,
          LTRIM(RTRIM(p.PAR_DSPR3)) AS PAR_DSPR3,
          LTRIM(RTRIM(p.PAR_DSPR4)) AS PAR_DSPR4,
          u.LOC_CODI,
          u.CXA_CODI
        FROM PARAMETR p
        INNER JOIN TBUSUARIO_CONFIGURACAOAPP u
          ON LTRIM(RTRIM(u.LOC_CODI)) = LTRIM(RTRIM(p.LOC_CODI))
         AND LTRIM(RTRIM(u.CXA_CODI)) = LTRIM(RTRIM(p.CXA_CODI))`,
        { type: sequelizeUltraSyst.QueryTypes.SELECT }
      );

      const registro = registros[0];
      if (!registro) return res.status(404).json({ error: 'Nenhum tipo de preço encontrado' });

      const tipo = registro[colunasTipo[index]];
      const parPrecoQt = (registro.PAR_PRECOQT || '').trim();
      const camposExtras = parPrecoQt === 'S' ? `, v.TAB_QTD1, v.TAB_QTD2, v.TAB_QTD3, v.TAB_QTD4` : '';

      let sql = `
        SELECT 
          m.MAT_CODI,
          v.${colunasPreco[index]} AS VALOR,
          v.LOC_CODI,
          u.CXA_CODI
          ${camposExtras}
        FROM TBVENDAMAT v
        INNER JOIN MATERIAL m ON m.MAT_CODI = v.MAT_CODI
        INNER JOIN TBUSUARIO_CONFIGURACAOAPP u 
          ON LTRIM(RTRIM(u.LOC_CODI)) = LTRIM(RTRIM(v.LOC_CODI))
        INNER JOIN PARAMETR p
          ON LTRIM(RTRIM(u.LOC_CODI)) = LTRIM(RTRIM(p.LOC_CODI))
         AND LTRIM(RTRIM(u.CXA_CODI)) = LTRIM(RTRIM(p.CXA_CODI))
        WHERE m.MAT_SITU = 'A'
        AND LTRIM(RTRIM(m.MAT_CODI)) LIKE :matCodi
        ORDER BY m.MAT_CODI
        OFFSET :offset ROWS
        FETCH NEXT :limit ROWS ONLY
      `;

      const precosRows = await sequelizeUltraSyst.query(sql, {
        replacements: { matCodi: `%${matCodiFilter}%`, limit, offset },
        type: sequelizeUltraSyst.QueryTypes.SELECT,
      });

      const resultado = precosRows.map((r) => {
        const base = { matCodi: r.MAT_CODI, locCodi: r.LOC_CODI, cxaCodi: r.CXA_CODI, tipo, valor: r.VALOR };
        if (parPrecoQt === 'S') {
          base.tabQtd1 = r.TAB_QTD1;
          base.tabQtd2 = r.TAB_QTD2;
          base.tabQtd3 = r.TAB_QTD3;
          base.tabQtd4 = r.TAB_QTD4;
        }
        return base;
      });

      res.json({
        data: resultado,
        total: resultado.length,
        limit,
        offset,
        tabela: index + 1,
        verificacaoPermissao: venCodi ? 'realizada' : 'não realizada (venCodi não informado)'
      });

    } catch (error) {
      console.error('Erro ao buscar preços:', error);
      res.status(500).json({ error: 'Erro ao consultar os preços' });
    }
  });

  // 🔹 ROTA 2: Buscar preço individual
  router.get(`/precos/${index + 1}/:matCodi`, async (req, res) => {
    try {
      const matCodi = req.params.matCodi?.trim();
      if (!matCodi) return res.status(400).json({ error: 'Código do produto é obrigatório' });

      const [registro] = await sequelizeUltraSyst.query(
        `
        SELECT 
          p.PAR_PRECOQT,
          LTRIM(RTRIM(p.PAR_DSPR1)) AS PAR_DSPR1,
          LTRIM(RTRIM(p.PAR_DSPR2)) AS PAR_DSPR2,
          LTRIM(RTRIM(p.PAR_DSPR3)) AS PAR_DSPR3,
          LTRIM(RTRIM(p.PAR_DSPR4)) AS PAR_DSPR4,
          u.LOC_CODI,
          u.CXA_CODI
        FROM PARAMETR p
        INNER JOIN TBUSUARIO_CONFIGURACAOAPP u
          ON LTRIM(RTRIM(u.LOC_CODI)) = LTRIM(RTRIM(p.LOC_CODI))
         AND LTRIM(RTRIM(u.CXA_CODI)) = LTRIM(RTRIM(p.CXA_CODI))
        `,
        { type: sequelizeUltraSyst.QueryTypes.SELECT }
      );

      if (!registro) return res.status(404).json({ error: 'Configuração não encontrada' });

      const tipo = registro[colunasTipo[index]];
      const parPrecoQt = (registro.PAR_PRECOQT || '').trim();

      let camposExtras = '';
      if (parPrecoQt === 'S') {
        camposExtras = `,
          v.TAB_QTD1, v.TAB_QTD2, v.TAB_QTD3, v.TAB_QTD4
        `;
      }

      const sql = `
        SELECT 
          m.MAT_CODI,
          v.${colunasPreco[index]} AS VALOR,
          v.LOC_CODI,
          u.CXA_CODI
          ${camposExtras}
        FROM TBVENDAMAT v
        INNER JOIN MATERIAL m ON m.MAT_CODI = v.MAT_CODI
        INNER JOIN TBUSUARIO_CONFIGURACAOAPP u 
          ON LTRIM(RTRIM(u.LOC_CODI)) = LTRIM(RTRIM(v.LOC_CODI))
        INNER JOIN PARAMETR p
          ON LTRIM(RTRIM(u.LOC_CODI)) = LTRIM(RTRIM(p.LOC_CODI))
         AND LTRIM(RTRIM(u.CXA_CODI)) = LTRIM(RTRIM(p.CXA_CODI))
        WHERE m.MAT_SITU = 'A'
          AND LTRIM(RTRIM(m.MAT_CODI)) = :matCodi
      `;

      const [row] = await sequelizeUltraSyst.query(sql, {
        replacements: { matCodi },
        type: sequelizeUltraSyst.QueryTypes.SELECT,
      });

      if (!row) return res.status(404).json({ error: 'Produto não encontrado' });

      const preco = {
        matCodi: row.MAT_CODI,
        locCodi: row.LOC_CODI,
        cxaCodi: row.CXA_CODI,
        tipo,
        valor: row.VALOR,
      };

      if (parPrecoQt === 'S') {
        preco.tabQtd1 = row.TAB_QTD1;
        preco.tabQtd2 = row.TAB_QTD2;
        preco.tabQtd3 = row.TAB_QTD3;
        preco.tabQtd4 = row.TAB_QTD4;
      }

      res.json(preco);
    } catch (error) {
      console.error('Erro ao buscar preço individual:', error);
      res.status(500).json({ error: 'Erro ao consultar o preço do produto' });
    }
  });
}

// tela de produtos
router.get('/precoAcessivel', async (req, res) => {
  const { venCodi, limit = 100, offset = 0, matCodi } = req.query;

  if (!venCodi) {
    return res.status(400).json({ error: 'venCodi é obrigatório' });
  }

  try {
    // 1. Busca permissões do vendedor
    const [vendedor] = await sequelizeUltraSyst.query(
      `SELECT 
        LTRIM(RTRIM(VEN_TABP1)) AS VEN_TABP1,
        LTRIM(RTRIM(VEN_TABP2)) AS VEN_TABP2,
        LTRIM(RTRIM(VEN_TABP3)) AS VEN_TABP3,
        LTRIM(RTRIM(VEN_TABP4)) AS VEN_TABP4
      FROM VENDEDOR
      WHERE LTRIM(RTRIM(VEN_CODI)) = :venCodi`,
      { replacements: { venCodi }, type: sequelizeUltraSyst.QueryTypes.SELECT }
    );

    if (!vendedor) {
      return res.status(404).json({ error: 'Vendedor não encontrado' });
    }

    // 2. Descobre a primeira tabela liberada
    const permissoes = [vendedor.VEN_TABP1, vendedor.VEN_TABP2, vendedor.VEN_TABP3, vendedor.VEN_TABP4];
    const colunasPreco = ['TAB_PRC1', 'TAB_PRC2', 'TAB_PRC3', 'TAB_PRC4'];
    const colunasTipo  = ['PAR_DSPR1', 'PAR_DSPR2', 'PAR_DSPR3', 'PAR_DSPR4'];

    const primeiroIndex = permissoes.findIndex(p => p === 'S');

    if (primeiroIndex === -1) {
      return res.status(403).json({ error: 'Vendedor sem acesso a nenhuma tabela de preço' });
    }

    // 3. Busca o nome da tabela no PARAMETR
    const [param] = await sequelizeUltraSyst.query(
      `SELECT 
        LTRIM(RTRIM(p.${colunasTipo[primeiroIndex]})) AS NOME_TABELA,
        LTRIM(RTRIM(p.PAR_PRECOQT)) AS PAR_PRECOQT
      FROM PARAMETR p
      INNER JOIN TBUSUARIO_CONFIGURACAOAPP u
        ON LTRIM(RTRIM(u.LOC_CODI)) = LTRIM(RTRIM(p.LOC_CODI))
       AND LTRIM(RTRIM(u.CXA_CODI)) = LTRIM(RTRIM(p.CXA_CODI))
      WHERE LTRIM(RTRIM(u.VEN_CODI)) = :venCodi`,
      { replacements: { venCodi }, type: sequelizeUltraSyst.QueryTypes.SELECT }
    );

    const parPrecoQt = (param?.PAR_PRECOQT || '').trim();
    const camposExtras = parPrecoQt === 'S'
      ? `, v.TAB_QTD1, v.TAB_QTD2, v.TAB_QTD3, v.TAB_QTD4`
      : '';

    // 4. Busca os preços da tabela correta
    let sql = `
      SELECT 
        m.MAT_CODI,
        v.${colunasPreco[primeiroIndex]} AS VALOR,
        v.LOC_CODI,
        u.CXA_CODI
        ${camposExtras}
      FROM TBVENDAMAT v
      INNER JOIN MATERIAL m ON m.MAT_CODI = v.MAT_CODI
      INNER JOIN TBUSUARIO_CONFIGURACAOAPP u
        ON LTRIM(RTRIM(u.LOC_CODI)) = LTRIM(RTRIM(v.LOC_CODI))
      INNER JOIN PARAMETR p
        ON LTRIM(RTRIM(u.LOC_CODI)) = LTRIM(RTRIM(p.LOC_CODI))
       AND LTRIM(RTRIM(u.CXA_CODI)) = LTRIM(RTRIM(p.CXA_CODI))
      WHERE m.MAT_SITU = 'A'
    `;

    const replacements = { 
      limit: parseInt(limit), 
      offset: parseInt(offset) 
    };

    if (matCodi) {
      sql += ` AND LTRIM(RTRIM(m.MAT_CODI)) LIKE :matCodi`;
      replacements.matCodi = `%${matCodi.trim()}%`;
    }

    sql += ` ORDER BY m.MAT_CODI OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;

    const precos = await sequelizeUltraSyst.query(sql, {
      replacements,
      type: sequelizeUltraSyst.QueryTypes.SELECT
    });

    const data = precos.map(r => {
      const item = {
        matCodi: r.MAT_CODI,
        locCodi: r.LOC_CODI,
        cxaCodi: r.CXA_CODI,
        tipo: param?.NOME_TABELA || null,
        tabelaNumero: primeiroIndex + 1,
        valor: r.VALOR
      };
      if (parPrecoQt === 'S') {
        item.tabQtd1 = r.TAB_QTD1;
        item.tabQtd2 = r.TAB_QTD2;
        item.tabQtd3 = r.TAB_QTD3;
        item.tabQtd4 = r.TAB_QTD4;
      }
      return item;
    });

    res.json({
      data,
      total: data.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
      tabelaNumero: primeiroIndex + 1,
      tabelaNome: param?.NOME_TABELA || null
    });

  } catch (error) {
    console.error('Erro ao buscar preços acessíveis:', error);
    res.status(500).json({ error: 'Erro interno ao buscar preços' });
  }
});


/// regra de Habiliacao

// rota para buscar apenas o PAR_PRV2 relacionado via LOC_CODI e CXA_CODI
router.get('/parametr/par_prv2', async (req, res) => {
  try {
    const registros = await sequelizeUltraSyst.query(
      `
      SELECT LTRIM(RTRIM(p.PAR_PRV2)) AS PAR_PRV2
      FROM PARAMETR p
      INNER JOIN TBUSUARIO_CONFIGURACAOAPP u
        ON u.LOC_CODI = p.LOC_CODI
       AND u.CXA_CODI = p.CXA_CODI
      `,
      { type: sequelizeUltraSyst.QueryTypes.SELECT }
    );

    if (!registros || registros.length === 0) {
      return res.status(404).json({ error: 'Nenhum registro encontrado em PARAMETR' });
    }

    res.json({ parPrv2: registros });

  } catch (error) {
    console.error('Erro ao buscar PAR_PRV2:', error);
    res.status(500).json({ error: 'Erro ao consultar PAR_PRV2' });
  }
});

// -------------------------------
// Rota: retornar PAR_PRECOQT regra preco por quantidade
// -------------------------------
router.get('/parametr/par_precoqt', async (req, res) => {
  try {
    const registros = await sequelizeUltraSyst.query(
      `
      SELECT 
        LTRIM(RTRIM(p.PAR_PRECOQT)) AS PAR_PRECOQT,
        u.LOC_CODI,
        u.CXA_CODI
      FROM PARAMETR p
      INNER JOIN TBUSUARIO_CONFIGURACAOAPP u
        ON LTRIM(RTRIM(u.LOC_CODI)) = LTRIM(RTRIM(p.LOC_CODI))
       AND LTRIM(RTRIM(u.CXA_CODI)) = LTRIM(RTRIM(p.CXA_CODI))
      `,
      { type: sequelizeUltraSyst.QueryTypes.SELECT }
    );

    if (!registros || registros.length === 0) {
      return res.status(404).json({ error: 'Nenhum registro encontrado com configuração válida em PARAMETR' });
    }

    // Retorna o primeiro (ou todos, se quiser — aqui retorna o primeiro por simplicidade)
    const { PAR_PRECOQT, LOC_CODI, CXA_CODI } = registros[0];

    res.json({
      parPrecoQt: PAR_PRECOQT,
      locCodi: LOC_CODI,
      cxaCodi: CXA_CODI
    });

  } catch (error) {
    console.error('Erro ao buscar PAR_PRECOQT:', error);
    res.status(500).json({ error: 'Erro ao consultar PAR_PRECOQT' });
  }
});

// -------------------------------
// Função já existente (não alterada)
// -------------------------------
function descriptografarNivel(psSenha) {
  try {
    if (!psSenha) return "Erro: senha vazia";

    let senhaPadded = (psSenha + " ".repeat(20)).substring(0, 20);
    let senhaDecodificada = [];

    for (let i = 0; i < 20; i++) {
      senhaDecodificada.push(String.fromCharCode(senhaPadded.charCodeAt(i) + 3));
    }

    senhaDecodificada = senhaDecodificada.map(c => (c === '-' ? ' ' : c));

    const nivel = senhaDecodificada[7];

    switch (nivel) {
      case '0': return '0-Administrador';
      case '1': return '1-Gerente';
      case '2': return '2-Supervisor';
      case '3': return '3-Operador';
      default: return `Nível inválido: ${nivel}`;
    }
  } catch (e) {
    console.error("Erro ao descriptografar nível:", e);
    return "Erro na descriptografia";
  }
}


// -------------------------------
// Rota: retornar PAR_DESCITEN, US_ACESSO descriptografado e PERMAXFINA
// -------------------------------
router.get('/parametr/desconto_habilitado', async (req, res) => {
  try {
    // 1️⃣ Buscar dados principais do usuário e parametrização
    const registros = await sequelizeUltraSyst.query(
      `
      SELECT 
        LTRIM(RTRIM(p.PAR_DESCITEN)) AS PAR_DESCITEN,
        LTRIM(RTRIM(uconf.US_CD)) AS US_CD,
        LTRIM(RTRIM(uconf.LOC_CODI)) AS LOC_CODI,
        LTRIM(RTRIM(u.US_ACESSO)) AS US_ACESSO
      FROM PARAMETR p
      INNER JOIN TBUSUARIO_CONFIGURACAOAPP uconf
        ON LTRIM(RTRIM(uconf.LOC_CODI)) = LTRIM(RTRIM(p.LOC_CODI))
       AND LTRIM(RTRIM(uconf.CXA_CODI)) = LTRIM(RTRIM(p.CXA_CODI))
      INNER JOIN USUARIO u
        ON LTRIM(RTRIM(u.US_CD)) = LTRIM(RTRIM(uconf.US_CD))
      `,
      { type: sequelizeUltraSyst.QueryTypes.SELECT }
    );

    if (!registros || registros.length === 0) {
      return res.status(404).json({ error: 'Nenhum registro encontrado nas tabelas PARAMETR ou USUARIO' });
    }

    const { PAR_DESCITEN, US_CD, LOC_CODI, US_ACESSO } = registros[0];

    // 2️⃣ Descriptografar o nível de acesso
    const acessoDescriptografado = descriptografarNivel(US_ACESSO);

    // 3️⃣ Determinar o campo correspondente ao nível
    let campoFinanceiro;
    switch (true) {
      case acessoDescriptografado.includes('Administrador'):
        campoFinanceiro = 'PAR_PERMAXITEMADM';
        break;
      case acessoDescriptografado.includes('Gerente'):
        campoFinanceiro = 'PAR_PERMAXITEMGER';
        break;
      case acessoDescriptografado.includes('Supervisor'):
        campoFinanceiro = 'PAR_PERMAXITEMSUP';
        break;
      case acessoDescriptografado.includes('Operador'):
        campoFinanceiro = 'PAR_PERMAXITEMOPE';
        break;
      default:
        campoFinanceiro = null;
    }

    if (!campoFinanceiro) {
      return res.status(400).json({ error: 'Nível de acesso inválido' });
    }

    // 4️⃣ Buscar o valor correspondente da TBPARAM_EMP com base na localização
    const resultadoFinanceiro = await sequelizeUltraSyst.query(
      `
      SELECT LTRIM(RTRIM(${campoFinanceiro})) AS PERMAXITEM
      FROM TBPARAM_EMP
      WHERE LTRIM(RTRIM(LOC_CODI)) = :locCodi
      `,
      {
        replacements: { locCodi: LOC_CODI },
        type: sequelizeUltraSyst.QueryTypes.SELECT
      }
    );

    const valorFinanceiro =
      resultadoFinanceiro.length > 0 ? resultadoFinanceiro[0].PERMAXITEM : null;

    // 5️⃣ Retornar tudo no JSON
    res.json({
      parDescIten: PAR_DESCITEN?.trim() || null,
      usuarioCodigo: US_CD?.trim() || null,
      usuarioAcesso: acessoDescriptografado,
      locCodi: LOC_CODI,
      campoFinanceiro,
      valorFinanceiro
    });

  } catch (error) {
    console.error('Erro ao buscar PAR_DESCITEN e US_ACESSO:', error);
    res.status(500).json({ error: 'Erro ao consultar parâmetros de desconto e acesso' });
  }
});


  return router;
};
