/**
 * Pré-calcula, no cache global do servidor, os planos de som dos livros
 * públicos (exemplos sem plano calibrado e clássicos da cópia do Gutenberg).
 * Depois disso, quem lê esses livros recebe os planos da IA sem que a IA
 * rode de novo — o app só pede ao servidor com `cacheOnly`.
 *
 * Roda na máquina de quem mantém o app (custa chamadas à IA uma única vez):
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... PRECOMPUTE_SECRET=... \
 *     bun scripts/precompute-public.ts [pasta-ou-url-da-cópia-do-gutenberg] [--limit 20]
 *
 * O mesmo PRECOMPUTE_SECRET (16+ caracteres) precisa estar nos segredos das
 * funções: npx supabase secrets set PRECOMPUTE_SECRET=...
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { displayTitle as cleanTitle } from '../src/core/gutenberg';
import { chunk } from '../src/core/text';
import { SAMPLE_BOOKS } from '../src/data/books';
import { ACERVO, acervoId } from '../src/data/acervo';

const URL_ = process.env.SUPABASE_URL?.replace(/\/$/, '');
const ANON = process.env.SUPABASE_ANON_KEY;
const SECRET = process.env.PRECOMPUTE_SECRET;
if (!URL_ || !ANON || !SECRET) {
  console.error('Defina SUPABASE_URL, SUPABASE_ANON_KEY e PRECOMPUTE_SECRET.');
  process.exit(1);
}
const args = process.argv.slice(2);
const mirror = args.find((a) => !a.startsWith('--'));
const limit = Number(args[args.indexOf('--limit') + 1]) || 20;
const BATCH = 8; // o mesmo lote do app (src/state/scene.ts): mesmo trecho = mesma chave no cache

async function call(fn: string, body: unknown) {
  const r = await fetch(`${URL_}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ANON}`, apikey: ANON!, 'content-type': 'application/json', 'x-precompute-secret': SECRET! },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${fn} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json() as Promise<{ cached?: boolean }>;
}

async function soundPlans(bookKey: string, title: string, pages: string[]) {
  let fresh = 0, cached = 0;
  for (let from = 0; from < pages.length; from += BATCH) {
    const r = await call('sound-plan', { title, pages: pages.slice(from, from + BATCH), bookKey });
    if (r.cached) cached++; else fresh++;
  }
  console.log(`  ${bookKey}: ${fresh} lotes novos, ${cached} já estavam no cache`);
}

const read = async (path: string) => (/^https?:/.test(path) ? (await fetch(path)).text() : readFile(path, 'utf8'));

// 1) exemplos sem plano calibrado
for (const b of SAMPLE_BOOKS.filter((x) => !x.plans?.length)) {
  await soundPlans(b.id, b.title, b.pages);
}

// 2) acervo curado em português (prioridade: é o que aparece primeiro na biblioteca)
if (mirror) {
  const dir = mirror.replace(/gutenberg\/?$/, 'acervo');
  const cat = await read(join(dir, 'catalog.json')).then((t) => JSON.parse(t) as { books: { slug: string }[] }).catch(() => null);
  for (const r of cat?.books ?? []) {
    const a = ACERVO.find((x) => x.slug === r.slug);
    if (!a) continue;
    await soundPlans(acervoId(a.slug), a.title, chunk(await read(join(dir, 'books', `${a.slug}.txt`))));
  }
}

// 3) clássicos da cópia do Gutenberg (os que têm texto copiado), os mais lidos primeiro
if (mirror) {
  const cat = JSON.parse(await read(join(mirror, 'catalog.json'))) as { books: { id: number; title: string }[]; texts: number[] };
  const ready = new Set(cat.texts);
  for (const b of cat.books.filter((x) => ready.has(x.id)).slice(0, limit)) {
    const text = await read(join(mirror, 'books', `${b.id}.txt`));
    await soundPlans(`gut-${b.id}`, cleanTitle(b.title), chunk(text));
  }
}
console.log('Pré-cálculo concluído.');
