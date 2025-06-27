// CÓDIGO PARA mercadopagoService.js

const { MercadoPagoConfig, Payment, Preference } = require('mercadopago');
require('dotenv').config();

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN
});

async function buscarPagamento(paymentId) { /* ...código inalterado... */ }

// =================================================================
// FUNÇÃO ATUALIZADA PARA RECEBER MÚLTIPLOS ITENS
// =================================================================
/**
 * Cria uma preferência de pagamento no Mercado Pago.
 * @param {Array<object>} itens O array de itens para o checkout (produto + frete).
 * @returns {Promise<object>} O objeto completo da preferência gerada.
 */
async function criarPreferenciaDePagamento(itens) {
    try {
        console.log("[MP Service] Iniciando criação de preferência com os itens:", itens);

        const body = {
            // MODIFICAÇÃO: A função agora recebe um array de itens diretamente.
            items: itens,
            payment_methods: {
                installments: 10,
            },
            discounts: [
                {
                    active: true,
                    name: "10% de desconto no PIX",
                    type: "percentage",
                    value: "10",
                    payment_method_rules: {
                        payment_methods: [{ id: "pix" }],
                        excluded_payment_methods: [],
                        excluded_payment_types: []
                    }
                }
            ],
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

        return result;

    } catch (error) {
        console.error("[MP Service] Erro detalhado ao criar preferência de pagamento:", error.cause ?? error.message);
        throw new Error("Falha ao criar preferência de pagamento no Mercado Pago.");
    }
}
// =================================================================

module.exports = {
    buscarPagamento,
    criarPreferenciaDePagamento
};







