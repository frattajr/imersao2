-- Repositório de sons: cada som (gravado ou gerado por IA) com a descrição
-- padronizada que o identifica. A função sound-resolve procura o mais
-- parecido e só gera um novo quando nada serve. Os arquivos ficam no bucket
-- público "sounds", em lib/<cat>/<name>/<id>.mp3 (ou no caminho do pacote gravado).

create table public.sound_library (
  id         uuid        primary key default gen_random_uuid(),
  key        text        not null,
  cat        text        not null check (cat in ('layer', 'spot')),
  name       text        not null check (length(name) <= 24),
  material   text        check (length(material) <= 16),
  place      text        check (length(place) <= 16),
  distance   text        check (length(distance) <= 8),
  intensity  text        check (length(intensity) <= 8),
  detail     text        check (length(detail) <= 60),
  path       text        check (length(path) <= 300),
  source     text        not null check (source in ('recorded', 'generated')),
  status     text        not null check (status in ('generating', 'ok', 'failed', 'rejected')),
  model      text,
  bytes      integer,
  uses       integer     not null default 0,
  reports    integer     not null default 0,
  created_at timestamptz not null default now(),
  check (status <> 'ok' or path is not null)
);

create index sound_library_lookup on public.sound_library (cat, name) where status = 'ok';
create index sound_library_created on public.sound_library (created_at) where source = 'generated';
-- no máximo uma geração em andamento por chave: dois leitores pedindo o mesmo som novo não pagam duas vezes
create unique index sound_library_one_generating on public.sound_library (key) where status = 'generating';

-- Só as funções do servidor acessam (RLS ligado, nenhuma política para clientes).
alter table public.sound_library enable row level security;

-- Quem já marcou cada som como ruim (um voto por leitor).
create table public.sound_reports (
  owner      uuid        not null references auth.users (id) on delete cascade,
  sound_id   uuid        not null references public.sound_library (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner, sound_id)
);
alter table public.sound_reports enable row level security;

-- Reserva a geração de uma chave. Devolve null se já há geração em andamento
-- ou se ela falhou há menos de 6 horas (não insiste num som que o modelo não acerta).
-- Gerações presas há mais de 10 minutos contam como falha.
create function public.claim_sound(
  p_key text, p_cat text, p_name text, p_material text, p_place text,
  p_distance text, p_intensity text, p_detail text, p_model text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v uuid;
begin
  update public.sound_library set status = 'failed'
   where key = p_key and status = 'generating' and created_at < now() - interval '10 minutes';
  if exists (select 1 from public.sound_library
              where key = p_key and status = 'failed' and created_at > now() - interval '6 hours') then
    return null;
  end if;
  insert into public.sound_library (key, cat, name, material, place, distance, intensity, detail, source, status, model)
  values (p_key, p_cat, p_name, p_material, p_place, p_distance, p_intensity, p_detail, 'generated', 'generating', p_model)
  on conflict do nothing
  returning id into v;
  return v;
end;
$$;

-- Soma usos dos sons reaproveitados (para saber quais valem uma gravação melhor).
create function public.bump_sound_uses(p_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.sound_library set uses = uses + 1 where id = any (p_ids);
$$;

-- Voto de "som ruim". Com 3 leitores diferentes, o som sai do repositório
-- (e a próxima busca gera outro, se a geração estiver ligada).
create function public.report_sound(p_owner uuid, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.sound_reports (owner, sound_id) values (p_owner, p_id) on conflict do nothing;
  if not found then return false; end if;
  update public.sound_library set reports = reports + 1 where id = p_id returning reports into n;
  if n >= 3 then
    update public.sound_library set status = 'rejected' where id = p_id;
  end if;
  return true;
end;
$$;

revoke execute on function public.claim_sound(text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.bump_sound_uses(uuid[]) from public, anon, authenticated;
revoke execute on function public.report_sound(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_sound(text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.bump_sound_uses(uuid[]) to service_role;
grant execute on function public.report_sound(uuid, uuid) to service_role;
