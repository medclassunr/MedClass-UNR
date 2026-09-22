import {
  Home,
  CalendarDays,
  CalendarClock,
  BookOpen,
  ClipboardCheck,
  BarChart3,
  MessageSquare,
  Stethoscope,
  Trophy,
  Hospital,
  Mic,
  Landmark,
  type LucideIcon,
} from "lucide-react"
import type { translations } from "@/lib/i18n"

type DashboardNavLabels = (typeof translations)["pt"]["dashboardNav"]

export interface NavChild {
  name: string
  href: string
}

export interface NavItem {
  name: string
  href: string
  icon: LucideIcon
  children?: NavChild[]
  emBreve?: boolean
}

// MedCoins e Conquistas ficam ocultos do menu por enquanto (recursos não
// usados nesta fase do MedClass UNR) — os componentes e rotas continuam
// existindo para reativar no futuro. Desafios Clínicos e Ranking (com
// pontuação por matéria) foram reativados.
export function getNavigation(t: DashboardNavLabels): NavItem[] {
  return [
    { name: t.inicio, href: "/dashboard", icon: Home },
    { name: t.cronograma, href: "/dashboard/cronograma", icon: CalendarDays },
    { name: t.calendario, href: "/dashboard/calendario", icon: CalendarClock },
    { name: t.atividadesUnr, href: "/dashboard/actividades-unr", icon: Landmark },
    {
      name: t.materiais,
      href: "/dashboard/materiais",
      icon: BookOpen,
      children: [
        { name: t.videoaulas, href: "/dashboard/materiais?tab=videoaulas" },
        { name: t.resumos, href: "/dashboard/materiais?tab=resumos" },
        { name: t.flashcards, href: "/dashboard/materiais?tab=flashcards" },
      ],
    },
    { name: t.treinamentos, href: "/dashboard/simulados", icon: ClipboardCheck },
    { name: t.desafiosClinicos, href: "/dashboard/desafios-clinicos", icon: Stethoscope },
    { name: t.hospitalSimulacao, href: "/dashboard/hospital-simulacao", icon: Hospital },
    { name: t.mesaOral, href: "/dashboard/mesa-oral", icon: Mic, emBreve: true },
    {
      name: t.desempenho,
      href: "/dashboard/desempenho/estatisticas",
      icon: BarChart3,
      children: [
        { name: t.historico, href: "/dashboard/desempenho/historico" },
        { name: t.estatisticas, href: "/dashboard/desempenho/estatisticas" },
      ],
    },
    { name: t.ranking, href: "/dashboard/ranking", icon: Trophy },
    { name: t.feedback, href: "/dashboard/feedback", icon: MessageSquare },
  ]
}
