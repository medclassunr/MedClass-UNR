"use client"

import { useState } from "react"
import { RefreshCw, CheckCircle2, Download } from "lucide-react"
import { Card } from "@/components/ui/card"
import { useLanguage } from "@/lib/i18n"
import { recarregarAppAgora } from "@/lib/app-refresh"

const VERSAO_ATUAL = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"

type Estado = "idle" | "buscando" | "atual" | "disponivel"

export function AtualizarAppSection() {
  const { t } = useLanguage()
  const [estado, setEstado] = useState<Estado>("idle")
  const [atualizando, setAtualizando] = useState(false)

  async function buscar() {
    setEstado("buscando")
    try {
      const res = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" })
      const { version } = (await res.json()) as { version?: string }
      setEstado(version && version !== VERSAO_ATUAL ? "disponivel" : "atual")
    } catch {
      // Falha de rede: deixa o aluno forçar a atualização mesmo assim.
      setEstado("idle")
    }
  }

  async function atualizar() {
    setAtualizando(true)
    await recarregarAppAgora()
  }

  const c = t.configuracoes

  return (
    <Card className="border border-border bg-card p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Download className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-foreground">{c.appVersaoTitulo}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{c.appVersaoDescricao}</p>

          <p className="mt-3 text-xs text-muted-foreground">
            {c.appVersaoAtual}: <span className="font-mono">{VERSAO_ATUAL.slice(0, 7)}</span>
          </p>

          {estado === "atual" && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              <CheckCircle2 className="h-4 w-4" />
              {c.appVersaoJaAtual}
            </p>
          )}
          {estado === "disponivel" && (
            <p className="mt-3 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-foreground">
              {c.appVersaoDisponivel}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={atualizar}
              disabled={atualizando}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${atualizando ? "animate-spin" : ""}`} />
              {atualizando ? c.appVersaoAtualizando : c.appVersaoBotao}
            </button>
            <button
              type="button"
              onClick={buscar}
              disabled={estado === "buscando" || atualizando}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
            >
              {estado === "buscando" ? c.appVersaoBuscando : c.appVersaoBuscar}
            </button>
          </div>
        </div>
      </div>
    </Card>
  )
}
