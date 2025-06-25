const axios = require('axios');
require('dotenv').config();

let accessToken = null;

// ✅ Carrega o token mais recente do Make
async function carregarTokenDoMake() {
  try {
    const response = await axios.get('https://hook.us2.make.com/hce28beph3r90vwy91fu0au1pfg85qtt');
    accessToken = response.data.access_token;
    console.log('[MAKE] Token carregado com sucesso do Make');
    return accessToken;
  } catch (err) {
    console.error('[MAKE] Erro ao buscar token do Make:', err.message);
    throw err;
  }
}

async function criarPedido(dados) {
  if (!accessToken) {
    await carregarTokenDoMake();
  }

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
      console.log('[BLING] Token expirado ou inválido. Tentando carregar novamente...');
      accessToken = await carregarTokenDoMake();

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

module.exports = {
  criarPedido
};










