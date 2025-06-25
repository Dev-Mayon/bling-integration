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
  if (!refreshToken) {
    throw new Error('Refresh Token não encontrado.');
  }
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const data = qs.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken });
  try {
    const response = await axios.post('https://www.bling.com.br/Api/v3/oauth/token', data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`
      }
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

// ==============================================================================
//  NOVA FUNÇÃO: O Tradutor
// ==============================================================================
/**
 * Mapeia um objeto de pagamento do Mercado Pago para o formato de pedido do Bling.
 * @param {object} pagamentoMP O objeto de pagamento retornado pela API do Mercado Pago.
 * @returns {object} Um objeto formatado para a API de pedidos do Bling.
 */
function mapearPagamentoParaPedido(pagamentoMP) {
    // Pega o primeiro item do carrinho como exemplo.
    // Em um caso real, você poderia iterar por todos os itens.
    const primeiroItem = pagamentoMP.additional_info.items[0];

    return {
        // Usa o ID de cliente padrão definido no .env
        idCliente: process.env.CLIENTE_ID,
        // Usa o código do produto do item do Mercado Pago
        codigoProduto: primeiroItem.id,
        // Usa a quantidade do item
        quantidade: primeiroItem.quantity,
        // Usa o valor total da transação
        valor: pagamentoMP.transaction_amount,
        // Observações para o cliente
        observacoes: `Pedido referente ao pagamento #${pagamentoMP.id} do Mercado Pago. Comprador: ${pagamentoMP.payer.first_name} ${pagamentoMP.payer.last_name}.`,
        // Observações internas para sua equipe
        observacoesInternas: `MP Payment ID: ${pagamentoMP.id}`
    };
}


/**
 * Função criarPedido atualizada para ser mais inteligente.
 * @param {object} dados Os dados brutos, que podem ser um pedido simples ou um pagamento do MP.
 */
async function criarPedido(dados) {
  const token = await getValidAccessToken();

  let payload;

  // Verifica se os dados recebidos são de um pagamento do Mercado Pago
  // (procurando por uma propriedade que só existe no objeto do MP, como `transaction_amount`)
  if (dados.transaction_amount) {
    console.log('[BLING Service] Recebido objeto do Mercado Pago. Mapeando para pedido do Bling...');
    payload = mapearPagamentoParaPedido(dados);
  } else {
    // Se não for do MP, assume que é um pedido simples (dos nossos testes do Postman)
    console.log('[BLING Service] Recebido pedido simples. Montando payload...');
    payload = {
      data: new Date().toISOString().split('T')[0],
      contato: { id: dados.idCliente },
      itens: [{
          produto: { codigo: dados.codigoProduto },
          quantidade: dados.quantidade,
          valor: dados.valor
      }],
      observacoes: dados.observacoes || '',
      observacoesInternas: dados.observacoesInternas || ''
    };
  }

  const response = await axios.post(
    'https://www.bling.com.br/Api/v3/pedidos/vendas',
    payload, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
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













