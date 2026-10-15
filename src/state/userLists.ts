/**
 * Listas e hábitos da pessoa, guardados no banco local (chave-valor):
 * "Quero ler" e gostos escolhidos na primeira abertura. Minutos por dia e
 * meta ficam na jornada do leitor.
 */
import type { ReadingDays } from '../core/catalog';
import { getRepo } from './db';
import { loadJourney, setJourneyGoals } from './journey';

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

/* minutos por dia e meta: ficam na jornada (src/state/journey.ts) */
export async function getReadingDays(): Promise<ReadingDays> {
  return (await loadJourney()).days;
}

export async function getGoal(): Promise<number> {
  return (await loadJourney()).goal;
}
export async function setGoal(min: number): Promise<void> {
  await setJourneyGoals({ goal: min });
}
