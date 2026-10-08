// Cliente server-only pra API do Gemini (TTS) -- NUNCA importar de um
// Client Component. GEMINI_API_KEY só existe no servidor.
//
// Endpoint confirmado via teste real (a doc pública descreve um formato
// "/v1beta/interactions" que não bateu com a resposta de verdade da API --
// o formato abaixo foi validado com uma chamada real, não só lido da doc):
// POST /v1beta/models/{modelo}:generateContent, com
// generationConfig.responseModalities:["AUDIO"] +
// generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName.
// Resposta: candidates[0].content.parts[0].inlineData.{mimeType,data}
// (data = áudio WAV em base64).

export class GeminiNaoConfiguradoError extends Error {
  constructor() {
    super("GEMINI_API_KEY não configurada no ambiente do servidor.")
    this.name = "GeminiNaoConfiguradoError"
  }
}

export class GeminiRateLimitError extends Error {
  retryAfterSeconds: number | null
  constructor(retryAfterSeconds: number | null) {
    super("Gemini retornou 429 (rate limit).")
    this.name = "GeminiRateLimitError"
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export class GeminiApiError extends Error {
  status: number
  body: string
  constructor(status: number, body: string) {
    super(`Gemini respondeu ${status}.`)
    this.name = "GeminiApiError"
    this.status = status
    this.body = body
  }
}

export interface GeminiTtsResultado {
  audioBase64: string
  mimeType: string
  tokensSaida: number
}

export async function geminiTextoParaFala(params: { texto: string; voz: string }): Promise<GeminiTtsResultado> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new GeminiNaoConfiguradoError()

  const modelo = process.env.GEMINI_TTS_MODEL ?? "gemini-3.8-flash-lite-tts"
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`

  const resposta = await fetch(url, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: params.texto }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: params.voz } } },
      },
    }),
  })

  if (resposta.status === 429) {
    const retryAfterHeader = resposta.headers.get("retry-after")
    throw new GeminiRateLimitError(retryAfterHeader ? Number(retryAfterHeader) : null)
  }
  if (!resposta.ok) {
    const texto = await resposta.text().catch(() => "")
    throw new GeminiApiError(resposta.status, texto)
  }

  const data = await resposta.json()
  const parte = data.candidates?.[0]?.content?.parts?.[0]?.inlineData
  if (!parte?.data) throw new GeminiApiError(502, "Resposta da Gemini sem áudio.")

  const tokensSaida: number = data.usageMetadata?.candidatesTokenCount ?? 0

  return { audioBase64: parte.data, mimeType: parte.mimeType ?? "audio/wav", tokensSaida }
}
