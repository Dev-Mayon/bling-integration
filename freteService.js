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

        // ✅ MUDANÇA PRINCIPAL AQUI
        // Verificamos se a resposta contém o array de serviços
        const servicos = response.data.ShippingSevicesArray;

        if (servicos && servicos.length > 0) {
            // Filtramos apenas os serviços que não deram erro
            const opcoesValidas = servicos.filter(service => service.Error === false);
            
            // Mapeamos para um formato mais limpo que o nosso frontend vai usar
            const opcoesFinais = opcoesValidas.map(service => ({
                nome: service.ServiceDescription,
                valor: parseFloat(service.ShippingPrice),
                prazo: service.DeliveryTime
            }));

            console.log(`[Frenet] ${opcoesFinais.length} opções de frete calculadas com sucesso.`);
            return opcoesFinais; // Retornamos o array completo de opções
        } else {
            // Se a Frenet não retornar nenhuma opção
            throw new Error("Nenhuma opção de frete encontrada na resposta da Frenet.");
        }

    } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        console.error("[Frenet] Erro ao calcular frete:", errorMessage);
        
        // Como plano B, retornamos um array com uma única opção de fallback
        return [{ nome: "Frete Padrão", valor: 35.00, prazo: "7" }];
    }
}

module.exports = {
    calcularFrete
};