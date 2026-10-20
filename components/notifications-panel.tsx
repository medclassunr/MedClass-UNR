"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR, es } from "date-fns/locale"
import { CheckCheck, Bell, BellRing, Info, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import {
  type Notificacao,
  buscarNotificacoes,
  contarNaoLidas,
  marcarComoLida,
  marcarTodasComoLidas,
} from "@/lib/notifications"
import { buscarLembretesAtivos } from "@/lib/calendario-lembretes"
import { useLanguage } from "@/lib/i18n"
import type { CalendarioLembreteAtivo } from "@/lib/calendario-types"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const tipoIcon: Record<Notificacao["tipo"], typeof Info> = {
  info: Info,
  sucesso: CheckCircle2,
  alerta: AlertTriangle,
}

const tipoCor: Record<Notificacao["tipo"], string> = {
  info: "text-blue-500",
  sucesso: "text-success",
  alerta: "text-warning",
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "agora"
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export function NotificationsPanel() {
  const { t, lang } = useLanguage()
  const localeDf = lang === "es" ? es : ptBR
  const [open, setOpen] = useState(false)
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [lembretes, setLembretes] = useState<CalendarioLembreteAtivo[]>([])
  const [naoLidas, setNaoLidas] = useState(0)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      const [count, ativos] = await Promise.all([contarNaoLidas(data.user.id), buscarLembretesAtivos(data.user.id)])
      setLembretes(ativos)
      setNaoLidas(count + ativos.length)
    })
  }, [])

  const loadNotificacoes = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const [nots, count, ativos] = await Promise.all([
      buscarNotificacoes(userId, 20),
      contarNaoLidas(userId),
      buscarLembretesAtivos(userId),
    ])
    setNotificacoes(nots)
    setLembretes(ativos)
    setNaoLidas(count + ativos.length)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (open) loadNotificacoes()
  }, [open, loadNotificacoes])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          setNaoLidas((prev) => prev + 1)
          if (open) loadNotificacoes()
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, open, loadNotificacoes])

  const handleMarkRead = async (id: string) => {
    await marcarComoLida(id)
    setNotificacoes((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)))
    setNaoLidas((prev) => Math.max(0, prev - 1))
  }

  const handleMarkAllRead = async () => {
    if (!userId) return
    await marcarTodasComoLidas(userId)
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })))
    setNaoLidas(lembretes.length)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
          aria-label="Notificações"
        >
          <Bell className="h-5 w-5" />
          {naoLidas > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white ring-2 ring-card">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
          {naoLidas > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar lidas
            </button>
          )}
        </div>
        {lembretes.length > 0 && (
          <div className="border-b border-border">
            <p className="px-4 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t.calendario.lembretePainelTitulo}
            </p>
            {lembretes.map((lembrete) => (
              <Link
                key={lembrete.id}
                href="/dashboard/calendario"
                onClick={() => setOpen(false)}
                className="flex gap-3 border-b border-border bg-primary/5 px-4 py-3 transition-colors hover:bg-primary/10"
              >
                <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{lembrete.evento.titulo}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {format(new Date(`${lembrete.evento.data}T00:00:00`), "d 'de' MMMM", { locale: localeDf })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : notificacoes.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhuma notificação ainda.
            </div>
          ) : (
            notificacoes.map((not) => {
              const Icon = tipoIcon[not.tipo]
              return (
                <div
                  key={not.id}
                  className={`flex gap-3 border-b border-border px-4 py-3 transition-colors ${
                    not.lida ? "bg-background" : "bg-primary/5"
                  }`}
                >
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tipoCor[not.tipo]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm ${not.lida ? "text-muted-foreground" : "font-medium text-foreground"}`}>
                        {not.titulo}
                      </p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(not.created_at)}</span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-line text-xs text-muted-foreground">{not.mensagem}</p>
                    <div className="mt-1.5 flex items-center gap-3">
                      {not.link && (
                        <Link
                          href={not.link}
                          onClick={() => {
                            if (!not.lida) handleMarkRead(not.id)
                            setOpen(false)
                          }}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Ver →
                        </Link>
                      )}
                      {!not.lida && (
                        <button
                          onClick={() => handleMarkRead(not.id)}
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          Marcar como lida
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
