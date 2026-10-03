import { readFileSync } from "fs"
import { createClient } from "@supabase/supabase-js"

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
const getEnv = (key) => env.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim()
const supabase = createClient(getEnv("NEXT_PUBLIC_SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"))

const desafioId = process.argv[2] ?? "89ea4ed8-52d7-4688-8001-2e405ba8c510" // Caso 1 Pediatria 5º Ano

const { data: desafio } = await supabase.from("desafios_clinicos").select("*").eq("id", desafioId).single()
console.log("DESAFIO:", desafio?.titulo)
console.log("descricao_caso (primeiros 400 chars):\n", desafio?.descricao_caso?.slice(0, 400))

const { data: perguntas, error } = await supabase
  .from("desafios_clinicos_perguntas")
  .select("ordem, categoria, enunciado, alternativas, explicacao")
  .eq("desafio_id", desafioId)
  .order("ordem")

if (error) console.error("ERRO:", error)

for (const p of perguntas ?? []) {
  console.log(`\n#${p.ordem} [${p.categoria}] ${p.enunciado}`)
  const correta = p.alternativas.find((a) => a.correta)
  console.log(`  correta.feedback: ${correta?.feedback ?? "(null)"}`)
  console.log(`  explicacao: ${p.explicacao}`)
  const incorreta = p.alternativas.find((a) => !a.correta)
  console.log(`  incorreta.feedback exemplo: ${incorreta?.feedback?.slice(0, 120)}`)
}
