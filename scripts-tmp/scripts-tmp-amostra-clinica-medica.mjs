import { readFileSync } from "fs"
import { createClient } from "@supabase/supabase-js"
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
const getEnv = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim()
const supabase = createClient(getEnv("NEXT_PUBLIC_SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"))

const { data } = await supabase
  .from("desafios_clinicos")
  .select("titulo, icone, area, secao, ativo, created_at")
  .eq("area", "Clínica Médica")
  .order("titulo")
console.log("Casos com area=Clínica Médica:")
for (const d of data ?? []) console.log(`- ${d.titulo} | icone=${d.icone} | secao=${d.secao} | ativo=${d.ativo}`)

// também checar todas as areas/secoes distintas existentes, pra não inventar uma nova sem necessidade
const { data: todos } = await supabase.from("desafios_clinicos").select("area, secao")
const combos = new Set((todos ?? []).map((d) => `area=${d.area} | secao=${d.secao}`))
console.log("\nTodas as combinações area/secao existentes:")
for (const c of combos) console.log(" -", c)
