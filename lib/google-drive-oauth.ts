// Acesso de ESCRITA ao Google Drive via OAuth (conta Gmail comum do admin, sem
// Drive Compartilhado). Diferente de lib/google-drive.ts (que só LÊ pastas
// públicas com API Key), aqui a plataforma age EM NOME do admin que conectou o
// Drive: cria pastas (seções), sobe PDFs e os baixa de volta pelo proxy.
//
// Escopo usado: drive.file -- a plataforma só enxerga/gerencia os arquivos e
// pastas que ELA MESMA criou. Nunca tem acesso ao resto do Drive do admin.
//
// Server-only: nunca importar de um componente "use client". O refresh_token
// fica na tabela drive_oauth (service_role), nunca vai pro navegador.

import { createAdminClient } from "@/lib/supabase-admin"

export class DriveOAuthError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.status = status
  }
}

export const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  // drive.readonly: necessário pro Google Picker ABRIR o Drive do admin e
  // deixar ele escolher resumos/capas que já existem lá (com só drive.file o
  // Picker viria vazio -- o app só enxergaria o que ele mesmo criou). Também
  // permite o servidor LER o arquivo escolhido (copiar a capa, servir o PDF).
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
].join(" ")

function clientCreds() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new DriveOAuthError(
      "OAuth do Google Drive não configurado no servidor (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET).",
      500
    )
  }
  return { clientId, clientSecret }
}

// URL da tela de consentimento do Google. access_type=offline + prompt=consent
// garante que o Google devolva um refresh_token (sem prompt=consent ele só
// manda refresh_token na PRIMEIRA autorização e nunca mais, o que quebra se o
// admin reconectar).
export function montarUrlConsentimento(redirectUri: string, state: string) {
  const { clientId } = clientCreds()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: DRIVE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

interface TokenResposta {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
  token_type?: string
}

// Troca o "code" (recebido no callback) por access_token + refresh_token.
export async function trocarCodePorTokens(code: string, redirectUri: string): Promise<TokenResposta> {
  const { clientId, clientSecret } = clientCreds()
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new DriveOAuthError(`Falha ao trocar o código OAuth: ${body}`, 502)
  }
  return (await res.json()) as TokenResposta
}

export async function obterEmailDaConta(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const json = (await res.json()) as { email?: string }
    return json.email ?? null
  } catch {
    return null
  }
}

// ──────────────── Access token a partir do refresh_token ────────────────
// Cache em memória do processo -- o access_token dura ~1h; não faz sentido
// pedir um novo ao Google a cada upload/download.
let cacheToken: { value: string; expiraEm: number } | null = null

async function lerRefreshToken(): Promise<string> {
  const admin = createAdminClient()
  const { data } = await admin.from("drive_oauth").select("refresh_token").eq("id", 1).maybeSingle()
  const refresh = data?.refresh_token as string | undefined
  if (!refresh) {
    throw new DriveOAuthError(
      "O Google Drive ainda não foi conectado. Conecte em Admin → Resumos (Drive).",
      409
    )
  }
  return refresh
}

export async function obterAccessToken(): Promise<string> {
  const agora = Date.now()
  if (cacheToken && cacheToken.expiraEm > agora + 60_000) return cacheToken.value

  const { clientId, clientSecret } = clientCreds()
  const refresh = await lerRefreshToken()
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    // invalid_grant = refresh_token revogado/expirado -> precisa reconectar.
    if (body.includes("invalid_grant")) {
      throw new DriveOAuthError(
        "A conexão com o Google Drive expirou ou foi revogada. Reconecte o Drive no painel admin.",
        409
      )
    }
    throw new DriveOAuthError(`Falha ao renovar o acesso ao Drive: ${body}`, 502)
  }
  const json = (await res.json()) as TokenResposta
  cacheToken = { value: json.access_token, expiraEm: agora + json.expires_in * 1000 }
  return json.access_token
}

export function limparCacheToken() {
  cacheToken = null
}

// ─────────────────────────── Operações no Drive ───────────────────────────

export async function criarPastaDrive(nome: string, parentId?: string): Promise<string> {
  const token = await obterAccessToken()
  const body: { name: string; mimeType: string; parents?: string[] } = {
    name: nome,
    mimeType: "application/vnd.google-apps.folder",
  }
  // parentId só funciona se a pasta-pai também tiver sido criada pela
  // plataforma (regra do escopo drive.file) -- por isso a pasta "Materiais dos
  // Alunos" é criada pelo app, não aponta pra uma pasta feita à mão no Drive.
  if (parentId) body.parents = [parentId]
  const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new DriveOAuthError(`Não foi possível criar a pasta no Drive: ${body}`, 502)
  }
  const json = (await res.json()) as { id: string }
  return json.id
}

export interface ArquivoEnviado {
  id: string
  name: string
  size?: string
}

// Upload multipart/related (metadata + bytes numa requisição só).
export async function enviarArquivoDrive(
  folderId: string,
  nome: string,
  mimeType: string,
  bytes: ArrayBuffer
): Promise<ArquivoEnviado> {
  const token = await obterAccessToken()
  const boundary = "medclassboundary" + Math.random().toString(36).slice(2)
  const metadata = JSON.stringify({ name: nome, parents: [folderId] })

  const pre = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${metadata}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType || "application/octet-stream"}\r\n\r\n`,
    "utf-8"
  )
  const pos = Buffer.from(`\r\n--${boundary}--`, "utf-8")
  const corpo = Buffer.concat([pre, Buffer.from(bytes), pos])

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: corpo,
    }
  )
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new DriveOAuthError(`Não foi possível enviar o arquivo pro Drive: ${body}`, 502)
  }
  return (await res.json()) as ArquivoEnviado
}

export async function apagarArquivoDrive(fileId: string): Promise<void> {
  const token = await obterAccessToken()
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
  // 404 = já não existe; tratamos como sucesso (idempotente).
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => "")
    throw new DriveOAuthError(`Não foi possível remover o arquivo do Drive: ${body}`, 502)
  }
}

export async function obterMetadadosOAuth(
  fileId: string
): Promise<{ id: string; name: string; mimeType: string; size?: string }> {
  const token = await obterAccessToken()
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) {
    throw new DriveOAuthError("Arquivo não encontrado no Drive.", res.status === 404 ? 404 : 502)
  }
  return (await res.json()) as { id: string; name: string; mimeType: string; size?: string }
}

export async function baixarBytesOAuth(fileId: string, rangeHeader?: string | null): Promise<Response> {
  const token = await obterAccessToken()
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (rangeHeader) headers.Range = rangeHeader
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers }
  )
  if (!res.ok && res.status !== 206) {
    throw new DriveOAuthError("Não foi possível baixar esse arquivo do Drive.", res.status === 404 ? 404 : 502)
  }
  return res
}
