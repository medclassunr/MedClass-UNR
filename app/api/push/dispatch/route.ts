import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { enviarPush, pushConfigurado, type PushPayload } from "@/lib/push-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Chamada pelo pg_cron do Supabase de minuto em minuto (ver migration
// 20261025000100_push_cron.sql). Procura estudos/lembretes "vencendo agora" e
// dispara o push no celular do aluno: 15 min antes e na hora exata.
//
// Fuso: os eventos guardam data/hora no horário local da Argentina (UTC-3,
// sem horário de verão), então converto o alvo pra instante absoluto com o
// offset fixo -03:00. Uma JANELA de tolerância (GRACE) cobre atraso do cron;
// a tabela push_envios garante que cada alerta sai no máximo uma vez.

const GRACE_MS = 6 * 60 * 1000 // 6 min: tolera o cron atrasar/pular algumas passadas
const ANTES_MS = 15 * 60 * 1000

type Disparo = "antes15" | "hora"

interface EventoParaAlerta {
  id: string
  titulo: string
  data: string
  hora: string | null
  link: string | null
}

function instanteAlvo(ev: EventoParaAlerta, disparo: Disparo): number | null {
  if (!ev.hora) return null
  // hora pode vir como "HH:MM" (do formulário) ou "HH:MM:SS" (tipo `time` do
  // Postgres). Normaliza pra HH:MM antes de montar o instante -- senão a string
  // ISO fica inválida ("13:10:00:00-03:00") e o Date vira NaN.
  const hhmm = ev.hora.slice(0, 5)
  const base = new Date(`${ev.data}T${hhmm}:00-03:00`).getTime()
  if (Number.isNaN(base)) return null
  return disparo === "antes15" ? base - ANTES_MS : base
}

function venceuAgora(alvo: number, agora: number): boolean {
  const atraso = agora - alvo
  return atraso >= 0 && atraso < GRACE_MS
}

function textoPush(ev: EventoParaAlerta, disparo: Disparo): PushPayload {
  // Texto em espanhol (idioma padrão da plataforma / público da UNR).
  const mensagem =
    disparo === "antes15"
      ? "Empieza en 15 minutos. ¡Preparate para entrenar! 💪"
      : "¡Es hora de estudiar! Entrá y entrená ahora. 🔥"
  return {
    titulo: ev.titulo,
    mensagem,
    link: ev.link || "/calendario",
    tag: `evento-${ev.id}-${disparo}`,
  }
}

interface AvisoAtividade {
  id: string
  user_id: string
  titulo: string
  sala: string
  data: string
  hora: string
  antecedencia_min: number
}

function textoAtividade(a: AvisoAtividade): PushPayload {
  const quando =
    a.antecedencia_min === 0
      ? "¡Empieza ahora!"
      : a.antecedencia_min === 120
        ? "Empieza en 2 horas."
        : a.antecedencia_min === 60
          ? "Empieza en 1 hora."
          : a.antecedencia_min === 30
            ? "Empieza en 30 minutos."
            : "Empieza en 15 minutos."
  const sala = a.sala ? ` Aula: ${a.sala}.` : ""
  return {
    titulo: a.titulo,
    mensagem: `${quando}${sala} ¡Prepará tus cosas! 📚`,
    link: "/dashboard/actividades-unr",
    tag: `atividade-${a.id}`,
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.PUSH_CRON_SECRET
  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  if (!pushConfigurado()) {
    return NextResponse.json({ error: "VAPID não configurado" }, { status: 503 })
  }

  const supabase = createAdminClient()
  const agora = Date.now()

  // Datas (calendário da Argentina) de hoje e amanhã -- amanhã cobre o caso do
  // "15 min antes" de um evento logo depois da meia-noite.
  const nowAr = new Date(agora - 3 * 3600 * 1000)
  const hoje = nowAr.toISOString().slice(0, 10)
  const amanha = new Date(nowAr.getTime() + 24 * 3600 * 1000).toISOString().slice(0, 10)

  // Monta o conjunto de pares (aluno, evento): estudos pessoais do próprio
  // aluno + eventos (pessoais ou oficiais) em que ele marcou lembrete.
  const pares = new Map<string, { userId: string; ev: EventoParaAlerta }>()
  const add = (userId: string, ev: EventoParaAlerta) => {
    if (!userId || !ev?.hora) return
    pares.set(`${userId}:${ev.id}`, { userId, ev })
  }

  const { data: pessoais } = await supabase
    .from("calendario_eventos")
    .select("id, titulo, data, hora, link, user_id")
    .not("user_id", "is", null)
    .not("hora", "is", null)
    .eq("ativo", true)
    .gte("data", hoje)
    .lte("data", amanha)
  for (const e of pessoais ?? []) add(e.user_id as string, e as EventoParaAlerta)

  const { data: comLembrete } = await supabase
    .from("calendario_lembretes")
    .select("user_id, evento:calendario_eventos!inner(id, titulo, data, hora, link, ativo)")
    .not("evento.hora", "is", null)
    .eq("evento.ativo", true)
    .gte("evento.data", hoje)
    .lte("evento.data", amanha)
  for (const l of (comLembrete ?? []) as unknown as Array<{ user_id: string; evento: EventoParaAlerta }>) {
    add(l.user_id, l.evento)
  }

  let enviados = 0
  let dispositivosLimpos = 0

  for (const { userId, ev } of pares.values()) {
    for (const disparo of ["antes15", "hora"] as Disparo[]) {
      const alvo = instanteAlvo(ev, disparo)
      if (alvo === null || !venceuAgora(alvo, agora)) continue

      // Reivindica o envio: só segue se a linha foi inserida agora (ignora
      // duplicatas = já disparado numa passada anterior do cron).
      const { data: claim } = await supabase
        .from("push_envios")
        .upsert(
          { user_id: userId, evento_id: ev.id, tipo_disparo: disparo },
          { onConflict: "evento_id,user_id,tipo_disparo", ignoreDuplicates: true }
        )
        .select("id")
      if (!claim || claim.length === 0) continue

      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", userId)

      const payload = textoPush(ev, disparo)
      for (const sub of subs ?? []) {
        const r = await enviarPush(sub, payload)
        if (r.ok) enviados++
        else if (r.expirada) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint)
          dispositivosLimpos++
        }
      }

      // Espelha no sininho dentro do app (notifications), pra quem não tinha o
      // push ligado ainda ver o lembrete ao abrir.
      await supabase.from("notifications").insert({
        user_id: userId,
        titulo: payload.titulo,
        mensagem: payload.mensagem,
        tipo: disparo === "hora" ? "alerta" : "info",
        link: payload.link,
      })
    }
  }

  // --- Avisos de "Actividades en la UNR" (antecedência escolhida pelo aluno) ---
  const { data: avisosRaw } = await supabase
    .from("atividades_avisos")
    .select("id, user_id, titulo, sala, data, hora, antecedencia_min")
    .is("enviado_em", null)
    .gte("data", hoje)
    .lte("data", amanha)
  const avisos = (avisosRaw ?? []) as AvisoAtividade[]

  for (const a of avisos) {
    const hhmm = a.hora.slice(0, 5)
    const base = new Date(`${a.data}T${hhmm}:00-03:00`).getTime()
    if (Number.isNaN(base)) continue
    const alvo = base - a.antecedencia_min * 60 * 1000
    if (!venceuAgora(alvo, agora)) continue

    // Reivindica: marca enviado_em só se ainda estava nulo (dedup + concorrência).
    const { data: claimed } = await supabase
      .from("atividades_avisos")
      .update({ enviado_em: new Date(agora).toISOString() })
      .eq("id", a.id)
      .is("enviado_em", null)
      .select("id")
    if (!claimed || claimed.length === 0) continue

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", a.user_id)

    const payload = textoAtividade(a)
    for (const sub of subs ?? []) {
      const r = await enviarPush(sub, payload)
      if (r.ok) enviados++
      else if (r.expirada) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint)
        dispositivosLimpos++
      }
    }
    await supabase.from("notifications").insert({
      user_id: a.user_id,
      titulo: payload.titulo,
      mensagem: payload.mensagem,
      tipo: "alerta",
      link: payload.link,
    })
  }

  return NextResponse.json({ ok: true, enviados, dispositivosLimpos, pares: pares.size, avisos: avisos.length })
}
