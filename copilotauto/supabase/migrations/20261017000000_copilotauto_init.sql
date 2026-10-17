-- CopilotAuto — esquema inicial
-- O backend grava com a service role. O app (anon + JWT do usuário) só lê as
-- próprias vistorias via RLS.

create extension if not exists pgcrypto;

-- ── Vistorias ───────────────────────────────────────────────────────────────
create table if not exists public.inspections (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  vehicle           jsonb not null,           -- make, model, year, km, vin, plate, asking_price
  terms_version     text not null,            -- versão dos termos aceitos (prova de ciência)
  terms_accepted_at timestamptz not null,
  created_at        timestamptz not null default now()
);
create index if not exists inspections_user_idx on public.inspections (user_id, created_at desc);

-- ── Achados por foto (histórico completo: refazer foto gera nova linha) ─────
create table if not exists public.findings (
  id               bigint generated always as identity primary key,
  inspection_id    uuid not null references public.inspections(id) on delete cascade,
  component_id     text not null,
  position         text check (position in ('FL', 'FR', 'RL', 'RR')),
  status           text not null check (status in ('GREEN', 'YELLOW', 'RED', 'INCONCLUSIVE')),
  confidence_score real not null check (confidence_score between 0 and 1),
  result           jsonb not null,            -- AnalysisResult entregue ao usuário
  source           text not null check (source in ('vision', 'ocr_rule', 'quality_gate', 'fallback')),
  model            text,                      -- provedor:modelo (auditoria)
  created_at       timestamptz not null default now()
);
create index if not exists findings_inspection_idx on public.findings (inspection_id, created_at);

-- ── Fotos temporárias (TTL 60 dias) ─────────────────────────────────────────
create table if not exists public.photos (
  path          text primary key,             -- caminho no bucket inspection-photos
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '60 days'
);
create index if not exists photos_expires_idx on public.photos (expires_at);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.inspections enable row level security;
alter table public.findings    enable row level security;
alter table public.photos      enable row level security;

drop policy if exists "dono lê vistorias" on public.inspections;
create policy "dono lê vistorias" on public.inspections
  for select using (auth.uid() = user_id);

drop policy if exists "dono apaga vistorias" on public.inspections;
create policy "dono apaga vistorias" on public.inspections
  for delete using (auth.uid() = user_id);

drop policy if exists "dono lê achados" on public.findings;
create policy "dono lê achados" on public.findings
  for select using (exists (
    select 1 from public.inspections i where i.id = inspection_id and i.user_id = auth.uid()
  ));

drop policy if exists "dono lê fotos" on public.photos;
create policy "dono lê fotos" on public.photos
  for select using (exists (
    select 1 from public.inspections i where i.id = inspection_id and i.user_id = auth.uid()
  ));

-- ── Storage: bucket privado, só JPEG até 6 MB ───────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inspection-photos', 'inspection-photos', false, 6291456, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Dono pode ler (gerar URL assinada) das fotos da própria vistoria.
-- Caminho no bucket: <inspection_id>/<componente>-<sufixo>.jpg
drop policy if exists "dono lê fotos da vistoria" on storage.objects;
create policy "dono lê fotos da vistoria" on storage.objects
  for select using (
    bucket_id = 'inspection-photos'
    and exists (
      select 1 from public.inspections i
      where i.id::text = (storage.foldername(name))[1] and i.user_id = auth.uid()
    )
  );

-- ── Expiração (TTL 60 dias) ─────────────────────────────────────────────────
-- O Supabase não permite apagar arquivos direto em storage.objects por SQL
-- (o arquivo físico ficaria órfão). Por isso a limpeza passa pela Storage API:
-- o pg_cron chama, uma vez por dia, POST /internal/purge-photos do backend.
-- Configure os dois segredos no Vault antes de ativar:
--   select vault.create_secret('https://api.seu-dominio.com', 'copilotauto_api_url');
--   select vault.create_secret('<CRON_SECRET>', 'copilotauto_cron_secret');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('copilotauto-purge-photos')
where exists (select 1 from cron.job where jobname = 'copilotauto-purge-photos');

select cron.schedule(
  'copilotauto-purge-photos',
  '17 4 * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'copilotauto_api_url')
               || '/internal/purge-photos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'copilotauto_cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);
