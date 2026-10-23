"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Eye,
  Loader2,
  Play,
  RotateCcw,
  Target,
  Trash2,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { IconChip } from "@/components/ui/icon-chip"
import {
  ANO_KEYS,
  MATERIA_KEYS_BY_ANO,
  PARCIAL_KEYS,
  parciaisDaMateria,
  ehSimuladoIntegrador,
  INTEGRADOR_CM_KEY,
  expandirMateriaIntegrador,
  type AnoKey,
  type ParcialKey,
} from "@/lib/unr-curriculum"
import { getMateriaColor } from "@/lib/materia-colors"
import { getQuestoesJaRespondidas } from "@/lib/questoes-ja-respondidas"
import { buscarQuestoesAtivasLeve as getQuestoesAtivasPool, filtrarPoolIds } from "@/lib/questoes-cache"
import { filtrarPoolGratis } from "@/lib/questoes-gratis"
import { getPlanStatus } from "@/lib/plan-status"
import { shuffle } from "@/lib/utils"
import { trackEvent } from "@/lib/analytics"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { SimuladoPlayer, type SimuladoConfig } from "@/components/simulado-player"
import { PracticeLauncher } from "@/components/practice-launcher"
import { GeneratingOverlay } from "@/components/generating-overlay"
import { Pagination, PAGE_SIZE } from "@/components/pagination"
import { useLanguage } from "@/lib/i18n"
import { useTutorial, PASSOS_CRIAR_SIMULADO, TOUR_COMPLETO } from "@/components/onboarding-tutorial"

interface Simulado {
  id: string
  nome: string
  areas: string[]
  dificuldade: string | null
  parcial: string | null
  quantidade_questoes: number
  questao_ids: string[]
  finished_at: string | null
  created_at: string
  modo: "individual" | "simulado"
  timer_segundos_por_questao: number | null
  modo_estrito: boolean
  respostas: (number | null)[] | null
  progresso_index: number | null
}

const QUANTIDADES = [10, 20, 30, 50, 60]
const TEMPOS_POR_QUESTAO = [30, 60, 90, 120, 180]
const ALL_MATERIAS = ANO_KEYS.flatMap((ano) => MATERIA_KEYS_BY_ANO[ano])

function temProgresso(s: Simulado) {
  return (s.progresso_index ?? 0) > 0 || (s.respostas ?? []).some((a) => a !== null)
}

export function SimuladosContent() {
  const { t } = useLanguage()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { abrirAjudaPagina, tutorialAberto } = useTutorial()
  const [simulados, setSimulados] = useState<Simulado[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [practiceOpen, setPracticeOpen] = useState(false)

  useEffect(() => {
    if (searchParams.get("novo") === "true") setOpen(true)
  }, [searchParams])

  // Vindo do passo "Como criar um simulado" do tour do dashboard
  // (?novo=true&tutorialCriar=true) -- o diálogo já abre (efeito acima),
  // aqui só dispara o passo a passo campo a campo assim que ele estiver
  // de fato na tela. tutorialCriarDisparado evita repetir se searchParams
  // mudar de identidade sem o valor em si ter mudado. aoTerminarRoute
  // devolve o aluno pro tour completo, continuando logo depois de "Como
  // criar um simulado" (não do início) -- tanto ao terminar os 7 passos
  // quanto se clicar "Pular tutorial" no meio.
  const tutorialCriarDisparado = useRef(false)
  useEffect(() => {
    if (!open) return
    if (searchParams.get("tutorialCriar") !== "true") return
    if (tutorialCriarDisparado.current) return
    tutorialCriarDisparado.current = true
    const indiceContinuar = TOUR_COMPLETO.findIndex((p) => p.tituloKey === "simuladoResolverTitulo")
    abrirAjudaPagina(PASSOS_CRIAR_SIMULADO, {
      aoTerminarRoute: `/dashboard?continuarTutorial=${indiceContinuar >= 0 ? indiceContinuar : 0}`,
    })
    router.replace(pathname)
  }, [open, searchParams, abrirAjudaPagina, router, pathname])

  const [playerConfig, setPlayerConfig] = useState<SimuladoConfig | null>(null)
  const [playerOpen, setPlayerOpen] = useState(false)

  const [nome, setNome] = useState("")
  const [selectedMaterias, setSelectedMaterias] = useState<string[]>([])
  const [filtroAno, setFiltroAno] = useState<AnoKey | null>(null)
  const [dificuldade, setDificuldade] = useState("aleatorio")
  const [parcial, setParcial] = useState<ParcialKey | "">("")
  const [quantidade, setQuantidade] = useState(20)
  const [tempoPorQuestao, setTempoPorQuestao] = useState(90)
  const [apenasIneditas, setApenasIneditas] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [simuladosPage, setSimuladosPage] = useState(1)

  const loadSimulados = async () => {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from("simulados")
      .select("*")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false })
    setSimulados((data as Simulado[]) ?? [])
    setSimuladosPage(1)
    setLoading(false)
  }

  useEffect(() => {
    loadSimulados()
  }, [])

  const startPlayer = (config: SimuladoConfig) => {
    setPlayerConfig(config)
    setPlayerOpen(true)
  }

  const playSimulado = (s: Simulado) => {
    startPlayer({
      label: s.nome,
      count: s.quantidade_questoes,
      questionIds: s.questao_ids,
      mode: s.modo,
      simuladoId: s.id,
      modoEstrito: s.modo_estrito,
      tempoPorQuestaoSegundos: s.timer_segundos_por_questao ?? undefined,
      respostasIniciais: s.respostas ?? undefined,
      progressoInicial: s.progresso_index ?? undefined,
    })
  }

  const reviewSimulado = (s: Simulado) => {
    startPlayer({
      label: s.nome,
      count: s.quantidade_questoes,
      questionIds: s.questao_ids,
      mode: s.modo,
      readOnly: true,
      respostasIniciais: s.respostas ?? undefined,
    })
  }

  useEffect(() => {
    if (loading) return
    const playId = searchParams.get("play")
    if (!playId) return
    const alvo = simulados.find((s) => s.id === playId)
    if (alvo) playSimulado(alvo)
    router.replace(pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, simulados, searchParams])

  const toggleMateria = (materia: string) => {
    setSelectedMaterias((prev) => {
      // Tira o Integrador (matéria virtual) da base antes de combinar com
      // qualquer matéria real escolhida -- não faz sentido misturar os dois.
      const base = prev.filter((m) => m !== INTEGRADOR_CM_KEY)
      const next = base.includes(materia) ? base.filter((m) => m !== materia) : [...base, materia]
      const disponiveis = next.length > 0 ? new Set(next.flatMap((m) => parciaisDaMateria(m))) : new Set(PARCIAL_KEYS)
      if (parcial && !disponiveis.has(parcial)) setParcial("")
      return next
    })
  }

  // Integrador Clínica Médica é uma matéria virtual, separada dos anos:
  // sempre mistura 1º e 2º parcial de clinica_medica_4 E clinica_medica_5
  // (ver expandirMateriaIntegrador), por isso é mutuamente exclusiva com
  // qualquer outra seleção -- escolher ela limpa o resto, e vice-versa
  // (ver filtro em toggleMateria acima e no botão "Todas").
  const toggleIntegradorCM = () => {
    setSelectedMaterias((prev) => (prev.includes(INTEGRADOR_CM_KEY) ? [] : [INTEGRADOR_CM_KEY]))
    setParcial("")
    // Fecha qualquer ano que estivesse aberto -- selecionar o Integrador é
    // exclusivo, não faz sentido continuar mostrando as matérias de um ano.
    setFiltroAno(null)
  }

  const parciaisDisponiveis =
    selectedMaterias.length > 0
      ? PARCIAL_KEYS.filter((p) => selectedMaterias.some((m) => parciaisDaMateria(m).includes(p)))
      : PARCIAL_KEYS

  const resetForm = () => {
    setNome("")
    setSelectedMaterias([])
    setFiltroAno(null)
    setDificuldade("aleatorio")
    setParcial("")
    setQuantidade(20)
    setTempoPorQuestao(90)
    setApenasIneditas(true)
    setCreateError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return
    setCreating(true)
    setCreateError(null)

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setCreateError(t.treinamentos.sessaoExpirada)
      setCreating(false)
      return
    }

    // Integrador Clínica Médica é virtual (não é tag real de nenhuma
    // questão) -- vira as 2 matérias reais pra filtrar o pool, sem filtro
    // de parcial (sempre mistura os dois). O parcial em si já fica "" porque
    // o seletor nem aparece pra essa matéria (ver toggleIntegradorCM).
    const materiasParaFiltro = expandirMateriaIntegrador(selectedMaterias)

    const activePool = await getQuestoesAtivasPool()
    let poolIds = filtrarPoolIds(activePool, {
      materias: materiasParaFiltro.length > 0 ? materiasParaFiltro : undefined,
      dificuldade,
      parcial: parcial || undefined,
    })

    if (apenasIneditas) {
      const jaRespondidas = await getQuestoesJaRespondidas(userData.user.id)
      poolIds = poolIds.filter((id) => !jaRespondidas.has(id))
    }

    const planStatus = await getPlanStatus()
    if (planStatus && !planStatus.hasFullAccess) {
      poolIds = filtrarPoolGratis(activePool, poolIds)
    }

    if (poolIds.length < quantidade) {
      setCreateError(t.treinamentos.semQuestoesErro(poolIds.length))
      setCreating(false)
      return
    }

    const questaoIds = shuffle(poolIds).slice(0, quantidade)

    const { data: novoSimulado, error } = await supabase
      .from("simulados")
      .insert({
        user_id: userData.user.id,
        nome: nome.trim(),
        areas: selectedMaterias,
        dificuldade: dificuldade !== "aleatorio" ? dificuldade : null,
        parcial: parcial || null,
        quantidade_questoes: quantidade,
        questao_ids: questaoIds,
        modo: "simulado",
        modo_estrito: true,
        timer_segundos_por_questao: tempoPorQuestao,
      })
      .select()
      .single()

    if (!error) {
      trackEvent("simulado_iniciado", {
        nome: nome.trim(),
        areas: selectedMaterias,
        quantidade_questoes: quantidade,
        modo: "simulado",
      })
    }

    setCreating(false)
    if (error || !novoSimulado) {
      setCreateError(t.treinamentos.criarErro)
      return
    }

    resetForm()
    setOpen(false)
    loadSimulados()
    playSimulado(novoSimulado as Simulado)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await supabase.from("simulados").delete().eq("id", id)
    setSimulados((prev) => prev.filter((s) => s.id !== id))
    setDeletingId(null)
  }

  return (
    <div className="space-y-6">
      {creating && <GeneratingOverlay message={t.treinamentos.gerandoSimulado} />}
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gradient-brand">{t.treinamentos.headerTitulo}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.treinamentos.headerSubtitulo}</p>
      </div>

      {/* Entry points: Treinamento Livre x Simulados */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="relative flex flex-col justify-between overflow-hidden border-0 bg-gradient-to-br from-[#c6ff3a] to-[#84cc16] p-6 text-[#0a1f00]">
          <BookOpen className="pointer-events-none absolute -bottom-6 -right-6 h-40 w-40 rotate-[-12deg] text-[#0a1f00]/10" strokeWidth={1.5} />
          <div className="relative">
            <IconChip icon={BookOpen} className="bg-[#0a1f00]/10" iconClassName="text-[#0a1f00]" />
            <h3 className="mt-4 text-2xl font-bold">{t.treinamentos.treinamentoLivreTitulo}</h3>
            <p className="text-sm text-[#0a1f00]/70">{t.treinamentos.treinamentoLivreSubtitulo}</p>
            <ul className="mt-4 space-y-2 text-sm text-[#0a1f00]/80">
              <li>• {t.treinamentos.treinamentoLivreItem1}</li>
              <li>• {t.treinamentos.treinamentoLivreItem2}</li>
              <li>• {t.treinamentos.treinamentoLivreItem3}</li>
            </ul>
          </div>
          <Button
            variant="secondary"
            className="relative mt-6 w-full justify-between rounded-full bg-[#0a1f00]/10 text-[#0a1f00] hover:bg-[#0a1f00]/15"
            onClick={() => setPracticeOpen(true)}
          >
            {t.treinamentos.iniciarTreinamentoLivre}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Card>

        <Card className="relative flex flex-col justify-between overflow-hidden border-0 bg-gradient-to-br from-[#c6ff3a] to-[#84cc16] p-6 text-[#0a1f00]">
          <Target className="pointer-events-none absolute -bottom-6 -right-6 h-40 w-40 rotate-[12deg] text-[#0a1f00]/10" strokeWidth={1.5} />
          <div className="relative">
            <IconChip icon={Target} className="bg-[#0a1f00]/10" iconClassName="text-[#0a1f00]" />
            <h3 className="mt-4 text-2xl font-bold">{t.treinamentos.simuladosTitulo}</h3>
            <p className="text-sm text-[#0a1f00]/70">{t.treinamentos.simuladosSubtitulo}</p>
            <ul className="mt-4 space-y-2 text-sm text-[#0a1f00]/80">
              <li>• {t.treinamentos.simuladosItem1}</li>
              <li>• {t.treinamentos.simuladosItem2}</li>
              <li>• {t.treinamentos.simuladosItem3}</li>
            </ul>
          </div>
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v)
              if (!v) resetForm()
            }}
          >
            <DialogTrigger asChild>
              <Button variant="secondary" className="relative mt-6 w-full justify-between rounded-full bg-[#0a1f00]/10 text-[#0a1f00] hover:bg-[#0a1f00]/15">
                {t.treinamentos.criarSimulado}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent
              // Com o tutorial rodando, o cartão de explicação fica preso
              // na vertical à esquerda da tela (cardNaEsquerda, ver
              // onboarding-tutorial.tsx) -- desloca e alarga o diálogo pra
              // direita aqui, pra não ficar um cobrindo o outro (era esse
              // o problema: o cartão sobrepunha campos como "Parcial").
              className={
                tutorialAberto
                  ? "max-w-md left-auto right-4 translate-x-0 sm:right-12 sm:max-w-2xl"
                  : "max-w-md"
              }
              // Os botões do tutorial (Próximo/Pular/Entendi) ficam num
              // overlay próprio, fora deste DialogContent -- sem isso, o
              // Radix interpreta o clique neles como "fora do diálogo" e
              // fecha o diálogo sozinho no meio do passo a passo.
              onPointerDownOutside={(e) => { if (tutorialAberto) e.preventDefault() }}
              onInteractOutside={(e) => { if (tutorialAberto) e.preventDefault() }}
            >
              <DialogHeader>
                <DialogTitle>{t.treinamentos.criarNovoSimulado}</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
                <div data-tutorial="simulado-form-nome">
                  <label htmlFor="name" className="mb-1 block text-sm font-medium text-foreground">
                    {t.treinamentos.nomeDoSimulado}
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder={t.treinamentos.nomePlaceholder}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-foreground placeholder-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>

                <div data-tutorial="simulado-form-materias">
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t.treinamentos.materiaLabelNenhuma}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMaterias((prev) => (prev.length === ALL_MATERIAS.length ? [] : [...ALL_MATERIAS]))
                      setFiltroAno(null)
                    }}
                    className={`mb-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all hover:shadow-[0_0_18px_rgba(198,255,58,0.45)] ${
                      selectedMaterias.length === ALL_MATERIAS.length
                        ? "border-transparent bg-gradient-to-r from-[#c6ff3a] to-[#84cc16] text-[#0a1f00]"
                        : "border-input text-foreground hover:bg-accent"
                    }`}
                  >
                    {t.treinamentos.todas}
                  </button>
                  {/* Linha dos anos. Os botões de ANO são apenas FILTROS (abrem
                      a lista de matérias daquele ano logo abaixo) -- por isso o
                      estado ativo deles usa um destaque NEUTRO (bg-accent), não
                      o verde de seleção, pra nunca parecer que o ano está
                      "selecionado" junto com uma matéria ou com o Integrador.
                      O Integrador Clínica Médica é matéria virtual (seleção de
                      verdade, verde) e mutuamente exclusiva -- fica entre o 4º e
                      o 5º ano por ser a prova integradora desses dois anos. */}
                  <div className="flex flex-wrap gap-2">
                    {ANO_KEYS.map((ano) => {
                      const ativo = filtroAno === ano
                      const botaoAno = (
                        <button
                          key={ano}
                          type="button"
                          onClick={() => setFiltroAno((prev) => (prev === ano ? null : ano))}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all hover:shadow-[0_0_18px_rgba(198,255,58,0.45)] ${
                            ativo
                              ? "border-primary/60 bg-accent font-semibold text-foreground"
                              : "border-input text-foreground hover:bg-accent"
                          }`}
                        >
                          {t.cronograma.anoLabel[ano]}
                        </button>
                      )
                      if (ano !== "ano4") return botaoAno
                      return [
                        botaoAno,
                        <button
                          key="integrador-cm"
                          type="button"
                          onClick={toggleIntegradorCM}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all hover:shadow-[0_0_18px_rgba(198,255,58,0.45)] ${
                            selectedMaterias.includes(INTEGRADOR_CM_KEY)
                              ? "border-transparent bg-gradient-to-r from-[#c6ff3a] to-[#84cc16] text-[#0a1f00]"
                              : "border-input text-foreground hover:bg-accent"
                          }`}
                        >
                          {t.cronograma.materiaLabel[INTEGRADOR_CM_KEY]}
                        </button>,
                      ]
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
                            type="button"
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

                <div data-tutorial="simulado-form-ineditas">
                  <label className="mb-2 block text-sm font-medium text-foreground">{t.treinamentos.questoesLabel}</label>
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

                {selectedMaterias.length > 0 && !selectedMaterias.includes(INTEGRADOR_CM_KEY) && (
                  <div data-tutorial="simulado-form-parcial">
                    <label className="mb-2 block text-sm font-medium text-foreground">{t.treinamentos.parcial}</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
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
                          type="button"
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

                <div data-tutorial="simulado-form-quantidade">
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t.treinamentos.quantidadeDeQuestoes}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {QUANTIDADES.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQuantidade(q)}
                        className={`h-9 w-12 rounded-lg border text-sm font-medium transition-colors ${
                          quantidade === q
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-input text-foreground hover:bg-accent"
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-border p-3" data-tutorial="simulado-form-tempo">
                  <div>
                    <p className="text-sm font-medium text-foreground">{t.treinamentos.tempoPorQuestao}</p>
                    <p className="text-xs text-muted-foreground">{t.treinamentos.tempoPorQuestaoDesc}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {TEMPOS_POR_QUESTAO.map((seg) => (
                      <button
                        key={seg}
                        type="button"
                        onClick={() => setTempoPorQuestao(seg)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          tempoPorQuestao === seg
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-input text-foreground hover:bg-accent"
                        }`}
                      >
                        {seg}s
                      </button>
                    ))}
                  </div>
                </div>

                {createError && <p className="text-xs text-destructive">{createError}</p>}

                <div className="flex gap-2 pt-2" data-tutorial="simulado-form-criar">
                  <Button type="submit" variant="gradient" className="flex-1 gap-1.5" disabled={creating || !nome.trim()}>
                    {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t.treinamentos.criarSimulado}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
                    {t.treinamentos.cancelar}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </Card>
      </div>

      {/* Simulados List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t.treinamentos.meusTreinamentos}</h3>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.treinamentos.carregandoTreinamentos}
          </div>
        ) : simulados.length === 0 ? (
          <div className="rounded-lg border border-border bg-card/50 p-8 text-center">
            <p className="text-muted-foreground">{t.treinamentos.nenhumTreinamento}</p>
          </div>
        ) : (() => {
          const totalPages = Math.ceil(simulados.length / PAGE_SIZE)
          const paginated = simulados.slice((simuladosPage - 1) * PAGE_SIZE, simuladosPage * PAGE_SIZE)
          return (
            <>
              <div className="space-y-3">
                {paginated.map((simulado) => {
            const emAndamento = !simulado.finished_at && temProgresso(simulado)
            return (
              <div
                key={simulado.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-foreground">{simulado.nome}</h3>
                    <Badge variant="secondary">{simulado.modo === "simulado" ? t.treinamentos.badgeSimulado : t.treinamentos.badgeEstudo}</Badge>
                    {simulado.finished_at && (
                      <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                        <CheckCircle2 className="h-3 w-3" />
                        {t.treinamentos.concluido}
                      </span>
                    )}
                    {emAndamento && (
                      <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
                        <RotateCcw className="h-3 w-3" />
                        {t.treinamentos.emAndamento}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(simulado.areas.length > 0 ? simulado.areas : [t.treinamentos.todasAsMaterias]).map((materia) => (
                      <span
                        key={materia}
                        className="inline-flex items-center rounded-full bg-[#c6ff3a]/20 px-2.5 py-0.5 text-xs font-medium text-primary"
                      >
                        {t.cronograma.materiaLabel[materia] ?? materia}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{simulado.quantidade_questoes} {t.treinamentos.questoesCount}</span>
                    {simulado.parcial && <span>{t.cronograma.parcialLabel[simulado.parcial] ?? simulado.parcial}</span>}
                    {simulado.modo_estrito && simulado.timer_segundos_por_questao && (
                      <span>{simulado.timer_segundos_por_questao}{t.treinamentos.segundosPorQuestao}</span>
                    )}
                    <span>{t.treinamentos.criadoEm} {new Date(simulado.created_at).toLocaleDateString(t.treinamentos.localeData)}</span>
                  </div>
                </div>

                <div className="ml-4 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-primary hover:bg-primary/10"
                    aria-label={emAndamento ? t.treinamentos.ariaRetomar : simulado.finished_at ? t.treinamentos.ariaVerCorrecao : t.treinamentos.ariaIniciar}
                    onClick={() => (simulado.finished_at ? reviewSimulado(simulado) : playSimulado(simulado))}
                  >
                    {emAndamento ? <RotateCcw className="h-4 w-4" /> : simulado.finished_at ? <Eye className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {emAndamento ? t.treinamentos.retomar : simulado.finished_at ? t.treinamentos.verCorrecao : t.treinamentos.iniciar}
                  </Button>
                  {!simulado.finished_at && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(simulado.id)}
                      disabled={deletingId === simulado.id}
                      className="text-destructive hover:bg-destructive/10"
                      aria-label={t.treinamentos.ariaExcluir}
                    >
                      {deletingId === simulado.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
              </div>
              <Pagination page={simuladosPage} totalPages={totalPages} onPageChange={setSimuladosPage} />
            </>
          )
        })()}
      </div>

      <PracticeLauncher open={practiceOpen} onOpenChange={setPracticeOpen} onStart={startPlayer} />

      <SimuladoPlayer
        open={playerOpen}
        onOpenChange={(v) => {
          setPlayerOpen(v)
          if (!v) loadSimulados()
        }}
        config={playerConfig}
      />
    </div>
  )
}
