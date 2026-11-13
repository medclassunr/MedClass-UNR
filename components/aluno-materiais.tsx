"use client"

import { useEffect, useRef, useState } from "react"
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/i18n"

interface Material {
  id: string
  titulo: string | null
  nome_arquivo: string
  drive_file_id: string
  tamanho_bytes: number | null
  criado_em: string
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ""
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function authedFetch(input: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` }
  if (!(init.body instanceof FormData)) headers["Content-Type"] = "application/json"
  return fetch(input, { ...init, headers })
}

// "Meus materiais": o aluno sobe os próprios arquivos (vão pra uma pasta com o
// nome dele no Drive do admin) e vê/baixa só os seus. Montado na aba
// "Resúmenes", junto das seções de resumo.
export function AlunoMateriais() {
  const { t } = useLanguage()
  const [materiais, setMateriais] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)

  const [titulo, setTitulo] = useState("")
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [baixando, setBaixando] = useState<string | null>(null)
  const [removendo, setRemovendo] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const carregar = async () => {
    const { data } = await supabase
      .from("aluno_materiais")
      .select("id, titulo, nome_arquivo, drive_file_id, tamanho_bytes, criado_em")
      .order("criado_em", { ascending: false })
    setMateriais((data as Material[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const enviar = async () => {
    if (!arquivo) return
    setEnviando(true)
    setErro(null)
    try {
      const form = new FormData()
      form.append("arquivo", arquivo)
      if (titulo.trim()) form.append("titulo", titulo.trim())
      const res = await authedFetch("/api/biblioteca/materiais-aluno", { method: "POST", body: form })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || t.biblioteca.erroEnviarMaterial)
      setTitulo("")
      setArquivo(null)
      if (fileRef.current) fileRef.current.value = ""
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : t.biblioteca.erroEnviarMaterial)
    } finally {
      setEnviando(false)
    }
  }

  const baixar = async (m: Material) => {
    setBaixando(m.id)
    try {
      const res = await authedFetch(
        `/api/biblioteca/arquivo/${m.drive_file_id}?modo=download&fonte=oauth&escopo=aluno`
      )
      if (!res.ok || !res.body) throw new Error("erro")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = m.nome_arquivo
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

  const remover = async (m: Material) => {
    if (!confirm(t.biblioteca.confirmarRemoverMaterial)) return
    setRemovendo(m.id)
    try {
      const res = await authedFetch(`/api/biblioteca/materiais-aluno?id=${m.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("erro")
      setMateriais((prev) => prev.filter((x) => x.id !== m.id))
    } catch {
      alert(t.biblioteca.erroBaixar)
    } finally {
      setRemovendo(null)
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t.biblioteca.meusMateriaisTitulo}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">{t.biblioteca.meusMateriaisDesc}</p>
      </div>

      {/* Enviar */}
      <Card className="border border-border bg-card p-4">
        <input
          ref={fileRef}
          type="file"
          hidden
          onChange={(e) => {
            setArquivo(e.target.files?.[0] ?? null)
            setErro(null)
          }}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={t.biblioteca.tituloOpcional}
            className="sm:max-w-xs"
          />
          <Button type="button" variant="outline" className="justify-start" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" />
            {arquivo ? arquivo.name : t.biblioteca.escolherArquivo}
          </Button>
          <Button onClick={enviar} disabled={!arquivo || enviando} className="gap-2">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {enviando ? t.biblioteca.enviando : t.biblioteca.enviarMaterial}
          </Button>
        </div>
        {erro && <p className="mt-2 text-xs text-destructive">{erro}</p>}
      </Card>

      {/* Lista dos meus materiais */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.biblioteca.carregando}
        </div>
      ) : materiais.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">{t.biblioteca.nenhumMaterialProprio}</p>
      ) : (
        <div className="space-y-2">
          {materiais.map((m) => (
            <Card key={m.id} className="flex items-center gap-3 border border-border bg-card p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{m.titulo || m.nome_arquivo}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.nome_arquivo}
                  {m.tamanho_bytes ? ` · ${formatBytes(m.tamanho_bytes)}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => baixar(m)}
                disabled={baixando === m.id}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                title={m.nome_arquivo}
              >
                {baixando === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => remover(m)}
                disabled={removendo === m.id}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                title="Remover"
              >
                {removendo === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
