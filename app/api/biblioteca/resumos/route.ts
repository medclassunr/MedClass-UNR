import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { requireAdmin } from "@/lib/require-admin"
import { enviarArquivoDrive, apagarArquivoDrive, DriveOAuthError } from "@/lib/google-drive-oauth"

// Resumos de uma seção. Leitura é feita direto pelo client (RLS select
// liberado). Aqui ficam as operações de admin: subir PDF pro Drive, editar e
// remover (apagando também o arquivo no Drive e a capa no Storage).

const TAMANHO_MAXIMO = 100 * 1024 * 1024 // 100 MB

// POST (multipart/form-data): secaoId, titulo, capaPath (opcional), arquivo.
// Sobe o PDF pro Drive na pasta da seção e grava a linha.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: "Envio inválido." }, { status: 400 })

  const secaoId = String(form.get("secaoId") ?? "").trim()
  const titulo = String(form.get("titulo") ?? "").trim()
  const capaPath = String(form.get("capaPath") ?? "").trim() || null
  const arquivo = form.get("arquivo")

  if (!secaoId) return NextResponse.json({ error: "Seção é obrigatória." }, { status: 400 })
  if (!titulo) return NextResponse.json({ error: "Título é obrigatório." }, { status: 400 })
  if (!(arquivo instanceof File)) return NextResponse.json({ error: "Arquivo PDF é obrigatório." }, { status: 400 })
  if (arquivo.type !== "application/pdf") return NextResponse.json({ error: "O arquivo precisa ser PDF." }, { status: 400 })
  if (arquivo.size > TAMANHO_MAXIMO) return NextResponse.json({ error: "O PDF precisa ter até 100 MB." }, { status: 400 })

  const supabase = createAdminClient()
  const { data: secao } = await supabase
    .from("biblioteca_secoes")
    .select("drive_folder_id")
    .eq("id", secaoId)
    .maybeSingle()
  if (!secao?.drive_folder_id) return NextResponse.json({ error: "Seção não encontrada." }, { status: 404 })

  try {
    const bytes = await arquivo.arrayBuffer()
    const enviado = await enviarArquivoDrive(secao.drive_folder_id, arquivo.name, arquivo.type, bytes)

    const { data: ultima } = await supabase
      .from("biblioteca_resumos_drive")
      .select("ordem")
      .eq("secao_id", secaoId)
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle()
    const ordem = (ultima?.ordem ?? -1) + 1

    const { data, error } = await supabase
      .from("biblioteca_resumos_drive")
      .insert({
        secao_id: secaoId,
        titulo,
        drive_file_id: enviado.id,
        capa_path: capaPath,
        tamanho_bytes: arquivo.size,
        ordem,
      })
      .select()
      .single()
    if (error) {
      // Rollback do Drive se o insert falhar, pra não deixar arquivo órfão.
      await apagarArquivoDrive(enviado.id).catch(() => {})
      throw error
    }

    return NextResponse.json({ resumo: data })
  } catch (erro) {
    if (erro instanceof DriveOAuthError) {
      return NextResponse.json({ error: erro.message }, { status: erro.status })
    }
    console.error("[biblioteca/resumos POST]", erro)
    return NextResponse.json({ error: "Erro ao enviar o resumo." }, { status: 500 })
  }
}

// PATCH: editar título / capa / ordem / ativo (não troca o arquivo do Drive).
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { id, titulo, capaPath, ordem, ativo } = body as {
    id?: string
    titulo?: string
    capaPath?: string | null
    ordem?: number
    ativo?: boolean
  }
  if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 })

  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() }
  if (typeof titulo === "string" && titulo.trim()) patch.titulo = titulo.trim()
  if (capaPath !== undefined) patch.capa_path = capaPath
  if (typeof ordem === "number") patch.ordem = ordem
  if (typeof ativo === "boolean") patch.ativo = ativo

  const supabase = createAdminClient()
  const { data, error } = await supabase.from("biblioteca_resumos_drive").update(patch).eq("id", id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ resumo: data })
}

// DELETE: remove a linha, o PDF do Drive e a capa do Storage.
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Parâmetro 'id' é obrigatório." }, { status: 400 })

  const supabase = createAdminClient()
  const { data: resumo } = await supabase
    .from("biblioteca_resumos_drive")
    .select("drive_file_id, capa_path")
    .eq("id", id)
    .maybeSingle()

  if (resumo?.drive_file_id) await apagarArquivoDrive(resumo.drive_file_id).catch(() => {})
  if (resumo?.capa_path) await supabase.storage.from("biblioteca-capas").remove([resumo.capa_path]).catch(() => {})

  const { error } = await supabase.from("biblioteca_resumos_drive").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
