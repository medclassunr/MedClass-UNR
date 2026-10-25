"use client"

// Ícone de refresh no cabeçalho do dashboard (substituiu o "?" de ajuda):
// força a atualização manual do app -- desregistra o service worker, limpa os
// caches e recarrega buscando tudo de novo (ver lib/app-refresh). Útil pra
// quem quer garantir que está na última versão sem reinstalar o atalho.

import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { useLanguage } from "@/lib/i18n"
import { recarregarAppAgora } from "@/lib/app-refresh"

export function AppRefreshButton() {
  const { t } = useLanguage()
  const [girando, setGirando] = useState(false)

  return (
    <button
      type="button"
      onClick={async () => {
        setGirando(true)
        await recarregarAppAgora()
      }}
      aria-label={t.tutorialDashboard.atualizacaoBotao}
      title={t.tutorialDashboard.atualizacaoBotao}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
    >
      <RefreshCw className={`h-[18px] w-[18px] ${girando ? "animate-spin" : ""}`} />
    </button>
  )
}
