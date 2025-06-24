require('dotenv').config();
const express = require('express');
const app = express();
const blingService = require('./blingService');
const mercadoPagoService = require('./mercadoPagoService'); // ✅ serviço Mercado Pago

app.use(express.json());

// ROTA 1 — Criação manual via POST (continua funcionando normalmente)
app.post('/api/pedido', async (req, res) => {
  try {
    const pedido = req.body;
    const result = await blingService.criarPedido(pedido);
    res.status(201).json({ success: true, result });
  } catch (error) {
    const errorData = error.response?.data || error.message;
    console.error('Erro ao criar pedido:', JSON.stringify(errorData, null, 2));
    res.status(500).json({ success: false, error: errorData });
  }
});

// ROTA 2 — Notificação do Mercado Pago (consulta dados reais do pagamento)
app.post('/notificacao', async (req, res) => {
  try {
    const { id } = req.body;

    // 🔍 Busca os dados reais do pagamento na API do Mercado Pago
    const dadosPagamento = await mercadoPagoService.buscarPagamento(id);

    const pedido = {
      idCliente: process.env.CLIENTE_ID,
      codigoProduto: process.env.PRODUTO_CODIGO,
      quantidade: 1,
      valor: pagamento.transaction_amount || 100,
      situacao: pagamento.status === 'approved' ? 'Aprovado' : 'Em aberto',
      observacoes: `Compra de ${pagamento.payer.email} via Mercado Pago`,
      observacoesInternas: `MP Payment ID: ${pagamento.id}`
    };

    const result = await blingService.criarPedido(pedido);
    res.status(201).json({ success: true, result });
  } catch (error) {
    const errorData = error.response?.data || error.message;
    console.error('[ERRO] Ao processar notificação:', JSON.stringify(errorData, null, 2));
    res.status(500).json({ success: false, error: errorData });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});



