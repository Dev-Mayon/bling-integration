const axios = require('axios');
require('dotenv').config();

let accessToken = process.env.BLING_ACCESS_TOKEN;
const refreshToken = process.env.BLING_REFRESH_TOKEN;

async function renovarAccessToken() {
  try {
    const response = await axios.post('https://api.bling.com.br/oauth/token', null, {
      params: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    accessToken = response.data.access_token;
    console.log('[BLING] Novo access_token gerado com sucesso');

    return accessToken;
  } catch (error) {
    console.error('[BLING] Erro ao renovar access_token:', error.response?.data || error.message);
    throw error;
  }
}

async function criarPedido(dados) {
  const payload = {
    numero: dados.numero || 'BB0002',
    data: dados.data || new Date().toISOString().split('T')[0],
    contato: {
      id: dados.idCliente || process.env.CLIENTE_ID
    },
    itens: [
      {
        produto: {
          codigo: dados.codigoProduto || process.env.PRODUTO_CODIGO
        },
        quantidade: dados.quantidade || 1,
        valor: dados.valor || 100.00
      }
    ],
    parcelas: [
      {
        dataVencimento: dados.vencimento || '2025-07-24',
        valor: dados.valor || 100.00
      }
    ],
    formaPagamento: dados.pagamento || 'Cartão de Crédito',
    tipoIntegracao: "API",
    situacao: "Atendido"
  };

  try {
    const response = await axios.post('https://api.bling.com.br/v3/pedidos/vendas', payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;

  } catch (error) {
    // Se o token expirou, tenta renovar e reenviar
    if (error.response?.status === 401) {
      console.log('[BLING] Token expirado. Renovando...');
      await renovarAccessToken();

      const retry = await axios.post('https://api.bling.com.br/v3/pedidos/vendas', payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return retry.data;
    }

    // Outros erros
    throw error;
  }
}

module.exports = { criarPedido };

