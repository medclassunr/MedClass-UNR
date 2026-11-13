import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { obterAccessToken, DriveOAuthError } from "@/lib/google-drive-oauth"

// Entrega ao navegador do ADMIN um access_token de curta duração + a API Key,
// pra o Google Picker conseguir abrir o Drive dele. Admin-only. O token é da
// conta do próprio admin (que ele já conectou) -- expô-lo pro navegador dele
// mesmo é aceitável; nunca vai pro aluno (requireAdmin barra).
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_DRIVE_API_KEY não configurada no servidor." }, { status: 500 })
  }

  try {
    const accessToken = await obterAccessToken()
    // appId do Picker = número do projeto, que é o prefixo do client_id
    // (formato "<projectNumber>-xxxx.apps.googleusercontent.com").
    const appId = clientId ? clientId.split("-")[0] : null
    return NextResponse.json({ accessToken, apiKey, appId })
  } catch (erro) {
    if (erro instanceof DriveOAuthError) {
      return NextResponse.json({ error: erro.message }, { status: erro.status })
    }
    console.error("[drive/picker-token]", erro)
    return NextResponse.json({ error: "Erro ao obter token do Drive." }, { status: 500 })
  }
}
