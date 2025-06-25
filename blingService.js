const axios = require('axios');
const qs = require('qs');
const { createClient } = require('redis'); // Importa o cliente Redis
require('dotenv').config();

// Variáveis em memória para acesso rápido
let accessToken = null;
let refreshToken = null;
let expiresAt = null;

// Criação do cliente Redis
// Ele usará a variável de ambiente REDIS_URL automaticamente.
const redisClient = createClient({
  url: process.env.REDIS_URL
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

// A chave que usaremos para guardar os dados no Redis
const TOKEN_KEY = 'bling_tokens';

/**
 * Carrega os tokens do banco de dados Redis.
 */
async function carregarTokensDoRedis() {
  try {
    await redisClient.connect(); // Conecta ao Redis
    const tokenDataString = await redisClient.get(TOKEN_KEY); // Busca os dados
    await redisClient.disconnect(); // Desconecta

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

/**
 * Salva os tokens no banco de dados Redis.
 */
async function salvarTokensNoRedis(tokenData) {
  const expiresInMilliseconds = (tokenData.expires_in * 1000) - 60000;
  const expiresAtCalculated = Date.now() + expiresInMilliseconds;

  const dataToSave = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: expiresAtCalculated
  };

  await redisClient.connect();
  // Salva o objeto como uma string JSON no Redis
  await redisClient.set(TOKEN_KEY, JSON.stringify(dataToSave));
  await redisClient.disconnect();

  console.log('[BLING] Tokens salvos no Redis.');

  accessToken = dataToSave.access_token;
  refreshToken = dataToSave.refresh_token;
  expiresAt = dataToSave.expires_at;
}

/**
 * Renova o access token usando o refresh token.
 */
async function renovarAccessToken() {
  if (!refreshToken) {
    throw new Error('Refresh Token não encontrado. Verifique seu arquivo .env e a variável BLING_REFRESH_TOKEN.');
  }

  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const data = qs.stringify({
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });

  try {
    const response = await axios.post('https://www.bling.com.br/Api/v3/oauth/token', data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`
      }
    });

    // Em vez de salvar em arquivo, agora salvamos no Redis
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

async function criarPedido(dados) {
  const token = await getValidAccessToken();
  const payload = {
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

  const response = await axios.post(
    'https://www.bling.com.br/Api/v3/pedidos/vendas',
    payload, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return response.data;
}

// Renomeamos a função para ser mais clara
async function inicializarServicoBling() {
  await carregarTokensDoRedis();
}

module.exports = {
  inicializarServicoBling,
  getValidAccessToken,
  criarPedido
};













