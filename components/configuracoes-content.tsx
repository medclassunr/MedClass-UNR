"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { useLanguage } from "@/lib/i18n"
import { PushToggle } from "@/components/push-toggle"
import { AtualizarAppSection } from "@/components/atualizar-app-section"

interface ToggleRow {
  key: string
  label: string
  description: string
  defaultChecked: boolean
}

function ToggleGroup({ title, rows }: { title: string; rows: ToggleRow[] }) {
  const [state, setState] = useState<Record<string, boolean>>(
    Object.fromEntries(rows.map((r) => [r.key, r.defaultChecked]))
  )

  return (
    <Card className="border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">{title}</h2>
      <div className="divide-y divide-border">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-medium text-foreground">{row.label}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{row.description}</p>
            </div>
            <Switch
              checked={state[row.key]}
              onCheckedChange={(checked) => setState((prev) => ({ ...prev, [row.key]: checked }))}
            />
          </div>
        ))}
      </div>
    </Card>
  )
}

export function ConfiguracoesContent() {
  const { t } = useLanguage()

  const notificationRows: ToggleRow[] = [
    { key: "reminders", ...t.configuracoes.reminders, defaultChecked: true },
  ]
  const emailRows: ToggleRow[] = [
    { key: "weekly-summary", ...t.configuracoes.weeklySummary, defaultChecked: true },
    { key: "product-updates", ...t.configuracoes.productUpdates, defaultChecked: false },
  ]
  const privacyRows: ToggleRow[] = [
    { key: "public-profile", ...t.configuracoes.publicProfile, defaultChecked: false },
    { key: "share-progress", ...t.configuracoes.shareProgress, defaultChecked: true },
  ]

  return (
    <div className="max-w-2xl space-y-6">
      <AtualizarAppSection />
      <PushToggle />
      <ToggleGroup title={t.configuracoes.notificacoes} rows={notificationRows} />
      <ToggleGroup title={t.configuracoes.alertasEmail} rows={emailRows} />
      <ToggleGroup title={t.configuracoes.privacidade} rows={privacyRows} />
    </div>
  )
}
