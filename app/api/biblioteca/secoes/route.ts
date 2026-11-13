import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { requireAdmin } from "@/lib/require-admin"
import { criarPastaDrive, apagarArquivoDrive, DriveOAuthError } from "@/lib/google-drive-oauth"

// Seções livres da biblioteca de resumos. Leitura é feita direto pelo client
// (RLS select liberado). Aqui ficam só as operações de admin que mexem no
// Drive / precisam de service-role.

function slugify(nome: string) {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60)
}

// POST: cria a seção -> cria a pasta no Drive -> grava o vínculo.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const nome = (body.nome as string | undefined)?.trim()
  if (!nome) return NextResponse.json({ error: "Nome da seção é obrigatório." }, { status: 400 })

  const supabase = createAdminClient()

  try {
    const driveFolderId = await criarPastaDrive(`MedClass Resúmenes — ${nome}`)

    // ordem = fim da lista
    const { data: ultima } = await supabase
      .from("biblioteca_secoes")
      .select("ordem")
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle()
    const ordem = (ultima?.ordem ?? -1) + 1

    const { data, error } = await supabase
      .from("biblioteca_secoes")
      .insert({ nome, slug: slugify(nome), drive_folder_id: driveFolderId, ordem })
      .select()
      .single()
    if (error) throw error

    return NextResponse.json({ secao: data })
  } catch (erro) {
    if (erro instanceof DriveOAuthError) {
      return NextResponse.json({ error: erro.message }, { status: erro.status })
    }
    console.error("[biblioteca/secoes POST]", erro)
    return NextResponse.json({ error: "Erro ao criar a seção." }, { status: 500 })
  }
}

// PATCH: renomear / reordenar / ativar-desativar.
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { id, nome, ordem, ativo } = body as {
    id?: string
    nome?: string
    ordem?: number
    ativo?: boolean
  }
  if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 })

  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() }
  if (typeof nome === "string" && nome.trim()) {
    patch.nome = nome.trim()
    patch.slug = slugify(nome)
  }
  if (typeof ordem === "number") patch.ordem = ordem
  if (typeof ativo === "boolean") patch.ativo = ativo

  const supabase = createAdminClient()
  const { data, error } = await supabase.from("biblioteca_secoes").update(patch).eq("id", id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ secao: data })
}

// DELETE: remove a seção, seus resumos (cascade no DB), os PDFs do Drive, as
// capas do Storage e a pasta do Drive.
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Parâmetro 'id' é obrigatório." }, { status: 400 })

  const supabase = createAdminClient()
  const { data: secao } = await supabase
    .from("biblioteca_secoes")
    .select("drive_folder_id")
    .eq("id", id)
    .maybeSingle()
  const { data: resumos } = await supabase
    .from("biblioteca_resumos_drive")
    .select("drive_file_id, capa_path")
    .eq("secao_id", id)

  // Apaga arquivos do Drive + capas do Storage (best-effort; segue mesmo se um falhar).
  for (const r of resumos ?? []) {
    if (r.drive_file_id) await apagarArquivoDrive(r.drive_file_id).catch(() => {})
    if (r.capa_path) await supabase.storage.from("biblioteca-capas").remove([r.capa_path]).catch(() => {})
  }
  if (secao?.drive_folder_id) await apagarArquivoDrive(secao.drive_folder_id).catch(() => {})

  const { error } = await supabase.from("biblioteca_secoes").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
