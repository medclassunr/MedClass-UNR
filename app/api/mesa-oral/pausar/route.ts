import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { createAdminClient } from "@/lib/supabase-admin"

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const { examId } = await request.json().catch(() => ({}))
  if (typeof examId !== "string") return NextResponse.json({ error: "examId inválido." }, { status: 400 })

  const db = createAdminClient()
  const { data: exam } = await db.from("oral_exams").select("id, user_id, status").eq("id", examId).single()
  if (!exam || exam.user_id !== admin.id) return NextResponse.json({ error: "Prova não encontrada." }, { status: 404 })
  if (exam.status === "completed" || exam.status === "cancelled") {
    return NextResponse.json({ error: "Essa prova já foi finalizada." }, { status: 409 })
  }

  const { data: atualizado } = await db
    .from("oral_exams")
    .update({ status: "paused", pausado_em: new Date().toISOString() })
    .eq("id", examId)
    .select("*")
    .single()

  return NextResponse.json({ exam: atualizado })
}
