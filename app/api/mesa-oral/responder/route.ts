import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { avaliarTurno, OralProvaError } from "@/lib/oral-prova/engine"

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { examId, examItemId, respostaTexto, idempotencyKey, modalidadeResposta, respostaTranscricaoOriginal } = body

  if (typeof examId !== "string" || typeof examItemId !== "string" || typeof respostaTexto !== "string") {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 })
  }

  try {
    const resultado = await avaliarTurno({
      userId: admin.id,
      examId,
      examItemId,
      respostaTexto,
      modalidadeResposta: modalidadeResposta === "voz" ? "voz" : "texto",
      respostaTranscricaoOriginal: typeof respostaTranscricaoOriginal === "string" ? respostaTranscricaoOriginal : undefined,
      idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : undefined,
    })
    return NextResponse.json(resultado)
  } catch (erro) {
    if (erro instanceof OralProvaError) {
      const headers: HeadersInit = {}
      if (erro.code === "GROQ_RATE_LIMIT") headers["Retry-After"] = "5"
      return NextResponse.json({ error: erro.message, code: erro.code }, { status: erro.status, headers })
    }
    console.error("[mesa-oral/responder]", erro)
    return NextResponse.json({ error: "Falha ao avaliar a resposta." }, { status: 500 })
  }
}
