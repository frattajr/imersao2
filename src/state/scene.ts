/**
 * Decide o som de cada página: usa o plano da IA (do cache local, ou pede ao
 * servidor em lotes de 8 páginas, um pouco antes de você chegar lá) e cai
 * para as palavras-chave enquanto a IA não respondeu.
 */
import { analyze } from '../core/analyze';
import type { Ambience, ScenePlan } from '../core/types';
import { aiAvailable, AiError, fetchScenePlans } from '../services/ai';
import { getRepo } from './db';

const BATCH = 8;

export class SceneDirector {
  private inflight = new Map<number, Promise<void>>();
  private waiting = new Set<number>();
  private plans = new Map<number, ScenePlan>();
  private disabled = !aiAvailable();

  constructor(private bookId: string, private title: string, private pages: string[], private onPlan: (page: number) => void) {}

  /** Plano disponível agora (IA se já chegou; senão palavras-chave). */
  async planFor(i: number): Promise<{ plan: ScenePlan; fromAi: boolean; pending: boolean }> {
    let p = this.plans.get(i);
    if (!p) {
      const cached = await (await getRepo()).getPlan(this.bookId, i);
      if (cached) { this.plans.set(i, cached); p = cached; }
    }
    this.prefetch(i);
    if (p) return { plan: p, fromAi: true, pending: false };
    return { plan: analyze(this.pages[i] ?? ''), fromAi: false, pending: !this.disabled && this.waiting.has(Math.floor(i / BATCH)) };
  }

  private prefetch(i: number): void {
    const b = Math.floor(i / BATCH);
    void this.ensureBatch(b);
    if (i % BATCH >= BATCH - 3) void this.ensureBatch(b + 1);
  }

  private ensureBatch(b: number): Promise<void> {
    if (this.disabled || b * BATCH >= this.pages.length) return Promise.resolve();
    const existing = this.inflight.get(b);
    if (existing) return existing;
    const job = (async () => {
      const from = b * BATCH;
      const slice = this.pages.slice(from, from + BATCH);
      const repo = await getRepo();
      // já temos todas desse lote no aparelho?
      const local = await Promise.all(slice.map((_, k) => repo.getPlan(this.bookId, from + k)));
      if (local.every(Boolean)) {
        local.forEach((p, k) => this.plans.set(from + k, p!));
        return;
      }
      this.waiting.add(b);
      let prev: Ambience | null = null;
      if (from > 0) prev = (this.plans.get(from - 1) ?? (await repo.getPlan(this.bookId, from - 1)))?.ambience ?? null;
      try {
        const plans = await fetchScenePlans(this.title, slice, prev);
        await repo.savePlans(this.bookId, from, plans);
        plans.forEach((p, k) => { if (p) { this.plans.set(from + k, p); this.onPlan(from + k); } });
      } catch (e) {
        if (e instanceof AiError && e.code !== 'failed') this.disabled = true;
        this.inflight.delete(b); // permite tentar de novo mais tarde
      } finally {
        this.waiting.delete(b);
      }
    })();
    this.inflight.set(b, job);
    return job;
  }
}
