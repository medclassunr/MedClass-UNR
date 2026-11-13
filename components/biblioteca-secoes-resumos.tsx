"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, FolderOpen, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { useLanguage } from "@/lib/i18n"
import { ResumoCard } from "@/components/resumo-card"

interface Secao {
  id: string
  nome: string
  ordem: number
}

interface Resumo {
  id: string
  titulo: string
  drive_file_id: string
  capa_path: string | null
}

const BUCKET_CAPAS = "biblioteca-capas"

function capaUrl(path: string | null) {
  if (!path) return null
  return supabase.storage.from(BUCKET_CAPAS).getPublicUrl(path).data.publicUrl
}

async function authedFetch(input: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return fetch(input, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  })
}

// Biblioteca de resumos por SEÇÃO LIVRE (nome à vontade), com cards de capa e
// movimento 3D. Clicar no card baixa o PDF direto do Drive (via proxy
// fonte=oauth). Montado no topo da aba "Resúmenes"; quando uma seção está
// aberta, avisa o pai (onOpenChange) pra esconder a biblioteca por matéria.
export function BibliotecaSecoesResumos({ onOpenChange }: { onOpenChange?: (aberto: boolean) => void }) {
  const { t } = useLanguage()
  const [secoes, setSecoes] = useState<Secao[]>([])
  const [loading, setLoading] = useState(true)
  const [aberta, setAberta] = useState<Secao | null>(null)

  const [resumos, setResumos] = useState<Resumo[]>([])
  const [loadingResumos, setLoadingResumos] = useState(false)
  const [baixando, setBaixando] = useState<{ id: string; percent: number | null } | null>(null)

  useEffect(() => {
    supabase
      .from("biblioteca_secoes")
      .select("id, nome, ordem")
      .eq("ativo", true)
      .order("ordem")
      .then(({ data }) => {
        setSecoes((data as Secao[]) ?? [])
        setLoading(false)
      })
  }, [])

  const abrirSecao = async (secao: Secao) => {
    setAberta(secao)
    onOpenChange?.(true)
    setLoadingResumos(true)
    const { data } = await supabase
      .from("biblioteca_resumos_drive")
      .select("id, titulo, drive_file_id, capa_path")
      .eq("secao_id", secao.id)
      .eq("ativo", true)
      .order("ordem")
    setResumos((data as Resumo[]) ?? [])
    setLoadingResumos(false)
  }

  const voltar = () => {
    setAberta(null)
    setResumos([])
    onOpenChange?.(false)
  }

  const baixar = async (r: Resumo) => {
    setBaixando({ id: r.id, percent: 0 })
    try {
      const res = await authedFetch(`/api/biblioteca/arquivo/${r.drive_file_id}?modo=download&fonte=oauth`)
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
        setBaixando({ id: r.id, percent: total ? Math.min(100, Math.round((recebido / total) * 100)) : null })
      }
      const blob = new Blob(chunks as BlobPart[], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${r.titulo}.pdf`
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

  if (loading) return null // não ocupa espaço enquanto carrega; a biblioteca por matéria aparece normal
  if (secoes.length === 0 && !aberta) return null // nenhuma seção criada ainda

  // ---- Dentro de uma seção: grade de cards ----
  if (aberta) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={voltar}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.biblioteca.voltar}
        </button>
        <h2 className="text-lg font-semibold text-foreground">{aberta.nome}</h2>

        {loadingResumos ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.biblioteca.carregando}
          </div>
        ) : resumos.length === 0 ? (
          <Card className="border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">{t.biblioteca.nenhumResumoSecao}</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {resumos.map((r) => (
              <ResumoCard
                key={r.id}
                titulo={r.titulo}
                capaUrl={capaUrl(r.capa_path)}
                baixando={baixando?.id === r.id ? baixando.percent : undefined}
                onClick={() => baixar(r)}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ---- Lista de seções ----
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t.biblioteca.secoesTitulo}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {secoes.map((secao) => (
          <button key={secao.id} type="button" onClick={() => abrirSecao(secao)} className="text-left">
            <Card className="group overflow-hidden border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <FolderOpen className="h-5 w-5 text-primary transition-transform group-hover:scale-110" />
              </div>
              <h3 className="mt-3 text-sm font-semibold leading-snug text-foreground">{secao.nome}</h3>
            </Card>
          </button>
        ))}
      </div>
    </section>
  )
}
