"use client"

// Ícone "?" mostrado no cabeçalho de cada página do dashboard
// (components/dashboard-header.tsx) -- abre só a explicação daquela
// funcionalidade específica (sem spotlight, 1 passo só), reaproveitando
// o mesmo texto do tour completo (components/onboarding-tutorial.tsx).
// Funciona mesmo depois do tour completo já ter passado na 1ª vez.
//
// Pra adicionar ajuda numa página nova, só adicionar uma entrada no mapa
// ROTA_PARA_PASSOS abaixo.

import { usePathname } from "next/navigation"
import { HelpCircle } from "lucide-react"
import { useTutorial, type TutorialStep } from "@/components/onboarding-tutorial"
import { useLanguage } from "@/lib/i18n"

function passoUnico(tituloKey: TutorialStep["tituloKey"], textoKey: TutorialStep["textoKey"]): TutorialStep[] {
  return [{ tituloKey, textoKey, selector: null }]
}

// Ordem importa: a primeira rota cujo prefixo bater com o pathname atual
// vence -- por isso "/dashboard/desempenho" (sem sufixo) cobre tanto
// /dashboard/desempenho/estatisticas quanto /historico.
const ROTA_PARA_PASSOS: { prefixo: string; passos: TutorialStep[] }[] = [
  { prefixo: "/dashboard/simulados", passos: [
    { tituloKey: "simuladoLivreTitulo", textoKey: "simuladoLivreTexto", selector: null },
    { tituloKey: "simuladoTimerTitulo", textoKey: "simuladoTimerTexto", selector: null },
  ] },
  { prefixo: "/dashboard/desafios-clinicos", passos: passoUnico("desafiosTitulo", "desafiosTexto") },
  { prefixo: "/dashboard/hospital-simulacao", passos: passoUnico("hospitalTitulo", "hospitalTexto") },
  { prefixo: "/dashboard/cronograma", passos: passoUnico("cronogramaTitulo", "cronogramaTexto") },
  { prefixo: "/dashboard/calendario", passos: passoUnico("calendarioTitulo", "calendarioTexto") },
  { prefixo: "/dashboard/actividades-unr", passos: passoUnico("atividadesUnrTitulo", "atividadesUnrTexto") },
  { prefixo: "/dashboard/mesa-oral", passos: passoUnico("mesaOralTitulo", "mesaOralTexto") },
  { prefixo: "/dashboard/materiais", passos: passoUnico("materiaisTitulo", "materiaisTexto") },
  { prefixo: "/dashboard/desempenho", passos: passoUnico("desempenhoTitulo", "desempenhoTexto") },
  { prefixo: "/dashboard/ranking", passos: passoUnico("rankingTitulo", "rankingTexto") },
  { prefixo: "/dashboard/feedback", passos: passoUnico("comunidadeTitulo", "comunidadeTexto") },
]

export function PageHelpButton() {
  const pathname = usePathname()
  const { abrirAjudaPagina, abrirTutorialCompleto } = useTutorial()
  const { t } = useLanguage()

  const entrada = ROTA_PARA_PASSOS.find((r) => pathname?.startsWith(r.prefixo))

  // Na própria home (/dashboard) não tem uma funcionalidade específica
  // pra explicar -- o ícone reabre o tour completo (mesma coisa que o
  // botão flutuante "Repasar tutorial").
  const aoClicar = entrada ? () => abrirAjudaPagina(entrada.passos) : abrirTutorialCompleto

  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-label={t.tutorialDashboard.reverBotao}
      title={t.tutorialDashboard.reverBotao}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
    >
      <HelpCircle className="h-[18px] w-[18px]" />
    </button>
  )
}
