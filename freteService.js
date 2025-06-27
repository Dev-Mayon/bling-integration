// CÓDIGO PARA freteService.js

// Importamos o axios para fazer as chamadas de API
const { default: axios } = require('axios');

/**
 * Calcula o preço e o prazo do frete usando uma API pública dos Correios.
 * @param {object} dadosFrete Contém cepOrigem, cepDestino, peso, dimensões, etc.
 * @returns {Promise<object>} Um objeto com o valor e o prazo do frete.
 */
async function calcularFrete(dadosFrete) {
    console.log('[Frete Service] Iniciando cálculo de frete REAL com os dados:', dadosFrete);

    // Códigos de serviço dos Correios
    // 04014 = SEDEX à vista
    // 04510 = PAC à vista
    const codServico = '04510'; // Vamos usar o PAC como padrão

    // Montamos o objeto no formato que a API espera
    const payload = {
        nCdServico: [codServico],
        sCepOrigem: dadosFrete.cepOrigem.replace('-', ''), // Remove o hífen do CEP
        sCepDestino: dadosFrete.cepDestino.replace('-', ''), // Remove o hífen do CEP
        nVlPeso: String(dadosFrete.peso),
        nCdFormato: 1, // 1 para formato caixa/pacote
        nVlComprimento: Math.max(16, dadosFrete.comprimento), // Mínimo de 16 cm
        nVlAltura: Math.max(2, dadosFrete.altura),       // Mínimo de 2 cm
        nVlLargura: Math.max(11, dadosFrete.largura),      // Mínimo de 11 cm
        nVlDiametro: 0,
        sCdMaoPropria: 'N',
        nVlValorDeclarado: dadosFrete.valor,
        sCdAvisoRecebimento: 'N',
    };

    try {
        // Fazemos a chamada POST para a BrasilAPI
        const url = "https://brasilapi.com.br/api/correios/v1/frete";
        const response = await axios.post(url, payload);

        // Verificamos se a resposta contém os dados que esperamos
        if (response.data && response.data.length > 0) {
            const resultadoFrete = response.data[0];
            console.log(`[Frete Service] Resposta da API dos Correios:`, resultadoFrete);

            // A API retorna o valor como string com vírgula, ex: "27,80".
            // Precisamos de converter para um número.
            const valorNumerico = parseFloat(resultadoFrete.valor.replace(',', '.'));

            const freteFinal = {
                valor: valorNumerico,
                prazo: resultadoFrete.prazoEntrega
            };

            console.log('[Frete Service] Retornando frete REAL:', freteFinal);
            return freteFinal;
        } else {
            // Se a API não retornar um resultado válido, usamos um valor de fallback
            throw new Error("A API dos Correios não retornou um valor de frete válido.");
        }
    } catch (error) {
        console.error("[Frete Service] Erro ao calcular frete real:", error.response?.data || error.message);
        // Em caso de erro, podemos retornar um valor padrão para não quebrar o checkout
        return { valor: 30.00, prazo: "7" };
    }
}

module.exports = {
    calcularFrete
};