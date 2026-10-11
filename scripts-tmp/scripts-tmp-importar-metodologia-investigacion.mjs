// Importa os 5 lotes de questoes de Metodologia da Investigacion
// (materia nova, ano0 "Instrumentales") de ~/Downloads/lote_0N_*.json.
//
// Formato diferente dos lotes de Medicina Legal: aqui cada arquivo e
// uma LISTA plana de 20 questoes (sem wrapper {tema,lote,questoes:[]}),
// e os campos ficam direto no objeto (sem "metadados" aninhado).
//
// Correcoes aplicadas na importacao (confirmadas por auditoria antes de
// gravar, ver conversa):
// - campo `ano`/`materia` de origem vinha "1º Ano"/"Crescimento e
//   Desenvolvimento" em TODAS as 100 questoes (lixo de template, nao
//   reflete o conteudo real -- que e epistemologia/desenho de
//   pesquisa/bioestatistica) -- ignorado por completo, igual ja feito
//   com Pediatria e Medicina Legal. materia sempre vira
//   "metodologia_investigacion".
// - disciplina_base de origem vinha "Fisiologia" (96/100) ou
//   "Farmacologia" (4/100) -- tambem suspeito de ser leftover de
//   template (mesmo padrao do ano/materia errados): quase todas vieram
//   "Fisiologia" independente do tema real de cada questao. Zerado
//   (null) pra nao classificar errado no painel de Desempenho --
//   disciplina_base e campo opcional.
// - parcial normalizado (Primeiro/Segundo Parcial -> parcial1/parcial2)
//   -- todas vieram "Primeiro Parcial" nesses 5 lotes (sem forcar nada,
//   e so o que a fonte trouxe; se vierem lotes de segundo parcial
//   depois, entram normalmente).
//
// Insere com ativo=false. Depois, rodar o gate de validacao:
//   node scripts-tmp/scripts-tmp-gate-importacao.mjs --ids-file scripts-tmp/lote-metodologia-investigacion-ids.json
//
// Uso: node scripts-tmp/scripts-tmp-importar-metodologia-investigacion.mjs [--dry-run]
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
  "lote_01_paradigmas_y_conocimiento.json",
  "lote_02_momentos_investigacion_sabino.json",
  "lote_03_disenos_metodologicos.json",
  "lote_04_bioetica_y_regulacion.json",
  "lote_05_estadistica_y_variables.json",
]

function normalizarParcial(valor) {
  const v = (valor || "").toLowerCase()
  return v.includes("segundo") ? "parcial2" : "parcial1"
}

function normalizarDificuldade(valor) {
  return (valor || "").toLowerCase() || null
}

function mapQuestao(raw, arquivo) {
  const alt = raw.alternativas || {}
  const fb = raw.feedbacks || {}
  const letras = Object.keys(alt).sort()

  const opcoes = letras.map((l) => alt[l])
  const opcoes_comentario = letras.map((l) => fb[l])
  const indice_correta = letras.indexOf(raw.resposta_correta)

  return {
    enunciado: (raw.enunciado || "").trim(),
    materia: "metodologia_investigacion",
    dificuldade: normalizarDificuldade(raw.dificuldade),
    disciplina_base: null, // ver comentario no topo do arquivo
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    opcoes,
    indice_correta,
    opcoes_comentario,
    parcial: normalizarParcial(raw.parcial),
    ativo: false,
    _arquivo: arquivo,
    _numero: raw.numero,
  }
}

const todas = []
for (const arquivo of ARQUIVOS) {
  const data = JSON.parse(readFileSync(`${HOME}/Downloads/${arquivo}`, "utf-8"))
  if (!Array.isArray(data) || data.length !== 20) {
    console.error(`[${arquivo}] esperava lista de 20 questoes, achou ${Array.isArray(data) ? data.length : typeof data} -- abortando.`)
    process.exit(1)
  }
  for (const raw of data) todas.push(mapQuestao(raw, arquivo))
}

console.log(`Lidas ${todas.length} questoes de ${ARQUIVOS.length} lotes.`)

const problemas = []
for (const q of todas) {
  const id = `${q._arquivo} Q${q._numero}`
  if (!q.enunciado) problemas.push([id, "enunciado vazio"])
  if (!Array.isArray(q.opcoes) || q.opcoes.length < 2) problemas.push([id, "opcoes invalidas"])
  if (q.opcoes.some((o) => !o || !o.trim())) problemas.push([id, "alternativa vazia"])
  if (q.indice_correta < 0) problemas.push([id, "indice_correta invalido"])
  if (q.opcoes.length !== q.opcoes_comentario.length) problemas.push([id, "opcoes/comentarios desalinhados"])
  if (q.opcoes_comentario.some((o) => !o || !o.trim())) problemas.push([id, "feedback vazio"])
}
if (problemas.length > 0) {
  console.error(`Problemas estruturais encontrados (${problemas.length}), abortando:`)
  for (const p of problemas.slice(0, 20)) console.error(" ", p)
  process.exit(1)
}

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

const { data: existentes, error: errExistentes } = await supabase
  .from("questoes").select("enunciado, opcoes").eq("materia", "metodologia_investigacion")
if (errExistentes) { console.error("Erro ao checar existentes:", errExistentes.message); process.exit(1) }

const chavesExistentes = new Set((existentes ?? []).map((e) => `metodologia_investigacion|${e.enunciado}|${(e.opcoes ?? []).join("~")}`))
const novas = unicas.filter((q) => !chavesExistentes.has(`${q.materia}|${q.enunciado}|${q.opcoes.join("~")}`))

console.log(`Ja existentes no banco (metodologia_investigacion): ${chavesExistentes.size}`)
console.log(`Novas a importar: ${novas.length}`)

const porParcial = novas.reduce((acc, q) => { acc[q.parcial] = (acc[q.parcial] ?? 0) + 1; return acc }, {})
console.log("Por parcial:", porParcial)
const porDificuldade = novas.reduce((acc, q) => { acc[q.dificuldade] = (acc[q.dificuldade] ?? 0) + 1; return acc }, {})
console.log("Por dificuldade:", porDificuldade)

if (DRY_RUN) {
  console.log("\n[--dry-run] Nada foi inserido no banco.")
  process.exit(0)
}

const linhas = novas.map(({ _arquivo, _numero, ...q }) => q)
const idsInseridos = []
const TAMANHO_LOTE = 100
for (let i = 0; i < linhas.length; i += TAMANHO_LOTE) {
  const lote = linhas.slice(i, i + TAMANHO_LOTE)
  const { data, error } = await supabase.from("questoes").insert(lote).select("id")
  if (error) { console.error(`Erro ao inserir lote ${i}-${i + lote.length}:`, error.message); process.exit(1) }
  idsInseridos.push(...data.map((r) => r.id))
  console.log(`Inserido lote ${i}-${i + lote.length}`)
}

const idsFile = "scripts-tmp/lote-metodologia-investigacion-ids.json"
writeFileSync(idsFile, JSON.stringify(idsInseridos))
console.log(`\nImportacao concluida: ${idsInseridos.length} questoes novas de Metodologia da Investigacion (ativo=false).`)
console.log(`IDs salvos em ${idsFile}`)
console.log(`\nProximo passo: node scripts-tmp/scripts-tmp-gate-importacao.mjs --ids-file ${idsFile}`)
