import { readFileSync } from "fs"
import { createClient } from "@supabase/supabase-js"

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
const getEnv = (key) => env.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim()
const supabase = createClient(getEnv("NEXT_PUBLIC_SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"))

const { data: desafios } = await supabase
  .from("desafios_clinicos")
  .select("id, titulo, area, secao")
  .order("created_at", { ascending: false })
  .limit(10)

console.log("Últimos desafios criados:")
for (const d of desafios ?? []) {
  console.log(`- [${d.id}] ${d.titulo} (area=${d.area}, secao=${d.secao})`)
}

const { data: perguntas } = await supabase
  .from("desafios_clinicos_perguntas")
  .select("desafio_id, categoria, enunciado, alternativas, explicacao")
  .order("created_at", { ascending: false })
  .limit(15)

console.log("\nAmostra de perguntas recentes:")
for (const p of perguntas ?? []) {
  const feedbackSample = p.alternativas?.find((a) => a.feedback)?.feedback
  console.log(`\n[${p.categoria}] ${p.enunciado?.slice(0, 80)}`)
  console.log(`  explicacao: ${p.explicacao ? p.explicacao.slice(0, 100) : "(null)"}`)
  console.log(`  feedback alt exemplo: ${feedbackSample ? feedbackSample.slice(0, 100) : "(nenhum)"}`)
}

const { data: catCount } = await supabase.from("desafios_clinicos_perguntas").select("categoria")
const counts = {}
for (const row of catCount ?? []) counts[row.categoria] = (counts[row.categoria] ?? 0) + 1
console.log("\nDistribuição total de categorias:", counts)

const { data: pedDesafios } = await supabase
  .from("desafios_clinicos")
  .select("titulo, icone, ativo, created_at")
  .eq("secao", "pediatria_5")
  .order("titulo")
console.log("\nTodos os casos de pediatria_5:")
for (const d of pedDesafios ?? []) console.log(`- ${d.titulo} | icone=${d.icone} | ativo=${d.ativo} | created_at=${d.created_at}`)
