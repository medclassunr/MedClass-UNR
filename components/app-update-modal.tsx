"use client"

// Aviso de atualização como MODAL CENTRAL (igual ao estilo do tutorial), pra
// ser impossível de perder -- antes aparecia só como um balãozinho no canto do
// avatar. Aparece sozinho quando /api/version indica que saiu um build novo
// (ver hooks/use-app-update) e só some quando o aluno toca em "Atualizar
// agora" (clicar fora NÃO fecha -- é proposital).

import { useLanguage } from "@/lib/i18n"
import { useAppUpdate } from "@/hooks/use-app-update"
import { AVATAR_FRAMES } from "@/components/onboarding-tutorial"

const AVATAR_ICONE = AVATAR_FRAMES[0].src

export function AppUpdateModal() {
  const { t } = useLanguage()
  const { atualizacaoDisponivel, recarregando, recarregarApp } = useAppUpdate()

  if (!atualizacaoDisponivel) return null

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60" />
      <div className="animate-avatar-balao relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 h-20 w-20 overflow-hidden rounded-full border-[3px] border-primary/50">
          <img src={AVATAR_ICONE} alt="" className="h-full w-full object-cover object-top" />
        </div>
        <h2 className="text-lg font-bold text-foreground">{t.tutorialDashboard.atualizacaoTitulo}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.tutorialDashboard.atualizacaoTexto}</p>
        <button
          type="button"
          onClick={recarregarApp}
          disabled={recarregando}
          className="mt-5 flex w-full items-center justify-center rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {recarregando ? t.tutorialDashboard.atualizacaoCarregando : t.tutorialDashboard.atualizacaoBotao}
        </button>
      </div>
    </div>
  )
}
