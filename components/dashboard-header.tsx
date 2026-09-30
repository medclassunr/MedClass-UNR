"use client"

import { useEffect, useState } from "react"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { SidebarNav } from "@/components/sidebar-nav"
import { UserDropdown } from "@/components/user-dropdown"
import { GlobalSearch } from "@/components/global-search"
import { NotificationsPanel } from "@/components/notifications-panel"
import { LanguageSwitcher } from "@/components/language-switcher"
import { ThemeToggle } from "@/components/theme-toggle"
import { WhatsappHeaderButtons } from "@/components/whatsapp-header-buttons"
import { getPlanStatus } from "@/lib/plan-status"
import { useLanguage } from "@/lib/i18n"

export function DashboardHeader() {
  const { t } = useLanguage()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [firstName, setFirstName] = useState("")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [hasFullAccess, setHasFullAccess] = useState(false)

  useEffect(() => {
    getPlanStatus().then((status) => {
      if (!status) return
      const name = status.fullName || status.email?.split("@")[0] || ""
      setFullName(name)
      setFirstName(name.split(" ")[0] ?? "")
      setEmail(status.email ?? "")
      setAvatarUrl(status.avatarUrl)
      setHasFullAccess(status.hasFullAccess)
    })
  }, [])

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-sm sm:px-6">
      {/* Mobile menu */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t.dashboardNav.abrirMenu}>
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 border-sidebar-border p-0">
          <SheetTitle className="sr-only">{t.dashboardNav.menuNavegacao}</SheetTitle>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Greeting */}
      <div className="hidden min-w-0 sm:block">
        <h1 className="truncate text-lg font-semibold text-foreground">
          {t.dashboardNav.bemVindoDeVolta(firstName)}
        </h1>
        <p className="truncate text-xs text-muted-foreground">{t.dashboardNav.continueProgresso}</p>
      </div>

      {/* Search */}
      <GlobalSearch />

      <div className="ml-auto flex items-center gap-2 md:ml-0">
        <WhatsappHeaderButtons hasFullAccess={hasFullAccess} />
        <ThemeToggle />
        <LanguageSwitcher />
        <NotificationsPanel />

        <div className="ml-1">
          <UserDropdown name={fullName || t.dashboardNav.minhaConta} email={email} avatarUrl={avatarUrl} />
        </div>
      </div>
    </header>
  )
}
