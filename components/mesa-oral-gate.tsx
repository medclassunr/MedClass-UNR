"use client"

// Restringe a Prova Oral com IA a admin (protótipo em teste, pedido
// explícito do usuário) -- mesmo padrão de checagem client-side usado em
// admin-layout.tsx, mas sem redirecionar: quem não é admin simplesmente
// continua vendo o ComingSoonContent de sempre, sem nenhuma mudança visível.

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { getPlanStatus } from "@/lib/plan-status"
import { ComingSoonContent } from "@/components/coming-soon-content"
import { MesaOralProva } from "@/components/mesa-oral-prova"

export function MesaOralGate() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    getPlanStatus().then((status) => {
      if (active) setIsAdmin(status?.isAdmin ?? false)
    })
    return () => {
      active = false
    }
  }, [])

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAdmin) return <ComingSoonContent feature="mesaOral" />

  return <MesaOralProva />
}
