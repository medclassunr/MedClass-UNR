import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import {
  trocarCodePorTokens,
  obterEmailDaConta,
  limparCacheToken,
} from "@/lib/google-drive-oauth"

// Callback do OAuth do Drive. O Google redireciona o navegador pra cá com
// ?code=&state=. Validamos o state (gravado no /start), trocamos o code por
// tokens, guardamos o refresh_token e voltamos pro painel. Em vez de JSON,
// redireciona com uma querystring que o painel lê pra mostrar sucesso/erro.
function voltarPainel(origin: string, status: "ok" | "erro", msg?: string) {
  const url = new URL("/admin/biblioteca-secoes", origin)
  url.searchParams.set("drive", status)
  if (msg) url.searchParams.set("msg", msg)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")
  const erroGoogle = request.nextUrl.searchParams.get("error")

  if (erroGoogle) return voltarPainel(origin, "erro", "Autorização cancelada no Google.")
  if (!code || !state) return voltarPainel(origin, "erro", "Resposta inválida do Google.")

  const admin = createAdminClient()
  const { data: config } = await admin
    .from("drive_oauth")
    .select("state, state_criado_em")
    .eq("id", 1)
    .maybeSingle()

  const stateValido =
    config?.state && config.state === state && config.state_criado_em &&
    Date.now() - new Date(config.state_criado_em).getTime() < 10 * 60 * 1000

  if (!stateValido) return voltarPainel(origin, "erro", "Sessão de conexão expirada. Tente de novo.")

  try {
    const redirectUri = `${origin}/api/admin/drive/callback`
    const tokens = await trocarCodePorTokens(code, redirectUri)
    if (!tokens.refresh_token) {
      return voltarPainel(
        origin,
        "erro",
        "O Google não devolveu o acesso permanente. Remova o acesso em myaccount.google.com/permissions e reconecte."
      )
    }

    const email = await obterEmailDaConta(tokens.access_token)

    await admin
      .from("drive_oauth")
      .update({
        refresh_token: tokens.refresh_token,
        account_email: email,
        state: null,
        state_criado_em: null,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", 1)

    limparCacheToken()
    return voltarPainel(origin, "ok")
  } catch (erro) {
    console.error("[drive/callback]", erro)
    return voltarPainel(origin, "erro", "Falha ao conectar o Drive. Tente de novo.")
  }
}
