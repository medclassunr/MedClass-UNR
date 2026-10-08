import type React from "react"
import { CollapsibleSidebar } from "@/components/collapsible-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { PlanExpiredBanner } from "@/components/plan-expired-banner"
import { FreePlanBanner } from "@/components/free-plan-banner"
import { ClaimPendingPayment } from "@/components/claim-pending-payment"
import { CalendarioLembretesBanner } from "@/components/calendario-lembretes-banner"
import { TutorialProvider } from "@/components/onboarding-tutorial"

interface DashboardLayoutProps {
  children: React.ReactNode
  /** Usa a largura toda da coluna de conteúdo, sem o limite de max-w-7xl (ex: calendário). */
  fullWidth?: boolean
}

export function DashboardLayout({ children, fullWidth }: DashboardLayoutProps) {
  return (
    <TutorialProvider>
      <div className="flex min-h-screen bg-background">
        <CollapsibleSidebar />

        {/* Main column */}
        <div className="min-w-0 flex-1">
          <ClaimPendingPayment />
          <DashboardHeader />
          <PlanExpiredBanner />
          <FreePlanBanner />
          <CalendarioLembretesBanner />
          <main className={fullWidth ? "px-4 py-6 sm:px-6 lg:px-8" : "mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"}>
            {children}
          </main>
        </div>
      </div>
    </TutorialProvider>
  )
}
