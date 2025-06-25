require('dotenv').config();

// ==============================================================================
// PASSO DE DEBUG: Verifique se o .env foi carregado corretamente.
// Olhe no seu terminal ao iniciar o servidor. Se aparecer "undefined",
// o seu arquivo .env não está sendo encontrado.
// ==============================================================================
console.log('[DEBUG] Verificando variável BLING_REFRESH_TOKEN:', process.env.BLING_REFRESH_TOKEN);


const express = require('express');
const crypto = require('crypto');
const app = express();

const blingService = require('./blingService');
const mercadoPagoService = require('./mercadoPagoService');


// Middleware para garantir que o corpo da requisição seja lido corretamente
app.use((req, res, next) => {
  // Para a rota do webhook, precisamos do corpo bruto (raw) para a verificação de segurança
  if (req.path === '/mercadopago/webhook') {
    express.text({ type: 'application/json' })(req, res, next);
  } else {
    // Para todas as outras rotas, o JSON padrão funciona
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
  const ts = parts.find(part => part.startsWith('ts=')).split('=')[1];
  const hash = parts.find(part => part.startsWith('v1=')).split('=')[1];
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  if (!secret) {
      console.error('[SECURITY] Chave secreta do webhook não configurada no .env');
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


// ROTA 3 — Webhook real do Mercado Pago (com segurança)
app.post('/mercadopago/webhook', verifyMercadoPagoSignature, async (req, res) => {
  try {
    const paymentId = req.body.data?.id;
    if (!paymentId) {
      return res.status(400).send('payment_id ausente no corpo da requisição.');
    }

    console.log(`[MP] Buscando pagamento ID: ${paymentId}`);
    const pagamento = await mercadoPagoService.buscarPagamento(paymentId);

    console.log('[MP] Pagamento obtido:', JSON.stringify(pagamento, null, 2));
    const result = await blingService.criarPedido(pagamento);

    console.log('[BLING] Pedido criado com sucesso:', result);
    res.status(201).send('Notificação recebida e processada com sucesso.');
  } catch (error) {
    console.error('[ERRO INTERNO]', error.message);
    console.error('[ERRO COMPLETO]', error.response?.data || error.stack);
    res.status(500).send('Erro ao processar webhook.');
  }
});


// Inicialização do servidor com token
(async () => {
  try {
    await blingService.inicializarTokens();
    console.log('[INIT] Tokens do Bling carregados com sucesso.');

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`[INIT] Servidor rodando em http://localhost:${PORT}`);
    });
  } catch(error) {
    console.error('[INIT] FALHA CRÍTICA AO INICIAR. Verifique o erro acima.', error.message);
    process.exit(1); // Encerra o processo se a inicialização falhar
  }
})();

