// freteService.js

const { default: axios } = require('axios');

// Verificamos se o token foi configurado no ambiente
if (!process.env.FRENET_TOKEN) {
    console.error("[Frenet] FATAL: O token da API da Frenet não foi configurado na variável de ambiente FRENET_TOKEN.");
}

/**
 * Calcula o preço e o prazo do frete usando a API da Frenet.
 * @param {object} dadosFrete Contém os dados para o cálculo.
 * @returns {Promise<object>} Um objeto com o valor e o prazo do frete.
 */
async function calcularFrete(dadosFrete) {
    console.log('[Frenet] Iniciando cálculo de frete.');

    // Montamos o corpo da requisição conforme a documentação da Frenet
    const payload = {
        // CEP de origem fixo. Se o seu cliente usar um diferente, altere aqui.
        SellerCEP: dadosFrete.cepOrigem.replace(/\D/g, ''),
        RecipientCEP: dadosFrete.cepDestino.replace(/\D/g, ''),
        ShipmentInvoiceValue: dadosFrete.valor,
        ShippingItemArray: [
            {
                Height: Math.max(2, dadosFrete.altura),
                Length: Math.max(16, dadosFrete.comprimento),
                Width: Math.max(11, dadosFrete.largura),
                Weight: dadosFrete.peso,
                Quantity: 1
            }
        ],
    };

    try {
        const url = "https://api.frenet.com.br/shipping/quote";

        // Fazemos a chamada POST com os headers de autorização corretos
        const response = await axios.post(url, payload, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                // O token da Frenet é passado diretamente no header 'token'
                'token': process.env.FRENET_TOKEN
            }
        });

        // A Frenet retorna um array de "ShippingServiceArray"
        const servicos = response.data.ShippingSevicesArray;

        // Filtramos para pegar o PAC ("PAC")
        const pacOption = servicos.find(service => service.ServiceDescription === "PAC");

        if (pacOption && pacOption.Error === false) {
            const freteFinal = {
                // O valor vem como string, convertemos para número
                valor: parseFloat(pacOption.ShippingPrice),
                // O prazo vem em dias, já como string
                prazo: pacOption.DeliveryTime
            };
            console.log('[Frenet] Frete PAC calculado com sucesso:', freteFinal);
            return freteFinal;
        } else {
            // Se o PAC não estiver disponível, ou der erro, usamos o fallback
            throw new Error(pacOption ? pacOption.Msg : "Nenhuma opção PAC encontrada na resposta da Frenet.");
        }

    } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        console.error("[Frenet] Erro ao calcular frete:", errorMessage);
        // Nosso plano B de sempre, para garantir que a venda não pare
        return { valor: 35.00, prazo: "7" };
    }
}

module.exports = {
    calcularFrete
};