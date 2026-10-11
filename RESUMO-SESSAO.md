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

---

# Sessão 08/10/2026 (continuação) — Avatar da médica + Prova Oral com IA

## Parte 1 — Acabamentos do tutorial (avatar médica)

Depois da sessão acima, o avatar foi trocado de médico pra **médica** (6
poses, fotos reais tratadas com `rembg`), com uma sequência de bugs
visuais resolvidos nessa ordem (histórico útil se o mesmo tipo de
problema voltar):

1. Jaleco branco "sumindo" -- não era bug de alpha/WebP (cheguei a
   suspeitar e tentei binarizar o canal alpha, não resolveu). Causa real:
   **contraste** (jaleco quase branco sobre o `--card: #ffffff` do tema
   claro) + pequenas mordidas reais de borda deixadas pelo `rembg`. Fix
   definitivo: recuperar as bordas comidas (o RGB original continuava lá,
   só o alpha cortava errado) + adicionar um contorno escuro fino em
   volta da silhueta. Também trocou o formato de WebP pra **PNG** (o
   decodificador de WebP+alpha do Safari/iOS tem bugs conhecidos,
   inconsistentes por aparelho).
2. Spotlight do tour trocado de um único `box-shadow` com espalhamento de
   9999px (técnica frágil, pode gerar artefato de composição em GPUs
   mobile) pra 4 blocos de máscara escura ao redor do recorte.
3. Pose "apontando pra direita" (`avatar-medica-tutorial-3`) fixada pra
   não aparecer sorteada no passo do Cronograma (o tile fica à esquerda
   na tela -- `avatarIdx` ganhou suporte a pose fixa opcional em
   `TutorialStep`).
4. Passo novo "Menu lateral" adicionado ao tour (entre Mesa Oral e
   Materiais).

**`components/dashboard-avatar-assistant.tsx`** (novo) -- substitui o
antigo `CalendarioLembretesBanner` (deletado). Avatar fixo no canto
superior direito (96px, pose fixa não sorteada) com um balão de
pensamento: mostra lembrete ativo do Cronograma/Calendario (dispensa ao
clicar, só nesta sessão -- sem flag de "visto" no banco) ou, sem
lembrete, funciona como FAQ com a lista de funcionalidades + um tópico
**"Planos Premium"** (explica Plano Grátis vs. Planos Pagos, com botão de
WhatsApp pro mesmo número já usado no resto do site). Setinha lateral
pra esconder/mostrar o avatar (útil se atrapalhar algo na tela).

## Parte 2 — Prova Oral com IA ("Mesa Oral"), restrito a admin

Pedido do usuário: testar um protótipo de simulação de prova oral médica
com IA, a partir de um prompt de especificação bem detalhado (19 seções
-- arquitetura, segurança, controle de custo, máquina de estados, banco
inicial de Pediatria/Convulsiones Febriles, etc.). Antes de implementar,
fiz uma análise do prompt contra o estado real do repositório (ver
transcript da conversa pra detalhes completos) -- principais divergências
encontradas: sistema de admin já existia (não precisava criar), banco de
questões existente não era reaproveitável (rubrica oral é estrutura
diferente), `lib/rate-limit.ts` é em memória/não confiável pra limites
diários (usar a tabela de ledger como fonte de verdade), `es-AR` não é um
idioma novo de UI (o bloco `es` do i18n já é em tom argentino).

Implementado em 2 fases + 2 rodadas de ajuste de voz:

### Fase 1 -- motor + endpoints (só texto)

- **Migrations**: `20261008120000_prova_oral_ia.sql` (8 tabelas:
  `oral_question_bank/criteria/followups`, `oral_exams/items/turns/scores`,
  `oral_ai_usage`) + `20261008120001_..._seed_convulsiones_febriles.sql`
  (5 perguntas + 3 complementares, revisadas contra RCH Melbourne/AAP/NICE).
  RLS via `public.is_admin()` (helper já existente, **não** e-mail
  hardcoded -- esse projeto já teve uma auditoria de segurança removendo
  esse padrão antigo, não repetir). Trigger impede soma de pesos de
  critério != 100.
- **`lib/groq.ts`**: cliente server-only (fetch puro). Testado de
  verdade contra a API real (chat completion com `reasoning_effort:
  "low"` + JSON Schema estrito funcionando; transcrição Whisper também
  validada com áudio sintetizado via `say`/`afconvert` no Mac).
- **`lib/oral-prova/engine.ts`**: motor de avaliação. Monta prompt com só
  a pergunta ativa + rubrica + histórico daquela pergunta (nunca a prova
  toda -- controle de custo). Valida a saída da IA com zod, só aceita
  `criterion_id` conhecidos, nunca retrocede um critério já demonstrado.
  Decide complementar (prioriza pré-cadastradas) vs. conclui vs. finaliza
  -- tudo no backend, IA só sugere. Cria os itens da prova **sob
  demanda** (item N+1 só existe quando o item N conclui) -- isso resolve
  de graça a regra "questão não apresentada não conta como respondida".
- 8 endpoints em `/api/mesa-oral/*` (iniciar, responder, pausar, retomar,
  finalizar, relatório, histórico, transcrever) + `/api/admin/groq-status`
  (testa conexão sem expor a chave) + `/api/admin/mesa-oral-consumo`
  (tokens/custo agregado).
- Gating: `components/mesa-oral-gate.tsx` -- client-side, usa
  `getPlanStatus().isAdmin` (mesmo padrão de `admin-layout.tsx`). Quem
  não é admin continua vendo o `ComingSoonContent` de sempre, zero
  mudança visível.
- UI mínima por texto em `components/mesa-oral-prova.tsx`.

### Fase 2 -- voz

- TTS inicial: `SpeechSynthesis` do navegador (grátis). Usuário reportou
  voz "muito robotizada e rápida" -- adicionei seletor de voz (entre as
  instaladas no aparelho) + velocidade/tom, mas o problema de fundo é que
  vozes robóticas do SO têm limite de qualidade.
- **Trocado pra Gemini 3.8 Flash-Lite TTS** (`lib/gemini.ts`) a pedido do
  usuário -- muito mais natural. **Detalhe importante**: o formato real
  da API (validado com chamada de teste de verdade) é diferente do que a
  doc pública descreve -- é o endpoint padrão
  `POST /v1beta/models/{modelo}:generateContent` com
  `generationConfig.responseModalities:["AUDIO"]` +
  `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName`, **não** o
  `/v1beta/interactions` que a doc menciona (a doc parece estar
  desatualizada ou descrevendo uma API diferente). Resposta:
  `candidates[0].content.parts[0].inlineData.{mimeType: "audio/wav", data: <base64>}`.
  Tem camada gratuita confirmada (2026-10-08); pago ~$6/1M tokens de
  áudio se passar do limite.
- **Cache de áudio**: migration `20261008180000_prova_oral_audio_cache.sql`
  -- bucket público `prova-oral-audio` no Storage + tabela
  `oral_audio_cache` (chave = sha256(voz+texto)). Perguntas
  pré-cadastradas (texto fixo) geram áudio **uma vez só** e reaproveitam
  pra sempre -- só complementares geradas pela IA custam de novo.
- Fallback automático pro `SpeechSynthesis` se a chamada ao Gemini falhar
  (chave, rate limit, rede) -- nunca trava a prova. Botão de reprodução
  manual se o navegador bloquear autoplay.
- Voz do aluno: `MediaRecorder` + Whisper (não o reconhecimento nativo do
  navegador -- decisão deliberada, `webkitSpeechRecognition` é instável
  demais entre Chrome/Safari/iOS pra confiar como via principal sem poder
  testar em aparelho real neste ambiente).
- `lib/mesa-oral-voz.ts::diagnosticarErroMic()` -- traduz o
  `DOMException.name` real (NotAllowedError, NotFoundError,
  NotReadableError, SecurityError) em vez de uma mensagem genérica de
  "não consegui acessar o microfone".

### Variáveis de ambiente novas (`.env.local`, **precisam existir também
na Vercel** -- `.env.local` nunca é deployado)

```
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b
GROQ_FALLBACK_MODEL=openai/gpt-oss-120b
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
GEMINI_API_KEY=
GEMINI_TTS_MODEL=gemini-3.8-flash-lite-tts
```

**Gotcha real que já aconteceu**: o usuário adicionou essas variáveis
como "Shared" na Vercel (nível de conta/time), mas uma variável Shared só
funciona se estiver **vinculada ao projeto** -- só aparecer na lista
Shared não basta. Se o erro "a chave ainda não foi configurada" voltar
depois de confirmar que a chave existe, check isso primeiro: Settings →
Environment Variables do projeto `med-class-unr2026`, adicionar
diretamente ali (não só na área Shared), marcar "Production", e dar
Redeploy.

### Commits desta parte (nessa ordem)
`b9315a3` (fix contorno avatar) → `dad8b00` (Fase 1) → `30cbe94` (Fase 2
voz) → `29a1b52` (seletor voz navegador) → `9d04e8f` (troca pra Gemini
TTS) → `5e0bf68` (diagnóstico de erro de microfone).

### Pendências / estado no momento de pausar

1. **Migrations pendentes de rodar no Supabase** (se ainda não rodadas):
   `20261008120000_prova_oral_ia.sql`,
   `20261008120001_prova_oral_seed_convulsiones_febriles.sql`,
   `20261008180000_prova_oral_audio_cache.sql`.
2. **Variáveis GROQ_*/GEMINI_* precisam estar como Environment Variable
   direta do projeto na Vercel** (não só Shared) + Redeploy -- ver gotcha
   acima. Usuário estava resolvendo isso quando a sessão pausou.
3. **Bug aberto, não resolvido**: no Mac (Chrome desktop), a gravação de
   voz falha com `NotAllowedError` mesmo com o ícone de permissão do
   site mostrando microfone liberado (confirmado via print). Hipótese
   mais provável: permissão do **macOS** (Ajustes do Sistema →
   Privacidade e Segurança → Microfone) não inclui o Chrome, ou foi
   concedida sem reiniciar o Chrome completamente (Cmd+Q). Estava
   pedindo um print dessa tela específica quando a sessão pausou. **No
   celular a gravação funcionou** (confirmado pelo usuário) -- o
   problema parece ser específico do Mac/Chrome desktop.
4. Painel admin de cadastro de perguntas (seção 13 do prompt original)
   **não foi implementado** -- as 5 perguntas são só via SQL/migration
   por enquanto. Fica pra uma fase futura se o protótipo for aprovado.
5. Push de todos os commits acima **não confirmado por mim** -- mesmo
   problema de permissão de sempre, usuário dá push manual pelo GitHub
   Desktop (ele já confirmou ter feito isso pelo menos até o commit
   `9d04e8f`; os commits depois disso, confirmar).
