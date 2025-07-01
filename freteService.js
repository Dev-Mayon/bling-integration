// freteService.js (Versão Mais Robusta)

const { default: axios } = require('axios');

if (!process.env.FRENET_TOKEN) {
    console.error("[Frenet] FATAL: O token da API da Frenet não foi configurado.");
}

/**
 * Calcula o preço e o prazo do frete usando a API da Frenet.
 * @param {object} dadosFrete Contém os dados para o cálculo.
 * @returns {Promise<Array<object>>} Um array com todas as opções de frete disponíveis.
 */
async function calcularFrete(dadosFrete) {
    console.log('[Frenet] Iniciando cálculo de frete com os dados:', dadosFrete);

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
        console.log('[Frenet] Fazendo chamada POST para a API...');

        const response = await axios.post(url, payload, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'token': process.env.FRENET_TOKEN
            },
            timeout: 10000 // Adiciona um timeout de 10 segundos
        });

        // Verificação defensiva da resposta
        if (!response || !response.data) {
            console.error('[Frenet] Resposta da API inválida ou vazia.');
            return [];
        }

        console.log('[Frenet] Resposta completa da API recebida.');

        // A API da Frenet tem um erro de digitação conhecido. Verificamos a propriedade correta.
        const servicos = response.data.ShippingSevicesArray;

        if (Array.isArray(servicos) && servicos.length > 0) {
            const opcoesValidas = servicos.filter(service => service && service.Error === false);

            const opcoesFinais = opcoesValidas.map(service => ({
                nome: service.ServiceDescription,
                valor: parseFloat(service.ShippingPrice),
                prazo: service.DeliveryTime
            }));

            console.log(`[Frenet] ${opcoesFinais.length} opções de frete calculadas com sucesso.`);
            return opcoesFinais;
        } else {
            // Se a propriedade existir mas estiver vazia, ou não for um array
            console.warn('[Frenet] A resposta da API não continha um array de serviços de frete válido. Resposta recebida:', response.data);
            return [];
        }

    } catch (error) {
        console.error("[Frenet] Ocorreu um erro CRÍTICO ao tentar calcular o frete.");
        // Log detalhado do erro para depuração
        if (error.response) {
            console.error('[Frenet] Detalhes do Erro de Resposta da API:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('[Frenet] Mensagem de Erro Geral:', error.message);
        }

        return [];
    }
}

module.exports = {
    calcularFrete
};