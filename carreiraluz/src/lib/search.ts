import { CHALLENGES } from '../data/challenges';
import { ARTICLES } from '../data/library';
import type {
  AreaId,
  CareerMoment,
  ChallengeCategory,
  ChallengeType,
  LevelId,
  MarketId,
  SizeId,
} from '../data/types';

/** Item da biblioteca: guia de desafio ou artigo, num formato comum para busca e filtros. */
export interface LibraryEntry {
  id: string;
  kind: 'desafio' | 'artigo';
  title: string;
  teaser: string;
  category: ChallengeCategory;
  type: ChallengeType;
  moments: CareerMoment[];
  levels: LevelId[];
  areas: AreaId[];
  minutes: number;
  markets: MarketId[];
  sizes: SizeId[];
  questions: string[];
  body: string;
}

export const ENTRIES: LibraryEntry[] = [
  ...CHALLENGES.map<LibraryEntry>((c) => ({
    id: c.id,
    kind: 'desafio',
    title: c.title,
    teaser: c.teaser,
    category: c.category,
    type: c.type,
    moments: c.moments,
    levels: c.levels,
    areas: [],
    minutes: c.minutes,
    markets: Object.keys(c.marketNotes ?? {}) as MarketId[],
    sizes: Object.keys(c.sizeNotes ?? {}) as SizeId[],
    questions: [],
    body: [
      c.guide.happening,
      ...c.guide.why,
      ...c.guide.understand,
      ...c.guide.prepare,
      ...c.guide.approach.steps,
      ...c.guide.approach.phrases.map((p) => p.text),
    ].join(' '),
  })),
  ...ARTICLES.map<LibraryEntry>((a) => ({
    id: a.id,
    kind: 'artigo',
    title: a.title,
    teaser: a.teaser,
    category: a.category,
    type: a.type,
    moments: a.moments,
    levels: a.levels,
    areas: a.areas,
    minutes: a.minutes,
    markets: [],
    sizes: [],
    questions: a.questions,
    body: a.sections.map((s) => [s.title, s.body ?? '', ...(s.bullets ?? [])].join(' ')).join(' '),
  })),
];

const STOPWORDS = new Set(
  'a o e de da do das dos em no na nos nas um uma uns umas para pra por com sem que se como meu minha meus minhas seu sua eu me mim voce ao aos as os ou mais muito quando qual quais ja nao sim isso esse essa este esta tem ter ser estar estou sou faz fazer sobre ate entre ele ela eles elas lhe'.split(
    ' ',
  ),
);

// Palavras que as pessoas usam e o vocabulário dos conteúdos. Mantenha em forma normalizada.
const SYNONYMS: Record<string, string[]> = {
  salario: ['remuneracao', 'aumento', 'reajuste', 'dinheiro', 'ganhar'],
  aumento: ['remuneracao', 'salario', 'reajuste'],
  dinheiro: ['salario', 'remuneracao'],
  ganhar: ['salario', 'remuneracao'],
  chefe: ['gestor', 'lideranca', 'gerente'],
  gestor: ['chefe', 'lideranca'],
  promocao: ['promovido', 'proximo', 'crescer', 'crescimento'],
  promovido: ['promocao'],
  crescer: ['crescimento', 'promocao', 'escopo'],
  gerente: ['gestao', 'liderar', 'lideranca', 'gestor'],
  liderar: ['lideranca', 'gestao', 'gerente'],
  pronto: ['prontidao', 'preparado', 'preparacao'],
  preparado: ['pronto', 'preparacao'],
  estrategico: ['estrategicos', 'projeto', 'prioritario'],
  projeto: ['projetos', 'iniciativa'],
  credito: ['reconhecimento'],
  reconhecimento: ['credito', 'visibilidade'],
  visibilidade: ['reconhecimento', 'autopromocao'],
  discordar: ['discordancia', 'divergencia'],
  urgente: ['prioridade', 'prioridades', 'urgencia'],
  prioridade: ['priorizar', 'urgente'],
  influencia: ['influenciar', 'autoridade', 'alianca'],
  vaga: ['interna', 'oportunidade'],
  mudar: ['mudanca', 'transicao'],
  area: ['areas'],
  ideia: ['ideias', 'proposta'],
  colega: ['par', 'colegas'],
};

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
}

/** Raiz aproximada: tira plural e terminações comuns, para "projetos" achar "projeto". */
function stem(w: string): string {
  if (w.length > 5 && w.endsWith('oes')) return w.slice(0, -3) + 'ao';
  if (w.length > 4 && w.endsWith('s')) return w.slice(0, -1);
  return w;
}

export function tokenize(s: string): string[] {
  return normalize(s)
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(stem);
}

function expand(tokens: string[]): { token: string; weight: number }[] {
  const out = new Map<string, number>();
  for (const t of tokens) {
    out.set(t, Math.max(out.get(t) ?? 0, 1));
    for (const syn of SYNONYMS[t] ?? []) {
      const s = stem(syn);
      out.set(s, Math.max(out.get(s) ?? 0, 0.5));
    }
  }
  return [...out].map(([token, weight]) => ({ token, weight }));
}

const indexCache = new Map<string, { title: Set<string>; questions: Set<string>; teaser: Set<string>; body: Set<string> }>();

function indexOf(e: LibraryEntry) {
  let idx = indexCache.get(e.id);
  if (!idx) {
    idx = {
      title: new Set(tokenize(e.title)),
      questions: new Set(tokenize(e.questions.join(' '))),
      teaser: new Set(tokenize(e.teaser)),
      body: new Set(tokenize(e.body)),
    };
    indexCache.set(e.id, idx);
  }
  return idx;
}

/** Pontua um item para uma consulta em linguagem natural. 0 = não relevante. */
export function score(e: LibraryEntry, query: string): number {
  const terms = expand(tokenize(query));
  if (!terms.length) return 0;
  const idx = indexOf(e);
  let total = 0;
  let matched = 0;
  for (const { token, weight } of terms) {
    let s = 0;
    if (idx.title.has(token)) s += 5;
    if (idx.questions.has(token)) s += 4;
    if (idx.teaser.has(token)) s += 2;
    if (idx.body.has(token)) s += 1;
    if (s > 0 && weight === 1) matched++;
    total += s * weight;
  }
  const original = terms.filter((t) => t.weight === 1).length;
  // Favorece itens que cobrem mais palavras da pergunta.
  return total * (0.5 + matched / Math.max(1, original));
}

export interface LibraryFilters {
  query: string;
  level?: LevelId;
  area?: AreaId;
  market?: MarketId;
  size?: SizeId;
  category?: ChallengeCategory;
  type?: ChallengeType;
  moment?: CareerMoment;
}

export interface LibraryResult {
  entry: LibraryEntry;
  score: number;
  /** Tem orientação específica para o mercado ou porte filtrado. */
  contextual: boolean;
}

export function searchLibrary(f: LibraryFilters): LibraryResult[] {
  const results: LibraryResult[] = [];
  for (const e of ENTRIES) {
    if (f.level && e.levels.length && !e.levels.includes(f.level)) continue;
    if (f.area && e.areas.length && !e.areas.includes(f.area)) continue;
    if (f.category && e.category !== f.category) continue;
    if (f.type && e.type !== f.type) continue;
    if (f.moment && !e.moments.includes(f.moment)) continue;
    const s = f.query.trim() ? score(e, f.query) : 1;
    if (s <= 0) continue;
    const contextual = Boolean((f.market && e.markets.includes(f.market)) || (f.size && e.sizes.includes(f.size)));
    results.push({ entry: e, score: s + (contextual ? 0.5 : 0), contextual });
  }
  return results.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title));
}
