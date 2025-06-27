// freteService.js

// Importamos a biblioteca especializada
const Correios = require('node-correios');
const correios = new Correios();

/**
 * Calcula o preço e o prazo do frete usando a biblioteca 'node-correios'.
 * @param {object} dadosFrete Contém cepOrigem, cepDestino, peso, etc.
 * @returns {Promise<object>} Um objeto com o valor e o prazo do frete.
 */
async function calcularFrete(dadosFrete) {
    console.log('[Frete Service] Iniciando cálculo com a biblioteca node-correios.');

    // Montamos o objeto de argumentos exatamente como a biblioteca espera
    const args = {
        // 04510 = PAC, 04014 = SEDEX
        sCepOrigem: dadosFrete.cepOrigem.replace(/\D/g, ''),
        sCepDestino: dadosFrete.cepDestino.replace(/\D/g, ''),
        nVlPeso: String(dadosFrete.peso),
        nCdFormato: 1, // 1 = caixa/pacote
        nVlComprimento: Math.max(16, dadosFrete.comprimento),
        nVlAltura: Math.max(2, dadosFrete.altura),
        nVlLargura: Math.max(11, dadosFrete.largura),
        nCdServico: ['04510'], // Podemos pedir múltiplos serviços, pegaremos o primeiro
        nVlDiametro: 0,
        nVlValorDeclarado: dadosFrete.valor
    };

    try {
        // Chamamos a função da biblioteca
        const resultado = await correios.calcPrecoPrazo(args);

        console.log('[Frete Service] Resposta dos Correios:', resultado);

        if (resultado && resultado[0] && resultado[0].Valor) {
            const freteCalculado = resultado[0];

            // Convertemos o valor que vem como string com vírgula ('27,80') para número
            const valorNumerico = parseFloat(freteCalculado.Valor.replace(',', '.'));

            const freteFinal = {
                valor: valorNumerico,
                prazo: freteCalculado.PrazoEntrega
            };

            console.log('[Frete Service] Frete REAL calculado com sucesso:', freteFinal);
            return freteFinal;
        } else {
            // Se a resposta não vier como esperado
            throw new Error('Formato de resposta inesperado dos Correios.');
        }

    } catch (error) {
        console.error("[Frete Service] Erro ao calcular frete:", error);
        // Em último caso, retornamos o valor de fallback para não quebrar o checkout
        return { valor: 30.00, prazo: "7" };
    }
}

module.exports = {
    calcularFrete
};