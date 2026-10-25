import "server-only"
import webpush from "web-push"

// Configuração do Web Push (VAPID). As chaves vêm das envs -- a pública também
// é exposta ao cliente via NEXT_PUBLIC_VAPID_PUBLIC_KEY (precisa dela pra
// assinar), a privada NUNCA sai do servidor. Ver .env.example.
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const privateKey = process.env.VAPID_PRIVATE_KEY
const subject = process.env.VAPID_SUBJECT || "mailto:medclassunr@gmail.com"

let configurado = false
export function pushConfigurado(): boolean {
  if (configurado) return true
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configurado = true
  return true
}

export interface PushPayload {
  titulo: string
  mensagem: string
  link?: string | null
  tag?: string
}

export interface AssinaturaWebPush {
  endpoint: string
  p256dh: string
  auth: string
}

export type ResultadoEnvio = { ok: true } | { ok: false; expirada: boolean }

/** Envia um push para UM dispositivo. `expirada` = assinatura morta (410/404),
 *  o chamador deve apagá-la do banco. */
export async function enviarPush(
  assinatura: AssinaturaWebPush,
  payload: PushPayload
): Promise<ResultadoEnvio> {
  if (!pushConfigurado()) return { ok: false, expirada: false }
  try {
    await webpush.sendNotification(
      {
        endpoint: assinatura.endpoint,
        keys: { p256dh: assinatura.p256dh, auth: assinatura.auth },
      },
      JSON.stringify(payload)
    )
    return { ok: true }
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode
    return { ok: false, expirada: status === 404 || status === 410 }
  }
}
