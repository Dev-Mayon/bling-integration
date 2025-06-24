require('dotenv').config();
const express = require('express');
const app = express();
const blingService = require('./blingService');

app.use(express.json());

// Rota original já funcional
app.post('/api/pedido', async (req, res) => {
  try {
    const pedido = req.body;
    const result = await blingService.criarPedido(pedido);
    res.status(201).json({ success: true, result });
  } catch (error) {
    const errorData = error.response?.data || error.message;
    console.error('Erro ao criar pedido:', JSON.stringify(errorData, null, 2));
    res.status(500).json({ success: false, error: errorData });
  }
});

// ✅ NOVA ROTA PARA RECEBER NOTIFICAÇÕES DO MERCADO PAGO
app.post('/notificacao', async (req, res) => {
  try {
    // Simulação: extração dos dados recebidos do Mercado Pago
    const notificacao = req.body;

    console.log('[DEBUG] Notificação recebida:', notificacao);

    // Exemplo genérico (ajustaremos depois com o real): transformar em dados do pedido
    const pedido = {
      idCliente: process.env.CLIENTE_ID,
      codigoProduto: process.env.PRODUTO_CODIGO,
      quantidade: 1,
      valor: notificacao.valor || 100,
      situacao: "Em aberto",
      observacoes: `Pedido via webhook simulado`,
      observacoesInternas: `MP Payment ID: ${notificacao.id}`
    };

    const result = await blingService.criarPedido(pedido);
    res.status(201).json({ success: true, result });
  } catch (error) {
    const errorData = error.response?.data || error.message;
    console.error('[ERRO] Ao processar notificação:', JSON.stringify(errorData, null, 2));
    res.status(500).json({ success: false, error: errorData });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});


