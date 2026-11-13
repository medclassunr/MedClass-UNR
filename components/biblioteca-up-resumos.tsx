"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, FolderOpen, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { useLanguage } from "@/lib/i18n"
import { ResumoCard } from "@/components/resumo-card"

const BUCKET_CAPAS = "biblioteca-capas"

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
  return fetch(input, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } })
}

// Resumos por Matéria -> cards (direto, sem nível de UP/pasta). Internamente
// cada resumo ainda pertence a um contêiner (biblioteca_up) por matéria, mas
// aqui agrupamos tudo por materia_key e mostramos os cards direto.
export function BibliotecaUpResumos({ onOpenChange }: { onOpenChange?: (aberto: boolean) => void }) {
  const { t } = useLanguage()
  const materiaLabel = (k: string) => t.cronograma.materiaLabel[k] ?? t.cronograma.disciplinaBaseLabel[k] ?? k

  // mapa up_id -> materia_key (pra agrupar os resumos por matéria)
  const [upMateria, setUpMateria] = useState<Record<string, string>>({})
  const [resumos, setResumos] = useState<ResumoUP[]>([])
  const [loading, setLoading] = useState(true)
  const [materia, setMateria] = useState<string | null>(null)
  const [baixando, setBaixando] = useState<{ id: string; percent: number | null } | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from("biblioteca_up").select("id, materia_key").eq("ativo", true),
      supabase
        .from("biblioteca_up_resumos")
        .select("id, up_id, titulo, drive_file_id, capa_path, ordem")
        .eq("ativo", true)
        .order("ordem"),
    ]).then(([{ data: ups }, { data: res }]) => {
      const mapa: Record<string, string> = {}
      for (const u of (ups as { id: string; materia_key: string }[]) ?? []) mapa[u.id] = u.materia_key
      setUpMateria(mapa)
      setResumos((res as ResumoUP[]) ?? [])
      setLoading(false)
    })
  }, [])

  // matérias que têm ao menos um resumo (ordem = 1ª aparição)
  const materias = useMemo(() => {
    const vistos: string[] = []
    for (const r of resumos) {
      const m = upMateria[r.up_id]
      if (m && !vistos.includes(m)) vistos.push(m)
    }
    return vistos
  }, [resumos, upMateria])

  const resumosDaMateria = (m: string) => resumos.filter((r) => upMateria[r.up_id] === m)

  const abrir = (m: string) => {
    setMateria(m)
    onOpenChange?.(true)
  }
  const voltar = () => {
    setMateria(null)
    onOpenChange?.(false)
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
  if (materias.length === 0) return null // nenhuma matéria com resumos ainda

  // Dentro de uma matéria: grade de cards
  if (materia) {
    const cards = resumosDaMateria(materia)
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
        <h2 className="text-lg font-semibold text-foreground">{materiaLabel(materia)}</h2>
        {cards.length === 0 ? (
          <Card className="border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">{t.biblioteca.nenhumResumoSecao}</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {cards.map((r) => (
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

  // Lista de matérias com resumos
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t.biblioteca.secoesTitulo}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {materias.map((m) => (
          <button key={m} type="button" onClick={() => abrir(m)} className="text-left">
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
