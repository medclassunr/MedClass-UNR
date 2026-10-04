"use client"

import { useEffect, useMemo, useState, type MouseEvent } from "react"
import Link from "next/link"
import Image from "next/image"
import { Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp, Pencil, Plus, Lock } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getDesafioIcon, coverGradientFor } from "@/lib/desafio-icons"
import { Pagination, PAGE_SIZE } from "@/components/pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { NEON_COLORS, hexToRgba } from "@/lib/neon-colors"
import { useIsContentEditor } from "@/lib/use-content-editor"
import { DesafioClinicoEditDialog } from "@/components/desafio-clinico-edit-dialog"
import type { DesafioClinico } from "@/lib/desafios-types"
import { useLanguage } from "@/lib/i18n"
import { bloqueadoPorPlano } from "@/lib/desafio-clinico-bloqueio"
import { getPlanStatus } from "@/lib/plan-status"

const SEM_CATEGORIA = "sem_categoria"

const CAPA_DIAGNOSTICO_IMAGENS = "/desafios-clinicos/desafio-capa-diagnostico-imagens.jpg"
const CAPA_CLINICA_MEDICA = "/desafios-clinicos/desafio-capa-clinica-medica.jpg"
const CAPA_HISTORIA_CLINICA_SEMIOLOGIA = "/desafios-clinicos/desafio-capa-historia-clinica-semiologia.jpg"
const CAPA_ELETROCARDIOGRAMA = "/desafios-clinicos/desafio-capa-eletrocardiograma.jpg"
const CAPA_PEDIATRIA_5 = "/desafios-clinicos/desafio-capa-pediatria-5.jpg"

const CAPA_POR_SECAO: Record<string, string> = {
  diagnostico_imagens: CAPA_DIAGNOSTICO_IMAGENS,
  ciclo_basico_dx: CAPA_DIAGNOSTICO_IMAGENS,
  historia_clinica_semiologia: CAPA_HISTORIA_CLINICA_SEMIOLOGIA,
  eletrocardiograma: CAPA_ELETROCARDIOGRAMA,
  pediatria_5: CAPA_PEDIATRIA_5,
}

interface HistoricoItem {
  id: string
  acertos: number
  total: number
  created_at: string
  desafio: { id: string; titulo: string; icone: string } | null
}

function DesafioCover({ desafio }: { desafio: DesafioClinico }) {
  const capaSecao = desafio.secao ? CAPA_POR_SECAO[desafio.secao] : undefined
  if (capaSecao) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-t-lg bg-black">
        <Image src={capaSecao} alt="" fill className="object-cover" />
      </div>
    )
  }

  if (desafio.area === "Clínica Médica") {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-t-lg bg-black">
        <Image src={CAPA_CLINICA_MEDICA} alt="" fill className="object-cover" />
      </div>
    )
  }

  const Icon = getDesafioIcon(desafio.icone)
  return (
    <div
      className={`flex aspect-video w-full items-center justify-center rounded-t-lg bg-gradient-to-br ${coverGradientFor(
        desafio.id
      )}`}
    >
      <Icon className="h-14 w-14 text-white drop-shadow" strokeWidth={1.75} />
    </div>
  )
}

interface DesafioCardProps {
  desafio: DesafioClinico
  hasFullAccess: boolean
  isEditor: boolean
  onEdit: (desafio: DesafioClinico, e: MouseEvent) => void
  t: ReturnType<typeof useLanguage>["t"]
}

function DesafioCard({ desafio, hasFullAccess, isEditor, onEdit, t }: DesafioCardProps) {
  const bloqueado = !isEditor && bloqueadoPorPlano(desafio, hasFullAccess)

  if (bloqueado) {
    return (
      <div
        title={t.desafiosClinicos.casoBloqueadoPlanoCard}
        role="button"
        onClick={() => alert(t.planRestricted.conteudoBloqueadoAlerta)}
        className="relative cursor-not-allowed overflow-hidden rounded-lg border border-border bg-card opacity-60"
      >
        <div className="relative">
          <DesafioCover desafio={desafio} />
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Lock className="h-8 w-8 text-white" />
          </div>
        </div>
        <div className="space-y-1 p-4">
          <h3 className="font-semibold leading-snug text-foreground">{desafio.titulo}</h3>
          <p className="pt-1 text-xs text-muted-foreground">{t.desafiosClinicos.bloqueado}</p>
        </div>
      </div>
    )
  }

  const gratuito = !isEditor && !hasFullAccess

  return (
    <Link
      href={`/dashboard/desafios-clinicos/${desafio.id}`}
      className={`group relative overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/50 ${
        gratuito ? "border-2 border-primary shadow-[0_0_0_3px_rgba(198,255,58,0.15)]" : "border-border"
      }`}
    >
      {isEditor && (
        <button
          type="button"
          onClick={(e) => onEdit(desafio, e)}
          aria-label="Editar caso clínico"
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}
      <div className="relative">
        <DesafioCover desafio={desafio} />
        {gratuito && (
          <Badge className="absolute right-2 top-2 bg-primary text-[10px] text-primary-foreground hover:bg-primary">
            {t.desafiosClinicos.gratis}
          </Badge>
        )}
      </div>
      <div className="space-y-1 p-4">
        <h3 className="font-semibold leading-snug text-foreground">{desafio.titulo}</h3>
        <p className="pt-1 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
          {t.desafiosClinicos.estudarCta} →
        </p>
      </div>
    </Link>
  )
}

export function DesafiosClinicosContent() {
  const { t } = useLanguage()
  const isEditor = useIsContentEditor()
  const [desafios, setDesafios] = useState<DesafioClinico[]>([])
  const [historico, setHistorico] = useState<HistoricoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [histPage, setHistPage] = useState(1)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingDesafio, setEditingDesafio] = useState<DesafioClinico | null>(null)
  const [hasFullAccess, setHasFullAccess] = useState(true)

  const load = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user.id

    const [{ data: desafiosData }, historicoRes, planStatus] = await Promise.all([
      supabase.from("desafios_clinicos").select("*").eq("ativo", true).order("created_at", { ascending: true }),
      userId
        ?         supabase
            .from("desafios_clinicos_historico")
            .select("id, acertos, total, created_at, desafio:desafios_clinicos(id, titulo, icone)")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      getPlanStatus(),
    ])

    const lista = (desafiosData as DesafioClinico[]) ?? []
    setDesafios(lista)
    setCollapsed((prev) =>
      prev.size === 0 ? new Set(lista.map((d) => d.secao || d.area || SEM_CATEGORIA)) : prev
    )
    setHistorico((historicoRes.data as unknown as HistoricoItem[]) ?? [])
    setHasFullAccess(planStatus?.hasFullAccess ?? true)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const openEdit = (desafio: DesafioClinico, e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingDesafio(desafio)
    setEditDialogOpen(true)
  }

  const openNew = () => {
    setEditingDesafio(null)
    setEditDialogOpen(true)
  }

  const bySection = useMemo(() => {
    const porSecao = new Map<string, DesafioClinico[]>()
    for (const desafio of desafios) {
      const key = desafio.secao || desafio.area || SEM_CATEGORIA
      if (!porSecao.has(key)) porSecao.set(key, [])
      porSecao.get(key)!.push(desafio)
    }
    return Array.from(porSecao.entries())
  }, [desafios])

  const toggleSection = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t.desafiosClinicos.carregandoDesafios}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gradient-brand">{t.desafiosClinicos.novoEstudoTitulo}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.desafiosClinicos.novoEstudoDescricao}</p>
        </div>
        {isEditor && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="h-4 w-4" />
            Novo caso
          </Button>
        )}
      </div>

      {desafios.length === 0 ? (
        <div className="rounded-lg border border-border bg-card/50 p-8 text-center">
          <p className="text-muted-foreground">{t.desafiosClinicos.nenhumDesafioDisponivel}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {bySection.map(([sectionKey, desafiosDaSecao], index) => {
            const isOpen = !collapsed.has(sectionKey)
            const titulo =
              sectionKey === SEM_CATEGORIA
                ? t.flashcardsGrid.semCategoria
                : t.cronograma.desafioSecaoLabel[sectionKey] ?? sectionKey
            const color = NEON_COLORS[index % NEON_COLORS.length].hex

            return (
              <section key={sectionKey}>
                <button
                  type="button"
                  onClick={() => toggleSection(sectionKey)}
                  className="mb-4 flex w-full items-center justify-between gap-2 rounded-2xl border-2 px-4 py-3 text-left transition-transform hover:scale-[1.005]"
                  style={{
                    borderColor: hexToRgba(color, 0.5),
                    backgroundColor: hexToRgba(color, 0.06),
                    boxShadow: `0 0 20px -8px ${hexToRgba(color, 0.6)}`,
                  }}
                >
                  <span className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
                    <Badge variant="outline" className="text-[11px]" style={{ borderColor: hexToRgba(color, 0.4), color }}>
                      {desafiosDaSecao.length}
                    </Badge>
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 shrink-0" style={{ color }} />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0" style={{ color }} />
                  )}
                </button>

                {isOpen && (
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {desafiosDaSecao.map((desafio) => (
                      <DesafioCard
                        key={desafio.id}
                        desafio={desafio}
                        hasFullAccess={hasFullAccess}
                        isEditor={isEditor}
                        onEdit={openEdit}
                        t={t}
                      />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      <div>
        <h2 className="text-xl font-bold text-foreground">{t.desafiosClinicos.estudosAnteriores}</h2>
        {historico.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t.desafiosClinicos.semEstudosAnteriores}</p>
        ) : (() => {
          const totalPages = Math.ceil(historico.length / PAGE_SIZE)
          const paginated = historico.slice((histPage - 1) * PAGE_SIZE, histPage * PAGE_SIZE)
          return (
            <>
              <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
                {paginated.map((item) => {
                  const Icon = getDesafioIcon(item.desafio?.icone ?? "")
                  const passou = item.total > 0 && item.acertos / item.total >= 0.6
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-4">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${coverGradientFor(
                          item.desafio?.id ?? item.id
                        )}`}
                      >
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.desafio?.titulo ?? t.desafiosClinicos.desafioRemovido}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString(t.desafiosClinicos.localeData)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        {passou ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        {item.acertos}/{item.total}
                      </div>
                    </div>
                  )
                })}
              </div>
              <Pagination page={histPage} totalPages={totalPages} onPageChange={setHistPage} />
            </>
          )
        })()}
      </div>

      {isEditor && (
        <DesafioClinicoEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          desafio={editingDesafio}
          onSaved={load}
        />
      )}
    </div>
  )
}
