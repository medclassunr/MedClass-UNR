"use client"

import { useEffect, useState } from "react"
import { Clock, ExternalLink, Loader2, MapPin, RefreshCw } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { IconChip } from "@/components/ui/icon-chip"
import { useLanguage } from "@/lib/i18n"

interface Atividade {
  horario: string
  sala: string
  titulo: string
  descricao: string | null
  emAndamento: boolean
}

interface AtividadesResponse {
  fecha: string | null
  atividades: Atividade[]
  fonteUrl: string
  atualizadoEm: string
  error?: string
}

function agruparPorHorario(atividades: Atividade[]) {
  const grupos: { horario: string; itens: Atividade[] }[] = []
  for (const atividade of atividades) {
    const grupoAtual = grupos[grupos.length - 1]
    if (grupoAtual && grupoAtual.horario === atividade.horario) {
      grupoAtual.itens.push(atividade)
    } else {
      grupos.push({ horario: atividade.horario, itens: [atividade] })
    }
  }
  return grupos
}

export function AtividadesUnrContent() {
  const { t } = useLanguage()
  const [dados, setDados] = useState<AtividadesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)

  const carregar = () => {
    setLoading(true)
    setErro(false)
    fetch("/api/actividades-unr")
      .then((res) => {
        if (!res.ok) throw new Error("bad status")
        return res.json()
      })
      .then((data: AtividadesResponse) => {
        if (data.error) throw new Error(data.error)
        setDados(data)
      })
      .catch(() => setErro(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    carregar()
  }, [])

  const grupos = dados ? agruparPorHorario(dados.atividades) : []

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {dados?.fecha && <p className="text-sm capitalize text-muted-foreground">{dados.fecha}</p>}
          <a
            href="https://hoy.bedeliafcm.com.ar/?origen=Medicina"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            {t.atividadesUnr.fonte}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <button
          onClick={carregar}
          disabled={loading}
          className="inline-flex items-center gap-1.5 self-start rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {t.atividadesUnr.atualizar}
        </button>
      </div>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 border border-border bg-card p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.atividadesUnr.carregando}
        </Card>
      ) : erro ? (
        <Card className="border border-destructive/40 bg-destructive/5 p-10 text-center text-sm text-muted-foreground">
          {t.atividadesUnr.erro}
        </Card>
      ) : grupos.length === 0 ? (
        <Card className="border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {t.atividadesUnr.semAtividades}
        </Card>
      ) : (
        <div className="space-y-6">
          {grupos.map((grupo) => (
            <div key={grupo.horario} className="space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <IconChip icon={Clock} size="sm" className="bg-gradient-to-br from-primary to-emerald-600 shadow-primary/20" />
                {grupo.horario}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grupo.itens.map((atividade, i) => (
                  <Card
                    key={`${grupo.horario}-${i}`}
                    className={`space-y-1.5 border p-4 ${
                      atividade.emAndamento ? "border-primary/50 bg-primary/5" : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {atividade.sala}
                      </span>
                      {atividade.emAndamento && (
                        <Badge className="bg-primary text-primary-foreground">{t.atividadesUnr.emAndamento}</Badge>
                      )}
                    </div>
                    <p className="text-sm font-semibold leading-snug text-foreground">{atividade.titulo}</p>
                    {atividade.descricao && (
                      <p className="text-xs leading-snug text-muted-foreground">{atividade.descricao}</p>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
