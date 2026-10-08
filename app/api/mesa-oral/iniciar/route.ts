import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { iniciarProva, OralProvaError } from "@/lib/oral-prova/engine"

// Protótipo restrito a admin (ver lib/require-admin.ts) -- quando o módulo
// for liberado pra alunos, trocar por um check de sessão comum + plano.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const modo = body.modo === "examen" ? "examen" : "entrenamiento"
  const disciplina = typeof body.disciplina === "string" ? body.disciplina : "Pediatría"
  const tema = typeof body.tema === "string" ? body.tema : "Convulsiones febriles"

  try {
    const { exam, turn } = await iniciarProva({ userId: admin.id, modo, disciplina, tema })
    return NextResponse.json({ exam, turnoAtual: turn })
  } catch (erro) {
    if (erro instanceof OralProvaError) {
      return NextResponse.json({ error: erro.message, code: erro.code }, { status: erro.status })
    }
    console.error("[mesa-oral/iniciar]", erro)
    return NextResponse.json({ error: "Falha ao iniciar a prova." }, { status: 500 })
  }
}
