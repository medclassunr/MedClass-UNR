import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { createAdminClient } from "@/lib/supabase-admin"

// Consumo agregado da Groq pro módulo Prova Oral -- painel completo (seção
// 13 do prompt original) fica pra uma fase seguinte; por ora só os números
// essenciais pra acompanhar custo durante os testes.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const db = createAdminClient()
  const { data: registros } = await db
    .from("oral_ai_usage")
    .select("tipo_chamada, modelo, tokens_entrada, tokens_saida, segundos_audio, custo_estimado_usd, erro, created_at")
    .order("created_at", { ascending: false })
    .limit(500)

  const linhas = registros ?? []
  const totalChamadas = linhas.length
  const chamadasComErro = linhas.filter((r) => r.erro).length
  const tokensEntrada = linhas.reduce((s, r) => s + (r.tokens_entrada ?? 0), 0)
  const tokensSaida = linhas.reduce((s, r) => s + (r.tokens_saida ?? 0), 0)
  const custoTotalUsd = Math.round(linhas.reduce((s, r) => s + (r.custo_estimado_usd ?? 0), 0) * 10000) / 10000

  return NextResponse.json({
    totalChamadas,
    chamadasComErro,
    tokensEntrada,
    tokensSaida,
    custoTotalUsdEstimado: custoTotalUsd,
    ultimasChamadas: linhas.slice(0, 20),
  })
}
