require('dotenv').config();
const express = require('express');
const app = express();

const blingService = require('./blingService');
// const mercadoPagoService = require('./mercadoPagoService'); // Comentado para evitar erro

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

// ROTA 2 — Notificação automática do Mercado Pago (simulada)
app.post('/notificacao', async (req, res) => {
  try {
    const { id, valor, nomeCliente, produto, quantidade } = req.body;

    const pedido = {
      idCliente: process.env.CLIENTE_ID,
      codigoProduto: process.env.PRODUTO_CODIGO,
      quantidade: quantidade || 1,
      valor: valor || 100,
      situacao: 'Em aberto',
      observacoes: `Compra de ${nomeCliente} via simulação`,
      observacoesInternas: `MP Payment ID: ${id}`
    };

    const result = await blingService.criarPedido(pedido);
    res.status(201).json({ success: true, result });
  } catch (error) {
    const errorData = error.response?.data || error.message;
    console.error('[ERRO] Ao processar notificação do MP (simulada):', JSON.stringify(errorData, null, 2));
    res.status(500).json({ success: false, error: errorData });
  }
});

// Inicialização do servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});






