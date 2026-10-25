import { supabase } from "@/lib/supabase"

// Helpers do lado do navegador pra ligar/desligar o push real no celular.

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""

export type EstadoPush = "nao-suportado" | "negado" | "ativo" | "inativo"

function suportado(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
}

// A applicationServerKey precisa ser um Uint8Array -- converte a chave VAPID
// pública (base64url) pro formato que o PushManager espera.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!suportado()) return null
  try {
    return (await navigator.serviceWorker.ready) ?? null
  } catch {
    return null
  }
}

async function tokenAuth(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

/** Estado atual do push neste dispositivo (pra pintar o botão na UI). */
export async function estadoPush(): Promise<EstadoPush> {
  if (!suportado() || !VAPID_PUBLIC) return "nao-suportado"
  if (Notification.permission === "denied") return "negado"
  const reg = await getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub ? "ativo" : "inativo"
}

/** Pede permissão, assina e salva no servidor. Devolve o novo estado. */
export async function ativarPush(): Promise<EstadoPush> {
  if (!suportado() || !VAPID_PUBLIC) return "nao-suportado"

  const permissao = await Notification.requestPermission()
  if (permissao !== "granted") return permissao === "denied" ? "negado" : "inativo"

  const reg = await getRegistration()
  if (!reg) return "nao-suportado"

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    }))

  const token = await tokenAuth()
  if (!token) return "inativo"

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(sub.toJSON()),
  })
  return res.ok ? "ativo" : "inativo"
}

/** Cancela a assinatura neste dispositivo e remove do servidor. */
export async function desativarPush(): Promise<EstadoPush> {
  const reg = await getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    const token = await tokenAuth()
    if (token) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {})
    }
    await sub.unsubscribe().catch(() => {})
  }
  return "inativo"
}
