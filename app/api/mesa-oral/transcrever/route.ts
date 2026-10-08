import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { groqTranscreverAudio, GroqApiError, GroqNaoConfiguradoError, GroqRateLimitError } from "@/lib/groq"
import { registrarUsoIA, verificarLimiteDiario } from "@/lib/oral-prova/usage"

const TAMANHO_MAXIMO_BYTES = 15 * 1024 * 1024 // 15MB

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const formData = await request.formData().catch(() => null)
  const arquivo = formData?.get("audio")
  const examId = formData?.get("examId")

  if (!(arquivo instanceof Blob) || typeof examId !== "string") {
    return NextResponse.json({ error: "Áudio inválido." }, { status: 400 })
  }
  if (arquivo.size === 0) return NextResponse.json({ error: "Áudio vazio." }, { status: 400 })
  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return NextResponse.json({ error: "Audio muy largo (máx. 15MB)." }, { status: 413 })
  }

  const limite = await verificarLimiteDiario(admin.id)
  if (!limite.ok) return NextResponse.json({ error: limite.motivo }, { status: 429 })

  const modelo = process.env.GROQ_TRANSCRIPTION_MODEL ?? "whisper-large-v3-turbo"

  try {
    const resultado = await groqTranscreverAudio({
      arquivo,
      nomeArquivo: arquivo instanceof File ? arquivo.name : "resposta.webm",
      idioma: "es",
    })

    await registrarUsoIA({
      examId,
      userId: admin.id,
      tipoChamada: "transcricao",
      modelo,
      segundosAudio: resultado.duracaoSegundos ?? undefined,
    })

    return NextResponse.json({ texto: resultado.text, duracaoSegundos: resultado.duracaoSegundos })
  } catch (erro) {
    if (erro instanceof GroqNaoConfiguradoError) {
      return NextResponse.json({ error: "A chave da Groq ainda não foi configurada." }, { status: 503 })
    }
    if (erro instanceof GroqRateLimitError) {
      await registrarUsoIA({ examId, userId: admin.id, tipoChamada: "transcricao", modelo, erro: "429 rate limit" })
      return NextResponse.json(
        { error: "La IA está con mucha demanda ahora mismo. Probá de nuevo en un momento." },
        { status: 429 }
      )
    }
    if (erro instanceof GroqApiError) {
      await registrarUsoIA({ examId, userId: admin.id, tipoChamada: "transcricao", modelo, erro: `HTTP ${erro.status}` })
      return NextResponse.json({ error: "Falha al transcribir el audio. Probá escribir tu respuesta." }, { status: 502 })
    }
    console.error("[mesa-oral/transcrever]", erro)
    return NextResponse.json({ error: "Falha ao transcrever o áudio." }, { status: 500 })
  }
}
