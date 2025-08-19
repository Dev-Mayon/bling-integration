// blingSeed.js
const axios = require('axios');
const { createClient } = require('redis');

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) throw new Error('REDIS_URL não definido');

const redis = createClient({
    url: REDIS_URL,
    socket: { tls: true }, // Redis Cloud usa TLS
});

const KEYS = {
    access: 'bling:access_token',
    refresh: 'bling:refresh_token',
    expires: 'bling:expires_at',
};

async function connectRedisOnce() {
    if (!redis.isOpen) {
        await redis.connect();
    }
}

async function saveTokens({ access_token, refresh_token, expires_in }) {
    const expiresAt = Math.floor(Date.now() / 1000) + (expires_in || 3600);
    await redis.mSet({
        [KEYS.access]: access_token,
        [KEYS.refresh]: refresh_token,
        [KEYS.expires]: String(expiresAt),
    });
    if (expires_in) {
        await redis.expire(KEYS.access, Math.max(60, expires_in - 60));
    }
    console.log('[BLING] Tokens salvos no Redis.');
}

async function runSeedFromEnv() {
    await connectRedisOnce();

    const clientId = process.env.CLIENT_ID || process.env.CLIENTE_ID || process.env.CLIENTE_ID; // cobre ambos
    const clientSecret = process.env.CLIENT_SECRET;
    const refreshToken = process.env.BLING_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('CLIENT_ID/CLIENT_SECRET/BLING_REFRESH_TOKEN ausentes nas env vars.');
    }

    console.log('[BLING] Gerando novo access_token via refresh_token das env vars...');
    const tokenUrl = 'https://www.bling.com.br/Api/v3/oauth/token';
    const form = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
    });

    const { data } = await axios.post(tokenUrl, form.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 20000,
    });

    const { access_token, refresh_token, expires_in } = data || {};
    if (!access_token) {
        throw new Error('Resposta sem access_token. Verifique se o refresh_token ainda é válido.');
    }

    await saveTokens({
        access_token,
        refresh_token: refresh_token || refreshToken,
        expires_in,
    });

    return { ok: true, saved: ['access_token', 'refresh_token', 'expires_at'] };
}

module.exports = {
    runSeedFromEnv,
    KEYS,
};
