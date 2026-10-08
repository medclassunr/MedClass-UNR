-- Rode isso no SQL Editor do Supabase (projeto MedClass UNR).
-- Marca se o aluno já viu o tutorial guiado do dashboard (primeiro acesso).
-- Usado por components/onboarding-tutorial.tsx -- false/ausente = mostra o
-- tutorial sozinho na próxima vez que o aluno abrir /dashboard.
--
-- A policy "Users can update their own profile" (docs/avatar-perfil.sql)
-- já cobre update dessa coluna também, não precisa de policy nova (mesmo
-- caso já documentado em 20260805131807_nota_corte.sql).

alter table public.profiles add column if not exists tutorial_dashboard_visto boolean not null default false;
