// blingSeed.js
const axios = require('axios');
const { createClient } = require('redis');

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) throw new Error('REDIS_URL não definido');

const redis = createClient({
    url: REDIS_URL,
    socket: { tls: true },
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

    // aceita CLIENT_ID ou CLIENTE_ID (vi ambas nas suas envs)
    const clientId = process.env.CLIENT_ID || process.env.CLIENTE_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const refreshToken = process.env.BLING_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('CLIENT_ID/CLIENTE_ID, CLIENT_SECRET ou BLING_REFRESH_TOKEN ausentes nas env vars.');
    }

    console.log('[BLING] Gerando novo access_token via refresh_token das env vars...');
    const tokenUrl = 'https://www.bling.com.br/Api/v3/oauth/token';
    const form = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
    });

    try {
        const { data } = await axios.post(tokenUrl, form.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 20000,
        });

        const { access_token, refresh_token, expires_in } = data || {};
        if (!access_token) {
            throw new Error('Resposta sem access_token. Verifique refresh_token.');
        }

        await saveTokens({
            access_token,
            refresh_token: refresh_token || refreshToken,
            expires_in,
        });

        return { ok: true, provider: 'bling', saved: ['access_token', 'refresh_token', 'expires_at'] };
    } catch (err) {
        // LOG detalhado
        const status = err.response?.status;
        const body = err.response?.data;
        console.error('[SEED][BLING] Falha ao trocar refresh_token', {
            status, body, message: err.message,
        });
        // Propaga para a rota devolver o detalhe
        throw new Error(`Bling token error (status ${status}): ${JSON.stringify(body)}`);
    }
}

module.exports = {
    runSeedFromEnv,
    KEYS,
};

