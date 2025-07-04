const axios = require('axios');
const qs = require('qs');
const { createClient } = require('redis');
require('dotenv').config();

const redisClient = createClient({
  url: process.env.REDIS_URL
});
redisClient.on('error', (err) => console.log('Redis Client Error', err));

const TOKEN_KEY = 'bling_tokens';
let accessToken = null;
let refreshToken = null;
let expiresAt = null;

// ... (as funções carregarTokensDoRedis, salvarTokensNoRedis, renovarAccessToken e getValidAccessToken permanecem as mesmas)

async function carregarTokensDoRedis() {
  try {
    await redisClient.connect();
    const tokenDataString = await redisClient.get(TOKEN_KEY);
    await redisClient.disconnect();
    if (tokenDataString) {
      const tokenData = JSON.parse(tokenDataString);
      accessToken = tokenData.access_token;
      refreshToken = tokenData.refresh_token;
      expiresAt = tokenData.expires_at;
      console.log('[BLING] Tokens carregados do Redis com sucesso.');
    } else {
        throw new Error('Nenhum token encontrado no Redis.');
    }
  } catch (error) {
    console.warn(`[BLING] ${error.message}. Usando .env como fallback.`);
    refreshToken = process.env.BLING_REFRESH_TOKEN;
  }
}

async function salvarTokensNoRedis(tokenData) {
  const expiresInMilliseconds = (tokenData.expires_in * 1000) - 60000;
  const expiresAtCalculated = Date.now() + expiresInMilliseconds;
  const dataToSave = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: expiresAtCalculated
  };
  await redisClient.connect();
  await redisClient.set(TOKEN_KEY, JSON.stringify(dataToSave));
  await redisClient.disconnect();
  console.log('[BLING] Tokens salvos no Redis.');
  accessToken = dataToSave.access_token;
  refreshToken = dataToSave.refresh_token;
  expiresAt = dataToSave.expires_at;
}

async function renovarAccessToken() {
  if (!refreshToken) { throw new Error('Refresh Token não encontrado.'); }
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const data = qs.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken });
  try {
    const response = await axios.post('https://www.bling.com.br/Api/v3/oauth/token', data, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${basicAuth}` }
    });
    await salvarTokensNoRedis(response.data);
  } catch (err) {
    console.error('[BLING] Erro CRÍTICO ao renovar token:', err.response?.data || err.message);
    throw err;
  }
}

async function getValidAccessToken() {
  if (!accessToken || !expiresAt || Date.now() >= expiresAt) {
    console.log('[BLING] Token expirado ou inexistente. Tentando renovar...');
    await renovarAccessToken();
  }
  return accessToken;
}

function mapearPagamentoParaPedido(pagamentoMP) {
    const primeiroItem = pagamentoMP.additional_info?.items?.[0];
    const codigoProduto = primeiroItem?.id || process.env.PRODUTO_CODIGO_PADRAO || 'default-sku';
    const quantidade = primeiroItem?.quantity || 1;
    return {
        idCliente: process.env.CLIENTE_ID,
        codigoProduto: codigoProduto,
        quantidade: quantidade,
        valor: pagamentoMP.transaction_amount,
        observacoes: `Pedido referente ao pagamento #${pagamentoMP.id} do Mercado Pago. Comprador: ${pagamentoMP.payer?.first_name || ''} ${pagamentoMP.payer?.last_name || ''}.`,
        observacoesInternas: `MP Payment ID: ${pagamentoMP.id}`
    };
}


// ==============================================================================
//  ✅ FUNÇÃO criarPedido CORRIGIDA
// ==============================================================================
async function criarPedido(dados) {
  const token = await getValidAccessToken();
  
  let dadosDoPedido;

  // Verifica se os dados recebidos são de um pagamento do Mercado Pago
  if (dados && dados.transaction_amount) {
    console.log('[BLING Service] Recebido objeto do Mercado Pago. Mapeando para pedido...');
    dadosDoPedido = mapearPagamentoParaPedido(dados);
  } else {
    // Se não for do MP, assume que é um pedido simples (dos nossos testes do Postman)
    console.log('[BLING Service] Recebido pedido simples...');
    dadosDoPedido = dados;
  }

  // Monta o payload final para o Bling USANDO os dados processados
  const payloadFinal = {
    data: new Date().toISOString().split('T')[0],
    contato: {
      id: dadosDoPedido.idCliente
    },
    itens: [{
      produto: {
        codigo: dadosDoPedido.codigoProduto
      },
      quantidade: dadosDoPedido.quantidade,
      valor: dadosDoPedido.valor
    }],
    observacoes: dadosDoPedido.observacoes || '',
    observacoesInternas: dadosDoPedido.observacoesInternas || ''
  };

  const response = await axios.post(
    'https://www.bling.com.br/Api/v3/pedidos/vendas',
    payloadFinal, // Envia o payload final e completo
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return response.data;
}


async function inicializarServicoBling() {
  await carregarTokensDoRedis();
}

module.exports = {
  inicializarServicoBling,
  getValidAccessToken,
  criarPedido
};













