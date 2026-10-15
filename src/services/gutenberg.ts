/**
 * Livros em domínio público do Project Gutenberg, pelo catálogo Gutendex
 * (https://gutendex.com). Lista os livros em português, com capa, autor e
 * assuntos; ao abrir, baixa o texto, limpa o cabeçalho/rodapé do Gutenberg,
 * remonta os parágrafos e guarda na biblioteca do aparelho.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseEpubBytes } from '../core/epub';
import { chunk } from '../core/text';
import type { BookMeta, Mood } from '../core/types';
import { getRepo } from '../state/db';
import type { ImportStep } from './importer';
import { supabase } from './supabase';
import { syncSoon } from './sync';

const API = 'https://gutendex.com/books/';
const CACHE_KEY = 'imersao.gutenberg.v1';
const CACHE_MS = 24 * 3600_000;

export interface GutAuthor { name: string; birth_year: number | null; death_year: number | null }
export interface GutBook {
  id: number;
  title: string;
  authors: GutAuthor[];
  summaries?: string[];
  subjects: string[];
  bookshelves: string[];
  languages: string[];
  copyright: boolean | null;
  media_type: string;
  formats: Record<string, string>;
  download_count: number;
}
export interface GutPage { count: number; next: string | null; previous: string | null; results: GutBook[] }

/** Categorias da biblioteca para os livros do Gutenberg. */
export const GUT_CATEGORIES = ['Romances', 'Contos', 'Poesia', 'Teatro', 'História e viagens', 'Outros'] as const;
export type GutCategory = (typeof GUT_CATEGORIES)[number];

export const bookId = (b: GutBook | number) => `gut-${typeof b === 'number' ? b : b.id}`;
export const isGutId = (id: string) => /^gut-\d+$/.test(id);

/** "Assis, Machado de" → "Machado de Assis". */
export function authorName(b: Pick<GutBook, 'authors'>): string {
  const a = b.authors[0]?.name ?? '';
  if (!a) return 'Autor desconhecido';
  const [last, first] = a.split(/,\s*/);
  return (first ? `${first} ${last}` : last).replace(/\s*\(.*?\)\s*/g, ' ').trim();
}

/** "Dom Casmurro: romance" → "Dom Casmurro"; tira espaços e quebras estranhas. */
export const cleanTitle = (t: string) => t.replace(/\s+/g, ' ').replace(/\s*[:;]\s.*$/, '').trim().slice(0, 90);

export function category(b: Pick<GutBook, 'subjects' | 'bookshelves'>): GutCategory {
  const s = [...b.subjects, ...b.bookshelves].join(' | ').toLowerCase();
  if (/poetry|poesia|poems|sonnets/.test(s)) return 'Poesia';
  if (/drama|theater|theatre|teatro|comedies|tragedies|plays/.test(s)) return 'Teatro';
  if (/short stories|contos|tales/.test(s)) return 'Contos';
  if (/history|histor|travel|voyages|biography|description and travel/.test(s)) return 'História e viagens';
  if (/fiction|novel|romance|romances/.test(s)) return 'Romances';
  return 'Outros';
}

/** Clima da capa desenhada (quando o livro não tem imagem de capa). */
export const CATEGORY_MOOD: Record<GutCategory, Mood> = {
  Romances: 'warm', Contos: 'forest', Poesia: 'night', Teatro: 'tension', 'História e viagens': 'sea', Outros: 'calm',
};

export function coverUrl(b: GutBook | number): string | undefined {
  if (typeof b === 'number') return `https://www.gutenberg.org/cache/epub/${b}/pg${b}.cover.medium.jpg`;
  return b.formats['image/jpeg'];
}

const SUBJECT_PT: [RegExp, string][] = [
  [/^Brazilian fiction$/i, 'Ficção brasileira'], [/^Portuguese fiction$/i, 'Ficção portuguesa'],
  [/^Brazilian poetry$/i, 'Poesia brasileira'], [/^Portuguese poetry$/i, 'Poesia portuguesa'],
  [/^Brazilian drama$/i, 'Teatro brasileiro'], [/^Portuguese drama$/i, 'Teatro português'],
  [/^Short stories, Brazilian$/i, 'Contos brasileiros'], [/^Short stories, Portuguese$/i, 'Contos portugueses'],
  [/^Love stories$/i, 'Histórias de amor'], [/^Historical fiction$/i, 'Romance histórico'], [/^Epic poetry/i, 'Poesia épica'],
  [/^Portugal -- History/i, 'História de Portugal'], [/^Brazil -- History/i, 'História do Brasil'], [/^Sonnets/i, 'Sonetos'],
];
const subjectPt = (x: string) => SUBJECT_PT.find(([r]) => r.test(x))?.[1] ?? x;

/** Resumo para a ficha: o do catálogo, se houver; senão os assuntos. */
export function synopsisOf(b: GutBook): string {
  const s = b.summaries?.find(Boolean);
  if (s) return s.replace(/\s*\(This is an automatically generated summary\.\)\s*$/i, '').trim();
  const subj = b.subjects.map((x) => subjectPt(x.replace(/ -- \d.*$/, '').replace(/ -- .*$/, (m) => (/history/i.test(m) ? m : ''))))
    .map((x) => x.replace(/ -- .*$/, '')).filter((x, i, a) => a.indexOf(x) === i).slice(0, 3);
  return `Clássico em domínio público${b.authors[0]?.death_year ? ` (autor falecido em ${b.authors[0].death_year})` : ''}.` +
    (subj.length ? ` Assuntos: ${subj.join('; ')}.` : '');
}

/** Só livros de texto que dá para ler no app. */
const readable = (b: GutBook) =>
  b.media_type === 'Text' && Object.keys(b.formats).some((k) => k.startsWith('text/plain') || k === 'application/epub+zip');

export async function fetchCatalog(opts: { page?: number; search?: string; topic?: string } = {}): Promise<GutPage> {
  const q = new URLSearchParams({ languages: 'pt' });
  if (opts.page && opts.page > 1) q.set('page', String(opts.page));
  if (opts.search) q.set('search', opts.search);
  if (opts.topic) q.set('topic', opts.topic);
  const r = await fetch(`${API}?${q.toString()}`);
  if (!r.ok) throw new Error(`Catálogo indisponível (${r.status}).`);
  const page = (await r.json()) as GutPage;
  return { ...page, results: (page.results ?? []).filter(readable) };
}

/** Livros mais baixados em português (2 páginas do catálogo), guardados por 24 h. */
export async function popularPortuguese(): Promise<GutBook[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw) as { at: number; books: GutBook[] };
      if (Date.now() - c.at < CACHE_MS && c.books.length) return c.books;
    }
  } catch { /* cache corrompido: busca de novo */ }
  const p1 = await fetchCatalog();
  const p2 = p1.next ? await fetchCatalog({ page: 2 }).catch(() => null) : null;
  const books = [...p1.results, ...(p2?.results ?? [])];
  try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), books })); } catch { /* sem espaço: segue sem cache */ }
  return books;
}

/* ---------- texto ---------- */

/**
 * Tira o cabeçalho e o rodapé do Project Gutenberg (licença, créditos) e
 * remonta os parágrafos: no .txt as linhas são quebradas a cada ~70
 * caracteres e os parágrafos são separados por linha em branco.
 */
export function cleanGutenbergText(raw: string): string {
  let t = raw.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const start = t.search(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\*\*\*/i);
  if (start >= 0) t = t.slice(t.indexOf('\n', start) + 1);
  const end = t.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i);
  if (end >= 0) t = t.slice(0, end);
  const paras = t.split(/\n\s*\n/)
    .map((p) => p.split('\n').map((l) => l.trim()).join(' ').replace(/\s+/g, ' ').replace(/_([^_]+)_/g, '$1').trim())
    .filter((p) => p && !/^(produced by|e-text prepared by|transcriber'?s note|nota do transcritor)/i.test(p) && !/^[*\s.]+$/.test(p));
  return paras.join('\n');
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
    const r = await fetch(url);
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
  const text = await fetchBookText(b, step);
  step('Preparando as páginas…', null);
  const pages = chunk(text);
  const meta = await repo.addBook({ id, title: cleanTitle(b.title), kind: 'file', sub: authorName(b), emoji: '📜' }, pages);
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
