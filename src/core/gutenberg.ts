/**
 * Project Gutenberg sem rede: tipos do catálogo (formato do Gutendex),
 * formatação de autor/título/assuntos, limpeza do texto, leitura do
 * catálogo oficial em CSV e busca local. Usado pelo app e pelo script que
 * monta a cópia do catálogo no deploy (scripts/build-gutenberg.ts).
 */
import { modernize } from './orthography';
import { norm } from './text';
import type { Mood } from './types';

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

/** Título para mostrar: limpo e na grafia atual ("O Guarany" → "O Guarani"). */
export const displayTitle = (t: string) => modernize(cleanTitle(t), true);

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
export const readable = (b: GutBook) =>
  b.media_type === 'Text' && Object.keys(b.formats).some((k) => k.startsWith('text/plain') || k === 'application/epub+zip');

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
    // marcadores de página e ilustração das transcrições ("[Pg 12]", "{12}", "[Illustration]")
    .map((p) => p.replace(/\[(?:pg|pag|p[áa]gina)\.?\s*\d+\]|\{\d+\}/gi, '').replace(/\s+/g, ' ').trim())
    .filter((p) => p && !/^(produced by|e-text prepared by|transcriber'?s note|nota do transcritor)/i.test(p) && !/^[*\s.]+$/.test(p) && !/^\[(illustration|ilustra[çc][ãa]o)[^\]]*\]$/i.test(p));
  return paras.join('\n');
}

/* ---------- catálogo oficial (CSV) ---------- */

/** Lê um CSV com aspas (campos com vírgula, quebra de linha e "" escapado). */
export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = '', q = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (q) {
      if (ch === '"') { if (csv[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && csv[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some(Boolean));
}

/**
 * Livros em português do catálogo oficial do Gutenberg (pg_catalog.csv:
 * Text#, Type, Issued, Title, Language, Authors, Subjects, LoCC, Bookshelves).
 * Reserva para quando o Gutendex não responde.
 */
export function booksFromCatalogCsv(csv: string, lang = 'pt'): GutBook[] {
  const [head, ...rows] = parseCsv(csv);
  const col = (name: string) => head.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  const I = { id: col('Text#'), type: col('Type'), title: col('Title'), lang: col('Language'), authors: col('Authors'), subjects: col('Subjects'), shelves: col('Bookshelves') };
  return rows
    .filter((r) => r[I.type] === 'Text' && (r[I.lang] ?? '').split(/;\s*/).includes(lang))
    .map((r) => {
      const id = Number(r[I.id]);
      const authors = (r[I.authors] ?? '').split(/;\s*/).filter(Boolean).map((a) => {
        const m = /^(.*?),?\s*(\d{3,4})?\??-(\d{3,4})?\??(?:\s*\[.*\])?$/.exec(a.trim());
        return { name: (m ? m[1] : a).replace(/,\s*$/, '').trim(), birth_year: m?.[2] ? Number(m[2]) : null, death_year: m?.[3] ? Number(m[3]) : null };
      });
      return {
        id, title: (r[I.title] ?? '').replace(/\s+/g, ' ').trim(), authors, summaries: [],
        subjects: (r[I.subjects] ?? '').split(/;\s*/).filter(Boolean), bookshelves: (r[I.shelves] ?? '').split(/;\s*/).filter(Boolean),
        languages: (r[I.lang] ?? '').split(/;\s*/), copyright: false, media_type: 'Text', download_count: 0,
        formats: {
          'text/plain; charset=utf-8': `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
          'application/epub+zip': `https://www.gutenberg.org/ebooks/${id}.epub.noimages`,
          'image/jpeg': `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`,
        },
      } satisfies GutBook;
    })
    .filter((b) => b.id > 0 && b.title);
}

/* ---------- busca local ---------- */

/** Busca por título ou autor (sem acento, sem diferenciar maiúsculas; todas as palavras). */
export function searchBooks(books: GutBook[], query: string): GutBook[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return books;
  return books.filter((b) => {
    const hay = norm(`${b.title} ${modernize(b.title, true)} ${b.authors.map((a) => a.name).join(' ')} ${authorName(b)}`);
    return words.every((w) => hay.includes(w));
  });
}

/**
 * Acha uma obra no catálogo pelo título e pelo sobrenome do autor (sem
 * acento; aceita a grafia antiga do catálogo, como "Guarany" ou "Bazilio").
 * Prefere o título exato; entre parecidos, o mais curto (sem "volume 2",
 * coletâneas etc.).
 */
export function findInCatalog(books: GutBook[], title: string, author: string): GutBook | undefined {
  const key = (s: string) => norm(modernize(s, true)).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const t = key(title), a = key(author);
  const cands = books.filter((b) => b.authors.some((x) => key(x.name).includes(a)) && key(b.title).startsWith(t));
  return cands.sort((x, y) => Number(key(cleanTitle(y.title)) === t) - Number(key(cleanTitle(x.title)) === t) || x.title.length - y.title.length)[0];
}
