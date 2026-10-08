"use client"

import Link from "next/link"
import { Zap, Plus, Stethoscope, Activity, CalendarDays, Landmark, Calendar, Mic } from "lucide-react"
import { useLanguage } from "@/lib/i18n"

const TILE_CLASS =
  "relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl p-4 text-center shadow-lg ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"

export function QuickAccessGrid() {
  const { t } = useLanguage()

  const tiles = [
    {
      href: "/dashboard/simulados",
      icon: Zap,
      label: t.dashboardNav.simulacroLivre,
      gradient: "from-lime-400 to-green-600",
      shadow: "shadow-green-900/30",
      tutorialId: "tile-simulacro-libre",
    },
    {
      href: "/dashboard/simulados?novo=true",
      icon: Plus,
      label: t.dashboardNav.simulacroTimer,
      gradient: "from-fuchsia-400 to-pink-600",
      shadow: "shadow-pink-900/30",
      tutorialId: "tile-simulacro-timer",
    },
    {
      href: "/dashboard/desafios-clinicos",
      icon: Stethoscope,
      label: t.dashboardNav.desafiosClinicos,
      gradient: "from-rose-400 to-red-600",
      shadow: "shadow-red-900/30",
      tutorialId: "tile-desafios-clinicos",
    },
    {
      href: "/dashboard/hospital-simulacao",
      icon: Activity,
      label: t.dashboardNav.hospitalSimulacao,
      gradient: "from-teal-400 to-emerald-600",
      shadow: "shadow-emerald-900/30",
      tutorialId: "tile-hospital-simulacao",
    },
    {
      href: "/dashboard/cronograma",
      icon: CalendarDays,
      label: t.dashboardNav.cronograma,
      gradient: "from-amber-400 to-orange-600",
      shadow: "shadow-orange-900/30",
      tutorialId: "tile-cronograma",
    },
    {
      href: "/dashboard/actividades-unr",
      icon: Landmark,
      label: t.dashboardNav.atividadesUnr,
      gradient: "from-sky-400 to-blue-600",
      shadow: "shadow-blue-900/30",
      tutorialId: "tile-atividades-unr",
    },
    {
      href: "/dashboard/calendario",
      icon: Calendar,
      label: t.dashboardNav.calendario,
      gradient: "from-indigo-400 to-violet-600",
      shadow: "shadow-violet-900/30",
      tutorialId: "tile-calendario",
    },
  ]

  return (
    <div data-tutorial="quick-access-grid" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {tiles.map(({ href, icon: Icon, label, gradient, shadow, tutorialId }) => (
        <Link key={href} href={href} className="group" data-tutorial={tutorialId}>
          <div className={`${TILE_CLASS} bg-gradient-to-br ${gradient} ${shadow}`}>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 via-white/0 to-black/10" />
            <Icon className="relative h-10 w-10 shrink-0 text-white drop-shadow-sm" strokeWidth={1.75} aria-hidden="true" />
            <span className="relative text-xl font-bold leading-tight text-white drop-shadow-sm">{label}</span>
          </div>
        </Link>
      ))}

      {/* Mesa Oral ainda não foi implementada -- mostra o tile (com a mesma
          animação de hover dos outros) mas sem link, já que não há pra onde ir. */}
      <div className="group cursor-default" data-tutorial="tile-mesa-oral">
        <div className={`${TILE_CLASS} bg-gradient-to-br from-slate-400 to-slate-600 shadow-slate-900/30`}>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 via-white/0 to-black/10" />
          <Mic className="relative h-10 w-10 shrink-0 text-white drop-shadow-sm" strokeWidth={1.75} aria-hidden="true" />
          <span className="relative text-xl font-bold leading-tight text-white drop-shadow-sm">{t.dashboardNav.mesaOral}</span>
          <span className="relative rounded-full bg-black/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
            {t.dashboardNav.emBreve}
          </span>
        </div>
      </div>
    </div>
  )
}
