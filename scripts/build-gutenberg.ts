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

export async function buildMirror(f: Fetch, out: string, opts: { texts?: number; log?: (m: string) => void; maxPages?: number } = {}) {
  const log = opts.log ?? console.log;
  const byId = new Map<number, GutBook>();
  const sources: string[] = [];

  // 1) Gutendex: tem número de downloads e resumo
  let url: string | null = GUTENDEX, pages = 0;
  while (url && pages < (opts.maxPages ?? 40)) {
    const r = await get(f, url, 45_000);
    if (!r) { log(`Gutendex não respondeu (${url}); seguindo com o que já veio.`); break; }
    const page = (await r.json()) as GutPage;
    page.results.filter(readable).forEach((b) => byId.set(b.id, slim(b)));
    url = page.next;
    pages++;
  }
  if (pages) sources.push(`gutendex (${pages} páginas)`);

  // 2) catálogo oficial: completa o que faltou (e salva o deploy se o Gutendex cair)
  const csv = await get(f, CSV, 120_000, 2);
  if (csv) {
    const extra = booksFromCatalogCsv(await csv.text()).filter((b) => !byId.has(b.id));
    extra.forEach((b) => byId.set(b.id, b));
    sources.push(`catálogo oficial (+${extra.length})`);
  } else log('Catálogo oficial (CSV) indisponível.');

  const books = [...byId.values()].sort((a, b) => b.download_count - a.download_count);
  if (!books.length) { log('Nenhum livro obtido: catálogo não escrito (o app consulta o Gutendex ao vivo).'); return null; }

  // 3) textos dos mais lidos, já limpos
  await mkdir(join(out, 'books'), { recursive: true });
  const want = books.slice(0, opts.texts ?? 60);
  const texts: number[] = [];
  let next = 0;
  const worker = async () => {
    while (next < want.length) {
      const b = want[next++];
      const urls = [`https://www.gutenberg.org/cache/epub/${b.id}/pg${b.id}.txt`, ...Object.entries(b.formats).filter(([k]) => k.startsWith('text/plain')).map(([, v]) => v)];
      for (const u of urls) {
        const r = await get(f, u, 60_000, 2);
        if (!r) continue;
        const text = cleanGutenbergText(new TextDecoder('utf-8').decode(await r.arrayBuffer()));
        if (text.length > 500) {
          await writeFile(join(out, 'books', `${b.id}.txt`), text);
          texts.push(b.id);
          break;
        }
      }
      await sleep(300); // gentileza com o servidor do Gutenberg
    }
  };
  await Promise.all([worker(), worker(), worker()]);

  const catalog = { generatedAt: new Date().toISOString(), source: sources.join(' + '), books, texts: texts.sort((a, b) => a - b) };
  await writeFile(join(out, 'catalog.json'), JSON.stringify(catalog));
  log(`Gutenberg: ${books.length} livros (${catalog.source}), ${texts.length} com texto copiado.`);
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
