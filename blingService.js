const axios = require('axios');
const qs = require('qs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const TOKEN_FILE_PATH = path.join(__dirname, 'bling_token.json');

let accessToken = null;
let refreshToken = null;
let expiresAt = null;

async function carregarTokensDoArquivo() {
  try {
    // Tenta ler o arquivo de token que guarda o estado mais recente.
    const data = fs.readFileSync(TOKEN_FILE_PATH, 'utf8');
    const tokenData = JSON.parse(data);

    accessToken = tokenData.access_token;
    refreshToken = tokenData.refresh_token;
    expiresAt = tokenData.expires_at;

    console.log('[BLING] Tokens carregados do arquivo persistente.');
  } catch (error) {
    // Se o arquivo não existe (primeira execução) ou dá erro, usa o .env como ponto de partida.
    console.warn('[BLING] Nenhum token salvo ou erro ao ler arquivo. Usando .env como fallback.');
    refreshToken = process.env.BLING_REFRESH_TOKEN;
  }
}

async function salvarTokensNoArquivo(tokenData) {
  // Calcula o tempo de expiração com uma margem de segurança de 1 minuto.
  const expiresInMilliseconds = (tokenData.expires_in * 1000) - 60000;
  const expiresAtCalculated = Date.now() + expiresInMilliseconds;

  const dataToSave = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: expiresAtCalculated
  };

  // Salva os novos tokens no arquivo para persistência.
  fs.writeFileSync(TOKEN_FILE_PATH, JSON.stringify(dataToSave, null, 2), 'utf8');
  console.log('[BLING] Tokens salvos/atualizados em bling_token.json');

  // Atualiza as variáveis em memória para uso imediato.
  accessToken = dataToSave.access_token;
  refreshToken = dataToSave.refresh_token;
  expiresAt = dataToSave.expires_at;
}

async function renovarAccessToken() {
  // Se em nenhum momento um refresh token foi carregado, o processo não pode continuar.
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

    await salvarTokensNoArquivo(response.data);
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

  // Mapeia os dados recebidos para o formato que a API do Bling espera.
  const payload = {
    data: new Date().toISOString().split('T')[0],
    contato: {
      id: dados.idCliente
    },
    itens: [
      {
        produto: {
          codigo: dados.codigoProduto
        },
        quantidade: dados.quantidade,
        valor: dados.valor
      }
    ],
    observacoes: dados.observacoes || '',
    observacoesInternas: dados.observacoesInternas || ''
  };

  const response = await axios.post(
    'https://www.bling.com.br/Api/v3/pedidos/vendas',
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data;
}

async function inicializarTokens() {
  await carregarTokensDoArquivo();
}

// Exporta TODAS as funções necessárias para o index.js
module.exports = {
  inicializarTokens,
  getValidAccessToken,
  criarPedido
};













