// CÓDIGO PARA freteService.js

const { default: axios } = require('axios');

/**
 * Calcula o preço e o prazo do frete usando a API pública dos Correios.
 * @param {object} dadosFrete Contém cepOrigem, cepDestino, peso, etc.
 * @returns {Promise<object>} Um objeto com o valor e o prazo do frete.
 */
async function calcularFrete(dadosFrete) {
    console.log('[Frete Service] Iniciando cálculo de frete REAL com os dados:', dadosFrete);

    const codServico = '04510'; // 04510 = PAC à vista

    // CORREÇÃO: Para uma chamada GET, os parâmetros são enviados na URL.
    // A URL base da API de frete é um pouco diferente.
    const baseUrl = `https://brasilapi.com.br/api/correios/v2/frete`;

    const params = {
        service: codServico,
        zipFrom: dadosFrete.cepOrigem.replace('-', ''),
        zipTo: dadosFrete.cepDestino.replace('-', ''),
        weight: dadosFrete.peso,
        width: Math.max(11, dadosFrete.largura),
        height: Math.max(2, dadosFrete.altura),
        length: Math.max(16, dadosFrete.comprimento),
        insuranceValue: dadosFrete.valor,
        receipt: false,
        ownHand: false,
    };

    try {
        // CORREÇÃO: Mudamos de axios.post para axios.get e passamos os parâmetros
        const response = await axios.get(baseUrl, { params });

        // A estrutura da resposta da v2 é um pouco diferente
        if (response.data && response.data.services && response.data.services.length > 0) {
            const resultadoFrete = response.data.services[0];
            console.log(`[Frete Service] Resposta da API dos Correios:`, resultadoFrete);

            const valorNumerico = parseFloat(resultadoFrete.price);

            const freteFinal = {
                valor: valorNumerico,
                prazo: resultadoFrete.deadline
            };

            console.log('[Frete Service] Retornando frete REAL:', freteFinal);
            return freteFinal;
        } else {
            throw new Error("A API dos Correios não retornou um valor de frete válido.");
        }
    } catch (error) {
        console.error("[Frete Service] Erro ao calcular frete real:", error.response?.data || error.message);
        return { valor: 30.00, prazo: "7" }; // Nosso plano B continua aqui
    }
}

module.exports = {
    calcularFrete
};