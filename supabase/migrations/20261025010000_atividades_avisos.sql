-- Avisos de "Actividades en la UNR" (agenda da Bedelía/FCM). Essas atividades
-- vêm de um site externo (HTML raspado), não existem no nosso banco -- então
-- quando o aluno ativa um aviso para a aula dele, guardamos aqui o essencial
-- (título, sala, data, hora de início) + a ANTECEDÊNCIA escolhida (2h, 1h,
-- 30min, 15min ou na hora). O dispatch (/api/push/dispatch) processa esta
-- tabela junto com o calendário e manda o push no celular no momento certo.
--
-- Um aviso = um push só (a antecedência escolhida). `enviado_em` serve de
-- dedup: depois de enviado, não dispara de novo. unique por aula+aluno pra
-- trocar a antecedência ser um upsert (não acumular avisos duplicados).

create table if not exists atividades_avisos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  sala text not null default '',
  data date not null,
  hora text not null, -- "HH:MM", início da aula
  antecedencia_min int not null default 0 check (antecedencia_min in (0, 15, 30, 60, 120)),
  enviado_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (user_id, data, hora, titulo, sala)
);

create index if not exists atividades_avisos_user_data_idx on atividades_avisos(user_id, data);

alter table atividades_avisos enable row level security;

create policy "atividades_avisos_owner_all"
  on atividades_avisos for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
