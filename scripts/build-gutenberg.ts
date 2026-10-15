/**
 * Monta a cópia do Project Gutenberg publicada junto com o app (rodado no
 * deploy, no GitHub Actions, que tem acesso livre à internet):
 *
 *   <saída>/catalog.json        livros em português (Gutendex + catálogo oficial em CSV)
 *   <saída>/books/<id>.txt      texto já limpo dos livros mais lidos
 *
 * Assim o app não depende do Gutendex (lento/instável) nem do gutenberg.org
 * (que o navegador pode bloquear) na hora de mostrar a lista e abrir os
 * livros mais procurados. Nunca derruba o deploy: se nada der certo, não
 * escreve o catálogo e o app volta a consultar o Gutendex ao vivo.
 *
 * Uso: bun scripts/build-gutenberg.ts dist/gutenberg   (GUT_TEXTS=60 livros com texto)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { openingExcerpt, soundProfile } from '../src/core/catalog';
import { modernize } from '../src/core/orthography';
import type { Layer } from '../src/core/types';
import { booksFromCatalogCsv, cleanGutenbergText, readable, type GutBook, type GutPage } from '../src/core/gutenberg';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const GUTENDEX = 'https://gutendex.com/books/?languages=pt';
const CSV = 'https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(f: Fetch, url: string, timeoutMs: number, tries = 3): Promise<Response | null> {
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await f(url, { signal: ctl.signal, headers: { 'User-Agent': 'imersao-app catalog builder' } });
      if (r.ok) return r;
      if (r.status === 404) return null;
    } catch { /* tempo esgotado ou rede: tenta de novo */ } finally {
      clearTimeout(t);
    }
    await sleep(2000 * 2 ** i);
  }
  return null;
}

/** Só o que o app usa (o catálogo fica menor). */
function slim(b: GutBook): GutBook {
  const formats: Record<string, string> = {};
  for (const [k, v] of Object.entries(b.formats)) if (k.startsWith('text/plain') || k === 'application/epub+zip' || k === 'image/jpeg') formats[k] = v;
  return { ...b, summaries: (b.summaries ?? []).slice(0, 1).map((s) => s.slice(0, 700)), subjects: b.subjects.slice(0, 6), bookshelves: b.bookshelves.slice(0, 4), formats };
}

export async function buildMirror(
  f: Fetch, out: string,
  opts: { texts?: number; log?: (m: string) => void; maxPages?: number; budgetMs?: number } = {},
) {
  const log = opts.log ?? console.log;
  const t0 = Date.now();
  const budget = opts.budgetMs ?? 14 * 60_000; // cabe com folga no limite do passo do deploy
  const left = () => budget - (Date.now() - t0);
  const byId = new Map<number, GutBook>();
  const sources: string[] = [];
  const texts: number[] = [];
  /** para a vitrine: tamanho, climas e o começo do texto (sinopse em português) */
  const meta: Record<number, { words: number; layers: Layer[]; excerpt: string }> = {};

  const sorted = () => [...byId.values()].sort((a, b) => b.download_count - a.download_count);
  const save = async () => {
    if (!byId.size) return null;
    const catalog = { generatedAt: new Date().toISOString(), source: sources.join(' + '), books: sorted(), texts: [...texts].sort((a, b) => a - b), meta };
    await writeFile(join(out, 'catalog.json'), JSON.stringify(catalog));
    return catalog;
  };

  // 1) catálogo oficial do Gutenberg (CSV): completo e rápido
  log('Gutenberg: baixando o catálogo oficial (CSV)…');
  const csv = await get(f, CSV, 90_000, 2);
  if (csv) {
    const list = booksFromCatalogCsv(await csv.text());
    list.forEach((b) => byId.set(b.id, b));
    sources.push(`catálogo oficial (${list.length})`);
    log(`  ${list.length} livros em português.`);
  } else log('  catálogo oficial indisponível.');
  await save(); // já publica algo mesmo se o resto falhar

  // 2) Gutendex: número de downloads (ordem por popularidade) e resumos. Lento: prazo curto.
  log('Gutenberg: enriquecendo com o Gutendex…');
  let url: string | null = GUTENDEX, pages = 0;
  const gutendexUntil = Date.now() + Math.min(5 * 60_000, left() / 2);
  while (url && pages < (opts.maxPages ?? 15) && Date.now() < gutendexUntil) {
    const r = await get(f, url, 30_000, 2);
    if (!r) { log(`  Gutendex não respondeu na página ${pages + 1}; seguindo com o que já veio.`); break; }
    const page = (await r.json()) as GutPage;
    page.results.filter(readable).forEach((b) => byId.set(b.id, slim(b)));
    url = page.next;
    pages++;
    log(`  página ${pages} ok (${byId.size} livros).`);
  }
  if (pages) sources.push(`gutendex (${pages} páginas)`);
  if (!byId.size) { log('Nenhum livro obtido: catálogo não escrito (o app consulta o Gutendex ao vivo).'); return null; }
  await save();

  // 3) textos dos mais lidos, já limpos (até acabar o prazo)
  await mkdir(join(out, 'books'), { recursive: true });
  const want = sorted().slice(0, opts.texts ?? 60);
  log(`Gutenberg: copiando o texto de ${want.length} livros…`);
  let next = 0;
  const worker = async () => {
    while (next < want.length && left() > 20_000) {
      const b = want[next++];
      const urls = [`https://www.gutenberg.org/cache/epub/${b.id}/pg${b.id}.txt`, ...Object.entries(b.formats).filter(([k]) => k.startsWith('text/plain')).map(([, v]) => v)];
      for (const u of [...new Set(urls)]) {
        const r = await get(f, u, 30_000, 2);
        if (!r) continue;
        // grafia antiga ("elle", "pharmacia") passa para a atual; texto moderno fica igual
        const text = modernize(cleanGutenbergText(new TextDecoder('utf-8').decode(await r.arrayBuffer())));
        if (text.length > 500) {
          await writeFile(join(out, 'books', `${b.id}.txt`), text);
          texts.push(b.id);
          meta[b.id] = { ...soundProfile(text), excerpt: openingExcerpt(text) };
          if (texts.length % 10 === 0) { log(`  ${texts.length} textos copiados.`); await save(); }
          break;
        }
      }
      await sleep(250); // gentileza com o servidor do Gutenberg
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);

  const catalog = await save();
  log(`Gutenberg: ${catalog!.books.length} livros (${catalog!.source}), ${texts.length} com texto copiado, em ${Math.round((Date.now() - t0) / 1000)} s.`);
  return catalog;
}

if (import.meta.main) {
  const out = process.argv[2] ?? 'dist/gutenberg';
  await mkdir(out, { recursive: true });
  try {
    await buildMirror(fetch, out, { texts: Number(process.env.GUT_TEXTS ?? 60) });
  } catch (e) {
    console.log('Gutenberg: falhou ao montar a cópia (o deploy segue):', e);
  }
}
