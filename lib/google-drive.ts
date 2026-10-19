// Acesso direto à Google Drive API v3 só com API key (sem OAuth) -- só
// funciona com pastas/arquivos compartilhados como "Qualquer pessoa com o
// link". Server-only: nunca importar isso de um componente "use client".

export class GoogleDriveError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.status = status
  }
}

function apiKey() {
  const key = process.env.GOOGLE_DRIVE_API_KEY
  if (!key) throw new GoogleDriveError("GOOGLE_DRIVE_API_KEY não configurada no servidor.", 500)
  return key
}

export interface DriveArquivo {
  id: string
  name: string
  mimeType: string
  size?: string
  iconLink?: string
  thumbnailLink?: string
  modifiedTime?: string
}

// Lista os arquivos dentro de uma pasta pública do Drive (não-recursivo --
// cada pasta de matéria/tipo é "achatada": o que estiver direto dentro dela
// aparece na lista, subpastas não são suportadas de propósito).
export async function listarArquivosDaPasta(folderId: string): Promise<DriveArquivo[]> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,size,iconLink,thumbnailLink,modifiedTime)",
    orderBy: "name",
    pageSize: "200",
    key: apiKey(),
  })

  // cache: "no-store" -- sem isso, uma falha antiga (ex.: API key ainda não
  // configurada na Vercel) podia ficar presa no Data Cache do Next e
  // continuar aparecendo mesmo depois do problema real já corrigido.
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    cache: "no-store",
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new GoogleDriveError(
      body?.error?.message ?? "Não foi possível listar os arquivos dessa pasta no Drive.",
      res.status === 404 ? 404 : 502
    )
  }

  const json = await res.json()
  return (json.files ?? []) as DriveArquivo[]
}

export async function obterMetadadosArquivo(fileId: string): Promise<DriveArquivo> {
  const params = new URLSearchParams({
    fields: "id,name,mimeType,size",
    key: apiKey(),
  })
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params.toString()}`)
  if (!res.ok) {
    throw new GoogleDriveError("Arquivo não encontrado no Drive.", res.status === 404 ? 404 : 502)
  }
  return (await res.json()) as DriveArquivo
}

// Baixa os bytes reais do arquivo (alt=media) -- usado pela rota-proxy, pra
// o aluno nunca ver uma URL drive.google.com e o arquivo nunca ser copiado
// pro nosso Storage. Repassa o header Range (se vier do navegador) pro Drive
// -- sem isso, o visualizador de PDF embutido não consegue pedir só um
// pedaço do arquivo, e arquivos grandes (centenas de MB) travam/erroram ao
// tentar carregar tudo de uma vez só.
export async function baixarBytesArquivo(fileId: string, rangeHeader?: string | null): Promise<Response> {
  const params = new URLSearchParams({ alt: "media", key: apiKey() })
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params.toString()}`,
    rangeHeader ? { headers: { Range: rangeHeader } } : undefined
  )
  if (!res.ok && res.status !== 206) {
    throw new GoogleDriveError("Não foi possível baixar esse arquivo do Drive.", res.status === 404 ? 404 : 502)
  }
  return res
}
