// CÓDIGO FINAL E CORRIGIDO PARA index.js

require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const app = express();

const blingService = require('./blingService');
const mercadoPagoService = require('./mercadoPagoService');
const freteService = require('./freteService');

const produtos = {
  // Produtos existentes (Mais Vigor) - Adicionado SKU do Bling para consistência
  '+V1': { nome: 'Kit 1 Unidade Mais Vigor', sku_bling: 'MV01', preco: 99.00, peso_kg: 0.5, comprimento_cm: 20, altura_cm: 15, largura_cm: 10 },
  '+V3': { nome: 'Kit 3 Unidades Mais Vigor', sku_bling: 'MV03', preco: 229.00, peso_kg: 1.2, comprimento_cm: 25, altura_cm: 20, largura_cm: 15 },
  '+V5': { nome: 'Kit 5 Unidades Mais Vigor', sku_bling: 'MV05', preco: 349.00, peso_kg: 2.0, comprimento_cm: 30, altura_cm: 25, largura_cm: 20 },

  // Produtos "Tranquillium"
  '+TQ1': {
    nome: 'Tranquillium 1',
    sku_bling: 'Traq1',
    preco: 88.00,
    peso_kg: 0.166,
    comprimento_cm: 20.00,
    altura_cm: 15.00,
    largura_cm: 10.00
  },
  '+TQ3': {
    nome: 'Tranquillium 3',
    sku_bling: 'Traq3',
    preco: 198.00,
    peso_kg: 0.366,
    comprimento_cm: 25.00,
    altura_cm: 20.00,
    largura_cm: 15.00
  },
  '+TQ5': {
    nome: 'Tranquillium 5',
    sku_bling: 'Traq5',
    preco: 298.00,
    peso_kg: 0.566,
    comprimento_cm: 30.00,
    altura_cm: 25.00,
    largura_cm: 20.00
  }
};

app.use(express.json());
app.use(cors());

// Webhook para receber notificações do Mercado Pago
app.post('/mercadopago/webhook', async (req, res) => {
  console.log('--- WEBHOOK DO MERCADO PAGO RECEBIDO ---');
  const { type, data } = req.body;

  if (type === 'payment') {
    console.log(`[Webhook] Notificação de pagamento recebida. ID: ${data.id}`);
    try {
      const pagamento = await mercadoPagoService.buscarPagamento(data.id);

      if (pagamento && pagamento.status === 'approved') {
        console.log(`[Webhook] PAGAMENTO APROVADO! ID: ${pagamento.id}. Iniciando criação do pedido no Bling...`);
        const pedidoBling = await blingService.criarPedido(pagamento);
        console.log(`[Webhook] Pedido criado no Bling com sucesso! ID do Pedido: ${pedidoBling.data.id}`);
      } else {
        console.log(`[Webhook] Status do pagamento não é 'approved'. Status: '${pagamento?.status}'. Nenhuma ação será tomada.`);
      }
    } catch (error) {
      console.error('[Webhook] Erro ao processar o webhook:', error.message);
    }
  }
  res.status(200).send('Webhook recebido.');
});


// Rota para criar a preferência de pagamento
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
      cepOrigem: "51021-150",
      cepDestino: cep,
      peso: produto.peso_kg,
      comprimento: produto.comprimento_cm,
      altura: produto.altura_cm,
      largura: produto.largura_cm,
      valor: produto.preco
    };

    const frete = await freteService.calcularFrete(dadosFrete);
    console.log(`[INFO] Frete calculado: R$ ${frete.valor}`);

    // ✅ CORREÇÃO FINAL APLICADA AQUI
    const itensParaCheckout = [
      {
        id: produto.sku_bling, // Adicionámos o SKU do Bling como 'id' do item
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


// Inicia o servidor
const PORT = process.env.PORT || 3000;
const startServer = async () => {
  try {
    console.log('[INIT] Tentando inicializar serviço do Bling...');
    await blingService.inicializarServicoBling();
    console.log('[INIT] Serviço do Bling inicializado com sucesso.');
  } catch (error) {
    console.error('[INIT] FALHA CRÍTICA AO INICIAR O SERVIÇO DO BLING.', error.message);
    console.log('[INIT] O servidor continuará a ser executado em modo degradado.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[INIT] Servidor HTTP pronto e ouvindo na porta ${PORT}.`);
  });
};

startServer();


