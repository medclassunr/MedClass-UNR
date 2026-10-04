// Importa os 3 novos casos clínicos de Pediatria (Downloads:
// casos_nefrologia_pediatrica.json -- ITU/pielonefritis, síndrome
// nefrótico, SUH) como "Desafios Clínicos", continuando a numeração da
// seção "pediatria_5" (Caso 1..15 já existem -> estes entram como Caso
// 16, 17, 18). Mesmo padrão dos lotes anteriores (ver
// scripts-tmp-importar-desafios-pediatria-13-15.mjs): um único arquivo
// com 3 "casos_clinicos", categoria derivada por keyword do campo
// "topico" (categoriaFromTopico), não por bloco fixo de ordem.
//
// QA já rodado nos 60 textos-fonte antes deste script (scratchpad
// analise-vies-nefro.mjs): 0 problemas estruturais, letra correta
// perfeitamente balanceada (15/15/15/15), sem viés de tamanho
// sistemático (correta é a mais longa em só 11,7% dos casos).
//
// Uso: node scripts-tmp-importar-desafios-pediatria-16-18.mjs          (dry-run)
//      node scripts-tmp-importar-desafios-pediatria-16-18.mjs --commit (insere de fato)

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"

const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf-8")
const env = Object.fromEntries(
  envFile
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=")
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
    })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const COMMIT = process.argv.includes("--commit")
const LETRAS = ["a", "b", "c", "d"]

function categoriaFromTopico(topico) {
  const t = topico
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
  if (t.includes("fisiopatolog")) return "anamnese"
  if (t.includes("semiolog")) return "exame_fisico"
  if (t.includes("complementarios")) return "exames_complementares"
  if (t.includes("diagnost")) return "diagnostico"
  if (t.includes("conducta")) return "conduta"
  throw new Error(`tópico desconhecido, não mapeado para nenhuma categoria: "${topico}"`)
}

const ARQUIVO = `${process.env.HOME}/Downloads/casos_nefrologia_pediatrica.json`
const CASOS_META = [
  { heading: "Infección Urinaria Febril y Reflujo Vesicoureteral", heading2: "Examen Físico y Estudios Complementarios" },
  { heading: "Síndrome Nefrótico Idiopático (Cambios Mínimos)", heading2: "Examen Físico y Estudios Complementarios" },
  { heading: "Síndrome Urémico Hemolítico Típico", heading2: "Examen Físico y Estudios Complementarios" },
]

const { data: existentes, error: errExistentes } = await supabase
  .from("desafios_clinicos")
  .select("titulo")
  .eq("secao", "pediatria_5")
if (errExistentes) throw errExistentes

const numerosExistentes = existentes
  .map((d) => d.titulo.match(/^Caso (\d+) — Pediatria \(5º Ano\)$/)?.[1])
  .filter(Boolean)
  .map(Number)
let proximoNumero = (numerosExistentes.length ? Math.max(...numerosExistentes) : 0) + 1

console.log(`Casos existentes em pediatria_5: ${numerosExistentes.sort((a, b) => a - b).join(", ")}`)
console.log(`Próxima numeração a usar: ${proximoNumero}, ${proximoNumero + 1}, ${proximoNumero + 2}`)
console.log(COMMIT ? "\n=== MODO COMMIT: vai inserir de fato ===\n" : "\n=== DRY-RUN: nada será inserido ===\n")

const json = JSON.parse(readFileSync(ARQUIVO, "utf-8"))
if (json.casos_clinicos.length !== CASOS_META.length) {
  throw new Error(`esperava ${CASOS_META.length} casos no arquivo, encontrou ${json.casos_clinicos.length}`)
}

for (let i = 0; i < json.casos_clinicos.length; i++) {
  const caso = json.casos_clinicos[i]
  const meta = CASOS_META[i]
  const titulo = `Caso ${proximoNumero} — Pediatria (5º Ano)`
  proximoNumero++

  const descricao_caso = `# ${meta.heading}\n\n${caso.enunciado}\n\n# ${meta.heading2}\n\n${caso.examenes_fisico_y_complementarios}`

  const perguntasPayload = caso.preguntas.map((p, idx) => {
    const ordem = idx + 1
    const letras = Object.keys(p.alternativas)
    if (letras.length !== 4) throw new Error(`${titulo} pergunta ${p.id_pregunta}: ${letras.length} alternativas (esperado 4)`)
    const corretas = letras.filter((l) => p.alternativas[l].correcta)
    if (corretas.length !== 1) throw new Error(`${titulo} pergunta ${p.id_pregunta}: ${corretas.length} corretas`)

    const alternativas = letras.map((letraOrigem, i2) => {
      const alt = p.alternativas[letraOrigem]
      const texto = alt.texto.trim()
      if (/^\s*(correct|incorrect)[oa][.:]/i.test(texto)) {
        throw new Error(`${titulo} pergunta ${p.id_pregunta} alt ${letraOrigem}: vazamento de veredito no texto`)
      }
      return {
        id: LETRAS[i2],
        texto,
        correta: alt.correcta,
        feedback: alt.correcta ? null : (alt.feedback || "").trim() || null,
      }
    })
    const explicacao = p.alternativas[corretas[0]].feedback.trim()

    return {
      ordem,
      categoria: categoriaFromTopico(p.topico),
      enunciado: p.enunciado_pregunta.trim(),
      alternativas,
      explicacao,
    }
  })

  console.log(`\n--- ${titulo} (${meta.heading}) ---`)
  console.log(`descricao_caso: ${descricao_caso.length} chars`)
  console.log(`perguntas: ${perguntasPayload.length}`)
  const porCategoria = {}
  for (const p of perguntasPayload) porCategoria[p.categoria] = (porCategoria[p.categoria] ?? 0) + 1
  console.log(`distribuição por categoria:`, porCategoria)

  if (!COMMIT) continue

  const { data: desafioInserido, error: errDesafio } = await supabase
    .from("desafios_clinicos")
    .insert({
      titulo,
      icone: "Baby",
      area: null,
      secao: "pediatria_5",
      imagem_url: null,
      descricao_caso,
      ativo: true,
      bibliografia: [],
    })
    .select("id")
    .single()
  if (errDesafio) throw errDesafio

  const perguntasComDesafioId = perguntasPayload.map((p) => ({ ...p, desafio_id: desafioInserido.id }))
  const { error: errPerguntas } = await supabase.from("desafios_clinicos_perguntas").insert(perguntasComDesafioId)
  if (errPerguntas) throw errPerguntas

  console.log(`✅ Inserido com id ${desafioInserido.id}`)
}

console.log(COMMIT ? "\nConcluído." : "\nDry-run concluído. Rode novamente com --commit para inserir de fato.")
