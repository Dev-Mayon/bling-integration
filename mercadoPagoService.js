// Simulação temporária — sem acesso à API do Mercado Pago real
async function buscarPagamento(idPagamento) {
  try {
    // Dados simulados apenas para teste
    const response = {
      data: {
        id: idPagamento,
        valor: 179.90,
        nomeCliente: "Cliente Exemplo",
        produto: "Produto Teste",
        quantidade: 1
      }
    };

    console.log('[MP] Pagamento simulado recebido:', response.data);
    return response.data;

  } catch (error) {
    console.error('[MP] Erro na simulação do pagamento:', error.message);
    throw error;
  }
}

module.exports = { buscarPagamento };



