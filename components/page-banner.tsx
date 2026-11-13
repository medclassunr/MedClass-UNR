"use client"

import { usePathname } from "next/navigation"

// Banner do título no topo de cada página do menu lateral. Imagem FIXA (sem
// efeito 3D), com um glow neon atrás (drop-shadow na cor do banner, que segue
// o formato do PNG transparente -> "neon no fundo da imagem").
interface BannerDef {
  test: (p: string) => boolean
  src: string
  cor: string
  alt: string
}

const BANNERS: BannerDef[] = [
  { test: (p) => p === "/dashboard", src: "inicio", cor: "#84cc16", alt: "Início" },
  { test: (p) => p.startsWith("/dashboard/cronograma"), src: "cronograma", cor: "#f59e0b", alt: "Cronograma" },
  { test: (p) => p.startsWith("/dashboard/calendario"), src: "calendario", cor: "#a855f7", alt: "Calendario" },
  { test: (p) => p.startsWith("/dashboard/actividades-unr"), src: "actividades-unr", cor: "#3b82f6", alt: "Actividades en la UNR" },
  { test: (p) => p.startsWith("/dashboard/materiais"), src: "materiais", cor: "#22c55e", alt: "Materiales" },
  { test: (p) => p.startsWith("/dashboard/simulados"), src: "treinamentos", cor: "#14b8a6", alt: "Entrenamientos" },
  { test: (p) => p.startsWith("/dashboard/desafios-clinicos"), src: "desafios-clinicos", cor: "#ef4444", alt: "Desafíos Clínicos" },
  { test: (p) => p.startsWith("/dashboard/hospital-simulacao"), src: "hospital-simulacao", cor: "#38bdf8", alt: "Hospital Simulación" },
  { test: (p) => p.startsWith("/dashboard/mesa-oral"), src: "mesa-oral", cor: "#94a3b8", alt: "Mesa Oral" },
  { test: (p) => p.startsWith("/dashboard/desempenho"), src: "desempenho", cor: "#84cc16", alt: "Rendimiento" },
  { test: (p) => p.startsWith("/dashboard/ranking"), src: "ranking", cor: "#eab308", alt: "Ranking" },
  { test: (p) => p.startsWith("/dashboard/feedback"), src: "feedback", cor: "#22d3ee", alt: "Feedback" },
]

export function PageBanner() {
  const pathname = usePathname()
  const banner = BANNERS.find((b) => b.test(pathname))
  if (!banner) return null

  return (
    <div className="mb-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/banners/${banner.src}.png`}
        alt={banner.alt}
        draggable={false}
        className="h-auto w-full max-w-4xl select-none"
        style={{ filter: `drop-shadow(0 0 22px ${banner.cor}99) drop-shadow(0 0 7px ${banner.cor})` }}
      />
    </div>
  )
}
