/**
 * Suavização adaptativa do ambiente: quando a cena muda muito em pouco
 * tempo (leitura rápida, trechos com vários lugares), o som não acompanha
 * cada troca. As transições ficam mais longas, o volume das camadas baixa
 * um pouco, camadas recém-chegadas não somem de repente e camadas fracas
 * novas são ignoradas. Quando a leitura acalma, volta ao normal sozinho.
 */
import type { Ambience, Layer } from './types';

export interface SmoothResult {
  amb: Ambience;
  /** multiplica o tempo das transições (1 = normal, até 2,5) */
  fade: number;
  /** multiplica o volume das camadas (1 = normal, até 0,7) */
  gain: number;
  /** 0 = calmo, 1 = mudando muito */
  busy: number;
}

const WINDOW_MS = 90_000;  // olha as trocas do último minuto e meio
const MIN_HOLD_MS = 25_000; // uma camada que acabou de entrar fica pelo menos isso
const MAX_LAYERS = 4;

const diff = (a: Ambience, b: Ambience) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<Layer>;
  let d = 0;
  keys.forEach((k) => (d += Math.abs((a[k] ?? 0) - (b[k] ?? 0))));
  return d;
};

export class SceneSmoother {
  private hist: { t: number; d: number }[] = [];
  private since = new Map<Layer, number>();
  private prev: Ambience = {};

  /** Quanto a cena tem mudado (0 a 1). */
  busyness(now: number): number {
    this.hist = this.hist.filter((h) => now - h.t < WINDOW_MS);
    const total = this.hist.reduce((s, h) => s + h.d, 0);
    return Math.max(0, Math.min(1, (total - 0.6) / 1.8));
  }

  next(want: Ambience, now = Date.now()): SmoothResult {
    const d = diff(this.prev, want);
    if (d > 0.05) this.hist.push({ t: now, d });
    const b = this.busyness(now);
    const out: Ambience = {};

    (Object.keys(want) as Layer[]).forEach((k) => {
      const v = want[k] ?? 0;
      const isNew = !(k in this.prev);
      if (isNew && b > 0.5 && v < 0.3) return; // muita troca: não entra camada fraca nova
      out[k] = v;
    });
    // camadas que sairiam: seguram (mais baixas) se chegaram há pouco ou se a cena está agitada
    (Object.keys(this.prev) as Layer[]).forEach((k) => {
      if (k in out || k === 'thunder') return;
      const age = now - (this.since.get(k) ?? 0);
      if ((age < MIN_HOLD_MS || b > 0.3) && Object.keys(out).length < MAX_LAYERS) {
        const v = (this.prev[k] ?? 0) * 0.5;
        if (v >= 0.12) out[k] = v;
      }
    });

    (Object.keys(out) as Layer[]).forEach((k) => { if (!this.since.has(k) || !(k in this.prev)) this.since.set(k, now); });
    (Object.keys(this.prev) as Layer[]).forEach((k) => { if (!(k in out)) this.since.delete(k); });
    this.prev = out;
    return { amb: out, fade: 1 + 1.5 * b, gain: 1 - 0.3 * b, busy: b };
  }

  reset(): void {
    this.hist = [];
    this.since.clear();
    this.prev = {};
  }
}
