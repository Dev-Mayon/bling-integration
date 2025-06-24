const axios = require('axios');

async function buscarPagamento(idPagamento) {
  try {
    // Simulação. Depois vamos trocar a URL pela real quando tiver credenciais.
    const response = {
      data: {
        id: idPagamento,
        valor: 179.90,
        nomeCliente: "Cliente Exemplo",
        produto: "Produto Teste",
        quantidade: 1
      }
    };

    console.log('[MP] Pagamento recebido:', response.data);
    return response.data;

  } catch (error) {
    console.error('[MP] Erro ao buscar pagamento:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = { buscarPagamento };
