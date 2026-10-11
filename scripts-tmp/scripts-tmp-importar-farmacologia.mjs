// Importa os lotes de questoes de Farmacologia (4o ano, parcial2) de
// ~/Downloads/Farmacologia/*.json.
//
// Auditoria feita antes de importar (ver conversa):
// - 26 arquivos na pasta, 3 eram duplicata EXATA (mesmo hash de
//   conteudo, nome com "(1)"/"(2)" de re-download do navegador) --
//   ignorados aqui por hash, nao pelo nome.
// - Varios "lote" compartilham o mesmo numero com conteudo DIFERENTE
//   (ex: lote3 tem "asma-epoc" e "respiratoria", ambos sobre o mesmo
//   tema mas com 0/20 de overlap exato de enunciado -- sao 2 lotes de
//   verdade so com numeracao colidida, nao duplicata). Confirmado
//   0% de overlap em TODOS os grupos (lote 3, 8, 10, 12, 13, 14) antes
//   de decidir manter os dois.
// - metadados.materia/ano vieram CORRETOS ("Farmacologia"/"4º Ano") em
//   100% das 460 questoes -- diferente de Medicina Legal/Metodologia,
//   aqui nao precisou de override.
// - disciplina_base veio "Farmacologia" (label, nao chave) em todas --
//   normalizado pra "farmacologia_base", que e a chave valida real em
//   DISCIPLINA_BASE_KEYS (lib/unr-curriculum.ts).
// - 0 duplicata de enunciado dentro do proprio conjunto de 460, e 0
//   colisao contra as 287 questoes de farmacologia ja existentes no
//   banco (checado por enunciado+opcoes).
// - 0 erro estrutural (letras bati, resposta_correta valida, sem
//   feedback vazio, sem veredito em portugues, sem razao de tamanho
//   extrema) nas 460 questoes.
//
// Insere com ativo=false. Depois, rodar o gate de validacao:
//   node scripts-tmp/scripts-tmp-gate-importacao.mjs --ids-file scripts-tmp/lote-farmacologia-ids.json
//
// Uso: node scripts-tmp/scripts-tmp-importar-farmacologia.mjs [--dry-run]
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, readdirSync } from "fs"
import { createHash } from "crypto"

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
const PASTA = `${HOME}/Downloads/Farmacologia`

function normalizarParcial(valor) {
  const v = (valor || "").toLowerCase()
  return v.includes("segundo") ? "parcial2" : "parcial1"
}
function normalizarDificuldade(valor) {
  return (valor || "").toLowerCase() || null
}
function normalizarDisciplina(valor) {
  if (!valor) return null
  const chave = valor.trim().toLowerCase()
  if (chave === "farmacologia") return "farmacologia_base"
  return chave.replace(/\s+/g, "_")
}

function mapQuestao(raw, arquivo) {
  const m = raw.metadados || {}
  const alt = raw.alternativas || {}
  const fb = raw.feedback || {}
  const letras = Object.keys(alt).sort()

  return {
    enunciado: (raw.enunciado || "").trim(),
    materia: "farmacologia",
    dificuldade: normalizarDificuldade(m.dificuldade),
    disciplina_base: normalizarDisciplina(m.disciplina_base),
    tags: Array.isArray(m.tags) ? m.tags : [],
    opcoes: letras.map((l) => alt[l]),
    indice_correta: letras.indexOf(raw.resposta_correta),
    opcoes_comentario: letras.map((l) => fb[l]),
    parcial: normalizarParcial(m.parcial),
    ativo: false,
    _arquivo: arquivo,
    _numero: raw.numero,
  }
}

// dedup por hash de conteudo do arquivo (re-downloads do navegador com "(1)"/"(2)" no nome)
const nomes = readdirSync(PASTA).filter((n) => n.endsWith(".json"))
const vistoHash = new Set()
const arquivos = []
for (const nome of nomes) {
  const buf = readFileSync(`${PASTA}/${nome}`)
  const hash = createHash("md5").update(buf).digest("hex")
  if (vistoHash.has(hash)) { console.log(`Ignorando duplicata exata: ${nome}`); continue }
  vistoHash.add(hash)
  arquivos.push(nome)
}

const todas = []
for (const arquivo of arquivos) {
  const data = JSON.parse(readFileSync(`${PASTA}/${arquivo}`, "utf-8"))
  if (data.quantidade_questoes !== data.questoes.length) {
    console.error(`[${arquivo}] quantidade_questoes (${data.quantidade_questoes}) != questoes.length (${data.questoes.length}) -- abortando.`)
    process.exit(1)
  }
  for (const raw of data.questoes) todas.push(mapQuestao(raw, arquivo))
}

console.log(`Lidas ${todas.length} questoes de ${arquivos.length} arquivos unicos.`)

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
  .from("questoes").select("enunciado, opcoes").eq("materia", "farmacologia")
if (errExistentes) { console.error("Erro ao checar existentes:", errExistentes.message); process.exit(1) }

const chavesExistentes = new Set((existentes ?? []).map((e) => `farmacologia|${e.enunciado}|${(e.opcoes ?? []).join("~")}`))
const novas = unicas.filter((q) => !chavesExistentes.has(`${q.materia}|${q.enunciado}|${q.opcoes.join("~")}`))

console.log(`Ja existentes no banco (farmacologia): ${chavesExistentes.size}`)
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

const idsFile = "scripts-tmp/lote-farmacologia-ids.json"
writeFileSync(idsFile, JSON.stringify(idsInseridos))
console.log(`\nImportacao concluida: ${idsInseridos.length} questoes novas de Farmacologia (ativo=false).`)
console.log(`IDs salvos em ${idsFile}`)
console.log(`\nProximo passo: node scripts-tmp/scripts-tmp-gate-importacao.mjs --ids-file ${idsFile}`)
