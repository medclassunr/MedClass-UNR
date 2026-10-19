"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, ChevronDown, ChevronUp, FileText, Loader2, Save, Trash2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ANO_KEYS, DISCIPLINA_BASE_KEYS, MATERIA_KEYS_BY_ANO } from "@/lib/unr-curriculum"

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

const MATERIA_LABEL_PT: Record<string, string> = {
  metodologia_investigacion: "Metodologia da Investigação",
  informatica: "Informática",
  ingles: "Inglês",
  crescimento_desenvolvimento: "Crescimento e Desenvolvimento",
  nutricao: "Nutrição",
  sexualidade_genero_reproducao: "Sexualidade, Gênero e Reprodução",
  trabalho_tempo_livre: "Trabalho e Tempo Livre",
  ser_humano_meio: "Ser Humano e Seu Meio",
  injuria: "Injúria",
  defesa: "Defesa",
  clinica_medica_4: "Clínica Médica do 4º ano",
  cirurgia_4: "Cirurgia do 4º ano",
  pediatria_4: "Pediatria do 4º ano",
  oftalmologia: "Oftalmologia",
  otorrinolaringologia: "Otorrinolaringologia",
  farmacologia: "Farmacologia",
  cirurgia_5: "Cirurgia do 5º ano",
  pediatria_5: "Pediatria do 5º ano",
  clinica_medica_5: "Clínica Médica do 5º ano",
  urologia: "Urologia",
  medicina_legal: "Medicina Legal",
  ginecologia_obstetricia: "Ginecologia e Obstetrícia",
  anatomia: "Anatomia",
  histologia: "Histologia",
  embriologia: "Embriologia",
  fisiologia: "Fisiologia",
  bioquimica: "Bioquímica",
  biofisica: "Biofísica",
  genetica: "Genética",
  imunologia: "Imunologia",
  microbiologia: "Microbiologia",
  parasitologia: "Parasitologia",
  patologia: "Patologia",
  farmacologia_base: "Farmacologia",
}

const ANO_LABEL_PT: Record<string, string> = {
  ano0: "Instrumentais",
  ano1: "1º Ano",
  ano2: "2º Ano",
  ano3: "3º Ano",
  ano4: "4º Ano",
  ano5: "5º Ano",
}

async function authedFetch(input: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return fetch(input, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  })
}

function formatBytes(bytes?: string) {
  if (!bytes) return ""
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return ""
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

// Ciências Básicas usam pasta tipo "livro" (atlas/livro-texto de
// referência); as demais matérias (agrupadas por ano) usam "resumo" (só
// resumo de prova) -- ver a mesma regra em biblioteca-drive-content.tsx.
function tipoDaMateria(materiaKey: string): "livro" | "resumo" {
  return (DISCIPLINA_BASE_KEYS as readonly string[]).includes(materiaKey) ? "livro" : "resumo"
}

export function AdminBibliotecaContent() {
  const [pastas, setPastas] = useState<PastaConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [salvandoKey, setSalvandoKey] = useState<string | null>(null)
  const [salvoKey, setSalvoKey] = useState<string | null>(null)
  const [removendoKey, setRemovendoKey] = useState<string | null>(null)
  const [expandido, setExpandido] = useState<Record<string, boolean>>({})
  const [arquivosPorMateria, setArquivosPorMateria] = useState<
    Record<string, { carregando: boolean; arquivos: DriveArquivo[]; erro: boolean }>
  >({})

  const load = async () => {
    setLoading(true)
    const res = await authedFetch("/api/biblioteca/pastas")
    const json = await res.json().catch(() => ({ pastas: [] }))
    setPastas(json.pastas ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const getPasta = (materiaKey: string) => pastas.find((p) => p.materia_key === materiaKey && p.tipo === tipoDaMateria(materiaKey))

  const getEdit = (materiaKey: string) => edits[materiaKey] ?? getPasta(materiaKey)?.drive_folder_id ?? ""

  const updateEdit = (materiaKey: string, value: string) => {
    setEdits((prev) => ({ ...prev, [materiaKey]: value }))
  }

  const handleSalvar = async (materiaKey: string) => {
    const valor = getEdit(materiaKey).trim()
    if (!valor) return
    setSalvandoKey(materiaKey)
    try {
      const res = await authedFetch("/api/biblioteca/pastas", {
        method: "POST",
        body: JSON.stringify({ materia_key: materiaKey, tipo: tipoDaMateria(materiaKey), drive_folder_id: valor }),
      })
      if (!res.ok) throw new Error("erro")
      await load()
      setArquivosPorMateria((prev) => {
        const { [materiaKey]: _descartado, ...resto } = prev
        return resto
      })
      setSalvoKey(materiaKey)
      setTimeout(() => setSalvoKey((k) => (k === materiaKey ? null : k)), 2000)
    } catch {
      alert("Erro ao salvar a pasta dessa matéria. Confira o ID e tente novamente.")
    } finally {
      setSalvandoKey(null)
    }
  }

  const handleRemover = async (materiaKey: string) => {
    const pasta = getPasta(materiaKey)
    if (!pasta) return
    if (!confirm(`Remover a pasta configurada de "${MATERIA_LABEL_PT[materiaKey] ?? materiaKey}"? Os arquivos continuam no Drive, só deixam de aparecer pros alunos.`)) return
    setRemovendoKey(materiaKey)
    try {
      const res = await authedFetch(`/api/biblioteca/pastas?id=${pasta.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("erro")
      setEdits((prev) => ({ ...prev, [materiaKey]: "" }))
      setExpandido((prev) => ({ ...prev, [materiaKey]: false }))
      await load()
    } catch {
      alert("Erro ao remover a pasta dessa matéria. Tente novamente.")
    } finally {
      setRemovendoKey(null)
    }
  }

  const handleVisualizar = async (materiaKey: string) => {
    const abrindo = !expandido[materiaKey]
    setExpandido((prev) => ({ ...prev, [materiaKey]: abrindo }))
    if (!abrindo) return

    const pasta = getPasta(materiaKey)
    if (!pasta) return
    setArquivosPorMateria((prev) => ({ ...prev, [materiaKey]: { carregando: true, arquivos: [], erro: false } }))
    try {
      const res = await authedFetch(`/api/biblioteca/arquivos?folderId=${encodeURIComponent(pasta.drive_folder_id)}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error("erro")
      setArquivosPorMateria((prev) => ({ ...prev, [materiaKey]: { carregando: false, arquivos: json.arquivos ?? [], erro: false } }))
    } catch {
      setArquivosPorMateria((prev) => ({ ...prev, [materiaKey]: { carregando: false, arquivos: [], erro: true } }))
    }
  }

  const materiasPorAno = useMemo(() => {
    const grupos: { ano: string; materias: readonly string[] }[] = ANO_KEYS.map((ano) => ({
      ano,
      materias: MATERIA_KEYS_BY_ANO[ano],
    }))
    grupos.push({ ano: "basicas", materias: DISCIPLINA_BASE_KEYS })
    return grupos
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Biblioteca — Pastas do Google Drive</h2>
        <p className="text-sm text-muted-foreground">
          Cole aqui o ID da pasta do Drive de cada matéria. A pasta precisa estar compartilhada como
          &quot;Qualquer pessoa com o link&quot;. O ID é o trecho da URL depois de
          <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">/folders/</code>
          — ex.: em <code className="text-xs">drive.google.com/drive/folders/ABC123</code>, o ID é{" "}
          <code className="text-xs">ABC123</code>. Ciências Básicas usam pasta de <strong>Libros</strong>{" "}
          (atlas/livro-texto); as demais matérias usam pasta de <strong>Resúmenes</strong> — cada matéria tem
          uma pasta só, sem subdivisão. Use <strong>Visualizar</strong> pra conferir os arquivos que o Drive
          está devolvendo pra essa pasta, e <strong>Remover</strong> pra tirá-la da plataforma (o arquivo
          continua no Drive).
        </p>
      </div>

      {materiasPorAno.map(({ ano, materias }) => (
        <section key={ano} className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {ano === "basicas" ? "Ciências Básicas" : ANO_LABEL_PT[ano]}
          </h3>
          <div className="space-y-2">
            {materias.map((materiaKey) => {
              const edit = getEdit(materiaKey)
              const pastaAtual = getPasta(materiaKey)
              const label = tipoDaMateria(materiaKey) === "livro" ? "ID pasta Libros" : "ID pasta Resúmenes"
              const estadoArquivos = arquivosPorMateria[materiaKey]
              const aberto = !!expandido[materiaKey]

              return (
                <Card key={materiaKey} className="border border-border bg-card p-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[180px] flex-1 basis-full font-medium text-foreground sm:basis-auto">
                      {MATERIA_LABEL_PT[materiaKey] ?? materiaKey}
                    </div>
                    <div className="min-w-[260px] flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">{label}</Label>
                      <Input
                        value={edit}
                        onChange={(e) => updateEdit(materiaKey, e.target.value)}
                        placeholder="ID da pasta no Drive"
                        className="h-8 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSalvar(materiaKey)}
                      disabled={salvandoKey === materiaKey}
                      className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {salvandoKey === materiaKey ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : salvoKey === materiaKey ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Salvar
                    </button>
                    {pastaAtual && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleVisualizar(materiaKey)}
                          className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                        >
                          {aberto ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          Visualizar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemover(materiaKey)}
                          disabled={removendoKey === materiaKey}
                          className="flex h-8 items-center gap-1.5 rounded-lg border border-destructive/30 px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                        >
                          {removendoKey === materiaKey ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Remover
                        </button>
                      </>
                    )}
                  </div>

                  {aberto && (
                    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-2">
                      {!estadoArquivos || estadoArquivos.carregando ? (
                        <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Carregando arquivos...
                        </div>
                      ) : estadoArquivos.erro ? (
                        <p className="p-2 text-xs text-destructive">Não foi possível carregar os arquivos dessa pasta.</p>
                      ) : estadoArquivos.arquivos.length === 0 ? (
                        <p className="p-2 text-xs text-muted-foreground">Nenhum arquivo nessa pasta ainda.</p>
                      ) : (
                        <ul className="divide-y divide-border">
                          {estadoArquivos.arquivos.map((arquivo) => (
                            <li key={arquivo.id} className="flex items-center gap-2 px-2 py-1.5 text-xs text-foreground">
                              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="min-w-0 flex-1 truncate">{arquivo.name}</span>
                              <span className="shrink-0 text-muted-foreground">{formatBytes(arquivo.size)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
