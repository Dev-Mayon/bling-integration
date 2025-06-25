const axios = require('axios');
require('dotenv').config();

async function registrarWebhook() {
  try {
    const response = await axios.post(
      'https://api.mercadopago.com/v1/webhooks',
      {
        url: 'https://bling-integration-1yey.onrender.com/webhook',
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('[MP] Webhook registrado com sucesso:', response.data);
  } catch (error) {
    console.error('[MP] Erro ao registrar webhook:', error.response?.data || error.message);
  }
}

registrarWebhook();






