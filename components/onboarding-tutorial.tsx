"use client"

// Tutorial guiado do dashboard -- mesmo conceito do projeto CRM na Mão
// (ver RESUMO-SESSAO.md), portado pra React/Next e com as cores desta
// plataforma (tokens CSS var(--primary)/var(--card)/var(--border) etc.,
// se adapta sozinho entre tema claro/escuro). Avatar próprio desta
// plataforma (médica, public/tutorial/avatar-medica-tutorial-1..6.png)
// pra não ficar visualmente igual ao avatar do CRM na Mão -- uma pose
// aleatória (nunca repetida 2x seguidas) é sorteada a cada passo.
//
// Dois jeitos de abrir:
// 1. Tour completo (18 passos): sozinho na primeira vez que o aluno abre
//    o dashboard (profiles.tutorial_dashboard_visto ainda false -- ver
//    lib/tutorial-status.ts e a migration correspondente, que precisa
//    ser rodada manualmente no SQL Editor do Supabase antes disso
//    funcionar de verdade), ou a qualquer momento pelo botão "Repasar
//    tutorial" fixo no canto inferior direito.
// 2. Ajuda de uma página específica (1 passo só, sem spotlight): o ícone
//    "?" que PageHelpButton (components/page-help-button.tsx) renderiza
//    no cabeçalho de cada página chama abrirAjudaPagina() com só o passo
//    daquela funcionalidade -- funciona mesmo depois do tour completo já
//    ter passado.
//
// Passos do tour completo apontam (via atributo data-tutorial="...") pra
// elementos reais do dashboard -- ver daily-tip-header.tsx,
// daily-streak.tsx, home-stats.tsx, quick-access-grid.tsx,
// desempenho-widget.tsx, ranking-widget.tsx e comunidade-banner.tsx.
// Passos de ajuda por página nunca têm spotlight (não faz sentido
// destacar algo na própria página que já está aberta).

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage, translations } from "@/lib/i18n"
import { getTutorialVisto, marcarTutorialVisto } from "@/lib/tutorial-status"

export type TutorialCopy = (typeof translations)["es"]["tutorialDashboard"]

export interface TutorialStep {
  tituloKey: keyof TutorialCopy
  textoKey: keyof TutorialCopy
  selector: string | null
  /** Fixa uma pose específica (índice de AVATAR_FRAMES) em vez de sortear --
   *  usado quando uma pose com gesto direcional (ex.: apontando pra direita)
   *  confundiria com a posição real do elemento destacado na tela. */
  avatarIdx?: number
  /** Mostra um botão extra de WhatsApp (ex.: passo "Planos Premium" do FAQ). */
  ctaWhatsapp?: boolean
}

const WHATSAPP_SUPORTE_URL = "https://wa.me/543417214945"

export const TOUR_COMPLETO: TutorialStep[] = [
  { tituloKey: "bemVindoTitulo", textoKey: "bemVindoTexto", selector: null },
  { tituloKey: "tipTitulo", textoKey: "tipTexto", selector: '[data-tutorial="daily-tip"]' },
  { tituloKey: "streakTitulo", textoKey: "streakTexto", selector: '[data-tutorial="daily-streak"]' },
  { tituloKey: "progressoTitulo", textoKey: "progressoTexto", selector: '[data-tutorial="home-stats"]' },
  { tituloKey: "gridTitulo", textoKey: "gridTexto", selector: '[data-tutorial="quick-access-grid"]' },
  { tituloKey: "simuladoLivreTitulo", textoKey: "simuladoLivreTexto", selector: '[data-tutorial="tile-simulacro-libre"]' },
  { tituloKey: "simuladoTimerTitulo", textoKey: "simuladoTimerTexto", selector: '[data-tutorial="tile-simulacro-timer"]' },
  { tituloKey: "desafiosTitulo", textoKey: "desafiosTexto", selector: '[data-tutorial="tile-desafios-clinicos"]' },
  { tituloKey: "hospitalTitulo", textoKey: "hospitalTexto", selector: '[data-tutorial="tile-hospital-simulacao"]' },
  { tituloKey: "cronogramaTitulo", textoKey: "cronogramaTexto", selector: '[data-tutorial="tile-cronograma"]', avatarIdx: 3 },
  { tituloKey: "atividadesUnrTitulo", textoKey: "atividadesUnrTexto", selector: '[data-tutorial="tile-atividades-unr"]' },
  { tituloKey: "calendarioTitulo", textoKey: "calendarioTexto", selector: '[data-tutorial="tile-calendario"]' },
  { tituloKey: "mesaOralTitulo", textoKey: "mesaOralTexto", selector: '[data-tutorial="tile-mesa-oral"]' },
  { tituloKey: "menuLateralTitulo", textoKey: "menuLateralTexto", selector: '[data-tutorial="sidebar-menu"]' },
  { tituloKey: "materiaisTitulo", textoKey: "materiaisTexto", selector: null },
  { tituloKey: "desempenhoTitulo", textoKey: "desempenhoTexto", selector: '[data-tutorial="desempenho-widget"]' },
  { tituloKey: "rankingTitulo", textoKey: "rankingTexto", selector: '[data-tutorial="ranking-widget"]' },
  { tituloKey: "comunidadeTitulo", textoKey: "comunidadeTexto", selector: '[data-tutorial="comunidade-banner"]' },
  { tituloKey: "fechamentoTitulo", textoKey: "fechamentoTexto", selector: null },
]

// PNG, não WebP -- o WebP com canal alpha tem bugs de renderização
// documentados no Safari/iOS (transparência intermitente, varia por
// aparelho/imagem), confirmados em testes reais no celular mesmo com os
// arquivos .webp já corretos a nível de bytes. PNG tem suporte a alpha
// sólido e universal em todos os navegadores.
export const AVATAR_FRAMES = [
  "/tutorial/avatar-medica-tutorial-1.png",
  "/tutorial/avatar-medica-tutorial-2.png",
  "/tutorial/avatar-medica-tutorial-3.png",
  "/tutorial/avatar-medica-tutorial-4.png",
  "/tutorial/avatar-medica-tutorial-5.png",
  "/tutorial/avatar-medica-tutorial-6.png",
]

function sortearPose(anterior: number): number {
  if (AVATAR_FRAMES.length <= 1) return 0
  let proxima = Math.floor(Math.random() * AVATAR_FRAMES.length)
  while (proxima === anterior) proxima = Math.floor(Math.random() * AVATAR_FRAMES.length)
  return proxima
}

interface SpotRect {
  top: number
  left: number
  width: number
  height: number
}

interface TutorialContextValue {
  abrirTutorialCompleto: () => void
  abrirAjudaPagina: (passos: TutorialStep[]) => void
}

const TutorialContext = createContext<TutorialContextValue | null>(null)

export function useTutorial() {
  const ctx = useContext(TutorialContext)
  if (!ctx) throw new Error("useTutorial must be used within a TutorialProvider")
  return ctx
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage()
  const [passos, setPassos] = useState<TutorialStep[]>(TOUR_COMPLETO)
  const [aberto, setAberto] = useState(false)
  const [passoAtual, setPassoAtual] = useState(0)
  const [rect, setRect] = useState<SpotRect | null>(null)
  const [avatarIdx, setAvatarIdx] = useState(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sorteia uma pose nova (nunca igual à anterior) toda vez que um passo
  // novo é mostrado -- pedido explícito: aleatório, não sequencial. Exceto
  // quando o passo fixa uma pose (avatarIdx), pra evitar gesto direcional
  // (ex.: apontando pra direita) que contradiga a posição real do elemento
  // destacado na tela.
  useEffect(() => {
    if (!aberto) return
    const fixa = passos[passoAtual]?.avatarIdx
    setAvatarIdx((anterior) => (fixa !== undefined ? fixa : sortearPose(anterior)))
  }, [aberto, passoAtual, passos])

  // Tour completo sozinho só na 1ª vez (profiles.tutorial_dashboard_visto).
  useEffect(() => {
    getTutorialVisto().then((visto) => {
      if (!visto) {
        setPassos(TOUR_COMPLETO)
        setAberto(true)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const medir = useCallback((selector: string | null) => {
    if (!selector) {
      setRect(null)
      return
    }
    const alvo = document.querySelector(selector)
    if (!alvo) {
      setRect(null)
      return
    }
    const box = alvo.getBoundingClientRect()
    if (box.width === 0 && box.height === 0) {
      // elemento existe mas está oculto (ex.: fora da página atual, ou
      // sidebar colapsada/escondida no mobile) -- trata como sem alvo.
      setRect(null)
      return
    }
    setRect({ top: box.top, left: box.left, width: box.width, height: box.height })
  }, [])

  useEffect(() => {
    if (!aberto) return
    const passo = passos[passoAtual]
    if (!passo) return

    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    const semMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const alvo = passo.selector ? document.querySelector(passo.selector) : null
    if (alvo) alvo.scrollIntoView({ behavior: semMovimento ? "auto" : "smooth", block: "center" })

    timeoutRef.current = setTimeout(() => medir(passo.selector), alvo ? 380 : 0)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [aberto, passoAtual, passos, medir])

  useEffect(() => {
    if (!aberto) return
    function aoRedimensionar() {
      medir(passos[passoAtual]?.selector ?? null)
    }
    window.addEventListener("resize", aoRedimensionar)
    return () => window.removeEventListener("resize", aoRedimensionar)
  }, [aberto, passoAtual, passos, medir])

  const abrirTutorialCompleto = useCallback(() => {
    setPassos(TOUR_COMPLETO)
    setPassoAtual(0)
    setAberto(true)
  }, [])

  const abrirAjudaPagina = useCallback((novosPassos: TutorialStep[]) => {
    setPassos(novosPassos)
    setPassoAtual(0)
    setAberto(true)
  }, [])

  function encerrar() {
    setAberto(false)
    setRect(null)
    if (passos === TOUR_COMPLETO) marcarTutorialVisto()
  }

  function avancar() {
    if (passoAtual + 1 >= passos.length) {
      encerrar()
      return
    }
    setPassoAtual((p) => p + 1)
  }

  const passo = passos[passoAtual]
  const ultimo = passoAtual === passos.length - 1
  const ladoInvertido = passoAtual % 2 === 1
  const avatarSrc = AVATAR_FRAMES[avatarIdx]
  const contador = t.tutorialDashboard.contadorPasso
    .replace("{atual}", String(passoAtual + 1))
    .replace("{total}", String(passos.length))

  return (
    <TutorialContext.Provider value={{ abrirTutorialCompleto, abrirAjudaPagina }}>
      {children}

      {aberto && passo && (
        <div className="fixed inset-0 z-[200]">
          {/* Máscara escura em 4 blocos (topo/baixo/esquerda/direita) ao
              redor do recorte, em vez de um único box-shadow com espalhamento
              gigante (9999px) -- essa técnica é conhecida por causar
              artefatos de composição (GPU) em alguns Safari/iOS, dependendo
              do tamanho do recorte. Sem recorte, cobre a tela toda. */}
          {rect ? (
            <>
              <div
                className="pointer-events-none fixed inset-x-0 top-0 bg-black/75 transition-all duration-300 ease-in-out"
                style={{ height: Math.max(0, rect.top - 8) }}
              />
              <div
                className="pointer-events-none fixed inset-x-0 bottom-0 bg-black/75 transition-all duration-300 ease-in-out"
                style={{ top: Math.max(0, rect.top - 8) + rect.height + 16 }}
              />
              <div
                className="pointer-events-none fixed left-0 bg-black/75 transition-all duration-300 ease-in-out"
                style={{ top: Math.max(0, rect.top - 8), height: rect.height + 16, width: Math.max(0, rect.left - 8) }}
              />
              <div
                className="pointer-events-none fixed right-0 bg-black/75 transition-all duration-300 ease-in-out"
                style={{ top: Math.max(0, rect.top - 8), height: rect.height + 16, left: Math.max(0, rect.left - 8) + rect.width + 16 }}
              />
              <div
                className="pointer-events-none fixed rounded-2xl transition-all duration-300 ease-in-out"
                style={{
                  top: Math.max(0, rect.top - 8),
                  left: Math.max(0, rect.left - 8),
                  width: rect.width + 16,
                  height: rect.height + 16,
                  boxShadow: "0 0 0 2px var(--primary), 0 0 24px color-mix(in srgb, var(--primary) 45%, transparent)",
                }}
              />
            </>
          ) : (
            <div className="pointer-events-none fixed inset-0 bg-black/75" />
          )}

          {/* Card relativo -- a médica (img abaixo) é maior que o próprio
              card e "estoura" pra fora dele (bleeding), em cima no mobile
              (sobe acima do topo) e pro lado no desktop (alternando
              esquerda/direita a cada passo), enquanto uma parte do corpo
              dela continua sobreposta à área do card onde fica o texto. */}
          <div className="fixed bottom-6 left-1/2 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <img
              src={avatarSrc}
              alt=""
              className={`pointer-events-none absolute left-1/2 top-[-165px] h-[215px] w-auto -translate-x-1/2 object-contain sm:left-auto sm:top-auto sm:h-[370px] sm:translate-x-0 sm:bottom-[-14px] ${
                ladoInvertido ? "sm:right-[-10px]" : "sm:left-[-10px]"
              }`}
            />

            <div
              className={`relative pt-[40px] sm:pt-0 ${ladoInvertido ? "sm:pr-[235px]" : "sm:pl-[235px]"}`}
            >
              <div>
                {passos.length > 1 && (
                  <p className="text-[11px] font-bold uppercase tracking-wide text-primary">{contador}</p>
                )}
                <h3 className="mt-1 text-lg font-bold text-foreground">{t.tutorialDashboard[passo.tituloKey]}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {t.tutorialDashboard[passo.textoKey]}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                {passos.length > 1 ? (
                  <>
                    <Button type="button" variant="outline" onClick={encerrar}>
                      {t.tutorialDashboard.pular}
                    </Button>
                    <Button type="button" variant="gradient" onClick={avancar}>
                      {ultimo ? t.tutorialDashboard.entendido : t.tutorialDashboard.proximo}
                    </Button>
                  </>
                ) : passo.ctaWhatsapp ? (
                  <>
                    <Button type="button" variant="outline" onClick={encerrar}>
                      {t.tutorialDashboard.entendido}
                    </Button>
                    <Button type="button" asChild className="bg-[#25D366] text-white hover:bg-[#1ebe5a]">
                      <a href={WHATSAPP_SUPORTE_URL} target="_blank" rel="noopener noreferrer">
                        {t.tutorialDashboard.planosWhatsapp}
                      </a>
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="gradient" onClick={encerrar} className="ml-auto">
                    {t.tutorialDashboard.entendido}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={abrirTutorialCompleto}
        className="fixed bottom-5 right-5 z-[150] flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-lg transition-transform hover:-translate-y-0.5 hover:border-primary/50"
      >
        <GraduationCap className="h-4 w-4 text-primary" />
        <span className="hidden sm:inline">{t.tutorialDashboard.reverBotao}</span>
      </button>
    </TutorialContext.Provider>
  )
}
