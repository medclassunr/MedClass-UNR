"use client"

import { useEffect, useState } from "react"
import { TrendingUp, BookOpen, Clock, Target } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { IconChip } from "@/components/ui/icon-chip"
import { useLanguage } from "@/lib/i18n"

interface AttemptRow {
  correct_count: number
  wrong_count: number
  total_questions: number
  duration_seconds: number | null
  created_at: string
}

function formatDuracao(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  if (h === 0 && m === 0) return "—"
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function HomeStats() {
  const { t } = useLanguage()
  const [rows, setRows] = useState<AttemptRow[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase
        .from("simulado_attempts")
        .select("correct_count, wrong_count, total_questions, duration_seconds, created_at")
        .eq("user_id", data.user.id)
        .then(({ data: attemptRows }) => setRows((attemptRows as AttemptRow[]) ?? []))
    })
  }, [])

  const totalCorrect = rows.reduce((sum, r) => sum + r.correct_count, 0)
  const totalWrong = rows.reduce((sum, r) => sum + r.wrong_count, 0)
  const totalQuestoes = rows.reduce((sum, r) => sum + r.total_questions, 0)
  const totalTempo = rows.reduce((sum, r) => sum + (r.duration_seconds ?? 0), 0)
  const taxaAcerto = totalCorrect + totalWrong > 0 ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100) : 0

  const seteDiasAtras = new Date()
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7)
  const estaSemana = rows.filter((r) => new Date(r.created_at) >= seteDiasAtras).length

  const stats = [
    {
      label: t.homeStats.taxaAcerto,
      value: rows.length > 0 ? `${taxaAcerto}%` : "—",
      icon: Target,
      gradient: "from-violet-400 to-purple-600",
      shadow: "shadow-purple-900/30",
    },
    {
      label: t.homeStats.questoesFeitas,
      value: String(totalQuestoes),
      icon: BookOpen,
      gradient: "from-sky-400 to-blue-600",
      shadow: "shadow-blue-900/30",
    },
    {
      label: t.homeStats.tempoDeEstudo,
      value: formatDuracao(totalTempo),
      icon: Clock,
      gradient: "from-rose-400 to-pink-600",
      shadow: "shadow-pink-900/30",
    },
    {
      label: t.homeStats.simuladosSemana,
      value: String(estaSemana),
      icon: TrendingUp,
      gradient: "from-emerald-400 to-green-600",
      shadow: "shadow-emerald-900/30",
    },
  ]

  return (
    <div data-tutorial="home-stats" className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-card p-6 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                <p className="mt-3 text-2xl font-bold text-foreground">{stat.value}</p>
              </div>
              <IconChip icon={Icon} className={`bg-gradient-to-br ${stat.gradient} ${stat.shadow}`} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
