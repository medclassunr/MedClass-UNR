-- "Meus arquivos": o aluno sobe o PRÓPRIO PDF de resumo por matéria (até 5
-- por matéria) e anota com o mesmo editor usado nos arquivos do Drive --
-- mesma arquitetura já usada no CRM na Mão (documentos_aluno), adaptada pra
-- auth.uid() direto (aqui não existe tabela própria de "alunos").

create table if not exists biblioteca_documentos_proprios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  materia_key text not null,
  storage_path text not null,
  nome_arquivo text not null,
  tamanho_bytes bigint not null,
  criado_em timestamptz not null default now()
);

alter table biblioteca_documentos_proprios enable row level security;

create policy "biblioteca_documentos_proprios_owner_all"
  on biblioteca_documentos_proprios for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "biblioteca_documentos_proprios_admin_select"
  on biblioteca_documentos_proprios for select
  to authenticated
  using (is_admin_or_colaborador());

create or replace function limitar_biblioteca_documentos_proprios()
returns trigger
language plpgsql as $$
declare
  qtd int;
begin
  select count(*) into qtd from biblioteca_documentos_proprios
    where user_id = new.user_id and materia_key = new.materia_key;
  if qtd >= 5 then
    raise exception 'Limite de 5 arquivos por matéria atingido.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_limitar_biblioteca_documentos_proprios on biblioteca_documentos_proprios;
create trigger trg_limitar_biblioteca_documentos_proprios
  before insert on biblioteca_documentos_proprios
  for each row execute function limitar_biblioteca_documentos_proprios();

-- Bucket privado -- path {auth.uid()}/{materia_key}/{uuid}-{nome}.
insert into storage.buckets (id, name, public)
values ('biblioteca-proprios', 'biblioteca-proprios', false)
on conflict (id) do nothing;

drop policy if exists "biblioteca-proprios owner rw" on storage.objects;
create policy "biblioteca-proprios owner rw" on storage.objects
  for all using (bucket_id = 'biblioteca-proprios' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'biblioteca-proprios' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "biblioteca-proprios admin select" on storage.objects;
create policy "biblioteca-proprios admin select" on storage.objects
  for select using (bucket_id = 'biblioteca-proprios' and is_admin_or_colaborador());
