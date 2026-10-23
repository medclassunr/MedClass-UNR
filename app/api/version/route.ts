import { NextResponse } from "next/server"

// Versão do build atualmente publicado. Como esta rota faz parte do mesmo
// deploy, ela sempre devolve a versão do build mais recente no servidor --
// enquanto o client em execução carrega a versão "assada" no bundle dele no
// momento em que a página foi aberta (process.env.NEXT_PUBLIC_APP_VERSION,
// definida em next.config.mjs). Comparar as duas (ver hooks/use-app-update)
// detecta quando saiu uma atualização sem o aluno precisar reinstalar o
// atalho do app.
//
// force-dynamic + no-store garantem que a resposta nunca seja
// pré-renderizada/cacheada; o service worker também trata /api/ como
// network-first, então o aluno sempre recebe a versão real do servidor.
export const dynamic = "force-dynamic"

export function GET() {
  return NextResponse.json(
    { version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev" },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  )
}
