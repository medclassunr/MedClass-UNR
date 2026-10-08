"use client"

import Link from "next/link"
import { ArrowRight, Users } from "lucide-react"
import { IconChip } from "@/components/ui/icon-chip"
import { useLanguage } from "@/lib/i18n"

interface ComunidadeBannerProps {
  showCta?: boolean
}

export function ComunidadeBanner({ showCta = true }: ComunidadeBannerProps) {
  const { t } = useLanguage()

  return (
    <div data-tutorial="comunidade-banner" className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <IconChip icon={Users} className="bg-gradient-to-br from-lime-400 to-green-600 shadow-green-900/30" />
          <div>
            <h3 className="font-semibold text-foreground">{t.comunidadeBanner.titulo}</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t.comunidadeBanner.corpo}</p>
          </div>
        </div>
        {showCta && (
          <Link
            href="/dashboard/feedback"
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#c6ff3a] to-[#84cc16] px-4 py-2.5 text-sm font-semibold text-[#0a1f00] shadow-sm transition-opacity hover:opacity-90"
          >
            {t.comunidadeBanner.cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  )
}
