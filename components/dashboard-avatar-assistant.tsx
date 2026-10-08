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

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { ptBR, es } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { buscarLembretesAtivos } from "@/lib/calendario-lembretes"
import type { CalendarioLembreteAtivo } from "@/lib/calendario-types"
import { useLanguage } from "@/lib/i18n"
import { useTutorial, AVATAR_FRAMES, type TutorialStep } from "@/components/onboarding-tutorial"

// Pose fixa (não sorteada) -- este avatar é um ícone fixo/reconhecível,
// diferente das poses aleatórias do card do tour.
const AVATAR_ICONE = AVATAR_FRAMES[0]

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

  function aoClicarAvatar() {
    if (lembreteAtivo) {
      setDispensados((prev) => new Set(prev).add(lembreteAtivo.id))
      return
    }
    setFaqAberto((v) => !v)
  }

  function aoClicarTopico(passos: TutorialStep[]) {
    setFaqAberto(false)
    abrirAjudaPagina(passos)
  }

  const mostrarBalao = !escondido && (!!lembreteAtivo || faqAberto)

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
        {lembreteAtivo && (
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
        className="fixed right-4 top-[72px] z-[120] h-24 w-24 overflow-hidden rounded-full border-[3px] border-primary/50 bg-card shadow-xl transition-transform hover:scale-105"
      >
        <img src={AVATAR_ICONE} alt="" className="h-full w-full object-cover object-top" />
        {lembreteAtivo && (
          <span className="absolute right-1 top-1 h-4 w-4 rounded-full border-2 border-card bg-destructive" />
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
        <div className="fixed right-3 top-[180px] z-[120] w-[min(300px,calc(100vw-1.5rem))]">
          <div className="relative rounded-2xl border border-border bg-card p-4 shadow-2xl">
            <span className="absolute -top-1.5 right-10 h-3 w-3 rotate-45 border-l border-t border-border bg-card" />

            {lembreteAtivo ? (
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
            )}
          </div>
        </div>
      )}
    </>
  )
}
