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
    } );

    accessToken = response.data.access_token;
    console.log('[BLING] Novo access_token gerado com sucesso');

    return accessToken;
  } catch (error) {
    console.error('[BLING] Erro ao renovar access_token:', error.response?.data || error.message);
    throw error;
  }
}

async function criarPedido(dados) {
  // Calcula o valor unitário para o item
  const valorUnitario = (dados.valor / (dados.quantidade || 1)) || 100.00;
  // O valor total da venda é o 'dados.valor' que você já está passando
  const valorTotalVenda = dados.valor || 100.00;

  const payload = {
    // Campos básicos do pedido
    numero: dados.numero || 'BB0002', // Número do pedido (opcional, Bling pode gerar)
    data: dados.data || new Date().toISOString().split('T')[0], // Data do pedido (AAAA-MM-DD)
    dataPrevista: dados.dataPrevista || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Data prevista (ex: 7 dias após)
    tipo: "VENDA", // Tipo do pedido (sempre VENDA para este endpoint)

    // Situação do pedido (requer ID)
    // Consulte a documentação do Bling ou sua conta para os IDs de situação.
    // Ex: 1 = Em Aberto, 2 = Atendido, etc.
    situacao: {
      id: dados.idSituacao || 1 // ID da situação do pedido
    },

    // Contato/Cliente (pode ser por ID ou dados completos)
    // Se você já tem o cliente cadastrado no Bling, use o ID.
    // Caso contrário, preencha os dados completos do cliente.
    contato: {
      id: dados.idCliente || process.env.CLIENTE_ID, // ID do contato existente
      // Ou preencha os dados completos do cliente se não tiver o ID:
      // nome: dados.nomeCliente || "Cliente Padrão",
      // tipoPessoa: dados.tipoPessoa || "F", // F: Física, J: Jurídica
      // cpfCnpj: dados.cpfCnpj || "12345678900",
      // email: dados.emailCliente || "cliente@example.com",
      // fone: dados.foneCliente || "11999999999",
      // endereco: dados.enderecoCliente || "Rua Exemplo",
      // numero: dados.numeroEndereco || "123",
      // bairro: dados.bairroCliente || "Centro",
      // cidade: dados.cidadeCliente || "São Paulo",
      // uf: dados.ufCliente || "SP",
      // cep: dados.cepCliente || "01000-000"
    },

    // Itens do pedido
    itens: [
      {
        produto: {
          codigo: dados.codigoProduto || process.env.PRODUTO_CODIGO // Código do produto no Bling
        },
        quantidade: dados.quantidade || 1,
        valor: valorUnitario // Valor UNITÁRIO do produto
      }
    ],

    // Valor total da venda (deve ser a soma dos itens e bater com a soma das parcelas)
    total: valorTotalVenda,

    // Parcelas do pagamento
    parcelas: [
      {
        dataVencimento: dados.vencimento || '2025-07-24',
        valor: valorTotalVenda // Valor da parcela (se for única, é o total da venda)
        // Se houver múltiplas parcelas, adicione mais objetos aqui e a soma dos 'valor' deve ser 'valorTotalVenda'
      }
    ],

    // Meio de pagamento (requer ID)
    // Consulte a documentação do Bling ou sua conta para os IDs de meio de pagamento.
    // Ex: 1 = Cartão de Crédito, 2 = Boleto, etc.
    meioPagamento: {
      id: dados.idMeioPagamento || 1 // ID do meio de pagamento
    },

    // Campos adicionais que podem ser úteis
    observacoes: dados.observacoes || "",
    observacoesInternas: dados.observacoesInternas || "",
    // desconto: {
    //   valor: dados.desconto || 0,
    //   unidade: "REAL" // ou "PERCENTUAL"
    // },
    // transporte: {
    //   transportadora: dados.transportadora || "",
    //   tipoFrete: dados.tipoFrete || "C", // C: CIF (emitente paga), F: FOB (destinatário paga)
    //   valorFrete: dados.valorFrete || 0
    // },
    // vendedor: {
    //   id: dados.idVendedor || null // ID do vendedor
    // }
  };

  try {
    const response = await axios.post('https://api.bling.com.br/v3/pedidos/vendas', payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    } );

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
      } );

      return retry.data;
    }

    // Outros erros
    console.error('[BLING] Erro ao criar pedido:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = { criarPedido };

