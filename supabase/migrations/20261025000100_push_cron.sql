-- Agendador do push: pg_cron chama a rota /api/push/dispatch de minuto em
-- minuto, e essa rota decide quem recebe alerta "agora" (na hora do estudo e
-- 15 min antes). Fica no Supabase (não em Vercel Cron) porque pg_cron roda a
-- cada minuto em QUALQUER plano -- Vercel Cron no plano Hobby só roda 1x/dia.
--
-- >>> ANTES DE RODAR, TROQUE OS DOIS PLACEHOLDERS ABAIXO: <<<
--   __DOMINIO__          -> https://medclass.com.ar   (sem barra no fim)
--   __PUSH_CRON_SECRET__ -> o MESMO valor da env PUSH_CRON_SECRET da Vercel
--
-- Rode no SQL Editor do Supabase (não há CLI linkado neste projeto).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove um agendamento anterior com o mesmo nome (idempotente ao re-rodar).
select cron.unschedule('medclass-push-dispatch')
where exists (select 1 from cron.job where jobname = 'medclass-push-dispatch');

select cron.schedule(
  'medclass-push-dispatch',
  '* * * * *',
  $$
  select net.http_post(
    url     := '__DOMINIO__/api/push/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '__PUSH_CRON_SECRET__'
    ),
    body    := '{}'::jsonb
  );
  $$
);
