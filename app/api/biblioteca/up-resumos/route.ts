import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { requireAdmin } from "@/lib/require-admin"
import { baixarBytesOAuth, obterMetadadosOAuth, DriveOAuthError } from "@/lib/google-drive-oauth"

// Card de resumo numa UP: o admin escolhe no Picker o ARQUIVO (fica só
// referenciado pelo drive_file_id) e a CAPA (imagem). A capa é LIDA do Drive
// com o token do admin e COPIADA pro bucket público biblioteca-capas, pra o
// card exibir rápido sem expor token. O arquivo nunca é copiado.

const BUCKET_CAPAS = "biblioteca-capas"

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const upId = body?.upId as string | undefined
  const titulo = (body?.titulo as string | undefined)?.trim()
  const driveFileId = body?.driveFileId as string | undefined
  const capaFileId = body?.capaFileId as string | undefined
  if (!upId || !titulo || !driveFileId) {
    return NextResponse.json({ error: "Dados incompletos (UP, título e arquivo são obrigatórios)." }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    let capaPath: string | null = null
    // Copia a capa do Drive -> Storage (se o admin escolheu uma).
    if (capaFileId) {
      const meta = await obterMetadadosOAuth(capaFileId)
      const res = await baixarBytesOAuth(capaFileId)
      const bytes = await res.arrayBuffer()
      const nomeSeguro = (meta.name || "capa").replace(/[^a-zA-Z0-9._-]/g, "_")
      capaPath = `up/${upId}/${crypto.randomUUID()}-${nomeSeguro}`
      const { error: upErr } = await supabase.storage
        .from(BUCKET_CAPAS)
        .upload(capaPath, bytes, { contentType: meta.mimeType || "image/jpeg", upsert: false })
      if (upErr) throw new Error("Falha ao copiar a capa.")
    }

    // Próxima ordem na UP (coloca o novo card no fim).
    const { data: ultimo } = await supabase
      .from("biblioteca_up_resumos")
      .select("ordem")
      .eq("up_id", upId)
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle()
    const ordem = ((ultimo?.ordem as number | undefined) ?? -1) + 1

    const { data: row, error } = await supabase
      .from("biblioteca_up_resumos")
      .insert({ up_id: upId, titulo, drive_file_id: driveFileId, capa_path: capaPath, ordem })
      .select("id, up_id, titulo, drive_file_id, capa_path, ordem")
      .single()

    if (error) {
      if (capaPath) await supabase.storage.from(BUCKET_CAPAS).remove([capaPath]).catch(() => {})
      return NextResponse.json({ error: "Falha ao registrar o resumo." }, { status: 500 })
    }
    return NextResponse.json({ resumo: row })
  } catch (erro) {
    if (erro instanceof DriveOAuthError) {
      return NextResponse.json({ error: erro.message }, { status: erro.status })
    }
    console.error("[up-resumos/POST]", erro)
    return NextResponse.json({ error: erro instanceof Error ? erro.message : "Erro ao adicionar o resumo." }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id faltando" }, { status: 400 })

  const supabase = createAdminClient()
  const { data: row } = await supabase
    .from("biblioteca_up_resumos")
    .select("id, capa_path")
    .eq("id", id)
    .maybeSingle()
  // Remove a capa do Storage (o arquivo NÃO é apagado do Drive -- é do admin).
  if (row?.capa_path) {
    await supabase.storage.from(BUCKET_CAPAS).remove([row.capa_path as string]).catch(() => {})
  }
  const { error } = await supabase.from("biblioteca_up_resumos").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
