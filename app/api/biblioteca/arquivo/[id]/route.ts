import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { baixarBytesArquivo, obterMetadadosArquivo, GoogleDriveError } from "@/lib/google-drive"

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

  try {
    const [meta, bytes] = await Promise.all([obterMetadadosArquivo(fileId), baixarBytesArquivo(fileId)])

    const headers = new Headers()
    headers.set("Content-Type", meta.mimeType || "application/octet-stream")
    const nomeSeguro = meta.name.replace(/"/g, "")
    headers.set(
      "Content-Disposition",
      `${modo === "inline" ? "inline" : "attachment"}; filename="${nomeSeguro}"`
    )
    headers.set("Cache-Control", "private, max-age=0, no-store")

    return new NextResponse(bytes.body, { headers })
  } catch (erro) {
    if (erro instanceof GoogleDriveError) {
      return NextResponse.json({ error: erro.message }, { status: erro.status })
    }
    console.error("[biblioteca/arquivo]", erro)
    return NextResponse.json({ error: "Erro ao buscar arquivo no Drive." }, { status: 500 })
  }
}
