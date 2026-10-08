import { supabase } from "@/lib/supabase"

// Guarda se o aluno já viu o tutorial guiado do dashboard
// (components/onboarding-tutorial.tsx), em profiles.tutorial_dashboard_visto
// -- ver migration supabase/migrations/20261008000000_tutorial_dashboard_visto.sql.
// Precisa ser rodada manualmente no SQL Editor do Supabase antes disso
// funcionar (não há Supabase CLI linkado a este projeto ainda).

export async function getTutorialVisto(): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return true // sem sessão -- não mostra o tutorial

  const { data } = await supabase
    .from("profiles")
    .select("tutorial_dashboard_visto")
    .eq("id", userData.user.id)
    .maybeSingle()

  return data?.tutorial_dashboard_visto ?? false
}

export async function marcarTutorialVisto(): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return

  await supabase
    .from("profiles")
    .update({ tutorial_dashboard_visto: true })
    .eq("id", userData.user.id)
}
