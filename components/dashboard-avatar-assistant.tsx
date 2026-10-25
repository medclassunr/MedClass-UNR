"use client"

// Avatar fixo no canto superior direito (visível em qualquer página do
// dashboard, via DashboardLayout) com duas funções:
//
// 1. Lembretes do Cronograma/Calendario: substitui o antigo
//    CalendarioLembretesBanner (banner de texto fixo no topo da página) --
//    agora aparece como um balão de pensamento (nuvem) saindo do avatar,
//    automaticamente, quando existe algum lembrete ativo. Clicar no avatar
//    dispensa o balão (só nesta sessão -- calendario_lembretes não tem
//    flag de "visto", e um dismiss client-side é suficiente pro pedido).
// 2. Sem lembrete ativo, clicar no avatar abre/fecha um FAQ (mesmo balão)
//    com a lista de funcionalidades da plataforma -- clicar num tópico
//    mostra a explicação detalhada reaproveitando abrirAjudaPagina() +
//    o mesmo texto já escrito pro tour (lib/i18n.tsx, tutorialDashboard).

import { useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { ptBR, es } from "date-fns/locale"
import { ChevronLeft, ChevronRight, BellRing } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { buscarLembretesAtivos } from "@/lib/calendario-lembretes"
import type { CalendarioLembreteAtivo } from "@/lib/calendario-types"
import { useLanguage } from "@/lib/i18n"
import { useTutorial, AVATAR_FRAMES, type TutorialStep } from "@/components/onboarding-tutorial"
import { ativarPush, estadoPush, iosPrecisaInstalar, type EstadoPush } from "@/lib/push-client"

// Pose fixa (não sorteada) -- este avatar é um ícone fixo/reconhecível,
// diferente das poses aleatórias do card do tour.
const AVATAR_ICONE = AVATAR_FRAMES[0].src

function passoUnico(tituloKey: TutorialStep["tituloKey"], textoKey: TutorialStep["textoKey"]): TutorialStep[] {
  return [{ tituloKey, textoKey, selector: null }]
}

const FAQ_TOPICOS: { id: string; tituloKey: TutorialStep["tituloKey"]; passos: TutorialStep[] }[] = [
  { id: "simulado-livre", tituloKey: "simuladoLivreTitulo", passos: passoUnico("simuladoLivreTitulo", "simuladoLivreTexto") },
  { id: "simulado-timer", tituloKey: "simuladoTimerTitulo", passos: passoUnico("simuladoTimerTitulo", "simuladoTimerTexto") },
  { id: "desafios", tituloKey: "desafiosTitulo", passos: passoUnico("desafiosTitulo", "desafiosTexto") },
  { id: "hospital", tituloKey: "hospitalTitulo", passos: passoUnico("hospitalTitulo", "hospitalTexto") },
  { id: "cronograma", tituloKey: "cronogramaTitulo", passos: passoUnico("cronogramaTitulo", "cronogramaTexto") },
  { id: "atividades-unr", tituloKey: "atividadesUnrTitulo", passos: passoUnico("atividadesUnrTitulo", "atividadesUnrTexto") },
  { id: "calendario", tituloKey: "calendarioTitulo", passos: passoUnico("calendarioTitulo", "calendarioTexto") },
  { id: "mesa-oral", tituloKey: "mesaOralTitulo", passos: passoUnico("mesaOralTitulo", "mesaOralTexto") },
  { id: "materiais", tituloKey: "materiaisTitulo", passos: passoUnico("materiaisTitulo", "materiaisTexto") },
  { id: "desempenho", tituloKey: "desempenhoTitulo", passos: passoUnico("desempenhoTitulo", "desempenhoTexto") },
  { id: "ranking", tituloKey: "rankingTitulo", passos: passoUnico("rankingTitulo", "rankingTexto") },
  { id: "comunidade", tituloKey: "comunidadeTitulo", passos: passoUnico("comunidadeTitulo", "comunidadeTexto") },
  {
    id: "planos-premium",
    tituloKey: "planosTitulo",
    passos: [{ tituloKey: "planosTitulo", textoKey: "planosTexto", selector: null, ctaWhatsapp: true }],
  },
]

export function DashboardAvatarAssistant() {
  const { t, lang } = useLanguage()
  const { abrirAjudaPagina } = useTutorial()
  const localeDf = lang === "es" ? es : ptBR

  const [lembretes, setLembretes] = useState<CalendarioLembreteAtivo[]>([])
  const [dispensados, setDispensados] = useState<Set<string>>(new Set())
  const [faqAberto, setFaqAberto] = useState(false)
  // Permite esconder o avatar (ex.: se ele atrapalhar algo na tela no
  // mobile) -- a setinha continua visível, fixa na borda, pra reabrir.
  const [escondido, setEscondido] = useState(false)
  // Frase motivacional que aparece sozinha de tempos em tempos (balão que
  // some sozinho). Prioridade MAIS BAIXA: nunca cobre atualização/lembrete/FAQ.
  const [frase, setFrase] = useState<string | null>(null)
  // Estado do push NESTE aparelho -- se não estiver "ativo", o avatar oferece
  // o botão de ativar (o aluno recebe o aviso no app, mas não no celular).
  const [pushEstado, setPushEstado] = useState<EstadoPush | "carregando">("carregando")
  const [pushDispensado, setPushDispensado] = useState(false)
  const [pushOcupado, setPushOcupado] = useState(false)

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const ativos = await buscarLembretesAtivos(data.user.id)
      if (active) setLembretes(ativos)
    })
    return () => {
      active = false
    }
  }, [])

  const lembreteAtivo = useMemo(
    () => lembretes.find((l) => !dispensados.has(l.id)) ?? null,
    [lembretes, dispensados]
  )

  // Checa o estado do push ao abrir e toda vez que o app volta pro primeiro
  // plano (pega quando o aluno ativou em Configurações e voltou pra cá).
  useEffect(() => {
    const checar = () => estadoPush().then(setPushEstado)
    checar()
    const aoVoltar = () => {
      if (document.visibilityState === "visible") checar()
    }
    document.addEventListener("visibilitychange", aoVoltar)
    return () => document.removeEventListener("visibilitychange", aoVoltar)
  }, [])

  // Mostra o convite pra ativar push quando dá pra ativar (inativo), quando
  // está bloqueado (negado) ou quando é iOS que precisa instalar o app. Se o
  // navegador simplesmente não suporta, não insiste (não adianta).
  const pushPrecisaAtivar =
    !pushDispensado &&
    (pushEstado === "inativo" ||
      pushEstado === "negado" ||
      (pushEstado === "nao-suportado" && iosPrecisaInstalar()))

  const aoAtivarPush = async () => {
    setPushOcupado(true)
    try {
      setPushEstado(await ativarPush())
    } finally {
      setPushOcupado(false)
    }
  }

  // Mostra uma frase motivacional: logo depois de abrir o app (com saudação do
  // período) e depois a cada ~4 min, desde que nada mais importante esteja no
  // balão. Reatribuo o ref todo render pra ele sempre ler o estado atual.
  const esconderFraseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mostrarFraseRef = useRef<(comSaudacao: boolean) => void>(() => {})
  mostrarFraseRef.current = (comSaudacao: boolean) => {
    if (escondido || pushPrecisaAtivar || lembreteAtivo || faqAberto) return
    const lista = t.tutorialDashboard.frasesMotivacionais
    if (!lista?.length) return
    const h = new Date().getHours()
    const saudacao =
      h < 12 ? t.tutorialDashboard.saudacaoManha : h < 19 ? t.tutorialDashboard.saudacaoTarde : t.tutorialDashboard.saudacaoNoite
    const sorteada = lista[Math.floor(Math.random() * lista.length)]
    setFrase(comSaudacao ? `${saudacao} ${sorteada}` : sorteada)
    if (esconderFraseTimer.current) clearTimeout(esconderFraseTimer.current)
    esconderFraseTimer.current = setTimeout(() => setFrase(null), 9000)
  }

  useEffect(() => {
    const inicial = setTimeout(() => mostrarFraseRef.current(true), 6000)
    const intervalo = setInterval(() => mostrarFraseRef.current(false), 4 * 60 * 1000)
    return () => {
      clearTimeout(inicial)
      clearInterval(intervalo)
      if (esconderFraseTimer.current) clearTimeout(esconderFraseTimer.current)
    }
  }, [])

  function aoClicarAvatar() {
    if (lembreteAtivo) {
      setDispensados((prev) => new Set(prev).add(lembreteAtivo.id))
      return
    }
    // Abrir o FAQ dispensa a frase motivacional que por acaso esteja aberta.
    setFrase(null)
    setFaqAberto((v) => !v)
  }

  function aoClicarTopico(passos: TutorialStep[]) {
    setFaqAberto(false)
    abrirAjudaPagina(passos)
  }

  const mostrarBalao = !escondido && (faqAberto || pushPrecisaAtivar || !!lembreteAtivo || !!frase)
  const mostrarBadge = pushPrecisaAtivar || !!lembreteAtivo

  if (escondido) {
    return (
      <button
        type="button"
        onClick={() => setEscondido(false)}
        aria-label={t.tutorialDashboard.mostrarAvatar}
        title={t.tutorialDashboard.mostrarAvatar}
        className="fixed right-0 top-[88px] z-[120] flex h-11 w-7 items-center justify-center rounded-l-full border border-r-0 border-primary/50 bg-card shadow-lg transition-transform hover:-translate-x-0.5"
      >
        <ChevronLeft className="h-4 w-4 text-primary" />
        {mostrarBadge && (
          <span className="absolute left-0.5 top-0.5 h-2 w-2 rounded-full bg-destructive" />
        )}
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={aoClicarAvatar}
        aria-label={lembreteAtivo ? t.tutorialDashboard.clicarParaFechar : t.tutorialDashboard.faqTitulo}
        title={lembreteAtivo ? t.tutorialDashboard.clicarParaFechar : t.tutorialDashboard.faqTitulo}
        className="animate-avatar-flutua fixed right-4 top-[72px] z-[120] h-24 w-24 overflow-hidden rounded-full border-[3px] border-primary/50 bg-card shadow-xl transition-shadow hover:shadow-primary/40 hover:shadow-2xl"
      >
        <img src={AVATAR_ICONE} alt="" className="h-full w-full object-cover object-top" />
        {mostrarBadge && (
          <span className="absolute right-1 top-1 h-4 w-4 animate-pulse rounded-full border-2 border-card bg-destructive" />
        )}
      </button>

      <button
        type="button"
        onClick={() => setEscondido(true)}
        aria-label={t.tutorialDashboard.esconderAvatar}
        title={t.tutorialDashboard.esconderAvatar}
        className="fixed right-[94px] top-[104px] z-[120] flex h-9 w-6 items-center justify-center rounded-l-full border border-r-0 border-border bg-card/90 text-muted-foreground shadow-md transition-colors hover:text-primary"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {mostrarBalao && (
        <div className="animate-avatar-balao fixed right-3 top-[180px] z-[120] w-[min(300px,calc(100vw-1.5rem))]">
          <div className="relative rounded-2xl border border-border bg-card p-4 shadow-2xl">
            <span className="absolute -top-1.5 right-10 h-3 w-3 rotate-45 border-l border-t border-border bg-card" />

            {faqAberto ? (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">
                  {t.tutorialDashboard.faqTitulo}
                </p>
                <div className="flex max-h-[60vh] flex-col gap-0.5 overflow-y-auto">
                  {FAQ_TOPICOS.map((topico) => (
                    <button
                      key={topico.id}
                      type="button"
                      onClick={() => aoClicarTopico(topico.passos)}
                      className="rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
                    >
                      {t.tutorialDashboard[topico.tituloKey]}
                    </button>
                  ))}
                </div>
              </div>
            ) : pushPrecisaAtivar ? (
              <div>
                <p className="text-sm font-semibold text-foreground">{t.tutorialDashboard.pushNudgeTitulo}</p>
                {pushEstado === "negado" ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">{t.tutorialDashboard.pushNudgeNegado}</p>
                ) : pushEstado === "nao-suportado" ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">{t.tutorialDashboard.pushNudgeIos}</p>
                ) : (
                  <>
                    <p className="mt-1.5 text-xs text-muted-foreground">{t.tutorialDashboard.pushNudgeTexto}</p>
                    <button
                      type="button"
                      onClick={aoAtivarPush}
                      disabled={pushOcupado}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      <BellRing className="h-4 w-4" />
                      {pushOcupado ? t.tutorialDashboard.pushNudgeAtivando : t.tutorialDashboard.pushNudgeBotao}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setPushDispensado(true)}
                  className="mt-2 w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  {t.tutorialDashboard.pushNudgeDepois}
                </button>
              </div>
            ) : lembreteAtivo ? (
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t.calendario.bannerLembrete(
                    lembreteAtivo.evento.titulo,
                    format(new Date(`${lembreteAtivo.evento.data}T00:00:00`), "d 'de' MMMM", { locale: localeDf })
                  )}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{t.tutorialDashboard.clicarParaFechar}</p>
              </div>
            ) : (
              <p className="text-sm font-medium leading-relaxed text-foreground">{frase}</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
