"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, Loader2, Lock } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/lib/i18n"
import { PushToggle } from "@/components/push-toggle"
import { PerfilVersaoSection } from "@/components/perfil-versao-section"

const FOTO_MAX_BYTES = 2 * 1024 * 1024
const FOTO_ACCEPT = "image/png, image/jpeg"

export function PerfilContent() {
  const { t } = useLanguage()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [cutoffScore, setCutoffScore] = useState("60")
  const [saved, setSaved] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [erroFoto, setErroFoto] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user
      if (!user) return
      setUserId(user.id)
      setEmail(user.email ?? "")
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, nota_corte")
        .eq("id", user.id)
        .maybeSingle()
      setName(profile?.full_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? "")
      setAvatarUrl(profile?.avatar_url ?? null)
      setCutoffScore(String(profile?.nota_corte ?? 60))
    })
  }, [])

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    e.target.value = ""
    if (!file || !userId) return

    setErroFoto(null)
    if (file.size > FOTO_MAX_BYTES) {
      setErroFoto(t.perfil.fotoErroTamanho)
      return
    }

    setEnviandoFoto(true)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const path = `${userId}/${crypto.randomUUID()}-${safeName}`
    const { error: uploadError } = await supabase.storage
      .from("avatares")
      .upload(path, file, { contentType: file.type || undefined })

    if (uploadError) {
      setEnviandoFoto(false)
      setErroFoto(t.perfil.fotoErroUpload)
      return
    }

    const { data: publicUrlData } = supabase.storage.from("avatares").getPublicUrl(path)
    const novaUrl = publicUrlData.publicUrl

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: novaUrl })
      .eq("id", userId)

    setEnviandoFoto(false)
    if (updateError) {
      setErroFoto(t.perfil.fotoErroUpload)
      return
    }
    setAvatarUrl(novaUrl)
  }

  const handleSave = async () => {
    if (!userId) return
    setErroSalvar(null)

    const notaCorteValue = Number(cutoffScore)
    if (!name.trim() || Number.isNaN(notaCorteValue) || notaCorteValue < 0 || notaCorteValue > 100) {
      setErroSalvar(t.perfil.erroSalvar)
      return
    }

    setSalvando(true)
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim(), nota_corte: notaCorteValue })
      .eq("id", userId)
    setSalvando(false)

    if (error) {
      setErroSalvar(t.perfil.erroSalvar)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : email.slice(0, 2).toUpperCase()

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="border border-border bg-card p-6">
        <h2 className="mb-6 text-lg font-semibold text-foreground">{t.perfil.fotoDePerfil}</h2>
        <div className="flex items-center gap-5">
          <Avatar className="h-20 w-20">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
            <AvatarFallback className="bg-accent text-lg font-semibold text-accent-foreground">
              {initials || "?"}
            </AvatarFallback>
          </Avatar>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept={FOTO_ACCEPT}
              onChange={handleFotoChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={enviandoFoto}
              onClick={() => fileInputRef.current?.click()}
            >
              {enviandoFoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {enviandoFoto ? t.perfil.fotoEnviando : t.perfil.alterarFoto}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">{t.perfil.formatoFoto}</p>
            {erroFoto && <p className="mt-1 text-xs text-destructive">{erroFoto}</p>}
          </div>
        </div>
      </Card>

      <Card className="border border-border bg-card p-6">
        <h2 className="mb-6 text-lg font-semibold text-foreground">{t.perfil.dadosPessoais}</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">{t.perfil.nomeCompleto}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-2" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">{t.perfil.email}</label>
            <div className="relative mt-2">
              <Input
                type="email"
                value={email}
                readOnly
                disabled
                className="cursor-not-allowed pr-9 opacity-80"
              />
              <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t.perfil.emailAviso}</p>
          </div>
        </div>
      </Card>

      <Card className="border border-border bg-card p-6">
        <h2 className="mb-2 text-lg font-semibold text-foreground">{t.perfil.preferenciasEstudo}</h2>
        <p className="mb-4 text-sm text-muted-foreground">{t.perfil.preferenciasDesc}</p>
        <div>
          <label className="text-sm font-medium text-foreground">{t.perfil.notaDeCorte}</label>
          <div className="mt-2 flex items-center gap-2">
            <Input
              type="number"
              min="0"
              max="100"
              value={cutoffScore}
              onChange={(e) => setCutoffScore(e.target.value)}
              className="w-28"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button variant="gradient" onClick={handleSave} disabled={salvando}>
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : t.perfil.salvarAlteracoes}
        </Button>
        {saved && <span className="text-sm font-medium text-success">{t.perfil.alteracoesSalvas}</span>}
        {erroSalvar && <span className="text-sm font-medium text-destructive">{erroSalvar}</span>}
      </div>

      <PushToggle />
      <PerfilVersaoSection />
    </div>
  )
}
