"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle2,
  CloudOff,
  FileUp,
  FolderPlus,
  ImageIcon,
  Loader2,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useLanguage } from "@/lib/i18n"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ANO_KEYS, MATERIA_KEYS_BY_ANO, DISCIPLINA_BASE_KEYS, type AnoKey } from "@/lib/unr-curriculum"
import { abrirPicker, type ArquivoPicker } from "@/lib/google-picker"

const BUCKET_CAPAS = "biblioteca-capas"

interface DriveStatus {
  conectado: boolean
  email: string | null
}
interface UP {
  id: string
  materia_key: string
  nome: string
  ordem: number
}
interface ResumoUP {
  id: string
  up_id: string
  titulo: string
  drive_file_id: string
  capa_path: string | null
  ordem: number
}

function capaUrl(path: string | null) {
  if (!path) return null
  return supabase.storage.from(BUCKET_CAPAS).getPublicUrl(path).data.publicUrl
}

async function authedFetch(input: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` }
  if (!(init.body instanceof FormData)) headers["Content-Type"] = "application/json"
  return fetch(input, { ...init, headers })
}

export function AdminBibliotecaResumosContent() {
  const { t } = useLanguage()
  const searchParams = useSearchParams()
  const materiaLabel = (k: string) => t.cronograma.materiaLabel[k] ?? t.cronograma.disciplinaBaseLabel[k] ?? k

  const [status, setStatus] = useState<DriveStatus | null>(null)
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null)

  const [materia, setMateria] = useState<string | null>(null)
  const [ups, setUps] = useState<UP[]>([])
  const [resumos, setResumos] = useState<ResumoUP[]>([])
  const [loadingMateria, setLoadingMateria] = useState(false)

  const [novaUp, setNovaUp] = useState("")
  const [criandoUp, setCriandoUp] = useState(false)

  // Dialog de novo resumo
  const [dialogUp, setDialogUp] = useState<UP | null>(null)
  const [titulo, setTitulo] = useState("")
  const [arquivo, setArquivo] = useState<ArquivoPicker | null>(null)
  const [capa, setCapa] = useState<ArquivoPicker | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [abrindoPicker, setAbrindoPicker] = useState(false)
  const [erroDialog, setErroDialog] = useState<string | null>(null)

  const conectado = status?.conectado === true

  useEffect(() => {
    authedFetch("/api/admin/drive/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ conectado: false, email: null }))
  }, [])

  useEffect(() => {
    const drive = searchParams.get("drive")
    if (!drive) return
    if (drive === "ok") setAviso({ tipo: "ok", texto: "Google Drive conectado com sucesso!" })
    else setAviso({ tipo: "erro", texto: searchParams.get("msg") || "Não foi possível conectar o Drive." })
    window.history.replaceState({}, "", "/admin/biblioteca")
  }, [searchParams])

  const conectarDrive = async () => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    window.location.href = `/api/admin/drive/start?token=${encodeURIComponent(token)}`
  }

  const carregarMateria = useCallback(async (materiaKey: string) => {
    setLoadingMateria(true)
    const [{ data: upData }, { data: resData }] = await Promise.all([
      supabase.from("biblioteca_up").select("*").eq("materia_key", materiaKey).order("ordem"),
      supabase
        .from("biblioteca_up_resumos")
        .select("id, up_id, titulo, drive_file_id, capa_path, ordem")
        .order("ordem"),
    ])
    setUps((upData as UP[]) ?? [])
    setResumos((resData as ResumoUP[]) ?? [])
    setLoadingMateria(false)
  }, [])

  const abrirMateria = (materiaKey: string) => {
    setMateria(materiaKey)
    carregarMateria(materiaKey)
  }

  const criarUp = async () => {
    const nome = novaUp.trim()
    if (!nome || !materia) return
    setCriandoUp(true)
    const ordem = ups.length
    const { error } = await supabase.from("biblioteca_up").insert({ materia_key: materia, nome, ordem })
    setCriandoUp(false)
    if (error) return alert("Erro ao criar a UP.")
    setNovaUp("")
    carregarMateria(materia)
  }

  const removerUp = async (up: UP) => {
    if (!confirm(`Remover a UP "${up.nome}" e todos os resumos dela? Os arquivos continuam no seu Drive.`)) return
    const { error } = await supabase.from("biblioteca_up").delete().eq("id", up.id)
    if (error) return alert("Erro ao remover a UP.")
    if (materia) carregarMateria(materia)
  }

  // ─────────── Picker (arquivo e capa) ───────────
  const escolher = async (apenasImagens: boolean): Promise<ArquivoPicker | null> => {
    setAbrindoPicker(true)
    setErroDialog(null)
    try {
      const res = await authedFetch("/api/admin/drive/picker-token")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Falha ao abrir o Drive.")
      return await abrirPicker({
        accessToken: json.accessToken,
        apiKey: json.apiKey,
        appId: json.appId,
        apenasImagens,
      })
    } catch (e) {
      setErroDialog(e instanceof Error ? e.message : "Falha ao abrir o Drive.")
      return null
    } finally {
      setAbrindoPicker(false)
    }
  }

  const abrirDialogResumo = (up: UP) => {
    setDialogUp(up)
    setTitulo("")
    setArquivo(null)
    setCapa(null)
    setErroDialog(null)
  }

  const salvarResumo = async () => {
    if (!dialogUp) return
    if (!titulo.trim()) return setErroDialog("Informe o título.")
    if (!arquivo) return setErroDialog("Escolha o arquivo no Drive.")
    setSalvando(true)
    setErroDialog(null)
    try {
      const res = await authedFetch("/api/biblioteca/up-resumos", {
        method: "POST",
        body: JSON.stringify({
          upId: dialogUp.id,
          titulo: titulo.trim(),
          driveFileId: arquivo.id,
          capaFileId: capa?.id ?? null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Erro ao salvar.")
      setDialogUp(null)
      if (materia) carregarMateria(materia)
    } catch (e) {
      setErroDialog(e instanceof Error ? e.message : "Erro ao salvar.")
    } finally {
      setSalvando(false)
    }
  }

  const removerResumo = async (r: ResumoUP) => {
    if (!confirm(`Remover o resumo "${r.titulo}"? O arquivo continua no seu Drive.`)) return
    const res = await authedFetch(`/api/biblioteca/up-resumos?id=${r.id}`, { method: "DELETE" })
    if (!res.ok) return alert("Erro ao remover o resumo.")
    setResumos((prev) => prev.filter((x) => x.id !== r.id))
  }

  // ─────────────────────────── Render ───────────────────────────
  return (
    <div className="space-y-6">
      {aviso && (
        <div
          className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
            aviso.tipo === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {aviso.tipo === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {aviso.texto}
        </div>
      )}

      {/* Conexão com o Google Drive */}
      <Card className="border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Google Drive</h2>
            {conectado ? (
              <p className="flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                Conectado{status?.email ? ` como ${status.email}` : ""}
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CloudOff className="h-4 w-4" />
                Conecte (ou reconecte) o Drive pra escolher os arquivos.
              </p>
            )}
          </div>
          <Button onClick={conectarDrive} variant={conectado ? "outline" : "default"} size="sm">
            {conectado ? "Reconectar" : "Conectar Google Drive"}
          </Button>
        </div>
        {conectado && (
          <p className="mt-2 text-xs text-muted-foreground">
            No Picker você navega pelo seu Drive e escolhe o arquivo; ao selecionar, o acesso àquele arquivo é
            concedido à plataforma.
          </p>
        )}
      </Card>

      {/* Seletor de matéria */}
      {!materia ? (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Escolha a matéria pra gerir as UPs e os resumos (cards com capa).
          </p>
          {[...ANO_KEYS, "basicas" as const].map((ano) => {
            const keys = ano === "basicas" ? [...DISCIPLINA_BASE_KEYS] : MATERIA_KEYS_BY_ANO[ano as AnoKey]
            return (
              <div key={ano}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {ano === "basicas" ? "Ciências Básicas" : t.cronograma.anoLabel[ano] ?? ano}
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {keys.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => abrirMateria(k)}
                      className="rounded-lg border border-border bg-card p-3 text-left text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5"
                    >
                      {materiaLabel(k)}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setMateria(null)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Todas as matérias
          </button>
          <h2 className="text-lg font-semibold text-foreground">{materiaLabel(materia)}</h2>

          {/* Criar UP */}
          <Card className="border border-border bg-card p-4">
            <Label className="text-sm font-medium text-foreground">Nova UP</Label>
            <p className="mb-2 text-xs text-muted-foreground">Ex.: &quot;UP1&quot;, &quot;UP2 - Cardiologia&quot;.</p>
            <div className="flex gap-2">
              <Input
                value={novaUp}
                onChange={(e) => setNovaUp(e.target.value)}
                placeholder="Nome da UP"
                onKeyDown={(e) => e.key === "Enter" && criarUp()}
              />
              <Button onClick={criarUp} disabled={criandoUp || !novaUp.trim()}>
                {criandoUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
                Criar
              </Button>
            </div>
          </Card>

          {/* Lista de UPs */}
          {loadingMateria ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : ups.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma UP criada ainda.</p>
          ) : (
            <div className="space-y-4">
              {ups.map((up) => {
                const cards = resumos.filter((r) => r.up_id === up.id)
                return (
                  <Card key={up.id} className="border border-border bg-card p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-foreground">{up.nome}</h3>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => abrirDialogResumo(up)} disabled={!conectado}>
                          <Plus className="h-4 w-4" />
                          Resumo
                        </Button>
                        <button
                          type="button"
                          onClick={() => removerUp(up)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          title="Remover UP"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {cards.length === 0 ? (
                      <p className="py-3 text-center text-xs text-muted-foreground">Nenhum resumo nessa UP ainda.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {cards.map((r) => (
                          <div key={r.id} className="overflow-hidden rounded-xl border border-border bg-background">
                            <div className="relative aspect-square bg-muted">
                              {capaUrl(r.capa_path) ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={capaUrl(r.capa_path)!} alt={r.titulo} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                                  sem capa
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => removerResumo(r)}
                                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-destructive"
                                title="Remover"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="p-2">
                              <p className="line-clamp-2 text-xs font-medium text-foreground">{r.titulo}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Dialog: novo resumo (escolher arquivo + capa no Drive) */}
      <Dialog open={!!dialogUp} onOpenChange={(o) => !o && setDialogUp(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo resumo{dialogUp ? ` — ${dialogUp.nome}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Insuficiência Cardíaca" />
            </div>
            <div className="space-y-1.5">
              <Label>Arquivo (do Drive)</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                disabled={abrindoPicker}
                onClick={async () => {
                  const f = await escolher(false)
                  if (f) setArquivo(f)
                }}
              >
                {abrindoPicker ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                {arquivo ? arquivo.name : "Escolher arquivo no Drive"}
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label>Capa (imagem do Drive, opcional)</Label>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                disabled={abrindoPicker}
                onClick={async () => {
                  const f = await escolher(true)
                  if (f) setCapa(f)
                }}
              >
                {abrindoPicker ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                {capa ? capa.name : "Escolher capa no Drive"}
              </Button>
            </div>
            {erroDialog && <p className="text-xs text-destructive">{erroDialog}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogUp(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={salvarResumo} disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
