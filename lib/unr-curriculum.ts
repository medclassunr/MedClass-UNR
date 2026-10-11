// Estrutura curricular da UNR (chaves canônicas — o que fica salvo no banco).
// Rótulos de exibição por idioma vivem em lib/i18n.tsx (t.cronograma.anoLabel/materiaLabel/parcialLabel).

export const ANO_KEYS = ["ano1", "ano2", "ano3", "ano4", "ano5"] as const
export type AnoKey = (typeof ANO_KEYS)[number]

export const MATERIA_KEYS_BY_ANO: Record<AnoKey, string[]> = {
  ano1: ["crescimento_desenvolvimento", "nutricao"],
  ano2: ["sexualidade_genero_reproducao", "trabalho_tempo_livre", "ser_humano_meio"],
  ano3: ["injuria", "defesa"],
  ano4: ["clinica_medica_4", "pediatria_4", "oftalmologia", "otorrinolaringologia", "farmacologia", "ginecologia_obstetricia", "urologia"],
  ano5: ["cirurgia_5", "pediatria_5", "clinica_medica_5", "medicina_legal"],
}

export const PARCIAL_KEYS = ["parcial1", "parcial2"] as const
export type ParcialKey = (typeof PARCIAL_KEYS)[number]

// Matérias do 4º ano que só têm um parcial (cursam em bloco único, não dividem
// o conteúdo em dois parciais como as demais matérias da grade).
const MATERIAS_APENAS_PARCIAL1 = ["oftalmologia", "otorrinolaringologia"]

export function parciaisDaMateria(materiaKey: string): readonly ParcialKey[] {
  return MATERIAS_APENAS_PARCIAL1.includes(materiaKey) ? (["parcial1"] as const) : PARCIAL_KEYS
}

// Ciências básicas — lista fixa e global, não depende do módulo/ano.
// Rótulos de exibição em lib/i18n.tsx (t.cronograma.disciplinaBaseLabel).
export const DISCIPLINA_BASE_KEYS = [
  "anatomia",
  "histologia",
  "embriologia",
  "fisiologia",
  "bioquimica",
  "biofisica",
  "genetica",
  "imunologia",
  "microbiologia",
  "parasitologia",
  "patologia",
  "farmacologia_base",
] as const
export type DisciplinaBaseKey = (typeof DISCIPLINA_BASE_KEYS)[number]

export function anoDaMateria(materiaKey: string): AnoKey | undefined {
  return (Object.keys(MATERIA_KEYS_BY_ANO) as AnoKey[]).find((ano) =>
    MATERIA_KEYS_BY_ANO[ano].includes(materiaKey)
  )
}
