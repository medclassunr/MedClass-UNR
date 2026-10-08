// Tipos compartilhados do módulo Prova Oral com IA. Espelham as tabelas
// oral_* (ver supabase/migrations/20261008120000_prova_oral_ia.sql).

import type { AvaliacaoResposta } from "@/lib/oral-prova/schema"

export type OralExamModo = "entrenamiento" | "examen"

export type OralExamStatus =
  | "not_started"
  | "question_presented"
  | "waiting_for_answer"
  | "evaluating"
  | "follow_up_pending"
  | "question_completed"
  | "completed"
  | "paused"
  | "failed"
  | "cancelled"

export type CriterioStatus = "demonstrated" | "partial" | "missing" | "incorrect" | "not_assessed"

export interface OralQuestionCriteria {
  id: string
  question_id: string
  criterio_codigo: string
  descricao: string
  peso: number
  conceitos_equivalentes: string[]
  ordem: number
}

export interface OralQuestionFollowup {
  id: string
  question_id: string
  codigo: string
  condicao: string
  pergunta: string
  resposta_esperada: string
  criterios_alvo: string[]
  ordem: number
}

export interface OralQuestionBank {
  id: string
  disciplina: string
  tema: string
  nivel: string | null
  ordem: number
  pergunta: string
  resposta_padrao: string
  fontes: string[]
  status_revisao: "rascunho" | "aprovado"
  ativo: boolean
}

export interface OralExam {
  id: string
  user_id: string
  modo: OralExamModo
  disciplina: string
  tema: string
  total_perguntas_principais: number
  max_complementares_por_pergunta: number
  status: OralExamStatus
  pergunta_atual_index: number
  nota_final: number | null
}

export interface CriterioDemonstradoEstado {
  status: CriterioStatus
  evidence: string
  confidence: number
}

// Acumulado por pergunta principal (oral_exam_items.criterios_demonstrados) --
// chave = criterio_codigo.
export type CriteriosDemonstradosMap = Record<string, CriterioDemonstradoEstado>

export interface OralExamItem {
  id: string
  exam_id: string
  question_id: string
  ordem: number
  max_complementares: number
  num_complementares_usadas: number
  status: "pendente" | "em_andamento" | "concluida"
  criterios_demonstrados: CriteriosDemonstradosMap
  nota: number | null
}

export interface OralExamTurn {
  id: string
  exam_item_id: string
  tipo: "principal" | "complementar"
  followup_id: string | null
  origem_pergunta: "banco" | "ia"
  pergunta_texto: string
  resposta_texto: string | null
  resposta_transcricao_original: string | null
  modalidade_resposta: "texto" | "voz" | null
  avaliacao: AvaliacaoResposta | null
  idempotency_key: string | null
}
