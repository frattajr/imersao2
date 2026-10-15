-- Imersão: biblioteca sincronizada, cache da IA e limite de uso.

-- Biblioteca de cada leitor: metadados, progresso e glossário de cada livro.
-- O texto do livro fica no Storage (bucket "books"), em <owner>/<book_id>.json.
create table public.library (
  owner      uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  book_id    text        not null check (length(book_id) between 1 and 80),
  title      text        not null check (length(title) <= 200),
  kind       text        not null check (kind in ('builtin', 'file', 'pasted', 'cloud')),
  sub        text        not null default '' check (length(sub) <= 120),
  emoji      text        not null default '📚' check (length(emoji) <= 16),
  n          integer     not null default 0 check (n >= 0),
  idx        integer     not null default 0 check (idx >= 0),
  done       boolean     not null default false,
  gloss      jsonb       not null default '[]'::jsonb check (jsonb_typeof(gloss) = 'array' and pg_column_size(gloss) < 200000),
  updated_at timestamptz not null default now(),
  primary key (owner, book_id)
);

create index library_owner_updated on public.library (owner, updated_at);

alter table public.library enable row level security;

create policy "leitor vê a própria biblioteca" on public.library
  for select to authenticated using ((select auth.uid()) = owner);
create policy "leitor adiciona à própria biblioteca" on public.library
  for insert to authenticated with check ((select auth.uid()) = owner);
create policy "leitor altera a própria biblioteca" on public.library
  for update to authenticated using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);
create policy "leitor remove da própria biblioteca" on public.library
  for delete to authenticated using ((select auth.uid()) = owner);

-- Respostas da IA reaproveitadas entre leitores (planos de som por trecho,
-- glossários por trecho). Só as funções do servidor acessam: RLS ligado e
-- nenhuma política para clientes.
create table public.ai_cache (
  key        text        primary key,
  kind       text        not null,
  value      jsonb       not null,
  model      text,
  created_at timestamptz not null default now()
);
alter table public.ai_cache enable row level security;

-- Contagem diária de chamadas à IA por leitor (só chamadas que não vieram do cache).
create table public.ai_usage (
  owner uuid    not null references auth.users (id) on delete cascade,
  day   date    not null default current_date,
  calls integer not null default 0,
  primary key (owner, day)
);
alter table public.ai_usage enable row level security;

-- Soma uma chamada e diz se ainda está dentro do limite do dia.
create function public.bump_ai_usage(p_owner uuid, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  c integer;
begin
  insert into public.ai_usage (owner, day, calls)
  values (p_owner, current_date, 1)
  on conflict (owner, day) do update set calls = public.ai_usage.calls + 1
  returning calls into c;
  return c <= p_limit;
end;
$$;

revoke execute on function public.bump_ai_usage(uuid, integer) from public, anon, authenticated;
grant execute on function public.bump_ai_usage(uuid, integer) to service_role;

-- Storage: textos dos livros (privado, uma pasta por leitor) e pacote de sons (público).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('books', 'books', false, 52428800, array['application/json'])
on conflict (id) do nothing;

-- PDFs enviados só para extrair o texto; o servidor apaga logo depois de ler.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imports', 'imports', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sounds', 'sounds', true, 20971520, array['audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'application/json'])
on conflict (id) do nothing;

create policy "leitor lê os próprios livros" on storage.objects
  for select to authenticated
  using (bucket_id = 'books' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "leitor envia os próprios livros" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'books' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "leitor substitui os próprios livros" on storage.objects
  for update to authenticated
  using (bucket_id = 'books' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "leitor envia PDF para extrair" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'imports' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "leitor apaga os próprios livros" on storage.objects
  for delete to authenticated
  using (bucket_id = 'books' and (storage.foldername(name))[1] = (select auth.uid())::text);
