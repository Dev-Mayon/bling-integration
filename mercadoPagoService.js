const mercadopago = require('mercadopago');

mercadopago.configure({
  access_token: process.env.MERCADO_PAGO_ACCESS_TOKEN
});

// Consulta real ao Mercado Pago
async function buscarPagamento(idPagamento) {
  try {
    const pagamento = await mercadopago.payment.findById(idPagamento);
    const { status, transaction_amount, payer, id } = pagamento.body;

    if (status !== 'approved') {
      throw new Error(`Pagamento ainda não aprovado (status: ${status})`);
    }

    const response = {
      id,
      valor: transaction_amount,
      nomeCliente: payer?.first_name || 'Cliente',
      produto: 'Produto Teste', // opcionalmente, você pode extrair do pagamento
      quantidade: 1 // ajustar futuramente se o checkout enviar essa info
    };

    console.log('[MP] Pagamento REAL recebido:', response);
    return response;

  } catch (error) {
    console.error('[MP] Erro ao buscar pagamento:', error.message);
    throw error;
  }
}

module.exports = { buscarPagamento };




