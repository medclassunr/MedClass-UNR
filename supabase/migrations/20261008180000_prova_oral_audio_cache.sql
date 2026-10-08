-- Cache de áudio TTS (Gemini 3.8 Flash-Lite) pra Prova Oral com IA.
-- As perguntas principais/complementares pré-cadastradas têm texto fixo --
-- gerar o áudio delas de novo a cada reprodução custaria sem necessidade.
-- Chave de cache = sha256(voz + "|" + texto), só pra complementares
-- GERADAS pela IA (texto novo sempre) é que o cache nunca vai bater.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prova-oral-audio', 'prova-oral-audio', true, 10485760, array['audio/wav'])
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['audio/wav'];

create table public.oral_audio_cache (
  id uuid primary key default gen_random_uuid(),
  texto_hash text not null unique,
  voz text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.oral_audio_cache enable row level security;

-- Só o backend (service role) escreve aqui -- RLS só precisa cobrir leitura
-- admin (o fluxo normal do aluno nunca consulta essa tabela direto, só
-- recebe a URL pública já resolvida pelo endpoint /api/mesa-oral/falar).
create policy "oral_audio_cache_select_admin" on public.oral_audio_cache
  for select to authenticated
  using (public.is_admin());

alter table public.oral_ai_usage drop constraint if exists oral_ai_usage_tipo_chamada_check;
alter table public.oral_ai_usage add constraint oral_ai_usage_tipo_chamada_check
  check (tipo_chamada in ('avaliacao', 'transcricao', 'tts'));

commit;
