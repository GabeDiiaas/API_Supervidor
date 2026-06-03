const express = require('express');

module.exports = ({ sequelizeUltraSyst, sequelizePontoVenda }) => {
  const router = express.Router();

router.post('/pedidos', async (req, res) => {
  const {
    cod_pedido,
    emp_codi,
    loc_codi,
    cxa_codi,
    ven_codi,
    us_cd,
    cli_codi,
    cli_nome,
    cli_cpf,
    data_pedido,
    valor_pedido,
    obser_pedido,
    hora_impressao,
    tipo_venda,
    tabela_venda,
    situacao_pedido,
    valor_descto,
    perct_descto,
    valor_acresc,
    perct_acresc,
    valor_troco,
    valor_bruto,
    android_id   // 🔹 NOVO CAMPO
  } = req.body;

  if (
    !cod_pedido ||
    !emp_codi ||
    !loc_codi ||
    !cxa_codi ||
    !ven_codi ||
    !obser_pedido
  ) {
    return res.status(400).json({
      error: 'Campos obrigatórios faltando'
    });
  }

  try {
    await sequelizeUltraSyst.query(
      `
      INSERT INTO TBPEDIDOS_APP
      (
        COD_PEDIDO,
        EMP_CODI,
        LOC_CODI,
        CXA_CODI,
        VEN_CODI,
        US_CD,
        CLI_CODI,
        CLI_NOME,
        CLI_CPF,
        DATA_PEDIDO,
        VALOR_PEDIDO,
        OBSER_PEDIDO,
        HORA_IMPRESSAO,
        TIPO_VENDA,
        TABELA_VENDA,
        SITUACAO_PEDIDO,
        VALOR_DESCTO,
        PERCT_DESCTO,
        VALOR_ACRESC,
        PERCT_ACRESC,
        VALOR_TROCO,
        VALOR_BRUTO,
        ANDROID_ID
      )
      VALUES
      (
        :cod_pedido,
        :emp_codi,
        :loc_codi,
        :cxa_codi,
        :ven_codi,
        :us_cd,
        :cli_codi,
        :cli_nome,
        :cli_cpf,
        :data_pedido,
        :valor_pedido,
        :obser_pedido,
        :hora_impressao,
        :tipo_venda,
        :tabela_venda,
        :situacao_pedido,
        :valor_descto,
        :perct_descto,
        :valor_acresc,
        :perct_acresc,
        :valor_troco,
        :valor_bruto,
        :android_id
      )
      `,
      {
        replacements: {
          cod_pedido,
          emp_codi,
          loc_codi,
          cxa_codi,
          ven_codi,
          us_cd: us_cd || null,
          cli_codi: cli_codi || null,
          cli_nome: cli_nome || null,
          cli_cpf: cli_cpf || null,
          data_pedido: data_pedido || new Date(),
          valor_pedido: valor_pedido || 0,
          obser_pedido,
          hora_impressao: hora_impressao || null,
          tipo_venda: tipo_venda || null,
          tabela_venda: tabela_venda || null,

          situacao_pedido: situacao_pedido ?? 0,

          valor_descto: valor_descto || 0,
          perct_descto: perct_descto || 0,
          valor_acresc: valor_acresc || 0,
          perct_acresc: perct_acresc || 0,
          valor_troco: valor_troco || 0,
          valor_bruto: valor_bruto || 0,

          android_id: android_id || null   // 🔹 NOVO
        }
      }
    );

    res.status(201).json({
      message: 'Pedido inserido com sucesso',
      situacao_pedido: situacao_pedido ?? 0
    });

  } catch (error) {
    console.error('Erro ao inserir pedido:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});


// buscar pedido e itens nao finalizado
router.get('/pedidos/android/:android_id', async (req, res) => {
  const { android_id } = req.params;
  const { situacao, empCodi, locCodi, cxaCodi } = req.query;

  try {
    let situacaoFiltro;

    if (situacao !== undefined) {
      situacaoFiltro = `P.SITUACAO_PEDIDO = ${parseInt(situacao)}`;
    } else {
      situacaoFiltro = `P.SITUACAO_PEDIDO IN (0, 4)`;
    }

    // ─────────────────────────────────────────────
    // BUSCA PEDIDOS (ULTRASYST)
    // ─────────────────────────────────────────────
    const pedidos = await sequelizeUltraSyst.query(`
      SELECT 
        P.ID, P.COD_PEDIDO, P.EMP_CODI, P.LOC_CODI, P.CXA_CODI,
        P.VEN_CODI, P.CLI_CODI, P.CLI_NOME, P.DATA_PEDIDO,
        P.HORA_IMPRESSAO, P.VALOR_PEDIDO, P.SITUACAO_PEDIDO, P.TIPO_VENDA,
        P.TABELA_VENDA, P.ANDROID_ID,
        I.ID AS ITEM_ID, I.PRO_CODI, I.PRO_VDTP, I.QUANTIDADE,
        I.VALOR, I.DESCONTO_VALOR, I.DESCONTO_PERCE, I.VALOR_TABELA,
        I.NOME_EMBALAGEM, I.QTDE_EMBALAGEM
      FROM TBPEDIDOS_APP P
      LEFT JOIN TBPEDIDOS_APP_ITENS I ON P.COD_PEDIDO = I.COD_PEDIDO
      WHERE P.ANDROID_ID = :android_id
        AND ${situacaoFiltro}
      ORDER BY 
        CAST(P.DATA_PEDIDO AS DATE) DESC,
        CAST(P.HORA_IMPRESSAO AS TIME) DESC,
        P.ID DESC
    `, {
      replacements: { android_id },
      type: require('sequelize').QueryTypes.SELECT
    });

    if (pedidos.length === 0) {
      return res.json([]);
    }

    // ─────────────────────────────────────────────
    // VERIFICA SE TEM PEDIDO PDV
    // ─────────────────────────────────────────────
    const temPedidoPDV = pedidos.some(row => row.TIPO_VENDA?.trim() === '2');

    let caixaAberto = true;

    // ─────────────────────────────────────────────
    // CAIXA (MESMA LÓGICA DA ROTA /acesso)
    // PontoVenda → UltraSyst fallback
    // ─────────────────────────────────────────────
    if (temPedidoPDV && empCodi && locCodi && cxaCodi) {

      let resultadoCaixa = [];
      let instancia = null;

      // 1️⃣ tenta PontoVenda
      resultadoCaixa = await sequelizePontoVenda.query(`
        SELECT 
          CONVERT(varchar(10), PAR_DTAB, 23) AS PAR_DTAB,
          PAR_OPRATV
        FROM dbo.PARAMETR
        WHERE EMP_CODI = :empCodi
          AND LOC_CODI = :locCodi
          AND CXA_CODI = :cxaCodi
      `, {
        replacements: { empCodi, locCodi, cxaCodi },
        type: sequelizePontoVenda.QueryTypes.SELECT
      });

      if (resultadoCaixa.length > 0) {
        instancia = 'PontoVenda';
      } else {
        // 2️⃣ fallback UltraSyst
        resultadoCaixa = await sequelizeUltraSyst.query(`
          SELECT 
            CONVERT(varchar(10), PAR_DTAB, 23) AS PAR_DTAB,
            PAR_OPRATV
          FROM dbo.PARAMETR
          WHERE EMP_CODI = :empCodi
            AND LOC_CODI = :locCodi
            AND CXA_CODI = :cxaCodi
        `, {
          replacements: { empCodi, locCodi, cxaCodi },
          type: sequelizeUltraSyst.QueryTypes.SELECT
        });

        if (resultadoCaixa.length > 0) {
          instancia = 'UltraSyst';
        }
      }

      if (resultadoCaixa.length > 0) {
        const caixa = resultadoCaixa[0];

        const hoje = new Date().toISOString().split('T')[0];

        const operadorAtivo =
          caixa.PAR_OPRATV !== null &&
          caixa.PAR_OPRATV !== undefined &&
          caixa.PAR_OPRATV.toString().trim() !== '';

        caixaAberto =
          caixa.PAR_DTAB === hoje && operadorAtivo;

      } else {
        caixaAberto = false;
      }
    }

    // ─────────────────────────────────────────────
    // FILTRA PEDIDOS
    // ─────────────────────────────────────────────
    const pedidosFiltrados = caixaAberto
      ? pedidos
      : pedidos.filter(row => row.TIPO_VENDA?.trim() !== '2');

    if (pedidosFiltrados.length === 0) {
      return res.status(403).json({
        permitido: false,
        motivo: 'Caixa fechado - pedido PDV não pode ser restaurado',
        temPedidoPendente: true
      });
    }

    // ─────────────────────────────────────────────
    // MONTA RESPOSTA
    // ─────────────────────────────────────────────
    const pedidosMap = {};

    pedidosFiltrados.forEach(row => {
      if (!pedidosMap[row.COD_PEDIDO]) {
        pedidosMap[row.COD_PEDIDO] = {
          ID: row.ID,
          COD_PEDIDO: row.COD_PEDIDO,
          EMP_CODI: row.EMP_CODI?.trim(),
          LOC_CODI: row.LOC_CODI?.trim(),
          CXA_CODI: row.CXA_CODI?.trim(),
          VEN_CODI: row.VEN_CODI?.trim(),
          CLI_CODI: row.CLI_CODI?.trim(),
          CLI_NOME: row.CLI_NOME?.trim(),
          DATA_PEDIDO: row.DATA_PEDIDO,
          HORA_IMPRESSAO: row.HORA_IMPRESSAO,
          VALOR_PEDIDO: row.VALOR_PEDIDO,
          SITUACAO_PEDIDO: row.SITUACAO_PEDIDO,
          TIPO_VENDA: row.TIPO_VENDA?.trim(),
          TABELA_VENDA: row.TABELA_VENDA,
          ANDROID_ID: row.ANDROID_ID,
          itens: []
        };
      }

      if (row.ITEM_ID) {
        pedidosMap[row.COD_PEDIDO].itens.push({
          ITEM_ID: row.ITEM_ID,
          PRO_CODI: row.PRO_CODI?.trim(),
          PRO_VDTP: row.PRO_VDTP?.trim(),
          QUANTIDADE: row.QUANTIDADE,
          VALOR: row.VALOR,
          DESCONTO_VALOR: row.DESCONTO_VALOR,
          DESCONTO_PERCE: row.DESCONTO_PERCE,
          VALOR_TABELA: row.VALOR_TABELA,
          NOME_EMBALAGEM: row.NOME_EMBALAGEM?.trim(),
          QTDE_EMBALAGEM: row.QTDE_EMBALAGEM
        });
      }
    });

    return res.json(Object.values(pedidosMap));

  } catch (error) {
    console.error("ERRO NA ROTA PEDIDOS:", error);
    return res.status(500).json({ error: error.message });
  }
});
// rota de atulizar, aonde faz a soma de tudo antes de finalizar:

router.put('/atualizar_pedido/:cod_pedido', async (req, res) => {
  try {
    await sequelizeUltraSyst.transaction(async (transaction) => {
      const { cod_pedido } = req.params;

      const pedido = await sequelizeUltraSyst.query(
        `
        SELECT 
          SITUACAO_PEDIDO,
          EMP_CODI,
          LOC_CODI,
          CXA_CODI,
          TIPO_VENDA
        FROM TBPEDIDOS_APP WITH (UPDLOCK, HOLDLOCK)
        WHERE COD_PEDIDO = :cod_pedido
        `,
        {
          replacements: { cod_pedido },
          type: sequelizeUltraSyst.QueryTypes.SELECT,
          transaction
        }
      );

      if (pedido.length === 0) {
        throw new Error('Pedido não encontrado');
      }

      const dadosPedido = pedido[0];

      // 🚫 Bloqueia se já estava finalizado
      if (dadosPedido.SITUACAO_PEDIDO == 2) {
        throw new Error('Pedido já finalizado, não pode alterar');
      }

      // ✏️ UPDATE — situação nunca vira 2 por aqui
      // (finalização só pela rota /finalizar_pedido)
      const novaSituacao = req.body.situacao_pedido ?? dadosPedido.SITUACAO_PEDIDO;
      const situacaoFinal = novaSituacao == 2 ? dadosPedido.SITUACAO_PEDIDO : novaSituacao;

      await sequelizeUltraSyst.query(
        `
        UPDATE TBPEDIDOS_APP
        SET
          VALOR_PEDIDO    = :valor_pedido,
          OBSER_PEDIDO    = :obser_pedido,
          TIPO_VENDA      = :tipo_venda,
          TABELA_VENDA    = :tabela_venda,
          SITUACAO_PEDIDO = :situacao_pedido,
          VALOR_DESCTO    = :valor_descto,
          PERCT_DESCTO    = :perct_descto,
          VALOR_ACRESC    = :valor_acresc,
          PERCT_ACRESC    = :perct_acresc,
          VALOR_TROCO     = :valor_troco,
          VALOR_BRUTO     = :valor_bruto
        WHERE COD_PEDIDO = :cod_pedido
        `,
        {
          replacements: {
            cod_pedido,
            ...req.body,
            situacao_pedido: situacaoFinal  // garante que nunca salva 2 aqui
          },
          transaction
        }
      );

      // ✅ Procedure REMOVIDA daqui — só executa em /finalizar_pedido

    });

    return res.json({ message: 'Pedido atualizado com sucesso' });

  } catch (error) {
    console.error('Erro na rota atualizar_pedido:', error);
    return res.status(500).json({ error: error.message });
  }
});

// rota finalizar
router.put('/finalizar_pedido/:cod_pedido', async (req, res) => {
  try {
    const { cod_pedido } = req.params;

    const {
      emp_codi,
      loc_codi,
      cxa_codi,
      etr_codi,
      valor_pedido,
      valor_bruto,
      valor_descto = 0,
      perct_descto = 0,
      valor_acresc = 0,
      perct_acresc = 0,
      valor_troco = 0,
      obser_pedido = '',
      tabela_venda,
      tipo_venda,
      data_pedido = null
    } = req.body;

    console.log(`🏁 [FINALIZAR_PEDIDO] Iniciando pedido #${cod_pedido}`);

    // =========================================
    // 🔒 1 - TRAVA PEDIDO (CAPA)
    // =========================================
    const pedido = await sequelizeUltraSyst.query(`
      SELECT SITUACAO_PEDIDO, TIPO_VENDA, EMP_CODI, LOC_CODI, CXA_CODI
      FROM TBPEDIDOS_APP WITH (UPDLOCK, HOLDLOCK)
      WHERE COD_PEDIDO = :cod_pedido
    `, {
      replacements: { cod_pedido },
      type: sequelizeUltraSyst.QueryTypes.SELECT
    });

    if (!pedido.length) throw new Error('Pedido não encontrado');

    const dadosPedido = pedido[0];

    if (dadosPedido.SITUACAO_PEDIDO == 2)
      throw new Error('Pedido já finalizado');

    if (dadosPedido.SITUACAO_PEDIDO == 3)
      throw new Error('Pedido cancelado não pode ser finalizado');

    const empCodiFinal = emp_codi ?? dadosPedido.EMP_CODI?.trim();
    const locCodiFinal = loc_codi ?? dadosPedido.LOC_CODI?.trim();
    const cxaCodiFinal = cxa_codi ?? dadosPedido.CXA_CODI?.trim();
    const tipoVendaFinal = tipo_venda ?? dadosPedido.TIPO_VENDA;

    // =========================================
    // 🔒 2 - TRAVA ITENS DO PEDIDO
    // =========================================
    await sequelizeUltraSyst.query(`
      SELECT 1
      FROM TBPEDIDOS_APP_ITENS WITH (UPDLOCK, HOLDLOCK)
      WHERE COD_PEDIDO = :cod_pedido
    `, {
      replacements: { cod_pedido }
    });

    // =========================================
    // 🔒 3 - TRAVA ESTOQUE (apenas para PDV)
    // =========================================
    if (tipoVendaFinal == '2') {
      await sequelizeUltraSyst.query(`
        SELECT 1
        FROM ESTOQUE WITH (UPDLOCK, HOLDLOCK)
        WHERE EMP_CODI = :emp_codi
          AND LOC_CODI = :loc_codi
      `, {
        replacements: {
          emp_codi: empCodiFinal,
          loc_codi: locCodiFinal
        }
      });
    }

    // =========================================
    // 4 - EXECUTA STORE PROCEDURE (apenas PDV)
    // =========================================
    if (tipoVendaFinal == '2') {
      console.log(`⚙️ [SP_GRAVA_PEDIDO_APP] Executando pedido #${cod_pedido} (tipoVenda=${tipoVendaFinal})`);

      await sequelizeUltraSyst.query(`
        EXEC SP_GRAVA_PEDIDO_APP
          @EMP_CODI   = :EMP_CODI,
          @LOC_CODI   = :LOC_CODI,
          @CXA_CODI   = :CXA_CODI,
          @COD_PEDIDO = :COD_PEDIDO,
          @ETR_CODI   = :ETR_CODI
      `, {
        replacements: {
          EMP_CODI: empCodiFinal,
          LOC_CODI: locCodiFinal,
          CXA_CODI: cxaCodiFinal,
          COD_PEDIDO: cod_pedido,
          ETR_CODI: etr_codi
        }
      });

      console.log('✅ Store Procedure executada com sucesso');
    } else {
      console.log(`⏭️ [SP_GRAVA_PEDIDO_APP] Pulada — tipoVenda=${tipoVendaFinal} (0=Orçamento, 1=Faturamento)`);
    }

    // =========================================
    // 5 - ATUALIZA PEDIDO FINAL
    // =========================================
    await sequelizeUltraSyst.query(`
      UPDATE TBPEDIDOS_APP
      SET
        SITUACAO_PEDIDO = 2,
        VALOR_PEDIDO    = :valor_pedido,
        VALOR_BRUTO     = :valor_bruto,
        VALOR_DESCTO    = :valor_descto,
        PERCT_DESCTO    = :perct_descto,
        VALOR_ACRESC    = :valor_acresc,
        PERCT_ACRESC    = :perct_acresc,
        VALOR_TROCO     = :valor_troco,
        OBSER_PEDIDO    = :obser_pedido,
        TABELA_VENDA    = :tabela_venda,
        TIPO_VENDA      = :tipo_venda,
        DATA_PEDIDO     = COALESCE(:data_pedido, DATA_PEDIDO) 
      WHERE COD_PEDIDO = :cod_pedido
    `, {
      replacements: {
        cod_pedido,
        valor_pedido,
        valor_bruto,
        valor_descto,
        perct_descto,
        valor_acresc,
        perct_acresc,
        valor_troco,
        obser_pedido,
        tabela_venda: tabela_venda ?? null,
        tipo_venda: tipoVendaFinal,
        data_pedido
      }
    });

    console.log(`🎉 [FINALIZADO] Pedido #${cod_pedido} concluído — tipoVenda=${tipoVendaFinal}`);

    return res.json({
      message: 'Pedido finalizado com sucesso'
    });

  } catch (error) {
    console.error('🔥 ERRO FINALIZAR PEDIDO:', error.message);

    return res.status(400).json({
      error: error.message
    });
  }
});

router.delete('/deleta_itens/:cod_pedido/:pro_codi', async (req, res) => {
  const { cod_pedido, pro_codi } = req.params;

  if (!cod_pedido || !pro_codi) {
    return res.status(400).json({
      error: 'cod_pedido e pro_codi são obrigatórios'
    });
  }

  try {
    const [result] = await sequelizeUltraSyst.query(
      `
      DELETE FROM TBPEDIDOS_APP_ITENS
      WHERE COD_PEDIDO = :cod_pedido
        AND PRO_CODI   = :pro_codi
      `,
      {
        replacements: { cod_pedido, pro_codi }
      }
    );

    if (result === 0) {
      return res.status(404).json({
        error: 'Item não encontrado para este pedido'
      });
    }

    return res.status(200).json({
      message: 'Item do pedido deletado com sucesso',
      cod_pedido,
      pro_codi
    });

  } catch (error) {
    console.error('Erro ao deletar item do pedido:', error);

    return res.status(500).json({
      error: 'Erro ao deletar item do pedido',
      detalhe: error.message
    });
  }
});


router.post('/envio/:cod_pedido/itens', async (req, res) => {
  const { cod_pedido } = req.params;

  const {
    pro_codi,
    pro_vdtp,
    quantidade,
    valor,
    desconto_valor,
    desconto_perce,
    valor_tabela,
    nome_embalagem,
    qtde_embalagem,
    android_id,
    ven_codi,

    // 🔹 NOVOS CAMPOS
    cor_codi,
    cor_desr,
    tam_codi,
    tam_desr

  } = req.body;

  console.log('📥 POST /envio/:cod_pedido/itens', {
    cod_pedido,
    pro_codi,
    quantidade,
    cor_codi,
    tam_codi
  });

  try {

    await sequelizeUltraSyst.query(
      `
      INSERT INTO TBPEDIDOS_APP_ITENS
      (
        COD_PEDIDO,
        PRO_CODI,
        PRO_VDTP,
        QUANTIDADE,
        VALOR,
        DESCONTO_VALOR,
        DESCONTO_PERCE,
        VALOR_TABELA,
        NOME_EMBALAGEM,
        QTDE_EMBALAGEM,

        -- 🔹 NOVOS CAMPOS
        COR_CODI,
        COR_DESR,
        TAM_CODI,
        TAM_DESR
      )
      VALUES
      (
        :cod_pedido,
        :pro_codi,
        :pro_vdtp,
        :quantidade,
        :valor,
        :desconto_valor,
        :desconto_perce,
        :valor_tabela,
        :nome_embalagem,
        :qtde_embalagem,

        -- 🔹 NOVOS CAMPOS
        :cor_codi,
        :cor_desr,
        :tam_codi,
        :tam_desr
      )
      `,
      {
        replacements: {
          cod_pedido,
          pro_codi,
          pro_vdtp,
          quantidade,
          valor,
          desconto_valor,
          desconto_perce,
          valor_tabela,
          nome_embalagem,
          qtde_embalagem,

          // 🔹 NOVOS CAMPOS
          cor_codi,
          cor_desr,
          tam_codi,
          tam_desr
        }
      }
    );

    console.log('✅ Item inserido com sucesso');

    return res.status(201).json({
      message: 'Item inserido com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao inserir item:', error);

    return res.status(500).json({
      error: 'Erro ao inserir item',
      detalhe: error.message,
      banco: error.original?.message
    });
  }
});

router.post('/reservar-estoque', async (req, res) => {

  const transaction = await sequelizeUltraSyst.transaction();

  try {

    const {
      EmpCodi,
      LocCodi,
      CxaCodi,
      ProCodi,
      Qtd,
      Tam = '',
      LocEstPro,
      EtrCodi,
      EtrNome,
      UsuCodi,
      ProCtRest,
      PAREstLoj
    } = req.body;

    // ✅ LOG BODY
    console.log('═══════════════════════════════════════════');
    console.log('📦 [RESERVAR-ESTOQUE] Body recebido:');
    console.log(`   EmpCodi  : ${EmpCodi}`);
    console.log(`   LocCodi  : ${LocCodi}`);
    console.log(`   CxaCodi  : ${CxaCodi}`);
    console.log(`   ProCodi  : ${ProCodi}`);
    console.log(`   Qtd      : ${Qtd}`);
    console.log(`   Tam      : '${Tam}'`);
    console.log(`   LocEstPro: ${LocEstPro}`);
    console.log(`   EtrCodi  : ${EtrCodi}`);
    console.log(`   EtrNome  : ${EtrNome}`);
    console.log(`   UsuCodi  : ${UsuCodi}`);
    console.log(`   ProCtRest: ${ProCtRest}`);
    console.log(`   PAREstLoj: ${PAREstLoj}`);
    console.log('═══════════════════════════════════════════');

    // ✅ VALIDAÇÃO
    if (
      !EmpCodi ||
      !LocCodi ||
      !CxaCodi ||
      !ProCodi ||
      Qtd == null ||
      !LocEstPro ||
      !EtrCodi ||
      !EtrNome ||
      !UsuCodi ||
      !ProCtRest ||
      !PAREstLoj
    ) {
      await transaction.rollback();
      return res.status(400).json({
        error: "Parâmetros obrigatórios não informados"
      });
    }

    // ✅ GARANTE NÚMERO
    const qtdNumerico = Number(Qtd);

    if (isNaN(qtdNumerico) || qtdNumerico === 0) {
      await transaction.rollback();
      return res.status(400).json({
        error: "Qtd inválida"
      });
    }

    console.log(`   Qtd convertida: ${qtdNumerico}`);

    // 🔒 LOCK DA RESERVA
    await sequelizeUltraSyst.query(
      `
      SELECT PRO_CODI
      FROM dbo.TBESTOQUE_RESERVA
      WITH (UPDLOCK, HOLDLOCK, SERIALIZABLE)
      WHERE
        EMP_CODI = :EmpCodi
        AND LOC_CODI = :LocCodi
        AND PRO_CODI = :ProCodi
      `,
      {
        replacements: { EmpCodi, LocCodi, ProCodi },
        transaction
      }
    );

    // =========================================================
    // ✅ SE FOR POSITIVO = DEVOLUÇÃO
    // VALIDAR SE EXISTE RESERVA SUFICIENTE
    // =========================================================
    if (qtdNumerico > 0) {

      const reservaAtual = await sequelizeUltraSyst.query(
        `
        SELECT
          ISNULL(SUM(ETR_QUAN), 0) AS TOTAL_RESERVADO
        FROM dbo.TBESTOQUE_RESERVA
        WHERE
          EMP_CODI = :EmpCodi
          AND LOC_CODI = :LocCodi
          AND PRO_CODI = :ProCodi
        `,
        {
          replacements: { EmpCodi, LocCodi, ProCodi },
          type: sequelizeUltraSyst.QueryTypes.SELECT,
          transaction
        }
      );

      // reserva normalmente fica negativa
      const totalReservado = Math.abs(
        Number(reservaAtual?.[0]?.TOTAL_RESERVADO || 0)
      );

      console.log(`   Reservado atual (ETR_QUAN): ${totalReservado}`);
      console.log(`   Tentando devolver: ${qtdNumerico}`);

      // ❌ NÃO PODE DEVOLVER MAIS DO QUE RESERVOU
      if (qtdNumerico > totalReservado) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'Reserva insuficiente para devolução',
          reservadoAtual: totalReservado,
          tentandoDevolver: qtdNumerico
        });
      }
    }

    // =========================================================
    // ✅ EXECUTA PROCEDURE
    // =========================================================
    const result = await sequelizeUltraSyst.query(
      `
      DECLARE @RetMsg VARCHAR(200);

      EXEC dbo.sp_AtualizaEstReserva
        @EmpCodi     = :EmpCodi,
        @LocCodi     = :LocCodi,
        @CxaCodi     = :CxaCodi,
        @ProCodi     = :ProCodi,
        @Qtd         = :Qtd,
        @Tam         = :Tam,
        @LocEstPro   = :LocEstPro,
        @TipoEstoque = 'F',
        @EtrCodi     = :EtrCodi,
        @EtrNome     = :EtrNome,
        @UsuCodi     = :UsuCodi,
        @ProCtRest   = :ProCtRest,
        @PAREstLoj   = :PAREstLoj,
        @RetMsg      = @RetMsg OUTPUT;

      SELECT @RetMsg AS RetMsg;
      `,
      {
        replacements: {
          EmpCodi,
          LocCodi,
          CxaCodi,
          ProCodi,
          Qtd: qtdNumerico,
          Tam,
          LocEstPro,
          EtrCodi,
          EtrNome,
          UsuCodi,
          ProCtRest,
          PAREstLoj
        },
        type: sequelizeUltraSyst.QueryTypes.SELECT,
        transaction
      }
    );

    const retorno = result?.[0]?.RetMsg || '';

    console.log(`   RetMsg procedure: ${retorno}`);

    // ❌ ERRO PROCEDURE
    if (retorno.startsWith('1-')) {
      await transaction.rollback();
      return res.status(400).json({
        error: "Erro ao atualizar reserva",
        detalhe: retorno
      });
    }

    // ✅ COMMIT
    await transaction.commit();

    return res.json({
      message: "Reserva executada com sucesso",
      retorno
    });

  } catch (error) {

    try {
      await transaction.rollback();
    } catch (_) {}

    console.error('🔥 Erro reservar-estoque:', error);

    return res.status(500).json({
      error: "Erro interno",
      detalhe: error.message
    });
  }
});

// deletar reserva
router.delete('/reservar-estoque/:EtrCodi/:ProCodi', async (req, res) => {
  const transaction = await sequelizeUltraSyst.transaction();

  try {
    const { EtrCodi, ProCodi } = req.params;

    if (!EtrCodi || !ProCodi) {
      await transaction.rollback();
      return res.status(400).json({ error: "EtrCodi ou ProCodi não informado" });
    }

    // 🔒 lock opcional na reserva (recomendado)
    await sequelizeUltraSyst.query(
      `
      SELECT 1
      FROM TBESTOQUE_RESERVA WITH (UPDLOCK, HOLDLOCK)
      WHERE PRO_CODI = :ProCodi
        AND ETR_CODI = :EtrCodi
      `,
      {
        replacements: {
          ProCodi: Number(ProCodi),
          EtrCodi
        },
        transaction
      }
    );

    await sequelizeUltraSyst.query(
      `
      DELETE FROM TBESTOQUE_RESERVA
      WHERE PRO_CODI = :ProCodi
        AND ETR_CODI = :EtrCodi
      `,
      {
        replacements: {
          ProCodi: Number(ProCodi),
          EtrCodi
        },
        transaction
      }
    );

    await transaction.commit();

    return res.json({
      message: "Reserva excluída com sucesso"
    });

  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({
      error: error.message
    });
  }
});

// atualizar itens

router.patch(
  '/itens_atualizar/:cod_pedido/:pro_codi',
  async (req, res) => {

    const { cod_pedido, pro_codi } = req.params;

    if (!cod_pedido || !pro_codi) {
      return res.status(400).json({
        error: 'cod_pedido e pro_codi são obrigatórios'
      });
    }

    const {
      quantidade,
      desconto_valor,
      desconto_perce,
      nome_embalagem,
      qtde_embalagem
    } = req.body;

    const fields = [];
    const replacements = { cod_pedido, pro_codi };

    // QUANTIDADE
    if (quantidade !== undefined) {
      fields.push('QUANTIDADE = :quantidade');
      replacements.quantidade = quantidade;
    }

    // DESCONTOS
    if (desconto_valor !== undefined) {
      fields.push('DESCONTO_VALOR = :desconto_valor');
      replacements.desconto_valor = desconto_valor;
    }

    if (desconto_perce !== undefined) {
      fields.push('DESCONTO_PERCE = :desconto_perce');
      replacements.desconto_perce = desconto_perce;
    }

    // EMBALAGEM
    if (nome_embalagem !== undefined) {
      fields.push('NOME_EMBALAGEM = :nome_embalagem');
      replacements.nome_embalagem = nome_embalagem;
    }

    if (qtde_embalagem !== undefined) {
      fields.push('QTDE_EMBALAGEM = :qtde_embalagem');
      replacements.qtde_embalagem = qtde_embalagem;
    }

    if (fields.length === 0) {
      return res.status(400).json({
        error: 'Nenhum campo enviado para atualização'
      });
    }

    try {
      const sql = `
        UPDATE TBPEDIDOS_APP_ITENS
        SET ${fields.join(', ')}
        WHERE COD_PEDIDO = :cod_pedido
          AND PRO_CODI   = :pro_codi
      `;

      const [result] = await sequelizeUltraSyst.query(sql, {
        replacements
      });

      if (!result || result === 0) {
        return res.status(404).json({
          message: 'Item do pedido não encontrado'
        });
      }

      return res.status(200).json({
        message: 'Item atualizado com sucesso',
        cod_pedido,
        pro_codi
      });

    } catch (error) {
      console.error(error);
      return res.status(500).json({
        error: 'Erro ao atualizar item',
        detalhe: error.message
      });
    }
  }
);








  // consulta dos pedidos e itens:

  router.get('/pedidos_itens/:cod_pedido', async (req, res) => {
  try {
    const cod_pedido = Number(req.params.cod_pedido);

    if (!cod_pedido) {
      return res.status(400).json({ error: 'cod_pedido inválido' });
    }

    // 🔹 Pedido
    const [pedidoRows] = await sequelizeUltraSyst.query(
      `
      SELECT *
      FROM TBPEDIDOS_APP
      WHERE COD_PEDIDO = :cod_pedido
      `,
      { replacements: { cod_pedido } }
    );

    if (!Array.isArray(pedidoRows) || pedidoRows.length === 0) {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }

    // 🔹 Itens
    const [itensRows] = await sequelizeUltraSyst.query(
      `
      SELECT *
      FROM TBPEDIDOS_APP_ITENS
      WHERE COD_PEDIDO = :cod_pedido
      ORDER BY PRO_CODI
      `,
      { replacements: { cod_pedido } }
    );

    res.json({
      pedido: pedidoRows[0],
      itens: Array.isArray(itensRows) ? itensRows : []
    });

  } catch (error) {
    console.error('❌ ERRO NA ROTA /pedidos/:cod_pedido', error);
    res.status(500).json({
      error: 'Erro interno',
      detalhe: error.message
    });
  }
});


// rota aonde ao finalizar editar e pa





 router.get('/pedido/codigos', async (req, res) => {
  try {
    const [result] = await sequelizeUltraSyst.query(`
      SELECT COD_PEDIDO
      FROM TBPEDIDOS_APP
      ORDER BY COD_PEDIDO DESC
    `);

    // Se não houver pedidos
    if (!result || result.length === 0) {
      return res.status(200).json({
        message: 'Sem pedidos feitos no momento',
        total: 0,
        cod_pedidos: []
      });
    }

    const codigosPedidos = result.map(row => row.COD_PEDIDO);

    return res.status(200).json({
      total: codigosPedidos.length,
      cod_pedidos: codigosPedidos
    });

  } catch (error) {
    console.error('Erro ao buscar códigos de pedidos:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});


// rota aonde buscar a observação

 router.get('/obs_pdv', async (req, res) => {
    const { emp_codi, loc_codi } = req.query;
 
    if (!emp_codi || !loc_codi) {
      return res.status(400).json({
        error: 'Os parâmetros emp_codi e loc_codi são obrigatórios'
      });
    }
 
    const replacements = {
      empCodi: emp_codi,
      locCodi: loc_codi
    };
 
    const sql = `
      SELECT TOP 1 PAR_OBSFZDPDV
      FROM dbo.TBPARAM_EMP
      WHERE EMP_CODI = :empCodi
        AND LOC_CODI = :locCodi
    `;
 
    let resultado = [];
    let instanciaUsada = null;
 
    // 🥇 Tenta UltraSyst — try/catch isolado para não travar se coluna não existir
    try {
      resultado = await sequelizeUltraSyst.query(sql, {
        replacements,
        type: sequelizeUltraSyst.QueryTypes.SELECT
      });
 
      if (resultado.length > 0) {
        instanciaUsada = process.env.DB_ULTRASYST_NAME || 'UltraSyst';
      }
    } catch (e) {
      console.warn('⚠️ UltraSyst falhou em obs_pdv:', e.message);
    }
 
    // 🥈 Fallback para PontoVenda — try/catch isolado
    if (resultado.length === 0) {
      try {
        resultado = await sequelizePontoVenda.query(sql, {
          replacements,
          type: sequelizePontoVenda.QueryTypes.SELECT
        });
 
        if (resultado.length > 0) {
          instanciaUsada = process.env.DB_PONTOVENDA_NAME || 'PontoVenda';
        }
      } catch (e) {
        console.warn('⚠️ PontoVenda falhou em obs_pdv:', e.message);
      }
    }
 
    // ❌ Não encontrado em nenhuma base
    if (resultado.length === 0) {
      return res.status(404).json({
        error: 'Registro não encontrado para os parâmetros informados'
      });
    }
 
    // ✅ Retorno
    return res.status(200).json({
      EMP_CODI: emp_codi,
      LOC_CODI: loc_codi,
      PAR_OBSFZDPDV: resultado[0].PAR_OBSFZDPDV ?? null,
      instancia: instanciaUsada
    });
  });




  return router;
};
