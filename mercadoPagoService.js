// MODIFICADO: Adicionado 'Preference' à lista de imports
const { MercadoPagoConfig, Payment, Preference } = require('mercadopago');
require('dotenv').config();

// Configura o cliente do Mercado Pago com o seu Access Token
const client = new MercadoPagoConfig({
    // Corrigido: O nome da variável no seu .env é MERCADO_PAGO_ACCESS_TOKEN
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN
});

/**
 * Busca os detalhes de um pagamento na API do Mercado Pago.
 */
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

// =================================================================
// FUNÇÃO ATUALIZADA COM A LÓGICA REAL
// =================================================================
/**
 * Cria uma preferência de pagamento no Mercado Pago.
 * @param {object} produtoInfo Informações do produto (ex: { nome, preco }).
 * @param {object} dadosCliente Informações do cliente (será usado no futuro).
 * @returns {Promise<string>} O ID da preferência de pagamento gerada.
 */
async function criarPreferenciaDePagamento(produtoInfo, dadosCliente) {
    try {
        console.log("[MP Service] Iniciando criação de preferência real para:", produtoInfo.nome);

        // 1. Monta o corpo (body) da requisição para a API do Mercado Pago
        const body = {
            items: [
                {
                    title: produtoInfo.nome,
                    quantity: 1,
                    currency_id: 'BRL', // Moeda brasileira
                    unit_price: produtoInfo.preco
                }
            ],
            payment_methods: {
                // 2. Configura a regra de parcelamento
                installments: 10, // Máximo de 10 parcelas
                // SEÇÃO DE EXCLUSÃO DE PAGAMENTO REMOVIDA CONFORME SOLICITADO

                // 3. Aplica o desconto de 10% para pagamentos via PIX
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
            // URL para onde o cliente será redirecionado após o pagamento
            back_urls: {
                success: "https://seusite.com/obrigado", // Usaremos uma URL melhor no futuro
                pending: "https://seusite.com/pendente",
                failure: "https://seusite.com/falha",
            },
            // URL que o Mercado Pago chamará para notificar sobre o status do pagamento.
            notification_url: `https://bling-integration-1yey.onrender.com/mercadopago/webhook`,
        };

        // 4. Cria a preferência usando o SDK
        console.log("[MP Service] Enviando dados para a API do Mercado Pago...");
        const preference = new Preference(client);
        const result = await preference.create({ body });

        console.log(`[MP Service] Preferência criada com sucesso. ID: ${result.id}`);

        // 5. Retorna o ID da preferência gerada
        return result.id;

    } catch (error) {
        console.error("[MP Service] Erro detalhado ao criar preferência de pagamento:", error.cause ?? error.message);
        throw new Error("Falha ao criar preferência de pagamento no Mercado Pago.");
    }
}
// =================================================================


// Exporta as funções
module.exports = {
    buscarPagamento,
    criarPreferenciaDePagamento
};






