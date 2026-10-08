import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { verificarConexaoGroq } from "@/lib/groq"

// Testa a conexão com a Groq sem nunca revelar a chave -- só confirma se
// GROQ_API_KEY está configurada e respondendo.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const resultado = await verificarConexaoGroq()
  return NextResponse.json(resultado)
}
