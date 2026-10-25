"use client"

// Seção "Versão do aplicativo" no Meu Perfil: mostra a versão atual (a que o
// aparelho está rodando) e a última versão publicada no servidor. O botão
// "Atualizar agora" só fica habilitado quando há divergência -- se estiver na
// versão mais recente, fica desabilitado com o aviso de que está em dia.

import { useEffect, useState } from "react"
import { RefreshCw, CheckCircle2, Download, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { useLanguage } from "@/lib/i18n"
import { recarregarAppAgora } from "@/lib/app-refresh"

const VERSAO_ATUAL = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"

export function PerfilVersaoSection() {
  const { t } = useLanguage()
  const [ultima, setUltima] = useState<string | null>(null)
  const [verificando, setVerificando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)

  const verificar = () => {
    setVerificando(true)
    fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { version?: string }) => setUltima(d.version ?? null))
      .catch(() => setUltima(null))
      .finally(() => setVerificando(false))
  }

  useEffect(() => {
    verificar()
  }, [])

  const divergente = !!ultima && ultima !== VERSAO_ATUAL
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

          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <p>
              {c.appVersaoAtual}: <span className="font-mono text-foreground">{VERSAO_ATUAL.slice(0, 7)}</span>
            </p>
            <p className="flex items-center gap-1.5">
              {c.appVersaoNova}:{" "}
              {verificando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span className={`font-mono ${divergente ? "text-primary" : "text-foreground"}`}>
                  {ultima ? ultima.slice(0, 7) : "—"}
                </span>
              )}
            </p>
          </div>

          {!verificando && (
            <p
              className={`mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
                divergente ? "bg-accent text-foreground" : "text-primary"
              }`}
            >
              {divergente ? null : <CheckCircle2 className="h-4 w-4" />}
              {divergente ? c.appVersaoDisponivel : c.appVersaoJaAtual}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                setAtualizando(true)
                await recarregarAppAgora()
              }}
              disabled={!divergente || atualizando}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${atualizando ? "animate-spin" : ""}`} />
              {atualizando ? c.appVersaoAtualizando : c.appVersaoBotao}
            </button>
            <button
              type="button"
              onClick={verificar}
              disabled={verificando || atualizando}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
            >
              {verificando ? c.appVersaoBuscando : c.appVersaoBuscar}
            </button>
          </div>
        </div>
      </div>
    </Card>
  )
}
