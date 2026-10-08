// Estimativas de custo da Groq. IMPORTANTE: não consegui confirmar os
// valores exatos vigentes em console.groq.com/docs/models (página renderiza
// via JS, não deu pra raspar com confiança) -- os números abaixo são
// placeholders razoáveis pra o painel admin não ficar vazio no protótipo.
// CONFERIR contra o console antes de usar esses números pra qualquer
// decisão de negócio real. Dá pra sobrescrever via env var sem tocar
// código.

const PRECOS_USD_POR_1M_TOKENS: Record<string, { entrada: number; saida: number }> = {
  "openai/gpt-oss-20b": {
    entrada: Number(process.env.GROQ_PRECO_20B_ENTRADA_USD_1M ?? 0.1),
    saida: Number(process.env.GROQ_PRECO_20B_SAIDA_USD_1M ?? 0.5),
  },
  "openai/gpt-oss-120b": {
    entrada: Number(process.env.GROQ_PRECO_120B_ENTRADA_USD_1M ?? 0.15),
    saida: Number(process.env.GROQ_PRECO_120B_SAIDA_USD_1M ?? 0.75),
  },
}

const PRECO_WHISPER_USD_POR_HORA = Number(process.env.GROQ_PRECO_WHISPER_USD_HORA ?? 0.04)

// Gemini 3.8 Flash-Lite TTS tem camada gratuita (confirmado na doc oficial
// em 2026-10-08) -- esse preço só é cobrado se/quando o uso ultrapassar os
// limites grátis. $6/1M tokens de áudio é o valor vigente até 2026-12-31
// segundo a tabela de preços no momento em que conferi.
const PRECO_GEMINI_TTS_USD_POR_1M_TOKENS = Number(process.env.GEMINI_PRECO_TTS_USD_1M ?? 6.0)

export function estimarCustoChat(modelo: string, tokensEntrada: number, tokensSaida: number): number {
  const preco = PRECOS_USD_POR_1M_TOKENS[modelo] ?? PRECOS_USD_POR_1M_TOKENS["openai/gpt-oss-20b"]
  return (tokensEntrada / 1_000_000) * preco.entrada + (tokensSaida / 1_000_000) * preco.saida
}

export function estimarCustoTranscricao(segundos: number): number {
  return (segundos / 3600) * PRECO_WHISPER_USD_POR_HORA
}

export function estimarCustoTts(tokensSaida: number): number {
  return (tokensSaida / 1_000_000) * PRECO_GEMINI_TTS_USD_POR_1M_TOKENS
}
