"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  BookOpen,
  Download,
  Eye,
  File,
  FileSpreadsheet,
  FileText,
  Folder,
  Image as ImageIcon,
  Loader2,
  NotebookPen,
  Presentation,
  X,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/lib/i18n"
import { ANO_KEYS, DISCIPLINA_BASE_KEYS, MATERIA_KEYS_BY_ANO, type AnoKey } from "@/lib/unr-curriculum"
import { tiposDaMateria, type TipoBiblioteca } from "@/lib/biblioteca-tipos"
import { getAnoColor, getMateriaColor } from "@/lib/materia-colors"
import { BibliotecaPdfEditor } from "@/components/biblioteca-pdf-editor"
import { BibliotecaMeusArquivos } from "@/components/biblioteca-meus-arquivos"
import { useTutorial, TOUR_COMPLETO, PASSOS_FERRAMENTAS_BIBLIOTECA } from "@/components/onboarding-tutorial"

interface PastaConfig {
  id: string
  materia_key: string
  tipo: "livro" | "resumo"
  drive_folder_id: string
}

interface DriveArquivo {
  id: string
  name: string
  mimeType: string
  size?: string
}

async function authedFetch(input: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return fetch(input, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  })
}

function formatBytes(bytes?: string) {
  if (!bytes) return ""
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return ""
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function extensaoArquivo(nome: string) {
  const match = /\.([a-zA-Z0-9]+)$/.exec(nome)
  return match ? match[1].toUpperCase() : ""
}

// Ícone por tipo de arquivo (não por matéria) -- numa lista longa, é essa
// diferenciação por tipo que ajuda o aluno a identificar o arquivo de
// relance, a cor da matéria já fica só no cabeçalho da página.
function iconeArquivo(mimeType: string): { Icon: typeof FileText; cor: string; bg: string } {
  if (mimeType === "application/pdf") return { Icon: FileText, cor: "text-rose-500", bg: "bg-rose-500/10" }
  if (mimeType.startsWith("image/")) return { Icon: ImageIcon, cor: "text-blue-500", bg: "bg-blue-500/10" }
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return { Icon: FileSpreadsheet, cor: "text-emerald-500", bg: "bg-emerald-500/10" }
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
    return { Icon: Presentation, cor: "text-amber-500", bg: "bg-amber-500/10" }
  if (mimeType.includes("word") || mimeType.includes("document"))
    return { Icon: FileText, cor: "text-sky-500", bg: "bg-sky-500/10" }
  return { Icon: File, cor: "text-muted-foreground", bg: "bg-muted" }
}

// Só o nome exibido NESSA pasta da Biblioteca -- a chave continua
// "parasitologia" (não mexe em questões/flashcards/estatísticas, que
// usam t.cronograma.disciplinaBaseLabel direto, sem passar por aqui).
const BIBLIOTECA_LABEL_OVERRIDE: Record<"pt" | "es", Record<string, string>> = {
  pt: { parasitologia: "Semiologia" },
  es: { parasitologia: "Semiología" },
}

export function BibliotecaDriveContent() {
  const { t, lang } = useLanguage()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { abrirAjudaPagina } = useTutorial()
  const tutorialDisparado = useRef(false)
  const [pastas, setPastas] = useState<PastaConfig[]>([])
  const [loadingPastas, setLoadingPastas] = useState(true)
  const [erroPastas, setErroPastas] = useState(false)
  const [materiaKey, setMateriaKey] = useState<string | null>(null)
  const [tipoEscolhido, setTipoEscolhido] = useState<TipoBiblioteca | null>(null)

  const [arquivos, setArquivos] = useState<DriveArquivo[]>([])
  const [loadingArquivos, setLoadingArquivos] = useState(false)
  const [erroArquivos, setErroArquivos] = useState(false)
  const [baixando, setBaixando] = useState<{ id: string; percent: number | null } | null>(null)
  const [visualizando, setVisualizando] = useState<DriveArquivo | null>(null)
  const [tokenAtual, setTokenAtual] = useState<string | null>(null)

  useEffect(() => {
    authedFetch("/api/biblioteca/pastas")
      .then(async (res) => {
        if (!res.ok) throw new Error("erro")
        const json = await res.json()
        setPastas(json.pastas ?? [])
      })
      .catch(() => setErroPastas(true))
      .finally(() => setLoadingPastas(false))
  }, [])

  const tiposDisponiveis = materiaKey ? tiposDaMateria(materiaKey) : []
  const tipoAtual: TipoBiblioteca | null = materiaKey
    ? tiposDisponiveis.length === 1
      ? tiposDisponiveis[0]
      : tipoEscolhido
    : null

  const pastaConfigAtual = useMemo(() => {
    if (!materiaKey || !tipoAtual) return null
    return pastas.find((p) => p.materia_key === materiaKey && p.tipo === tipoAtual) ?? null
  }, [pastas, materiaKey, tipoAtual])

  // prontoPara: materia_key cujos arquivos já terminaram de carregar (sucesso
  // ou erro) -- diferente de "!loadingArquivos", que também é true ANTES do
  // fetch começar (mesmo commit em que materiaKey muda, por causa de como
  // efeitos em React só veem o estado uns dos outros na renderização
  // seguinte) -- o efeito do tutorial abaixo depende dessa distinção pra não
  // disparar antes dos arquivos chegarem de verdade.
  const [prontoPara, setProntoPara] = useState<string | null>(null)

  useEffect(() => {
    if (!pastaConfigAtual) {
      setArquivos([])
      return
    }
    setLoadingArquivos(true)
    setErroArquivos(false)
    setProntoPara(null)
    authedFetch(`/api/biblioteca/arquivos?folderId=${encodeURIComponent(pastaConfigAtual.drive_folder_id)}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          console.error("[biblioteca] erro ao listar arquivos:", res.status, json?.error)
          throw new Error(json?.error ?? "erro")
        }
        setArquivos(json.arquivos ?? [])
      })
      .catch(() => setErroArquivos(true))
      .finally(() => {
        setLoadingArquivos(false)
        setProntoPara(pastaConfigAtual.materia_key)
      })
  }, [pastaConfigAtual])

  // Vindo do passo "Materiais" do tour completo
  // (?tutorialBiblioteca=true) -- entra na primeira matéria que já tem
  // pasta configurada (1º passo abaixo), e quando os arquivos dela
  // carregarem, abre o primeiro arquivo e dispara o passo a passo de
  // cada ferramenta do editor (2º efeito). Se nada estiver configurado
  // ainda, não tem como apontar pra um editor real -- nesse caso só
  // continua o tour completo sem o mini-tour da biblioteca.
  useEffect(() => {
    if (tutorialDisparado.current) return
    if (searchParams.get("tutorialBiblioteca") !== "true") return
    if (loadingPastas) return
    if (pastas.length === 0) {
      tutorialDisparado.current = true
      const indice = TOUR_COMPLETO.findIndex((p) => p.tituloKey === "desempenhoTitulo")
      router.replace(pathname)
      router.push(`/dashboard?continuarTutorial=${indice >= 0 ? indice : 0}`)
      return
    }
    const primeiraMateria = pastas[0].materia_key
    setMateriaKey(primeiraMateria)
    setTipoEscolhido(pastas[0].tipo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingPastas, pastas, searchParams])

  useEffect(() => {
    if (tutorialDisparado.current) return
    if (searchParams.get("tutorialBiblioteca") !== "true") return
    if (!materiaKey || prontoPara !== materiaKey) return
    tutorialDisparado.current = true
    const indiceContinuar = TOUR_COMPLETO.findIndex((p) => p.tituloKey === "desempenhoTitulo")
    if (arquivos.length > 0) setVisualizando(arquivos[0])
    abrirAjudaPagina(PASSOS_FERRAMENTAS_BIBLIOTECA, {
      aoTerminarRoute: `/dashboard?continuarTutorial=${indiceContinuar >= 0 ? indiceContinuar : 0}`,
    })
    router.replace(pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materiaKey, prontoPara, arquivos, searchParams])

  const materiaLabel = (key: string) =>
    BIBLIOTECA_LABEL_OVERRIDE[lang]?.[key] ?? t.cronograma.materiaLabel[key] ?? t.cronograma.disciplinaBaseLabel[key] ?? key

  const pastaConfigurada = (key: string) => {
    const tipos = tiposDaMateria(key)
    return pastas.some((p) => p.materia_key === key && tipos.includes(p.tipo))
  }

  const handleBaixar = async (arquivo: DriveArquivo) => {
    setBaixando({ id: arquivo.id, percent: 0 })
    try {
      const res = await authedFetch(`/api/biblioteca/arquivo/${arquivo.id}?modo=download`)
      if (!res.ok || !res.body) throw new Error("erro")

      const total = Number(res.headers.get("content-length")) || null
      const reader = res.body.getReader()
      const chunks: Uint8Array[] = []
      let recebido = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        recebido += value.length
        setBaixando({ id: arquivo.id, percent: total ? Math.min(100, Math.round((recebido / total) * 100)) : null })
      }

      const blob = new Blob(chunks as BlobPart[], { type: arquivo.mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = arquivo.name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert(t.biblioteca.erroBaixar)
    } finally {
      setBaixando(null)
    }
  }

  const handleVisualizar = async (arquivo: DriveArquivo) => {
    const { data } = await supabase.auth.getSession()
    setTokenAtual(data.session?.access_token ?? null)
    setVisualizando(arquivo)
  }

  // ---------- Nível 1.5: escolher Libros ou Resúmenes (só matérias com os
  // dois tipos, ex.: Pediatria -- a maioria das matérias tem só 1 tipo e
  // pula direto pro nível seguinte, ver onClick acima) ----------
  if (materiaKey && !tipoAtual && tiposDisponiveis.length > 1) {
    const cor = getMateriaColor(materiaKey)
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setMateriaKey(null)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.biblioteca.voltar}
        </button>
        <h2 className="text-lg font-semibold text-foreground">{materiaLabel(materiaKey)}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {tiposDisponiveis.map((tipo) => (
            <button key={tipo} type="button" onClick={() => setTipoEscolhido(tipo)} className="text-left">
              <Card
                className={`group overflow-hidden border p-6 transition-all ${cor.borderSoft} bg-card ${cor.hoverBorder} ${cor.hoverGlow}`}
              >
                <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${cor.bgSoft}`}>
                  {tipo === "livro" ? (
                    <BookOpen className={`h-6 w-6 ${cor.text} transition-transform group-hover:scale-110`} />
                  ) : (
                    <NotebookPen className={`h-6 w-6 ${cor.text} transition-transform group-hover:scale-110`} />
                  )}
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  {tipo === "livro" ? t.biblioteca.pastaLivros : t.biblioteca.pastaResumos}
                </h3>
              </Card>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ---------- Nível 2: arquivos da matéria (Libros ou Resúmenes, implícito) ----------
  if (materiaKey && tipoAtual) {
    const cor = getMateriaColor(materiaKey)
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => (tiposDisponiveis.length > 1 ? setTipoEscolhido(null) : setMateriaKey(null))}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.biblioteca.voltar}
        </button>
        <div className="flex items-center gap-2">
          {tipoAtual === "livro" ? (
            <BookOpen className={`h-5 w-5 ${cor.text}`} />
          ) : (
            <NotebookPen className={`h-5 w-5 ${cor.text}`} />
          )}
          <h2 className="text-lg font-semibold text-foreground">
            {materiaLabel(materiaKey)} · {tipoAtual === "livro" ? t.biblioteca.pastaLivros : t.biblioteca.pastaResumos}
          </h2>
        </div>

        {!pastaConfigAtual ? (
          <Card className="border border-border bg-card p-8 text-center">
            <Badge variant="outline" className="mb-2">
              {t.biblioteca.emBreve}
            </Badge>
            <p className="text-sm text-muted-foreground">{t.biblioteca.vazioPasta}</p>
          </Card>
        ) : loadingArquivos ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.biblioteca.carregando}
          </div>
        ) : erroArquivos ? (
          <Card className="border border-border bg-card p-8 text-center">
            <p className="text-sm text-destructive">{t.biblioteca.erroCarregarArquivos}</p>
          </Card>
        ) : arquivos.length === 0 ? (
          <Card className="border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">{t.biblioteca.vazioPasta}</p>
          </Card>
        ) : (
          <Card className="overflow-hidden border border-border bg-card p-0">
            <p className="border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground">
              {t.biblioteca.itensCount(arquivos.length)}
            </p>
            <div className="divide-y divide-border">
              {arquivos.map((arquivo) => {
                const { Icon, cor: corIcone, bg } = iconeArquivo(arquivo.mimeType)
                const ext = extensaoArquivo(arquivo.name)
                return (
                  <div
                    key={arquivo.id}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${bg}`}>
                      <Icon className={`h-4 w-4 ${corIcone}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{arquivo.name}</p>
                    </div>
                    <div className="hidden shrink-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
                      {ext && <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium">{ext}</Badge>}
                      <span className="tabular-nums">{formatBytes(arquivo.size)}</span>
                    </div>
                    {baixando?.id === arquivo.id ? (
                      <div className="flex w-28 shrink-0 items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          {baixando.percent === null ? (
                            <div className="h-full w-full origin-left animate-pulse rounded-full bg-primary/60" />
                          ) : (
                            <div
                              className="h-full rounded-full bg-primary transition-[width]"
                              style={{ width: `${baixando.percent}%` }}
                            />
                          )}
                        </div>
                        <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                          {baixando.percent === null ? "..." : `${baixando.percent}%`}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleVisualizar(arquivo)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          title={t.biblioteca.visualizar}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBaixar(arquivo)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          title={t.biblioteca.baixar}
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        <BibliotecaMeusArquivos materiaKey={materiaKey} />

        {visualizando && visualizando.mimeType === "application/pdf" && (
          <BibliotecaPdfEditor
            chaveAnotacao={visualizando.id}
            driveFileId={visualizando.id}
            nome={visualizando.name}
            onClose={() => setVisualizando(null)}
          />
        )}

        {visualizando && visualizando.mimeType !== "application/pdf" && tokenAtual && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="flex h-full max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-card shadow-2xl">
              <div className="flex items-center justify-between border-b border-border p-3">
                <p className="truncate text-sm font-medium text-foreground">{visualizando.name}</p>
                <button
                  type="button"
                  onClick={() => setVisualizando(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <iframe
                src={`/api/biblioteca/arquivo/${visualizando.id}?modo=inline&token=${encodeURIComponent(tokenAtual)}`}
                className="h-full w-full flex-1 rounded-b-xl"
                title={visualizando.name}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  // ---------- Nível 1: pastas por matéria, agrupadas por ano ----------
  if (loadingPastas) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t.biblioteca.carregando}
      </div>
    )
  }

  if (erroPastas) {
    return (
      <Card className="border border-border bg-card p-8 text-center">
        <p className="text-sm text-destructive">{t.biblioteca.erroCarregarPastas}</p>
      </Card>
    )
  }

  // keys já vem filtrada só com matérias configuradas (ver chamadas
  // abaixo) -- a pasta nunca aparece "Em breve" aqui, só depois de clicar
  // (ex.: matéria com Libros configurado mas Resúmenes ainda não).
  const FolderGrid = ({ keys }: { keys: readonly string[] }) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {keys.map((key) => {
        const cor = getMateriaColor(key)
        return (
          <button
            key={key}
            type="button"
            onClick={() => {
              const tipos = tiposDaMateria(key)
              setMateriaKey(key)
              setTipoEscolhido(tipos.length === 1 ? tipos[0] : null)
            }}
            className="text-left"
          >
            <Card className={`group overflow-hidden border p-5 transition-all ${cor.borderSoft} bg-card ${cor.hoverBorder} ${cor.hoverGlow}`}>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${cor.bgSoft}`}>
                <Folder className={`h-5 w-5 ${cor.text} transition-transform group-hover:scale-110`} />
              </div>
              <h3 className="mt-3 text-sm font-semibold leading-snug text-foreground">{materiaLabel(key)}</h3>
            </Card>
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="space-y-8">
      {ANO_KEYS.map((ano: AnoKey) => {
        const cor = getAnoColor(ano)
        const keys = MATERIA_KEYS_BY_ANO[ano].filter(pastaConfigurada)
        if (keys.length === 0) return null
        return (
          <section key={ano} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${cor.dot}`} />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t.cronograma.anoLabel[ano]}
              </h2>
            </div>
            <FolderGrid keys={keys} />
          </section>
        )
      })}
      {(() => {
        const keys = (DISCIPLINA_BASE_KEYS as readonly string[]).filter(pastaConfigurada)
        if (keys.length === 0) return null
        return (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t.biblioteca.cienciasBasicasTitulo}
              </h2>
            </div>
            <FolderGrid keys={keys} />
          </section>
        )
      })()}
    </div>
  )
}
