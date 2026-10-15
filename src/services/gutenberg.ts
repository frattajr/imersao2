/**
 * Livros em domínio público do Project Gutenberg. A fonte principal é a
 * cópia do catálogo e dos livros mais lidos montada no deploy e publicada
 * junto com o app (rápida e sem bloqueio do navegador); se ela não existir,
 * consulta o Gutendex (https://gutendex.com) e o gutenberg.org ao vivo.
 * Ao abrir, o texto é limpo, dividido em páginas e guardado no aparelho.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { parseEpubBytes } from '../core/epub';
import { modernize } from '../core/orthography';
import { chunk } from '../core/text';
import type { BookMeta } from '../core/types';
import { authorName, bookId, cleanGutenbergText, cleanTitle, displayTitle, readable, searchBooks, type GutBook, type GutPage } from '../core/gutenberg';

export * from '../core/gutenberg';
import { getRepo } from '../state/db';
import type { ImportStep } from './importer';
import { supabase } from './supabase';
import { syncSoon } from './sync';

const API = 'https://gutendex.com/books/';
const CACHE_KEY = 'imersao.gutenberg.v1';
const CACHE_MS = 24 * 3600_000;
const PAGE = 32;
/** Cópia publicada junto com a preview (usada pelo app do celular). */
const DEFAULT_MIRROR = 'https://frattajr.github.io/imersao2/gutenberg';

/**
 * Onde está a cópia do catálogo e dos livros montada no deploy
 * (scripts/build-gutenberg.ts). Na web é o próprio site — mesmo endereço,
 * então o navegador não bloqueia (sem CORS) e carrega na hora.
 */
export function mirrorBase(): string {
  const env = process.env.EXPO_PUBLIC_GUTENBERG_MIRROR;
  if (env) return env.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${process.env.EXPO_BASE_URL ?? ''}/gutenberg`;
  }
  return DEFAULT_MIRROR;
}

/** fetch com tempo máximo (o Gutendex às vezes demora muito ou não responde). */
async function fetchT(url: string, ms: number, init?: RequestInit): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

interface Snapshot { generatedAt: string; source: string; books: GutBook[]; texts: number[] }
let snapshot: Promise<Snapshot | null> | null = null;

/** Catálogo copiado no deploy (ou null se não houver). Carrega uma vez por sessão. */
export function loadSnapshot(): Promise<Snapshot | null> {
  if (!snapshot) {
    snapshot = (async () => {
      try {
        const r = await fetchT(`${mirrorBase()}/catalog.json`, 15_000);
        if (!r.ok) return null;
        const s = (await r.json()) as Snapshot;
        return Array.isArray(s.books) && s.books.length ? { ...s, texts: s.texts ?? [] } : null;
      } catch {
        return null;
      }
    })();
    void snapshot.then((s) => { if (!s) snapshot = null; }); // falhou: tenta de novo na próxima vez
  }
  return snapshot;
}

/** Livros prontos para ler na hora (texto já copiado no deploy) vêm primeiro; depois os mais baixados. */
const byPopularity = (s: Snapshot) => {
  const ready = new Set(s.texts);
  return [...s.books].sort((a, b) => Number(ready.has(b.id)) - Number(ready.has(a.id)) || b.download_count - a.download_count);
};

async function liveCatalog(opts: { page?: number; search?: string }): Promise<GutPage> {
  const q = new URLSearchParams({ languages: 'pt' });
  if (opts.page && opts.page > 1) q.set('page', String(opts.page));
  if (opts.search) q.set('search', opts.search);
  const r = await fetchT(`${API}?${q.toString()}`, 20_000);
  if (!r.ok) throw new Error(`Catálogo indisponível (${r.status}).`);
  const page = (await r.json()) as GutPage;
  return { ...page, results: (page.results ?? []).filter(readable) };
}

/**
 * Uma página do catálogo. Usa a cópia do deploy (busca local, instantânea);
 * se não houver cópia, consulta o Gutendex ao vivo.
 */
export async function fetchCatalog(opts: { page?: number; search?: string } = {}): Promise<GutPage> {
  const snap = await loadSnapshot();
  if (snap) {
    const all = searchBooks(byPopularity(snap), opts.search ?? '');
    const p = Math.max(1, opts.page ?? 1);
    return { count: all.length, next: p * PAGE < all.length ? String(p + 1) : null, previous: p > 1 ? String(p - 1) : null, results: all.slice((p - 1) * PAGE, p * PAGE) };
  }
  return liveCatalog(opts);
}

/** Livros mais baixados em português (para as fileiras da tela inicial). */
export async function popularPortuguese(): Promise<GutBook[]> {
  const snap = await loadSnapshot();
  if (snap) return byPopularity(snap).slice(0, 80);
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw) as { at: number; books: GutBook[] };
      if (Date.now() - c.at < CACHE_MS && c.books.length) return c.books;
    }
  } catch { /* cache corrompido: busca de novo */ }
  const p1 = await liveCatalog({});
  const p2 = p1.next ? await liveCatalog({ page: 2 }).catch(() => null) : null;
  const books = [...p1.results, ...(p2?.results ?? [])];
  try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), books })); } catch { /* sem espaço: segue sem cache */ }
  return books;
}

const decode = (buf: ArrayBuffer, contentType: string) => {
  const cs = /charset=([\w-]+)/i.exec(contentType)?.[1]?.toLowerCase() ?? 'utf-8';
  try { return new TextDecoder(cs === 'us-ascii' ? 'utf-8' : cs).decode(buf); } catch { return new TextDecoder('utf-8').decode(buf); }
};

/**
 * Baixa um arquivo do Gutenberg. No celular vai direto; no navegador, se o
 * site bloquear o acesso (CORS), tenta pela função `gutenberg` do servidor.
 */
async function download(url: string): Promise<{ buf: ArrayBuffer; type: string } | null> {
  try {
    const r = await fetchT(url, 30_000);
    if (r.ok) return { buf: await r.arrayBuffer(), type: r.headers.get('content-type') ?? '' };
  } catch { /* bloqueado ou sem rede: tenta pelo servidor */ }
  if (supabase) {
    const { data, error } = await supabase.functions.invoke('gutenberg', { body: { url } });
    if (!error && data) {
      const blob = data instanceof Blob ? data : new Blob([data as BlobPart]);
      return { buf: await blob.arrayBuffer(), type: blob.type };
    }
  }
  return null;
}

/** Texto do livro em parágrafos (prefere o .txt; se não houver, o EPUB). */
export async function fetchBookText(b: GutBook, step: ImportStep): Promise<string> {
  // 1º: cópia do deploy (já limpa, mesmo endereço do site, sem bloqueio do navegador)
  step(`Baixando “${cleanTitle(b.title)}”…`, null);
  try {
    const r = await fetchT(`${mirrorBase()}/books/${b.id}.txt`, 30_000);
    if (r.ok) {
      const text = await r.text();
      if (text.length > 500 && !/^\s*</.test(text)) return text; // "<" = página de erro HTML
    }
  } catch { /* sem cópia deste livro: baixa do Gutenberg */ }
  const plainKey = Object.keys(b.formats).filter((k) => k.startsWith('text/plain'))
    .sort((x, y) => Number(/utf-8/i.test(y)) - Number(/utf-8/i.test(x)))[0];
  const tries: { url: string; kind: 'txt' | 'epub'; type?: string }[] = [];
  if (plainKey) tries.push({ url: b.formats[plainKey], kind: 'txt', type: plainKey });
  tries.push({ url: `https://www.gutenberg.org/cache/epub/${b.id}/pg${b.id}.txt`, kind: 'txt', type: 'text/plain; charset=utf-8' });
  if (b.formats['application/epub+zip']) tries.push({ url: b.formats['application/epub+zip'], kind: 'epub' });
  for (const t of tries) {
    step(`Baixando “${cleanTitle(b.title)}”…`, null);
    const got = await download(t.url);
    if (!got) continue;
    if (t.kind === 'txt') {
      const text = cleanGutenbergText(decode(got.buf, /charset=/i.test(got.type) ? got.type : t.type ?? ''));
      if (text.length > 500) return text;
    } else {
      const parsed = await parseEpubBytes(new Uint8Array(got.buf), (p) => step('Lendo o livro…', p));
      if (parsed.text.length > 500) return parsed.text;
    }
  }
  throw new Error(supabase
    ? 'Não consegui baixar este livro agora. Tente de novo mais tarde.'
    : 'O navegador bloqueou o download do Project Gutenberg. No app do celular funciona direto; na versão web é preciso configurar o servidor (função "gutenberg").');
}

/** Baixa e guarda na biblioteca (ou só devolve, se já foi baixado). */
export async function openGutenbergBook(b: GutBook, step: ImportStep): Promise<BookMeta> {
  const repo = await getRepo();
  const id = bookId(b);
  const have = await repo.getBook(id);
  if (have && (await repo.hasText(id))) return have;
  const text = modernize(await fetchBookText(b, step));
  step('Preparando as páginas…', null);
  const pages = chunk(text);
  const meta = await repo.addBook({ id, title: displayTitle(b.title), kind: 'file', sub: authorName(b), emoji: '📜' }, pages);
  // guarda os dados do catálogo para a ficha e a capa, mesmo sem internet
  await repo.kvSet('gut:' + id, JSON.stringify({ ...b, formats: { 'image/jpeg': b.formats['image/jpeg'] } })).catch(() => undefined);
  syncSoon();
  return meta;
}

/** Dados do catálogo guardados quando o livro foi baixado. */
export async function savedGutInfo(id: string): Promise<GutBook | null> {
  try {
    const s = await (await getRepo()).kvGet('gut:' + id);
    return s ? (JSON.parse(s) as GutBook) : null;
  } catch {
    return null;
  }
}
