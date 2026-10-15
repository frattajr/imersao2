/**
 * Monta o acervo curado de clássicos em português (src/data/acervo.ts),
 * publicado junto com o app. Roda no deploy (GitHub Actions tem internet):
 *
 *   <saída>/catalog.json          o que ficou pronto: fonte, capa, tamanho
 *   <saída>/books/<slug>.txt      texto limpo, em parágrafos, na grafia atual
 *   <saída>/covers/<slug>.jpg     capa da Open Library (quando existe)
 *
 * Fontes do texto, nesta ordem: Project Gutenberg (achado por título + autor
 * no catálogo oficial) e Wikisource em português. Nunca derruba o deploy.
 *
 * Uso: bun scripts/build-acervo.ts dist/acervo
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { booksFromCatalogCsv, cleanGutenbergText, findInCatalog, type GutBook } from '../src/core/gutenberg';
import { looksArchaic, modernize } from '../src/core/orthography';
import { fetchWikisourceBook } from '../src/core/wikisource';
import { ACERVO, type AcervoEntry } from '../src/data/acervo';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
const CSV = 'https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface AcervoReady {
  slug: string;
  /** "gutenberg:55752" ou "wikisource:Dom Casmurro" */
  source: string;
  chars: number;
  /** a grafia foi atualizada */
  modernized: boolean;
  /** caminho relativo da capa (covers/<slug>.jpg) */
  cover?: string;
}

async function get(f: Fetch, url: string, timeoutMs: number, tries = 2): Promise<Response | null> {
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await f(url, { signal: ctl.signal, headers: { 'User-Agent': 'imersao-app acervo builder' } });
      if (r.ok) return r;
      if (r.status === 404) return null;
    } catch { /* rede: tenta de novo */ } finally { clearTimeout(t); }
    await sleep(1500 * 2 ** i);
  }
  return null;
}

async function fromGutenberg(f: Fetch, catalog: GutBook[], a: AcervoEntry): Promise<{ text: string; source: string } | null> {
  if (!a.find.gutenberg) return null;
  const b = findInCatalog(catalog, a.find.gutenberg.title, a.find.gutenberg.author);
  if (!b) return null;
  const r = await get(f, `https://www.gutenberg.org/cache/epub/${b.id}/pg${b.id}.txt`, 40_000);
  if (!r) return null;
  const text = cleanGutenbergText(new TextDecoder('utf-8').decode(await r.arrayBuffer()));
  return text.length > 2000 ? { text, source: `gutenberg:${b.id}` } : null;
}

async function fromWikisource(f: Fetch, a: AcervoEntry): Promise<{ text: string; source: string } | null> {
  if (!a.find.wikisource) return null;
  const text = await fetchWikisourceBook(f, a.find.wikisource, { author: a.author.split(' ').pop() })
    .catch((e: unknown) => { console.log(`    Wikisource (${a.find.wikisource}): ${e instanceof Error ? e.message : String(e)}`); return null; });
  return text && text.length > 1500 ? { text, source: `wikisource:${a.find.wikisource}` } : null;
}

/** Capa da Open Library: procura pelo título e autor, prefere edição em português. */
async function cover(f: Fetch, a: AcervoEntry, out: string): Promise<string | undefined> {
  const q = new URLSearchParams({ title: a.title, author: a.author, fields: 'cover_i,language', limit: '15' });
  const r = await get(f, `https://openlibrary.org/search.json?${q.toString()}`, 20_000);
  if (!r) return undefined;
  const docs = ((await r.json()) as { docs?: { cover_i?: number; language?: string[] }[] }).docs ?? [];
  const pick = docs.find((d) => d.cover_i && d.language?.includes('por')) ?? docs.find((d) => d.cover_i);
  if (!pick?.cover_i) return undefined;
  const img = await get(f, `https://covers.openlibrary.org/b/id/${pick.cover_i}-L.jpg?default=false`, 30_000);
  if (!img) return undefined;
  const buf = new Uint8Array(await img.arrayBuffer());
  if (buf.length < 3000) return undefined; // imagem vazia/placeholder
  await writeFile(join(out, 'covers', `${a.slug}.jpg`), buf);
  return `covers/${a.slug}.jpg`;
}

export async function buildAcervo(f: Fetch, out: string, opts: { log?: (m: string) => void; budgetMs?: number } = {}) {
  const log = opts.log ?? console.log;
  const t0 = Date.now();
  const left = () => (opts.budgetMs ?? 12 * 60_000) - (Date.now() - t0);
  await mkdir(join(out, 'books'), { recursive: true });
  await mkdir(join(out, 'covers'), { recursive: true });

  log('Acervo: lendo o catálogo oficial do Gutenberg…');
  const csv = await get(f, CSV, 90_000);
  const catalog = csv ? booksFromCatalogCsv(await csv.text()) : [];
  log(`  ${catalog.length} livros em português no catálogo.`);

  const ready: AcervoReady[] = [];
  const save = () => writeFile(join(out, 'catalog.json'), JSON.stringify({ generatedAt: new Date().toISOString(), books: ready }));
  let next = 0;
  const worker = async () => {
    while (next < ACERVO.length && left() > 30_000) {
      const a = ACERVO[next++];
      try {
        const got = (await fromGutenberg(f, catalog, a).catch(() => null)) ?? (await fromWikisource(f, a));
        if (!got) { log(`  ✗ ${a.title}: texto não encontrado`); continue; }
        const modernized = looksArchaic(got.text);
        const text = modernized ? modernize(got.text) : got.text;
        await writeFile(join(out, 'books', `${a.slug}.txt`), text);
        const c = await cover(f, a, out).catch(() => undefined);
        ready.push({ slug: a.slug, source: got.source, chars: text.length, modernized, cover: c });
        log(`  ✓ ${a.title} (${got.source}, ${Math.round(text.length / 1000)} mil caracteres${modernized ? ', grafia atualizada' : ''}${c ? ', capa' : ''})`);
        await save();
      } catch (e) {
        // uma obra com problema não derruba as outras
        log(`  ✗ ${a.title}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  };
  await Promise.all([worker(), worker()]); // gentileza com o Wikisource (cada obra já baixa capítulos em paralelo)
  await save();
  log(`Acervo: ${ready.length}/${ACERVO.length} obras prontas em ${Math.round((Date.now() - t0) / 1000)} s.`);
  return ready;
}

if (import.meta.main) {
  const out = process.argv[2] ?? 'dist/acervo';
  try {
    await buildAcervo(fetch, out);
  } catch (e) {
    console.log('Acervo: falhou (o deploy segue; o app baixa do Wikisource na hora):', e);
  }
}
