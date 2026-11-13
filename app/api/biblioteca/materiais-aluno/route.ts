import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase-admin"
import { requireUser } from "@/lib/require-user"
import {
  criarPastaDrive,
  enviarArquivoDrive,
  apagarArquivoDrive,
  DriveOAuthError,
} from "@/lib/google-drive-oauth"

// Upload de material PELO ALUNO. O arquivo vai pro Drive do admin (conexão
// OAuth, escopo drive.file), dentro de "Materiais dos Alunos" / "Nome (email)".
// Cada aluno só mexe nos próprios arquivos.

const LIMITE_BYTES = 50 * 1024 * 1024 // 50 MB por arquivo
const NOME_PASTA_MAE = "Materiais dos Alunos"

// Garante a pasta-mãe (1 só, criada pela plataforma) e devolve o id.
async function garantirPastaMae(admin: ReturnType<typeof createAdminClient>): Promise<string> {
  const { data } = await admin.from("drive_oauth").select("materiais_folder_id").eq("id", 1).maybeSingle()
  const existente = data?.materiais_folder_id as string | undefined
  if (existente) return existente
  const folderId = await criarPastaDrive(NOME_PASTA_MAE)
  await admin.from("drive_oauth").update({ materiais_folder_id: folderId }).eq("id", 1)
  return folderId
}

// Garante a subpasta do aluno dentro da pasta-mãe e devolve o id.
async function garantirPastaAluno(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  nomePasta: string,
  paiId: string
): Promise<string> {
  const { data } = await admin
    .from("aluno_materiais_pasta")
    .select("drive_folder_id")
    .eq("user_id", userId)
    .maybeSingle()
  const existente = data?.drive_folder_id as string | undefined
  if (existente) return existente
  const folderId = await criarPastaDrive(nomePasta, paiId)
  await admin
    .from("aluno_materiais_pasta")
    .upsert({ user_id: userId, drive_folder_id: folderId, nome: nomePasta })
  return folderId
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request)
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 })
  }
  const arquivo = form.get("arquivo")
  const titulo = (form.get("titulo") as string | null)?.trim() || null
  if (!(arquivo instanceof File)) return NextResponse.json({ error: "Escolha um arquivo." }, { status: 400 })
  if (arquivo.size === 0) return NextResponse.json({ error: "O arquivo está vazio." }, { status: 400 })
  if (arquivo.size > LIMITE_BYTES) {
    return NextResponse.json({ error: "O arquivo é maior que o limite de 50 MB." }, { status: 400 })
  }

  const admin = createAdminClient()

  // nome da pasta do aluno = "Nome (email)" (ver escolha do admin). O
  // full_name vem do perfil; email vem da conta de auth.
  const { data: perfil } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle()
  const nome = (perfil?.full_name as string | undefined)?.trim() || null
  const email = user.email ?? null
  const nomePasta = nome ? `${nome} (${email ?? "sem email"})` : email ?? "Aluno"

  try {
    const paiId = await garantirPastaMae(admin)
    const pastaAluno = await garantirPastaAluno(admin, user.id, nomePasta, paiId)

    const bytes = await arquivo.arrayBuffer()
    const enviado = await enviarArquivoDrive(
      pastaAluno,
      arquivo.name,
      arquivo.type || "application/octet-stream",
      bytes
    )

    const { data: row, error } = await admin
      .from("aluno_materiais")
      .insert({
        user_id: user.id,
        titulo,
        nome_arquivo: arquivo.name,
        drive_file_id: enviado.id,
        mime_type: arquivo.type || null,
        tamanho_bytes: arquivo.size,
      })
      .select("id, titulo, nome_arquivo, drive_file_id, tamanho_bytes, criado_em")
      .single()

    if (error) {
      // registro falhou -> remove o arquivo órfão do Drive
      await apagarArquivoDrive(enviado.id).catch(() => {})
      return NextResponse.json({ error: "Falha ao registrar o material." }, { status: 500 })
    }

    return NextResponse.json({ material: row })
  } catch (erro) {
    if (erro instanceof DriveOAuthError) {
      const msg =
        erro.status === 409
          ? "O envio de materiais ainda não está disponível. (O administrador precisa conectar o Google Drive.)"
          : erro.message
      return NextResponse.json({ error: msg }, { status: erro.status })
    }
    console.error("[materiais-aluno/POST]", erro)
    return NextResponse.json({ error: "Erro ao enviar o material." }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await requireUser(request)
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id faltando" }, { status: 400 })

  const admin = createAdminClient()
  // só o dono pode apagar (confere user_id antes de tocar no Drive)
  const { data: row } = await admin
    .from("aluno_materiais")
    .select("id, drive_file_id, user_id")
    .eq("id", id)
    .maybeSingle()
  if (!row || row.user_id !== user.id) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  }

  try {
    await apagarArquivoDrive(row.drive_file_id as string)
  } catch (erro) {
    if (!(erro instanceof DriveOAuthError)) console.error("[materiais-aluno/DELETE]", erro)
    // segue mesmo se o Drive falhar -- some do app de qualquer jeito
  }
  await admin.from("aluno_materiais").delete().eq("id", id)
  return NextResponse.json({ ok: true })
}
