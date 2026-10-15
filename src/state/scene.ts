/**
 * Decide o som de cada página, nesta ordem:
 *  1. plano calibrado que vem com o livro (obras de exemplo);
 *  2. plano já guardado no aparelho;
 *  3. servidor, em lotes de 8 páginas, um pouco antes de você chegar lá —
 *     para livros públicos (exemplos, Project Gutenberg) só o cache global,
 *     sem chamar a IA; a IA só roda para textos da própria pessoa;
 *  4. mapa de cenas do livro (src/core/narrative.ts), enquanto nada disso
 *     chegou — ou sempre, nos livros públicos sem plano pré-calculado.
 */
import { analyze } from '../core/analyze';
import type { Ambience, ScenePlan } from '../core/types';
import { aiAvailable, AiError, fetchScenePlans } from '../services/ai';
import { soundLibrary } from '../services/sounds';
import { getRepo } from './db';

const BATCH = 8;

export class SceneDirector {
  private inflight = new Map<number, Promise<void>>();
  private waiting = new Set<number>();
  private plans = new Map<number, ScenePlan>();
  private disabled = !aiAvailable();

  constructor(
    private bookId: string, private title: string, private pages: string[], private onPlan: (page: number) => void,
    private opts: { publicBook?: boolean; bundled?: (ScenePlan | null)[]; fallback?: (i: number) => ScenePlan } = {},
  ) {}

  /** Plano disponível agora (IA se já chegou; senão palavras-chave). */
  async planFor(i: number): Promise<{ plan: ScenePlan; fromAi: boolean; pending: boolean }> {
    const calibrated = this.opts.bundled?.[i];
    if (calibrated) return { plan: calibrated, fromAi: true, pending: false };
    let p = this.plans.get(i);
    if (!p) {
      const cached = await (await getRepo()).getPlan(this.bookId, i);
      if (cached) { this.plans.set(i, cached); p = cached; }
    }
    this.prefetch(i);
    if (p) return { plan: p, fromAi: true, pending: false };
    const local = this.opts.fallback ? this.opts.fallback(i) : analyze(this.pages[i] ?? '');
    return { plan: local, fromAi: false, pending: !this.disabled && this.waiting.has(Math.floor(i / BATCH)) };
  }

  private prefetch(i: number): void {
    const b = Math.floor(i / BATCH);
    void this.ensureBatch(b);
    if (i % BATCH >= BATCH - 3) void this.ensureBatch(b + 1);
  }

  private ensureBatch(b: number): Promise<void> {
    // livro com planos calibrados: nada a pedir ao servidor
    if (this.disabled || this.opts.bundled?.length || b * BATCH >= this.pages.length) return Promise.resolve();
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
        const plans = await fetchScenePlans(this.title, slice, prev, !!this.opts.publicBook);
        await repo.savePlans(this.bookId, from, plans);
        plans.forEach((p, k) => { if (p) { this.plans.set(from + k, p); this.onPlan(from + k); } });
        // busca (ou manda gerar) os sons das próximas páginas antes de o leitor chegar nelas
        soundLibrary.prefetch(plans);
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
