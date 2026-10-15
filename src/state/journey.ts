/**
 * Jornada do leitor no aparelho: minutos por dia, meta, dias por semana e o
 * estado da gamificação (`src/core/journey.ts`). Fica em memória, grava no
 * banco local alguns segundos depois de cada mudança e avisa quem estiver
 * olhando (biblioteca, tela Jornada).
 *
 * Quem já usava o app antes da jornada começa com o que já fez: minutos,
 * dias com leitura, metas cumpridas e livros terminados viram pontos.
 */
import { dayKey, type ReadingDays } from '../core/catalog';
import {
  apply, DEFAULT_GOAL, DEFAULT_WEEK_TARGET, emptyJourney, hydrate, MIN_DAY, POINTS,
  type JourneyEvent, type JourneyResult, type JourneyState,
} from '../core/journey';
import { getRepo } from './db';

export interface JourneySnap { state: JourneyState; days: ReadingDays; goal: number; weekTarget: number }

const parse = <T,>(s: string | null, d: T): T => { try { return s ? (JSON.parse(s) as T) : d; } catch { return d; } };

let mem: JourneySnap | null = null;
let loading: Promise<JourneySnap> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(s: JourneySnap) => void>();

/** Estado de quem já usava o app antes da jornada. */
async function migrate(days: ReadingDays, goal: number): Promise<JourneyState> {
  const s = emptyJourney();
  const repo = await getRepo();
  const [books, asked] = await Promise.all([repo.listBooks(), repo.kvGet('sound:asked')]);
  const vals = Object.values(days);
  s.c.minutes = Math.round(vals.reduce((a, b) => a + b, 0) * 10) / 10;
  s.c.activeDays = vals.filter((m) => m >= MIN_DAY).length;
  s.c.goalDays = vals.filter((m) => m >= goal).length;
  s.c.bestDay = Math.max(0, ...vals);
  s.c.books = books.filter((b) => b.done).length;
  s.c.seen = books.map((b) => b.id);
  s.c.presets = asked ? 1 : 0;
  s.points = Math.round(s.c.minutes * POINTS.minute + s.c.goalDays * POINTS.goal + s.c.books * POINTS.book);
  return s;
}

export function loadJourney(): Promise<JourneySnap> {
  if (mem) return Promise.resolve(mem);
  if (!loading) {
    loading = (async () => {
      const repo = await getRepo();
      const [st, d, g, w] = await Promise.all(['journey', 'reading:days', 'goal', 'goal:days'].map((k) => repo.kvGet(k)));
      const days = parse<ReadingDays>(d, {});
      const goal = Number(g) > 0 ? Number(g) : DEFAULT_GOAL;
      const weekTarget = Number(w) > 0 ? Number(w) : DEFAULT_WEEK_TARGET;
      const state = st ? hydrate(parse<unknown>(st, null)) : await migrate(days, goal);
      mem = { state, days, goal, weekTarget };
      return mem;
    })().catch((e) => { loading = null; throw e; });
  }
  return loading;
}

function emit() { if (mem) listeners.forEach((f) => f(mem!)); }

function scheduleSave(delay: number) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void flushJourney(), delay);
}

/** Grava agora (ao sair do livro, ao terminar). */
export async function flushJourney(): Promise<void> {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  if (!mem) return;
  const repo = await getRepo();
  await Promise.all([repo.kvSet('journey', JSON.stringify(mem.state)), repo.kvSet('reading:days', JSON.stringify(mem.days))]);
}

/** Registra um evento e devolve o que aconteceu (para celebrar). */
export async function track(ev: JourneyEvent, now = new Date()): Promise<JourneyResult> {
  await loadJourney();
  const cur = mem!; // o estado mais novo (outro evento pode ter chegado enquanto carregava)
  const r = apply(cur.state, cur.days, ev, { now, goal: cur.goal, weekTarget: cur.weekTarget });
  mem = { ...cur, state: r.state, days: r.days };
  scheduleSave(ev.type === 'session-end' || ev.type === 'finish' ? 0 : 2500);
  emit();
  return r;
}

/** Avisa a cada mudança (devolve a função para parar). */
export function onJourney(fn: (s: JourneySnap) => void): () => void {
  listeners.add(fn);
  if (mem) fn(mem);
  else void loadJourney().then(fn).catch(() => undefined);
  return () => { listeners.delete(fn); };
}

export async function setJourneyGoals(p: { goal?: number; weekTarget?: number }): Promise<void> {
  const cur = await loadJourney();
  mem = { ...cur, goal: p.goal ?? cur.goal, weekTarget: p.weekTarget ?? cur.weekTarget };
  const repo = await getRepo();
  if (p.goal) await repo.kvSet('goal', String(p.goal));
  if (p.weekTarget) await repo.kvSet('goal:days', String(p.weekTarget));
  emit();
}

/** Mexe no estado sem evento (resumo visto, sugestão dispensada). */
async function patch(f: (s: JourneyState) => JourneyState): Promise<void> {
  const cur = await loadJourney();
  mem = { ...cur, state: f(mem!.state) };
  scheduleSave(500);
  emit();
}

export const markLastSeen = () => patch((s) => (s.last ? { ...s, last: { ...s.last, seen: true } } : s));
export const dismissAdvice = () => patch((s) => ({ ...s, adviceOff: dayKey(new Date()) }));
