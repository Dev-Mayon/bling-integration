// blingSeed.js
const https = require('https');
const { createClient } = require('redis');
const crypto = require('crypto');

// === Redis (Redis Cloud usa TLS) ===
const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) throw new Error('REDIS_URL não definido');

const redis = createClient({ url: REDIS_URL, socket: { tls: true } });

const KEYS = {
  access: 'bling:access_token',
  refresh: 'bling:refresh_token',
  expires: 'bling:expires_at',
};

async function connectRedisOnce() {
  if (!redis.isOpen) await redis.connect();
}

async function saveTokens({ access_token, refresh_token, expires_in }) {
  const expiresAt = Math.floor(Date.now() / 1000) + (expires_in || 3600);
  await redis.mSet({
    [KEYS.access]: access_token,
    [KEYS.refresh]: refresh_token,
    [KEYS.expires]: String(expiresAt),
  });
  if (expires_in) await redis.expire(KEYS.access, Math.max(60, expires_in - 60));
  console.log('[BLING] Tokens salvos no Redis.');
}

// POST x-www-form-urlencoded usando https.request, forçando HTTP/1.1 + TLS1.2 + SNI
function postFormTLS({ hostname, path, form }) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(form).toString();

    const options = {
      hostname,                 // mantém hostname (SNI automático)
      port: 443,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
      },
      minVersion: 'TLSv1.2',
      // força ALPN para HTTP/1.1 (evita negociações estranhas com alguns balancers)
      ALPNProtocols: ['http/1.1'],
      // boas práticas de TLS (Node 18+)
      secureOptions:
        crypto.constants.SSL_OP_NO_SSLv2 |
        crypto.constants.SSL_OP_NO_SSLv3,
      rejectUnauthorized: true,
      servername: hostname,     // SNI explícito
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        const status = res.statusCode || 0;
        if (status < 200 || status >= 300) {
          return reject(new Error(`Bling token error (status ${status}): ${body}`));
        }
        try { resolve(JSON.parse(body)); }
        catch { resolve({ raw: body }); }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

async function runSeedFromEnv() {
  await connectRedisOnce();

  const clientId = process.env.CLIENT_ID || process.env.CLIENTE_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const refreshToken = process.env.BLING_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('CLIENT_ID/CLIENTE_ID, CLIENT_SECRET ou BLING_REFRESH_TOKEN ausentes nas env vars.');
  }

  console.log('[BLING] Gerando novo access_token via refresh_token das env vars...');

  // host oficial do OAuth do Bling
  const hostname = 'www.bling.com.br';
  const path = '/Api/v3/oauth/token';
  const form = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  };

  try {
    const data = await postFormTLS({ hostname, path, form });
    const access_token = data?.access_token;
    const new_refresh = data?.refresh_token || refreshToken;
    const expires_in = data?.expires_in;

    if (!access_token) {
      throw new Error(`Resposta sem access_token: ${JSON.stringify(data)}`);
    }

    await saveTokens({
      access_token,
      refresh_token: new_refresh,
      expires_in,
    });

    return { ok: true, provider: 'bling', saved: ['access_token', 'refresh_token', 'expires_at'] };
  } catch (err) {
    console.error('[SEED][BLING] Falha ao trocar refresh_token:', err.message);
    throw err;
  }
}

module.exports = { runSeedFromEnv, KEYS };

