-- Módulo "Prova Oral com IA" (Mesa Oral) -- protótipo restrito a admin
-- (public.is_admin()), integração com Groq. Ver RESUMO-SESSAO.md para o
-- contexto completo da Fase 1.
--
-- Reaproveita public.is_admin() (já existente, security definer, definida
-- em 20260806175812_rls_fix_infinite_recursion.sql) -- NÃO usa e-mail
-- hardcoded nem profiles.role inline, seguindo a convenção estabelecida em
-- 20260806111026_rls_remove_hardcoded_emails.sql (a única tabela que foge
-- disso no projeto é hospital_simulacao_casos, criada por engano depois
-- daquela auditoria -- não repetir o erro aqui).
--
-- Tabelas:
--   oral_question_bank       -- banco de perguntas + rubrica (resposta padrão)
--   oral_question_criteria   -- critérios de correção, pesos (soma = 100, validado por trigger)
--   oral_question_followups  -- complementares pré-cadastradas + condição de uso
--   oral_exams                -- sessão de prova de um aluno
--   oral_exam_items           -- questões principais selecionadas numa prova, em ordem
--   oral_exam_turns            -- cada pergunta feita (principal/complementar) + resposta
--   oral_exam_scores           -- nota consolidada por item, snapshot imutável
--   oral_ai_usage              -- ledger de uso/custo da Groq (fonte de verdade p/ limites,
--                                  NÃO usar lib/rate-limit.ts em memória pra isso)

begin;

-- ============================================================
-- oral_question_bank
-- ============================================================
create table public.oral_question_bank (
  id uuid primary key default gen_random_uuid(),
  disciplina text not null,
  tema text not null,
  nivel text,
  ordem integer not null default 1,
  pergunta text not null,
  resposta_padrao text not null,
  fontes text[] not null default '{}',
  status_revisao text not null default 'rascunho'
    check (status_revisao in ('rascunho', 'aprovado')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_oral_question_bank_tema on public.oral_question_bank (disciplina, tema, ordem);

alter table public.oral_question_bank enable row level security;

-- Só pergunta aprovada+ativa é visível pra quem não é admin (aluno nunca
-- deve ver rascunho/gabarito fora do fluxo de avaliação da prova).
create policy "oral_question_bank_select" on public.oral_question_bank
  for select to authenticated
  using ((status_revisao = 'aprovado' and ativo = true) or public.is_admin());

create policy "oral_question_bank_admin_write" on public.oral_question_bank
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- oral_question_criteria
-- ============================================================
create table public.oral_question_criteria (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.oral_question_bank(id) on delete cascade,
  criterio_codigo text not null,
  descricao text not null,
  peso integer not null check (peso > 0 and peso <= 100),
  conceitos_equivalentes text[] not null default '{}',
  ordem integer not null default 1,
  created_at timestamptz not null default now(),
  unique (question_id, criterio_codigo)
);

create index idx_oral_question_criteria_question on public.oral_question_criteria (question_id, ordem);

alter table public.oral_question_criteria enable row level security;

create policy "oral_question_criteria_select" on public.oral_question_criteria
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.oral_question_bank b
      where b.id = oral_question_criteria.question_id and b.status_revisao = 'aprovado' and b.ativo = true
    )
  );

create policy "oral_question_criteria_admin_write" on public.oral_question_criteria
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Garante que a soma dos pesos de uma pergunta seja sempre exatamente 100.
-- Deferred: só valida no COMMIT, permitindo inserir os critérios de uma
-- pergunta um a um (ou em lote) dentro da mesma transação.
create or replace function public.oral_check_criterios_peso_total()
returns trigger
language plpgsql
as $$
declare
  qid uuid;
  total integer;
begin
  qid := coalesce(new.question_id, old.question_id);
  select coalesce(sum(peso), 0) into total
  from public.oral_question_criteria
  where question_id = qid;
  if total <> 100 then
    raise exception 'A soma dos pesos dos critérios da pergunta % deve ser exatamente 100 (atual: %)', qid, total;
  end if;
  return null;
end;
$$;

create constraint trigger oral_question_criteria_peso_total
  after insert or update or delete on public.oral_question_criteria
  deferrable initially deferred
  for each row
  execute function public.oral_check_criterios_peso_total();

-- ============================================================
-- oral_question_followups
-- ============================================================
create table public.oral_question_followups (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.oral_question_bank(id) on delete cascade,
  codigo text not null,
  condicao text not null,
  pergunta text not null,
  resposta_esperada text not null,
  criterios_alvo text[] not null default '{}',
  ordem integer not null default 1,
  created_at timestamptz not null default now(),
  unique (question_id, codigo)
);

create index idx_oral_question_followups_question on public.oral_question_followups (question_id, ordem);

alter table public.oral_question_followups enable row level security;

create policy "oral_question_followups_select" on public.oral_question_followups
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.oral_question_bank b
      where b.id = oral_question_followups.question_id and b.status_revisao = 'aprovado' and b.ativo = true
    )
  );

create policy "oral_question_followups_admin_write" on public.oral_question_followups
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- oral_exams (sessão de prova)
-- ============================================================
create table public.oral_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  modo text not null check (modo in ('entrenamiento', 'examen')),
  disciplina text not null,
  tema text not null,
  total_perguntas_principais integer not null,
  max_complementares_por_pergunta integer not null default 2,
  status text not null default 'not_started' check (status in (
    'not_started', 'question_presented', 'waiting_for_answer', 'evaluating',
    'follow_up_pending', 'question_completed', 'completed', 'paused', 'failed', 'cancelled'
  )),
  pergunta_atual_index integer not null default 0,
  nota_final numeric,
  iniciado_em timestamptz,
  finalizado_em timestamptz,
  pausado_em timestamptz,
  created_at timestamptz not null default now()
);

create index idx_oral_exams_user on public.oral_exams (user_id, created_at desc);

alter table public.oral_exams enable row level security;

create policy "oral_exams_select_own" on public.oral_exams
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "oral_exams_insert_own" on public.oral_exams
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "oral_exams_update_own" on public.oral_exams
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ============================================================
-- oral_exam_items (questões principais selecionadas numa prova)
-- ============================================================
create table public.oral_exam_items (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.oral_exams(id) on delete cascade,
  question_id uuid not null references public.oral_question_bank(id),
  ordem integer not null,
  max_complementares integer not null default 2,
  num_complementares_usadas integer not null default 0,
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluida')),
  criterios_demonstrados jsonb not null default '{}'::jsonb,
  nota numeric,
  created_at timestamptz not null default now(),
  unique (exam_id, ordem)
);

create index idx_oral_exam_items_exam on public.oral_exam_items (exam_id, ordem);

alter table public.oral_exam_items enable row level security;

create policy "oral_exam_items_select_own" on public.oral_exam_items
  for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.oral_exams e where e.id = oral_exam_items.exam_id and e.user_id = auth.uid())
  );

create policy "oral_exam_items_insert_own" on public.oral_exam_items
  for insert to authenticated
  with check (
    exists (select 1 from public.oral_exams e where e.id = oral_exam_items.exam_id and e.user_id = auth.uid())
  );

create policy "oral_exam_items_update_own" on public.oral_exam_items
  for update to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.oral_exams e where e.id = oral_exam_items.exam_id and e.user_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.oral_exams e where e.id = oral_exam_items.exam_id and e.user_id = auth.uid())
  );

-- ============================================================
-- oral_exam_turns (pergunta feita + resposta do aluno)
-- ============================================================
create table public.oral_exam_turns (
  id uuid primary key default gen_random_uuid(),
  exam_item_id uuid not null references public.oral_exam_items(id) on delete cascade,
  tipo text not null check (tipo in ('principal', 'complementar')),
  followup_id uuid references public.oral_question_followups(id),
  origem_pergunta text not null default 'banco' check (origem_pergunta in ('banco', 'ia')),
  pergunta_texto text not null,
  resposta_texto text,
  resposta_transcricao_original text,
  modalidade_resposta text check (modalidade_resposta in ('texto', 'voz')),
  avaliacao jsonb,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create index idx_oral_exam_turns_item on public.oral_exam_turns (exam_item_id, created_at);
create unique index uq_oral_exam_turns_idempotency on public.oral_exam_turns (exam_item_id, idempotency_key)
  where idempotency_key is not null;

alter table public.oral_exam_turns enable row level security;

create policy "oral_exam_turns_select_own" on public.oral_exam_turns
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.oral_exam_items i
      join public.oral_exams e on e.id = i.exam_id
      where i.id = oral_exam_turns.exam_item_id and e.user_id = auth.uid()
    )
  );

create policy "oral_exam_turns_insert_own" on public.oral_exam_turns
  for insert to authenticated
  with check (
    exists (
      select 1 from public.oral_exam_items i
      join public.oral_exams e on e.id = i.exam_id
      where i.id = oral_exam_turns.exam_item_id and e.user_id = auth.uid()
    )
  );

create policy "oral_exam_turns_update_own" on public.oral_exam_turns
  for update to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.oral_exam_items i
      join public.oral_exams e on e.id = i.exam_id
      where i.id = oral_exam_turns.exam_item_id and e.user_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.oral_exam_items i
      join public.oral_exams e on e.id = i.exam_id
      where i.id = oral_exam_turns.exam_item_id and e.user_id = auth.uid()
    )
  );

-- ============================================================
-- oral_exam_scores (nota consolidada por item, snapshot imutável)
-- ============================================================
create table public.oral_exam_scores (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.oral_exams(id) on delete cascade,
  exam_item_id uuid not null unique references public.oral_exam_items(id) on delete cascade,
  nota numeric not null,
  criterios jsonb not null,
  erros_clinicos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_oral_exam_scores_exam on public.oral_exam_scores (exam_id);

alter table public.oral_exam_scores enable row level security;

create policy "oral_exam_scores_select_own" on public.oral_exam_scores
  for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.oral_exams e where e.id = oral_exam_scores.exam_id and e.user_id = auth.uid())
  );

create policy "oral_exam_scores_insert_own" on public.oral_exam_scores
  for insert to authenticated
  with check (
    exists (select 1 from public.oral_exams e where e.id = oral_exam_scores.exam_id and e.user_id = auth.uid())
  );

-- ============================================================
-- oral_ai_usage (ledger de custo -- fonte de verdade p/ limites, não o
-- rate-limiter em memória de lib/rate-limit.ts)
-- ============================================================
create table public.oral_ai_usage (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references public.oral_exams(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo_chamada text not null check (tipo_chamada in ('avaliacao', 'transcricao')),
  modelo text not null,
  tokens_entrada integer,
  tokens_saida integer,
  segundos_audio numeric,
  custo_estimado_usd numeric,
  erro text,
  created_at timestamptz not null default now()
);

create index idx_oral_ai_usage_user_date on public.oral_ai_usage (user_id, created_at desc);
create index idx_oral_ai_usage_date on public.oral_ai_usage (created_at desc);

alter table public.oral_ai_usage enable row level security;

-- Só leitura (admin) via RLS -- as inserções são feitas pelo backend com a
-- service role key (bypassa RLS), nunca pelo cliente direto.
create policy "oral_ai_usage_select_admin" on public.oral_ai_usage
  for select to authenticated
  using (public.is_admin());

commit;
