"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, XCircle, Loader2, RotateCcw, Trophy, X, ZoomIn, Paperclip, Pencil, Lock } from "lucide-react"
import confetti from "canvas-confetti"
import { supabase } from "@/lib/supabase"
import type { DesafioClinico, DesafioClinicoPergunta, DesafioCategoria } from "@/lib/desafios-types"
import { trackEvent } from "@/lib/analytics"
import { registrarAtividadeHoje } from "@/lib/atividade-diaria"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/i18n"
import { useIsContentEditor } from "@/lib/use-content-editor"
import { DesafioClinicoEditDialog } from "@/components/desafio-clinico-edit-dialog"
import { DesafioFeedbackDialog } from "@/components/desafio-feedback-dialog"
import { HighlightText } from "@/components/highlight-text"
import { FormattedText } from "@/components/formatted-text"
import { bloqueadoPorPlano } from "@/lib/desafio-clinico-bloqueio"
import { getPlanStatus } from "@/lib/plan-status"

function formatTimer(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${h}h ${m}m ${s}s`
}

interface Props {
  desafioId: string
}

export function DesafioClinicoEstudoContent({ desafioId }: Props) {
  const { t } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  const origemEtapaId = searchParams.get("origemEtapaId")
  const [desafio, setDesafio] = useState<DesafioClinico | null>(null)
  const [perguntas, setPerguntas] = useState<DesafioClinicoPergunta[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [respondidas, setRespondidas] = useState<Record<string, boolean>>({})
  const [selecaoAtual, setSelecaoAtual] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [imagemExpandida, setImagemExpandida] = useState(false)
  const [finalizado, setFinalizado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [bloqueadoPlanoGratuito, setBloqueadoPlanoGratuito] = useState(false)
  const [notaCorte, setNotaCorte] = useState(60)
  const isEditor = useIsContentEditor()
  const startRef = useRef<number | null>(null)

  const CATEGORIA_LABELS: Record<DesafioCategoria, string> = {
    anamnese: t.desafiosClinicos.categoria.anamnese,
    exame_fisico: t.desafiosClinicos.categoria.exameFisico,
    exames_complementares: t.desafiosClinicos.categoria.examesComplementares,
    diagnostico: t.desafiosClinicos.categoria.diagnostico,
    conduta: t.desafiosClinicos.categoria.conduta,
  }

  async function loadDesafio() {
    const [{ data: desafioData }, { data: perguntasData }, planStatus] = await Promise.all([
      supabase.from("desafios_clinicos").select("*").eq("id", desafioId).single(),
      supabase
        .from("desafios_clinicos_perguntas")
        .select("*")
        .eq("desafio_id", desafioId)
        .order("ordem", { ascending: true }),
      getPlanStatus(),
    ])
    const desafioCarregado = (desafioData as DesafioClinico) ?? null
    setDesafio(desafioCarregado)
    setPerguntas((perguntasData as DesafioClinicoPergunta[]) ?? [])

    setNotaCorte(planStatus?.notaCorte ?? 60)

    if (desafioCarregado) {
      const hasFullAccess = planStatus?.hasFullAccess ?? true
      setBloqueadoPlanoGratuito(bloqueadoPorPlano(desafioCarregado, hasFullAccess))
    }
  }

  useEffect(() => {
    loadDesafio().then(() => {
      setLoading(false)
      startRef.current = Date.now()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desafioId])

  async function handleEdicaoSalva() {
    await loadDesafio()
    setRespostas({})
    setRespondidas({})
    setSelecaoAtual(null)
    setCurrentIndex(0)
  }

  useEffect(() => {
    if (finalizado) return
    const interval = setInterval(() => {
      if (startRef.current) setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [finalizado])

  const perguntaAtual = perguntas[currentIndex]
  const jaRespondida = perguntaAtual ? !!respondidas[perguntaAtual.id] : false

  useEffect(() => {
    if (!perguntaAtual) return
    setSelecaoAtual(respostas[perguntaAtual.id] ?? null)
  }, [perguntaAtual, respostas])

  const acertosAtuais = useMemo(() => {
    return perguntas.reduce((acc, p) => {
      const resposta = respostas[p.id]
      if (!resposta) return acc
      const alt = p.alternativas.find((a) => a.id === resposta)
      return acc + (alt?.correta ? 1 : 0)
    }, 0)
  }, [perguntas, respostas])

  const accuracy = perguntas.length > 0 ? Math.round((acertosAtuais / perguntas.length) * 100) : 0
  const aprovado = accuracy >= notaCorte

  useEffect(() => {
    if (!finalizado || !aprovado) return
    const duration = 2000
    const end = Date.now() + duration
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ["#c6ff3a", "#84cc16", "#0a1f00"] })
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#c6ff3a", "#84cc16", "#0a1f00"] })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalizado, aprovado])

  function handleResponder() {
    if (!perguntaAtual || !selecaoAtual) return
    setRespostas((prev) => ({ ...prev, [perguntaAtual.id]: selecaoAtual }))
    setRespondidas((prev) => ({ ...prev, [perguntaAtual.id]: true }))
  }

  async function handleFinalizar() {
    setSalvando(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user.id
    if (userId) {
      await supabase.from("desafios_clinicos_historico").insert({
        user_id: userId,
        desafio_id: desafioId,
        acertos: acertosAtuais,
        total: perguntas.length,
        duracao_segundos: elapsed,
        origem_trilha_etapa_id: origemEtapaId,
      })
      trackEvent("desafio_finalizado", {
        desafio_id: desafioId,
        acertos: acertosAtuais,
        total: perguntas.length,
        duracao_segundos: elapsed,
      })
      registrarAtividadeHoje()
    }
    setSalvando(false)
    setFinalizado(true)
  }

  function handleEstudarNovamente() {
    setRespostas({})
    setRespondidas({})
    setSelecaoAtual(null)
    setCurrentIndex(0)
    setFinalizado(false)
    setElapsed(0)
    startRef.current = Date.now()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t.desafiosClinicos.carregandoDesafio}
      </div>
    )
  }

  if (!desafio) {
    return (
      <div className="rounded-lg border border-border bg-card/50 p-8 text-center">
        <p className="text-muted-foreground">{t.desafiosClinicos.desafioNaoEncontrado}</p>
        <Link href="/dashboard/desafios-clinicos" className="mt-3 inline-block text-sm text-primary">
          {t.desafiosClinicos.voltarAosDesafios}
        </Link>
      </div>
    )
  }

  if (bloqueadoPlanoGratuito && !isEditor) {
    return (
      <div className="rounded-lg border border-border bg-card/50 p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Lock className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="mt-3 text-lg font-bold text-foreground">{t.desafiosClinicos.casoBloqueadoPlanoTitulo}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {t.desafiosClinicos.casoBloqueadoPlanoDescricao}
        </p>
        <Link
          href="/#pricing"
          className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          {t.planBanner.cta}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/desafios-clinicos"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.desafiosClinicos.voltar}
        </Link>
        <div>
          <p className="text-right text-xs text-muted-foreground">{t.desafiosClinicos.tituloPagina}</p>
          <p className="text-right font-mono text-sm font-medium text-foreground">{formatTimer(elapsed)}</p>
        </div>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold leading-tight text-foreground">{desafio.titulo}</h1>
          {desafio.area && <p className="mt-1 text-sm text-muted-foreground">{desafio.area}</p>}
        </div>
        {isEditor && (
          <Button variant="outline" size="icon-sm" onClick={() => setEditDialogOpen(true)} aria-label="Editar caso clínico">
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex justify-end">
        <DesafioFeedbackDialog desafioTitulo={desafio.titulo} />
      </div>

      <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t.desafiosClinicos.descricaoCaso}
            </h2>
            <HighlightText text={desafio.descricao_caso} className="text-lg leading-relaxed text-foreground sm:text-[19px]" />
            <p className="mt-1 text-xs text-muted-foreground">{t.desafiosClinicos.sublinharDica}</p>
            {desafio.imagem_url && (
              <button
                type="button"
                onClick={() => setImagemExpandida(true)}
                className="group mt-4 flex items-center gap-3 rounded-lg border border-border bg-background/50 p-2 pr-4 transition-colors hover:border-primary/50"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-black">
                  <Image src={desafio.imagem_url} alt={t.desafiosClinicos.imagemCasoAlt} fill className="object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/50">
                    <ZoomIn className="h-4 w-4 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  {t.desafiosClinicos.verImagemAnexa}
                </span>
              </button>
            )}
          </div>

          {finalizado ? (
            <div className="space-y-6">
              <div className="rounded-lg border border-border bg-card p-8 text-center">
                <div
                  className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
                    aprovado ? "bg-success/10" : "bg-destructive/10"
                  }`}
                >
                  <Trophy className={`h-7 w-7 ${aprovado ? "text-success" : "text-destructive"}`} />
                </div>
                <p className={`mt-3 text-2xl font-extrabold ${aprovado ? "text-success" : "text-destructive"}`}>
                  {aprovado ? t.desafiosClinicos.aprovado : t.desafiosClinicos.reprovado}
                </p>
                <p className="mt-1 text-3xl font-bold text-gradient-brand">
                  {acertosAtuais}/{perguntas.length}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.desafiosClinicos.respostasCorretas} ({accuracy}%) · {t.desafiosClinicos.tempoLabel} {formatTimer(elapsed)}
                </p>
                <p className="mt-3 text-sm text-foreground">
                  {aprovado ? t.desafiosClinicos.mensagemAprovado : t.desafiosClinicos.mensagemReprovado}
                </p>
                <div className="mt-5 flex justify-center gap-3">
                  <Button variant="outline" onClick={handleEstudarNovamente} className="gap-1.5">
                    <RotateCcw className="h-4 w-4" />
                    {t.desafiosClinicos.estudarNovamente}
                  </Button>
                  <Button onClick={() => router.push("/dashboard/desafios-clinicos")}>
                    {t.desafiosClinicos.voltarAosDesafios}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t.desafiosClinicos.resumoDetalhado}
                </h2>
                <div className="space-y-5">
                  {perguntas.map((pergunta, index) => {
                    const respostaId = respostas[pergunta.id]
                    const respostaCorreta = pergunta.alternativas.find((a) => a.correta)
                    const altSelecionada = pergunta.alternativas.find((a) => a.id === respostaId)
                    const acertou = respostaId ? altSelecionada?.correta : false
                    return (
                      <div key={pergunta.id} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
                        <div className="mb-2 flex items-center gap-2">
                          {acertou ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                          ) : (
                            <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                          )}
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                            {CATEGORIA_LABELS[pergunta.categoria]}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {t.desafiosClinicos.perguntaLabel(index + 1)}
                          </span>
                        </div>
                        <p className="mb-2 text-sm font-medium text-foreground">{pergunta.enunciado}</p>
                        <div className="space-y-1 text-xs">
                          <p className={acertou ? "text-emerald-500" : "text-red-500"}>
                            {t.desafiosClinicos.suaResposta}{" "}
                            {pergunta.alternativas.find((a) => a.id === respostaId)?.texto ?? t.desafiosClinicos.naoRespondida}
                          </p>
                          {!acertou && (
                            <p className="text-emerald-500">
                              {t.desafiosClinicos.respostaCorretaLabel} {respostaCorreta?.texto}
                            </p>
                          )}
                        </div>
                        {!acertou && altSelecionada?.feedback && (
                          <FormattedText
                            text={altSelecionada.feedback}
                            className="mt-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs leading-relaxed text-foreground"
                          />
                        )}
                        {pergunta.explicacao && (
                          <FormattedText
                            text={pergunta.explicacao}
                            className="mt-2 rounded-lg bg-secondary/50 p-3 text-xs leading-relaxed text-muted-foreground"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {desafio.bibliografia.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-5">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {t.desafiosClinicos.referenciasBibliograficas}
                  </h2>
                  <ul className="space-y-1.5">
                    {desafio.bibliografia.map((ref) => (
                      <li key={ref.titulo}>
                        {ref.url ? (
                          <a
                            href={ref.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            {ref.titulo}
                          </a>
                        ) : (
                          <span className="text-sm text-foreground">{ref.titulo}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : perguntaAtual ? (
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                  {CATEGORIA_LABELS[perguntaAtual.categoria]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t.desafiosClinicos.perguntaXdeY(currentIndex + 1, perguntas.length)}
                </span>
              </div>

              <FormattedText
                text={perguntaAtual.enunciado}
                className="mb-5 text-lg font-medium leading-loose text-foreground sm:text-[20px] sm:leading-[1.7]"
              />

              <div className="space-y-3">
                {perguntaAtual.alternativas.map((alt, idx) => {
                  const selecionada = selecaoAtual === alt.id
                  let style =
                    "border-input hover:border-primary/50 text-foreground"
                  if (jaRespondida) {
                    if (alt.correta) style = "border-emerald-500 bg-emerald-500/10 text-foreground"
                    else if (selecionada) style = "border-red-500 bg-red-500/10 text-foreground"
                    else style = "border-input opacity-60 text-foreground"
                  } else if (selecionada) {
                    style = "border-primary bg-primary/10 text-foreground"
                  }
                  const textoFeedback = jaRespondida ? (alt.correta ? perguntaAtual.explicacao : alt.feedback) : null
                  return (
                    <div
                      key={alt.id}
                      className={`flex w-full flex-col gap-3 rounded-xl border p-4 text-left text-sm transition-colors sm:p-5 sm:text-[18px] ${style} ${
                        jaRespondida ? "" : "cursor-pointer"
                      }`}
                      onClick={() => !jaRespondida && setSelecaoAtual(alt.id)}
                    >
                      <div className="flex w-full items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold text-foreground sm:h-9 sm:w-9 sm:text-base">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span>{alt.texto}</span>
                        </div>
                        {jaRespondida && alt.correta && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />}
                        {jaRespondida && !alt.correta && selecionada && (
                          <XCircle className="h-5 w-5 shrink-0 text-red-500" />
                        )}
                      </div>
                      {textoFeedback && (
                        <FormattedText
                          text={textoFeedback}
                          className={`border-t pt-3 text-sm leading-relaxed sm:text-base ${
                            alt.correta ? "border-emerald-500/30 text-foreground/90" : "border-red-500/30 text-foreground/90"
                          }`}
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="mt-5 flex items-center justify-between">
                <Button
                  variant="outline"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                >
                  {t.desafiosClinicos.anterior}
                </Button>

                {!jaRespondida ? (
                  <Button disabled={!selecaoAtual} onClick={handleResponder}>
                    {t.desafiosClinicos.responder}
                  </Button>
                ) : currentIndex < perguntas.length - 1 ? (
                  <Button onClick={() => setCurrentIndex((i) => i + 1)}>{t.desafiosClinicos.proxima}</Button>
                ) : (
                  <Button disabled={salvando} onClick={handleFinalizar} className="gap-1.5">
                    {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t.desafiosClinicos.finalizar}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card/50 p-8 text-center">
              <p className="text-muted-foreground">{t.desafiosClinicos.desafioSemPerguntas}</p>
            </div>
          )}
        </div>

      {imagemExpandida && desafio.imagem_url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setImagemExpandida(false)}
        >
          <button
            type="button"
            onClick={() => setImagemExpandida(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label={t.desafiosClinicos.fecharImagem}
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative h-full w-full max-w-5xl">
            <Image
              src={desafio.imagem_url}
              alt={t.desafiosClinicos.imagemCasoAlt}
              fill
              className="object-contain"
            />
          </div>
        </div>
      )}

      {isEditor && (
        <DesafioClinicoEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          desafio={desafio}
          onSaved={handleEdicaoSalva}
        />
      )}
    </div>
  )
}
