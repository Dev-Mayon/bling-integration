// CÓDIGO ATUALIZADO PARA index.js

require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const cors = require('cors'); // <-- 1. IMPORTAMOS A BIBLIOTECA CORS
const app = express();

const blingService = require('./blingService');
const mercadoPagoService = require('./mercadoPagoService');
const freteService = require('./freteService');

const produtos = {
  '+V1': { nome: 'Kit 1 Unidade Mais Vigor', preco: 99.00, peso_kg: 0.5, comprimento_cm: 20, altura_cm: 15, largura_cm: 10 },
  '+V3': { nome: 'Kit 3 Unidades Mais Vigor', preco: 229.00, peso_kg: 1.2, comprimento_cm: 25, altura_cm: 20, largura_cm: 15 },
  '+V5': { nome: 'Kit 5 Unidades Mais Vigor', preco: 349.00, peso_kg: 2.0, comprimento_cm: 30, altura_cm: 25, largura_cm: 20 },
  // ==============================================================================
  // ✅ PRODUTOS "TRANQUILLIUM" COM MEDIDAS ATUALIZADAS
  // ==============================================================================
  '+TQ1': {
    nome: 'Tranquillium 1',
    sku_bling: 'Traq1', // SKU real do Bling
    preco: 88.00,
    peso_kg: 0.166, // Usando o peso bruto
    comprimento_cm: 20.00, // Profundidade do Bling
    altura_cm: 15.00,
    largura_cm: 10.00
  },
  '+TQ3': {
    nome: 'Tranquillium 3',
    sku_bling: 'Traq3', // SKU real do Bling
    preco: 198.00,
    peso_kg: 0.366, // Usando o peso bruto
    comprimento_cm: 25.00, // Profundidade do Bling
    altura_cm: 20.00,
    largura_cm: 15.00
  },
  '+TQ5': {
    nome: 'Tranquillium 5',
    sku_bling: 'Traq5', // SKU real do Bling
    preco: 298.00,
    peso_kg: 0.566, // Usando o peso bruto
    comprimento_cm: 30.00, // Profundidade do Bling
    altura_cm: 25.00,
    largura_cm: 20.00
  }
};

app.use(express.json());
app.use(cors()); // <-- 2. HABILITAMOS O CORS PARA TODAS AS ROTAS

// Middlewares e outras rotas inalteradas...
function verifyMercadoPagoSignature(req, res, next) { /* ...código inalterado... */ }
app.post('/mercadopago/webhook', verifyMercadoPagoSignature, async (req, res) => { /* ...código inalterado... */ });


// =================================================================
// ROTA DE CHECKOUT (NÃO PRECISA DE ALTERAÇÃO)
// =================================================================
app.post('/api/criar-checkout', async (req, res) => {
  console.log('--- REQUISIÇÃO RECEBIDA EM /api/criar-checkout ---');
  try {
    const { sku, cep } = req.body;
    if (!sku || !cep) {
      return res.status(400).json({ error: 'SKU do produto e CEP do cliente são obrigatórios.' });
    }

    const produto = produtos[sku];
    if (!produto) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }
    console.log(`[INFO] Produto: ${produto.nome}, CEP Destino: ${cep}`);

    const dadosFrete = {
      cepOrigem: "51021-150", // CEP de origem fixo
      cepDestino: cep,
      peso: produto.peso_kg,
      comprimento: produto.comprimento_cm,
      altura: produto.altura_cm,
      largura: produto.largura_cm,
      valor: produto.preco
    };

    console.log('[INFO] Calculando o frete...');
    const frete = await freteService.calcularFrete(dadosFrete);
    console.log(`[INFO] Frete calculado: R$ ${frete.valor}`);

    const itensParaCheckout = [
      {
        title: produto.nome,
        quantity: 1,
        currency_id: 'BRL',
        unit_price: produto.preco
      },
      {
        title: "Frete",
        quantity: 1,
        currency_id: 'BRL',
        unit_price: frete.valor
      }
    ];

    console.log('[INFO] Chamando o serviço do Mercado Pago com produto + frete...');
    const preferencia = await mercadoPagoService.criarPreferenciaDePagamento(itensParaCheckout);

    res.status(200).json({
      preferenceId: preferencia.id,
      init_point: preferencia.init_point
    });

  } catch (error) {
    console.error('[ERRO] Falha ao processar a criação de checkout:', error.message);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// O resto do código permanece o mesmo...

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    console.log('[INIT] Tentando inicializar serviço do Bling...');
    await blingService.inicializarServicoBling();
    console.log('[INIT] Serviço do Bling inicializado com sucesso.');
  } catch (error) {
    console.error('[INIT] FALHA CRÍTICA AO INICIAR O SERVIÇO DO BLING.', error.message);
    console.log('[INIT] O servidor continuará a ser executado em modo degradado (sem integração Bling).');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[INIT] Servidor HTTP pronto e ouvindo na porta ${PORT}.`);
    console.log(`[INIT] Aplicação disponível publicamente.`);
  });
};

startServer();


