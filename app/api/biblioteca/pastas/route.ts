import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { requireAdmin } from "@/lib/require-admin"
import { requireUser } from "@/lib/require-user"

// Mapa matéria+tipo -> pasta do Drive. GET é usado pelo aluno (pra saber
// quais pastas já têm conteúdo configurado); POST/DELETE são restritos ao
// admin (painel /admin/biblioteca), que cola o ID da pasta depois de criar
// o compartilhamento público no Drive -- sem precisar de deploy novo.
export async function GET(request: NextRequest) {
  const user = await requireUser(request)
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin.from("biblioteca_pastas").select("*").order("materia_key")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ pastas: data ?? [] })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { materia_key, tipo, drive_folder_id } = body as {
    materia_key?: string
    tipo?: string
    drive_folder_id?: string
  }

  if (!materia_key?.trim()) {
    return NextResponse.json({ error: "Matéria inválida." }, { status: 400 })
  }
  if (tipo !== "livro" && tipo !== "resumo") {
    return NextResponse.json({ error: "Tipo inválido." }, { status: 400 })
  }
  if (!drive_folder_id?.trim()) {
    return NextResponse.json({ error: "ID da pasta do Drive é obrigatório." }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("biblioteca_pastas")
    .upsert(
      {
        materia_key: materia_key.trim(),
        tipo,
        drive_folder_id: drive_folder_id.trim(),
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "materia_key,tipo" }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pasta: data })
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Parâmetro 'id' é obrigatório." }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.from("biblioteca_pastas").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
