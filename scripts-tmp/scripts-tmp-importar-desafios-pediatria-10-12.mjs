// Importa os 3 novos casos clínicos de Pediatria (Downloads) como
// "Desafios Clínicos" (tabelas desafios_clinicos / desafios_clinicos_perguntas),
// continuando a numeração existente da seção "pediatria_5" (Caso 1..9 já
// existem -> estes entram como Caso 10, 11, 12).
//
// Mapeamento de schema (confirmado lendo o admin dialog + migration de
// constraints + amostra de dados reais da seção pediatria_5):
// - cada JSON de origem tem 1 "caso_clinico" com enunciado +
//   examenes_fisico_y_complementarios -> combinados em descricao_caso com
//   dois blocos "# Título" (formato markdown-lite aceito pelo textarea).
// - alternativas da pergunta: objeto {A,B,C,D} -> array [{id,texto,correta,feedback}]
//   na ordem a/b/c/d. A alternativa correta sempre vai com feedback=null
//   (o texto explicativo dela migra inteiro para "explicacao" da pergunta)
//   -- é exatamente o padrão observado em 100% das perguntas já no banco
//   (Caso 1 Pediatria 5º Ano consultado como referência).
// - categoria: os 3 arquivos de origem seguem TODOS o mesmo bloco fixo de
//   tópicos (verificado antes de escrever este script): perguntas 1-3
//   "Fisiopatología" -> anamnese, 4-7 "Semiología" -> exame_fisico, 8-10
//   "Exámenes complementarios" -> exames_complementares, 11-16
//   "Diagnóstico"/"Diagnóstico diferencial" -> diagnostico, 17-20
//   "Conducta" -> conduta.
//
// QA já rodado nos 60 textos-fonte antes deste script (scratchpad
// analise-vies.mjs): 0 problemas estruturais, distribuição de letra
// correta perfeitamente balanceada (15/15/15/15), sem viés de tamanho
// sistemático (correta é a mais longa em só 16,7% dos casos).
//
// Uso: node scripts-tmp-importar-desafios-pediatria-10-12.mjs          (dry-run, só mostra o que seria inserido)
//      node scripts-tmp-importar-desafios-pediatria-10-12.mjs --commit (insere de fato)

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
const CATEGORIA_POR_BLOCO = [
  [1, 3, "anamnese"],
  [4, 7, "exame_fisico"],
  [8, 10, "exames_complementares"],
  [11, 16, "diagnostico"],
  [17, 20, "conduta"],
]
function categoriaDaOrdem(ordem) {
  for (const [ini, fim, cat] of CATEGORIA_POR_BLOCO) {
    if (ordem >= ini && ordem <= fim) return cat
  }
  throw new Error(`ordem ${ordem} fora dos blocos esperados (1-20)`)
}

const ARQUIVOS = [
  {
    path: `${process.env.HOME}/Downloads/caso_1_lucia_convulsion_febril_preguntas.json`,
    heading: "Convulsión Febril, Varicela e Hipertensión Endocraneana",
    heading2: "Examen Físico y Estudios Complementarios",
  },
  {
    path: `${process.env.HOME}/Downloads/caso_2_valentina_purpura_febril_preguntas.json`,
    heading: "Púrpura Febril y Enfermedad Meningocócica",
    heading2: "Examen Físico y Estudios Complementarios",
  },
  {
    path: `${process.env.HOME}/Downloads/caso_3_tomas_cefalea_preguntas.json`,
    heading: "Cefalea Recurrente y Migraña",
    heading2: "Examen Físico y Estudios Complementarios",
  },
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

for (const arquivo of ARQUIVOS) {
  const json = JSON.parse(readFileSync(arquivo.path, "utf-8"))
  const caso = json.casos_clinicos[0]
  const titulo = `Caso ${proximoNumero} — Pediatria (5º Ano)`
  proximoNumero++

  const descricao_caso = `# ${arquivo.heading}\n\n${caso.enunciado}\n\n# ${arquivo.heading2}\n\n${caso.examenes_fisico_y_complementarios}`

  const perguntasPayload = caso.preguntas.map((p, idx) => {
    const ordem = idx + 1
    const letras = Object.keys(p.alternativas)
    if (letras.length !== 4) throw new Error(`${titulo} pergunta ${p.id_pregunta}: ${letras.length} alternativas (esperado 4)`)
    const corretas = letras.filter((l) => p.alternativas[l].correcta)
    if (corretas.length !== 1) throw new Error(`${titulo} pergunta ${p.id_pregunta}: ${corretas.length} corretas`)

    const alternativas = letras.map((letraOrigem, i) => {
      const alt = p.alternativas[letraOrigem]
      const texto = alt.texto.trim()
      if (/^\s*(correct|incorrect)[oa][.:]/i.test(texto)) {
        throw new Error(`${titulo} pergunta ${p.id_pregunta} alt ${letraOrigem}: vazamento de veredito no texto`)
      }
      return {
        id: LETRAS[i],
        texto,
        correta: alt.correcta,
        feedback: alt.correcta ? null : (alt.feedback || "").trim() || null,
      }
    })
    const explicacao = p.alternativas[corretas[0]].feedback.trim()

    return {
      ordem,
      categoria: categoriaDaOrdem(ordem),
      enunciado: p.enunciado_pregunta.trim(),
      alternativas,
      explicacao,
    }
  })

  console.log(`\n--- ${titulo} ---`)
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
