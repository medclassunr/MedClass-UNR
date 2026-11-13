import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { createAdminClient } from "@/lib/supabase-admin"
import { montarUrlConsentimento } from "@/lib/google-drive-oauth"

// Inicia a conexão OAuth do Drive. É aberto num link direto do navegador (não
// dá pra mandar header Authorization numa navegação de página), então o token
// do admin vem em ?token= -- mesmo padrão já usado pelo proxy de arquivos.
// Gera um "state" aleatório e guarda na tabela pra validar no callback (CSRF).
async function validarAdmin(token: string | null) {
  if (!token) return null
  const admin = createAdminClient()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return null
  const { data: profile } = await admin.from("profiles").select("role").eq("id", data.user.id).maybeSingle()
  return profile?.role === "admin" || profile?.role === "colaborador" ? data.user : null
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  const user = await validarAdmin(token)
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const redirectUri = `${request.nextUrl.origin}/api/admin/drive/callback`
  const state = randomUUID()

  const admin = createAdminClient()
  await admin
    .from("drive_oauth")
    .update({ state, state_criado_em: new Date().toISOString() })
    .eq("id", 1)

  return NextResponse.redirect(montarUrlConsentimento(redirectUri, state))
}
