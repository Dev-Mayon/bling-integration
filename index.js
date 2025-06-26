// CÓDIGO PARA index.js

require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const app = express();

const blingService = require('./blingService');
const mercadoPagoService = require('./mercadoPagoService');
// Ainda não estamos a usar o frete, mas a importação pode ficar aqui
const freteService = require('./freteService');

const produtos = {
  '+V1': { nome: 'Kit 1 Unidade Mais Vigor', preco: 99.00, peso_kg: 0.5, comprimento_cm: 20, altura_cm: 15, largura_cm: 10 },
  '+V3': { nome: 'Kit 3 Unidades Mais Vigor', preco: 229.00, peso_kg: 1.2, comprimento_cm: 25, altura_cm: 20, largura_cm: 15 },
  '+V5': { nome: 'Kit 5 Unidades Mais Vigor', preco: 349.00, peso_kg: 2.0, comprimento_cm: 30, altura_cm: 25, largura_cm: 20 }
};

app.use((req, res, next) => {
  // Para o webhook, precisamos do corpo como texto para a verificação da assinatura
  if (req.path === '/mercadopago/webhook') {
    express.text({ type: 'application/json' })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});

// =================================================================
// MIDDLEWARE DE SEGURANÇA ATUALIZADO
// =================================================================
function verifyMercadoPagoSignature(req, res, next) {
  try {
    const signatureHeader = req.get('x-signature');
    if (!signatureHeader) return res.status(401).send('Assinatura ausente.');

    const parts = signatureHeader.split(',');
    const ts = parts.find(part => part.startsWith('ts='))?.split('=')[1];
    const hash = parts.find(part => part.startsWith('v1='))?.split('=')[1];
    if (!ts || !hash) return res.status(401).send('Formato de assinatura inválido.');

    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[SECURITY] Chave secreta do webhook não configurada.');
      return res.status(500).send('Erro interno do servidor.');
    }

    // CORREÇÃO: Analisamos o corpo uma vez e verificamos se os dados necessários existem
    const reqBody = JSON.parse(req.body);
    const paymentId = reqBody.data?.id;

    if (!paymentId) {
      // Se não houver 'data.id', pode ser uma notificação diferente que não nos interessa.
      // Respondemos com 200 para que o Mercado Pago não envie novamente.
      console.log('[SECURITY] Webhook recebido sem ID de pagamento (provavelmente outro evento). Ignorando.');
      return res.status(200).send('Evento ignorado.');
    }

    const manifest = `id:${paymentId};ts:${ts};`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(manifest);
    const expectedSignature = hmac.digest('hex');

    if (crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(hash))) {
      console.log('[SECURITY] Assinatura do Webhook validada com sucesso.');
      // Passamos o corpo já analisado para a próxima função
      req.body = reqBody;
      next();
    } else {
      console.warn('[SECURITY] FALHA NA VALIDAÇÃO DA ASSINATURA. Requisição bloqueada.');
      res.status(403).send('Assinatura inválida.');
    }
  } catch (error) {
    console.error('[SECURITY] Erro no middleware de verificação:', error.message);
    res.status(500).send('Erro interno ao processar a assinatura.');
  }
}
// =================================================================

app.post('/api/pedido', async (req, res) => { /* ...código inalterado... */ });

// =================================================================
// ROTA DE WEBHOOK ATUALIZADA
// =================================================================
app.post('/mercadopago/webhook', verifyMercadoPagoSignature, async (req, res) => {
  try {
    const eventType = req.body.action; // ex: 'payment.updated'
    const paymentId = req.body.data.id;
    console.log(`[WEBHOOK] Evento recebido: ${eventType} para o pagamento ID: ${paymentId}`);

    // Agora, só processamos se for um evento de pagamento aprovado
    if (eventType === 'payment.updated' || eventType === 'payment.created') {
      console.log('[WEBHOOK] Buscando detalhes do pagamento...');
      const pagamento = await mercadoPagoService.buscarPagamento(paymentId);

      // Verificamos se o status é 'approved'
      if (pagamento.status === 'approved') {
        console.log('[WEBHOOK] Pagamento APROVADO. Criando pedido no Bling...');
        const resultadoBling = await blingService.criarPedido(pagamento);
        console.log('[WEBHOOK] Pedido criado no Bling com sucesso!', resultadoBling);
      } else {
        console.log(`[WEBHOOK] Status do pagamento é '${pagamento.status}'. Nenhuma ação necessária.`);
      }
    }

    res.status(200).send('Webhook processado.');
  } catch (error) {
    console.error('[WEBHOOK] Erro ao processar o webhook:', error.message);
    res.status(500).send('Erro ao processar o webhook.');
  }
});
// =================================================================

app.post('/test-webhook', async (req, res) => { /* ...código inalterado... */ });
app.get('/health-check', (req, res) => { /* ...código inalterado... */ });

app.post('/api/criar-checkout', async (req, res) => {
  try {
    const { sku } = req.body;
    if (!sku) { return res.status(400).json({ error: 'SKU do produto é obrigatório.' }); }
    const produto = produtos[sku];
    if (!produto) { return res.status(404).json({ error: 'Produto não encontrado.' }); }

    console.log('[INFO] Chamando o serviço do Mercado Pago...');
    const preferencia = await mercadoPagoService.criarPreferenciaDePagamento(produto, {});

    res.status(200).json({
      preferenceId: preferencia.id,
      init_point: preferencia.init_point
    });
  } catch (error) {
    console.error('[ERRO] Falha ao criar checkout:', error.message);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

const startServer = async () => { /* ...código inalterado... */ };
startServer();

