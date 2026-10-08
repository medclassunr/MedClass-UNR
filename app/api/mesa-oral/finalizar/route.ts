import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { finalizarProvaManualmente, OralProvaError } from "@/lib/oral-prova/engine"

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const { examId } = await request.json().catch(() => ({}))
  if (typeof examId !== "string") return NextResponse.json({ error: "examId inválido." }, { status: 400 })

  try {
    const exam = await finalizarProvaManualmente(examId, admin.id)
    return NextResponse.json({ exam })
  } catch (erro) {
    if (erro instanceof OralProvaError) {
      return NextResponse.json({ error: erro.message, code: erro.code }, { status: erro.status })
    }
    console.error("[mesa-oral/finalizar]", erro)
    return NextResponse.json({ error: "Falha ao finalizar a prova." }, { status: 500 })
  }
}
