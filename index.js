require('dotenv').config();

console.log('[DEBUG] Verificando variável BLING_REFRESH_TOKEN:', process.env.BLING_REFRESH_TOKEN);
console.log('[DEBUG] Verificando variável REDIS_URL:', process.env.REDIS_URL);


const express = require('express');
const crypto = require('crypto');
const app = express();

const blingService = require('./blingService');
const mercadoPagoService = require('./mercadoPagoService');


// Middleware para garantir que o corpo da requisição seja lido corretamente
app.use((req, res, next) => {
  if (req.path === '/mercadopago/webhook') {
    express.text({ type: 'application/json' })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});


// Middleware de segurança para o Webhook do Mercado Pago
function verifyMercadoPagoSignature(req, res, next) {
  const signatureHeader = req.get('x-signature');
  if (!signatureHeader) {
    return res.status(401).send('Assinatura ausente.');
  }
  const parts = signatureHeader.split(',');
  const ts = parts.find(part => part.startsWith('ts='))?.split('=')[1];
  const hash = parts.find(part => part.startsWith('v1='))?.split('=')[1];
  if (!ts || !hash) { return res.status(401).send('Formato de assinatura inválido.'); }
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[SECURITY] Chave secreta do webhook não configurada.');
    return res.status(500).send('Erro interno do servidor.');
  }
  const manifest = `id:${JSON.parse(req.body).data.id};ts:${ts};`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(manifest);
  const expectedSignature = hmac.digest('hex');
  if (crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(hash))) {
    console.log('[SECURITY] Assinatura do Webhook validada com sucesso.');
    req.body = JSON.parse(req.body);
    next();
  } else {
    console.warn('[SECURITY] FALHA NA VALIDAÇÃO DA ASSINATURA. Requisição bloqueada.');
    res.status(403).send('Assinatura inválida.');
  }
}


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


// ROTA 2 — Webhook real do Mercado Pago (Segura)
app.post('/mercadopago/webhook', verifyMercadoPagoSignature, async (req, res) => {
  try {
    const paymentId = req.body.data?.id;
    if (!paymentId) { return res.status(400).send('payment_id ausente.'); }
    console.log(`[MP] Buscando pagamento ID: ${paymentId}`);
    const pagamento = await mercadoPagoService.buscarPagamento(paymentId);
    console.log('[MP] Pagamento obtido com sucesso.');
    const result = await blingService.criarPedido(pagamento);
    console.log('[BLING] Pedido criado com sucesso a partir do webhook.');
    res.status(200).send('Notificação recebida e processada com sucesso.');
  } catch (error) {
    console.error('[ERRO INTERNO]', error.message);
    res.status(500).send('Erro ao processar webhook.');
  }
});


// ==============================================================================
//  ROTA DE TESTE TEMPORÁRIA
// ==============================================================================
app.post('/test-webhook', async (req, res) => {
  console.log('--- RECEBIDA REQUISIÇÃO NA ROTA DE TESTE ---');
  try {
    const paymentId = req.body.data?.id;
    if (!paymentId) { return res.status(400).send('payment_id ausente.'); }
    
    console.log(`[TEST-MP] Buscando pagamento ID: ${paymentId}`);
    const pagamento = await mercadoPagoService.buscarPagamento(paymentId);
    
    console.log('[TEST-MP] Pagamento obtido com sucesso.');
    const result = await blingService.criarPedido(pagamento);
    
    console.log('[TEST-BLING] Pedido criado com sucesso a partir da rota de teste.');
    res.status(200).json({ success: true, message: "Pedido de teste criado no Bling!", data: result });
  } catch (error) {
    console.error('[ERRO INTERNO NO TESTE]', error.message);
    res.status(500).json({ success: false, error: error.response?.data || error.message });
  }
});


// Inicialização do servidor
(async () => {
  try {
    await blingService.inicializarServicoBling();
    console.log('[INIT] Serviço do Bling inicializado com sucesso.');
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`[INIT] Servidor rodando em http://localhost:${PORT}`);
    });
  } catch(error) {
    console.error('[INIT] FALHA CRÍTICA AO INICIAR.', error.message);
    process.exit(1);
  }
})();
