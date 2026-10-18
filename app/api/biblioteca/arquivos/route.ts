import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/require-user"
import { listarArquivosDaPasta, GoogleDriveError } from "@/lib/google-drive"

// Lista em tempo real os arquivos de uma pasta do Drive -- nunca copiados
// pro nosso banco/Storage, só lidos ao vivo a cada visita.
export async function GET(request: NextRequest) {
  const user = await requireUser(request)
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const folderId = request.nextUrl.searchParams.get("folderId")
  if (!folderId) return NextResponse.json({ error: "Parâmetro 'folderId' é obrigatório." }, { status: 400 })

  try {
    const arquivos = await listarArquivosDaPasta(folderId)
    return NextResponse.json({ arquivos })
  } catch (erro) {
    if (erro instanceof GoogleDriveError) {
      return NextResponse.json({ error: erro.message }, { status: erro.status })
    }
    console.error("[biblioteca/arquivos]", erro)
    return NextResponse.json({ error: "Erro ao listar arquivos do Drive." }, { status: 500 })
  }
}
