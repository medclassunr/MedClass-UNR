import { readFileSync } from "fs"
import { createClient } from "@supabase/supabase-js"
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
const getEnv = (k) => env.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim()
const supabase = createClient(getEnv("NEXT_PUBLIC_SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"))

const ids = ["9a0e18c1-4b28-4e89-95cf-d992f9874c53", "7e5de3af-c8ce-4051-b5e7-cc2ee167daaa", "670c12fb-f817-4794-a4fc-46630c161f86"]
for (const id of ids) {
  const { data: d } = await supabase.from("desafios_clinicos").select("titulo, ativo, secao, icone").eq("id", id).single()
  const { count } = await supabase.from("desafios_clinicos_perguntas").select("id", { count: "exact", head: true }).eq("desafio_id", id)
  console.log(`${d.titulo} | ativo=${d.ativo} | secao=${d.secao} | icone=${d.icone} | perguntas=${count}`)
}
