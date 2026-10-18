"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, BookOpen, Download, Eye, FileText, Folder, Loader2, NotebookPen, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/lib/i18n"
import { ANO_KEYS, DISCIPLINA_BASE_KEYS, MATERIA_KEYS_BY_ANO, type AnoKey } from "@/lib/unr-curriculum"
import { getAnoColor, getMateriaColor } from "@/lib/materia-colors"

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

// Ciências Básicas (Anatomia, Fisiologia etc.) têm livro-texto/atlas de
// referência -- a pasta ali é do tipo "livro". As demais matérias (por ano:
// CyD, Nutrição, Sexualidade etc.) só têm resumo de prova -- a pasta ali é
// do tipo "resumo". Por isso não existe mais tela intermediária escolhendo
// Libros/Resúmenes: o tipo é implícito pela seção, clicar na matéria já
// abre a lista de arquivos direto.
function tipoDaMateria(materiaKey: string): "livro" | "resumo" {
  return (DISCIPLINA_BASE_KEYS as readonly string[]).includes(materiaKey) ? "livro" : "resumo"
}

export function BibliotecaDriveContent() {
  const { t } = useLanguage()
  const [pastas, setPastas] = useState<PastaConfig[]>([])
  const [loadingPastas, setLoadingPastas] = useState(true)
  const [erroPastas, setErroPastas] = useState(false)
  const [materiaKey, setMateriaKey] = useState<string | null>(null)

  const [arquivos, setArquivos] = useState<DriveArquivo[]>([])
  const [loadingArquivos, setLoadingArquivos] = useState(false)
  const [erroArquivos, setErroArquivos] = useState(false)
  const [baixandoId, setBaixandoId] = useState<string | null>(null)
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

  const tipoAtual = materiaKey ? tipoDaMateria(materiaKey) : null

  const pastaConfigAtual = useMemo(() => {
    if (!materiaKey || !tipoAtual) return null
    return pastas.find((p) => p.materia_key === materiaKey && p.tipo === tipoAtual) ?? null
  }, [pastas, materiaKey, tipoAtual])

  useEffect(() => {
    if (!pastaConfigAtual) {
      setArquivos([])
      return
    }
    setLoadingArquivos(true)
    setErroArquivos(false)
    authedFetch(`/api/biblioteca/arquivos?folderId=${encodeURIComponent(pastaConfigAtual.drive_folder_id)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("erro")
        const json = await res.json()
        setArquivos(json.arquivos ?? [])
      })
      .catch(() => setErroArquivos(true))
      .finally(() => setLoadingArquivos(false))
  }, [pastaConfigAtual])

  const materiaLabel = (key: string) =>
    t.cronograma.materiaLabel[key] ?? t.cronograma.disciplinaBaseLabel[key] ?? key

  const pastaConfigurada = (key: string) => pastas.some((p) => p.materia_key === key && p.tipo === tipoDaMateria(key))

  const handleBaixar = async (arquivo: DriveArquivo) => {
    setBaixandoId(arquivo.id)
    try {
      const res = await authedFetch(`/api/biblioteca/arquivo/${arquivo.id}?modo=download`)
      if (!res.ok) throw new Error("erro")
      const blob = await res.blob()
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
      setBaixandoId(null)
    }
  }

  const handleVisualizar = async (arquivo: DriveArquivo) => {
    const { data } = await supabase.auth.getSession()
    setTokenAtual(data.session?.access_token ?? null)
    setVisualizando(arquivo)
  }

  // ---------- Nível 2: arquivos da matéria (Libros ou Resúmenes, implícito) ----------
  if (materiaKey && tipoAtual) {
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
          <div className="space-y-2">
            {arquivos.map((arquivo) => (
              <Card
                key={arquivo.id}
                className="flex items-center gap-3 border border-border bg-card p-3 transition-colors hover:border-primary/40"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${cor.bgSoft}`}>
                  <FileText className={`h-5 w-5 ${cor.text}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{arquivo.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(arquivo.size)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleVisualizar(arquivo)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title={t.biblioteca.visualizar}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBaixar(arquivo)}
                    disabled={baixandoId === arquivo.id}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                    title={t.biblioteca.baixar}
                  >
                    {baixandoId === arquivo.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {visualizando && tokenAtual && (
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

  const FolderGrid = ({ keys }: { keys: readonly string[] }) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {keys.map((key) => {
        const cor = getMateriaColor(key)
        const configurada = pastaConfigurada(key)
        return (
          <button key={key} type="button" onClick={() => setMateriaKey(key)} className="text-left">
            <Card
              className={`group overflow-hidden border p-5 transition-all ${cor.borderSoft} bg-card ${
                configurada ? `${cor.hoverBorder} ${cor.hoverGlow}` : "opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${cor.bgSoft}`}>
                  <Folder className={`h-5 w-5 ${cor.text} transition-transform group-hover:scale-110`} />
                </div>
                {!configurada && (
                  <Badge variant="outline" className="text-[10px]">
                    {t.biblioteca.emBreve}
                  </Badge>
                )}
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
        return (
          <section key={ano} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${cor.dot}`} />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t.cronograma.anoLabel[ano]}
              </h2>
            </div>
            <FolderGrid keys={MATERIA_KEYS_BY_ANO[ano]} />
          </section>
        )
      })}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t.biblioteca.cienciasBasicasTitulo}
          </h2>
        </div>
        <FolderGrid keys={DISCIPLINA_BASE_KEYS} />
      </section>
    </div>
  )
}
