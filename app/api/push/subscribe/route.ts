import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { requireUser } from "@/lib/require-user"

// web-push usa crypto do Node -- força runtime Node (não edge).
export const runtime = "nodejs"

// POST: salva (ou atualiza) a inscrição de push deste dispositivo.
// Body: { endpoint, keys: { p256dh, auth } }
export async function POST(request: NextRequest) {
  const user = await requireUser(request)
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : ""
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : ""
  const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : ""
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 })
  }

  const supabase = createAdminClient()
  // endpoint é único: se o mesmo dispositivo reassinar, atualiza as chaves e o
  // dono (um aparelho compartilhado passa a pertencer a quem assinou por último).
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: request.headers.get("user-agent"),
    },
    { onConflict: "endpoint" }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE: remove a inscrição deste dispositivo (aluno desligou os alertas).
// Body: { endpoint }
export async function DELETE(request: NextRequest) {
  const user = await requireUser(request)
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : ""
  if (!endpoint) return NextResponse.json({ error: "Endpoint ausente." }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
