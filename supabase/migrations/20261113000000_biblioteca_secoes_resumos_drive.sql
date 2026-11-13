-- Seções livres + resumos com capa (card 3D), guardados no Google Drive do
-- próprio admin via OAuth (conta Gmail comum, sem Drive Compartilhado).
--
-- Diferente de biblioteca_pastas (que só MAPEIA uma pasta pública do Drive por
-- matéria/tipo e lê via API Key), aqui o admin cria SEÇÕES com nome livre e
-- faz UPLOAD dos PDFs direto pela plataforma -- os arquivos vão pro Drive dele
-- (escopo drive.file, só arquivos criados pela própria plataforma), ficam
-- PRIVADOS no Drive e são baixados pelo aluno através do proxy já existente
-- (/api/biblioteca/arquivo/[id]?fonte=oauth), gated por login.

-- ───────────────────────── Seções ─────────────────────────
-- Cada seção = uma pasta criada pela plataforma no Drive do admin.
create table if not exists biblioteca_secoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text,
  drive_folder_id text not null,
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table biblioteca_secoes enable row level security;

create policy "biblioteca_secoes_select_authenticated"
  on biblioteca_secoes for select
  to authenticated
  using (true);

create policy "biblioteca_secoes_write_admin"
  on biblioteca_secoes for all
  to authenticated
  using (is_admin_or_colaborador())
  with check (is_admin_or_colaborador());

-- ───────────────────────── Resumos ─────────────────────────
-- Cada resumo = 1 PDF no Drive (drive_file_id) + 1 capa no Storage
-- (bucket público biblioteca-capas) + título. O card do aluno é montado
-- a partir dessa linha; o clique baixa o PDF direto do Drive.
create table if not exists biblioteca_resumos_drive (
  id uuid primary key default gen_random_uuid(),
  secao_id uuid not null references biblioteca_secoes(id) on delete cascade,
  titulo text not null,
  drive_file_id text not null,
  capa_path text,
  tamanho_bytes bigint,
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_biblioteca_resumos_drive_secao
  on biblioteca_resumos_drive (secao_id, ordem);

alter table biblioteca_resumos_drive enable row level security;

create policy "biblioteca_resumos_drive_select_authenticated"
  on biblioteca_resumos_drive for select
  to authenticated
  using (true);

create policy "biblioteca_resumos_drive_write_admin"
  on biblioteca_resumos_drive for all
  to authenticated
  using (is_admin_or_colaborador())
  with check (is_admin_or_colaborador());

-- ───────────────────── Bucket das capas ─────────────────────
-- Público (a capa é imagem leve e precisa de URL direta pra exibir no card).
-- Path: {secao_id}/{uuid}-{nome}. Só admin escreve.
insert into storage.buckets (id, name, public)
values ('biblioteca-capas', 'biblioteca-capas', true)
on conflict (id) do nothing;

drop policy if exists "biblioteca-capas public read" on storage.objects;
create policy "biblioteca-capas public read" on storage.objects
  for select using (bucket_id = 'biblioteca-capas');

drop policy if exists "biblioteca-capas admin write" on storage.objects;
create policy "biblioteca-capas admin write" on storage.objects
  for all
  using (bucket_id = 'biblioteca-capas' and is_admin_or_colaborador())
  with check (bucket_id = 'biblioteca-capas' and is_admin_or_colaborador());

-- ──────────────── Conexão OAuth do Drive (1 linha) ────────────────
-- Guarda o refresh_token da conta do admin que conectou o Drive. Sem
-- policies: só o service_role (rotas server /api/admin/drive/*) acessa --
-- NUNCA deve ser legível pelo navegador/aluno.
create table if not exists drive_oauth (
  id int primary key default 1,
  refresh_token text,
  account_email text,
  state text,
  state_criado_em timestamptz,
  atualizado_em timestamptz not null default now(),
  constraint drive_oauth_singleton check (id = 1)
);

alter table drive_oauth enable row level security;
-- (nenhuma policy de propósito -> só service_role, que ignora RLS)

insert into drive_oauth (id) values (1) on conflict (id) do nothing;
