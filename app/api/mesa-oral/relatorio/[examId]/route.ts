import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/require-admin"
import { createAdminClient } from "@/lib/supabase-admin"

// O gabarito (resposta_padrao) só é incluído aqui, nunca nos endpoints de
// iniciar/responder -- e só quando a prova já está "completed".
export async function GET(request: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 403 })

  const { examId } = await params
  const db = createAdminClient()

  const { data: exam } = await db.from("oral_exams").select("*").eq("id", examId).single()
  if (!exam || exam.user_id !== admin.id) return NextResponse.json({ error: "Prova não encontrada." }, { status: 404 })
  if (exam.status !== "completed") {
    return NextResponse.json({ error: "O relatório só fica disponível depois de a prova ser finalizada." }, { status: 409 })
  }

  const { data: items } = await db.from("oral_exam_items").select("*").eq("exam_id", examId).order("ordem")
  const { data: scores } = await db.from("oral_exam_scores").select("*").eq("exam_id", examId)
  const { data: questoes } = await db
    .from("oral_question_bank")
    .select("id, pergunta, resposta_padrao")
    .in("id", (items ?? []).map((i) => i.question_id))
  const { data: turns } = await db
    .from("oral_exam_turns")
    .select("exam_item_id, tipo")
    .in("exam_item_id", (items ?? []).map((i) => i.id))

  const questaoPorId = new Map((questoes ?? []).map((q) => [q.id, q]))
  const scorePorItem = new Map((scores ?? []).map((s) => [s.exam_item_id, s]))

  const perguntas = (items ?? []).map((item) => {
    const questao = questaoPorId.get(item.question_id)
    const score = scorePorItem.get(item.id)
    const turnosDoItem = (turns ?? []).filter((t) => t.exam_item_id === item.id)
    const criterios = (score?.criterios ?? item.criterios_demonstrados ?? {}) as Record<
      string,
      { status: string; evidence: string }
    >
    const totalCriterios = Object.keys(criterios).length
    const demonstrados = Object.values(criterios).filter((c) => c.status === "demonstrated").length

    return {
      ordem: item.ordem,
      pergunta: questao?.pergunta ?? "",
      respuestaEsperada: questao?.resposta_padrao ?? "",
      nota: item.nota,
      criterios,
      percentualCriteriosDemonstrados: totalCriterios > 0 ? Math.round((demonstrados / totalCriterios) * 100) : 0,
      erroClinicos: score?.erros_clinicos ?? [],
      numComplementares: turnosDoItem.filter((t) => t.tipo === "complementar").length,
    }
  })

  const tempoUtilizadoSegundos =
    exam.iniciado_em && exam.finalizado_em
      ? Math.round((new Date(exam.finalizado_em).getTime() - new Date(exam.iniciado_em).getTime()) / 1000)
      : null

  return NextResponse.json({
    exam: {
      id: exam.id,
      modo: exam.modo,
      disciplina: exam.disciplina,
      tema: exam.tema,
      notaFinal: exam.nota_final,
      totalPerguntasPrincipais: exam.total_perguntas_principais,
      iniciadoEm: exam.iniciado_em,
      finalizadoEm: exam.finalizado_em,
      tempoUtilizadoSegundos,
    },
    perguntas,
  })
}
