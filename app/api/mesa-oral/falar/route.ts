import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { createAdminClient } from "@/lib/supabase-admin"
import { geminiTextoParaFala, GeminiApiError, GeminiNaoConfiguradoError, GeminiRateLimitError } from "@/lib/gemini"
import { registrarUsoIA } from "@/lib/oral-prova/usage"

const BUCKET = "prova-oral-audio"
const VOZ_PADRAO = "Kore"

// Gera (ou devolve do cache) o áudio TTS de um texto. As perguntas
// principais/complementares pré-cadastradas são sempre as mesmas -- cache
// por hash(voz+texto) evita gerar (e cobrar) de novo a cada reprodução.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const { texto, voz } = await request.json().catch(() => ({}))
  if (typeof texto !== "string" || !texto.trim()) {
    return NextResponse.json({ error: "Texto inválido." }, { status: 400 })
  }
  const vozFinal = typeof voz === "string" && voz.trim() ? voz : VOZ_PADRAO

  const db = createAdminClient()
  const hash = crypto.createHash("sha256").update(`${vozFinal}|${texto}`).digest("hex")

  const { data: cacheado } = await db.from("oral_audio_cache").select("storage_path").eq("texto_hash", hash).maybeSingle()
  if (cacheado) {
    const { data: urlPublica } = db.storage.from(BUCKET).getPublicUrl(cacheado.storage_path)
    return NextResponse.json({ url: urlPublica.publicUrl, cache: true })
  }

  const modelo = process.env.GEMINI_TTS_MODEL ?? "gemini-3.8-flash-lite-tts"

  try {
    const resultado = await geminiTextoParaFala({ texto, voz: vozFinal })
    const buffer = Buffer.from(resultado.audioBase64, "base64")
    const path = `${hash}.wav`

    const { error: uploadError } = await db.storage.from(BUCKET).upload(path, buffer, {
      contentType: resultado.mimeType,
      upsert: true,
    })
    if (uploadError) throw new Error(uploadError.message)

    await db.from("oral_audio_cache").insert({ texto_hash: hash, voz: vozFinal, storage_path: path })
    await registrarUsoIA({
      examId: null,
      userId: admin.id,
      tipoChamada: "tts",
      modelo,
      tokensSaida: resultado.tokensSaida,
    })

    const { data: urlPublica } = db.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: urlPublica.publicUrl, cache: false })
  } catch (erro) {
    if (erro instanceof GeminiNaoConfiguradoError) {
      return NextResponse.json({ error: "A chave do Gemini ainda não foi configurada." }, { status: 503 })
    }
    if (erro instanceof GeminiRateLimitError) {
      await registrarUsoIA({ examId: null, userId: admin.id, tipoChamada: "tts", modelo, erro: "429 rate limit" })
      return NextResponse.json({ error: "Límite de la voz por IA alcanzado. Probá de nuevo en un momento." }, { status: 429 })
    }
    if (erro instanceof GeminiApiError) {
      await registrarUsoIA({ examId: null, userId: admin.id, tipoChamada: "tts", modelo, erro: `HTTP ${erro.status}` })
      console.error("[mesa-oral/falar] Gemini error", erro.status, erro.body)
      return NextResponse.json({ error: "Falha al generar el audio." }, { status: 502 })
    }
    console.error("[mesa-oral/falar]", erro)
    return NextResponse.json({ error: "Falha ao gerar áudio." }, { status: 500 })
  }
}
