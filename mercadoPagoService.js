const { MercadoPagoConfig, Payment } = require('mercadopago');

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

async function buscarPagamento(idPagamento) {
  try {
    const pagamento = await new Payment(client).get({ id: idPagamento });

    return {
      id: pagamento.id,
      valor: pagamento.transaction_amount,
      nomeCliente: pagamento.payer?.first_name || "Cliente",
      produto: pagamento.description || "Produto",
      quantidade: pagamento.additional_info?.items?.[0]?.quantity || 1
    };
  } catch (error) {
    console.error('[MP] Erro ao buscar pagamento real:', error.message);
    throw error;
  }
}

module.exports = { buscarPagamento };






