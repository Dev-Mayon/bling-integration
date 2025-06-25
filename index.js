require('dotenv').config();
const express = require('express');
const app = express();

const blingService = require('./blingService');
const mercadoPagoService = require('./mercadoPagoService');

app.use(express.json());

// ROTA 1 — Criação manual via POST (continua funcionando normalmente)
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

// ROTA 2 — Notificação automática do Mercado Pago
app.post('/notificacao', async (req, res) => {
  try {
    const { id } = req.body;
    const dadosPagamento = await mercadoPagoService.buscarPagamento(id);

    const pedido = {
      idCliente: process.env.CLIENTE_ID,
      codigoProduto: process.env.PRODUTO_CODIGO,
      quantidade: dadosPagamento.quantidade || 1,
      valor: dadosPagamento.valor || 100,
      situacao: 'Em aberto',
      observacoes: `Compra de ${dadosPagamento.nomeCliente} via Mercado Pago`,
      observacoesInternas: `MP Payment ID: ${dadosPagamento.id}`
    };

    const result = await blingService.criarPedido(pedido);
    res.status(201).json({ success: true, result });
  } catch (error) {
    const errorData = error.response?.data || error.message;
    console.error('[ERRO] Ao processar notificação do MP:', JSON.stringify(errorData, null, 2));
    res.status(500).json({ success: false, error: errorData });
  }
});

// ROTA 3 — Consulta os tokens atuais (útil para testes)
app.get('/tokens', (req, res) => {
  res.json({
    access_token: blingService.accessToken,
    refresh_token: blingService.refreshToken
  });
});

// 🔁 Agendamento da renovação automática do token Bling
console.log('[SCHEDULER] Renovação automática iniciada...');
blingService.renovarAccessToken(); // Executa ao iniciar

const CINCO_HORAS_MS = 5 * 60 * 60 * 1000;
setInterval(() => {
  console.log('[SCHEDULER] Executando renovação programada...');
  blingService.renovarAccessToken();
}, CINCO_HORAS_MS);

// Inicialização do servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});




