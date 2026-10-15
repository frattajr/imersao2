/**
 * Acervo curado de clássicos em português (src/data/acervo.ts). O texto já
 * limpo e na grafia atual vem da cópia publicada no deploy
 * (scripts/build-acervo.ts). Se a obra ainda não estiver lá, baixa direto
 * do Wikisource (a API aceita pedidos do navegador e do celular) e atualiza
 * a grafia no aparelho.
 */
import { modernize } from '../core/orthography';
import { chunk } from '../core/text';
import type { BookMeta, Layer } from '../core/types';
import { fetchWikisourceBook } from '../core/wikisource';
import { acervoId, type AcervoEntry } from '../data/acervo';
import { getRepo } from '../state/db';
import { mirrorBase } from './gutenberg';
import type { ImportStep } from './importer';
import { syncSoon } from './sync';

export interface AcervoReady { slug: string; source: string; chars: number; modernized: boolean; cover?: string; layers?: Layer[]; words?: number }

/** Pasta do acervo publicada ao lado da cópia do Gutenberg. */
export const acervoBase = () => mirrorBase().replace(/\/gutenberg$/, '') + '/acervo';

let ready: Promise<Map<string, AcervoReady>> | null = null;

/** O que o deploy deixou pronto (texto e capa). Vazio se a cópia não existir. */
export function loadAcervo(): Promise<Map<string, AcervoReady>> {
  if (!ready) {
    ready = (async () => {
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 12_000);
        const r = await fetch(`${acervoBase()}/catalog.json`, { signal: ctl.signal }).finally(() => clearTimeout(t));
        if (!r.ok) return new Map();
        const j = (await r.json()) as { books?: AcervoReady[] };
        return new Map((j.books ?? []).map((b) => [b.slug, b]));
      } catch {
        return new Map();
      }
    })();
    void ready.then((m) => { if (!m.size) ready = null; }); // tenta de novo na próxima vez
  }
  return ready;
}

export const acervoCover = (r?: AcervoReady) => (r?.cover ? `${acervoBase()}/${r.cover}` : undefined);

async function textOf(a: AcervoEntry, step: ImportStep): Promise<string> {
  step(`Baixando “${a.title}”…`, null);
  try {
    const r = await fetch(`${acervoBase()}/books/${a.slug}.txt`);
    if (r.ok) {
      const t = await r.text();
      if (t.length > 1000 && !/^\s*</.test(t)) return t; // "<" = página de erro HTML
    }
  } catch { /* sem cópia: Wikisource */ }
  if (a.find.wikisource) {
    const t = await fetchWikisourceBook(fetch, a.find.wikisource, {
      author: a.author.split(' ').pop(), authorFull: a.author,
      step: (done, total) => step(`Baixando “${a.title}” do Wikisource…`, done / total),
    }).catch(() => null);
    if (t) {
      step('Atualizando a grafia…', null);
      return modernize(t);
    }
  }
  throw new Error(`Não consegui baixar “${a.title}” agora. Verifique a conexão e tente de novo.`);
}

/** Baixa (uma vez) e guarda na biblioteca. */
export async function openAcervoBook(a: AcervoEntry, step: ImportStep): Promise<BookMeta> {
  const repo = await getRepo();
  const id = acervoId(a.slug);
  const have = await repo.getBook(id);
  if (have && (await repo.hasText(id))) return have;
  const text = await textOf(a, step);
  step('Preparando as páginas…', null);
  const meta = await repo.addBook({ id, title: a.title, kind: 'file', sub: a.author, emoji: a.emoji }, chunk(text));
  syncSoon();
  return meta;
}
