// Ledger de uso/custo (oral_ai_usage) -- fonte de verdade pros limites
// diários/globais. NÃO usar lib/rate-limit.ts (em memória, por instância,
// zera a cada deploy) pra isso -- ele continua servindo só como primeira
// barreira barata contra rajadas, no middleware.

import { createAdminClient } from "@/lib/supabase-admin"
import { estimarCustoChat, estimarCustoTranscricao } from "@/lib/oral-prova/pricing"

const LIMITE_DIARIO_POR_USUARIO = Number(process.env.ORAL_PROVA_LIMITE_DIARIO_USUARIO ?? 50)
const LIMITE_DIARIO_GLOBAL = Number(process.env.ORAL_PROVA_LIMITE_DIARIO_GLOBAL ?? 500)

interface RegistrarUsoParams {
  examId: string | null
  userId: string
  tipoChamada: "avaliacao" | "transcricao"
  modelo: string
  tokensEntrada?: number
  tokensSaida?: number
  segundosAudio?: number
  erro?: string
}

export async function registrarUsoIA(params: RegistrarUsoParams): Promise<void> {
  const admin = createAdminClient()

  const custoEstimado =
    params.tipoChamada === "avaliacao"
      ? estimarCustoChat(params.modelo, params.tokensEntrada ?? 0, params.tokensSaida ?? 0)
      : estimarCustoTranscricao(params.segundosAudio ?? 0)

  const { error } = await admin.from("oral_ai_usage").insert({
    exam_id: params.examId,
    user_id: params.userId,
    tipo_chamada: params.tipoChamada,
    modelo: params.modelo,
    tokens_entrada: params.tokensEntrada ?? null,
    tokens_saida: params.tokensSaida ?? null,
    segundos_audio: params.segundosAudio ?? null,
    custo_estimado_usd: custoEstimado,
    erro: params.erro ?? null,
  })

  if (error) {
    // Não derruba o fluxo da prova por falha ao registrar o ledger -- só
    // loga. Perder uma linha de custo é bem menos grave que perder a
    // resposta do aluno.
    console.error("[oral-prova] falha ao registrar oral_ai_usage:", error.message)
  }
}

export async function verificarLimiteDiario(userId: string): Promise<{ ok: boolean; motivo?: string }> {
  const admin = createAdminClient()
  const inicioDoDia = new Date()
  inicioDoDia.setUTCHours(0, 0, 0, 0)

  const [porUsuario, global] = await Promise.all([
    admin
      .from("oral_ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", inicioDoDia.toISOString()),
    admin.from("oral_ai_usage").select("id", { count: "exact", head: true }).gte("created_at", inicioDoDia.toISOString()),
  ])

  if ((porUsuario.count ?? 0) >= LIMITE_DIARIO_POR_USUARIO) {
    return { ok: false, motivo: "Límite diario de solicitudes alcanzado para este usuario. Probá de nuevo mañana." }
  }
  if ((global.count ?? 0) >= LIMITE_DIARIO_GLOBAL) {
    return { ok: false, motivo: "Límite diario global de la plataforma alcanzado. Probá de nuevo más tarde." }
  }
  return { ok: true }
}
