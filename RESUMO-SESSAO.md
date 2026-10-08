# MedClass UNR — Resumo de sessões

Documento de continuidade.

---

# Sessão 08/10/2026 — Tutorial guiado do dashboard

## O que foi pedido
Réplica do tutorial guiado de primeiro acesso já construído no projeto
**CRM na Mão** (ver `CRM na Mao/RESUMO-SESSAO.md`), adaptado às cores/tema
desta plataforma (tokens CSS `var(--primary)` etc., se adapta sozinho
entre claro/escuro), reusando o mesmo avatar (médico 3D, 6 poses
estáticas), em **espanhol** (idioma padrão da plataforma — `pt` e `es`
sempre lado a lado em `lib/i18n.tsx`, como o resto do projeto), explicando
**cada funcionalidade em detalhe**, mais um ícone "?" em cada página pra
reabrir só a explicação daquela funcionalidade específica, mesmo depois
do tour completo já ter passado.

## O que foi feito

### Arquitetura (React/Next, diferente do CRM na Mão que é JS puro)

- **`components/onboarding-tutorial.tsx`** (novo) — `TutorialProvider` +
  hook `useTutorial()`. Guarda o estado (passo atual, lista de passos
  ativa, posição do spotlight) e renderiza o overlay/cartão + o botão
  flutuante "Repasar tutorial" (canto inferior direito). Expõe duas
  funções pro resto do app: `abrirTutorialCompleto()` (os 18 passos) e
  `abrirAjudaPagina(passos)` (só 1-2 passos, sem spotlight).
- **`components/page-help-button.tsx`** (novo) — ícone "?" que entra no
  cabeçalho (`dashboard-header.tsx`), mapeia a rota atual
  (`usePathname()`) pra um passo específico do tutorial (array
  `ROTA_PARA_PASSOS`) e chama `abrirAjudaPagina()`. Em `/dashboard`
  (sem funcionalidade própria pra explicar) reabre o tour completo, igual
  o botão flutuante.
- **`components/dashboard-layout.tsx`** — agora envolve tudo com
  `<TutorialProvider>` (era só a estrutura sidebar+header+main antes).
  Como toda página chama `<DashboardLayout>` no próprio `page.tsx`, o
  provider (e portanto o botão flutuante + ícone "?") fica disponível em
  **todas** as páginas do dashboard, não só na home.
- **`lib/tutorial-status.ts`** (novo) — `getTutorialVisto()` /
  `marcarTutorialVisto()`, lendo/gravando
  `profiles.tutorial_dashboard_visto` no Supabase.
- **`supabase/migrations/20261008000000_tutorial_dashboard_visto.sql`**
  (novo) — `alter table profiles add column ... default false`.
  **PENDENTE: precisa ser rodada manualmente no SQL Editor do Supabase**
  (não tem CLI linkado a este projeto, mesmo padrão dos outros arquivos
  em `supabase/migrations/`) — sem isso, `getTutorialVisto()` sempre
  retorna `false` (coluna não existe ainda) e o tour completo vai tentar
  abrir sozinho toda vez que a página carregar.
- **`lib/i18n.tsx`** — novo namespace `tutorialDashboard` (18 pares
  título/texto + textos dos botões), adicionado **tanto em `pt` quanto em
  `es`** (`es` é o idioma padrão da plataforma — `const [lang, setLangState] = useState<Lang>("es")`
  — por isso o pedido "tutorial em espanhol" já fica atendido por padrão,
  sem quebrar o sistema bilíngue que o resto do app já tem).
- **`public/tutorial/avatar-medico-tutorial-1..6.webp`** (novos) — cópia
  exata dos mesmos 6 arquivos já usados no projeto CRM na Mão
  (`site/assets/avatar-medico-tutorial-1..6.webp`), ~9-10KB cada.

### Elementos marcados com `data-tutorial="..."` (pra servir de alvo do spotlight)

Adicionado em `components/daily-tip-header.tsx`, `daily-streak.tsx`,
`home-stats.tsx`, `quick-access-grid.tsx` (um `data-tutorial` por tile,
incluindo o Mesa Oral), `desempenho-widget.tsx`, `ranking-widget.tsx` e
`comunidade-banner.tsx`. Passos sem alvo correspondente (boas-vindas,
Materiais, encerramento, e todo o ajuda-por-página) mostram só o cartão
centralizado, sem destaque — `onboarding-tutorial.tsx` já trata isso
sozinho (`rect === null`).

### Os 18 passos do tour completo (nessa ordem)

Boas-vindas → Dica do dia → Sequência diária (streak) → Seu Progresso →
intro da grade "O Que Fazer Agora" → **Simulacro Libre** → **Simulacro
Timer Test** (explicitamente diferenciados -- mesmo banco de perguntas,
um é livre/sem pressão e o outro é cronometrado/modo prova real, sem
poder voltar) → Desafíos Clínicos → Hospital de Simulación (menciona que
é só pra planos pagos) → Cronograma → Actividades en la UNR (deixa claro
que é a agenda real da Facultad, não conteúdo de prova) → Calendario
(diferencia de Cronograma) → Mesa Oral (ainda "em breve") → Materiais
(sem spotlight -- fica só no menu lateral, não tem card na home) →
Desempenho → Ranking → Comunidade/Feedback → encerramento.

Conteúdo de cada passo foi escrito com base num levantamento detalhado
de como cada funcionalidade funciona de verdade (lido o código de
`simulados-content.tsx`, `desafios-clinicos-content.tsx`,
`hospital-simulacao-grid.tsx`, etc.) -- não é texto genérico.

### Validação feita

- `npx tsc --noEmit` -- **sem erros**.
- `npx next build` -- **build de produção completo passou**, todas as 63
  rotas geradas com sucesso, incluindo `/dashboard` e todas as páginas
  que o tutorial referencia.
- **Não testado visualmente num navegador real** (sem ferramenta de
  automação de browser disponível neste ambiente) -- o build/typecheck
  passando dá bastante confiança estrutural, mas vale abrir de verdade e
  clicar em cada passo antes de divulgar pros alunos.

### Pendências

1. **Rodar a migration SQL no Supabase** (seção acima) -- sem isso o
   tutorial completo tenta abrir sozinho toda vez.
2. Testar visualmente: tour completo (inclusive se o spotlight acompanha
   certinho cada elemento), o botão "?" em pelo menos 2-3 páginas
   diferentes, e o botão flutuante "Repasar tutorial".
3. **Push não confirmado por mim** -- mesmo problema de permissão já
   documentado (`leoozimalves` sem acesso de escrita no repo). Dar push
   manual pelo GitHub Desktop depois de conferir/commitar.
