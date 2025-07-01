// CÓDIGO FINAL, COMPLETO E CORRIGIDO PARA index.js

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


// Rota de consulta de frete com correção no tratamento do SKU
app.post('/api/consultar-frete', async (req, res) => {
  console.log('--- REQUISIÇÃO RECEBIDA EM /api/consultar-frete ---');

  try {
    let { sku, cep } = req.body; // Usamos 'let' para poder modificar o SKU

    // ===== PONTO CRÍTICO DA CORREÇÃO =====
    // Limpamos e normalizamos o SKU para garantir que ele seja encontrado.
    if (sku) {
      sku = sku.trim().toUpperCase(); // Remove espaços e converte para maiúsculas (ex: " v1" -> "V1")
      if (!sku.startsWith('+')) {
        sku = '+' + sku; // Adiciona o "+" se estiver faltando (ex: "V1" -> "+V1")
      }
    }
    // =======================================

    if (!sku || !cep || !/^\d{8}$/.test(cep)) {
      console.error('[API Frete] Erro: SKU ou CEP inválido na requisição.', { sku, cep });
      return res.status(400).json({ error: 'SKU e um CEP válido (8 dígitos) são obrigatórios.' });
    }

    const produto = produtos[sku];
    if (!produto) {
      console.error(`[API Frete] Erro: Produto com SKU '${sku}' não foi encontrado APÓS A LIMPEZA.`);
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    const dadosParaCalculo = {
      cepOrigem: process.env.CEP_ORIGEM,
      cepDestino: cep,
      peso: produto.peso_kg,
      comprimento: produto.comprimento_cm,
      altura: produto.altura_cm,
      largura: produto.largura_cm,
      valor: produto.preco
    };

    console.log('[API Frete] Chamando o serviço de frete com os dados:', dadosParaCalculo);
    const opcoesDeFrete = await freteService.calcularFrete(dadosParaCalculo);

    if (opcoesDeFrete && opcoesDeFrete.length > 0) {
      console.log(`[API Frete] SUCESSO: ${opcoesDeFrete.length} opções de frete encontradas para o CEP ${cep}.`);
      res.status(200).json(opcoesDeFrete);
    } else {
      console.warn(`[API Frete] AVISO: Nenhuma opção de frete encontrada para o CEP ${cep}.`);
      res.status(400).json({ error: 'Não foi possível calcular o frete para este CEP. Verifique se o CEP está correto e tente novamente.' });
    }

  } catch (error) {
    console.error('[API Frete] ERRO CRÍTICO: Falha inesperada ao consultar frete:', error.message, error.stack);
    res.status(500).json({ error: 'Ocorreu uma falha interna ao calcular o frete.' });
  }
});

// Rota para criar a preferência de pagamento (sem alterações)
app.post('/api/criar-checkout', async (req, res) => {
  console.log('--- REQUISIÇÃO RECEBIDA EM /api/criar-checkout ---');
  try {
    const { sku, cep, valorFrete } = req.body;
    if (!sku || !cep) {
      return res.status(400).json({ error: 'SKU do produto e CEP do cliente são obrigatórios.' });
    }
    const produto = produtos[sku];
    if (!produto) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }
    console.log(`[INFO] Produto: ${produto.nome}, CEP Destino: ${cep}`);
    let freteFinal;
    if (valorFrete) {
      freteFinal = { valor: parseFloat(valorFrete) };
      console.log(`[INFO] Usando valor de frete pré-selecionado: R$ ${freteFinal.valor}`);
    } else {
      const opcoesDeFrete = await freteService.calcularFrete({
        cepOrigem: process.env.CEP_ORIGEM, cepDestino: cep, peso: produto.peso_kg,
        comprimento: produto.comprimento_cm, altura: produto.altura_cm, largura: produto.largura_cm, valor: produto.preco
      });
      freteFinal = opcoesDeFrete[0];
      console.log(`[INFO] Frete calculado na hora: R$ ${freteFinal.valor}`);
    }
    const itensParaCheckout = [
      { id: produto.sku_bling, title: produto.nome, quantity: 1, currency_id: 'BRL', unit_price: produto.preco },
      { id: 'frete', title: "Frete", quantity: 1, currency_id: 'BRL', unit_price: freteFinal.valor }
    ];
    const preferencia = await mercadoPagoService.criarPreferenciaDePagamento(itensParaCheckout);
    res.status(200).json({ preferenceId: preferencia.id, init_point: preferencia.init_point });
  } catch (error) {
    console.error('[ERRO] Falha ao processar a criação de checkout:', error.message);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

// Inicia o servidor (sem alterações)
const PORT = process.env.PORT || 3000;
const startServer = async () => {
  try {
    console.log('[INIT] Tentando inicializar serviço do Bling...');
    await blingService.inicializarServicoBling();
    console.log('[INIT] Serviço do Bling inicializado com sucesso.');
  } catch (error) {
    console.error('[INIT] FALHA CRÍTICA AO INICIAR O SERVIÇO DO BLING.', error.message);
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[INIT] Servidor HTTP pronto e ouvindo na porta ${PORT}.`);
    if (!process.env.CEP_ORIGEM) {
      console.warn("[INIT] AVISO: A variável de ambiente CEP_ORIGEM não está configurada.");
    }
  });
};
startServer();



