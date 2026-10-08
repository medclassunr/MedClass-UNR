"use client"

import { useEffect, useState } from "react"
import { Lightbulb } from "lucide-react"
import { STUDY_TIPS_BY_LANG } from "@/lib/study-tips"
import { useLanguage } from "@/lib/i18n"

function dayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export function DailyTipHeader() {
  const { t, lang } = useLanguage()
  const [tip, setTip] = useState<string | null>(null)

  useEffect(() => {
    const tips = STUDY_TIPS_BY_LANG[lang]
    const index = dayOfYear(new Date()) % tips.length
    setTip(tips[index])
  }, [lang])

  if (!tip) return null

  return (
    <div data-tutorial="daily-tip" className="flex items-center gap-2 text-sm">
      <Lightbulb className="h-4 w-4 shrink-0 text-primary" />
      <p className="leading-relaxed text-muted-foreground">
        <span className="font-semibold text-primary">{t.dailyTip.label}:</span> {tip}
      </p>
    </div>
  )
}
