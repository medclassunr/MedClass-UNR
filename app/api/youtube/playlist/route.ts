import { NextRequest, NextResponse } from "next/server"

interface PlaylistVideo {
  videoId: string
  title: string
  thumbnail: string
}

// O feed RSS legado (feeds/videos.xml?playlist_id=...) foi desativado pelo
// YouTube -- passou a responder 404 pra qualquer playlist, confirmado em
// vários IDs diferentes, incluindo playlists antigas que sempre funcionaram
// aqui. Por isso buscamos a própria página pública da playlist e extraímos
// o JSON que ela já carrega embutido (ytInitialData), o mesmo dado que o
// navegador usa pra desenhar a lista de vídeos -- sem chave de API (a
// GOOGLE_DRIVE_API_KEY deste projeto é restrita à Drive API; a YouTube Data
// API v3 está bloqueada nela).
export async function GET(request: NextRequest) {
  const listId = request.nextUrl.searchParams.get("list")
  if (!listId || !/^[a-zA-Z0-9_-]{10,64}$/.test(listId)) {
    return NextResponse.json({ error: "Parâmetro 'list' inválido." }, { status: 400 })
  }

  const res = await fetch(`https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9,es;q=0.8",
    },
    next: { revalidate: 3600 },
  })
  if (!res.ok) {
    return NextResponse.json({ error: "Não foi possível carregar a playlist." }, { status: 502 })
  }

  const html = await res.text()
  const match = html.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/)
  if (!match) {
    return NextResponse.json({ error: "Não foi possível carregar a playlist." }, { status: 502 })
  }

  let data: unknown
  try {
    data = JSON.parse(match[1])
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar a playlist." }, { status: 502 })
  }

  const items: PlaylistVideo[] = []

  // Percorre o JSON inteiro procurando por lockupViewModel de vídeo -- é o
  // renderer que o YouTube usa hoje pra cada item de uma lista de playlist
  // (substituiu o antigo playlistVideoRenderer).
  function walk(node: unknown): void {
    if (Array.isArray(node)) {
      for (const child of node) walk(child)
      return
    }
    if (!node || typeof node !== "object") return

    const obj = node as Record<string, unknown>
    const lockup = obj.lockupViewModel as Record<string, unknown> | undefined
    if (lockup && lockup.contentType === "LOCKUP_CONTENT_TYPE_VIDEO") {
      const videoId = typeof lockup.contentId === "string" ? lockup.contentId : ""
      if (videoId) {
        const metadata = lockup.metadata as Record<string, unknown> | undefined
        const lockupMetadata = metadata?.lockupMetadataViewModel as Record<string, unknown> | undefined
        const titleObj = lockupMetadata?.title as Record<string, unknown> | undefined
        const title = typeof titleObj?.content === "string" ? titleObj.content : ""

        const contentImage = lockup.contentImage as Record<string, unknown> | undefined
        const thumbnailViewModel = contentImage?.thumbnailViewModel as Record<string, unknown> | undefined
        const image = thumbnailViewModel?.image as Record<string, unknown> | undefined
        const sources = image?.sources as Array<{ url?: string }> | undefined
        const thumbnail = sources?.[0]?.url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`

        items.push({ videoId, title, thumbnail })
      }
    }

    for (const key in obj) walk(obj[key])
  }
  walk(data)

  return NextResponse.json({ items })
}
