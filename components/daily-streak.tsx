"use client"

import { useEffect, useState } from "react"
import { ChevronRight, Flame } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useLanguage } from "@/lib/i18n"
import { garantirStreakAtivo, type DiaAtividade } from "@/lib/atividade-diaria"

const COR_FOGO = "#F97316"
const PASSO_REVELAR = 3
const VISIVEIS_INICIAL = 10

export function DailyStreak() {
  const { t } = useLanguage()
  const [streakAtual, setStreakAtual] = useState(0)
  const [dias, setDias] = useState<DiaAtividade[]>([])
  const [visiveis, setVisiveis] = useState(VISIVEIS_INICIAL)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        setLoading(false)
        return
      }
      const info = await garantirStreakAtivo(data.user.id)
      setStreakAtual(info.streakAtual)
      setDias(info.dias)
      setVisiveis(Math.min(VISIVEIS_INICIAL, info.dias.length))
      setLoading(false)
    })
  }, [])

  if (loading) return null

  const frase =
    streakAtual > 0
      ? t.atividadeDiaria.frase.replace("{count}", String(streakAtual))
      : t.atividadeDiaria.fraseZerado

  return (
    <div data-tutorial="daily-streak" className="mx-auto max-w-xl rounded-2xl bg-gradient-to-r from-orange-600 via-red-500 to-orange-600 p-[2px] animate-streak-glow">
      <div className="rounded-2xl bg-card p-5">
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5" style={{ color: COR_FOGO }} />
            <h3 className="text-base font-bold text-foreground">{t.atividadeDiaria.titulo}</h3>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">{frase}</p>
        </div>

        <div className="mt-5 flex items-center gap-2.5 overflow-x-auto pb-1">
          {dias.slice(0, visiveis).map((d, i) => {
            const isUltimoFeito = d.feito && i === streakAtual - 1
            return (
              <div
                key={i}
                className={
                  d.feito
                    ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 text-sm font-semibold"
                    : "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-sm font-semibold text-muted-foreground"
                }
                style={
                  d.feito
                    ? { borderColor: COR_FOGO, backgroundColor: `${COR_FOGO}1A`, color: COR_FOGO }
                    : undefined
                }
              >
                {isUltimoFeito ? <Flame className="h-5 w-5" style={{ color: COR_FOGO }} /> : d.dia}
              </div>
            )
          })}

          {visiveis < dias.length && (
            <button
              type="button"
              onClick={() => setVisiveis((v) => Math.min(v + PASSO_REVELAR, dias.length))}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              aria-label="Ver mais dias"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
