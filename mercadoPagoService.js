const { MercadoPagoConfig, Payment } = require('mercadopago');
require('dotenv').config();

// Configura o cliente do Mercado Pago com o seu Access Token
const client = new MercadoPagoConfig({
  // Corrigido: O nome da variável no seu .env é MERCADO_PAGO_ACCESS_TOKEN
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN
});

/**
 * Busca os detalhes de um pagamento na API do Mercado Pago.
 * IMPORTANTE: Esta função retorna o objeto de pagamento COMPLETO, sem simplificar.
 * @param {string} paymentId O ID do pagamento a ser consultado.
 * @returns {Promise<object>} O objeto completo com os dados do pagamento, retornado pela API.
 */
async function buscarPagamento(paymentId) {
  try {
    if (!paymentId) {
      throw new Error('O ID do pagamento (paymentId) é obrigatório.');
    }
    
    console.log(`[MP Service] Buscando pagamento com ID: ${paymentId}`);
    
    // Usa o SDK para buscar os detalhes do pagamento
    const payment = await new Payment(client).get({ id: paymentId });

    // Retorna o objeto de pagamento COMPLETO e sem modificações.
    // Isso é crucial para que o blingService possa mapear os dados corretamente.
    return payment;

  } catch (error) {
    console.error('[MP Service] Erro ao buscar pagamento real:', error.message);
    // Propaga o erro para que a rota que chamou possa tratá-lo
    throw error;
  }
}

module.exports = { buscarPagamento };






