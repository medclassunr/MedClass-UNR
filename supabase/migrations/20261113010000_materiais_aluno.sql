-- Upload de material PELO ALUNO. Cada aluno sobe os próprios arquivos pela
-- plataforma; eles vão pro Drive do admin (mesma conexão OAuth, escopo
-- drive.file) dentro de uma pasta-mãe "Materiais dos Alunos" (criada pela
-- PRÓPRIA plataforma -- com drive.file o app só escreve em pastas que ele
-- mesmo criou, por isso não dá pra usar uma pasta feita à mão no Drive) e,
-- dentro dela, numa subpasta por aluno nomeada "Nome (email)".
--
-- Visibilidade: cada aluno só vê/baixa de volta os materiais que ELE subiu
-- (RLS por user_id). O admin enxerga todos.

-- Pasta-mãe "Materiais dos Alunos": 1 só, guardada na linha singleton de
-- configuração do Drive. Criada sob demanda no primeiro upload.
alter table drive_oauth add column if not exists materiais_folder_id text;

-- Subpasta de cada aluno (1 por user). drive_folder_id = pasta no Drive.
create table if not exists aluno_materiais_pasta (
  user_id uuid primary key,
  drive_folder_id text not null,
  nome text,
  criado_em timestamptz not null default now()
);

alter table aluno_materiais_pasta enable row level security;
-- (sem policy de propósito -> só o service_role das rotas server acessa)

-- Cada arquivo enviado por um aluno.
create table if not exists aluno_materiais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  titulo text,
  nome_arquivo text not null,
  drive_file_id text not null,
  mime_type text,
  tamanho_bytes bigint,
  criado_em timestamptz not null default now()
);

create index if not exists idx_aluno_materiais_user
  on aluno_materiais (user_id, criado_em desc);

alter table aluno_materiais enable row level security;

-- O aluno lê só os próprios; admin/colaborador lê todos.
create policy "aluno_materiais_select_own"
  on aluno_materiais for select
  to authenticated
  using (user_id = auth.uid() or is_admin_or_colaborador());

-- Inserção/remoção pela rota server (service_role, ignora RLS). Ainda assim
-- deixamos o aluno apagar os próprios caso um dia precise via client.
create policy "aluno_materiais_delete_own"
  on aluno_materiais for delete
  to authenticated
  using (user_id = auth.uid() or is_admin_or_colaborador());
