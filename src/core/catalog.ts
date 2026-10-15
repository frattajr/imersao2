/**
 * Catálogo unificado: tudo que aparece na biblioteca (exemplos sonorizados,
 * acervo curado, clássicos em domínio público e os livros da pessoa) num
 * formato só, com as funções que a vitrine e a busca usam — duração no
 * ritmo da pessoa, filtros, busca sem acento, volumes repetidos,
 * recomendações, gostos e a sequência de dias de leitura.
 *
 * Sem rede e sem React: roda no app, nos testes e nos scripts do deploy.
 */
import { analyze } from './analyze';
import { modernize } from './orthography';
import { norm, plain } from './text';
import type { Layer, Mood } from './types';

export type Source = 'sample' | 'acervo' | 'gut' | 'mine';
export type Origin = 'BR' | 'PT';

export interface CatalogEntry {
  id: string;
  title: string;
  author: string;
  source: Source;
  /** Romance, Contos, Poesia, Teatro, Ensaio… */
  kind?: string;
  origin?: Origin;
  /** ano da obra (ou, sem ele, da morte do autor) */
  year?: number;
  /** tamanho em palavras (para a duração) */
  words?: number;
  /** climas sonoros que dominam o livro */
  layers: Layer[];
  tags: string[];
  /** sonorização calibrada cena a cena (e não automática pelo texto) */
  calibrated: boolean;
  /** dá para abrir agora (na web, sem servidor, alguns clássicos não abrem) */
  openable: boolean;
  mood?: Mood;
}

/* ---------- duração ---------- */

export const minutesToRead = (words: number, wpm: number) => Math.max(1, Math.round(words / Math.max(80, wpm || 230)));

/** "8 min", "1 h 20", "5 h" */
export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = Math.round((min % 60) / 10) * 10;
  return h >= 4 || m === 0 ? `${Math.round(min / 60)} h` : m === 60 ? `${h + 1} h` : `${h} h ${m}`;
}

export const DURATIONS = [
  { key: 'curto', label: 'Até 15 min', max: 15 },
  { key: 'medio', label: '15 min a 1 h', min: 16, max: 60 },
  { key: 'longo', label: 'Mais de 1 h', min: 61 },
] as const;

export const ERAS = [
  { key: 'antigo', label: 'Antes de 1800', max: 1799 },
  { key: 'xix', label: 'Século XIX', min: 1800, max: 1899 },
  { key: 'xx', label: 'Século XX', min: 1900 },
] as const;

/** Climas sonoros (para filtros e fileiras "ao som de…"). */
export const CLIMATES: { key: string; label: string; row: string; layers: Layer[] }[] = [
  { key: 'chuva', label: 'Chuva', row: 'Para ler ao som da chuva', layers: ['rain', 'thunder'] },
  { key: 'mar', label: 'Mar', row: 'Ao som do mar', layers: ['sea'] },
  { key: 'noite', label: 'Noite', row: 'Histórias da noite', layers: ['night', 'cricket', 'drone'] },
  { key: 'fogo', label: 'Lareira', row: 'Junto à lareira', layers: ['fire'] },
  { key: 'natureza', label: 'Natureza', row: 'Na natureza', layers: ['leaves', 'birds', 'water', 'wind'] },
  { key: 'cidade', label: 'Cidade', row: 'Na cidade', layers: ['city', 'train', 'crowd', 'cafe', 'tavern'] },
];

export interface Filters {
  q?: string;
  duration?: string;
  origin?: Origin;
  era?: string;
  climate?: string;
}

function inRange(v: number | undefined, r: { min?: number; max?: number }): boolean {
  if (v == null) return false;
  return (r.min == null || v >= r.min) && (r.max == null || v <= r.max);
}

export function matches(e: CatalogEntry, f: Filters, wpm: number): boolean {
  if (f.duration) {
    const r = DURATIONS.find((d) => d.key === f.duration);
    if (!r || !e.words || !inRange(minutesToRead(e.words, wpm), r)) return false;
  }
  if (f.origin && e.origin !== f.origin) return false;
  if (f.era) {
    const r = ERAS.find((x) => x.key === f.era);
    if (!r || !inRange(e.year, r)) return false;
  }
  if (f.climate) {
    const c = CLIMATES.find((x) => x.key === f.climate);
    if (!c || !e.layers.some((L) => c.layers.includes(L))) return false;
  }
  return true;
}

/**
 * Busca sem acento e sem diferenciar maiúsculas, também pela grafia antiga
 * ("Guarany" acha "Guarani"). Título que começa com a busca vem primeiro,
 * depois título que contém, depois autor e temas.
 */
export function searchCatalog(entries: CatalogEntry[], f: Filters, wpm: number): CatalogEntry[] {
  const words = norm(f.q ?? '').split(/\s+/).filter(Boolean);
  const scored: { e: CatalogEntry; s: number }[] = [];
  for (const e of entries) {
    if (!matches(e, f, wpm)) continue;
    if (!words.length) { scored.push({ e, s: 0 }); continue; }
    const t = norm(modernize(e.title, true));
    const hay = `${t} ${norm(e.title)} ${norm(e.author)} ${norm(e.tags.join(' '))} ${norm(e.kind ?? '')}`;
    if (!words.every((w) => hay.includes(w))) continue;
    const q = words.join(' ');
    const s = t.startsWith(q) ? 3 : t.includes(q) ? 2 : norm(e.author).includes(q) ? 1 : 0;
    scored.push({ e, s });
  }
  // empate: abre agora antes, depois quem tem som calibrado, depois acervo
  const rank = (e: CatalogEntry) => (e.openable ? 4 : 0) + (e.calibrated ? 2 : 0) + (e.source === 'acervo' ? 1 : 0);
  return scored.sort((a, b) => b.s - a.s || rank(b.e) - rank(a.e)).map((x) => x.e);
}

/* ---------- volumes repetidos ---------- */

/** "O Guarany: romance brasileiro (Vol. 2 de 2)" → "o guarani" */
export function volumeKey(title: string): string {
  return norm(modernize(title, true))
    .replace(/\(.*?\)/g, ' ')
    .replace(/[:;,.—–-]\s.*$/, ' ')
    .replace(/\b(vol(ume)?|tomo|parte|livro|book)\.?\s*([0-9]+|[ivxlc]+)\b.*$/, ' ')
    .replace(/\b([0-9]+|[ivxlc]+)\s*\.?\s*(o|º)?\s*(vol(ume)?|tomo)\b.*$/, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mantém só o primeiro de cada obra (mesmo título-base e autor). */
export function dedupeVolumes<T>(items: T[], title: (x: T) => string, author: (x: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((x) => {
    const k = `${volumeKey(title(x))}|${norm(author(x))}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* ---------- texto do catálogo ---------- */

const EN = /\b(the|and|of|is|this|with|which|his|her|their|that|novel|story|book|written)\b/gi;
/** Resumo em inglês (os automáticos do catálogo de domínio público vêm assim). */
export function looksEnglish(s: string): boolean {
  const n = s.split(/\s+/).length;
  return n >= 6 && (s.match(EN)?.length ?? 0) / n > 0.08;
}

/**
 * Primeiras linhas da obra, para a ficha: o primeiro parágrafo de verdade
 * (pula título, dedicatória e índice), cortado numa frase.
 */
export function openingExcerpt(text: string, max = 240): string {
  const paras = text.split('\n').map((p) => plain(p).trim()).filter(Boolean);
  const p = paras.find((x) => x.length >= 120 && /[a-zà-ú]/.test(x) && !/^(capitulo|capítulo|índice|indice|prefácio|prefacio|dedicat)/i.test(x)) ?? paras[0] ?? '';
  if (p.length <= max) return p;
  const cut = p.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return (end > 80 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '')) + (end > 80 ? '' : '…');
}

/**
 * Perfil sonoro de um livro inteiro: os climas que mais aparecem (amostra de
 * até 160 parágrafos espalhados pelo livro) e o número de palavras.
 */
export function soundProfile(text: string): { layers: Layer[]; words: number } {
  const paras = text.split('\n').filter((p) => p.trim().length > 40);
  const words = text.split(/\s+/).filter(Boolean).length;
  const step = Math.max(1, Math.floor(paras.length / 160));
  const count = new Map<Layer, number>();
  let n = 0;
  for (let i = 0; i < paras.length; i += step) {
    n++;
    (Object.keys(analyze(paras[i]).ambience) as Layer[]).forEach((L) => count.set(L, (count.get(L) ?? 0) + 1));
  }
  // clima que aparece em pelo menos 6% da amostra (e no máximo 4)
  const layers = [...count.entries()].filter(([, c]) => c >= Math.max(2, n * 0.06)).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([L]) => L);
  return { layers, words };
}

/* ---------- gostos e recomendações ---------- */

/** Temas que a pessoa escolhe na primeira abertura (casam com temas, climas e gênero). */
export const THEMES: { key: string; label: string; tags: RegExp; layers?: Layer[]; kinds?: string[] }[] = [
  { key: 'amor', label: 'Amor', tags: /amor|casamento|adulterio/ },
  { key: 'misterio', label: 'Mistério e terror', tags: /gotico|terror|loucura|misterio|suspense|morte/, layers: ['drone'] },
  { key: 'humor', label: 'Humor e sátira', tags: /humor|satira|ironia|malandragem/ },
  { key: 'natureza', label: 'Natureza e sertão', tags: /natureza|sertao|floresta|campo|aldeia|indianismo/, layers: ['leaves', 'birds', 'water'] },
  { key: 'cidade', label: 'Cidade', tags: /cidade|rio de janeiro|lisboa|imprensa|sociedade/, layers: ['city'] },
  { key: 'mar', label: 'Mar e aventura', tags: /\bmar\b|ilha|aventura|navio/, layers: ['sea'] },
  { key: 'historia', label: 'História', tags: /historia|guerra|escravidao|racismo/ },
  { key: 'poesia', label: 'Poesia e teatro', tags: /poesia|teatro/, kinds: ['Poesia', 'Teatro'] },
];

const themeHits = (e: CatalogEntry, keys: string[]) => THEMES.filter((t) => keys.includes(t.key)).reduce((s, t) => {
  const tags = norm(`${e.tags.join(' ')} ${e.kind ?? ''}`);
  return s + (t.tags.test(tags) ? 2 : 0) + (t.layers?.some((L) => e.layers.includes(L)) ? 1 : 0) + (t.kinds?.includes(e.kind ?? '') ? 2 : 0);
}, 0);

/** Pontuação de parecença entre duas obras. */
export function similarity(a: CatalogEntry, b: CatalogEntry): number {
  if (a.id === b.id) return -1;
  let s = 0;
  if (norm(a.author) === norm(b.author)) s += 3;
  const ta = new Set(a.tags.map(norm));
  s += b.tags.filter((t) => ta.has(norm(t))).length;
  if (a.kind && a.kind === b.kind) s += 1;
  s += b.layers.filter((L) => a.layers.includes(L)).length * 0.5;
  if (a.origin && a.origin === b.origin) s += 0.5;
  return s;
}

/** "Porque você leu X": as mais parecidas com as obras de referência. */
export function recommend(entries: CatalogEntry[], seeds: CatalogEntry[], exclude: Set<string>, n = 12): CatalogEntry[] {
  if (!seeds.length) return [];
  return entries
    .filter((e) => !exclude.has(e.id) && e.openable)
    .map((e) => ({ e, s: Math.max(...seeds.map((x) => similarity(x, e))) }))
    .filter((x) => x.s >= 1)
    .sort((a, b) => b.s - a.s || Number(b.e.calibrated) - Number(a.e.calibrated))
    .slice(0, n)
    .map((x) => x.e);
}

/** "Para você": pelos temas escolhidos e pelo que a pessoa já leu. */
export function forYou(entries: CatalogEntry[], themes: string[], seeds: CatalogEntry[], exclude: Set<string>, n = 14): CatalogEntry[] {
  return entries
    .filter((e) => !exclude.has(e.id) && e.openable)
    .map((e) => ({ e, s: themeHits(e, themes) + (seeds.length ? Math.max(0, ...seeds.map((x) => similarity(x, e))) * 0.6 : 0) + (e.calibrated ? 0.5 : 0) }))
    .filter((x) => x.s >= 1.5)
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.e);
}

/* ---------- metas e sequência de dias ---------- */

/** Minutos lidos por dia ('2026-10-15' → 23). */
export type ReadingDays = Record<string, number>;

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Soma minutos ao dia e guarda só os últimos 120 dias. */
export function addReading(days: ReadingDays, date: Date, minutes: number): ReadingDays {
  const k = dayKey(date);
  const next: ReadingDays = { ...days, [k]: Math.round(((days[k] ?? 0) + minutes) * 10) / 10 };
  const keys = Object.keys(next).sort();
  keys.slice(0, Math.max(0, keys.length - 120)).forEach((x) => delete next[x]);
  return next;
}

/** Dias seguidos com leitura (de pelo menos 1 min), terminando hoje ou ontem. */
export function streakOf(days: ReadingDays, today: Date): number {
  const d = new Date(today);
  if (!((days[dayKey(d)] ?? 0) >= 1)) d.setDate(d.getDate() - 1);
  let n = 0;
  while ((days[dayKey(d)] ?? 0) >= 1) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export const GOALS = [10, 15, 30, 60];

/** Uma fileira da vitrine. `personal` (continuar, Quero ler, lidos…) pode repetir livros; as editoriais não. */
export interface ShelfRow<T extends { id: string }> {
  key: string; items: T[];
  /** mínimo de livros (novos) para a fileira aparecer; padrão 3 */
  min?: number; personal?: boolean;
  /** fileira de clima (chuva, mar, noite…): no máximo `maxClimate` delas */
  climate?: boolean;
  /** aparece mesmo vazia (ex.: cartões de "abrir PDF") */
  always?: boolean;
}

/**
 * Monta a vitrine sem repetição: cada livro aparece em uma fileira
 * editorial só (a primeira em que cabe) e nunca repete o destaque. Fileiras
 * que ficam com poucos livros novos somem; no máximo `maxClimate` fileiras
 * de clima.
 */
export function shelfRows<T extends { id: string }, R extends ShelfRow<T>>(rows: R[], opts: { hero?: string; maxClimate?: number; min?: number } = {}): R[] {
  const seen = new Set<string>(opts.hero ? [opts.hero] : []);
  const out: R[] = [];
  let climates = 0;
  for (const r of rows) {
    const items = r.personal ? r.items : r.items.filter((i) => !seen.has(i.id));
    if (items.length < (r.min ?? opts.min ?? 3) && !r.always) continue;
    if (r.climate && ++climates > (opts.maxClimate ?? Infinity)) continue;
    if (!r.personal) items.forEach((i) => seen.add(i.id));
    out.push({ ...r, items });
  }
  return out;
}
