-- Push real no celular (Web Push). Duas tabelas:
--
-- 1. push_subscriptions: cada dispositivo que o aluno autorizou a receber
--    alertas guarda aqui a sua "inscrição" (endpoint + chaves p256dh/auth que
--    o navegador gera). Um aluno pode ter vários dispositivos (celular,
--    tablet, PC) -- por isso o unique é no endpoint, não no user_id. RLS
--    dono-only; o envio em si é feito pela service role (bypassa RLS) na rota
--    /api/push/dispatch.
--
-- 2. push_envios: log de deduplicação. O agendador (pg_cron, de minuto em
--    minuto) procura eventos "vencendo agora" numa janela de alguns minutos
--    pra tolerar atraso do cron -- sem esse log, o mesmo lembrete seria
--    reenviado a cada passada dentro da janela. O unique garante "no máximo um
--    envio por (evento, aluno, tipo de disparo)".

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  criado_em timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

create policy "push_subscriptions_owner_all"
  on push_subscriptions for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Disparos já enviados (dedup). tipo_disparo: 'antes15' (15 min antes) | 'hora'.
create table if not exists push_envios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  evento_id uuid not null references calendario_eventos(id) on delete cascade,
  tipo_disparo text not null check (tipo_disparo in ('antes15', 'hora')),
  enviado_em timestamptz not null default now(),
  unique (evento_id, user_id, tipo_disparo)
);

-- RLS ligada e SEM policy pública: só a service role (rota de dispatch) lê/grava.
alter table push_envios enable row level security;
