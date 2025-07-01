// CÓDIGO DEFINITIVO E CORRIGIDO PARA index.js

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

app.use(express.json());

const dominiosPermitidos = ['https://www.maisvigor.com.br', 'https://www.tranquilium.com.br'];
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || dominiosPermitidos.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Acesso não permitido por CORS'));
    }
  }
};
app.use(cors(corsOptions));

// Webhook do Mercado Pago (sem alterações)
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


// Rota de consulta de frete (correta, sem alterações)
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

// Rota para criar a preferência de pagamento (COM A CORREÇÃO)
app.post('/api/criar-checkout', async (req, res) => {
  console.log('--- REQUISIÇÃO RECEBIDA EM /api/criar-checkout ---');
  try {
    let { sku, cep, valorFrete } = req.body; // Usamos 'let' para poder modificar

    // ===== PONTO CRÍTICO DA CORREÇÃO FINAL =====
    // Aplicamos a mesma limpeza de SKU que fizemos na outra rota.
    if (sku) {
      sku = sku.trim().toUpperCase();
      if (!sku.startsWith('+')) {
        sku = '+' + sku;
      }
    }
    // ===========================================

    if (!sku || !cep) {
      console.error('[API Checkout] Erro: SKU ou CEP não fornecidos.', req.body);
      return res.status(400).json({ error: 'SKU do produto e CEP do cliente são obrigatórios.' });
    }

    const produto = produtos[sku];
    if (!produto) {
      console.error(`[API Checkout] Erro: Produto com SKU '${sku}' não encontrado APÓS A LIMPEZA.`);
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    console.log(`[INFO] Produto: ${produto.nome}, CEP Destino: ${cep}`);

    // A lógica de frete permanece a mesma
    let freteFinal;
    if (valorFrete) {
      freteFinal = { valor: parseFloat(valorFrete) };
      console.log(`[INFO] Usando valor de frete pré-selecionado: R$ ${freteFinal.valor}`);
    } else {
      // Fallback caso o valor do frete não venha
      const opcoesDeFrete = await freteService.calcularFrete({
        cepOrigem: process.env.CEP_ORIGEM, cepDestino: cep, peso: produto.peso_kg,
        comprimento: produto.comprimento_cm, altura: produto.altura_cm, largura: produto.largura_cm, valor: produto.preco
      });
      freteFinal = opcoesDeFrete[0];
      console.log(`[INFO] Frete calculado na hora (fallback): R$ ${freteFinal.valor}`);
    }

    const itensParaCheckout = [
      { id: produto.sku_bling, title: produto.nome, quantity: 1, currency_id: 'BRL', unit_price: produto.preco },
      { id: 'frete', title: "Frete", quantity: 1, currency_id: 'BRL', unit_price: freteFinal.valor }
    ];

    const preferencia = await mercadoPagoService.criarPreferenciaDePagamento(itensParaCheckout);
    res.status(200).json({ preferenceId: preferencia.id, init_point: preferencia.init_point });

  } catch (error) {
    console.error('[ERRO] Falha ao processar a criação de checkout:', error.message, error.stack);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});


// Inicia o servidor (sem alterações)
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


