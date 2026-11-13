"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudOff,
  FolderPlus,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const BUCKET_CAPAS = "biblioteca-capas"

interface Secao {
  id: string
  nome: string
  ordem: number
  ativo: boolean
}

interface Resumo {
  id: string
  secao_id: string
  titulo: string
  drive_file_id: string
  capa_path: string | null
  tamanho_bytes: number | null
  ordem: number
  ativo: boolean
}

interface DriveStatus {
  conectado: boolean
  email: string | null
}

async function authedFetch(input: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` }
  // Só define JSON quando o corpo NÃO é FormData (upload multipart define sozinho).
  if (!(init.body instanceof FormData)) headers["Content-Type"] = "application/json"
  return fetch(input, { ...init, headers })
}

function capaUrl(path: string | null) {
  if (!path) return null
  return supabase.storage.from(BUCKET_CAPAS).getPublicUrl(path).data.publicUrl
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ""
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Logo oficial do Google Drive (triângulo colorido) — lucide não tem ícone de
// marca, então vai inline como SVG pra o botão de conexão ficar reconhecível.
function GoogleDriveIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 87.3 78" className={className} aria-hidden="true">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47" />
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </svg>
  )
}

export function AdminBibliotecaSecoesContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<DriveStatus | null>(null)
  const [secoes, setSecoes] = useState<Secao[]>([])
  const [resumos, setResumos] = useState<Resumo[]>([])
  const [loading, setLoading] = useState(true)
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null)

  const [novaSecao, setNovaSecao] = useState("")
  const [criandoSecao, setCriandoSecao] = useState(false)
  const [expandida, setExpandida] = useState<Record<string, boolean>>({})
  const [processandoSecao, setProcessandoSecao] = useState<string | null>(null)

  // Dialog de novo resumo
  const [dialogSecao, setDialogSecao] = useState<Secao | null>(null)
  const [titulo, setTitulo] = useState("")
  const [capaFile, setCapaFile] = useState<File | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [processandoResumo, setProcessandoResumo] = useState<string | null>(null)
  const capaInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const carregar = useCallback(async () => {
    const [{ data: secoesData }, { data: resumosData }, statusRes] = await Promise.all([
      supabase.from("biblioteca_secoes").select("*").order("ordem"),
      supabase.from("biblioteca_resumos_drive").select("*").order("ordem"),
      authedFetch("/api/admin/drive/status"),
    ])
    setSecoes((secoesData as Secao[]) ?? [])
    setResumos((resumosData as Resumo[]) ?? [])
    setStatus(await statusRes.json().catch(() => ({ conectado: false, email: null })))
    setLoading(false)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Mensagem de retorno do fluxo OAuth (?drive=ok|erro&msg=...)
  useEffect(() => {
    const drive = searchParams.get("drive")
    if (!drive) return
    if (drive === "ok") setAviso({ tipo: "ok", texto: "Google Drive conectado com sucesso!" })
    else setAviso({ tipo: "erro", texto: searchParams.get("msg") || "Não foi possível conectar o Drive." })
    window.history.replaceState({}, "", "/admin/biblioteca-secoes")
  }, [searchParams])

  const conectarDrive = async () => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    window.location.href = `/api/admin/drive/start?token=${encodeURIComponent(token)}`
  }

  const desconectarDrive = async () => {
    if (!confirm("Desconectar o Google Drive? Os arquivos continuam no Drive, mas você não poderá subir novos até reconectar.")) return
    await authedFetch("/api/admin/drive/status", { method: "DELETE" })
    await carregar()
  }

  const criarSecao = async () => {
    const nome = novaSecao.trim()
    if (!nome) return
    setCriandoSecao(true)
    try {
      const res = await authedFetch("/api/biblioteca/secoes", { method: "POST", body: JSON.stringify({ nome }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "erro")
      setNovaSecao("")
      await carregar()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao criar a seção.")
    } finally {
      setCriandoSecao(false)
    }
  }

  const removerSecao = async (secao: Secao) => {
    if (!confirm(`Remover a seção "${secao.nome}" e TODOS os resumos dela? Isso apaga os PDFs do Drive também. Não dá pra desfazer.`)) return
    setProcessandoSecao(secao.id)
    try {
      const res = await authedFetch(`/api/biblioteca/secoes?id=${secao.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("erro")
      await carregar()
    } catch {
      alert("Erro ao remover a seção.")
    } finally {
      setProcessandoSecao(null)
    }
  }

  const abrirDialogResumo = (secao: Secao) => {
    setDialogSecao(secao)
    setTitulo("")
    setCapaFile(null)
    setPdfFile(null)
  }

  const salvarResumo = async () => {
    if (!dialogSecao) return
    if (!titulo.trim()) return alert("Informe o título do resumo.")
    if (!pdfFile) return alert("Escolha o arquivo PDF.")
    if (pdfFile.type !== "application/pdf") return alert("O arquivo precisa ser PDF.")

    setEnviando(true)
    let capaPath: string | null = null
    try {
      // 1) Capa -> Storage (opcional)
      if (capaFile) {
        capaPath = `${dialogSecao.id}/${crypto.randomUUID()}-${capaFile.name}`
        const { error } = await supabase.storage.from(BUCKET_CAPAS).upload(capaPath, capaFile)
        if (error) throw new Error("Falha ao enviar a capa.")
      }

      // 2) PDF -> Drive (via API)
      const form = new FormData()
      form.append("secaoId", dialogSecao.id)
      form.append("titulo", titulo.trim())
      if (capaPath) form.append("capaPath", capaPath)
      form.append("arquivo", pdfFile)

      const res = await authedFetch("/api/biblioteca/resumos", { method: "POST", body: form })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "erro")

      setDialogSecao(null)
      await carregar()
    } catch (e) {
      // se o PDF falhou mas a capa já subiu, limpa a capa órfã
      if (capaPath) await supabase.storage.from(BUCKET_CAPAS).remove([capaPath]).catch(() => {})
      alert(e instanceof Error ? e.message : "Erro ao enviar o resumo.")
    } finally {
      setEnviando(false)
    }
  }

  const removerResumo = async (r: Resumo) => {
    if (!confirm(`Remover o resumo "${r.titulo}"? O PDF será apagado do Drive.`)) return
    setProcessandoResumo(r.id)
    try {
      const res = await authedFetch(`/api/biblioteca/resumos?id=${r.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("erro")
      await carregar()
    } catch {
      alert("Erro ao remover o resumo.")
    } finally {
      setProcessandoResumo(null)
    }
  }

  // conectado só é "true" de verdade quando o status confirmou. Enquanto
  // carrega (status === null) ou se a verificação falhar, tratamos como NÃO
  // conectado -> o botão de conectar fica SEMPRE visível (nunca some por causa
  // de um fetch de status lento/com erro).
  const conectado = status?.conectado === true
  const verificando = loading || status === null

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

      {/* Conexão com o Google Drive — sempre no topo, sempre visível */}
      <Card className="border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <GoogleDriveIcon className="h-8 w-8 shrink-0" />
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
                  Não conectado — conecte pra poder subir resumos.
                </p>
              )}
            </div>
          </div>
          {conectado ? (
            <Button variant="outline" size="sm" onClick={desconectarDrive}>
              Desconectar
            </Button>
          ) : (
            <Button onClick={conectarDrive} className="gap-2">
              <GoogleDriveIcon className="h-4 w-4" />
              Conectar Google Drive
            </Button>
          )}
        </div>
      </Card>

      {/* Criar seção */}
      <Card className="border border-border bg-card p-4">
        <Label className="text-sm font-medium text-foreground">Nova seção</Label>
        <p className="mb-2 text-xs text-muted-foreground">
          A seção vira uma pasta no seu Drive. Ex.: &quot;Resumos de Cardiologia&quot;, &quot;Provas antigas&quot;.
        </p>
        <div className="flex gap-2">
          <Input
            value={novaSecao}
            onChange={(e) => setNovaSecao(e.target.value)}
            placeholder="Nome da seção"
            onKeyDown={(e) => e.key === "Enter" && criarSecao()}
            disabled={!conectado}
          />
          <Button onClick={criarSecao} disabled={!conectado || criandoSecao || !novaSecao.trim()}>
            {criandoSecao ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
            Criar
          </Button>
        </div>
        {!conectado && <p className="mt-2 text-xs text-amber-600">Conecte o Google Drive acima pra habilitar.</p>}
      </Card>

      {/* Lista de seções */}
      {verificando ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando...
        </div>
      ) : secoes.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma seção criada ainda.</p>
      ) : (
        <div className="space-y-3">
          {secoes.map((secao) => {
            const itens = resumos.filter((r) => r.secao_id === secao.id)
            const aberto = !!expandida[secao.id]
            return (
              <Card key={secao.id} className="border border-border bg-card p-0">
                <div className="flex items-center gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => setExpandida((p) => ({ ...p, [secao.id]: !aberto }))}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    {aberto ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                    <span className="truncate font-medium text-foreground">{secao.nome}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">({itens.length})</span>
                  </button>
                  <Button size="sm" variant="outline" onClick={() => abrirDialogResumo(secao)} disabled={!conectado}>
                    <Plus className="h-4 w-4" />
                    Resumo
                  </Button>
                  <button
                    type="button"
                    onClick={() => removerSecao(secao)}
                    disabled={processandoSecao === secao.id}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    title="Remover seção"
                  >
                    {processandoSecao === secao.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {aberto && (
                  <div className="border-t border-border p-3">
                    {itens.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">Nenhum resumo nessa seção ainda.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {itens.map((r) => (
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
                                disabled={processandoResumo === r.id}
                                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-destructive"
                                title="Remover"
                              >
                                {processandoResumo === r.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                            <div className="p-2">
                              <p className="line-clamp-2 text-xs font-medium text-foreground">{r.titulo}</p>
                              <p className="text-[10px] text-muted-foreground">{formatBytes(r.tamanho_bytes)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog: novo resumo */}
      <Dialog open={!!dialogSecao} onOpenChange={(o) => !o && setDialogSecao(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo resumo{dialogSecao ? ` — ${dialogSecao.nome}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Insuficiência Cardíaca" />
            </div>

            <div className="space-y-1.5">
              <Label>Capa (imagem, opcional)</Label>
              <input
                ref={capaInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => setCapaFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => capaInputRef.current?.click()}
                className="flex aspect-square w-28 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:border-primary/50"
              >
                {capaFile ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={URL.createObjectURL(capaFile)} alt="capa" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-xs">
                    <ImagePlus className="h-5 w-5" />
                    Capa
                  </div>
                )}
              </button>
            </div>

            <div className="space-y-1.5">
              <Label>Arquivo PDF</Label>
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                hidden
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="outline" className="w-full justify-start" onClick={() => pdfInputRef.current?.click()}>
                <Upload className="h-4 w-4" />
                {pdfFile ? pdfFile.name : "Escolher PDF"}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogSecao(null)} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={salvarResumo} disabled={enviando}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {enviando ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
