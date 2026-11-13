"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, FolderOpen, Layers, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { useLanguage } from "@/lib/i18n"
import { ResumoCard } from "@/components/resumo-card"

const BUCKET_CAPAS = "biblioteca-capas"

interface UP {
  id: string
  materia_key: string
  nome: string
  ordem: number
}
interface ResumoUP {
  id: string
  titulo: string
  drive_file_id: string
  capa_path: string | null
}

function capaUrl(path: string | null) {
  if (!path) return null
  return supabase.storage.from(BUCKET_CAPAS).getPublicUrl(path).data.publicUrl
}

async function authedFetch(input: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return fetch(input, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } })
}

// Resumos por Matéria → UP → cards. Mostra só as matérias que têm UPs com
// conteúdo. Navegação em 3 níveis; avisa o pai (onOpenChange) quando entra
// numa matéria pra o resto da biblioteca se esconder.
export function BibliotecaUpResumos({ onOpenChange }: { onOpenChange?: (aberto: boolean) => void }) {
  const { t } = useLanguage()
  const materiaLabel = (k: string) => t.cronograma.materiaLabel[k] ?? t.cronograma.disciplinaBaseLabel[k] ?? k

  const [ups, setUps] = useState<UP[]>([])
  const [loading, setLoading] = useState(true)
  const [materia, setMateria] = useState<string | null>(null)
  const [upAberta, setUpAberta] = useState<UP | null>(null)

  const [resumos, setResumos] = useState<ResumoUP[]>([])
  const [loadingResumos, setLoadingResumos] = useState(false)
  const [baixando, setBaixando] = useState<{ id: string; percent: number | null } | null>(null)

  useEffect(() => {
    supabase
      .from("biblioteca_up")
      .select("id, materia_key, nome, ordem")
      .eq("ativo", true)
      .order("ordem")
      .then(({ data }) => {
        setUps((data as UP[]) ?? [])
        setLoading(false)
      })
  }, [])

  // Matérias que têm ao menos uma UP (mantém a ordem do currículo pela 1ª UP).
  const materias = useMemo(() => {
    const vistos: string[] = []
    for (const up of ups) if (!vistos.includes(up.materia_key)) vistos.push(up.materia_key)
    return vistos
  }, [ups])

  const abrirMateria = (m: string) => {
    setMateria(m)
    onOpenChange?.(true)
  }
  const voltarMaterias = () => {
    setMateria(null)
    onOpenChange?.(false)
  }

  const abrirUp = async (up: UP) => {
    setUpAberta(up)
    setLoadingResumos(true)
    const { data } = await supabase
      .from("biblioteca_up_resumos")
      .select("id, titulo, drive_file_id, capa_path")
      .eq("up_id", up.id)
      .eq("ativo", true)
      .order("ordem")
    setResumos((data as ResumoUP[]) ?? [])
    setLoadingResumos(false)
  }
  const voltarUps = () => {
    setUpAberta(null)
    setResumos([])
  }

  const baixar = async (r: ResumoUP) => {
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

  if (loading) return null
  if (materias.length === 0) return null // nenhuma UP com conteúdo ainda

  // Nível 3 — cards dentro da UP
  if (materia && upAberta) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={voltarUps} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {materiaLabel(materia)}
        </button>
        <h2 className="text-lg font-semibold text-foreground">{upAberta.nome}</h2>
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

  // Nível 2 — UPs da matéria
  if (materia) {
    const lista = ups.filter((u) => u.materia_key === materia)
    return (
      <div className="space-y-4">
        <button type="button" onClick={voltarMaterias} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {t.biblioteca.voltar}
        </button>
        <h2 className="text-lg font-semibold text-foreground">{materiaLabel(materia)}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((up) => (
            <button key={up.id} type="button" onClick={() => abrirUp(up)} className="text-left">
              <Card className="group overflow-hidden border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <Layers className="h-5 w-5 text-primary transition-transform group-hover:scale-110" />
                </div>
                <h3 className="mt-3 text-sm font-semibold leading-snug text-foreground">{up.nome}</h3>
              </Card>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Nível 1 — matérias com UPs
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t.biblioteca.secoesTitulo}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {materias.map((m) => (
          <button key={m} type="button" onClick={() => abrirMateria(m)} className="text-left">
            <Card className="group overflow-hidden border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <FolderOpen className="h-5 w-5 text-primary transition-transform group-hover:scale-110" />
              </div>
              <h3 className="mt-3 text-sm font-semibold leading-snug text-foreground">{materiaLabel(m)}</h3>
            </Card>
          </button>
        ))}
      </div>
    </section>
  )
}
