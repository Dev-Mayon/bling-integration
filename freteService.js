// freteService.js

const { default: axios } = require('axios');

/**
 * Calcula o preço e o prazo do frete usando a BrasilAPI com header explícito.
 * @param {object} dadosFrete Contém os dados para o cálculo.
 * @returns {Promise<object>} Um objeto com o valor e o prazo do frete.
 */
async function calcularFrete(dadosFrete) {
    console.log('[Frete Service] Iniciando cálculo com BrasilAPI e Header Fixo.');

    const payload = {
        nCdServico: '04510',
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
        const url = "https://brasilapi.com.br/api/correios/v1/frete";

        // ✅ CORREÇÃO APLICADA: Adicionamos o header 'Content-Type'
        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.data && response.data.length > 0) {
            const resultadoFrete = response.data[0];

            if (resultadoFrete.erro && resultadoFrete.erro !== "0") {
                throw new Error(`Erro retornado pelos Correios: ${resultadoFrete.msgErro}`);
            }

            const valorNumerico = parseFloat(resultadoFrete.valor.replace(',', '.'));
            const freteFinal = {
                valor: valorNumerico,
                prazo: resultadoFrete.prazoEntrega
            };

            console.log('[Frete Service] Frete REAL calculado com sucesso:', freteFinal);
            return freteFinal;
        } else {
            throw new Error("A API dos Correios não retornou um resultado válido.");
        }
    } catch (error) {
        const errorMessage = error.response?.data?.errors?.[0]?.message || error.message;
        console.error("[Frete Service] Erro ao calcular frete:", errorMessage);
        return { valor: 30.00, prazo: "7" };
    }
}

module.exports = {
    calcularFrete
};