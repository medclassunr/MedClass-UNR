// Cliente server-only para a API da Groq (compatível com o formato OpenAI
// Chat Completions). NUNCA importar este arquivo de um Client Component --
// GROQ_API_KEY só existe no servidor (Vercel env vars / .env.local), nunca
// chega ao navegador.
//
// Modelo padrão: GROQ_MODEL (openai/gpt-oss-20b). GROQ_FALLBACK_MODEL só é
// usado em erro real da API (5xx/indisponibilidade) via
// groqChatCompletionComFallback -- não é alternância automática por
// "qualidade", que o admin precisa habilitar manualmente escolhendo o
// modelo na prova (ver prompt original, seção 16, Estratégia 3).

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"

export class GroqNaoConfiguradoError extends Error {
  constructor() {
    super("GROQ_API_KEY não configurada no ambiente do servidor.")
    this.name = "GroqNaoConfiguradoError"
  }
}

export class GroqRateLimitError extends Error {
  retryAfterSeconds: number | null
  constructor(retryAfterSeconds: number | null) {
    super("Groq retornou 429 (rate limit).")
    this.name = "GroqRateLimitError"
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export class GroqApiError extends Error {
  status: number
  body: string
  constructor(status: number, body: string) {
    super(`Groq respondeu ${status}.`)
    this.name = "GroqApiError"
    this.status = status
    this.body = body
  }
}

export interface GroqMensagem {
  role: "system" | "user" | "assistant"
  content: string
}

export interface GroqJsonSchema {
  name: string
  schema: Record<string, unknown>
  strict?: boolean
}

export interface GroqChatParams {
  messages: GroqMensagem[]
  model?: string
  jsonSchema?: GroqJsonSchema
  temperature?: number
  reasoningEffort?: "low" | "medium" | "high"
  maxTokens?: number
}

export interface GroqChatResultado {
  content: string
  model: string
  usage: { tokensEntrada: number; tokensSaida: number; tokensTotal: number } | null
}

export async function groqChatCompletion(params: GroqChatParams): Promise<GroqChatResultado> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new GroqNaoConfiguradoError()

  const model = params.model ?? process.env.GROQ_MODEL ?? "openai/gpt-oss-20b"

  const body: Record<string, unknown> = {
    model,
    messages: params.messages,
    temperature: params.temperature ?? 0.2,
  }
  if (params.jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: params.jsonSchema.name,
        strict: params.jsonSchema.strict ?? true,
        schema: params.jsonSchema.schema,
      },
    }
  }
  if (params.reasoningEffort) body.reasoning_effort = params.reasoningEffort
  if (params.maxTokens) body.max_tokens = params.maxTokens

  const resposta = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (resposta.status === 429) {
    const retryAfterHeader = resposta.headers.get("retry-after")
    throw new GroqRateLimitError(retryAfterHeader ? Number(retryAfterHeader) : null)
  }

  if (!resposta.ok) {
    const texto = await resposta.text().catch(() => "")
    throw new GroqApiError(resposta.status, texto)
  }

  const data = await resposta.json()
  const choice = data.choices?.[0]
  const content: string = choice?.message?.content ?? ""
  const usage = data.usage
    ? {
        tokensEntrada: data.usage.prompt_tokens ?? 0,
        tokensSaida: data.usage.completion_tokens ?? 0,
        tokensTotal: data.usage.total_tokens ?? 0,
      }
    : null

  return { content, model: data.model ?? model, usage }
}

// Tenta o modelo pedido; se a Groq responder erro de servidor (5xx) ou o
// modelo estiver indisponível, tenta UMA vez com GROQ_FALLBACK_MODEL (se
// configurado). 429 nunca aciona o fallback nem retry automático -- quem
// chamou decide o que fazer (mensagem amigável + respeitar retry-after).
export async function groqChatCompletionComFallback(params: GroqChatParams): Promise<GroqChatResultado> {
  try {
    return await groqChatCompletion(params)
  } catch (erro) {
    const fallbackModel = process.env.GROQ_FALLBACK_MODEL
    const jaEraFallback = params.model === fallbackModel
    if (erro instanceof GroqApiError && erro.status >= 500 && fallbackModel && !jaEraFallback) {
      return await groqChatCompletion({ ...params, model: fallbackModel })
    }
    throw erro
  }
}

export async function verificarConexaoGroq(): Promise<{ ok: boolean; model: string; detalhe?: string }> {
  const model = process.env.GROQ_MODEL ?? "openai/gpt-oss-20b"
  try {
    const resultado = await groqChatCompletion({
      model,
      messages: [{ role: "user", content: "Responde solamente: ok" }],
      maxTokens: 5,
      temperature: 0,
    })
    return { ok: true, model: resultado.model }
  } catch (erro) {
    if (erro instanceof GroqNaoConfiguradoError) return { ok: false, model, detalhe: "GROQ_API_KEY não configurada" }
    if (erro instanceof GroqRateLimitError) return { ok: false, model, detalhe: "Rate limit (429) -- a chave funciona, mas o limite foi atingido agora" }
    if (erro instanceof GroqApiError) return { ok: false, model, detalhe: `Erro ${erro.status} da Groq` }
    return { ok: false, model, detalhe: "Erro desconhecido ao contatar a Groq" }
  }
}
