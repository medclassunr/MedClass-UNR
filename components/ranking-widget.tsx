"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Crown, Loader2, Medal, Trophy } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { IconChip } from "@/components/ui/icon-chip"
import { useLanguage } from "@/lib/i18n"

const TOP_N = 3

interface RankingRow {
  posicao: number
  user_id: string
  display_name: string
  points: number
}

interface MinhaPosicao {
  posicao: number
  points: number
}

const positionStyles = [
  { ring: "from-amber-400 to-yellow-500", icon: Crown },
  { ring: "from-slate-300 to-slate-400", icon: Medal },
  { ring: "from-amber-700 to-amber-800", icon: Medal },
]

export function RankingWidget() {
  const { t } = useLanguage()
  const [rows, setRows] = useState<RankingRow[]>([])
  const [minhaPosicao, setMinhaPosicao] = useState<MinhaPosicao | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: userData }) => {
      const userId = userData.user?.id ?? null
      const [{ data: rankingData }, posicaoResult] = await Promise.all([
        supabase.rpc("get_ranking_por_materia", { materia_filtro: null, limite: TOP_N }),
        userId
          ? supabase.rpc("get_minha_posicao_ranking", { materia_filtro: null, alvo_user_id: userId })
          : Promise.resolve({ data: null }),
      ])
      setCurrentUserId(userId)
      setRows((rankingData as RankingRow[]) ?? [])
      const posicaoData = (posicaoResult.data as MinhaPosicao[] | null) ?? []
      setMinhaPosicao(posicaoData[0] ?? null)
      setLoading(false)
    })
  }, [])

  const estouNoTop = currentUserId ? rows.some((r) => r.user_id === currentUserId) : false

  return (
    <Card data-tutorial="ranking-widget" className="border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2.5 font-semibold text-foreground">
          <IconChip icon={Trophy} size="sm" className="bg-gradient-to-br from-amber-400 to-yellow-600 shadow-amber-900/30" />
          {t.rankingWidget.titulo}
        </h3>
        <Link
          href="/dashboard/ranking"
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {t.rankingWidget.verCompleto}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.rankingWidget.carregando}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{t.rankingWidget.vazio}</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => {
            const style = positionStyles[row.posicao - 1]
            const PositionIcon = style?.icon ?? Medal
            return (
              <div
                key={row.user_id}
                className={`flex items-center gap-3 rounded-lg p-2.5 transition-colors ${
                  row.user_id === currentUserId ? "bg-primary/10" : "hover:bg-accent"
                }`}
              >
                <IconChip
                  icon={PositionIcon}
                  size="sm"
                  className={`bg-gradient-to-br ${style?.ring ?? "from-muted to-muted"} shadow-black/20`}
                />
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{row.display_name}</p>
                <span className="text-sm font-bold text-foreground">{row.points}</span>
              </div>
            )
          })}
          {!estouNoTop && minhaPosicao && (
            <div className="flex items-center gap-3 rounded-lg bg-primary/10 p-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-xs font-semibold text-primary">
                {minhaPosicao.posicao}
              </div>
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {t.rankingWidget.voce}{" "}
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  {t.rankingWidget.suaPosicao}
                </Badge>
              </p>
              <span className="text-sm font-bold text-foreground">{minhaPosicao.points}</span>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
