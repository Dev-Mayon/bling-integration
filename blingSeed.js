// blingSeed.js
// Semear tokens do Bling no Redis usando o BLING_REFRESH_TOKEN das envs

const https = require('https');
const { createClient } = require('redis');

// === Redis Client (Redis Cloud usa TLS) ===
const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) throw new Error('REDIS_URL não definido');

const redis = createClient({
    url: REDIS_URL,
    socket: { tls: true },
});

// === Chaves usadas no Redis ===
const KEYS = {
    access: 'bling:access_token',
    refresh: 'bling:refresh_token',
    expires: 'bling:expires_at',
};

// Conecta apenas 1x
async function connectRedisOnce() {
    if (!redis.isOpen) {
        await redis.connect();
    }
}

// Salva tokens e TTL do access_token
async function saveTokens({ access_token, refresh_token, expires_in }) {
    const expiresAt = Math.floor(Date.now() / 1000) + (expires_in || 3600);

    await redis.mSet({
        [KEYS.access]: access_token,
        [KEYS.refresh]: refresh_token,
        [KEYS.expires]: String(expiresAt),
    });

    if (expires_in) {
        // garante que o access_token expira pouco antes do tempo real
        await redis.expire(KEYS.access, Math.max(60, expires_in - 60));
    }

    console.log('[BLING] Tokens salvos no Redis.');
}

// === Seed a partir das variáveis de ambiente ===
async function runSeedFromEnv() {
    await connectRedisOnce();

    // Aceita CLIENT_ID ou CLIENTE_ID (vi os dois no seu env)
    const clientId = process.env.CLIENT_ID || process.env.CLIENTE_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const refreshToken = process.env.BLING_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('CLIENT_ID/CLIENTE_ID, CLIENT_SECRET ou BLING_REFRESH_TOKEN ausentes nas env vars.');
    }

    console.log('[BLING] Gerando novo access_token via refresh_token das env vars...');

    // Evita possíveis redirecionamentos/handshakes problemáticos
    const tokenUrl = 'https://bling.com.br/Api/v3/oauth/token';

    // Body x-www-form-urlencoded
    const form = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
    });

    // Força TLS >= 1.2
    const agent = new https.Agent({ keepAlive: false, minVersion: 'TLSv1.2' });

    try {
        // usa fetch nativo (Node 18+) + agent TLS
        const resp = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: form,
            agent,
            redirect: 'follow',
        });

        const text = await resp.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }

        if (!resp.ok) {
            throw new Error(`Bling token error (status ${resp.status}): ${text}`);
        }

        const { access_token, refresh_token, expires_in } = data || {};
        if (!access_token) {
            throw new Error(`Resposta sem access_token: ${text}`);
        }

        await saveTokens({
            access_token,
            refresh_token: refresh_token || refreshToken,
            expires_in,
        });

        return { ok: true, provider: 'bling', saved: ['access_token', 'refresh_token', 'expires_at'] };
    } catch (err) {
        console.error('[SEED][BLING] Falha ao trocar refresh_token:', err.message);
        throw err;
    }
}

module.exports = {
    runSeedFromEnv,
    KEYS,
};


