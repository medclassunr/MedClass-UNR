"use client"

import { use, useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, ExternalLink, Loader2, MessageCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type PlanoPago = "mensal" | "trimestral"

// Links de pagamento fixos, gerados direto no painel do Mercado Pago
// (produto "Pagar" / link de pagamento) -- não dependem da API nem do
// Wallet Brick, que estavam bloqueados. A liberação de acesso é manual:
// o admin confere no próprio Mercado Pago (com os dados coletados abaixo)
// e libera o acesso pelo painel /admin/pagamentos.
const PLANO_INFO: Record<PlanoPago, { nome: string; preco: string; periodo: string; link: string }> = {
  mensal: { nome: "Plano Mensal", preco: "$ 8.000", periodo: "/mes", link: "https://mpago.la/1XoZzdw" },
  trimestral: { nome: "Plano Trimestral", preco: "$ 18.000", periodo: "/trimestre", link: "https://mpago.la/2VVKs4n" },
}

const WHATSAPP_SUPORTE = "543417214945"

export default function CheckoutPage({ params }: { params: Promise<{ plano: string }> }) {
  const { plano: planoParam } = use(params)
  const plano = (planoParam === "mensal" || planoParam === "trimestral" ? planoParam : null) as PlanoPago | null

  const [nome, setNome] = useState("")
  const [apellido, setApellido] = useState("")
  const [email, setEmail] = useState("")
  const [telefone, setTelefone] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email)
    })
  }, [])

  if (!plano) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
        <p className="text-muted-foreground">Plano inválido.</p>
      </div>
    )
  }

  const info = PLANO_INFO[plano]
  const datosCompletos = nome.trim() && apellido.trim() && telefone.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const mensagemWhatsapp = `Hola! Realicé el pago del ${info.nome} de MedClass UNR. Mi nombre completo es: ${nome} ${apellido} y mi e-mail es: ${email}. Te envío el comprobante de pago.`
  const whatsappUrl = `https://wa.me/${WHATSAPP_SUPORTE}?text=${encodeURIComponent(mensagemWhatsapp)}`

  const handlePagar = async () => {
    if (!datosCompletos || enviando) return
    setEnviando(true)
    setErro(null)

    try {
      const res = await fetch("/api/checkout/mercadopago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano, email, nome, apellido, telefone }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? "Error al registrar tus datos.")
      }
      setEnviado(true)
      window.open(info.link, "_blank", "noopener,noreferrer")
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Error al registrar tus datos.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mt-4 mb-4 flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="MedClass Logo"
              width={228}
              height={64}
              sizes="228px"
              className="h-16 w-auto object-contain"
              priority
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Finalizá tu suscripción</p>
        </div>

        <Card className="border border-border bg-card p-6">
          <div className="mb-5 flex items-end justify-between border-b border-border pb-5">
            <div>
              <p className="text-sm text-muted-foreground">{info.nome}</p>
              <p className="text-2xl font-bold text-foreground">
                {info.preco}
                <span className="text-sm font-normal text-muted-foreground">{info.periodo}</span>
              </p>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  1
                </span>
                <p className="text-sm font-semibold text-foreground">Completá tus datos</p>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="nome" className="text-xs">Nombre</Label>
                    <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} disabled={enviando} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="apellido" className="text-xs">Apellido</Label>
                    <Input id="apellido" value={apellido} onChange={(e) => setApellido(e.target.value)} disabled={enviando} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-xs">E-mail</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={enviando} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="telefone" className="text-xs">Teléfono</Label>
                  <Input id="telefone" type="tel" placeholder="+54 9 341..." value={telefone} onChange={(e) => setTelefone(e.target.value)} disabled={enviando} />
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2.5 flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  2
                </span>
                <p className="text-sm font-semibold text-foreground">Pagá con Mercado Pago</p>
              </div>
              <Button className="w-full gap-2" disabled={!datosCompletos || enviando} onClick={handlePagar}>
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                Pagar con Mercado Pago
              </Button>
              {erro && <p className="mt-2 text-xs text-destructive">{erro}</p>}
              {!datosCompletos && !erro && (
                <p className="mt-2 text-xs text-muted-foreground">Completá tus datos para continuar.</p>
              )}
            </div>

            <div className="rounded-xl border-2 border-amber-500/60 bg-amber-500/10 p-4 shadow-[0_0_24px_-6px_rgba(245,158,11,0.5)]">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                  3
                </span>
                <p className="text-sm font-bold text-foreground">¡No te olvides! Enviá el comprobante</p>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Envianos el comprobante por WhatsApp para acelerar la activación de tu acceso. Solemos confirmar en poco tiempo.
              </p>
              <a href={enviado ? whatsappUrl : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!enviado}>
                <Button className="w-full gap-2 bg-[#25D366] text-white hover:bg-[#1ebe5b]" disabled={!enviado}>
                  <MessageCircle className="h-4 w-4" />
                  Enviar comprobante por WhatsApp
                </Button>
              </a>
            </div>
          </div>
        </Card>

        <Link
          href="/#pricing"
          className="mt-6 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a los planes
        </Link>
      </div>
    </div>
  )
}
