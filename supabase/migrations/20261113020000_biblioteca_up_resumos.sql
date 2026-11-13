-- Resumos organizados por MATÉRIA → UP (Unidad de Problema) → cards.
--
-- Diferente de biblioteca_pastas (que mapeia 1 pasta do Drive por matéria/tipo
-- e lista via API Key) e das biblioteca_secoes (seções livres planas), aqui o
-- admin cria UPs livres dentro de cada matéria e, em cada UP, adiciona cards de
-- resumo escolhendo o ARQUIVO e a CAPA direto do Drive dele (Google Picker).
-- O arquivo fica só referenciado pelo drive_file_id (baixado pelo proxy
-- /api/biblioteca/arquivo/[id]?fonte=oauth); a capa é copiada pro bucket
-- público biblioteca-capas (imagem leve, precisa de URL direta no card).
--
-- Só muda os RESÚMENES -- Libros e o sistema de colar URL continuam como estão.

-- ───────────────────── UPs por matéria ─────────────────────
-- materia_key = chave do currículo (lib/unr-curriculum.ts). nome = "UP1" etc.
create table if not exists biblioteca_up (
  id uuid primary key default gen_random_uuid(),
  materia_key text not null,
  nome text not null,
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_biblioteca_up_materia
  on biblioteca_up (materia_key, ordem);

alter table biblioteca_up enable row level security;

create policy "biblioteca_up_select_authenticated"
  on biblioteca_up for select
  to authenticated
  using (true);

create policy "biblioteca_up_write_admin"
  on biblioteca_up for all
  to authenticated
  using (is_admin_or_colaborador())
  with check (is_admin_or_colaborador());

-- ───────────────────── Cards de resumo da UP ─────────────────────
create table if not exists biblioteca_up_resumos (
  id uuid primary key default gen_random_uuid(),
  up_id uuid not null references biblioteca_up(id) on delete cascade,
  titulo text not null,
  drive_file_id text not null,
  capa_path text,
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_biblioteca_up_resumos_up
  on biblioteca_up_resumos (up_id, ordem);

alter table biblioteca_up_resumos enable row level security;

create policy "biblioteca_up_resumos_select_authenticated"
  on biblioteca_up_resumos for select
  to authenticated
  using (true);

create policy "biblioteca_up_resumos_write_admin"
  on biblioteca_up_resumos for all
  to authenticated
  using (is_admin_or_colaborador())
  with check (is_admin_or_colaborador());

-- O bucket biblioteca-capas e suas policies já foram criados em
-- 20261113000000_biblioteca_secoes_resumos_drive.sql -- reaproveitado aqui.
