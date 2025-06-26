// CÓDIGO PARA mercadopagoService.js

const { MercadoPagoConfig, Payment, Preference } = require('mercadopago');
require('dotenv').config();

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN
});

async function buscarPagamento(paymentId) {
    try {
        if (!paymentId) {
            throw new Error('O ID do pagamento (paymentId) é obrigatório.');
        }
        console.log(`[MP Service] Buscando pagamento com ID: ${paymentId}`);
        const payment = await new Payment(client).get({ id: paymentId });
        return payment;
    } catch (error) {
        console.error('[MP Service] Erro ao buscar pagamento real:', error.message);
        throw error;
    }
}

async function criarPreferenciaDePagamento(produtoInfo, dadosCliente) {
    try {
        console.log("[MP Service] Iniciando criação de preferência real para:", produtoInfo.nome);

        const body = {
            items: [
                {
                    title: produtoInfo.nome,
                    quantity: 1,
                    currency_id: 'BRL',
                    unit_price: produtoInfo.preco
                }
            ],
            payment_methods: {
                installments: 10,
                discounts: [
                    {
                        active: true,
                        name: "10% de desconto no PIX",
                        type: "percentage",
                        value: "10",
                        payment_method_rules: {
                            payment_methods: [
                                {
                                    id: "pix"
                                }
                            ]
                        }
                    }
                ]
            },
            back_urls: {
                success: "https://seusite.com/obrigado",
                pending: "https://seusite.com/pendente",
                failure: "https://seusite.com/falha",
            },
            notification_url: `https://bling-integration-1yey.onrender.com/mercadopago/webhook`,
        };

        console.log("[MP Service] Enviando dados para a API do Mercado Pago...");
        const preference = new Preference(client);
        const result = await preference.create({ body });

        console.log(`[MP Service] Preferência criada com sucesso. ID: ${result.id}`);

        // MODIFICAÇÃO: Devolvemos o objeto de resultado completo
        return result;

    } catch (error) {
        console.error("[MP Service] Erro detalhado ao criar preferência de pagamento:", error.cause ?? error.message);
        throw new Error("Falha ao criar preferência de pagamento no Mercado Pago.");
    }
}

module.exports = {
    buscarPagamento,
    criarPreferenciaDePagamento
};







