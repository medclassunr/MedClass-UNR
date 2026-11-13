"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { useLanguage } from "@/lib/i18n"

const INCLINACAO_MAX = 12 // graus

// Card quadrado com a arte do card (imagem full-bleed) + movimento 3D (tilt
// seguindo o cursor) e brilho que acompanha o mouse -- mesmo efeito do
// ResumoCard da biblioteca. O título já vem embutido na própria imagem.
function TileCard({ img, label, cor }: { img: string; label: string; cor: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 })
  const [brilho, setBrilho] = useState({ x: 50, y: 50, on: false })

  // Borda neon suave sempre; no hover, soma uma sombra neon (glow) atrás da
  // imagem, na cor do card. Alpha em hex de 8 dígitos (ex.: #22c55e + "55").
  const sombra = brilho.on
    ? `0 0 0 1.5px ${cor}, 0 0 28px 4px ${cor}66, 0 10px 30px rgba(0,0,0,0.5)`
    : `0 0 0 1px ${cor}55, 0 0 8px ${cor}22`

  const handleMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    setTilt({
      rx: (0.5 - py) * INCLINACAO_MAX * 2,
      ry: (px - 0.5) * INCLINACAO_MAX * 2,
    })
    setBrilho({ x: px * 100, y: py * 100, on: true })
  }

  const handleLeave = () => {
    setTilt({ rx: 0, ry: 0 })
    setBrilho((b) => ({ ...b, on: false }))
  }

  return (
    <div className="group/card [perspective:1000px]" onMouseMove={handleMove} onMouseLeave={handleLeave}>
      <div
        ref={ref}
        className="relative aspect-square overflow-hidden rounded-2xl transition-[transform,box-shadow] duration-200 ease-out will-change-transform"
        style={{
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${brilho.on ? 1.03 : 1})`,
          transformStyle: "preserve-3d",
          boxShadow: sombra,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt={label} className="h-full w-full object-cover" draggable={false} />
        {/* Brilho que segue o mouse */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-150"
          style={{
            opacity: brilho.on ? 1 : 0,
            background: `radial-gradient(circle at ${brilho.x}% ${brilho.y}%, rgba(255,255,255,0.22), transparent 55%)`,
          }}
        />
      </div>
    </div>
  )
}

export function QuickAccessGrid() {
  const { t } = useLanguage()

  const tiles = [
    { href: "/dashboard/simulados", img: "/cards/simulacro-libre.jpg", label: t.dashboardNav.simulacroLivre, cor: "#22c55e", tutorialId: "tile-simulacro-libre" },
    { href: "/dashboard/simulados?novo=true", img: "/cards/simulacro-timer.jpg", label: t.dashboardNav.simulacroTimer, cor: "#ec4899", tutorialId: "tile-simulacro-timer" },
    { href: "/dashboard/desafios-clinicos", img: "/cards/desafios-clinicos.jpg", label: t.dashboardNav.desafiosClinicos, cor: "#ef4444", tutorialId: "tile-desafios-clinicos" },
    { href: "/dashboard/hospital-simulacao", img: "/cards/hospital-simulacao.jpg", label: t.dashboardNav.hospitalSimulacao, cor: "#14b8a6", tutorialId: "tile-hospital-simulacao" },
    { href: "/dashboard/cronograma", img: "/cards/cronograma.jpg", label: t.dashboardNav.cronograma, cor: "#f59e0b", tutorialId: "tile-cronograma" },
    { href: "/dashboard/actividades-unr", img: "/cards/actividades-unr.jpg", label: t.dashboardNav.atividadesUnr, cor: "#3b82f6", tutorialId: "tile-atividades-unr" },
    { href: "/dashboard/calendario", img: "/cards/calendario.jpg", label: t.dashboardNav.calendario, cor: "#a855f7", tutorialId: "tile-calendario" },
  ]

  return (
    <div data-tutorial="quick-access-grid" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {tiles.map(({ href, img, label, cor, tutorialId }) => (
        <Link key={href} href={href} className="group focus:outline-none" data-tutorial={tutorialId}>
          <TileCard img={img} label={label} cor={cor} />
        </Link>
      ))}

      {/* Mesa Oral ainda não foi implementada -- mostra o card (a própria arte
          já traz o selo "Próximamente") mas sem link, já que não há pra onde ir. */}
      <div className="cursor-default" data-tutorial="tile-mesa-oral">
        <TileCard img="/cards/mesa-oral.jpg" label={t.dashboardNav.mesaOral} cor="#94a3b8" />
      </div>
    </div>
  )
}
