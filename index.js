require('dotenv').config();
const express = require('express');
const app = express();

const blingService = require('./blingService');
const mercadoPagoService = require('./mercadoPagoService');

app.use(express.json());

// ROTA 1 — Criação manual via POST (continua funcionando normalmente)
app.post('/api/pedido', async (req, res) => {
  try {
    const pedido = req.body;
    const result = await blingService.criarPedido(pedido);
    res.status(201).json({ success: true, result });
  } catch (error) {
    const errorData = error.response?.data || error.message;
    console.error('[ERRO] Ao criar pedido manual:', JSON.stringify(errorData, null, 2));
    res.status(500).json({ success: false, error: errorData });
  }
});

// ROTA 2 — Notificação automática do Mercado Pago
app.post('/notificacao', async (req, res) => {
  try {
    const { id } = req.body;
    const dadosPagamento = await mercadoPagoService.buscarPagamento(id);

    const pedido = {
      idCliente: process.env.CLIENTE_ID,
      codigoProduto: process.env.PRODUTO_CODIGO,
      quantidade: dadosPagamento.quantidade || 1,
      valor: dadosPagamento.valor || 100,
      situacao: 'Em aberto',
      observacoes: `Compra de ${dadosPagamento.nomeCliente} via Mercado Pago`,
      observacoesInternas: `MP Payment ID: ${dadosPagamento.id}`
    };

    const result = await blingService.criarPedido(pedido);
    res.status(201).json({ success: true, result });
  } catch (error) {
    const errorData = error.response?.data || error.message;
    console.error('[ERRO] Ao processar notificação do MP:', JSON.stringify(errorData, null, 2));
    res.status(500).json({ success: false, error: errorData });
  }
});

// Inicialização do servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});





