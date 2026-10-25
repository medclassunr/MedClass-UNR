"use client"

import { useEffect, useMemo, useState } from "react"
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns"
import { ptBR, es } from "date-fns/locale"
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  MessageSquarePlus,
  Check,
  Send,
  ExternalLink,
  Bell,
  BellRing,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useLanguage } from "@/lib/i18n"
import type { CalendarioEvento, CalendarioEventoTipo } from "@/lib/calendario-types"
import { buscarMeusLembretes, criarLembrete, removerLembrete } from "@/lib/calendario-lembretes"

type Visao = "mes" | "semana"

const TIPO_COR: Record<CalendarioEventoTipo, { dot: string; badge: string; text: string; border: string }> = {
  inscricao: { dot: "bg-blue-500", badge: "bg-blue-500/15", text: "text-blue-600", border: "border-blue-500" },
  prova: { dot: "bg-red-500", badge: "bg-red-500/15", text: "text-red-600", border: "border-red-500" },
  comunidade: { dot: "bg-emerald-500", badge: "bg-emerald-500/15", text: "text-emerald-600", border: "border-emerald-500" },
  cursado: { dot: "bg-amber-500", badge: "bg-amber-500/15", text: "text-amber-600", border: "border-amber-500" },
  pessoal: { dot: "bg-violet-500", badge: "bg-violet-500/15", text: "text-violet-600", border: "border-violet-500" },
}

export function CalendarioContent() {
  const { t, lang } = useLanguage()
  const localeDf = lang === "es" ? es : ptBR

  const [loading, setLoading] = useState(true)
  const [eventos, setEventos] = useState<CalendarioEvento[]>([])
  const [visao, setVisao] = useState<Visao>("mes")
  const [mesAtual, setMesAtual] = useState(() => startOfMonth(new Date()))
  const [semanaAtual, setSemanaAtual] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [meusLembretes, setMeusLembretes] = useState<Map<string, string>>(new Map())
  const [lembreteCarregando, setLembreteCarregando] = useState<string | null>(null)

  const [novoEventoAberto, setNovoEventoAberto] = useState(false)
  const [editandoEventoId, setEditandoEventoId] = useState<string | null>(null)
  const [novoTitulo, setNovoTitulo] = useState("")
  const [novaData, setNovaData] = useState("")
  const [novaHora, setNovaHora] = useState("")
  const [novaDescricao, setNovaDescricao] = useState("")
  const [salvandoEvento, setSalvandoEvento] = useState(false)
  const [erroNovoEvento, setErroNovoEvento] = useState<string | null>(null)

  const [sugestaoAberta, setSugestaoAberta] = useState(false)
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [mensagem, setMensagem] = useState("")
  const [dataSugerida, setDataSugerida] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erroSugestao, setErroSugestao] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const [{ data: eventosData }, { data: userData }] = await Promise.all([
        supabase.from("calendario_eventos").select("*").eq("ativo", true).order("data", { ascending: true }),
        supabase.auth.getUser(),
      ])
      setEventos((eventosData as CalendarioEvento[]) ?? [])
      if (userData.user?.email) setEmail(userData.user.email)
      if (userData.user?.id) {
        setUserId(userData.user.id)
        setMeusLembretes(await buscarMeusLembretes(userData.user.id))
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleToggleLembrete = async (eventoId: string) => {
    if (!userId) return
    setLembreteCarregando(eventoId)
    const lembreteId = meusLembretes.get(eventoId)
    if (lembreteId) {
      await removerLembrete(lembreteId)
      setMeusLembretes((prev) => {
        const next = new Map(prev)
        next.delete(eventoId)
        return next
      })
    } else {
      const { data } = await criarLembrete(userId, eventoId)
      if (data) {
        setMeusLembretes((prev) => new Map(prev).set(eventoId, data.id))
      }
    }
    setLembreteCarregando(null)
  }

  const resetNovoEvento = () => {
    setNovoEventoAberto(false)
    setEditandoEventoId(null)
    setNovoTitulo("")
    setNovaData("")
    setNovaHora("")
    setNovaDescricao("")
    setErroNovoEvento(null)
  }

  const abrirNovoEvento = () => {
    setEditandoEventoId(null)
    setNovoTitulo("")
    setNovaData(format(diaSelecionado ?? new Date(), "yyyy-MM-dd"))
    setNovaHora("")
    setNovaDescricao("")
    setErroNovoEvento(null)
    setNovoEventoAberto(true)
  }

  // Botão de destaque na barra do calendário: abre o modal já no formulário
  // de criação (começa em hoje, mas a data é editável no próprio formulário).
  const abrirCriarEventoGlobal = () => {
    const hoje = new Date()
    setDiaSelecionado(hoje)
    setEditandoEventoId(null)
    setNovoTitulo("")
    setNovaData(format(hoje, "yyyy-MM-dd"))
    setNovaHora("")
    setNovaDescricao("")
    setErroNovoEvento(null)
    setNovoEventoAberto(true)
  }

  const abrirEdicaoEvento = (evento: CalendarioEvento) => {
    setEditandoEventoId(evento.id)
    setNovoTitulo(evento.titulo)
    setNovaData(evento.data)
    setNovaHora(evento.hora ?? "")
    setNovaDescricao(evento.descricao ?? "")
    setErroNovoEvento(null)
    setNovoEventoAberto(true)
  }

  const handleSalvarEventoPessoal = async () => {
    if (!userId) return
    if (!novoTitulo.trim()) {
      setErroNovoEvento(t.calendario.novoEventoTituloObrigatorio)
      return
    }
    if (!novaData) {
      setErroNovoEvento(t.calendario.novoEventoErro)
      return
    }
    setSalvandoEvento(true)
    setErroNovoEvento(null)

    if (editandoEventoId) {
      const { data, error } = await supabase
        .from("calendario_eventos")
        .update({
          titulo: novoTitulo.trim(),
          descricao: novaDescricao.trim() || null,
          data: novaData,
          hora: novaHora || null,
        })
        .eq("id", editandoEventoId)
        .select("*")
        .single()
      setSalvandoEvento(false)
      if (error || !data) {
        setErroNovoEvento(t.calendario.novoEventoErro)
        return
      }
      setEventos((prev) => prev.map((e) => (e.id === editandoEventoId ? (data as CalendarioEvento) : e)))
      resetNovoEvento()
      return
    }

    const { data, error } = await supabase
      .from("calendario_eventos")
      .insert({
        user_id: userId,
        titulo: novoTitulo.trim(),
        descricao: novaDescricao.trim() || null,
        data: novaData,
        hora: novaHora || null,
        tipo: "pessoal",
      })
      .select("*")
      .single()

    if (error || !data) {
      setSalvandoEvento(false)
      setErroNovoEvento(t.calendario.novoEventoErro)
      return
    }
    setEventos((prev) => [...prev, data as CalendarioEvento])

    // Todo evento criado já nasce com o ALERTA ATIVADO (pedido do usuário) --
    // cria o lembrete automaticamente, pra receber o push no celular na hora
    // e 15 min antes. Se falhar, o evento continua salvo (não bloqueia).
    const { data: lembrete } = await criarLembrete(userId, data.id)
    if (lembrete) {
      setMeusLembretes((prev) => new Map(prev).set(data.id, lembrete.id))
    }

    setSalvandoEvento(false)
    resetNovoEvento()
  }

  const handleExcluirEventoPessoal = async (eventoId: string) => {
    if (!confirm(t.calendario.confirmarExcluirEvento)) return
    const { error } = await supabase.from("calendario_eventos").delete().eq("id", eventoId)
    if (error) return
    setEventos((prev) => prev.filter((e) => e.id !== eventoId))
  }

  const eventosPorDia = useMemo(() => {
    const map = new Map<string, CalendarioEvento[]>()
    for (const evento of eventos) {
      const key = evento.data
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(evento)
    }
    return map
  }, [eventos])

  const eventosDoDiaSelecionado = useMemo(() => {
    if (!diaSelecionado) return []
    return eventosPorDia.get(format(diaSelecionado, "yyyy-MM-dd")) ?? []
  }, [diaSelecionado, eventosPorDia])

  const meusEventos = useMemo(() => {
    if (!userId) return []
    return eventos.filter((e) => e.user_id === userId).sort((a, b) => a.data.localeCompare(b.data))
  }, [eventos, userId])

  const handleEditarDaLista = (evento: CalendarioEvento) => {
    setDiaSelecionado(new Date(`${evento.data}T00:00:00`))
    abrirEdicaoEvento(evento)
  }

  const diasDaSemana = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(semanaAtual, i)), [semanaAtual])

  const diasDaGrade = useMemo(() => {
    const inicio = startOfWeek(startOfMonth(mesAtual), { weekStartsOn: 1 })
    const fim = endOfWeek(endOfMonth(mesAtual), { weekStartsOn: 1 })
    return eachDayOfInterval({ start: inicio, end: fim })
  }, [mesAtual])

  const handleHoje = () => {
    setMesAtual(startOfMonth(new Date()))
    setSemanaAtual(startOfWeek(new Date(), { weekStartsOn: 1 }))
  }

  const handleSugestaoOpenChange = (next: boolean) => {
    setSugestaoAberta(next)
    if (!next) {
      setMensagem("")
      setDataSugerida("")
      setEnviado(false)
      setErroSugestao(null)
    }
  }

  const handleEnviarSugestao = async () => {
    setErroSugestao(null)
    if (!mensagem.trim()) {
      setErroSugestao(t.calendario.sugestaoMensagemObrigatoria)
      return
    }
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    setEnviando(true)
    const { error } = await supabase.from("calendario_sugestoes").insert({
      user_id: userData.user.id,
      nome: nome.trim() || userData.user.email || "",
      email,
      mensagem: mensagem.trim(),
      data_sugerida: dataSugerida || null,
      status: "pendente",
    })
    setEnviando(false)

    if (error) {
      setErroSugestao(t.calendario.sugestaoErro)
      return
    }
    setEnviado(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t.calendario.carregando}
      </div>
    )
  }

  const renderEventChip = (evento: CalendarioEvento) => (
    <span
      key={evento.id}
      className={`block truncate rounded px-2 py-1 text-left text-sm font-medium leading-snug sm:text-[15px] ${TIPO_COR[evento.tipo].badge} ${TIPO_COR[evento.tipo].text}`}
    >
      {evento.hora ? `${evento.hora} · ` : ""}
      {evento.titulo}
    </span>
  )

  return (
    // A largura total já vem do DashboardLayout com fullWidth (sem o max-w-7xl padrão).
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gradient-brand sm:text-3xl">{t.calendario.titulo}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.calendario.subtitulo}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="gradient" size="sm" className="gap-1.5" onClick={abrirCriarEventoGlobal}>
            <Plus className="h-4 w-4" />
            {t.calendario.criarEventoBotao}
          </Button>
          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            <button
              type="button"
              onClick={() => setVisao("mes")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                visao === "mes" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {t.calendario.visaoMes}
            </button>
            <button
              type="button"
              onClick={() => setVisao("semana")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                visao === "semana" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {t.calendario.visaoSemana}
            </button>
          </div>
        </div>
      </div>

      {/* Aviso: criar eventos próprios + ativar notificações */}
      <div className="relative mb-5 overflow-hidden rounded-2xl border border-[#c6ff3a]/40 bg-[#c6ff3a]/[0.04] p-5 shadow-[0_0_24px_-8px_rgba(198,255,58,0.35)]">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#c6ff3a]/40 bg-[#c6ff3a]/10 text-[#bef264]">
            <Bell className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">{t.calendario.avisoTitulo}</p>
            <p className="text-sm text-muted-foreground">{t.calendario.avisoTexto}</p>
          </div>
        </div>
      </div>

      {/* Legenda de tipos */}
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2">
        {(Object.keys(TIPO_COR) as CalendarioEventoTipo[]).map((tipo) => (
          <span key={tipo} className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className={`h-2.5 w-2.5 rounded-full ${TIPO_COR[tipo].dot}`} />
            {t.calendario.tipoLabel[tipo]}
          </span>
        ))}
      </div>

      {/* Navegação de período */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => (visao === "mes" ? setMesAtual((d) => subMonths(d, 1)) : setSemanaAtual((d) => subWeeks(d, 1)))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => (visao === "mes" ? setMesAtual((d) => addMonths(d, 1)) : setSemanaAtual((d) => addWeeks(d, 1)))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleHoje} className="ml-1">
            {t.calendario.hoje}
          </Button>
        </div>
        <p className="text-base font-semibold capitalize text-foreground sm:text-lg">
          {visao === "mes"
            ? format(mesAtual, "MMMM yyyy", { locale: localeDf })
            : `${format(diasDaSemana[0], "d MMM", { locale: localeDf })} – ${format(diasDaSemana[6], "d MMM yyyy", { locale: localeDf })}`}
        </p>
      </div>

      {visao === "mes" ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-7 gap-px bg-border">
            {diasDaGrade.slice(0, 7).map((dia) => (
              <div
                key={`cabecalho-${dia.toISOString()}`}
                className="bg-muted/40 py-3 text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {format(dia, "EEE", { locale: localeDf })}
              </div>
            ))}
            {diasDaGrade.map((dia) => {
              const doDia = eventosPorDia.get(format(dia, "yyyy-MM-dd")) ?? []
              const hoje = isSameDay(dia, new Date())
              const foraDoMes = !isSameMonth(dia, mesAtual)
              return (
                <button
                  key={dia.toISOString()}
                  type="button"
                  onClick={() => setDiaSelecionado(dia)}
                  className={`flex min-h-[130px] flex-col items-start gap-1.5 bg-card p-2.5 text-left transition-colors hover:bg-accent sm:min-h-[150px] sm:p-3 ${
                    foraDoMes ? "opacity-40" : ""
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base font-medium ${
                      hoje ? "bg-primary text-primary-foreground" : "text-foreground"
                    }`}
                  >
                    {format(dia, "d")}
                  </span>
                  <div className="flex w-full flex-col gap-1.5 overflow-hidden">
                    {doDia.slice(0, 2).map(renderEventChip)}
                    {doDia.length > 2 && (
                      <span className="text-xs font-medium text-muted-foreground">+{doDia.length - 2}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-7 gap-px bg-border">
            {diasDaSemana.map((dia) => {
              const hoje = isSameDay(dia, new Date())
              return (
                <div key={`cabecalho-${dia.toISOString()}`} className="bg-muted/40 py-3 text-center">
                  <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {format(dia, "EEE", { locale: localeDf })}
                  </p>
                  <p className={`text-base font-semibold ${hoje ? "text-primary" : "text-foreground"}`}>{format(dia, "d")}</p>
                </div>
              )
            })}
            {diasDaSemana.map((dia) => {
              const doDia = eventosPorDia.get(format(dia, "yyyy-MM-dd")) ?? []
              return (
                <button
                  key={dia.toISOString()}
                  type="button"
                  onClick={() => setDiaSelecionado(dia)}
                  className="flex min-h-[320px] flex-col items-start gap-2 bg-card p-2.5 text-left transition-colors hover:bg-accent sm:p-3"
                >
                  {doDia.length === 0 ? (
                    <span className="mt-2 w-full text-center text-sm text-muted-foreground/60">—</span>
                  ) : (
                    doDia.map(renderEventChip)
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Meus eventos pessoais */}
      {userId && meusEventos.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t.calendario.meusEventosTitulo}
          </h3>
          <div className="space-y-2">
            {meusEventos.map((evento) => (
              <div
                key={evento.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3"
              >
                <button
                  type="button"
                  onClick={() => setDiaSelecionado(new Date(`${evento.data}T00:00:00`))}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="text-sm font-medium text-foreground">{evento.titulo}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {format(new Date(`${evento.data}T00:00:00`), "d 'de' MMMM 'de' yyyy", { locale: localeDf })}
                    {evento.hora ? ` · ${evento.hora}` : ""}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleEditarDaLista(evento)}
                    title={t.calendario.editarEvento}
                    className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExcluirEventoPessoal(evento.id)}
                    title={t.calendario.excluirEvento}
                    className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botão flutuante */}
      <button
        type="button"
        onClick={() => setSugestaoAberta(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-[#c6ff3a] to-[#84cc16] px-5 py-3 text-sm font-semibold text-[#0a1f00] shadow-lg shadow-primary/20 transition-transform hover:scale-105"
      >
        <MessageSquarePlus className="h-4 w-4" />
        <span className="hidden sm:inline">{t.calendario.ctaSugestao}</span>
      </button>

      {/* Modal do dia */}
      <Dialog
        open={!!diaSelecionado}
        onOpenChange={(v) => {
          if (!v) {
            setDiaSelecionado(null)
            resetNovoEvento()
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {diaSelecionado ? format(diaSelecionado, "d 'de' MMMM 'de' yyyy", { locale: localeDf }) : ""}
            </DialogTitle>
          </DialogHeader>
          {eventosDoDiaSelecionado.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t.calendario.modalDiaSemEventos}</p>
          ) : (
            <div className="max-h-[60vh] space-y-3 overflow-y-auto py-1">
              {eventosDoDiaSelecionado.map((evento) => {
                const cor = TIPO_COR[evento.tipo]
                const lembreteAtivo = meusLembretes.has(evento.id)
                return (
                  <div key={evento.id} className={`rounded-lg border-l-4 ${cor.border} border-y border-r border-border bg-card p-3`}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className={`rounded-full ${cor.badge} ${cor.text} px-2 py-0.5 text-[11px] font-medium`}>
                        {t.calendario.tipoLabel[evento.tipo]}
                      </span>
                      <div className="flex items-center gap-2">
                        {evento.hora && <span className="text-xs text-muted-foreground">{evento.hora}</span>}
                        {userId && (
                          <button
                            type="button"
                            onClick={() => handleToggleLembrete(evento.id)}
                            disabled={lembreteCarregando === evento.id}
                            title={lembreteAtivo ? t.calendario.lembreteRemover : t.calendario.lembreteCriar}
                            className={`flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors ${
                              lembreteAtivo
                                ? "text-primary hover:bg-primary/10"
                                : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            }`}
                          >
                            {lembreteCarregando === evento.id ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : lembreteAtivo ? (
                              <BellRing className="h-5 w-5 text-primary" />
                            ) : (
                              <Bell className="h-5 w-5" />
                            )}
                            <span className="text-xs font-bold text-primary">
                              {lembreteAtivo ? t.calendario.lembreteRemover : t.calendario.lembreteCriar}
                            </span>
                          </button>
                        )}
                        {evento.user_id === userId && (
                          <>
                            <button
                              type="button"
                              onClick={() => abrirEdicaoEvento(evento)}
                              title={t.calendario.editarEvento}
                              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExcluirEventoPessoal(evento.id)}
                              title={t.calendario.excluirEvento}
                              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{evento.titulo}</p>
                    {evento.descricao && <p className="mt-1 text-sm text-muted-foreground">{evento.descricao}</p>}
                    {evento.link && (
                      <a
                        href={evento.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        {t.calendario.saibaMais}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {userId && (
            <div className="border-t border-border pt-3">
              {novoEventoAberto ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    {editandoEventoId ? t.calendario.editarEventoPessoal : t.calendario.novoEventoPessoal}
                  </p>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t.calendario.novoEventoTitulo}</label>
                    <Input
                      value={novoTitulo}
                      onChange={(e) => setNovoTitulo(e.target.value)}
                      placeholder={t.calendario.novoEventoTituloPlaceholder}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">{t.calendario.novoEventoData}</label>
                      <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-foreground">{t.calendario.novoEventoHora}</label>
                      <Input type="time" value={novaHora} onChange={(e) => setNovaHora(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">{t.calendario.novoEventoDescricao}</label>
                    <Textarea
                      value={novaDescricao}
                      onChange={(e) => setNovaDescricao(e.target.value)}
                      className="min-h-16"
                    />
                  </div>
                  {!editandoEventoId && (
                    <p className="flex items-start gap-1.5 rounded-lg bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                      <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      {t.calendario.novoEventoAlertaInfo}
                    </p>
                  )}
                  {erroNovoEvento && <p className="text-sm text-destructive">{erroNovoEvento}</p>}
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={resetNovoEvento}>
                      {t.calendario.cancelar}
                    </Button>
                    <Button
                      variant="gradient"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleSalvarEventoPessoal}
                      disabled={salvandoEvento}
                    >
                      {salvandoEvento ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {salvandoEvento ? t.calendario.novoEventoSalvando : t.calendario.novoEventoSalvar}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={abrirNovoEvento}>
                  <Plus className="h-4 w-4" />
                  {t.calendario.novoEventoPessoal}
                </Button>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDiaSelecionado(null)}>
              {t.calendario.fechar}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de sugestão */}
      <Dialog open={sugestaoAberta} onOpenChange={handleSugestaoOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.calendario.sugestaoDialogTitulo}</DialogTitle>
          </DialogHeader>

          {enviado ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                <Check className="h-5 w-5 text-success" />
              </div>
              <p className="text-sm font-medium text-foreground">{t.calendario.sugestaoEnviada}</p>
            </div>
          ) : (
            <div className="space-y-4 py-1">
              <p className="text-sm text-muted-foreground">{t.calendario.sugestaoDialogDescricao}</p>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t.calendario.sugestaoMensagem}</label>
                <Textarea
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder={t.calendario.sugestaoMensagemPlaceholder}
                  className="min-h-28"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t.calendario.sugestaoDataSugerida}</label>
                <Input type="date" value={dataSugerida} onChange={(e) => setDataSugerida(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Nome</label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={email || ""} />
              </div>

              {erroSugestao && <p className="text-sm text-destructive">{erroSugestao}</p>}
            </div>
          )}

          <DialogFooter>
            {enviado ? (
              <Button variant="outline" onClick={() => handleSugestaoOpenChange(false)}>
                {t.calendario.voltar}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => handleSugestaoOpenChange(false)}>
                  {t.calendario.cancelar}
                </Button>
                <Button variant="gradient" onClick={handleEnviarSugestao} disabled={enviando} className="gap-1.5">
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {enviando ? t.calendario.sugestaoEnviando : t.calendario.sugestaoEnviar}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
