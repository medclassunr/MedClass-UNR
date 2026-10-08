// Motor da Prova Oral com IA -- orquestra: montar o contexto, chamar a
// Groq, validar a saída (zod + IDs de critério conhecidos), mesclar no
// estado acumulado do item, decidir avançar/complementar/concluir, e
// registrar o uso no ledger. O backend controla o avanço -- a IA só sugere.
//
// Usa sempre o client admin (service role) e valida posse manualmente
// (mesmo padrão de app/api/pagamentos/reivindicar) -- a RLS das tabelas
// oral_* continua como camada extra, não como único portão.

import { createAdminClient } from "@/lib/supabase-admin"
import { groqChatCompletionComFallback, GroqApiError, GroqNaoConfiguradoError, GroqRateLimitError } from "@/lib/groq"
import { SYSTEM_PROMPT, buildContextoTurno } from "@/lib/oral-prova/prompt"
import { AVALIACAO_JSON_SCHEMA, AvaliacaoRespostaSchema, type AvaliacaoResposta } from "@/lib/oral-prova/schema"
import { registrarUsoIA, verificarLimiteDiario } from "@/lib/oral-prova/usage"
import type { CriteriosDemonstradosMap, OralQuestionCriteria } from "@/lib/oral-prova/types"

export class OralProvaError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

const ORDEM_PRIORIDADE_STATUS: Record<string, number> = {
  not_assessed: 0,
  missing: 1,
  incorrect: 1,
  partial: 2,
  demonstrated: 3,
}

function mesclarCriterios(
  acumulado: CriteriosDemonstradosMap,
  novos: AvaliacaoResposta["criterios_avaliados"],
  idsValidos: Set<string>
): CriteriosDemonstradosMap {
  const resultado: CriteriosDemonstradosMap = { ...acumulado }
  for (const c of novos) {
    if (!idsValidos.has(c.criterion_id)) continue // ignora IDs que a IA inventou
    const prioridadeNova = ORDEM_PRIORIDADE_STATUS[c.status] ?? 0
    const atual = resultado[c.criterion_id]
    const prioridadeAtual = atual ? ORDEM_PRIORIDADE_STATUS[atual.status] ?? 0 : -1
    // nunca retrocede um critério já demonstrado por uma avaliação pior numa complementar diferente
    if (prioridadeNova >= prioridadeAtual) {
      resultado[c.criterion_id] = { status: c.status, evidence: c.evidence, confidence: c.confidence }
    }
  }
  return resultado
}

export function calcularNotaItem(criterios: OralQuestionCriteria[], demonstrados: CriteriosDemonstradosMap): number {
  let nota = 0
  for (const c of criterios) {
    const estado = demonstrados[c.criterio_codigo]
    const fator = estado?.status === "demonstrated" ? 1 : estado?.status === "partial" ? 0.5 : 0
    nota += c.peso * fator
  }
  return Math.round(nota * 100) / 100
}

// ============================================================
// Iniciar prova
// ============================================================
export async function iniciarProva(params: {
  userId: string
  modo: "entrenamiento" | "examen"
  disciplina: string
  tema: string
  maxComplementaresPorPergunta?: number
}) {
  const db = createAdminClient()

  const { data: perguntas, error: perguntasErr } = await db
    .from("oral_question_bank")
    .select("id, ordem, pergunta")
    .eq("disciplina", params.disciplina)
    .eq("tema", params.tema)
    .eq("status_revisao", "aprovado")
    .eq("ativo", true)
    .order("ordem", { ascending: true })

  if (perguntasErr || !perguntas || perguntas.length === 0) {
    throw new OralProvaError("SEM_PERGUNTAS", "Não há perguntas aprovadas para esse tema.", 404)
  }

  const maxComplementares = params.maxComplementaresPorPergunta ?? 2

  const { data: exam, error: examErr } = await db
    .from("oral_exams")
    .insert({
      user_id: params.userId,
      modo: params.modo,
      disciplina: params.disciplina,
      tema: params.tema,
      total_perguntas_principais: perguntas.length,
      max_complementares_por_pergunta: maxComplementares,
      status: "waiting_for_answer",
      pergunta_atual_index: 0,
      iniciado_em: new Date().toISOString(),
    })
    .select("*")
    .single()

  if (examErr || !exam) throw new OralProvaError("FALHA_CRIAR_PROVA", examErr?.message ?? "Falha ao criar a prova.", 500)

  const { data: item, error: itemErr } = await db
    .from("oral_exam_items")
    .insert({
      exam_id: exam.id,
      question_id: perguntas[0].id,
      ordem: 1,
      max_complementares: maxComplementares,
      status: "em_andamento",
    })
    .select("*")
    .single()

  if (itemErr || !item) throw new OralProvaError("FALHA_CRIAR_ITEM", itemErr?.message ?? "Falha ao criar a primeira pergunta.", 500)

  const { data: turn, error: turnErr } = await db
    .from("oral_exam_turns")
    .insert({
      exam_item_id: item.id,
      tipo: "principal",
      origem_pergunta: "banco",
      pergunta_texto: perguntas[0].pergunta,
    })
    .select("*")
    .single()

  if (turnErr || !turn) throw new OralProvaError("FALHA_CRIAR_TURNO", turnErr?.message ?? "Falha ao apresentar a primeira pergunta.", 500)

  return { exam, item, turn }
}

// ============================================================
// Avaliar resposta de um turno
// ============================================================
export interface ResultadoAvaliarTurno {
  avaliacao: AvaliacaoResposta
  itemConcluido: boolean
  notaItem: number | null
  provaFinalizada: boolean
  notaFinal: number | null
  proximoTurno: { id: string; tipo: "principal" | "complementar"; pergunta_texto: string; item_ordem: number } | null
}

export async function avaliarTurno(params: {
  userId: string
  examId: string
  examItemId: string
  respostaTexto: string
  modalidadeResposta: "texto" | "voz"
  // Transcrição bruta do Whisper, antes de qualquer edição do aluno -- só
  // preenchido quando modalidadeResposta é "voz" e o aluno corrigiu o
  // texto antes de enviar (auditoria, pedido explícito do prompt original).
  respostaTranscricaoOriginal?: string
  idempotencyKey?: string
}): Promise<ResultadoAvaliarTurno> {
  const db = createAdminClient()

  const { data: exam, error: examErr } = await db.from("oral_exams").select("*").eq("id", params.examId).single()
  if (examErr || !exam || exam.user_id !== params.userId) {
    throw new OralProvaError("PROVA_NAO_ENCONTRADA", "Prova não encontrada.", 404)
  }
  if (exam.status === "completed" || exam.status === "cancelled") {
    throw new OralProvaError("PROVA_JA_FINALIZADA", "Essa prova já foi finalizada.", 409)
  }

  const { data: item, error: itemErr } = await db
    .from("oral_exam_items")
    .select("*")
    .eq("id", params.examItemId)
    .eq("exam_id", params.examId)
    .single()
  if (itemErr || !item) throw new OralProvaError("ITEM_NAO_ENCONTRADO", "Pergunta não encontrada.", 404)
  if (item.status === "concluida") throw new OralProvaError("ITEM_JA_CONCLUIDO", "Essa pergunta já foi concluída.", 409)

  // Turno em aberto: o mais recente deste item ainda sem resposta.
  const { data: turnoAberto, error: turnoErr } = await db
    .from("oral_exam_turns")
    .select("*")
    .eq("exam_item_id", item.id)
    .is("resposta_texto", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (turnoErr || !turnoAberto) {
    throw new OralProvaError("SEM_TURNO_ABERTO", "Não há pergunta pendente de resposta para este item.", 409)
  }

  if (params.idempotencyKey) {
    const { data: duplicado } = await db
      .from("oral_exam_turns")
      .select("id")
      .eq("exam_item_id", item.id)
      .eq("idempotency_key", params.idempotencyKey)
      .not("id", "eq", turnoAberto.id)
      .maybeSingle()
    if (duplicado) throw new OralProvaError("RESPOSTA_DUPLICADA", "Essa resposta já foi processada.", 409)
  }

  const respostaTexto = params.respostaTexto.trim()
  if (!respostaTexto) throw new OralProvaError("RESPOSTA_VAZIA", "A resposta não pode estar vazia.", 400)

  const limite = await verificarLimiteDiario(params.userId)
  if (!limite.ok) throw new OralProvaError("LIMITE_ATINGIDO", limite.motivo ?? "Límite alcanzado.", 429)

  const [{ data: criterios }, { data: followups }, { data: turnosAnteriores }] = await Promise.all([
    db.from("oral_question_criteria").select("*").eq("question_id", item.question_id).order("ordem"),
    db.from("oral_question_followups").select("*").eq("question_id", item.question_id).order("ordem"),
    db
      .from("oral_exam_turns")
      .select("pergunta_texto, resposta_texto")
      .eq("exam_item_id", item.id)
      .not("resposta_texto", "is", null)
      .order("created_at", { ascending: true }),
  ])

  const listaCriterios: OralQuestionCriteria[] = criterios ?? []
  const listaFollowups = followups ?? []
  const idsValidos = new Set(listaCriterios.map((c) => c.criterio_codigo))
  const complementaresRestantes = item.max_complementares - item.num_complementares_usadas

  const followupsJaUsadosIds = new Set(
    (await db.from("oral_exam_turns").select("followup_id").eq("exam_item_id", item.id).not("followup_id", "is", null)).data?.map(
      (r) => r.followup_id as string
    ) ?? []
  )
  const followupsDisponiveis = listaFollowups.filter((f) => !followupsJaUsadosIds.has(f.id))

  const contexto = buildContextoTurno({
    modo: exam.modo,
    pergunta: turnoAberto.pergunta_texto,
    criterios: listaCriterios,
    criteriosJaAvaliados: item.criterios_demonstrados ?? {},
    followupsDisponiveis,
    historicoRespostasDaPergunta: (turnosAnteriores ?? []).map((t) => ({ pergunta: t.pergunta_texto, resposta: t.resposta_texto! })),
    respostaAtual: respostaTexto,
    complementaresRestantes,
  })

  const modelo = process.env.GROQ_MODEL ?? "openai/gpt-oss-20b"
  let avaliacao: AvaliacaoResposta
  let tokensEntrada = 0
  let tokensSaida = 0
  try {
    const resultadoGroq = await groqChatCompletionComFallback({
      model: modelo,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: contexto },
      ],
      jsonSchema: AVALIACAO_JSON_SCHEMA,
      temperature: 0.2,
      reasoningEffort: "low",
    })
    tokensEntrada = resultadoGroq.usage?.tokensEntrada ?? 0
    tokensSaida = resultadoGroq.usage?.tokensSaida ?? 0

    const parseado = JSON.parse(resultadoGroq.content)
    const validado = AvaliacaoRespostaSchema.safeParse(parseado)
    if (!validado.success) {
      await registrarUsoIA({
        examId: exam.id,
        userId: params.userId,
        tipoChamada: "avaliacao",
        modelo,
        tokensEntrada,
        tokensSaida,
        erro: "JSON fora do schema esperado",
      })
      throw new OralProvaError("RESPOSTA_IA_INVALIDA", "A IA retornou uma avaliação em formato inesperado. Tenta de novo.", 502)
    }
    avaliacao = validado.data

    await registrarUsoIA({ examId: exam.id, userId: params.userId, tipoChamada: "avaliacao", modelo, tokensEntrada, tokensSaida })
  } catch (erro) {
    if (erro instanceof OralProvaError) throw erro
    if (erro instanceof GroqNaoConfiguradoError) {
      throw new OralProvaError("GROQ_NAO_CONFIGURADO", "A chave da Groq ainda não foi configurada no servidor.", 503)
    }
    if (erro instanceof GroqRateLimitError) {
      await registrarUsoIA({ examId: exam.id, userId: params.userId, tipoChamada: "avaliacao", modelo, erro: "429 rate limit" })
      throw new OralProvaError(
        "GROQ_RATE_LIMIT",
        `La IA está con mucha demanda ahora mismo. Probá de nuevo${erro.retryAfterSeconds ? ` en ${erro.retryAfterSeconds}s` : " en un momento"}.`,
        429
      )
    }
    if (erro instanceof GroqApiError) {
      await registrarUsoIA({ examId: exam.id, userId: params.userId, tipoChamada: "avaliacao", modelo, erro: `HTTP ${erro.status}` })
      throw new OralProvaError("GROQ_ERRO", "Falha ao contatar la IA. Tu respuesta fue guardada -- probá de nuevo.", 502)
    }
    throw erro
  }

  // A resposta do aluno fica salva ANTES de qualquer decisão de avanço --
  // se algo falhar depois disso, a resposta não se perde.
  await db
    .from("oral_exam_turns")
    .update({
      resposta_texto: respostaTexto,
      resposta_transcricao_original: params.respostaTranscricaoOriginal ?? null,
      modalidade_resposta: params.modalidadeResposta,
      avaliacao: avaliacao as unknown as Record<string, unknown>,
      idempotency_key: params.idempotencyKey ?? null,
    })
    .eq("id", turnoAberto.id)

  const criteriosAtualizados = mesclarCriterios(item.criterios_demonstrados ?? {}, avaliacao.criterios_avaliados, idsValidos)
  const todosResolvidos = listaCriterios.every((c) => {
    const estado = criteriosAtualizados[c.criterio_codigo]
    return !!estado && estado.status !== "not_assessed"
  })

  const querComplementar = avaliacao.suggested_follow_up.needed && complementaresRestantes > 0 && !todosResolvidos

  if (querComplementar) {
    const followupEscolhido = avaliacao.suggested_follow_up.use_bank_followup_id
      ? followupsDisponiveis.find((f) => f.id === avaliacao.suggested_follow_up.use_bank_followup_id)
      : null

    const perguntaTexto = followupEscolhido?.pergunta ?? avaliacao.suggested_follow_up.question_text

    if (perguntaTexto) {
      await db
        .from("oral_exam_items")
        .update({
          criterios_demonstrados: criteriosAtualizados,
          num_complementares_usadas: item.num_complementares_usadas + 1,
        })
        .eq("id", item.id)

      const { data: novoTurno } = await db
        .from("oral_exam_turns")
        .insert({
          exam_item_id: item.id,
          tipo: "complementar",
          followup_id: followupEscolhido?.id ?? null,
          origem_pergunta: followupEscolhido ? "banco" : "ia",
          pergunta_texto: perguntaTexto,
        })
        .select("*")
        .single()

      await db.from("oral_exams").update({ status: "waiting_for_answer" }).eq("id", exam.id)

      return {
        avaliacao,
        itemConcluido: false,
        notaItem: null,
        provaFinalizada: false,
        notaFinal: null,
        proximoTurno: novoTurno
          ? { id: novoTurno.id, tipo: "complementar", pergunta_texto: novoTurno.pergunta_texto, item_ordem: item.ordem }
          : null,
      }
    }
    // IA pediu complementar mas não deu id válido nem texto -- trata como concluído (cai no bloco abaixo).
  }

  // Concluir o item: calcular nota, salvar score, avançar ou finalizar.
  const notaItem = calcularNotaItem(listaCriterios, criteriosAtualizados)

  await db
    .from("oral_exam_items")
    .update({ criterios_demonstrados: criteriosAtualizados, status: "concluida", nota: notaItem })
    .eq("id", item.id)

  await db.from("oral_exam_scores").insert({
    exam_id: exam.id,
    exam_item_id: item.id,
    nota: notaItem,
    criterios: criteriosAtualizados,
    erros_clinicos: avaliacao.clinical_error_flags,
  })

  const proximaOrdem = item.ordem + 1
  if (proximaOrdem > exam.total_perguntas_principais) {
    const { data: todosScores } = await db.from("oral_exam_scores").select("nota").eq("exam_id", exam.id)
    const notaFinal = todosScores && todosScores.length > 0 ? Math.round((todosScores.reduce((s, r) => s + r.nota, 0) / todosScores.length) * 100) / 100 : notaItem

    await db
      .from("oral_exams")
      .update({ status: "completed", nota_final: notaFinal, finalizado_em: new Date().toISOString() })
      .eq("id", exam.id)

    return { avaliacao, itemConcluido: true, notaItem, provaFinalizada: true, notaFinal, proximoTurno: null }
  }

  const { data: proximaPergunta } = await db
    .from("oral_question_bank")
    .select("id, pergunta")
    .eq("disciplina", exam.disciplina)
    .eq("tema", exam.tema)
    .eq("status_revisao", "aprovado")
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .range(proximaOrdem - 1, proximaOrdem - 1)
    .maybeSingle()

  if (!proximaPergunta) {
    throw new OralProvaError("PROXIMA_PERGUNTA_NAO_ENCONTRADA", "Não foi possível localizar a próxima pergunta.", 500)
  }

  const { data: proximoItem } = await db
    .from("oral_exam_items")
    .insert({
      exam_id: exam.id,
      question_id: proximaPergunta.id,
      ordem: proximaOrdem,
      max_complementares: exam.max_complementares_por_pergunta,
      status: "em_andamento",
    })
    .select("*")
    .single()

  const { data: novoTurno } = await db
    .from("oral_exam_turns")
    .insert({
      exam_item_id: proximoItem!.id,
      tipo: "principal",
      origem_pergunta: "banco",
      pergunta_texto: proximaPergunta.pergunta,
    })
    .select("*")
    .single()

  await db.from("oral_exams").update({ status: "waiting_for_answer", pergunta_atual_index: proximaOrdem - 1 }).eq("id", exam.id)

  return {
    avaliacao,
    itemConcluido: true,
    notaItem,
    provaFinalizada: false,
    notaFinal: null,
    proximoTurno: novoTurno
      ? { id: novoTurno.id, tipo: "principal", pergunta_texto: novoTurno.pergunta_texto, item_ordem: proximaOrdem }
      : null,
  }
}

// ============================================================
// Finalizar manualmente (botão "Finalizar prova")
// ============================================================
// Questões ainda não apresentadas nunca existem como linha em
// oral_exam_items (são criadas só quando viram o item ativo), então já
// ficam naturalmente de fora do cálculo -- só a pergunta EM ANDAMENTO (se
// tiver uma resposta pendente) é fechada com nota 0 pros critérios ainda
// não demonstrados, conforme a regra "questão apresentada sem resposta
// recebe zero; questão não apresentada não conta".
export async function finalizarProvaManualmente(examId: string, userId: string) {
  const db = createAdminClient()

  const { data: exam } = await db.from("oral_exams").select("*").eq("id", examId).single()
  if (!exam || exam.user_id !== userId) throw new OralProvaError("PROVA_NAO_ENCONTRADA", "Prova não encontrada.", 404)
  if (exam.status === "completed" || exam.status === "cancelled") return exam

  const { data: itemAberto } = await db
    .from("oral_exam_items")
    .select("*")
    .eq("exam_id", examId)
    .eq("status", "em_andamento")
    .maybeSingle()

  if (itemAberto) {
    const { data: criterios } = await db.from("oral_question_criteria").select("*").eq("question_id", itemAberto.question_id)
    const notaItem = calcularNotaItem(criterios ?? [], itemAberto.criterios_demonstrados ?? {})
    await db.from("oral_exam_items").update({ status: "concluida", nota: notaItem }).eq("id", itemAberto.id)
    await db.from("oral_exam_scores").insert({
      exam_id: examId,
      exam_item_id: itemAberto.id,
      nota: notaItem,
      criterios: itemAberto.criterios_demonstrados ?? {},
      erros_clinicos: [],
    })
  }

  const { data: scores } = await db.from("oral_exam_scores").select("nota").eq("exam_id", examId)
  const notaFinal =
    scores && scores.length > 0 ? Math.round((scores.reduce((s, r) => s + r.nota, 0) / scores.length) * 100) / 100 : 0

  const { data: atualizado } = await db
    .from("oral_exams")
    .update({ status: "completed", nota_final: notaFinal, finalizado_em: new Date().toISOString() })
    .eq("id", examId)
    .select("*")
    .single()

  return atualizado
}
