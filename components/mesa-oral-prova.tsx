"use client"

// UI do protótipo "Prova Oral con IA" -- Fase 1 (texto) + Fase 2 (voz).
// Texto da interface em espanhol direto (não passa pelo sistema pt/es de
// lib/i18n.tsx) porque esse módulo, nesta fase, é visível só pra admin em
// teste -- revisar antes de abrir pra alunos.
//
// Voz do professor: Gemini 3.8 Flash-Lite TTS (natural, com cache no
// backend pra não gerar de novo o áudio das perguntas fixas). Se a
// chamada falhar (chave não configurada, rate limit, etc.), cai pro
// SpeechSynthesis do navegador automaticamente, sem travar o fluxo.
//
// Voz do aluno: MediaRecorder + Whisper (backend) -- ver
// lib/mesa-oral-voz.ts pro porquê de não depender do reconhecimento de voz
// nativo do navegador como via principal.

import { useEffect, useRef, useState } from "react"
import { Loader2, Mic, MicOff, Pause, Play, RotateCcw, Send, Square, Volume2, VolumeX } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import {
  carregarVozes,
  diagnosticarErroMic,
  escolherVozEspanhol,
  falarTexto,
  GEMINI_VOZES_DISPONIVEIS,
  iniciarGravacao,
  pararFala,
  type GravacaoEmAndamento,
} from "@/lib/mesa-oral-voz"

async function authedFetch(input: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return fetch(input, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  })
}

async function authedUpload(input: string, formData: FormData) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return fetch(input, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData })
}

const DURACAO_MAXIMA_GRAVACAO_SEGUNDOS = 120

type Modo = "entrenamiento" | "examen"

interface ExamResumo {
  id: string
  modo: Modo
  disciplina: string
  tema: string
  status: string
  nota_final: number | null
  created_at: string
}

interface TurnoAtual {
  id: string
  tipo: "principal" | "complementar"
  pergunta_texto: string
  item_ordem?: number
}

interface RelatorioPergunta {
  ordem: number
  pergunta: string
  respuestaEsperada: string
  nota: number | null
  percentualCriteriosDemonstrados: number
  erroClinicos: string[]
  numComplementares: number
}

interface Relatorio {
  exam: {
    notaFinal: number | null
    disciplina: string
    tema: string
    modo: Modo
    tempoUtilizadoSegundos: number | null
  }
  perguntas: RelatorioPergunta[]
}

type Tela = "inicio" | "prova" | "relatorio"

export function MesaOralProva() {
  const [tela, setTela] = useState<Tela>("inicio")
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [historico, setHistorico] = useState<ExamResumo[]>([])

  const [modo, setModo] = useState<Modo>("entrenamiento")
  const [examId, setExamId] = useState<string | null>(null)
  const [itemOrdem, setItemOrdem] = useState(1)
  const [totalPerguntas, setTotalPerguntas] = useState(5)
  const [turnoAtual, setTurnoAtual] = useState<TurnoAtual | null>(null)
  const [examItemId, setExamItemId] = useState<string | null>(null)
  const [resposta, setResposta] = useState("")
  const [feedbackItem, setFeedbackItem] = useState<{ nota: number; pergunta: string } | null>(null)
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null)

  // -- Voz: TTS (Gemini, com fallback pro navegador) --
  const [vozes, setVozes] = useState<SpeechSynthesisVoice[]>([])
  const [vozEscolhida, setVozEscolhida] = useState<SpeechSynthesisVoice | null>(null)
  const [vozGemini, setVozGemini] = useState("Kore")
  const [velocidade, setVelocidade] = useState(0.85)
  const [tom] = useState(1) // só usado no fallback por SpeechSynthesis
  const [falando, setFalando] = useState(false)
  const [carregandoAudio, setCarregandoAudio] = useState(false)
  const [usandoFallbackNavegador, setUsandoFallbackNavegador] = useState(false)
  const [reproducaoBloqueada, setReproducaoBloqueada] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // -- Voz: gravação/transcrição --
  const [gravando, setGravando] = useState(false)
  const [tempoGravacao, setTempoGravacao] = useState(0)
  const [processandoAudio, setProcessandoAudio] = useState(false)
  const [erroMic, setErroMic] = useState<string | null>(null)
  const [transcricaoOriginal, setTranscricaoOriginal] = useState<string | null>(null)
  const gravacaoRef = useRef<GravacaoEmAndamento | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    authedFetch("/api/mesa-oral/historico")
      .then((r) => r.json())
      .then((data) => setHistorico(data.provas ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const nomeSalvo = localStorage.getItem("mesa-oral-voz-nome")
    const vozGeminiSalva = localStorage.getItem("mesa-oral-voz-gemini")
    const velocidadeSalva = localStorage.getItem("mesa-oral-voz-velocidade")
    if (velocidadeSalva) setVelocidade(Number(velocidadeSalva))
    if (vozGeminiSalva) setVozGemini(vozGeminiSalva)

    carregarVozes().then((lista) => {
      setVozes(lista)
      const salva = nomeSalvo ? lista.find((v) => v.name === nomeSalvo) : null
      setVozEscolhida(salva ?? escolherVozEspanhol(lista))
    })
    return () => pararFala()
  }, [])

  function escolherVozGemini(nome: string) {
    setVozGemini(nome)
    localStorage.setItem("mesa-oral-voz-gemini", nome)
  }

  function mudarVelocidade(valor: number) {
    setVelocidade(valor)
    localStorage.setItem("mesa-oral-voz-velocidade", String(valor))
    if (audioRef.current) audioRef.current.playbackRate = valor
  }

  // Toca a pergunta em voz alta -- tenta o áudio do Gemini primeiro, cai
  // pro SpeechSynthesis do navegador se a chamada falhar por qualquer
  // motivo (chave não configurada, rate limit, erro de rede).
  async function reproduzir(texto: string) {
    setFalando(true)
    setReproducaoBloqueada(false)
    setCarregandoAudio(true)
    try {
      const resp = await authedFetch("/api/mesa-oral/falar", { method: "POST", body: JSON.stringify({ texto, voz: vozGemini }) })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error ?? "Error al generar audio.")
      setUsandoFallbackNavegador(false)
      setAudioUrl(data.url)
    } catch {
      setUsandoFallbackNavegador(true)
      falarTexto(texto, {
        voz: vozEscolhida,
        velocidade,
        tom,
        onFim: () => setFalando(false),
        onErro: () => setFalando(false),
      })
    } finally {
      setCarregandoAudio(false)
    }
  }

  // Dispara o play() assim que a URL do áudio do Gemini estiver pronta.
  useEffect(() => {
    if (!audioUrl || !audioRef.current) return
    audioRef.current.playbackRate = velocidade
    audioRef.current.play().catch(() => {
      // autoplay bloqueado pelo navegador -- mostra botão pra tocar manual
      setReproducaoBloqueada(true)
      setFalando(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl])

  // Toca a pergunta em voz alta sempre que um turno novo é apresentado.
  useEffect(() => {
    if (!turnoAtual) return
    reproduzir(turnoAtual.pergunta_texto)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnoAtual?.id])

  function pararReproducao() {
    pararFala()
    audioRef.current?.pause()
    setFalando(false)
    setReproducaoBloqueada(false)
  }

  function repetirPergunta() {
    if (!turnoAtual) return
    reproduzir(turnoAtual.pergunta_texto)
  }

  // Mantém o item ativo -- precisamos do exam_item_id (não só o turno) pra
  // mandar a resposta. O turno "iniciar"/"retomar" não devolve isso direto
  // nos casos de retomada, então buscamos via o item em andamento.
  async function carregarExamItemId(exId: string) {
    const resp = await authedFetch("/api/mesa-oral/retomar", { method: "POST", body: JSON.stringify({ examId: exId }) })
    const data = await resp.json()
    if (data.item) setExamItemId(data.item.id)
  }

  async function iniciarProva() {
    setCarregando(true)
    setErro(null)
    try {
      const resp = await authedFetch("/api/mesa-oral/iniciar", { method: "POST", body: JSON.stringify({ modo }) })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error ?? "Error al iniciar.")
      setExamId(data.exam.id)
      setTotalPerguntas(data.exam.total_perguntas_principais)
      setItemOrdem(1)
      setTurnoAtual(data.turnoAtual)
      await carregarExamItemId(data.exam.id)
      setFeedbackItem(null)
      setTela("prova")
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Error al iniciar la prueba.")
    } finally {
      setCarregando(false)
    }
  }

  async function iniciarGravacaoResposta() {
    setErro(null)
    setErroMic(null)
    try {
      const gravacao = await iniciarGravacao()
      gravacaoRef.current = gravacao
      setGravando(true)
      setTempoGravacao(0)
      timerRef.current = setInterval(() => {
        setTempoGravacao((t) => {
          if (t + 1 >= DURACAO_MAXIMA_GRAVACAO_SEGUNDOS) {
            pararGravacaoResposta()
            return t
          }
          return t + 1
        })
      }, 1000)
    } catch (e) {
      setErroMic(diagnosticarErroMic(e))
    }
  }

  async function pararGravacaoResposta() {
    if (!gravacaoRef.current || !examId) return
    if (timerRef.current) clearInterval(timerRef.current)
    setGravando(false)
    setProcessandoAudio(true)
    try {
      const blob = await gravacaoRef.current.pararEObterAudio()
      gravacaoRef.current = null

      const formData = new FormData()
      formData.append("audio", blob, "resposta.webm")
      formData.append("examId", examId)

      const resp = await authedUpload("/api/mesa-oral/transcrever", formData)
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error ?? "Error al transcribir el audio.")

      setResposta(data.texto ?? "")
      setTranscricaoOriginal(data.texto ?? "")
    } catch (e) {
      setErroMic(e instanceof Error ? e.message : "Error al transcribir el audio. Podés escribir tu respuesta.")
    } finally {
      setProcessandoAudio(false)
    }
  }

  async function enviarResposta() {
    if (!examId || !examItemId || !resposta.trim()) return
    setCarregando(true)
    setErro(null)
    try {
      const modalidadeResposta = transcricaoOriginal !== null ? "voz" : "texto"
      const resp = await authedFetch("/api/mesa-oral/responder", {
        method: "POST",
        body: JSON.stringify({
          examId,
          examItemId,
          respostaTexto: resposta,
          modalidadeResposta,
          respostaTranscricaoOriginal: transcricaoOriginal ?? undefined,
          idempotencyKey: `${examItemId}-${Date.now()}`,
        }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error ?? "Error al evaluar la respuesta.")

      setResposta("")
      setTranscricaoOriginal(null)

      if (data.provaFinalizada) {
        await abrirRelatorio(examId)
        return
      }

      if (data.itemConcluido && modo === "entrenamiento" && data.notaItem !== null) {
        setFeedbackItem({ nota: data.notaItem, pergunta: turnoAtual?.pergunta_texto ?? "" })
      } else {
        setFeedbackItem(null)
      }

      if (data.proximoTurno) {
        setTurnoAtual(data.proximoTurno)
        if (data.itemConcluido) {
          setItemOrdem(data.proximoTurno.item_ordem)
          await carregarExamItemId(examId)
        }
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Error al evaluar la respuesta.")
    } finally {
      setCarregando(false)
    }
  }

  async function pausarProva() {
    if (!examId) return
    pararReproducao()
    await authedFetch("/api/mesa-oral/pausar", { method: "POST", body: JSON.stringify({ examId }) })
    setTela("inicio")
  }

  async function finalizarProva() {
    if (!examId) return
    pararReproducao()
    setCarregando(true)
    try {
      await authedFetch("/api/mesa-oral/finalizar", { method: "POST", body: JSON.stringify({ examId }) })
      await abrirRelatorio(examId)
    } finally {
      setCarregando(false)
    }
  }

  async function abrirRelatorio(exId: string) {
    const resp = await authedFetch(`/api/mesa-oral/relatorio/${exId}`)
    const data = await resp.json()
    if (resp.ok) {
      setRelatorio(data)
      setTela("relatorio")
    }
    authedFetch("/api/mesa-oral/historico")
      .then((r) => r.json())
      .then((d) => setHistorico(d.provas ?? []))
      .catch(() => {})
  }

  if (tela === "relatorio" && relatorio) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">Informe final</p>
          <h2 className="mt-1 text-2xl font-bold text-foreground">
            {relatorio.exam.disciplina} — {relatorio.exam.tema}
          </h2>
          <p className="mt-2 text-4xl font-bold text-primary">{relatorio.exam.notaFinal?.toFixed(1) ?? "—"} / 100</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Modo: {relatorio.exam.modo === "examen" ? "Examen oral" : "Entrenamiento"}
            {relatorio.exam.tempoUtilizadoSegundos != null && ` · Tiempo: ${Math.round(relatorio.exam.tempoUtilizadoSegundos / 60)} min`}
          </p>
          <p className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            Esta evaluación es un recurso educacional automatizado y no sustituye la evaluación de un profesor.
          </p>
        </div>

        {relatorio.perguntas.map((p) => (
          <div key={p.ordem} className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Pregunta {p.ordem}</p>
              <p className="text-sm font-bold text-primary">{p.nota?.toFixed(1) ?? "—"} / 100</p>
            </div>
            <p className="mt-2 text-sm text-foreground">{p.pergunta}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Respuesta esperada</p>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{p.respuestaEsperada}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              {p.percentualCriteriosDemonstrados}% de los criterios demostrados · {p.numComplementares} complementaria(s)
            </p>
            {p.erroClinicos.length > 0 && (
              <div className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                {p.erroClinicos.join(" · ")}
              </div>
            )}
          </div>
        ))}

        <Button variant="outline" onClick={() => setTela("inicio")}>
          Volver al inicio
        </Button>
      </div>
    )
  }

  if (tela === "prova" && turnoAtual) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">
            Pregunta {itemOrdem} de {totalPerguntas} {turnoAtual.tipo === "complementar" && "· complementaria"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={pausarProva}>
              <Pause className="h-3.5 w-3.5" /> Pausar
            </Button>
            <Button variant="outline" size="sm" onClick={finalizarProva}>
              <Square className="h-3.5 w-3.5" /> Finalizar
            </Button>
          </div>
        </div>

        {feedbackItem && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-foreground">
            Pregunta anterior: <strong>{feedbackItem.nota.toFixed(1)} / 100</strong>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-6">
          <audio
            ref={audioRef}
            src={audioUrl ?? undefined}
            onEnded={() => setFalando(false)}
            onError={() => setFalando(false)}
            className="hidden"
          />
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Mic className="h-3.5 w-3.5" /> PROFESOR VIRTUAL
            </div>
            {falando ? (
              <Button variant="outline" size="icon-sm" onClick={pararReproducao} aria-label="Detener">
                <VolumeX className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button variant="outline" size="icon-sm" onClick={repetirPergunta} aria-label="Escuchar de nuevo">
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <p className="text-base text-foreground">{turnoAtual.pergunta_texto}</p>

          {carregandoAudio && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generando audio...
            </p>
          )}
          {falando && !carregandoAudio && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-primary">
              <Volume2 className="h-3.5 w-3.5 animate-pulse" /> Reproduciendo{usandoFallbackNavegador ? " (voz del navegador)" : ""}...
            </p>
          )}
          {reproducaoBloqueada && (
            <Button variant="outline" size="sm" className="mt-2" onClick={() => audioRef.current?.play()}>
              <Play className="h-3.5 w-3.5" /> Reproducir pregunta
            </Button>
          )}
          {usandoFallbackNavegador && !falando && (
            <p className="mt-2 text-[11px] text-amber-500">No se pudo generar el audio con IA -- se usó la voz del navegador.</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <select
              value={vozGemini}
              onChange={(e) => escolherVozGemini(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
              aria-label="Voz del profesor (IA)"
            >
              {GEMINI_VOZES_DISPONIVEIS.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
            <select
              value={velocidade}
              onChange={(e) => mudarVelocidade(Number(e.target.value))}
              className="rounded-md border border-border bg-background px-1.5 py-1 text-xs text-foreground"
              aria-label="Velocidad de la voz"
            >
              <option value={0.6}>0.6x</option>
              <option value={0.7}>0.7x</option>
              <option value={0.85}>0.85x</option>
              <option value={1}>1x</option>
              <option value={1.15}>1.15x</option>
            </select>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Voz generada por IA (Gemini) -- cambiá y escuchá de nuevo pra comparar cuál suena mejor en español.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Tu respuesta</p>
            {!gravando && !processandoAudio && (
              <Button
                variant="outline"
                size="sm"
                onClick={iniciarGravacaoResposta}
                disabled={falando || carregando}
                title={falando ? "Esperá a que termine de hablar el profesor" : "Grabar respuesta por voz"}
              >
                <Mic className="h-3.5 w-3.5" /> Grabar
              </Button>
            )}
            {gravando && (
              <Button variant="destructive" size="sm" onClick={pararGravacaoResposta}>
                <Square className="h-3.5 w-3.5" /> Detener ({tempoGravacao}s)
              </Button>
            )}
            {processandoAudio && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Transcribiendo...
              </span>
            )}
          </div>

          {gravando && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" /> Grabando... (máx. {DURACAO_MAXIMA_GRAVACAO_SEGUNDOS}s)
            </div>
          )}
          {erroMic && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
              <MicOff className="h-3.5 w-3.5" /> {erroMic}
            </div>
          )}
          {transcricaoOriginal !== null && (
            <p className="mb-2 text-xs text-muted-foreground">Transcripción lista -- revisá y corregí si hace falta antes de enviar.</p>
          )}

          <textarea
            value={resposta}
            onChange={(e) => {
              setResposta(e.target.value)
            }}
            placeholder="Escribí tu respuesta acá, o grabá por voz con el botón de arriba..."
            rows={5}
            className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm text-foreground outline-none focus:border-primary"
            disabled={carregando || gravando || processandoAudio}
          />
          <div className="mt-3 flex justify-end">
            <Button onClick={enviarResposta} disabled={carregando || gravando || processandoAudio || !resposta.trim()}>
              {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar respuesta
            </Button>
          </div>
        </div>

        {erro && <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">Simulador de prueba oral con IA</p>
        <h2 className="mt-1 text-xl font-bold text-foreground">Pediatría — Convulsiones febriles</h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Preguntas</dt>
            <dd className="font-semibold text-foreground">5 principales</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Idioma</dt>
            <dd className="font-semibold text-foreground">Español{vozEscolhida ? ` (voz: ${vozEscolhida.name})` : ""}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Complementarias</dt>
            <dd className="font-semibold text-foreground">Hasta 2 por pregunta</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Modalidad</dt>
            <dd className="font-semibold text-foreground">Voz o texto</dd>
          </div>
        </dl>

        <div className="mt-5 flex gap-2">
          <Button variant={modo === "entrenamiento" ? "gradient" : "outline"} size="sm" onClick={() => setModo("entrenamiento")}>
            Entrenamiento
          </Button>
          <Button variant={modo === "examen" ? "gradient" : "outline"} size="sm" onClick={() => setModo("examen")}>
            Examen oral
          </Button>
        </div>

        <Button className="mt-5 w-full" onClick={iniciarProva} disabled={carregando}>
          {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Iniciar prueba oral
        </Button>

        {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
      </div>

      {historico.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm font-semibold text-foreground">Historial</p>
          <div className="mt-3 space-y-2">
            {historico.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => h.status === "completed" && abrirRelatorio(h.id)}
                className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <span className="text-foreground">
                  {h.tema} · {new Date(h.created_at).toLocaleDateString("es-AR")}
                </span>
                <span className="font-semibold text-primary">
                  {h.status === "completed" ? `${h.nota_final?.toFixed(1)} / 100` : h.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
