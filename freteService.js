// CÓDIGO PARA freteService.js

const { default: axios } = require('axios');

/**
 * Calcula o preço e o prazo do frete usando a API pública dos Correios.
 * @param {object} dadosFrete Contém cepOrigem, cepDestino, peso, etc.
 * @returns {Promise<object>} Um objeto com o valor e o prazo do frete.
 */
async function calcularFrete(dadosFrete) {
    console.log('[Frete Service] Iniciando cálculo de frete (Tentativa Final) com:', dadosFrete);

    // Códigos de serviço dos Correios: 04014 = SEDEX, 04510 = PAC
    const codServico = '04510'; // Usaremos PAC como padrão

    // A API espera um formato de payload muito específico.
    const payload = {
        nCdServico: codServico,
        sCepOrigem: dadosFrete.cepOrigem.replace(/\D/g, ''), // Remove tudo que não for dígito
        sCepDestino: dadosFrete.cepDestino.replace(/\D/g, ''),
        nVlPeso: String(dadosFrete.peso), // Peso precisa ser string
        nCdFormato: 1, // 1 = Caixa/Pacote
        nVlComprimento: String(Math.max(16, dadosFrete.comprimento)), // Precisa ser string
        nVlAltura: String(Math.max(2, dadosFrete.altura)), // Precisa ser string
        nVlLargura: String(Math.max(11, dadosFrete.largura)), // Precisa ser string
        nVlDiametro: '0', // Diâmetro zero para caixas
        sCdMaoPropria: 'N', // N = Não
        nVlValorDeclarado: String(dadosFrete.valor), // Precisa ser string
        sCdAvisoRecebimento: 'N', // N = Não
    };

    try {
        // CORREÇÃO FINAL: Usamos a URL da v1 e o método POST
        const url = "https://brasilapi.com.br/api/correios/v1/frete";
        const response = await axios.post(url, payload);

        if (response.data && response.data.length > 0) {
            const resultadoFrete = response.data[0];

            // A API pode retornar um código de erro interno dos Correios
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
        // Captura erros da chamada ou erros internos dos Correios
        const errorMessage = error.response?.data?.errors?.[0]?.message || error.message;
        console.error("[Frete Service] Erro ao calcular frete real:", errorMessage);
        return { valor: 30.00, prazo: "7" }; // Nosso plano B, sempre confiável
    }
}

module.exports = {
    calcularFrete
};