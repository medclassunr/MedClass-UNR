-- "Libros y Resúmenes": pastas do Google Drive organizadas por matéria,
-- listadas e baixadas em tempo real (sem copiar arquivo pra Storage/DB) +
-- anotações por aluno sobre os PDFs (marca-texto/caneta/etc.), guardadas
-- separadas do arquivo-fonte do Drive, que nunca é editado.

-- Mapa admin-editável: matéria + tipo -> pasta do Drive. O time cola o ID da
-- pasta aqui (painel /admin/biblioteca) depois de compartilhar "qualquer
-- pessoa com o link" no Drive -- sem precisar de deploy novo.
create table if not exists biblioteca_pastas (
  id uuid primary key default gen_random_uuid(),
  materia_key text not null,
  tipo text not null check (tipo in ('livro', 'resumo')),
  drive_folder_id text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (materia_key, tipo)
);

alter table biblioteca_pastas enable row level security;

create policy "biblioteca_pastas_select_authenticated"
  on biblioteca_pastas for select
  to authenticated
  using (true);

create policy "biblioteca_pastas_write_admin"
  on biblioteca_pastas for all
  to authenticated
  using (is_admin_or_colaborador())
  with check (is_admin_or_colaborador());

-- Anotações por aluno sobre um arquivo do Drive (fonte = 'drive'). Uma linha
-- por aluno+arquivo -- igual ao padrão já usado no CRM na Mão pra resumo do
-- admin: o PDF original nunca é tocado, as marcações ficam só aqui.
create table if not exists biblioteca_anotacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  drive_file_id text not null,
  drive_file_nome text,
  paginas jsonb not null default '[]',
  atualizado_em timestamptz not null default now(),
  unique (user_id, drive_file_id)
);

alter table biblioteca_anotacoes enable row level security;

create policy "biblioteca_anotacoes_owner_all"
  on biblioteca_anotacoes for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "biblioteca_anotacoes_admin_select"
  on biblioteca_anotacoes for select
  to authenticated
  using (is_admin_or_colaborador());
