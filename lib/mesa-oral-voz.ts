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

// Vozes pré-fabricadas do Gemini TTS (lista oficial completa) -- não dá
// pra saber de antemão qual soa melhor em espanhol sem ouvir, por isso a
// UI deixa o usuário trocar e comparar.
export const GEMINI_VOZES_DISPONIVEIS = [
  "Kore",
  "Puck",
  "Charon",
  "Zephyr",
  "Fenrir",
  "Leda",
  "Orus",
  "Aoede",
  "Callirrhoe",
  "Autonoe",
  "Enceladus",
  "Iapetus",
  "Umbriel",
  "Algieba",
  "Despina",
  "Erinome",
  "Algenib",
  "Rasalgethi",
  "Laomedeia",
  "Achernar",
  "Alnilam",
  "Schedar",
  "Gacrux",
  "Pulcherrima",
  "Achird",
  "Zubenelgenubi",
  "Vindemiatrix",
  "Sadachbia",
  "Sadaltager",
  "Sulafat",
]

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

// Traduz o motivo real da falha do getUserMedia -- "não consegui acessar o
// microfone" sozinho não dizia se era permissão negada, sem microfone
// físico, microfone em uso por outro app, ou site fora de HTTPS.
export function diagnosticarErroMic(erro: unknown): string {
  if (erro instanceof Error && erro.message === "MIC_INDISPONIVEL") {
    return "Este navegador no soporta grabación de audio. Probá con Chrome o Safari actualizados."
  }
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "El sitio no está en una conexión segura (HTTPS) -- el navegador bloquea el micrófono en ese caso."
  }
  const nome = erro instanceof DOMException ? erro.name : null
  switch (nome) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Permiso de micrófono denegado. Revisá la configuración del sitio en tu navegador (ícono de candado/micrófono en la barra de direcciones) y permití el acceso."
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No se encontró ningún micrófono en este dispositivo."
    case "NotReadableError":
    case "TrackStartError":
      return "El micrófono está siendo usado por otra aplicación o pestaña. Cerrala e intentá de nuevo."
    case "SecurityError":
      return "El navegador bloqueó el acceso al micrófono por seguridad (contexto no confiable)."
    default:
      return "No se pudo acceder al micrófono. Podés escribir tu respuesta abajo."
  }
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
