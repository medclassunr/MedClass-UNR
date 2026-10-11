// Importa os lotes de questoes de Urologia (4o ano, ver mudanca de ano
// em 2026-10-10/11 em lib/unr-curriculum.ts) de ~/Downloads/Urologia/*.json.
//
// Auditoria feita antes de importar (ver conversa):
// - 27 arquivos, TODOS com conteudo unico (nenhuma duplicata exata por
//   hash, apesar dos nomes com "(1)"/"(2)" sugerirem re-download).
// - Pasta tem DOIS formatos de JSON diferentes misturados (nao e so
//   nomenclatura, a estrutura dos campos muda):
//     formato "preguntas" (top-level lote/tema/ano/materia/parcial +
//       preguntas:[{numero_pregunta, dificultad, alternativas,
//       respuesta_correcta (as vezes grafado sem o 2o "c":
//       "respuesta_correta"), feedback_alternativas:{A,B,C,D}}])
//     formato "lista plana" ([{id, ano, materia, parcial,
//       disciplina_base, opciones:{A,B,C,D}, respuesta_correcta,
//       feedback_correcta (string, so da certa),
//       feedback_incorrectas:{so as 3 erradas}}])
// - "Lotes" com numero repetido (3,4,5,6,7,8,9,10,11) sao conjuntos
//   DIFERENTES de verdade, 0% overlap de enunciado confirmado em cada
//   grupo antes de manter todos (mesmo padrao ja visto em Farmacologia).
// - metadados.ano/materia vieram ERRADOS em 100% ("Cirurgia do 5º ano")
//   -- lixo de template, igual visto antes -- ignorados, materia
//   sempre "urologia".
// - BUG REAL DE CONTEUDO (nao e so metadado errado): em 8 arquivos do
//   formato "lista plana", 53 questoes tem "feedback_incorrectas" com
//   uma letra DUPLICADA/ERRADA no lugar da letra que faltava (ex: a
//   resposta certa e D, mas feedback_incorrectas tem {B,C,D} em vez de
//   {A,B,C} -- a letra A nunca recebe feedback, e o texto que esta sob
//   "D" la dentro claramente fala de outra alternativa). Isso nao tem
//   como ser corrigido by automatico com seguranca (nao sei qual letra
//   realmente faltou nem reescrever o texto) -- essas 53 sao EXCLUIDAS
//   da importacao e listadas no console, nao silenciosamente
//   descartadas.
// - disciplina_base normalizado (acentos/caixa) e "Farmacologia" ->
//   "farmacologia_base" (chave valida real).
//
// Insere com ativo=false. Depois, rodar o gate de validacao:
//   node scripts-tmp/scripts-tmp-gate-importacao.mjs --ids-file scripts-tmp/lote-urologia-ids.json
//
// Uso: node scripts-tmp/scripts-tmp-importar-urologia.mjs [--dry-run]
import { createClient } from "@supabase/supabase-js"
import { readFileSync, writeFileSync, readdirSync } from "fs"

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
const PASTA = `${HOME}/Downloads/Urologia`

function normalizarParcial(valor) {
  const v = (valor || "").toLowerCase()
  return v.includes("segundo") ? "parcial2" : "parcial1"
}
// coluna "dificuldade" e NOT NULL no banco -- o formato "lista plana"
// nao tem esse campo na fonte (nenhuma das 300 questoes desse formato
// tem "dificultad"), entao assume "medio" como neutro (e o valor mais
// comum nas que tem classificacao: 138/240 = 57%).
function normalizarDificuldade(valor) {
  return (valor || "").toLowerCase() || "médio"
}
function normalizarDisciplina(valor) {
  if (!valor) return null
  const chave = valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
  if (chave === "farmacologia") return "farmacologia_base"
  return chave.replace(/\s+/g, "_")
}

// extrai questoes normalizadas de um arquivo, em qualquer um dos 2 formatos vistos
function extrairQuestoes(data) {
  if (Array.isArray(data)) {
    return data.map((q, idx) => {
      const fb = { ...(q.feedback_incorrectas || {}) }
      const correta = q.respuesta_correcta
      if (correta) fb[correta] = q.feedback_correcta
      return {
        num: q.id ?? idx + 1,
        parcial: q.parcial, dificuldade: q.dificultad, disciplina_base: q.disciplina_base,
        tags: q.tags || [], enunciado: q.enunciado, opcoes_dict: q.opciones || {}, correta, fb_dict: fb,
      }
    })
  }
  const qs = data.preguntas || data.questoes || []
  return qs.map((q) => ({
    num: q.numero_pregunta ?? q.numero,
    parcial: q.parcial, dificuldade: q.dificultad, disciplina_base: q.disciplina_base,
    tags: q.tags || [], enunciado: q.enunciado, opcoes_dict: q.alternativas || {},
    correta: q.respuesta_correcta ?? q.respuesta_correta, fb_dict: q.feedback_alternativas || {},
  }))
}

const nomes = readdirSync(PASTA).filter((n) => n.endsWith(".json"))
const todas = []
const excluidas = []
for (const arquivo of nomes) {
  const data = JSON.parse(readFileSync(`${PASTA}/${arquivo}`, "utf-8"))
  for (const q of extrairQuestoes(data)) {
    const letrasAlt = Object.keys(q.opcoes_dict).sort()
    const letrasFb = Object.keys(q.fb_dict).sort()
    if (JSON.stringify(letrasAlt) !== JSON.stringify(letrasFb)) {
      excluidas.push(`${arquivo} Q${q.num}: letras alternativas ${letrasAlt} != feedback ${letrasFb}`)
      continue
    }
    todas.push({
      enunciado: (q.enunciado || "").trim(),
      materia: "urologia",
      dificuldade: normalizarDificuldade(q.dificuldade),
      disciplina_base: normalizarDisciplina(q.disciplina_base),
      tags: q.tags,
      opcoes: letrasAlt.map((l) => q.opcoes_dict[l]),
      indice_correta: letrasAlt.indexOf(q.correta),
      opcoes_comentario: letrasAlt.map((l) => q.fb_dict[l]),
      parcial: normalizarParcial(q.parcial),
      ativo: false,
      _arquivo: arquivo,
      _numero: q.num,
    })
  }
}

console.log(`Lidas ${todas.length} questoes validas de ${nomes.length} arquivos.`)
if (excluidas.length) {
  console.log(`\n${excluidas.length} questao(oes) EXCLUIDA(S) por feedback incompleto (letra faltando/duplicada na fonte):`)
  excluidas.forEach((e) => console.log("  -", e))
}

const problemas = []
for (const q of todas) {
  const id = `${q._arquivo} Q${q._numero}`
  if (!q.enunciado) problemas.push([id, "enunciado vazio"])
  if (!Array.isArray(q.opcoes) || q.opcoes.length < 2) problemas.push([id, "opcoes invalidas"])
  if (q.opcoes.some((o) => !o || !String(o).trim())) problemas.push([id, "alternativa vazia"])
  if (q.indice_correta < 0) problemas.push([id, "indice_correta invalido"])
  if (q.opcoes.length !== q.opcoes_comentario.length) problemas.push([id, "opcoes/comentarios desalinhados"])
  if (q.opcoes_comentario.some((o) => !o || !String(o).trim())) problemas.push([id, "feedback vazio"])
}
if (problemas.length > 0) {
  console.error(`\nProblemas estruturais encontrados (${problemas.length}), abortando:`)
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
console.log(`\nDuplicadas internamente: ${dupInterna}`)

const { data: existentes, error: errExistentes } = await supabase
  .from("questoes").select("enunciado, opcoes").eq("materia", "urologia")
if (errExistentes) { console.error("Erro ao checar existentes:", errExistentes.message); process.exit(1) }

const chavesExistentes = new Set((existentes ?? []).map((e) => `urologia|${e.enunciado}|${(e.opcoes ?? []).join("~")}`))
const novas = unicas.filter((q) => !chavesExistentes.has(`${q.materia}|${q.enunciado}|${q.opcoes.join("~")}`))

console.log(`Ja existentes no banco (urologia): ${chavesExistentes.size}`)
console.log(`Novas a importar: ${novas.length}`)

const porParcial = novas.reduce((acc, q) => { acc[q.parcial] = (acc[q.parcial] ?? 0) + 1; return acc }, {})
console.log("Por parcial:", porParcial)

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

const idsFile = "scripts-tmp/lote-urologia-ids.json"
writeFileSync(idsFile, JSON.stringify(idsInseridos))
console.log(`\nImportacao concluida: ${idsInseridos.length} questoes novas de Urologia (ativo=false).`)
console.log(`IDs salvos em ${idsFile}`)
console.log(`\nProximo passo: node scripts-tmp/scripts-tmp-gate-importacao.mjs --ids-file ${idsFile}`)
