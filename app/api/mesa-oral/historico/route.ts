import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { createAdminClient } from "@/lib/supabase-admin"

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const db = createAdminClient()
  const { data: provas } = await db
    .from("oral_exams")
    .select("id, modo, disciplina, tema, status, nota_final, iniciado_em, finalizado_em, created_at")
    .eq("user_id", admin.id)
    .order("created_at", { ascending: false })
    .limit(20)

  return NextResponse.json({ provas: provas ?? [] })
}
