import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { requireAdmin } from "@/lib/require-admin"
import { limparCacheToken } from "@/lib/google-drive-oauth"

// Diz se o Drive já está conectado (e com qual conta). GET = status.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const supabase = createAdminClient()
  const { data } = await supabase.from("drive_oauth").select("refresh_token, account_email").eq("id", 1).maybeSingle()
  return NextResponse.json({
    conectado: !!data?.refresh_token,
    email: data?.account_email ?? null,
  })
}

// DELETE = desconectar (apaga o refresh_token). Os arquivos continuam no Drive.
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const supabase = createAdminClient()
  const { error } = await supabase
    .from("drive_oauth")
    .update({ refresh_token: null, account_email: null, atualizado_em: new Date().toISOString() })
    .eq("id", 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  limparCacheToken()
  return NextResponse.json({ ok: true })
}
