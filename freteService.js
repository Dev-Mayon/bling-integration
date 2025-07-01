// freteService.js

const { default: axios } = require('axios');

// Verificamos se o token foi configurado no ambiente
if (!process.env.FRENET_TOKEN) {
    console.error("[Frenet] FATAL: O token da API da Frenet não foi configurado na variável de ambiente FRENET_TOKEN.");
}

/**
 * Calcula o preço e o prazo do frete usando a API da Frenet.
 * @param {object} dadosFrete Contém os dados para o cálculo.
 * @returns {Promise<Array<object>>} Um array com todas as opções de frete disponíveis.
 */
async function calcularFrete(dadosFrete) {
    console.log('[Frenet] Iniciando cálculo de frete.');

    const payload = {
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

        const response = await axios.post(url, payload, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'token': process.env.FRENET_TOKEN
            }
        });

        // ✅ CORREÇÃO APLICADA AQUI
        // O nome correto da propriedade na resposta da Frenet é "ShippingSevicesArray" (com 'i' em vez de 'c').
        const servicos = response.data.ShippingSevicesArray;

        if (servicos && servicos.length > 0) {
            const opcoesValidas = servicos.filter(service => service.Error === false);

            const opcoesFinais = opcoesValidas.map(service => ({
                nome: service.ServiceDescription,
                valor: parseFloat(service.ShippingPrice),
                prazo: service.DeliveryTime
            }));

            console.log(`[Frenet] ${opcoesFinais.length} opções de frete calculadas com sucesso.`);
            return opcoesFinais;
        } else {
            throw new Error("Nenhuma opção de frete encontrada na resposta da Frenet.");
        }

    } catch (error) {
        const errorMessage = error.response?.data?.Message || error.message; // Ajustado para 'Message' com 'M' maiúsculo, que a Frenet também usa
        console.error("[Frenet] Erro ao calcular frete:", errorMessage);

        // Retorna um array vazio em caso de erro para o frontend tratar
        return [];
    }
}

module.exports = {
    calcularFrete
};