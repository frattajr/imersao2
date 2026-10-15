/**
 * Jornada do leitor: a gamificação do Imersão, pensada para quem está
 * começando e para criar constância sem culpa.
 *
 * - **Metas pequenas**: minutos por dia (a partir de 5) e dias por semana
 *   (a partir de 3) — a semana flexível conta mais que a perfeição.
 * - **Sequência com dias de descanso**: começa com 1 guardado e ganha mais 1
 *   a cada 7 dias seguidos (máx. 2). Se faltar um dia, ele é usado sozinho e
 *   a sequência continua. Voltar depois de uma pausa vira conquista ("De
 *   volta"), nunca bronca.
 * - **Pontos e níveis de leitor**: 1 ponto por minuto lido, +10 por capítulo,
 *   +25 por livro, +5 por meta do dia, +15 pela semana cumprida, +20 pelo
 *   desafio da semana, +30 pelos primeiros passos. Níveis com nome
 *   ("Leitor curioso", "Leitor de cabeceira"…) e subida rápida no começo.
 * - **Primeiros passos**: 7 tarefas que ensinam o app e dão vitórias cedo.
 * - **Desafio da semana**: um por semana, pequeno e variado.
 * - **Conquistas**: constância, leitura, imersão no som e curiosidade.
 *
 * Tudo aqui é puro (sem banco, sem tela): `apply` recebe o estado, os
 * minutos por dia e um evento, e devolve o estado novo e o que aconteceu
 * (conquistas, meta do dia, desafio) para a tela celebrar.
 */
import { CLIMATES, dayKey, type ReadingDays } from './catalog';
import type { Layer } from './types';

/** minutos para o dia contar na sequência (30 s de leitura: um conto curto já conta) */
export const MIN_DAY = 0.5;
/** dias de descanso guardados no máximo */
export const MAX_FREEZES = 2;
/** cada trecho conta no máximo isso (parada longa não vale) */
export const MAX_READ_MS = 3 * 60_000;
export const DAY_GOALS = [5, 10, 15, 30, 60];
export const WEEK_TARGETS = [3, 4, 5, 6, 7];
export const DEFAULT_GOAL = 10;
export const DEFAULT_WEEK_TARGET = 4;

export const POINTS = { minute: 1, chapter: 10, book: 25, goal: 5, week: 15, challenge: 20, steps: 30 } as const;

export interface Counters {
  minutes: number; words: number; chapters: number; books: number; classics: number;
  /** mais minutos lidos num dia só */
  bestDay: number;
  highlights: number; notes: number; glossary: number; presets: number;
  goalDays: number; activeDays: number; comebacks: number;
  nightMin: number; morningMin: number; soundMin: number;
  /** minutos lidos com cada clima tocando (chuva, mar, noite…) */
  climateMin: Record<string, number>;
  /** clássicos começados (acervo e domínio público) */
  started: string[];
  /** livros já abertos alguma vez (para "livro novo") */
  seen: string[];
}

export interface WeekLog {
  /** segunda-feira da semana */
  key: string;
  chapters: number; books: number; highlights: number; soundMin: number;
  /** dias com leitura depois das 21h */
  nights: string[];
  /** livros abertos pela primeira vez nesta semana */
  newBooks: string[];
}

export interface Session {
  start: number; bookId?: string; title?: string;
  ms: number; words: number; points: number;
  badges: string[]; goal: boolean; challenge?: string; comeback?: boolean;
  /** terminou o livro nesta leitura */
  finished?: boolean;
}

export interface JourneyState {
  v: 1;
  points: number;
  c: Counters;
  /** dias cobertos por descanso */
  rest: string[];
  freezes: number;
  best: number;
  /** último dia em que a sequência foi acertada */
  settled?: string;
  /** conquistas: id → quando */
  badges: Record<string, number>;
  week: WeekLog;
  /** semanas com a meta de dias cumprida */
  weeksMet: string[];
  /** desafios concluídos: semana → id */
  challenges: Record<string, string>;
  /** quando terminou os primeiros passos */
  stepsDone?: number;
  /** dia em que dispensou a sugestão de meta */
  adviceOff?: string;
  /** leitura em andamento e a última terminada (resumo na biblioteca) */
  session?: Session;
  last?: Session & { seen: boolean };
}

export type JourneyEvent =
  | { type: 'open' }
  | { type: 'read'; ms: number; words?: number; layers?: Layer[]; sound?: boolean; bookId?: string; classic?: boolean }
  | { type: 'chapter' }
  | { type: 'finish'; bookId: string; classic?: boolean }
  | { type: 'highlight'; note: boolean }
  | { type: 'glossary' }
  | { type: 'preset' }
  | { type: 'session-start'; bookId: string; title?: string }
  | { type: 'session-end' };

export interface JourneyContext { now: Date; goal: number; weekTarget: number }

export interface JourneyResult {
  state: JourneyState;
  days: ReadingDays;
  /** conquistas novas */
  unlocked: Badge[];
  /** a meta do dia acabou de ser cumprida */
  goalReached: boolean;
  /** a meta de dias da semana acabou de ser cumprida */
  weekReached: boolean;
  challenge?: Challenge;
  stepsCompleted: boolean;
  /** voltou depois de 3+ dias sem ler */
  comeback: boolean;
  freezeEarned: boolean;
  pointsGained: number;
}

/* ---------- datas ---------- */

const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
/** segunda-feira da semana de `d` */
export function weekKey(d: Date): string {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return dayKey(x);
}
const weekDates = (d: Date) => { const mon = addDays(d, -((d.getDay() + 6) % 7)); return Array.from({ length: 7 }, (_, i) => addDays(mon, i)); };

/* ---------- estado inicial ---------- */

export function emptyJourney(now = new Date()): JourneyState {
  return {
    v: 1, points: 0, rest: [], freezes: 1, best: 0, badges: {}, weeksMet: [], challenges: {},
    c: {
      minutes: 0, words: 0, chapters: 0, books: 0, classics: 0, bestDay: 0, highlights: 0, notes: 0, glossary: 0, presets: 0,
      goalDays: 0, activeDays: 0, comebacks: 0, nightMin: 0, morningMin: 0, soundMin: 0, climateMin: {}, started: [], seen: [],
    },
    week: newWeek(weekKey(now)),
  };
}
const newWeek = (key: string): WeekLog => ({ key, chapters: 0, books: 0, highlights: 0, soundMin: 0, nights: [], newBooks: [] });

/** Junta um estado salvo (talvez de uma versão antiga) com o padrão. */
export function hydrate(raw: unknown, now = new Date()): JourneyState {
  const base = emptyJourney(now);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<JourneyState>;
  return { ...base, ...r, c: { ...base.c, ...(r.c ?? {}) }, week: r.week?.key ? { ...newWeek(r.week.key), ...r.week } : base.week };
}

/* ---------- sequência ---------- */

const isActive = (days: ReadingDays, k: string) => (days[k] ?? 0) >= MIN_DAY;

/** Dias seguidos com leitura até hoje (ou até ontem, se hoje ainda não leu); dias de descanso ligam sem contar. */
export function streakOf(days: ReadingDays, rest: string[], today: Date): number {
  const r = new Set(rest);
  let d = new Date(today);
  if (!isActive(days, dayKey(d))) d = addDays(d, -1);
  let n = 0;
  for (let i = 0; i < 400; i++) {
    const k = dayKey(d);
    if (isActive(days, k)) n++;
    else if (!r.has(k)) break;
    d = addDays(d, -1);
  }
  return n;
}

/**
 * Acerta a sequência uma vez por dia: se faltaram dias desde a última
 * leitura e há dias de descanso guardados que cubram todos, eles são usados
 * e a sequência continua.
 */
export function settle(s: JourneyState, days: ReadingDays, today: Date): JourneyState {
  const tk = dayKey(today);
  if (s.settled === tk) return s;
  const rest = new Set(s.rest);
  const missed: string[] = [];
  let found = false;
  let d = addDays(today, -1);
  for (let i = 0; i < 60; i++) {
    const k = dayKey(d);
    if (isActive(days, k) || rest.has(k)) { found = true; break; }
    missed.push(k);
    d = addDays(d, -1);
  }
  const next = { ...s, settled: tk };
  if (found && missed.length > 0 && missed.length <= s.freezes) {
    next.rest = [...s.rest, ...missed].sort().slice(-60);
    next.freezes = s.freezes - missed.length;
  }
  return next;
}

/** Os 7 dias da semana (segunda a domingo) para o calendário. */
export function weekView(days: ReadingDays, rest: string[], today: Date, goal: number) {
  const tk = dayKey(today);
  const r = new Set(rest);
  return weekDates(today).map((d, i) => {
    const k = dayKey(d);
    const min = days[k] ?? 0;
    return {
      key: k, label: 'STQQSSD'[i], min, read: min >= MIN_DAY, met: min >= goal, rest: r.has(k), today: k === tk, future: k > tk,
    };
  });
}

/** Dias da semana com a meta cumprida. */
export const weekMetCount = (days: ReadingDays, today: Date, goal: number) => weekView(days, [], today, goal).filter((d) => d.met).length;

/* ---------- níveis ---------- */

const LEVELS: [number, string][] = [
  [0, 'Primeiras páginas'], [20, 'Leitor curioso'], [60, 'Leitor de cabeceira'], [120, 'Leitor constante'],
  [200, 'Leitor assíduo'], [320, 'Leitor voraz'], [480, 'Devorador de histórias'], [700, 'Rato de biblioteca'],
  [1000, 'Leitor imerso'], [1400, 'Guardião das histórias'], [2000, 'Mestre leitor'], [2800, 'Lenda da biblioteca'],
];

export interface Level { n: number; name: string; from: number; to: number | null; next?: string; pct: number }

export function levelOf(points: number): Level {
  const p = Math.max(0, Math.floor(points));
  let i = LEVELS.length - 1;
  while (i > 0 && p < LEVELS[i][0]) i--;
  if (i === LEVELS.length - 1) {
    // depois do último nome, um nível a cada 1000 pontos
    const extra = Math.floor((p - LEVELS[i][0]) / 1000);
    const from = LEVELS[i][0] + extra * 1000;
    return { n: i + 1 + extra, name: LEVELS[i][1], from, to: from + 1000, pct: (p - from) / 1000 };
  }
  const [from, name] = LEVELS[i];
  const [to, next] = LEVELS[i + 1];
  return { n: i + 1, name, from, to, next, pct: (p - from) / (to - from) };
}

/* ---------- desafio da semana ---------- */

export interface Challenge {
  id: string; title: string; desc: string; target: number; unit?: string;
  progress: (w: WeekLog, days: ReadingDays, today: Date) => number;
}

const weekMinutes = (days: ReadingDays, today: Date) => weekDates(today).reduce((a, d) => a + (days[dayKey(d)] ?? 0), 0);

export const CHALLENGES: Challenge[] = [
  { id: 'days3', title: 'Três dias de leitura', desc: 'Leia em 3 dias diferentes esta semana.', target: 3, unit: 'dias',
    progress: (_w, days, t) => weekDates(t).filter((d) => isActive(days, dayKey(d))).length },
  { id: 'finish', title: 'Até o fim', desc: 'Termine um capítulo ou um conto esta semana.', target: 1,
    progress: (w) => w.chapters + w.books },
  { id: 'hour', title: 'Uma hora na semana', desc: 'Some 60 minutos de leitura esta semana.', target: 60, unit: 'min',
    progress: (_w, days, t) => Math.floor(weekMinutes(days, t)) },
  { id: 'highlights', title: 'Frases que ficam', desc: 'Grife 3 trechos de que você gostar.', target: 3, unit: 'grifos',
    progress: (w) => w.highlights },
  { id: 'sound', title: 'Leitura com som', desc: 'Leia 20 minutos com o som ligado.', target: 20, unit: 'min',
    progress: (w) => Math.floor(w.soundMin) },
  { id: 'new', title: 'Livro novo', desc: 'Abra um livro que você ainda não leu.', target: 1,
    progress: (w) => w.newBooks.length },
  { id: 'night', title: 'Antes de dormir', desc: 'Leia depois das 21h em 2 noites.', target: 2, unit: 'noites',
    progress: (w) => w.nights.length },
];

/** O desafio da semana (sempre o mesmo durante a semana, muda na segunda). */
export function challengeFor(week: string): Challenge {
  let h = 0;
  for (const ch of week) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CHALLENGES[h % CHALLENGES.length];
}

/* ---------- primeiros passos ---------- */

export interface Step { id: string; title: string; hint: string; done: (s: JourneyState) => boolean }

export const STEPS: Step[] = [
  { id: 'sound', title: 'Escolha como quer o som', hint: 'Na primeira leitura: Sutil é um ótimo começo.', done: (s) => s.c.presets > 0 },
  { id: 'five', title: 'Leia seus primeiros 5 minutos', hint: 'Pode ser aos poucos, em mais de uma vez.', done: (s) => s.c.minutes >= 5 },
  { id: 'story', title: 'Termine um conto', hint: 'Os contos de 1 minuto são perfeitos para isso.', done: (s) => s.c.books >= 1 },
  { id: 'highlight', title: 'Grife uma frase de que gostou', hint: 'Toque e segure um parágrafo.', done: (s) => s.c.highlights >= 1 },
  { id: 'goal', title: 'Cumpra a meta do dia', hint: 'A meta começa pequena; dá para mudar quando quiser.', done: (s) => s.c.goalDays >= 1 },
  { id: 'three', title: 'Leia em 3 dias diferentes', hint: 'Não precisa ser seguido.', done: (s) => s.c.activeDays >= 3 },
  { id: 'classic', title: 'Comece um clássico', hint: 'Dom Casmurro, Iracema, O Cortiço…', done: (s) => s.c.started.length >= 1 },
];

export const stepsLeft = (s: JourneyState) => STEPS.filter((x) => !x.done(s));

/* ---------- conquistas ---------- */

export interface Badge {
  id: string; title: string; desc: string; icon: string;
  group: 'Constância' | 'Leitura' | 'Imersão' | 'Curiosidade';
  check: (s: JourneyState, d: { streak: number }) => boolean;
}

const climate = (s: JourneyState, k: string) => s.c.climateMin[k] ?? 0;

export const BADGES: Badge[] = [
  { id: 'first', group: 'Leitura', icon: 'book', title: 'Primeira página', desc: 'Comece sua primeira leitura.', check: (s) => s.c.minutes > 0 },
  { id: 'chapter', group: 'Leitura', icon: 'list', title: 'Primeiro capítulo', desc: 'Termine um capítulo.', check: (s) => s.c.chapters >= 1 },
  { id: 'book', group: 'Leitura', icon: 'check', title: 'Primeiro livro', desc: 'Termine um livro ou conto.', check: (s) => s.c.books >= 1 },
  { id: 'shelf', group: 'Leitura', icon: 'library', title: 'Estante cheia', desc: 'Termine 5 livros ou contos.', check: (s) => s.c.books >= 5 },
  { id: 'classic', group: 'Leitura', icon: 'award', title: 'Clássico na bagagem', desc: 'Termine um clássico em domínio público.', check: (s) => s.c.classics >= 1 },
  { id: 'marathon', group: 'Leitura', icon: 'clock', title: 'Maratona', desc: 'Leia 30 minutos num dia só.', check: (s) => s.c.bestDay >= 30 },
  { id: 'words', group: 'Leitura', icon: 'notebook', title: '10 mil palavras', desc: 'Leia 10 mil palavras (umas 40 páginas).', check: (s) => s.c.words >= 10_000 },
  { id: 'steps', group: 'Constância', icon: 'star', title: 'Primeiros passos', desc: 'Complete os primeiros passos.', check: (s) => !!s.stepsDone },
  { id: 'goal', group: 'Constância', icon: 'target', title: 'Meta cumprida', desc: 'Cumpra a meta do dia.', check: (s) => s.c.goalDays >= 1 },
  { id: 'streak3', group: 'Constância', icon: 'flame', title: 'Três dias seguidos', desc: 'Leia 3 dias seguidos.', check: (_s, d) => d.streak >= 3 },
  { id: 'streak7', group: 'Constância', icon: 'flame', title: 'Uma semana inteira', desc: 'Leia 7 dias seguidos.', check: (_s, d) => d.streak >= 7 },
  { id: 'streak30', group: 'Constância', icon: 'flame', title: 'Um mês de leitura', desc: 'Leia 30 dias seguidos.', check: (_s, d) => d.streak >= 30 },
  { id: 'week', group: 'Constância', icon: 'calendar', title: 'Semana redonda', desc: 'Cumpra a meta de dias da semana.', check: (s) => s.weeksMet.length >= 1 },
  { id: 'comeback', group: 'Constância', icon: 'retry', title: 'De volta', desc: 'Volte a ler depois de uma pausa.', check: (s) => s.c.comebacks >= 1 },
  { id: 'rain', group: 'Imersão', icon: 'rain', title: 'Ao som da chuva', desc: 'Leia 10 minutos com chuva tocando.', check: (s) => climate(s, 'chuva') >= 10 },
  { id: 'sea', group: 'Imersão', icon: 'waves', title: 'Maresia', desc: 'Leia 10 minutos com o mar tocando.', check: (s) => climate(s, 'mar') >= 10 },
  { id: 'explorer', group: 'Imersão', icon: 'compass', title: 'Explorador de climas', desc: 'Leia com 4 climas diferentes tocando.', check: (s) => Object.values(s.c.climateMin).filter((m) => m >= 2).length >= 4 },
  { id: 'owl', group: 'Imersão', icon: 'moon', title: 'Coruja', desc: 'Leia 10 minutos depois das 22h.', check: (s) => s.c.nightMin >= 10 },
  { id: 'early', group: 'Imersão', icon: 'sun', title: 'Madrugador', desc: 'Leia 10 minutos antes das 8h.', check: (s) => s.c.morningMin >= 10 },
  { id: 'highlight', group: 'Curiosidade', icon: 'pen', title: 'Frase favorita', desc: 'Grife um trecho.', check: (s) => s.c.highlights >= 1 },
  { id: 'notes', group: 'Curiosidade', icon: 'write', title: 'Leitor anotador', desc: 'Escreva 3 notas nos grifos.', check: (s) => s.c.notes >= 3 },
  { id: 'glossary', group: 'Curiosidade', icon: 'sparkle', title: 'Quem é quem', desc: 'Guarde um nome ou termo no glossário.', check: (s) => s.c.glossary >= 1 },
];

/* ---------- climas tocando ---------- */

/** Chaves de clima (chuva, mar, noite…) presentes nas camadas tocando. */
export function climatesOf(layers: Layer[]): string[] {
  return CLIMATES.filter((c) => c.layers.some((L) => layers.includes(L))).map((c) => c.key);
}

/* ---------- o motor ---------- */

const capList = (xs: string[], n: number) => (xs.length > n ? xs.slice(-n) : xs);
const round1 = (x: number) => Math.round(x * 100) / 100;

/** Aplica um evento. Não muda o estado recebido. */
export function apply(s0: JourneyState, days0: ReadingDays, ev: JourneyEvent, ctx: JourneyContext): JourneyResult {
  const { now, goal, weekTarget } = ctx;
  const tk = dayKey(now);
  let s: JourneyState = settle(s0, days0, now);
  s = { ...s, c: { ...s.c, climateMin: { ...s.c.climateMin } }, badges: { ...s.badges } };
  if (s.week.key !== weekKey(now)) s.week = newWeek(weekKey(now));
  else s.week = { ...s.week };
  let days = days0;
  const pts0 = s.points;
  let goalReached = false;
  let comeback = false;
  let freezeEarned = false;
  let weekReached = false;

  switch (ev.type) {
    case 'read': {
      const m = Math.min(Math.max(0, ev.ms), MAX_READ_MS) / 60_000;
      if (m <= 0) break;
      const before = days[tk] ?? 0;
      const after = before + m;
      days = { ...days, [tk]: round1(after) };
      // guarda só os últimos 120 dias
      const keys = Object.keys(days).sort();
      if (keys.length > 120) keys.slice(0, keys.length - 120).forEach((k) => delete days[k]);
      s.c.minutes = round1(s.c.minutes + m);
      s.c.bestDay = Math.max(s.c.bestDay, round1(after));
      s.points = round1(s.points + m * POINTS.minute);
      s.c.words += Math.max(0, ev.words ?? 0);
      if (ev.sound && ev.layers?.length) {
        s.c.soundMin = round1(s.c.soundMin + m);
        s.week.soundMin = round1(s.week.soundMin + m);
        climatesOf(ev.layers).forEach((k) => (s.c.climateMin[k] = round1((s.c.climateMin[k] ?? 0) + m)));
      }
      const h = now.getHours();
      if (h >= 22 || h < 4) s.c.nightMin = round1(s.c.nightMin + m);
      if (h >= 5 && h < 8) s.c.morningMin = round1(s.c.morningMin + m);
      if ((h >= 21 || h < 4) && !s.week.nights.includes(tk)) s.week.nights = [...s.week.nights, tk];
      if (ev.bookId) {
        if (!s.c.seen.includes(ev.bookId)) {
          s.c.seen = capList([...s.c.seen, ev.bookId], 300);
          s.week.newBooks = [...s.week.newBooks, ev.bookId];
        }
        if (ev.classic && !s.c.started.includes(ev.bookId)) s.c.started = capList([...s.c.started, ev.bookId], 300);
      }
      // o dia passou a contar
      if (before < MIN_DAY && after >= MIN_DAY) {
        s.c.activeDays++;
        const streak = streakOf(days, s.rest, now);
        // voltou depois de 3+ dias sem ler (e os dias de descanso não seguraram a sequência)
        const prev = Object.keys(days0).filter((k) => k < tk && isActive(days0, k)).sort().pop();
        if (prev && streak === 1) {
          const gap = Math.round((new Date(tk + 'T12:00').getTime() - new Date(prev + 'T12:00').getTime()) / 86_400_000);
          if (gap >= 3) { comeback = true; s.c.comebacks++; }
        }
        if (streak > 0 && streak % 7 === 0 && s.freezes < MAX_FREEZES) { s.freezes++; freezeEarned = true; }
        s.best = Math.max(s.best, streak);
      }
      if (before < goal && after >= goal) {
        goalReached = true;
        s.c.goalDays++;
        s.points += POINTS.goal;
      }
      break;
    }
    case 'chapter':
      s.c.chapters++; s.week.chapters++; s.points += POINTS.chapter;
      break;
    case 'finish':
      s.c.books++; s.week.books++; s.points += POINTS.book;
      if (ev.classic) s.c.classics++;
      break;
    case 'highlight':
      s.c.highlights++; s.week.highlights++;
      if (ev.note) s.c.notes++;
      break;
    case 'glossary':
      s.c.glossary++;
      break;
    case 'preset':
      s.c.presets++;
      break;
    case 'session-start':
      s.session = { start: now.getTime(), bookId: ev.bookId, title: ev.title, ms: 0, words: 0, points: 0, badges: [], goal: false };
      break;
    case 'session-end':
      if (s.session && s.session.ms >= 30_000) s.last = { ...s.session, seen: false };
      s.session = undefined;
      break;
    case 'open':
      break;
  }

  // semana com a meta de dias cumprida
  if (!s.weeksMet.includes(s.week.key) && weekMetCount(days, now, goal) >= weekTarget) {
    s.weeksMet = capList([...s.weeksMet, s.week.key], 60);
    s.points += POINTS.week;
    weekReached = true;
  }

  // desafio da semana
  let challenge: Challenge | undefined;
  const ch = challengeFor(s.week.key);
  if (!s.challenges[s.week.key] && ch.progress(s.week, days, now) >= ch.target) {
    s.challenges = { ...s.challenges, [s.week.key]: ch.id };
    s.points += POINTS.challenge;
    challenge = ch;
  }

  // primeiros passos
  let stepsCompleted = false;
  if (!s.stepsDone && STEPS.every((x) => x.done(s))) {
    s.stepsDone = now.getTime();
    s.points += POINTS.steps;
    if (s.freezes < MAX_FREEZES) { s.freezes++; freezeEarned = true; }
    stepsCompleted = true;
  }

  // conquistas
  const streak = streakOf(days, s.rest, now);
  s.best = Math.max(s.best, streak);
  const unlocked: Badge[] = [];
  for (const b of BADGES) {
    const was = !!s0.badges[b.id];
    if (!s.badges[b.id] && b.check(s, { streak })) s.badges[b.id] = now.getTime();
    if (!was && s.badges[b.id]) unlocked.push(b);
  }

  // leitura em andamento
  const gained = round1(s.points - pts0);
  if (s.session && ev.type !== 'session-start') {
    s.session = {
      ...s.session,
      ms: s.session.ms + (ev.type === 'read' ? Math.min(Math.max(0, ev.ms), MAX_READ_MS) : 0),
      words: s.session.words + (ev.type === 'read' ? Math.max(0, ev.words ?? 0) : 0),
      points: round1(s.session.points + gained),
      badges: [...s.session.badges, ...unlocked.map((b) => b.id)],
      goal: s.session.goal || goalReached,
      challenge: s.session.challenge ?? challenge?.id,
      comeback: s.session.comeback || comeback,
      finished: s.session.finished || ev.type === 'finish',
    };
  }

  return { state: s, days, unlocked, goalReached, weekReached, challenge, stepsCompleted, comeback, freezeEarned, pointsGained: gained };
}

/* ---------- sugestões ---------- */

/**
 * Sugestão gentil de meta, olhando os últimos 7 dias (sem contar hoje):
 * cumpriu quase todo dia → subir um degrau; leu mas quase nunca cumpriu →
 * descer um degrau. Nunca sugere duas vezes na mesma semana se dispensada.
 */
export function goalAdvice(days: ReadingDays, goal: number, today: Date, off?: string): { to: number; why: string } | null {
  if (off && dayKey(addDays(today, -7)) < off) return null;
  const last = Array.from({ length: 7 }, (_, i) => days[dayKey(addDays(today, -1 - i))] ?? 0);
  const met = last.filter((m) => m >= goal).length;
  const read = last.filter((m) => m >= MIN_DAY).length;
  const i = DAY_GOALS.indexOf(goal);
  if (met >= 6 && i >= 0 && i < DAY_GOALS.length - 1) {
    return { to: DAY_GOALS[i + 1], why: `Você cumpriu a meta em ${met} dos últimos 7 dias. Que tal ${DAY_GOALS[i + 1]} minutos?` };
  }
  if (read >= 3 && met <= 1 && i > 0) {
    return { to: DAY_GOALS[i - 1], why: `Você leu em ${read} dos últimos 7 dias, mas a meta ficou longe. Uma meta menor ajuda a manter o ritmo.` };
  }
  return null;
}

/** Minutos que faltam para a meta de hoje (0 = cumprida). */
export const minutesLeft = (days: ReadingDays, goal: number, today: Date) => Math.max(0, Math.ceil(goal - (days[dayKey(today)] ?? 0)));
