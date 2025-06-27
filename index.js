// CÓDIGO PARA index.js

require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const app = express();

const blingService = require('./blingService');
const mercadoPagoService = require('./mercadoPagoService');
const freteService = require('./freteService');

const produtos = {
  '+V1': { nome: 'Kit 1 Unidade Mais Vigor', preco: 99.00, peso_kg: 0.5, comprimento_cm: 20, altura_cm: 15, largura_cm: 10 },
  '+V3': { nome: 'Kit 3 Unidades Mais Vigor', preco: 229.00, peso_kg: 1.2, comprimento_cm: 25, altura_cm: 20, largura_cm: 15 },
  '+V5': { nome: 'Kit 5 Unidades Mais Vigor', preco: 349.00, peso_kg: 2.0, comprimento_cm: 30, altura_cm: 25, largura_cm: 20 }
};

app.use(express.json());

// Middlewares e outras rotas inalteradas...
function verifyMercadoPagoSignature(req, res, next) { /* ...código inalterado... */ }
app.post('/mercadopago/webhook', verifyMercadoPagoSignature, async (req, res) => { /* ...código inalterado... */ });


// =================================================================
// ROTA DE CHECKOUT ATUALIZADA PARA CALCULAR FRETE
// =================================================================
app.post('/api/criar-checkout', async (req, res) => {
  console.log('--- REQUISIÇÃO RECEBIDA EM /api/criar-checkout ---');
  try {
    // 1. Recebemos o SKU e agora também o CEP do cliente
    const { sku, cep } = req.body;
    if (!sku || !cep) {
      return res.status(400).json({ error: 'SKU do produto e CEP do cliente são obrigatórios.' });
    }

    const produto = produtos[sku];
    if (!produto) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }
    console.log(`[INFO] Produto: ${produto.nome}, CEP Destino: ${cep}`);

    // 2. Montamos os dados para o cálculo do frete
    const dadosFrete = {
      cepOrigem: "51021-150", // CEP de origem fixo
      cepDestino: cep,
      peso: produto.peso_kg,
      comprimento: produto.comprimento_cm,
      altura: produto.altura_cm,
      largura: produto.largura_cm,
      valor: produto.preco
    };

    // 3. Chamamos o nosso serviço de frete (que ainda está simulado)
    console.log('[INFO] Calculando o frete...');
    const frete = await freteService.calcularFrete(dadosFrete);
    console.log(`[INFO] Frete calculado: R$ ${frete.valor}`);

    // 4. Preparamos a lista de itens para o Mercado Pago
    const itensParaCheckout = [
      { // O produto principal
        title: produto.nome,
        quantity: 1,
        currency_id: 'BRL',
        unit_price: produto.preco
      },
      { // O custo do frete como um item separado
        title: "Frete",
        quantity: 1,
        currency_id: 'BRL',
        unit_price: frete.valor
      }
    ];

    // 5. Criamos a preferência de pagamento com a lista de itens
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

// CÓDIGO PARA SUBSTITUIR O FINAL DO SEU index.js

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // 1. Tenta inicializar os serviços externos PRIMEIRO.
    console.log('[INIT] Tentando inicializar serviço do Bling...');
    await blingService.inicializarServicoBling();
    console.log('[INIT] Serviço do Bling inicializado com sucesso.');
  } catch (error) {
    // Se o Bling falhar, apenas logamos o erro, mas NÃO impedimos o servidor de iniciar.
    console.error('[INIT] FALHA CRÍTICA AO INICIAR O SERVIÇO DO BLING.', error.message);
    console.log('[INIT] O servidor continuará a ser executado em modo degradado (sem integração Bling).');
  }

  // 2. Depois de lidar com os serviços, INICIA o servidor HTTP.
  // Isso garante que o app.listen() sempre será chamado, o que é crucial para o Render.
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[INIT] Servidor HTTP pronto e ouvindo na porta ${PORT}.`);
    console.log(`[INIT] Aplicação disponível publicamente.`);
  });
};

// Inicia todo o processo.
startServer();



