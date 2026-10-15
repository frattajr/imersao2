-- Cache global para livros públicos (exemplos e Project Gutenberg).
--
-- As respostas da IA (planos de som, X-Ray, glossário, recapitulação) já são
-- guardadas por hash do trecho em ai_cache — o mesmo trecho dá a mesma
-- resposta para todos os leitores. Aqui:
--  * book_key marca de que livro público veio cada resposta (pré-calculada
--    por scripts/precompute-public.ts), para acompanhar a cobertura;
--  * o bucket public-books guarda os arquivos do Gutenberg já baixados pela
--    função `gutenberg`, para não baixar de novo a cada leitor.

alter table public.ai_cache add column if not exists book_key text check (book_key is null or length(book_key) <= 60);
create index if not exists ai_cache_book_key on public.ai_cache (book_key, kind) where book_key is not null;

-- Quanto do livro já está pré-calculado (para o painel/manutenção).
create or replace view public.public_book_coverage as
  select book_key, kind, count(*) as entries, max(created_at) as updated_at
    from public.ai_cache
   where book_key is not null
   group by book_key, kind;
revoke all on public.public_book_coverage from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-books', 'public-books', false, 20971520, array['application/octet-stream', 'text/plain', 'application/epub+zip'])
on conflict (id) do nothing;
