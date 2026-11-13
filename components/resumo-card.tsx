"use client"

import { useRef, useState } from "react"
import { Download, FileText, Loader2 } from "lucide-react"

interface ResumoCardProps {
  titulo: string
  capaUrl?: string | null
  // null = baixando sem % conhecido; número = %; undefined = parado
  baixando?: number | null | undefined
  onClick: () => void
}

const INCLINACAO_MAX = 14 // graus

// Card quadrado da capa do resumo, com movimento 3D (tilt) seguindo o cursor e
// um brilho que acompanha o mouse. Clicar baixa o PDF (o pai decide a ação).
export function ResumoCard({ titulo, capaUrl, baixando, onClick }: ResumoCardProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 })
  const [brilho, setBrilho] = useState({ x: 50, y: 50, on: false })
  const estaBaixando = baixando !== undefined

  const handleMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width // 0..1
    const py = (e.clientY - r.top) / r.height // 0..1
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
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      disabled={estaBaixando}
      className="group relative block w-full text-left [perspective:1000px] focus:outline-none"
      title={titulo}
    >
      <div
        className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-[transform,box-shadow] duration-150 ease-out will-change-transform group-hover:shadow-xl group-focus-visible:ring-2 group-focus-visible:ring-primary"
        style={{
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${brilho.on ? 1.03 : 1})`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Capa */}
        {capaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capaUrl} alt={titulo} className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/15 via-card to-primary/5">
            <FileText className="h-10 w-10 text-primary/70" />
            <span className="px-4 text-center text-xs font-medium text-muted-foreground line-clamp-3">{titulo}</span>
          </div>
        )}

        {/* Brilho que segue o mouse */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-150"
          style={{
            opacity: brilho.on ? 1 : 0,
            background: `radial-gradient(circle at ${brilho.x}% ${brilho.y}%, rgba(255,255,255,0.35), transparent 55%)`,
          }}
        />

        {/* Faixa inferior com o título */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-3 pt-8">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-white drop-shadow">{titulo}</p>
        </div>

        {/* Ícone de download no canto */}
        <div className="pointer-events-none absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-transform duration-150 group-hover:scale-110">
          {estaBaixando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </div>

        {/* Overlay de progresso do download */}
        {estaBaixando && (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/20">
            {baixando === null ? (
              <div className="h-full w-full animate-pulse bg-primary" />
            ) : (
              <div className="h-full bg-primary transition-[width]" style={{ width: `${baixando}%` }} />
            )}
          </div>
        )}
      </div>
    </button>
  )
}
