"use client"

// Camada de voz do simulador de prova oral -- client-only.
//
// TTS: SpeechSynthesis nativo do navegador (sem custo, sem backend).
// STT: MediaRecorder + upload pro backend (Whisper via Groq) -- essa é a
// via PRINCIPAL, não um fallback: o reconhecimento de voz nativo
// (webkitSpeechRecognition) tem suporte real inconsistente entre
// Chrome/Safari/iOS/Android (no Safari historicamente é bem instável), e
// como não dá pra testar em dispositivo real neste ambiente, preferimos o
// caminho mais confiável como padrão. A alternativa de digitar continua
// sempre disponível.

let vozesCache: SpeechSynthesisVoice[] | null = null

export function carregarVozes(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve([])
  if (vozesCache && vozesCache.length > 0) return Promise.resolve(vozesCache)

  const existentes = window.speechSynthesis.getVoices()
  if (existentes.length > 0) {
    vozesCache = existentes
    return Promise.resolve(existentes)
  }

  return new Promise((resolve) => {
    const aoCarregar = () => {
      const vozes = window.speechSynthesis.getVoices()
      vozesCache = vozes
      window.speechSynthesis.removeEventListener("voiceschanged", aoCarregar)
      resolve(vozes)
    }
    window.speechSynthesis.addEventListener("voiceschanged", aoCarregar)
    // alguns navegadores nunca disparam o evento se já carregaram sync --
    // timeout de segurança pra não travar esperando pra sempre.
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1500)
  })
}

// Prefere es-AR explícito; cai pra qualquer es-* genérico (o caso comum na
// prática); sem voz em espanhol nenhuma, devolve null (usa o default do SO).
export function escolherVozEspanhol(vozes: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const ar = vozes.find((v) => v.lang.toLowerCase() === "es-ar")
  if (ar) return ar
  const esGenerico = vozes.find((v) => v.lang.toLowerCase().startsWith("es"))
  return esGenerico ?? null
}

export function falarTexto(
  texto: string,
  opcoes: {
    voz: SpeechSynthesisVoice | null
    velocidade: number
    tom?: number
    onFim?: () => void
    onErro?: () => void
  }
): SpeechSynthesisUtterance | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null

  window.speechSynthesis.cancel() // nunca sobrepõe duas falas

  const utterance = new SpeechSynthesisUtterance(texto)
  if (opcoes.voz) utterance.voice = opcoes.voz
  utterance.lang = opcoes.voz?.lang ?? "es-AR"
  utterance.rate = opcoes.velocidade
  utterance.pitch = opcoes.tom ?? 1
  utterance.onend = () => opcoes.onFim?.()
  utterance.onerror = () => opcoes.onErro?.()

  window.speechSynthesis.speak(utterance)
  return utterance
}

export function pararFala() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel()
}

// ============================================================
// Gravação (MediaRecorder)
// ============================================================

const MIME_TYPES_PREFERIDOS = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]

export function mimeTypeSuportado(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined
  return MIME_TYPES_PREFERIDOS.find((tipo) => MediaRecorder.isTypeSupported(tipo))
}

export interface GravacaoEmAndamento {
  mediaRecorder: MediaRecorder
  stream: MediaStream
  pararEObterAudio: () => Promise<Blob>
}

export async function iniciarGravacao(): Promise<GravacaoEmAndamento> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("MIC_INDISPONIVEL")
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mimeType = mimeTypeSuportado()
  const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: BlobPart[] = []

  mediaRecorder.addEventListener("dataavailable", (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  })

  mediaRecorder.start()

  const pararEObterAudio = () =>
    new Promise<Blob>((resolve) => {
      mediaRecorder.addEventListener(
        "stop",
        () => {
          stream.getTracks().forEach((track) => track.stop())
          resolve(new Blob(chunks, { type: mediaRecorder.mimeType || mimeType || "audio/webm" }))
        },
        { once: true }
      )
      mediaRecorder.stop()
    })

  return { mediaRecorder, stream, pararEObterAudio }
}
