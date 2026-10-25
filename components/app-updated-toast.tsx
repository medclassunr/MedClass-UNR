"use client"

// Aviso rápido de confirmação DEPOIS de uma atualização silenciosa. O service
// worker é network-first, então o app geralmente pega a versão nova sozinho ao
// reabrir (sem popup). Pra dar um retorno visual, guardo a última versão vista
// no aparelho (localStorage) e, se na abertura ela for diferente da versão
// atual do bundle, mostro um toast por alguns segundos.

import { useEffect, useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { useLanguage } from "@/lib/i18n"

const VERSAO_ATUAL = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"
const STORAGE_KEY = "medclass_app_version"

export function AppUpdatedToast() {
  const { t } = useLanguage()
  const [mostrar, setMostrar] = useState(false)

  useEffect(() => {
    if (VERSAO_ATUAL === "dev") return
    try {
      const anterior = localStorage.getItem(STORAGE_KEY)
      if (anterior && anterior !== VERSAO_ATUAL) {
        setMostrar(true)
        const id = setTimeout(() => setMostrar(false), 6000)
        localStorage.setItem(STORAGE_KEY, VERSAO_ATUAL)
        return () => clearTimeout(id)
      }
      localStorage.setItem(STORAGE_KEY, VERSAO_ATUAL)
    } catch {
      // localStorage indisponível (modo privado etc.) -- só não mostra o toast.
    }
  }, [])

  if (!mostrar) return null

  return (
    <div className="animate-avatar-balao fixed bottom-5 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/40 bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-2xl">
      <CheckCircle2 className="h-4 w-4 text-primary" />
      {t.tutorialDashboard.appAtualizadoToast}
    </div>
  )
}
