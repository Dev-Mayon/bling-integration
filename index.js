// CÓDIGO PARA index.js

require('dotenv').config();

console.log('[DEBUG] Verificando variável BLING_REFRESH_TOKEN:', process.env.BLING_REFRESH_TOKEN ? 'Carregado' : 'NÃO ENCONTRADO');
console.log('[DEBUG] Verificando variável REDIS_URL:', process.env.REDIS_URL ? 'Carregado' : 'NÃO ENCONTRADO');

const express = require('express');
const crypto = require('crypto');
const app = express();

const blingService = require('./blingService');
const mercadoPagoService = require('./mercadoPagoService');

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

app.use((req, res, next) => {
  if (req.path === '/mercadopago/webhook') {
    express.text({ type: 'application/json' })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});

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

app.post('/api/pedido', async (req, res) => {
  try {
    const pedido = req.body;
    const result = await blingService.criarPedido(pedido);
    res.status(201).json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.response?.data || { message: error.message } });
  }
});

app.post('/mercadopago/webhook', verifyMercadoPagoSignature, async (req, res) => {
  console.log('[INFO] Webhook do Mercado Pago recebido e validado.');
  res.status(200).send('Webhook recebido.');
});

app.post('/test-webhook', async (req, res) => {
  try {
    const paymentId = req.body.data?.id;
    if (!paymentId) { return res.status(400).send('payment_id ausente.'); }
    const pagamento = await mercadoPagoService.buscarPagamento(paymentId);
    const result = await blingService.criarPedido(pagamento);
    res.status(200).json({ success: true, message: "Pedido de teste criado no Bling!", data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.response?.data || { message: error.message } });
  }
});

app.get('/health-check', (req, res) => {
  console.log('[INFO] Rota /health-check (GET) foi acionada.');
  res.status(200).send('Servidor está no ar e a rota GET funciona!');
});

app.post('/api/criar-checkout', async (req, res) => {
  console.log('--- REQUISIÇÃO RECEBIDA EM /api/criar-checkout ---');
  try {
    const { sku } = req.body;
    if (!sku) {
      return res.status(400).json({ error: 'SKU do produto é obrigatório.' });
    }
    const produto = produtos[sku];
    if (!produto) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }
    console.log(`[INFO] Produto encontrado: ${JSON.stringify(produto)}`);
    console.log('[INFO] Chamando o serviço do Mercado Pago para criar a preferência...');

    // MODIFICAÇÃO: Capturamos o objeto completo
    const preferencia = await mercadoPagoService.criarPreferenciaDePagamento(produto, {});

    console.log(`[INFO] Preferência recebida do serviço. ID: ${preferencia.id}`);

    // MODIFICAÇÃO: Devolvemos o ID e a URL de checkout (init_point)
    res.status(200).json({
      preferenceId: preferencia.id,
      init_point: preferencia.init_point
    });

  } catch (error) {
    console.error('[ERRO] Falha ao processar a criação de checkout:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

const startServer = async () => {
  try {
    console.log('[INIT] Tentando inicializar serviço do Bling...');
    await blingService.inicializarServicoBling();
    console.log('[INIT] Serviço do Bling inicializado com sucesso.');
  } catch (error) {
    console.error('[INIT] FALHA CRÍTICA AO INICIAR O SERVIÇO DO BLING.', error.message);
    console.log('[INIT] O servidor continuará a ser executado em modo degradado.');
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[INIT] Servidor HTTP pronto e ouvindo na porta ${PORT}.`);
    console.log(`[INIT] Aplicação disponível publicamente.`);
  });
};

startServer();
