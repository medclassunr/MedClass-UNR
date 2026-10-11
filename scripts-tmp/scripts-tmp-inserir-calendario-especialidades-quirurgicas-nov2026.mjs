// Insere 8 eventos oficiais de Novembro/2026 no calendario (Urologia,
// Otorrinolaringologia, Oftalmologia -- especialidades quirurgicas do
// 4o ano). Pedido direto do usuario, datas conferidas: nenhum evento
// com titulo/data iguais ja existia no calendario (checado antes de
// inserir, grep vazio por "urolog|otorrino|oftalmolog|quirurg|mesa
// oral|parcial" em todos os 277 eventos oficiais ativos).
//
// Convencao de titulo seguida (igual ao resto do calendario, nao
// inventada): "Inscripción — <X> (<Mês/Ano>)" e "Examen — <X> (<Mês/
// Ano>)" -- schema nao tem tipo "mesa_oral"/"parcial" proprio (so
// inscricao/prova/comunidade/cursado/pessoal), entao Mesa Oral e
// Parcial entram como tipo "prova", igual os demais exames do
// calendario.
//
// Uso: node scripts-tmp/scripts-tmp-inserir-calendario-especialidades-quirurgicas-nov2026.mjs [--dry-run]
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"

const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf-8")
const env = Object.fromEntries(
  envFile.split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => {
    const i = l.indexOf("=")
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
  })
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const DRY_RUN = process.argv.includes("--dry-run")

const EVENTOS = [
  {
    titulo: "Inscripción — Especialidades Quirúrgicas (Noviembre 2026)",
    descricao: "Inscripción por formulario para Urología, Otorrinolaringología y Oftalmología.",
    data: "2026-11-04",
    tipo: "inscricao",
  },
  { titulo: "Mesa Oral — Urología (Noviembre 2026)", descricao: null, data: "2026-11-09", tipo: "prova" },
  { titulo: "Parcial — Otorrinolaringología (Noviembre 2026)", descricao: null, data: "2026-11-12", tipo: "prova" },
  { titulo: "Parcial — Oftalmología (Noviembre 2026)", descricao: null, data: "2026-11-14", tipo: "prova" },
  {
    titulo: "Inscripción — Especialidades Quirúrgicas (Noviembre 2026)",
    descricao: "Inscripción por formulario para Urología, Otorrinolaringología y Oftalmología.",
    data: "2026-11-18",
    tipo: "inscricao",
  },
  { titulo: "Mesa Oral — Urología (Noviembre 2026)", descricao: null, data: "2026-11-23", tipo: "prova" },
  { titulo: "Parcial — Otorrinolaringología (Noviembre 2026)", descricao: null, data: "2026-11-26", tipo: "prova" },
  { titulo: "Parcial — Oftalmología (Noviembre 2026)", descricao: null, data: "2026-11-28", tipo: "prova" },
]

console.log(`Inserindo ${EVENTOS.length} eventos oficiais (user_id=null, ativo=true):`)
EVENTOS.forEach((e) => console.log(`  ${e.data} [${e.tipo}] ${e.titulo}`))

if (DRY_RUN) {
  console.log("\n[--dry-run] Nada foi inserido no banco.")
  process.exit(0)
}

const { data, error } = await supabase.from("calendario_eventos").insert(EVENTOS.map((e) => ({ ...e, ativo: true }))).select("id,data,titulo")
if (error) { console.error("Erro ao inserir:", error.message); process.exit(1) }

console.log(`\n${data.length} eventos inseridos com sucesso.`)
