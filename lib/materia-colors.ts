import { anoDaMateria, type AnoKey } from "@/lib/unr-curriculum"

export interface MateriaColorConfig {
  hex: string
  dot: string
  text: string
  border: string
  borderSoft: string
  hoverBorder: string
  hoverGlow: string
  bgSoft: string
  activeBg: string
}

const FALLBACK: MateriaColorConfig = {
  hex: "#8b5cf6",
  dot: "bg-muted-foreground",
  text: "text-muted-foreground",
  border: "border-border",
  borderSoft: "border-border",
  hoverBorder: "hover:border-primary/50",
  hoverGlow: "hover:shadow-[0_0_18px_rgba(198,255,58,0.45)]",
  bgSoft: "bg-muted",
  activeBg: "bg-muted-foreground",
}

// Mesma paleta de 5 cores usada antes por área médica — agora reaplicada por ano.
const ANO_COLORS: Record<AnoKey, MateriaColorConfig> = {
  ano0: {
    hex: "#06b6d4",
    dot: "bg-cyan-500",
    text: "text-cyan-500",
    border: "border-cyan-500",
    borderSoft: "border-cyan-500/40",
    hoverBorder: "hover:border-cyan-500",
    hoverGlow: "hover:shadow-[0_0_18px_rgba(6,182,212,0.5)]",
    bgSoft: "bg-cyan-500/10",
    activeBg: "bg-cyan-500",
  },
  ano1: {
    hex: "#10b981",
    dot: "bg-emerald-500",
    text: "text-emerald-500",
    border: "border-emerald-500",
    borderSoft: "border-emerald-500/40",
    hoverBorder: "hover:border-emerald-500",
    hoverGlow: "hover:shadow-[0_0_18px_rgba(16,185,129,0.5)]",
    bgSoft: "bg-emerald-500/10",
    activeBg: "bg-emerald-500",
  },
  ano2: {
    hex: "#f43f5e",
    dot: "bg-rose-500",
    text: "text-rose-500",
    border: "border-rose-500",
    borderSoft: "border-rose-500/40",
    hoverBorder: "hover:border-rose-500",
    hoverGlow: "hover:shadow-[0_0_18px_rgba(244,63,94,0.5)]",
    bgSoft: "bg-rose-500/10",
    activeBg: "bg-rose-500",
  },
  ano3: {
    hex: "#8b5cf6",
    dot: "bg-violet-500",
    text: "text-violet-500",
    border: "border-violet-500",
    borderSoft: "border-violet-500/40",
    hoverBorder: "hover:border-violet-500",
    hoverGlow: "hover:shadow-[0_0_18px_rgba(139,92,246,0.5)]",
    bgSoft: "bg-violet-500/10",
    activeBg: "bg-violet-500",
  },
  ano4: {
    hex: "#3b82f6",
    dot: "bg-blue-500",
    text: "text-blue-500",
    border: "border-blue-500",
    borderSoft: "border-blue-500/40",
    hoverBorder: "hover:border-blue-500",
    hoverGlow: "hover:shadow-[0_0_18px_rgba(59,130,246,0.5)]",
    bgSoft: "bg-blue-500/10",
    activeBg: "bg-blue-500",
  },
  ano5: {
    hex: "#f59e0b",
    dot: "bg-amber-500",
    text: "text-amber-500",
    border: "border-amber-500",
    borderSoft: "border-amber-500/40",
    hoverBorder: "hover:border-amber-500",
    hoverGlow: "hover:shadow-[0_0_18px_rgba(245,158,11,0.5)]",
    bgSoft: "bg-amber-500/10",
    activeBg: "bg-amber-500",
  },
}

export function getAnoColor(ano: AnoKey): MateriaColorConfig {
  return ANO_COLORS[ano] ?? FALLBACK
}

export function getMateriaColor(materiaKey: string): MateriaColorConfig {
  const ano = anoDaMateria(materiaKey)
  return ano ? getAnoColor(ano) : FALLBACK
}
