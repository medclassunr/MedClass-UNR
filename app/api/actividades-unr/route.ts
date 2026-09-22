import { NextResponse } from "next/server"

interface Atividade {
  horario: string
  sala: string
  titulo: string
  descricao: string | null
  emAndamento: boolean
}

const FONTE_URL = "https://hoy.bedeliafcm.com.ar/?origen=Medicina"

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
}

function limparTexto(text: string) {
  return decodeHtmlEntities(text.replace(/\s+/g, " ").trim())
}

// A página da Bedelía (FCM UNR) é HTML gerado no servidor deles, sem API
// própria — cada atividade vira um <div class='card'> num template fixo.
// Isso extrai os campos por regex em vez de adicionar uma dependência de
// parser de HTML só para essa página. Se a Bedelía mudar o template, isso
// para de casar e a rota passa a devolver lista vazia (não quebra o build).
const CARD_REGEX =
  /<div class='card( en-curso)?'>(?:<span class='badge-en-curso'>[^<]*<\/span>)?<div class='card-top'>[\s\S]*?<\/svg>([^<]+)<\/span><div class='card-divider'><\/div><span class='badge-aula'><span>([^<]*)<\/span><\/span><\/div><div class='titulo'>([\s\S]*?)<\/div>(?:<div class='descripcion'>([\s\S]*?)<\/div>)?<\/div>/g

const FECHA_REGEX = /<span class="fecha-badge">([^<]+)<\/span>/

export async function GET() {
  const res = await fetch(FONTE_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MedClassUNR/1.0)" },
    next: { revalidate: 600 },
  })

  if (!res.ok) {
    return NextResponse.json({ error: "Não foi possível carregar as atividades da UNR." }, { status: 502 })
  }

  const html = await res.text()

  const fecha = html.match(FECHA_REGEX)?.[1]?.trim() ?? null

  const atividades: Atividade[] = []
  for (const match of html.matchAll(CARD_REGEX)) {
    const [, enCurso, horario, sala, titulo, descricao] = match
    atividades.push({
      horario: limparTexto(horario),
      sala: limparTexto(sala),
      titulo: limparTexto(titulo),
      descricao: descricao ? limparTexto(descricao) : null,
      emAndamento: Boolean(enCurso),
    })
  }

  return NextResponse.json({
    fecha,
    atividades,
    fonteUrl: FONTE_URL,
    atualizadoEm: new Date().toISOString(),
  })
}
