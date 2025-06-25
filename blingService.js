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
    const data = fs.readFileSync(TOKEN_FILE_PATH, 'utf8');
    const tokenData = JSON.parse(data);

    accessToken = tokenData.access_token;
    refreshToken = tokenData.refresh_token;
    expiresAt = tokenData.expires_at;

    if (!refreshToken) {
      console.warn('[BLING] refresh_token ausente no arquivo. Usando .env como fallback.');
      refreshToken = process.env.BLING_REFRESH_TOKEN;
    } else {
      console.log('[BLING] Tokens carregados do arquivo.');
    }

  } catch (error) {
    console.warn('[BLING] Erro ao carregar arquivo. Usando .env como fallback.');
    refreshToken = process.env.BLING_REFRESH_TOKEN;
  }
}

async function salvarTokensNoArquivo(tokenData) {
  const expiresInMilliseconds = (tokenData.expires_in * 1000) - 60000;
  const expiresAtCalculated = Date.now() + expiresInMilliseconds;

  const dataToSave = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: expiresAtCalculated
  };

  fs.writeFileSync(TOKEN_FILE_PATH, JSON.stringify(dataToSave, null, 2), 'utf8');
  console.log('[BLING] Tokens salvos em bling_token.json');

  // Atualiza variáveis em memória
  accessToken = dataToSave.access_token;
  refreshToken = dataToSave.refresh_token;
  expiresAt = dataToSave.expires_at;
}

async function renovarAccessToken() {
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
    console.error('[BLING] Erro ao renovar token:', err.response?.data || err.message);
    throw err;
  }
}

async function getValidAccessToken() {
  if (!accessToken || !expiresAt || Date.now() >= expiresAt) {
    console.log('[BLING] Token expirado ou inexistente. Renovando...');
    await renovarAccessToken();
  }

  return accessToken;
}

async function inicializarTokens() {
  await carregarTokensDoArquivo();
}

module.exports = {
  inicializarTokens,
  getValidAccessToken
};













