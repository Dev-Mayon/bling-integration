require('dotenv').config();
const express = require('express');
const app = express();

const blingService = require('./blingService');
const mercadoPagoService = require('./mercadoPagoService');

app.use(express.json());

// ROTA 1 — Criação manual via POST
app.post('/api/pedido', async (req, res) => {
  try {
    const pedido = req.body;
    const result = await blingService.criarPedido(pedido);
    res.status(201).json({ success: true, result });
  } catch (error) {
    const errorData = error.response?.data || error.message;
    console.error('[ERRO] Ao criar pedido manual:', JSON.stringify(errorData, null, 2));
    res.status(500).json({ success: false, error: errorData });
  }
});

// ROTA 2 — Simulação de notificação Mercado Pago
app.post('/notificacao', async (req, res) => {
  try {
    const { id, valor, nomeCliente, produto, quantidade } = req.body;

    const pedido = {
      idCliente: process.env.CLIENTE_ID,
      codigoProduto: process.env.PRODUTO_CODIGO,
      quantidade: quantidade || 1,
      valor: valor || 100,
      situacao: 'Em aberto',
      observacoes: `Compra de ${nomeCliente} via simulação`,
      observacoesInternas: `MP Payment ID: ${id}`
    };

    const result = await blingService.criarPedido(pedido);
    res.status(201).json({ success: true, result });
  } catch (error) {
    const errorData = error.response?.data || error.message;
    console.error('[ERRO] Ao processar notificação do MP (simulada):', JSON.stringify(errorData, null, 2));
    res.status(500).json({ success: false, error: errorData });
  }
});

// ROTA 3 — Webhook real do Mercado Pago com log completo
app.post('/mercadopago/webhook', async (req, res) => {
  try {
    const paymentId = req.body.data?.id;

    if (!paymentId) {
      console.warn('[MP] Webhook recebido sem payment_id:', req.body);
      return res.status(400).send('payment_id ausente');
    }

    console.log(`[MP] Buscando pagamento ID: ${paymentId}`);
    const pagamento = await mercadoPagoService.buscarPagamento(paymentId);

    console.log('[MP] Pagamento obtido:', JSON.stringify(pagamento, null, 2));
    const result = await blingService.criarPedido(pagamento);

    console.log('[BLING] Pedido criado com sucesso:', result);
    res.status(201).send('Pedido criado com sucesso no Bling');
  } catch (error) {
    console.error('[ERRO INTERNO]', error.message);
    console.error('[ERRO COMPLETO]', error.response?.data || error.stack);
    res.status(500).send('Erro ao processar webhook');
  }
});

// Inicialização do servidor com token
(async () => {
  await blingService.inicializarTokens(); // ✅ Inicializa os tokens ao subir o servidor

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
})();










