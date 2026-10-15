/**
 * Listas e hábitos da pessoa, guardados no banco local (chave-valor):
 * "Quero ler", gostos escolhidos na primeira abertura, minutos lidos por dia
 * (para a meta diária e a sequência de dias) e a meta.
 */
import { addReading, type ReadingDays } from '../core/catalog';
import { getRepo } from './db';

const parse = <T,>(s: string | null, d: T): T => { try { return s ? (JSON.parse(s) as T) : d; } catch { return d; } };

export async function getWishlist(): Promise<string[]> {
  return parse<string[]>(await (await getRepo()).kvGet('wish'), []);
}

/** Põe ou tira da lista "Quero ler"; devolve se ficou na lista. */
export async function toggleWish(id: string): Promise<boolean> {
  const repo = await getRepo();
  const cur = parse<string[]>(await repo.kvGet('wish'), []);
  const on = !cur.includes(id);
  const next = on ? [id, ...cur] : cur.filter((x) => x !== id);
  await repo.kvSet('wish', JSON.stringify(next));
  return on;
}

export interface Tastes { themes: string[]; asked: boolean }
export async function getTastes(): Promise<Tastes> {
  return parse<Tastes>(await (await getRepo()).kvGet('tastes'), { themes: [], asked: false });
}
export async function setTastes(themes: string[]): Promise<void> {
  await (await getRepo()).kvSet('tastes', JSON.stringify({ themes, asked: true }));
}

export async function getReadingDays(): Promise<ReadingDays> {
  return parse<ReadingDays>(await (await getRepo()).kvGet('reading:days'), {});
}

export async function getGoal(): Promise<number> {
  const g = Number(await (await getRepo()).kvGet('goal'));
  return g > 0 ? g : 15;
}
export async function setGoal(min: number): Promise<void> {
  await (await getRepo()).kvSet('goal', String(min));
}

/* tempo de leitura: acumula em memória e grava de vez em quando */
let pendingMs = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Registra tempo de leitura (cada trecho limitado a 3 min: pausa longa não conta). */
export function logReading(ms: number): void {
  if (!(ms > 0)) return;
  pendingMs += Math.min(ms, 3 * 60_000);
  if (!flushTimer) flushTimer = setTimeout(() => void flushReading(), 20_000);
}

export async function flushReading(): Promise<void> {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  const ms = pendingMs;
  pendingMs = 0;
  if (ms < 1000) return;
  const repo = await getRepo();
  const days = parse<ReadingDays>(await repo.kvGet('reading:days'), {});
  await repo.kvSet('reading:days', JSON.stringify(addReading(days, new Date(), ms / 60_000)));
}
