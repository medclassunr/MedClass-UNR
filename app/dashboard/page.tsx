"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { HomeStats } from "@/components/home-stats"
import { QuickAccessGrid } from "@/components/quick-access-grid"
import { DesempenhoWidget } from "@/components/desempenho-widget"
import { RankingWidget } from "@/components/ranking-widget"
import { ComunidadeBanner } from "@/components/comunidade-banner"
import { DailyTipHeader } from "@/components/daily-tip-header"
import { DailyStreak } from "@/components/daily-streak"
import { useLanguage } from "@/lib/i18n"

export default function HomePage() {
  const { t } = useLanguage()
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <DailyTipHeader />

        <DailyStreak />

        <div>
          <h2 className="text-2xl font-bold text-foreground mb-6">{t.dashboardNav.seuProgresso}</h2>
          <HomeStats />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-foreground mb-6">{t.dashboardNav.oQueFazerAgora}</h2>
          <QuickAccessGrid />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <DesempenhoWidget />
          <RankingWidget />
        </div>

        <ComunidadeBanner />
      </div>
    </DashboardLayout>
  )
}
