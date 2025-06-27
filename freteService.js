// CÓDIGO PARA freteService.js

const { default: axios } = require('axios');

/**
 * Calcula o preço e o prazo do frete usando a API pública dos Correios.
 * @param {object} dadosFrete Contém cepOrigem, cepDestino, peso, etc.
 * @returns {Promise<object>} Um objeto com o valor e o prazo do frete.
 */
async function calcularFrete(dadosFrete) {
    console.log('[Frete Service] Iniciando cálculo de frete (Versão Final e Correta) com:', dadosFrete);

    // Códigos de serviço dos Correios: 04014 = SEDEX, 04510 = PAC
    const codServico = '04510'; // Usaremos PAC como padrão

    const payload = {
        nCdServico: codServico,
        sCepOrigem: dadosFrete.cepOrigem.replace(/\D/g, ''),
        sCepDestino: dadosFrete.cepDestino.replace(/\D/g, ''),
        nVlPeso: String(dadosFrete.peso),
        nCdFormato: 1,
        nVlComprimento: String(Math.max(16, dadosFrete.comprimento)),
        nVlAltura: String(Math.max(2, dadosFrete.altura)),
        nVlLargura: String(Math.max(11, dadosFrete.largura)),
        nVlDiametro: '0',
        sCdMaoPropria: 'N',
        nVlValorDeclarado: String(dadosFrete.valor),
        sCdAvisoRecebimento: 'N',
    };

    try {
        // CORRETO: Método POST na URL /v1/frete
        const url = "https://brasilapi.com.br/api/correios/v1/frete";
        const response = await axios.post(url, payload);

        if (response.data && response.data.length > 0) {
            const resultadoFrete = response.data[0];

            if (resultadoFrete.erro && resultadoFrete.erro !== "0") {
                throw new Error(`Erro dos Correios: ${resultadoFrete.msgErro}`);
            }

            console.log(`[Frete Service] Resposta da API dos Correios:`, resultadoFrete);

            const valorNumerico = parseFloat(resultadoFrete.valor.replace(',', '.'));
            const freteFinal = {
                valor: valorNumerico,
                prazo: resultadoFrete.prazoEntrega
            };

            console.log('[Frete Service] Retornando frete REAL:', freteFinal);
            return freteFinal;
        } else {
            throw new Error("A API dos Correios não retornou um resultado válido.");
        }
    } catch (error) {
        const errorMessage = error.response?.data?.errors?.[0]?.message || error.message;
        console.error("[Frete Service] Erro ao calcular frete real:", errorMessage);
        return { valor: 30.00, prazo: "7" }; // Nosso plano B
    }
}

module.exports = {
    calcularFrete
};