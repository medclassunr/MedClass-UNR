"use client"

import { useEffect, useState } from "react"
import { Bell, BellRing, Clock, ExternalLink, Loader2, MapPin, RefreshCw } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { IconChip } from "@/components/ui/icon-chip"
import { useLanguage } from "@/lib/i18n"
import { supabase } from "@/lib/supabase"

interface Atividade {
  horario: string
  sala: string
  titulo: string
  descricao: string | null
  emAndamento: boolean
}

// Antecedências oferecidas (minutos antes do início da aula).
const LEADS = [120, 60, 30, 15, 0] as const
type LeadMin = (typeof LEADS)[number]

// Pega o 1º "HH:MM" do texto de horário ("08:00 a 10:00" -> "08:00"); devolve
// null se a atividade não tiver horário reconhecível (aí não dá pra avisar).
function horaInicio(horario: string): string | null {
  const m = horario.match(/(\d{1,2}):(\d{2})/)
  if (!m) return null
  return `${m[1].padStart(2, "0")}:${m[2]}`
}

// Data de hoje no fuso da Argentina (UTC-3), igual ao usado no dispatch.
function dataHoje(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)
}

interface AvisoLocal {
  id: string
  antecedencia_min: number
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

  const [userId, setUserId] = useState<string | null>(null)
  // chave da atividade (`hora|titulo|sala`) -> aviso ativo do aluno.
  const [avisos, setAvisos] = useState<Map<string, AvisoLocal>>(new Map())
  const [menuKey, setMenuKey] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)

  const chave = (a: Atividade, hora: string) => `${hora}|${a.titulo}|${a.sala}`

  const leadLabel = (min: number) =>
    min === 120 ? t.atividadesUnr.lead120
      : min === 60 ? t.atividadesUnr.lead60
        : min === 30 ? t.atividadesUnr.lead30
          : min === 15 ? t.atividadesUnr.lead15
            : t.atividadesUnr.lead0

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      const { data: rows } = await supabase
        .from("atividades_avisos")
        .select("id, titulo, sala, hora, antecedencia_min")
        .eq("user_id", data.user.id)
        .eq("data", dataHoje())
      const m = new Map<string, AvisoLocal>()
      for (const r of rows ?? []) {
        m.set(`${(r.hora as string).slice(0, 5)}|${r.titulo}|${r.sala}`, {
          id: r.id as string,
          antecedencia_min: r.antecedencia_min as number,
        })
      }
      setAvisos(m)
    })
  }, [])

  const definirAviso = async (a: Atividade, min: LeadMin) => {
    const hora = horaInicio(a.horario)
    if (!userId || !hora) return
    const k = chave(a, hora)
    setSalvando(k)
    const { data } = await supabase
      .from("atividades_avisos")
      .upsert(
        { user_id: userId, titulo: a.titulo, sala: a.sala, data: dataHoje(), hora, antecedencia_min: min, enviado_em: null },
        { onConflict: "user_id,data,hora,titulo,sala" }
      )
      .select("id, antecedencia_min")
      .single()
    if (data) {
      setAvisos((prev) => new Map(prev).set(k, { id: data.id as string, antecedencia_min: data.antecedencia_min as number }))
    }
    setSalvando(null)
    setMenuKey(null)
  }

  const removerAviso = async (a: Atividade) => {
    const hora = horaInicio(a.horario)
    if (!hora) return
    const k = chave(a, hora)
    const aviso = avisos.get(k)
    if (!aviso) return
    setSalvando(k)
    await supabase.from("atividades_avisos").delete().eq("id", aviso.id)
    setAvisos((prev) => {
      const n = new Map(prev)
      n.delete(k)
      return n
    })
    setSalvando(null)
    setMenuKey(null)
  }

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

                    {(() => {
                      const hora = horaInicio(atividade.horario)
                      if (!userId || !hora) return null
                      const k = chave(atividade, hora)
                      const aviso = avisos.get(k)
                      const aberto = menuKey === k
                      const ocupado = salvando === k
                      return (
                        <div className="pt-1.5">
                          <button
                            type="button"
                            onClick={() => setMenuKey(aberto ? null : k)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                              aviso
                                ? "border-primary/40 bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                            }`}
                          >
                            {ocupado ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : aviso ? (
                              <BellRing className="h-3.5 w-3.5" />
                            ) : (
                              <Bell className="h-3.5 w-3.5" />
                            )}
                            {aviso
                              ? `${t.atividadesUnr.avisoAtivoPrefixo}: ${leadLabel(aviso.antecedencia_min)}`
                              : t.atividadesUnr.avisoAtivar}
                          </button>

                          {aberto && (
                            <div className="mt-2 rounded-lg border border-border bg-card p-2 shadow-sm">
                              <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {t.atividadesUnr.avisoEscolha}
                              </p>
                              <div className="flex flex-col gap-0.5">
                                {LEADS.map((min) => (
                                  <button
                                    key={min}
                                    type="button"
                                    disabled={ocupado}
                                    onClick={() => definirAviso(atividade, min)}
                                    className={`rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent disabled:opacity-60 ${
                                      aviso?.antecedencia_min === min ? "bg-primary/10 font-semibold text-primary" : "text-foreground"
                                    }`}
                                  >
                                    {leadLabel(min)}
                                  </button>
                                ))}
                                {aviso && (
                                  <button
                                    type="button"
                                    disabled={ocupado}
                                    onClick={() => removerAviso(atividade)}
                                    className="mt-1 rounded-md border-t border-border px-2 py-1.5 text-left text-xs text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
                                  >
                                    {t.atividadesUnr.avisoDesativar}
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}
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
