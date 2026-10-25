"use client"

import { useEffect, useState } from "react"
import { BellRing, BellOff, Smartphone } from "lucide-react"
import { Card } from "@/components/ui/card"
import { useLanguage } from "@/lib/i18n"
import { ativarPush, desativarPush, estadoPush, iosPrecisaInstalar, type EstadoPush } from "@/lib/push-client"

export function PushToggle() {
  const { t } = useLanguage()
  const [estado, setEstado] = useState<EstadoPush | "carregando">("carregando")
  const [ocupado, setOcupado] = useState(false)
  const iosNaoInstalado = iosPrecisaInstalar()

  useEffect(() => {
    estadoPush().then(setEstado)
  }, [])

  async function alternar() {
    setOcupado(true)
    try {
      setEstado(estado === "ativo" ? await desativarPush() : await ativarPush())
    } finally {
      setOcupado(false)
    }
  }

  const c = t.configuracoes
  const ativo = estado === "ativo"

  return (
    <Card className="border border-border bg-card p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Smartphone className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-foreground">{c.alertasCelularTitulo}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{c.alertasCelularDescricao}</p>

          {/* iOS fora do app instalado: push não funciona, mostra como resolver. */}
          {iosNaoInstalado && estado === "nao-suportado" ? (
            <p className="mt-4 rounded-lg bg-accent px-3 py-2 text-sm text-foreground">{c.alertasCelularIos}</p>
          ) : estado === "nao-suportado" ? (
            <p className="mt-4 text-sm text-muted-foreground">{c.alertasCelularNaoSuportado}</p>
          ) : estado === "negado" ? (
            <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-foreground">{c.alertasCelularNegado}</p>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={alternar}
                disabled={ocupado || estado === "carregando"}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60 ${
                  ativo
                    ? "border border-border bg-card text-foreground"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                {ativo ? <BellOff className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
                {ocupado
                  ? c.alertasCelularAtivando
                  : ativo
                    ? c.alertasCelularDesativar
                    : c.alertasCelularAtivar}
              </button>
              {ativo && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  {c.alertasCelularAtivo}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
