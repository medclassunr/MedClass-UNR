// JSON Schema (enviado pra Groq via response_format strict) + o espelho em
// zod (validação no backend -- nunca confiar cegamente na saída da IA,
// conforme seção 7.4 do prompt original: "O backend deverá validar a
// estrutura e garantir que somente IDs de critérios existentes sejam
// aceitos").

import { z } from "zod"

export const CRITERIO_STATUS_VALUES = ["demonstrated", "partial", "missing", "incorrect", "not_assessed"] as const

export const AVALIACAO_JSON_SCHEMA = {
  name: "avaliacao_resposta_oral",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      criterios_avaliados: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            criterion_id: { type: "string" },
            status: { type: "string", enum: CRITERIO_STATUS_VALUES as unknown as string[] },
            evidence: { type: "string" },
            confidence: { type: "number" },
          },
          required: ["criterion_id", "status", "evidence", "confidence"],
        },
      },
      clinical_error_flags: { type: "array", items: { type: "string" } },
      suggested_follow_up: {
        type: "object",
        additionalProperties: false,
        properties: {
          needed: { type: "boolean" },
          use_bank_followup_id: { type: ["string", "null"] },
          question_text: { type: ["string", "null"] },
          follow_up_target_criteria: { type: "array", items: { type: "string" } },
        },
        required: ["needed", "use_bank_followup_id", "question_text", "follow_up_target_criteria"],
      },
      internal_feedback: { type: "string" },
    },
    required: ["criterios_avaliados", "clinical_error_flags", "suggested_follow_up", "internal_feedback"],
  },
} as const

export const CriterioAvaliadoSchema = z.object({
  criterion_id: z.string(),
  status: z.enum(CRITERIO_STATUS_VALUES),
  evidence: z.string(),
  confidence: z.number().min(0).max(1),
})

export const AvaliacaoRespostaSchema = z.object({
  criterios_avaliados: z.array(CriterioAvaliadoSchema),
  clinical_error_flags: z.array(z.string()),
  suggested_follow_up: z.object({
    needed: z.boolean(),
    use_bank_followup_id: z.string().nullable(),
    question_text: z.string().nullable(),
    follow_up_target_criteria: z.array(z.string()),
  }),
  internal_feedback: z.string(),
})

export type AvaliacaoResposta = z.infer<typeof AvaliacaoRespostaSchema>
export type CriterioAvaliado = z.infer<typeof CriterioAvaliadoSchema>
