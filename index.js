// CÓDIGO FINAL COMPLETO PARA index.js (COM BANCO DE CUPONS E CORREÇÃO DE CORS)

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();

const blingService = require('./blingService');
const mercadoPagoService = require('./mercadoPagoService');
const freteService = require('./freteService');

const produtos = {
    // Produtos "Mais Vigor"
    '+V1': { nome: 'Mais Vigor', sku_bling: '+V1', preco: 99.00, peso_kg: 0.100, comprimento_cm: 6.00, altura_cm: 11.00, largura_cm: 10.00 },
    '+V3': { nome: 'Kit 3 Unidades Mais Vigor', sku_bling: '+V3', preco: 229.00, peso_kg: 0.300, comprimento_cm: 25, altura_cm: 20, largura_cm: 15 },
    '+V5': { nome: 'Kit 5 Unidades Mais Vigor', sku_bling: '+V5', preco: 349.00, peso_kg: 0.500, comprimento_cm: 30, altura_cm: 25, largura_cm: 20 },
    // Produtos "Tranquillium"
    '+TQ1': { nome: 'Tranquillium 1', sku_bling: 'Traq1', preco: 69.00, peso_kg: 0.100, comprimento_cm: 20.00, altura_cm: 15.00, largura_cm: 10.00 },
    '+TQ3': { nome: 'Tranquillium 3', sku_bling: 'Traq3', preco: 159.00, peso_kg: 0.300, comprimento_cm: 25.00, altura_cm: 20.00, largura_cm: 15.00 },
    '+TQ5': { nome: 'Tranquillium 5', sku_bling: 'Traq5', preco: 239.00, peso_kg: 0.500, comprimento_cm: 30.00, altura_cm: 25.00, largura_cm: 20.00 }
};

// --- BANCO DE CUPONS PRÉ-APROVADOS ---
const CUPONS_VALIDOS = {};
// Gerando 20 cupons de R$ 10 de desconto (PROMO1 a PROMO20)
for (let i = 1; i <= 20; i++) {
    CUPONS_VALIDOS[`PROMO${i}`] = { tipo: 'fixo', valor: 10.00 };
}
// Gerando 20 cupons de R$ 20 de desconto (PROMO21 a PROMO40)
for (let i = 21; i <= 40; i++) {
    CUPONS_VALIDOS[`PROMO${i}`] = { tipo: 'fixo', valor: 20.00 };
}

app.use(express.json());

// --- CORREÇÃO DE CORS (MAIS ROBUSTA) ---
const dominiosPermitidos = ['https://www.maisvigor.com.br', 'https://maisvigor.com.br', 'https://www.tranquilium.com.br', 'https://tranquilium.com.br'];

const corsOptions = {
    origin: function (origin, callback) {
        // Se a origem da requisição estiver na nossa lista, ou se for uma requisição sem origem (como do Postman), permite.
        if (!origin || dominiosPermitidos.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.error(`[CORS] Bloqueado: A origem '${origin}' não é permitida.`);
            callback(new Error('Acesso não permitido por CORS'));
        }
    }
};
app.use(cors(corsOptions));


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

// Rota de consulta de frete
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
        if (!produto) {
            return res.status(404).json({ error: 'Produto não encontrado.' });
        }
        const dadosParaCalculo = {
            cepOrigem: process.env.CEP_ORIGEM, cepDestino: cep, peso: produto.peso_kg,
            comprimento: produto.comprimento_cm, altura: produto.altura_cm, largura: produto.largura_cm, valor: produto.preco
        };
        const opcoesDeFrete = await freteService.calcularFrete(dadosParaCalculo);
        if (opcoesDeFrete && opcoesDeFrete.length > 0) {
            res.status(200).json(opcoesDeFrete);
        } else {
            res.status(400).json({ error: 'Não foi possível calcular o frete para este CEP.' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Ocorreu uma falha interna ao calcular o frete.' });
    }
});

// Rota segura para validar cupom
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

    if (!produto) {
        return res.status(404).json({ success: false, mensagem: 'Produto não encontrado.' });
    }
    if (!cupom) {
        return res.status(200).json({ success: false, mensagem: 'Cupom inválido ou expirado.' });
    }

    let desconto = cupom.valor;
    desconto = Math.min(desconto, produto.preco);
    const precoComDesconto = produto.preco - desconto;

    console.log(`[Cupom] Cupom '${codigoCupom}' validado. Desconto: R$ ${desconto.toFixed(2)}. Preço final: R$ ${precoComDesconto.toFixed(2)}`);

    res.status(200).json({
        success: true,
        mensagem: `Cupom aplicado com sucesso!`,
        precoOriginal: produto.preco,
        precoComDesconto: parseFloat(precoComDesconto.toFixed(2)),
        descontoAplicado: parseFloat(desconto.toFixed(2))
    });
});

// Rota para criar o checkout
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
        if (!produto) {
            return res.status(404).json({ error: 'Produto não encontrado.' });
        }

        const precoFinalDoProduto = precoComDesconto ? parseFloat(precoComDesconto) : produto.preco;
        console.log(`[Checkout] Preço final do produto definido como: R$ ${precoFinalDoProduto}`);

        const itensParaCheckout = [
            { id: produto.sku_bling, title: produto.nome, quantity: 1, currency_id: 'BRL', unit_price: precoFinalDoProduto },
            { id: 'frete', title: "Frete", quantity: 1, currency_id: 'BRL', unit_price: parseFloat(valorFrete) }
        ];

        const preferencia = await mercadoPagoService.criarPreferenciaDePagamento(itensParaCheckout);
        res.status(200).json({ preferenceId: preferencia.id, init_point: preferencia.init_point });

    } catch (error) {
        console.error('[ERRO] Falha ao criar checkout:', error.message, error.stack);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});


// --- INICIALIZAÇÃO DO SERVIDOR ---
const PORT = process.env.PORT || 3000;
const startServer = async () => {
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