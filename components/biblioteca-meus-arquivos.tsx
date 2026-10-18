"use client"

import { useEffect, useRef, useState } from "react"
import { Download, Eye, FileText, Loader2, Pencil, Trash2, Upload } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { useLanguage } from "@/lib/i18n"
import { BibliotecaPdfEditor } from "@/components/biblioteca-pdf-editor"

const LIMITE = 5
const TAMANHO_MAXIMO = 10 * 1024 * 1024
const BUCKET = "biblioteca-proprios"

interface DocumentoProprio {
  id: string
  materia_key: string
  storage_path: string
  nome_arquivo: string
  tamanho_bytes: number
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function BibliotecaMeusArquivos({ materiaKey }: { materiaKey: string }) {
  const { t } = useLanguage()
  const inputRef = useRef<HTMLInputElement>(null)
  const [documentos, setDocumentos] = useState<DocumentoProprio[]>([])
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [processandoId, setProcessandoId] = useState<string | null>(null)
  const [visualizando, setVisualizando] = useState<{ id: string; nome: string; urlPdf: string } | null>(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from("biblioteca_documentos_proprios")
      .select("*")
      .eq("materia_key", materiaKey)
      .order("criado_em")
    setDocumentos((data as DocumentoProprio[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materiaKey])

  const handleArquivoSelecionado: React.ChangeEventHandler<HTMLInputElement> = async (ev) => {
    const file = ev.target.files?.[0]
    ev.target.value = ""
    if (!file) return
    if (file.type !== "application/pdf") return alert(t.biblioteca.apenasArquivoPdf)
    if (file.size > TAMANHO_MAXIMO) return alert(t.biblioteca.arquivoMuitoGrande)
    if (documentos.length >= LIMITE) return alert(t.biblioteca.limiteArquivosAtingido)

    setEnviando(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) throw new Error("sem usuário")

      const path = `${userId}/${materiaKey}/${crypto.randomUUID()}-${file.name}`
      const { error: erroUpload } = await supabase.storage.from(BUCKET).upload(path, file)
      if (erroUpload) throw erroUpload

      const { error: erroInsert } = await supabase.from("biblioteca_documentos_proprios").insert({
        user_id: userId,
        materia_key: materiaKey,
        storage_path: path,
        nome_arquivo: file.name,
        tamanho_bytes: file.size,
      })
      if (erroInsert) {
        await supabase.storage.from(BUCKET).remove([path])
        throw erroInsert
      }
      await load()
    } catch {
      alert(t.biblioteca.erroEnviarArquivo)
    } finally {
      setEnviando(false)
    }
  }

  const handleRemover = async (doc: DocumentoProprio) => {
    if (!confirm(t.biblioteca.confirmarRemover)) return
    setProcessandoId(doc.id)
    await supabase.storage.from(BUCKET).remove([doc.storage_path])
    await supabase.from("biblioteca_documentos_proprios").delete().eq("id", doc.id)
    await load()
    setProcessandoId(null)
  }

  const handleRenomear = async (doc: DocumentoProprio) => {
    const novoNome = prompt(t.biblioteca.renomearPrompt, doc.nome_arquivo)
    if (!novoNome || !novoNome.trim() || novoNome.trim() === doc.nome_arquivo) return
    setProcessandoId(doc.id)
    await supabase.from("biblioteca_documentos_proprios").update({ nome_arquivo: novoNome.trim() }).eq("id", doc.id)
    await load()
    setProcessandoId(null)
  }

  const handleVisualizar = async (doc: DocumentoProprio) => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, 600)
    if (!data?.signedUrl) return alert(t.biblioteca.erroCarregarArquivos)
    setVisualizando({ id: doc.id, nome: doc.nome_arquivo, urlPdf: data.signedUrl })
  }

  const handleBaixar = async (doc: DocumentoProprio) => {
    setProcessandoId(doc.id)
    try {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, 60)
      if (!data?.signedUrl) throw new Error("sem url")
      const res = await fetch(data.signedUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = doc.nome_arquivo
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      alert(t.biblioteca.erroBaixar)
    } finally {
      setProcessandoId(null)
    }
  }

  return (
    <Card className="overflow-hidden border border-border bg-card p-0">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div>
          <p className="text-sm font-semibold text-foreground">{t.biblioteca.meusArquivos}</p>
          <p className="text-xs text-muted-foreground">{t.biblioteca.meusArquivosDescricao}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">{t.biblioteca.limiteArquivos(documentos.length)}</span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={enviando || documentos.length >= LIMITE}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {enviando ? t.biblioteca.enviando : t.biblioteca.enviarArquivo}
          </button>
          <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={handleArquivoSelecionado} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.biblioteca.carregando}
        </div>
      ) : documentos.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t.biblioteca.nenhumArquivoProprio}</p>
      ) : (
        <div className="divide-y divide-border">
          {documentos.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-rose-500/10">
                <FileText className="h-4 w-4 text-rose-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{doc.nome_arquivo}</p>
              </div>
              <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:inline">
                {formatBytes(doc.tamanho_bytes)}
              </span>
              <div className="flex items-center gap-1">
                {processandoId === doc.id ? (
                  <div className="flex h-8 w-8 items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleVisualizar(doc)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title={t.biblioteca.visualizar}
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBaixar(doc)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title={t.biblioteca.baixar}
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRenomear(doc)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title={t.biblioteca.renomear}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemover(doc)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title={t.biblioteca.remover}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {visualizando && (
        <BibliotecaPdfEditor
          chaveAnotacao={`proprio:${visualizando.id}`}
          urlPdf={visualizando.urlPdf}
          nome={visualizando.nome}
          onClose={() => setVisualizando(null)}
        />
      )}
    </Card>
  )
}
