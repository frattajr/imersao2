/**
 * Repositório de sons no app: pergunta ao servidor qual arquivo usar para
 * cada descrição. Junta os pedidos feitos no mesmo instante numa chamada só,
 * guarda as respostas e, quando o som ainda está sendo gerado, tenta de novo
 * mais tarde (até lá toca a síntese).
 */
import { descKey, type SoundDesc } from '../../supabase/functions/_shared/sound-library';
import { planDescs } from '../core/sound';
import type { ScenePlan } from '../core/types';
import { ensureSession, supabase } from './supabase';

export interface LibraryHit { id: string; url: string }

type Item = { status: 'hit'; id: string; url: string } | { status: 'pending' } | { status: 'none' };

const RETRY_MS = 45_000; // som em geração: pergunta de novo depois disso
const MAX_BATCH = 12;

class SoundLibrary {
  private known = new Map<string, LibraryHit | null>();
  private retryAt = new Map<string, number>();
  private inflight = new Map<string, Promise<LibraryHit | null>>();
  private queue: { d: SoundDesc; key: string; done: (h: LibraryHit | null) => void }[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private off = !supabase;

  /** Arquivo para a descrição, ou null (usa gravação do pacote ou síntese). */
  resolve(d: SoundDesc): Promise<LibraryHit | null> {
    if (this.off) return Promise.resolve(null);
    // a chave ignora o "detail", mas ele muda a escolha: entra na chave local
    const key = descKey(d) + '|' + (d.detail ?? '');
    if (this.known.has(key)) return Promise.resolve(this.known.get(key)!);
    if ((this.retryAt.get(key) ?? 0) > Date.now()) return Promise.resolve(null);
    const running = this.inflight.get(key);
    if (running) return running;
    const p = new Promise<LibraryHit | null>((done) => {
      this.queue.push({ d, key, done });
      if (this.queue.length >= MAX_BATCH) this.flush();
      else if (!this.timer) this.timer = setTimeout(() => this.flush(), 60);
    });
    this.inflight.set(key, p);
    void p.finally(() => this.inflight.delete(key));
    return p;
  }

  /** Pede com antecedência os sons das próximas páginas (e dispara a geração dos novos). */
  prefetch(plans: (ScenePlan | null)[]): void {
    plans.forEach((p) => p && planDescs(p).forEach((d) => void this.resolve(d)));
  }

  /** "Som ruim": um voto; com 3 leitores, o som sai do repositório. */
  async report(id: string): Promise<void> {
    if (!supabase) return;
    await ensureSession();
    await supabase.functions.invoke('sound-resolve', { body: { report: id } });
    this.known.forEach((h, k) => { if (h?.id === id) this.known.delete(k); });
  }

  private flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const batch = this.queue.splice(0, MAX_BATCH);
    if (!batch.length) return;
    if (this.queue.length) this.timer = setTimeout(() => this.flush(), 0);
    void this.send(batch);
  }

  private async send(batch: typeof this.queue): Promise<void> {
    let items: Item[] = [];
    try {
      await ensureSession();
      const { data, error } = await supabase!.functions.invoke('sound-resolve', { body: { descs: batch.map((b) => b.d) } });
      if (error) {
        // função não publicada ainda (404) ou sem login: desliga para não insistir
        const status = (error as { context?: { status?: number } }).context?.status;
        if (status === 404 || status === 401) this.off = true;
      } else {
        items = Array.isArray((data as { items?: unknown })?.items) ? (data as { items: Item[] }).items : [];
      }
    } catch {
      // sem rede: tenta de novo mais tarde
    }
    batch.forEach((b, i) => {
      const it = items[i];
      if (it?.status === 'hit' && typeof it.url === 'string') {
        const hit = { id: it.id, url: it.url };
        this.known.set(b.key, hit);
        b.done(hit);
      } else {
        if (it?.status === 'none') this.known.set(b.key, null);
        else this.retryAt.set(b.key, Date.now() + RETRY_MS);
        b.done(null);
      }
    });
  }
}

export const soundLibrary = new SoundLibrary();
