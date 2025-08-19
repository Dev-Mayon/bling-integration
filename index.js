// CÓDIGO FINAL E DEFINITIVO - index.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();

const blingService = require('./blingService');
const mercadoPagoService = require('./mercadoPagoService');
const freteService = require('./freteService');
const { runSeedFromEnv } = require('./blingSeed');

// === Redis (autodetecta TLS pelo esquema da URL) ===
const { createClient } = require('redis');
const REDIS_URL = process.env.REDIS_URL || '';
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

const useTls = REDIS_URL.startsWith('rediss://'); // TLS só se a URL pedir
const redis = createClient({
    url: REDIS_URL,
    socket: { tls: useTls },
});

async function connectRedisOnce() {
    if (!REDIS_URL) {
        console.warn('[REDIS] REDIS_URL não definido; usando .env como fallback quando aplicável.');
        return;
    }
    if (!redis.isOpen) {
        try {
            console.log(`[REDIS] Conectando: ${REDIS_URL} | TLS=${useTls}`);
            await redis.connect();
            console.log('[REDIS] Conectado.');
        } catch (e) {
            console.error('[REDIS] Falha ao conectar:', e?.code || e?.message, e);
            throw e;
        }
    }
}

const KEYS = {
    access: 'bling:access_token',
    refresh: 'bling:refresh_token',
    expires: 'bling:expires_at',
};

// --- CONFIGURAÇÃO INICIAL ---
app.use(express.json());
app.use(cors());

// Log de todas as requisições
app.use((req, _res, next) => {
    console.log(`[LOG REQUISIÇÃO] Método: ${req.method}, URL: ${req.originalUrl}, Origem: ${req.headers.origin}`);
    next();
});

// Raiz e health
app.get('/', (_req, res) => res.send('OK'));
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// --- DADOS DE PRODUTOS E CUPONS ---
const produtos = {
    '+V1': { nome: 'Mais Vigor', sku_bling: '+V1', preco: 99.00, peso_kg: 0.100, comprimento_cm: 6.00, altura_cm: 11.00, largura_cm: 10.00 },
    '+V3': { nome: 'Kit 3 Unidades Mais Vigor', sku_bling: '+V3', preco: 229.00, peso_kg: 0.300, comprimento_cm: 25, altura_cm: 20, largura_cm: 15 },
    '+V5': { nome: 'Kit 5 Unidades Mais Vigor', sku_bling: '+V5', preco: 349.00, peso_kg: 0.500, comprimento_cm: 30.00, altura_cm: 25.00, largura_cm: 20.00 },
    '+TQ1': { nome: 'Tranquillium 1', sku_bling: 'Traq1', preco: 69.00, peso_kg: 0.100, comprimento_cm: 20.00, altura_cm: 15.00, largura_cm: 10.00 },
    '+TQ3': { nome: 'Tranquillium 3', sku_bling: 'Traq3', preco: 159.00, peso_kg: 0.300, comprimento_cm: 25.00, altura_cm: 20.00, largura_cm: 15.00 },
    '+TQ5': { nome: 'Tranquillium 5', sku_bling: 'Traq5', preco: 239.00, peso_kg: 0.500, comprimento_cm: 30.00, altura_cm: 25.00, largura_cm: 20.00 },
};
const CUPONS_VALIDOS = {};
for (let i = 1; i <= 20; i++) { CUPONS_VALIDOS[`PROMO${i}`] = { tipo: 'fixo', valor: 10.00 }; }
for (let i = 21; i <= 40; i++) { CUPONS_VALIDOS[`PROMO${i}`] = { tipo: 'fixo', valor: 20.00 }; }

// --- ROTAS DA API ---

// Webhook do Mercado Pago
app.post('/mercadopago/webhook', async (req, res) => {
    console.log('--- WEBHOOK DO MERCADO PAGO RECEBIDO ---');
    const { type, data } = req.body;
    if (type === 'payment') {
        try {
            const pagamento = await mercadoPagoService.buscarPagamento(data.id);
            if (pagamento && pagamento.status === 'approved') {
                await blingService.criarPedido(pagamento);
            }
        } catch (error) {
            console.error('[Webhook] Erro ao processar o webhook:', error.message);
        }
    }
    res.status(200).send('Webhook recebido.');
});

// Consulta frete
app.post('/api/consultar-frete', async (req, res) => {
    console.log('--- REQUISIÇÃO RECEBIDA EM /api/consultar-frete ---');
    try {
        let { sku, cep } = req.body;
        if (sku) {
            sku = sku.trim().toUpperCase();
            if (!sku.startsWith('+')) { sku = '+' + sku; }
        }
        if (!sku || !cep || !/^\d{8}$/.test(cep)) {
            return res.status(400).json({ error: 'SKU e um CEP válido (8 dígitos) são obrigatórios.' });
        }
        const produto = produtos[sku];
        if (!produto) return res.status(404).json({ error: 'Produto não encontrado.' });

        const dadosParaCalculo = {
            cepOrigem: process.env.CEP_ORIGEM,
            cepDestino: cep,
            peso: produto.peso_kg,
            comprimento: produto.comprimento_cm,
            altura: produto.altura_cm,
            largura: produto.largura_cm,
            valor: produto.preco,
        };
        const opcoesDeFrete = await freteService.calcularFrete(dadosParaCalculo);
        if (opcoesDeFrete && opcoesDeFrete.length > 0) {
            res.status(200).json(opcoesDeFrete);
        } else {
            res.status(400).json({ error: 'Não foi possível calcular o frete para este CEP.' });
        }
    } catch (error) {
        console.error('[ERRO] Falha ao consultar frete:', error.message, error.stack);
        res.status(500).json({ error: 'Ocorreu uma falha interna ao calcular o frete.' });
    }
});

// Validar cupom
app.post('/api/validar-cupom', (req, res) => {
    console.log('--- REQUISIÇÃO RECEBIDA EM /api/validar-cupom ---');
    let { sku, codigoCupom } = req.body;
    if (!sku || !codigoCupom) {
        return res.status(400).json({ success: false, mensagem: 'SKU do produto e código do cupom são obrigatórios.' });
    }
    if (sku) {
        sku = sku.trim().toUpperCase();
        if (!sku.startsWith('+')) { sku = '+' + sku; }
    }
    codigoCupom = codigoCupom.trim().toUpperCase();
    const produto = produtos[sku];
    const cupom = CUPONS_VALIDOS[codigoCupom];
    if (!produto) return res.status(404).json({ success: false, mensagem: 'Produto não encontrado.' });
    if (!cupom) {
        return res.status(200).json({ success: false, mensagem: 'Cupom inválido ou expirado.' });
    }
    let desconto = Math.min(cupom.valor, produto.preco);
    const precoComDesconto = produto.preco - desconto;
    res.status(200).json({
        success: true,
        mensagem: 'Cupom aplicado com sucesso!',
        precoOriginal: produto.preco,
        precoComDesconto: parseFloat(precoComDesconto.toFixed(2)),
        descontoAplicado: parseFloat(desconto.toFixed(2)),
    });
});

// Criar checkout
app.post('/api/criar-checkout', async (req, res) => {
    console.log('--- REQUISIÇÃO RECEBIDA EM /api/criar-checkout ---');
    try {
        let { sku, cep, valorFrete, precoComDesconto } = req.body;
        if (sku) {
            sku = sku.trim().toUpperCase();
            if (!sku.startsWith('+')) { sku = '+' + sku; }
        }
        if (!sku || !cep || !valorFrete) {
            return res.status(400).json({ error: 'SKU, CEP e valor do frete são obrigatórios.' });
        }
        const produto = produtos[sku];
        if (!produto) return res.status(404).json({ error: 'Produto não encontrado.' });

        const precoFinalDoProduto = precoComDesconto ? parseFloat(precoComDesconto) : produto.preco;
        const itensParaCheckout = [
            { id: produto.sku_bling, title: produto.nome, quantity: 1, currency_id: 'BRL', unit_price: precoFinalDoProduto },
            { id: 'frete', title: 'Frete', quantity: 1, currency_id: 'BRL', unit_price: parseFloat(valorFrete) },
        ];
        const preferencia = await mercadoPagoService.criarPreferenciaDePagamento(itensParaCheckout);
        res.status(200).json({ preferenceId: preferencia.id, init_point: preferencia.init_point });
    } catch (error) {
        console.error('[ERRO] Falha ao criar checkout:', error.message, error.stack);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

// --- 🔐 ROTA TEMPORÁRIA: semear tokens a partir das ENVs ---
app.post('/admin/seed-bling-from-env', async (req, res) => {
    try {
        const secret = req.headers['x-admin-secret'];
        if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
            return res.status(401).json({ error: 'unauthorized' });
        }
        const result = await runSeedFromEnv();
        res.json({ ok: true, result });
    } catch (e) {
        console.error('[SEED] Erro:', e);
        res.status(500).json({ error: e.message });
    }
});

// --- 🔐 ROTA ADMIN: grava tokens recebidos no Redis ---
app.post('/admin/push-bling-tokens', async (req, res) => {
    try {
        const secret = req.headers['x-admin-secret'];
        if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
            return res.status(401).json({ ok: false, error: 'unauthorized' });
        }

        const { access_token, refresh_token, expires_in } = req.body || {};
        const exp = Number(expires_in);
        if (!access_token || !refresh_token || !Number.isFinite(exp) || exp <= 0) {
            return res.status(400).json({ ok: false, error: 'invalid_body' });
        }

        const now = Math.floor(Date.now() / 1000);
        const expiresAt = now + exp;

        await connectRedisOnce();
        await redis.mSet({
            [KEYS.access]: access_token,
            [KEYS.refresh]: refresh_token,
            [KEYS.expires]: String(expiresAt),
        });
        // TTL do access_token com respiro de 60s para renovar antes do fim
        await redis.expire(KEYS.access, Math.max(60, exp - 60));

        console.log('[ADMIN] Tokens do Bling gravados no Redis.');
        return res.json({ ok: true, saved: [KEYS.access, KEYS.refresh, KEYS.expires] });
    } catch (e) {
        console.error('[admin/push-bling-tokens] erro', e);
        return res.status(500).json({ ok: false, error: 'internal' });
    }
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
const PORT = process.env.PORT || 3000;
const startServer = async () => {
    try {
        await connectRedisOnce(); // conecta já na subida
    } catch (e) {
        // segue vivo, mas rotas que usam Redis podem falhar até conectar
    }
    try {
        await blingService.inicializarServicoBling();
    } catch (error) {
        console.error('[INIT] FALHA CRÍTICA AO INICIAR O SERVIÇO DO BLING.', error.message);
    }
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`[INIT] Servidor HTTP pronto e ouvindo na porta ${PORT}.`);
    });
};

startServer();


