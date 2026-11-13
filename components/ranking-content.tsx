"use client"

import { useEffect, useState } from "react"
import { Crown, Loader2, Medal } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { IconChip } from "@/components/ui/icon-chip"
import { useLanguage } from "@/lib/i18n"
import { ANO_KEYS, MATERIA_KEYS_BY_ANO } from "@/lib/unr-curriculum"
import { RankingMinhasEstatisticas } from "@/components/ranking-minhas-estatisticas"

const TODAS_MATERIAS = "__todas__"
const TOP_N = 5

const MATERIA_KEYS = ANO_KEYS.flatMap((ano) => MATERIA_KEYS_BY_ANO[ano])

const posicaoStyles = [
  { ring: "from-amber-400 to-yellow-500", icon: Crown },
  { ring: "from-slate-300 to-slate-400", icon: Medal },
  { ring: "from-amber-700 to-amber-800", icon: Medal },
]

interface RankingRow {
  posicao: number
  user_id: string
  display_name: string
  correct: number
  total: number
  points: number
}

interface MinhaPosicao {
  posicao: number
  correct: number
  total: number
  points: number
  total_participantes: number
}

export function RankingContent() {
  const { t } = useLanguage()
  const [materiaFiltro, setMateriaFiltro] = useState(TODAS_MATERIAS)
  const [rows, setRows] = useState<RankingRow[]>([])
  const [minhaPosicao, setMinhaPosicao] = useState<MinhaPosicao | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [rankingVisivel, setRankingVisivel] = useState(true)
  const [salvandoVisibilidade, setSalvandoVisibilidade] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const materiaParam = materiaFiltro === TODAS_MATERIAS ? null : materiaFiltro

    supabase.auth.getUser().then(async ({ data: userData }) => {
      const userId = userData.user?.id ?? null

      const [{ data: rankingData }, posicaoResult, perfilResult] = await Promise.all([
        supabase.rpc("get_ranking_por_materia", { materia_filtro: materiaParam, limite: TOP_N }),
        userId
          ? supabase.rpc("get_minha_posicao_ranking", { materia_filtro: materiaParam, alvo_user_id: userId })
          : Promise.resolve({ data: null }),
        userId
          ? supabase.from("profiles").select("ranking_visivel").eq("id", userId).maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      if (cancelled) return
      setCurrentUserId(userId)
      setRows((rankingData as RankingRow[]) ?? [])
      const posicaoData = (posicaoResult.data as MinhaPosicao[] | null) ?? []
      setMinhaPosicao(posicaoData[0] ?? null)
      setRankingVisivel((perfilResult.data as { ranking_visivel: boolean } | null)?.ranking_visivel ?? true)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [materiaFiltro])

  const toggleRankingVisivel = async (visivel: boolean) => {
    if (!currentUserId) return
    setRankingVisivel(visivel)
    setSalvandoVisibilidade(true)
    await supabase.from("profiles").update({ ranking_visivel: visivel }).eq("id", currentUserId)
    setSalvandoVisibilidade(false)
  }

  const estouNoTop = currentUserId ? rows.some((r) => r.user_id === currentUserId) : false

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:w-56">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t.ranking.filtroMateria}</label>
            <Select value={materiaFiltro} onValueChange={setMateriaFiltro}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS_MATERIAS}>{t.ranking.todasAsMaterias}</SelectItem>
                {MATERIA_KEYS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {t.cronograma.materiaLabel[m] ?? m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <Card className="flex items-center justify-center gap-2 border border-border bg-card p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.ranking.carregando}
          </Card>
        ) : rows.length === 0 ? (
          <Card className="border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            {t.ranking.vazio}
          </Card>
        ) : (
          <Card className="border border-border bg-card p-2">
            <div className="divide-y divide-border">
              {rows.map((row) => {
                const isMe = row.user_id === currentUserId
                const style = posicaoStyles[row.posicao - 1]
                const PosicaoIcon = style?.icon
                return (
                  <div
                    key={row.user_id}
                    className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
                      isMe ? "bg-primary/10" : "hover:bg-accent"
                    }`}
                  >
                    {PosicaoIcon ? (
                      <IconChip icon={PosicaoIcon} size="sm" className={`bg-gradient-to-br ${style.ring} shadow-black/20`} />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-sm font-semibold text-muted-foreground">
                        {row.posicao}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {row.display_name}
                        {isMe && (
                          <Badge variant="secondary" className="ml-1.5 text-[10px]">
                            {t.ranking.voce}
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{t.ranking.acertos(row.correct, row.total)}</p>
                    </div>
                    <span className="shrink-0 text-lg font-bold text-foreground">{row.points}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {!loading && currentUserId && !estouNoTop && (
          <Card className="border border-primary/40 bg-primary/5 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.ranking.suaPosicaoTitulo}
            </p>
            {minhaPosicao ? (
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">
                    {t.ranking.suaPosicaoFora(minhaPosicao.posicao, minhaPosicao.total_participantes)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.ranking.acertos(minhaPosicao.correct, minhaPosicao.total)}
                  </p>
                </div>
                <span className="shrink-0 text-lg font-bold text-foreground">{minhaPosicao.points}</span>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{t.ranking.aindaNaoRespondeu}</p>
            )}
          </Card>
        )}

        <Card className="border border-border bg-card/50 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{t.ranking.comoPontuarTitulo}</p>
          <p className="mt-1">{t.ranking.comoPontuarTexto}</p>
        </Card>

        {!loading && currentUserId && (
          <Card className="flex items-center justify-between gap-3 border border-border bg-card p-4">
            <div>
              <p className="text-sm font-medium text-foreground">{t.ranking.visibilidadeTitulo}</p>
              <p className="text-xs text-muted-foreground">{t.ranking.visibilidadeDescricao}</p>
            </div>
            <Switch
              checked={rankingVisivel}
              onCheckedChange={toggleRankingVisivel}
              disabled={salvandoVisibilidade}
            />
          </Card>
        )}
      </div>

      <div className="lg:border-l lg:border-border lg:pl-8">
        <RankingMinhasEstatisticas />
      </div>
    </div>
  )
}
