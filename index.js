require('dotenv').config();

console.log('[DEBUG] Verificando variável BLING_REFRESH_TOKEN:', process.env.BLING_REFRESH_TOKEN ? 'Carregado' : 'NÃO ENCONTRADO');
console.log('[DEBUG] Verificando variável REDIS_URL:', process.env.REDIS_URL ? 'Carregado' : 'NÃO ENCONTRADO');

const express = require('express');
const crypto = require('crypto');
const app = express();

const blingService = require('./blingService');
const mercadoPagoService = require('./mercadoPagoService');

// Catálogo interno de produtos para consulta
const produtos = {
  '+V1': {
    nome: 'Kit 1 Unidade Mais Vigor',
    preco: 99.00
  },
  '+V3': {
    nome: 'Kit 3 Unidades Mais Vigor',
    preco: 229.00
  },
  '+V5': {
    nome: 'Kit 5 Unidades Mais Vigor',
    preco: 349.00
  }
};

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
    console.error('--- [ERRO DETALHADO EM /api/pedido] ---');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Mensagem:', error.message);
    }
    console.error('--- [FIM DO ERRO] ---');
    res.status(500).json({ success: false, error: error.response?.data || { message: error.message } });
  }
});

// ROTA 2 — Webhook real do Mercado Pago (Segura)
app.post('/mercadopago/webhook', verifyMercadoPagoSignature, async (req, res) => {
  // ... (código da rota permanece o mesmo)
});

// ROTA DE TESTE TEMPORÁRIA
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
    console.error('--- [ERRO DETALHADO NO TEST-WEBHOOK] ---');
    if (error.response) {
      console.error('Status da Resposta:', error.response.status);
      console.error('Dados da Resposta:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Mensagem de Erro Geral:', error.message);
    }
    console.error('--- [FIM DO ERRO DETALHADO] ---');
    res.status(500).json({ success: false, error: error.response?.data || { message: error.message } });
  }
});
// ROTA DE TESTE SIMPLES (GET)
app.get('/health-check', (req, res) => {
  console.log('[INFO] Rota /health-check (GET) foi acionada.');
  res.status(200).send('Servidor está no ar e a rota GET funciona!');
});
// ROTA PARA CRIAÇÃO DO CHECKOUT TRANSPARENTE
app.post('/api/criar-checkout', async (req, res) => {
  console.log('--- REQUISIÇÃO RECEBIDA EM /api/criar-checkout ---');
  try {
    const { sku } = req.body;
    if (!sku) {
      console.error('[ERRO] SKU do produto não foi fornecido na requisição.');
      return res.status(400).json({ error: 'SKU do produto é obrigatório.' });
    }
    console.log(`[INFO] SKU recebido: ${sku}`);

    const produto = produtos[sku];
    if (!produto) {
      console.error(`[ERRO] Produto com SKU '${sku}' não encontrado em nosso catálogo.`);
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }
    console.log(`[INFO] Produto encontrado: ${JSON.stringify(produto)}`);

    const mockPreferenceId = 'ID_DA_PREFERENCIA_SIMULADO_12345';
    console.log(`[SIMULAÇÃO] Gerando ID de preferência: ${mockPreferenceId}`);
    res.status(200).json({ preferenceId: mockPreferenceId, produtoEncontrado: produto });

  } catch (error) {
    console.error('[ERRO] Falha ao processar a criação de checkout:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
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
  } catch (error) {
    console.error('[INIT] FALHA CRÍTICA AO INICIAR.', error.message);
    process.exit(1);
  }
})();


