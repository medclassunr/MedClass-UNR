import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { baixarBytesArquivo, obterMetadadosArquivo, GoogleDriveError } from "@/lib/google-drive"
import { baixarBytesOAuth, obterMetadadosOAuth, DriveOAuthError } from "@/lib/google-drive-oauth"

// Proxy de download/visualização: o aluno nunca vê uma URL drive.google.com
// e o arquivo nunca é copiado pro nosso Storage -- os bytes passam direto
// do Drive pra resposta dessa rota, a cada pedido.
//
// Aceita o token tanto no header Authorization quanto na query (?token=),
// porque esse endpoint também é usado como `src` de <iframe>/<a download>
// (que não enviam headers customizados) pelo visualizador/botão de download.
async function autenticar(request: NextRequest) {
  const headerToken = request.headers.get("authorization")?.replace("Bearer ", "")
  const token = headerToken || request.nextUrl.searchParams.get("token") || undefined
  if (!token) return null

  const admin = createAdminClient()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await autenticar(request)
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const { id: fileId } = await params
  const modo = request.nextUrl.searchParams.get("modo") === "inline" ? "inline" : "download"
  // fonte=oauth -> arquivo PRIVADO no Drive do admin (seções/resumos novos),
  // baixado com a conta conectada via OAuth. Sem isso (padrão), usa a API Key
  // em pastas públicas (biblioteca por matéria UNR já existente).
  const viaOAuth = request.nextUrl.searchParams.get("fonte") === "oauth"

  // escopo=aluno -> material enviado por um aluno. Só o DONO pode baixar
  // (sem isso, qualquer aluno logado poderia passar o id de outro). Os
  // resumos do admin (sem escopo) continuam visíveis a todos.
  if (request.nextUrl.searchParams.get("escopo") === "aluno") {
    const admin = createAdminClient()
    const { data: dono } = await admin
      .from("aluno_materiais")
      .select("id")
      .eq("drive_file_id", fileId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!dono) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  }

  try {
    const rangeHeader = request.headers.get("range")
    const [meta, bytes] = await Promise.all([
      viaOAuth ? obterMetadadosOAuth(fileId) : obterMetadadosArquivo(fileId),
      viaOAuth ? baixarBytesOAuth(fileId, rangeHeader) : baixarBytesArquivo(fileId, rangeHeader),
    ])

    const headers = new Headers()
    headers.set("Content-Type", meta.mimeType || "application/octet-stream")
    const nomeSeguro = meta.name.replace(/"/g, "")
    headers.set(
      "Content-Disposition",
      `${modo === "inline" ? "inline" : "attachment"}; filename="${nomeSeguro}"`
    )
    headers.set("Cache-Control", "private, max-age=0, no-store")
    headers.set("Accept-Ranges", "bytes")

    // Resposta parcial (206): repassa Content-Range/Content-Length exatos
    // que o Drive devolveu -- essencial pro visualizador de PDF conseguir
    // pedir só um pedaço do arquivo em vez de baixar tudo de uma vez
    // (arquivos grandes travavam/erroravam sem isso).
    if (bytes.status === 206) {
      const contentRange = bytes.headers.get("content-range")
      const contentLength = bytes.headers.get("content-length")
      if (contentRange) headers.set("Content-Range", contentRange)
      if (contentLength) headers.set("Content-Length", contentLength)
      return new NextResponse(bytes.body, { status: 206, headers })
    }

    // Tamanho real vem dos metadados (o fetch pro Drive às vezes chega com
    // Transfer-Encoding: chunked, sem Content-Length próprio) -- sem isso o
    // cliente não consegue calcular % de progresso do download.
    if (meta.size) headers.set("Content-Length", meta.size)

    return new NextResponse(bytes.body, { headers })
  } catch (erro) {
    if (erro instanceof GoogleDriveError || erro instanceof DriveOAuthError) {
      return NextResponse.json({ error: erro.message }, { status: erro.status })
    }
    console.error("[biblioteca/arquivo]", erro)
    return NextResponse.json({ error: "Erro ao buscar arquivo no Drive." }, { status: 500 })
  }
}
