"use client"

import { useEffect, useState } from "react"
import { Loader2, Timer } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { ANO_KEYS, MATERIA_KEYS_BY_ANO, PARCIAL_KEYS, parciaisDaMateria, ehSimuladoIntegrador, type AnoKey, type ParcialKey } from "@/lib/unr-curriculum"
import { getMateriaColor } from "@/lib/materia-colors"
import { getQuestoesJaRespondidas } from "@/lib/questoes-ja-respondidas"
import { buscarQuestoesAtivasLeve as getQuestoesAtivasPool, filtrarPoolIds } from "@/lib/questoes-cache"
import { filtrarPoolGratis, FREE_QUESTOES_POR_MATERIA } from "@/lib/questoes-gratis"
import { getPlanStatus, type PlanStatus } from "@/lib/plan-status"
import { trackEvent } from "@/lib/analytics"
import { shuffle } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PlanRestrictedNotice } from "@/components/plan-restricted-notice"
import { GeneratingOverlay } from "@/components/generating-overlay"
import type { SimuladoConfig } from "@/components/simulado-player"
import { useLanguage } from "@/lib/i18n"

interface PracticeLauncherProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStart: (config: SimuladoConfig) => void
}

const QUANTITIES = [5, 10, 20, 30, 50, 60]
const ALL_MATERIAS = ANO_KEYS.flatMap((ano) => MATERIA_KEYS_BY_ANO[ano])

export function PracticeLauncher({ open, onOpenChange, onStart }: PracticeLauncherProps) {
  const { t } = useLanguage()
  const [starting, setStarting] = useState(false)
  const dificuldade = "aleatorio"
  const [selectedMaterias, setSelectedMaterias] = useState<string[]>([])
  const [filtroAno, setFiltroAno] = useState<AnoKey | null>(null)
  const [parcial, setParcial] = useState<ParcialKey | "">("")
  const [count, setCount] = useState(10)
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [apenasIneditas, setApenasIneditas] = useState(true)
  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null)
  const [planLoading, setPlanLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setPlanLoading(true)
    getPlanStatus().then((status) => {
      setPlanStatus(status)
      setPlanLoading(false)
    })
  }, [open])

  // No plano gratuito o limite não é mais um contador global -- é um pool
  // fixo de até FREE_QUESTOES_POR_MATERIA perguntas por matéria (sempre as
  // mesmas, iguais pra toda conta gratuita). Só o plano pago expirado
  // bloqueia o lançador inteiro; o plano gratuito sempre pode tentar --
  // "Verificar" e o próprio envio já mostram quando o pool fixo acabar.
  const isBlocked = !!planStatus && planStatus.accessExpired
  const quantityOptions = QUANTITIES

  const toggleMateria = (materia: string) => {
    setSelectedMaterias((prev) => {
      const next = prev.includes(materia) ? prev.filter((m) => m !== materia) : [...prev, materia]
      const disponiveis = next.length > 0 ? new Set(next.flatMap((m) => parciaisDaMateria(m))) : new Set(PARCIAL_KEYS)
      if (parcial && !disponiveis.has(parcial)) setParcial("")
      return next
    })
  }

  const materiasFiltro = () =>
    selectedMaterias.length > 0 && selectedMaterias.length < ALL_MATERIAS.length ? selectedMaterias : undefined

  const parciaisDisponiveis =
    selectedMaterias.length > 0
      ? PARCIAL_KEYS.filter((p) => selectedMaterias.some((m) => parciaisDaMateria(m).includes(p)))
      : PARCIAL_KEYS

  const handleStart = async () => {
    const materiasSelecionadas = materiasFiltro()
    const label = materiasSelecionadas
      ? materiasSelecionadas.map((m) => t.cronograma.materiaLabel[m] ?? m).join(", ")
      : t.practiceLauncher.labelAleatorias

    setStarting(true)
    const { data: userData } = await supabase.auth.getUser()

    let questionIds: string[] | undefined
    let simuladoId: string | undefined

    if (userData.user) {
      const pool = await getQuestoesAtivasPool()
      let poolIds = filtrarPoolIds(pool, { materias: materiasSelecionadas, dificuldade, parcial: parcial || undefined })
      if (apenasIneditas) {
        const jaRespondidas = await getQuestoesJaRespondidas(userData.user.id)
        poolIds = poolIds.filter((id) => !jaRespondidas.has(id))
      }
      if (planStatus && !planStatus.hasFullAccess) {
        poolIds = filtrarPoolGratis(pool, poolIds)
      }
      questionIds = shuffle(poolIds).slice(0, count)

      const { data: inserted } = await supabase
        .from("simulados")
        .insert({
          user_id: userData.user.id,
          nome: label,
          areas: materiasSelecionadas ?? [],
          dificuldade: dificuldade !== "aleatorio" ? dificuldade : null,
          parcial: parcial || null,
          quantidade_questoes: questionIds.length,
          questao_ids: questionIds,
          modo: "individual",
        })
        .select("id")
        .single()
      simuladoId = inserted?.id

      if (inserted) {
        trackEvent("treino_iniciado", {
          nome: label,
          areas: materiasSelecionadas ?? [],
          quantidade_questoes: questionIds.length,
        })
      }
    }

    setStarting(false)
    onStart({
      label,
      count,
      materias: materiasSelecionadas,
      dificuldade,
      parcial: parcial || undefined,
      timerEnabled,
      mode: "individual",
      questionIds,
      simuladoId,
    })
    onOpenChange(false)
  }

  return (
    <>
      {starting && <GeneratingOverlay message={t.practiceLauncher.gerando} />}
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.practiceLauncher.dialogTitulo}</DialogTitle>
        </DialogHeader>

        {planLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isBlocked ? (
          <PlanRestrictedNotice
            tone={planStatus?.accessExpired ? "expired" : "limit"}
            title={planStatus?.accessExpired ? t.practiceLauncher.planExpiradoTitulo : t.practiceLauncher.limiteAtingidoTitulo}
            description={planStatus?.accessExpired ? t.practiceLauncher.planExpiradoDesc : t.practiceLauncher.limiteDesc}
          />
        ) : (
        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">

          <div className="space-y-2">
            <Label>{t.practiceLauncher.materiaLabelTodas}</Label>
            <button
              onClick={() =>
                setSelectedMaterias((prev) => (prev.length === ALL_MATERIAS.length ? [] : [...ALL_MATERIAS]))
              }
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all hover:shadow-[0_0_18px_rgba(198,255,58,0.45)] ${
                selectedMaterias.length === ALL_MATERIAS.length
                  ? "border-transparent bg-gradient-to-r from-[#c6ff3a] to-[#84cc16] text-[#0a1f00]"
                  : "border-input text-foreground hover:bg-accent"
              }`}
            >
              {t.treinamentos.todas}
            </button>
            <div className="flex flex-wrap gap-2">
              {ANO_KEYS.map((ano) => {
                const ativo = filtroAno === ano
                return (
                  <button
                    key={ano}
                    type="button"
                    onClick={() => setFiltroAno((prev) => (prev === ano ? null : ano))}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all hover:shadow-[0_0_18px_rgba(198,255,58,0.45)] ${
                      ativo
                        ? "border-transparent bg-gradient-to-r from-[#c6ff3a] to-[#84cc16] text-[#0a1f00]"
                        : "border-input text-foreground hover:bg-accent"
                    }`}
                  >
                    {t.cronograma.anoLabel[ano]}
                  </button>
                )
              })}
            </div>
            {filtroAno && (
              <div className="mt-3 flex flex-wrap gap-2">
                {MATERIA_KEYS_BY_ANO[filtroAno].map((materia) => {
                  const cor = getMateriaColor(materia)
                  const ativo = selectedMaterias.includes(materia)
                  return (
                    <button
                      key={materia}
                      onClick={() => toggleMateria(materia)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${cor.hoverGlow} ${
                        ativo ? `${cor.activeBg} border-transparent text-white` : `${cor.borderSoft} text-foreground hover:bg-accent`
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ativo ? "bg-white" : cor.dot}`} />
                      {t.cronograma.materiaLabel[materia]}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t.treinamentos.questoesLabel}</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setApenasIneditas(true)}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  apenasIneditas ? "border-primary bg-primary/10 text-primary" : "border-input text-foreground hover:bg-accent"
                }`}
              >
                {t.treinamentos.excluirJaRespondidas}
              </button>
              <button
                type="button"
                onClick={() => setApenasIneditas(false)}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  !apenasIneditas ? "border-primary bg-primary/10 text-primary" : "border-input text-foreground hover:bg-accent"
                }`}
              >
                {t.treinamentos.todasAsQuestoes}
              </button>
            </div>
          </div>

          {selectedMaterias.length > 0 && (
            <div className="space-y-2">
              <Label>{t.treinamentos.parcial}</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => setParcial("")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    parcial === "" ? "border-primary bg-primary/10 text-primary" : "border-input text-foreground hover:bg-accent"
                  }`}
                >
                  {ehSimuladoIntegrador(selectedMaterias) ? t.treinamentos.integrador : t.treinamentos.qualquer}
                </button>
                {parciaisDisponiveis.map((p) => (
                  <button
                    key={p}
                    onClick={() => setParcial(p)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      parcial === p ? "border-primary bg-primary/10 text-primary" : "border-input text-foreground hover:bg-accent"
                    }`}
                  >
                    {t.cronograma.parcialLabel[p]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>{t.treinamentos.quantidadeDeQuestoes}</Label>
            <div className="flex flex-wrap gap-2">
              {quantityOptions.map((q) => (
                <button
                  key={q}
                  onClick={() => setCount(q)}
                  className={`h-9 w-12 rounded-lg border text-sm font-medium transition-colors ${
                    count === q
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input text-foreground hover:bg-accent"
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
            {planStatus && !planStatus.hasFullAccess && (
              <p className="text-xs text-muted-foreground">
                {t.practiceLauncher.questoesPlanoGratuito(FREE_QUESTOES_POR_MATERIA)}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">{t.practiceLauncher.cronometro}</p>
                <p className="text-xs text-muted-foreground">{t.practiceLauncher.cronometroDesc}</p>
              </div>
            </div>
            <Switch checked={timerEnabled} onCheckedChange={setTimerEnabled} />
          </div>
        </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isBlocked ? t.practiceLauncher.fechar : t.treinamentos.cancelar}
          </Button>
          {!isBlocked && !planLoading && (
            <Button variant="gradient" onClick={handleStart} disabled={quantityOptions.length === 0 || starting} className="gap-1.5">
              {starting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.practiceLauncher.iniciarTreino}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      </Dialog>
    </>
  )
}
