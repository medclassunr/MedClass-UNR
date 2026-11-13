"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Loader2, Lock, PlayCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { HospitalSimulacaoCaso } from "@/lib/hospital-simulacao-types"
import { useLanguage } from "@/lib/i18n"
import { getPlanStatus } from "@/lib/plan-status"

function GradeCasos({ casos, podeAcessar, vazioLabel }: { casos: HospitalSimulacaoCaso[]; podeAcessar: boolean; vazioLabel: string }) {
  const { t } = useLanguage()

  if (casos.length === 0) {
    return (
      <Card className="border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">{vazioLabel}</p>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {casos.map((caso) => {
        const cardContent = (
          <Card
            className={`group flex h-full flex-col overflow-hidden rounded-[24px] border border-border bg-card transition-all ${
              podeAcessar ? "hover:border-red-500/50 hover:shadow-[0_0_24px_-8px_rgba(220,38,38,0.35)]" : "opacity-60"
            }`}
          >
            <div className="relative aspect-video w-full overflow-hidden bg-black">
              <Image
                src="/hospital-simulacao-capa.png"
                alt=""
                fill
                className={`object-cover transition-transform ${podeAcessar ? "group-hover:scale-105" : ""}`}
              />
              {!podeAcessar && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <Lock className="h-8 w-8 text-white" />
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-5">
              <h3 className="text-sm font-semibold leading-snug text-foreground">{caso.titulo}</h3>
              {caso.descricao && <p className="line-clamp-2 text-xs text-muted-foreground">{caso.descricao}</p>}
              {podeAcessar ? (
                <span className="mt-auto flex items-center gap-1.5 pt-2 text-xs font-medium text-red-500">
                  <PlayCircle className="h-4 w-4" />
                  {t.hospitalSimulacaoGrid.abrirCaso}
                </span>
              ) : (
                <span className="mt-auto pt-2 text-xs text-muted-foreground">{t.hospitalSimulacaoGrid.bloqueadoCard}</span>
              )}
            </div>
          </Card>
        )

        return (
          <Link key={caso.id} href={`/dashboard/hospital-simulacao/${caso.id}`}>
            {cardContent}
          </Link>
        )
      })}
    </div>
  )
}

export function HospitalSimulacaoGrid() {
  const { t } = useLanguage()
  const [casos, setCasos] = useState<HospitalSimulacaoCaso[]>([])
  const [podeAcessar, setPodeAcessar] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from("hospital_simulacao_casos").select("*").eq("ativo", true).order("ordem"),
      getPlanStatus(),
    ]).then(([{ data }, planStatus]) => {
      setCasos((data as HospitalSimulacaoCaso[]) ?? [])
      setPodeAcessar(planStatus?.hasFullAccess ?? false)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t.hospitalSimulacaoGrid.carregando}
      </div>
    )
  }

  const casosAno4 = casos.filter((c) => c.ano !== "ano5")
  const casosAno5 = casos.filter((c) => c.ano === "ano5")

  return (
    <div className="space-y-6">
      <Tabs defaultValue="ano4" className="gap-6">
        <TabsList className="border border-border bg-card p-1">
          <TabsTrigger
            value="ano4"
            className="font-semibold text-muted-foreground/50 transition-all data-[state=active]:border-red-500/60 data-[state=active]:bg-red-500/10 data-[state=active]:text-red-400 data-[state=active]:shadow-[0_0_10px_rgba(239,68,68,0.6),0_0_24px_rgba(239,68,68,0.35)]"
          >
            {t.hospitalSimulacaoGrid.abaAno4}
          </TabsTrigger>
          <TabsTrigger
            value="ano5"
            className="font-semibold text-muted-foreground/50 transition-all data-[state=active]:border-red-500/60 data-[state=active]:bg-red-500/10 data-[state=active]:text-red-400 data-[state=active]:shadow-[0_0_10px_rgba(239,68,68,0.6),0_0_24px_rgba(239,68,68,0.35)]"
          >
            {t.hospitalSimulacaoGrid.abaAno5}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ano4">
          <GradeCasos casos={casosAno4} podeAcessar={podeAcessar} vazioLabel={t.hospitalSimulacaoGrid.vazio} />
        </TabsContent>
        <TabsContent value="ano5">
          <GradeCasos casos={casosAno5} podeAcessar={podeAcessar} vazioLabel={t.hospitalSimulacaoGrid.vazio} />
        </TabsContent>
      </Tabs>

      <p className="text-center text-xs text-muted-foreground/70">{t.hospitalSimulacaoGrid.avisoEducativo}</p>
    </div>
  )
}
