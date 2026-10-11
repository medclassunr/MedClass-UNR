// Importa os 14 lotes de questoes de Medicina Legal (5o ano) de
// ~/Downloads/lote_01_*.json .. lote_14_*.json.
//
// Correcoes aplicadas na fonte (confirmadas por auditoria antes de
// importar, ver conversa):
// - metadados.materia ignorado por completo -- todas viram
//   materia = "medicina_legal", mesmo as que vieram rotuladas
//   "Clínica Médica do 5º ano" (lotes 01-04 e 14, erro de geracao).
// - feedback da alternativa correta nos lotes 05-13 comecava com
//   "CORRETO." (portugues) em vez de "Correcto." (espanhol) -- unica
//   palavra errada, resto do texto ja em espanhol. Corrigido na
//   importacao.
// - disciplina_base normalizado pra snake_case sem acento (ex:
//   "Tanatología Forense" -> "tanatologia_forense"), mantendo o valor
//   livre -- o banco ja tem disciplina_base fora da lista fixa de
//   ciencias basicas (ex: "hematologia", "neurologia", "pediatria"),
//   entao nao ha necessidade de forcar null nesses casos.
// - dificuldade normalizado pra minusculo (Médio/Difícil/Fácil ->
//   médio/difícil/fácil), igual ao padrao ja existente no banco.
//
// Insere com ativo=false. Depois, rodar o gate de validacao:
//   node scripts-tmp/scripts-tmp-gate-importacao.mjs --ids-file scripts-tmp/lote-medicina-legal-ids.json
//
// Uso: node scripts-tmp/scripts-tmp-importar-medicina-legal.mjs [--dry-run]
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync } from "fs"

const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf-8")
const env = Object.fromEntries(
  envFile.split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => {
    const i = l.indexOf("=")
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
  })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const HOME = process.env.HOME
const DRY_RUN = process.argv.includes("--dry-run")

const ARQUIVOS = [
  "lote_01_delitos_integridad_sexual.json",
  "lote_02_certificados_medicos_y_defuncion.json",
  "lote_03_traumatologia_legal_y_lesiones.json",
  "lote_04_violencia_familiar_y_maltrato.json",
  "lote_05_autopsias_y_dictamen_pericial.json",
  "lote_06_codigo_etica_y_regulacion_profesional.json",
  "lote_07_lugar_hecho_tanatologia_asfixias.json",
  "lote_08_secreto_medico.json",
  "lote_09_ejercicio_legal_e_ilegal.json",
  "lote_10_derechos_paciente_consentimiento.json",
  "lote_11_psiquiatria_forense_salud_mental.json",
  "lote_12_responsabilidad_medica_profesional.json",
  "lote_13_toxicologia_legal_y_forense.json",
  "lote_14_documentales_medicas_historia_clinica.json",
]

function normalizarParcial(valor) {
  const v = (valor || "").toLowerCase()
  return v.includes("segundo") ? "parcial2" : "parcial1"
}

function normalizarDificuldade(valor) {
  return (valor || "").toLowerCase() || null
}

function normalizarDisciplina(valor) {
  if (!valor) return null
  return valor
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim().replace(/\s+/g, "_")
}

function corrigirVereditoPt(texto) {
  return (texto || "").replace(/^CORRETO\./, "Correcto.")
}

function mapQuestao(raw, arquivo, tema) {
  const m = raw.metadados || {}
  const alt = raw.alternativas || {}
  const fb = raw.feedbacks || {}
  const letras = Object.keys(alt).sort()

  const opcoes = letras.map((l) => alt[l])
  const opcoes_comentario = letras.map((l) => corrigirVereditoPt(fb[l]))
  const indice_correta = letras.indexOf(raw.resposta_correta)

  return {
    enunciado: (raw.enunciado || "").trim(),
    materia: "medicina_legal",
    dificuldade: normalizarDificuldade(m.dificuldade),
    disciplina_base: normalizarDisciplina(m.disciplina_base),
    tags: Array.isArray(m.tags) ? m.tags : [],
    opcoes,
    indice_correta,
    opcoes_comentario,
    parcial: normalizarParcial(m.parcial),
    ativo: false,
    _arquivo: arquivo,
    _tema: tema,
    _numero: raw.numero,
  }
}

const todas = []
for (const arquivo of ARQUIVOS) {
  const data = JSON.parse(readFileSync(`${HOME}/Downloads/${arquivo}`, "utf-8"))
  if (data.quantidade_questoes !== data.questoes.length) {
    console.error(`[${arquivo}] quantidade_questoes (${data.quantidade_questoes}) != questoes.length (${data.questoes.length}) -- abortando.`)
    process.exit(1)
  }
  for (const raw of data.questoes) {
    todas.push(mapQuestao(raw, arquivo, data.tema))
  }
}

console.log(`Lidas ${todas.length} questoes de ${ARQUIVOS.length} lotes.`)

// valida estrutura antes de importar
const problemas = []
for (const q of todas) {
  const id = `${q._arquivo} Q${q._numero}`
  if (!q.enunciado) problemas.push([id, "enunciado vazio"])
  if (!Array.isArray(q.opcoes) || q.opcoes.length < 2) problemas.push([id, "opcoes invalidas"])
  if (q.opcoes.some((o) => !o || !o.trim())) problemas.push([id, "alternativa vazia"])
  if (q.indice_correta < 0) problemas.push([id, "indice_correta invalido (resposta_correta nao bate com nenhuma alternativa)"])
  if (q.opcoes.length !== q.opcoes_comentario.length) problemas.push([id, "opcoes/comentarios desalinhados"])
  if (q.opcoes_comentario.some((o) => !o || !o.trim())) problemas.push([id, "feedback vazio"])
}
if (problemas.length > 0) {
  console.error(`Problemas estruturais encontrados (${problemas.length}), abortando:`)
  for (const p of problemas.slice(0, 20)) console.error(" ", p)
  process.exit(1)
}

// dedup interno por materia+enunciado+opcoes
const vistos = new Set()
const unicas = []
let dupInterna = 0
for (const q of todas) {
  const chave = `${q.materia}|${q.enunciado}|${q.opcoes.join("~")}`
  if (vistos.has(chave)) { dupInterna++; continue }
  vistos.add(chave)
  unicas.push(q)
}
console.log(`Duplicadas internamente: ${dupInterna}`)

// dedup contra o banco
const { data: existentes, error: errExistentes } = await supabase
  .from("questoes").select("enunciado, opcoes").eq("materia", "medicina_legal")
if (errExistentes) { console.error("Erro ao checar existentes:", errExistentes.message); process.exit(1) }

const chavesExistentes = new Set((existentes ?? []).map((e) => `medicina_legal|${e.enunciado}|${(e.opcoes ?? []).join("~")}`))
const novas = unicas.filter((q) => !chavesExistentes.has(`${q.materia}|${q.enunciado}|${q.opcoes.join("~")}`))

console.log(`Ja existentes no banco (medicina_legal): ${chavesExistentes.size}`)
console.log(`Novas a importar: ${novas.length}`)

const porParcial = novas.reduce((acc, q) => { acc[q.parcial] = (acc[q.parcial] ?? 0) + 1; return acc }, {})
console.log("Por parcial:", porParcial)
const porDificuldade = novas.reduce((acc, q) => { acc[q.dificuldade] = (acc[q.dificuldade] ?? 0) + 1; return acc }, {})
console.log("Por dificuldade:", porDificuldade)

if (DRY_RUN) {
  console.log("\n[--dry-run] Nada foi inserido no banco.")
  process.exit(0)
}

const linhas = novas.map(({ _arquivo, _tema, _numero, ...q }) => q)
const idsInseridos = []
const TAMANHO_LOTE = 100
for (let i = 0; i < linhas.length; i += TAMANHO_LOTE) {
  const lote = linhas.slice(i, i + TAMANHO_LOTE)
  const { data, error } = await supabase.from("questoes").insert(lote).select("id")
  if (error) { console.error(`Erro ao inserir lote ${i}-${i + lote.length}:`, error.message); process.exit(1) }
  idsInseridos.push(...data.map((r) => r.id))
  console.log(`Inserido lote ${i}-${i + lote.length}`)
}

const idsFile = new URL("./lote-medicina-legal-ids.json", import.meta.url)
writeFileSync(idsFile, JSON.stringify(idsInseridos))
console.log(`\nImportacao concluida: ${idsInseridos.length} questoes novas de Medicina Legal (ativo=false).`)
console.log(`IDs salvos em ${idsFile.pathname}`)
console.log(`\nProximo passo: node scripts-tmp/scripts-tmp-gate-importacao.mjs --ids-file scripts-tmp/lote-medicina-legal-ids.json`)
