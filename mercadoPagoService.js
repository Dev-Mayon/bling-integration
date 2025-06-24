const axios = require('axios');

// ⚠️ Certifique-se de que o .env tem MERCADO_PAGO_ACCESS_TOKEN
const MP_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;

async function consultarPagamento(idPagamento) {
  try {
    const response = await axios.get(`https://api.mercadopago.com/v1/payments/${idPagamento}`, {
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`
      }
    });

    console.log('[MP] Dados do pagamento obtidos com sucesso:', response.data);
    return response.data;

  } catch (error) {
    console.error('[MP] Erro ao consultar pagamento:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = { consultarPagamento };

