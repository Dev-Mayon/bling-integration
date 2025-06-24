const axios = require('axios');
const qs = require('qs'); // necessário para formatar o corpo como x-www-form-urlencoded
require('dotenv').config();

let accessToken = process.env.BLING_ACCESS_TOKEN;

async function renovarAccessToken() {
  try {
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const refreshToken = process.env.BLING_REFRESH_TOKEN;

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const data = qs.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });

    const response = await axios.post('https://www.bling.com.br/Api/v3/oauth/token', data, {
      headers: {
        'Authorization': `Basic ${basicAuth}`,
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
  const valorUnitario = (dados.valor / (dados.quantidade || 1)) || 100.00;
  const valorTotalVenda = dados.valor || 100.00;
  const numeroGerado = `BB${Date.now()}`;

  const payload = {
    numero: dados.numero || numeroGerado,
    data: dados.data || new Date().toISOString().split('T')[0],
    dataPrevista: dados.dataPrevista || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    tipo: "VENDA",
    situacao: dados.situacao || "Em aberto",

    contato: {
      id: dados.idCliente || process.env.CLIENTE_ID
    },
    itens: [
      {
        produto: {
          codigo: dados.codigoProduto || process.env.PRODUTO_CODIGO
        },
        quantidade: dados.quantidade || 1,
        valor: valorUnitario
      }
    ],
    total: valorTotalVenda,
    parcelas: [
      {
        dataVencimento: dados.vencimento || '2025-07-24',
        valor: valorTotalVenda
      }
    ],
    meioPagamento: {
      id: dados.idMeioPagamento || 1
    },
    observacoes: dados.observacoes || `Pedido automático - ${new Date().toLocaleString()}`,
    observacoesInternas: dados.observacoesInternas || `Ref: ${numeroGerado}`
  };

  console.log('[DEBUG] Payload final enviado ao Bling:');
  console.dir(payload, { depth: null });

  try {
    const response = await axios.post('https://api.bling.com.br/v3/pedidos/vendas', payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;

  } catch (error) {
    if (error.response?.status === 401) {
      console.log('[BLING] Token expirado. Renovando...');
      accessToken = await renovarAccessToken();

      const retry = await axios.post('https://api.bling.com.br/v3/pedidos/vendas', payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return retry.data;
    }

    console.error('[BLING] Erro ao criar pedido:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = { criarPedido };




