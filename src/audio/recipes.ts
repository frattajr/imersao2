/**
 * Receitas de som: como cada ambiente e cada som pontual é sintetizado.
 * Servem de reserva (ou de base) quando não há gravação real no pacote de sons.
 */
import type { Layer, Spot } from '../core/types';
import { add, between, burst, filter, growl, loopify, noise, normalize, peak, rng, roomVerb, shape, tone, upsample, type Rng } from './dsp';

const TAU = 2 * Math.PI;
const sinT = (f: number, ph = 0) => (t: number) => Math.sin(TAU * f * t + ph);

/** Distribui eventos ao longo do buffer em intervalos aleatórios. */
function events(len: number, every: number, jit: number, r: Rng, fn: (t: number) => void) {
  let t = between(r, 0, every);
  while (t < len) {
    fn(t);
    t += every * (1 + (r() * 2 - 1) * jit);
  }
}

function murmur(out: Float32Array, voices: number, depth: number, r: Rng, sr: number) {
  for (let v = 0; v < voices; v++) {
    const n = filter(noise('pink', out.length, r), 'bandpass', between(r, 300, 2800), 1.1, sr);
    const f1 = between(r, 2.2, 6), f2 = between(r, 0.15, 0.7), p1 = r() * TAU, p2 = r() * TAU;
    shape(n, (t) => Math.max(0, 0.5 + depth * Math.sin(TAU * f1 * t + p1) + 0.25 * Math.sin(TAU * f2 * t + p2)), sr);
    add(out, n, 0, 0.5);
  }
}

interface LayerRecipe {
  /** nível RMS do loop pronto (o equilíbrio entre camadas) */
  rms: number;
  /** duração do loop em segundos (múltiplo do ritmo, quando houver) */
  loop: number;
  /** canal direito = canal esquerdo deslocado (falso para ritmos) */
  wide: boolean;
  /** gera numa taxa menor (sr/div) e reamostra: sons graves não precisam de agudos, e fica bem mais rápido no celular */
  div: 1 | 2 | 4;
  render(len: number, r: Rng, sr: number): Float32Array;
}

const XF = 3; // segundos de crossfade no ponto do loop

export const LAYER_RECIPES: Record<Layer, LayerRecipe> = {
  wind: {
    rms: 0.06, loop: 18, wide: true, div: 2,
    render(len, r, sr) {
      const n = len * sr, out = new Float32Array(n);
      const a = filter(noise('pink', n, r), 'bandpass', (t) => 420 + 190 * Math.sin(TAU * 0.06 * t) + 90 * Math.sin(TAU * 0.11 * t + 1), 0.6, sr);
      shape(a, (t) => 0.55 + 0.3 * sinT(0.05)(t) + 0.15 * sinT(0.13, 2)(t), sr);
      add(out, a);
      const b = filter(noise('pink', n, r), 'bandpass', 1300, 0.5, sr);
      shape(b, (t) => 0.12 + 0.1 * sinT(0.08, 1)(t), sr);
      add(out, b);
      return out;
    },
  },
  leaves: {
    rms: 0.035, loop: 16, wide: true, div: 1,
    render(len, r, sr) {
      const n = len * sr;
      const out = filter(filter(noise('white', n, r), 'highpass', 2200, 0.7, sr), 'lowpass', 7500, 0.7, sr);
      shape(out, (t) => Math.max(0, 0.4 + 0.25 * sinT(0.17)(t) + 0.15 * sinT(0.29, 1)(t) + 0.12 * sinT(9, 2)(t)), sr);
      events(len, 0.11, 0.9, r, (t) => burst(out, t, r, sr, { f: between(r, 3000, 6500), q: 0.8, dur: between(r, 0.02, 0.06), amp: between(r, 0.05, 0.18) }));
      return out;
    },
  },
  birds: {
    rms: 0.012, loop: 16, wide: true, div: 4,
    render(len, r, sr) {
      return filter(noise('pink', len * sr, r), 'lowpass', 700, 0.7, sr);
    },
  },
  rain: {
    rms: 0.07, loop: 16, wide: true, div: 1,
    render(len, r, sr) {
      const n = len * sr;
      const out = filter(filter(noise('pink', n, r), 'highpass', 900, 0.7, sr), 'lowpass', 9000, 0.7, sr);
      add(out, filter(noise('brown', n, r), 'lowpass', 450, 0.7, sr), 0, 0.5);
      events(len, 0.05, 0.9, r, (t) => burst(out, t, r, sr, { f: between(r, 2500, 7000), q: 1.5, dur: between(r, 0.012, 0.03), amp: between(r, 0.03, 0.1) }));
      return out;
    },
  },
  thunder: {
    rms: 0.001, loop: 8, wide: false, div: 4,
    render(len, _r, sr) {
      return new Float32Array(len * sr); // só eventos esporádicos
    },
  },
  sea: {
    rms: 0.08, loop: 22, wide: true, div: 2,
    render(len, r, sr) {
      const n = len * sr, out = new Float32Array(n);
      const swell = (t: number) => 0.5 + 0.45 * Math.sin(TAU * t / 11) + 0.1 * sinT(0.037)(t);
      const a = filter(noise('brown', n, r), 'lowpass', (t) => 600 + 250 * Math.sin(TAU * t / 11), 0.7, sr);
      add(out, shape(a, (t) => Math.max(0.05, swell(t)), sr));
      const b = filter(filter(noise('pink', n, r), 'highpass', 1800, 0.7, sr), 'lowpass', 6500, 0.7, sr);
      add(out, shape(b, (t) => Math.max(0, 0.1 + 0.1 * Math.sin(TAU * (t - 1.2) / 11)), sr));
      return out;
    },
  },
  water: {
    rms: 0.05, loop: 16, wide: true, div: 2,
    render(len, r, sr) {
      const n = len * sr, out = new Float32Array(n);
      ([[900, 0.7], [2000, 0.6], [3600, 0.5]] as const).forEach(([f, q], i) => {
        const b = filter(noise('pink', n, r), 'bandpass', f, q, sr);
        shape(b, (t) => 0.35 + 0.2 * sinT(3.1 + i * 1.7, i)(t) + 0.12 * sinT(7.3 + i * 2.3, i * 2)(t), sr);
        add(out, b);
      });
      return out;
    },
  },
  fire: {
    rms: 0.06, loop: 16, wide: true, div: 2,
    render(len, r, sr) {
      const n = len * sr;
      const out = filter(noise('brown', n, r), 'lowpass', 320, 0.7, sr);
      shape(out, (t) => 0.45 + 0.2 * sinT(0.6)(t) + 0.1 * sinT(1.3, 1)(t), sr);
      const hiss = filter(noise('pink', n, r), 'highpass', 3500, 0.7, sr);
      add(out, shape(hiss, (t) => 0.05 + 0.03 * sinT(0.7, 2)(t), sr));
      events(len, 0.12, 0.9, r, (t) => {
        const k = r();
        if (k < 0.6) burst(out, t, r, sr, { f: between(r, 3000, 7000), q: 1.5, att: 0.002, dur: between(r, 0.008, 0.02), amp: between(r, 0.08, 0.25) });
        else if (k < 0.9) {
          const c = 2 + Math.floor(r() * 3);
          for (let i = 0; i < c; i++) burst(out, t + i * between(r, 0.02, 0.05), r, sr, { f: between(r, 1200, 2600), q: 1.5, att: 0.002, dur: between(r, 0.02, 0.04), amp: between(r, 0.1, 0.3) });
        } else if (k < 0.97) burst(out, t, r, sr, { f: between(r, 700, 1200), q: 1, att: 0.002, dur: between(r, 0.06, 0.1), amp: between(r, 0.35, 0.55) });
        else burst(out, t, r, sr, { noise: 'brown', f: between(r, 110, 170), q: 1, att: 0.01, dur: 0.18, amp: 0.8 });
      });
      return out;
    },
  },
  cafe: {
    rms: 0.05, loop: 18, wide: true, div: 4,
    render(len, r, sr) {
      const n = len * sr, out = new Float32Array(n);
      murmur(out, 6, 0.35, r, sr);
      add(out, filter(noise('brown', n, r), 'lowpass', 220, 0.7, sr), 0, 0.3);
      return out;
    },
  },
  crowd: {
    rms: 0.05, loop: 18, wide: true, div: 4,
    render(len, r, sr) {
      const n = len * sr, out = new Float32Array(n);
      murmur(out, 9, 0.3, r, sr);
      add(out, filter(noise('brown', n, r), 'lowpass', 200, 0.7, sr), 0, 0.35);
      return out;
    },
  },
  city: {
    rms: 0.05, loop: 20, wide: true, div: 4,
    render(len, r, sr) {
      const n = len * sr;
      const out = filter(noise('brown', n, r), 'lowpass', 200, 0.7, sr);
      const b = filter(noise('pink', n, r), 'bandpass', 650, 0.4, sr);
      add(out, shape(b, (t) => 0.3 + 0.2 * sinT(0.05)(t) + 0.12 * sinT(0.083, 1)(t), sr));
      return out;
    },
  },
  train: {
    rms: 0.06, loop: 0.62 * 26, wide: false, div: 2,
    render(len, r, sr) {
      const n = Math.round(len * sr);
      const out = filter(noise('brown', n, r), 'lowpass', 170, 0.7, sr);
      add(out, filter(noise('pink', n, r), 'lowpass', 1100, 0.7, sr), 0, 0.12);
      for (let t = 0.2; t < len; t += 0.62) {
        burst(out, t, r, sr, { noise: 'brown', f: between(r, 600, 800), q: 0.9, att: 0.004, dur: 0.07, amp: 0.55 });
        burst(out, t + 0.11, r, sr, { noise: 'brown', f: between(r, 550, 700), q: 0.9, att: 0.004, dur: 0.06, amp: 0.35 });
      }
      return out;
    },
  },
  night: {
    rms: 0.025, loop: 16, wide: true, div: 4,
    render(len, r, sr) {
      const n = len * sr;
      const out = filter(noise('brown', n, r), 'lowpass', 260, 0.7, sr);
      add(out, filter(noise('pink', n, r), 'bandpass', 1800, 0.3, sr), 0, 0.04);
      return out;
    },
  },
  cricket: {
    rms: 0.02, loop: 16, wide: true, div: 1,
    render(len, r, sr) {
      const out = new Float32Array(len * sr);
      events(len, 0.8, 0.6, r, (t) => {
        const f = between(r, 4200, 4800);
        for (let i = 0; i < 3; i++) tone(out, t + i * 0.045, sr, { f0: f, att: 0.008, dur: 0.025, amp: 0.09 });
      });
      return out;
    },
  },
  clock: {
    rms: 0.03, loop: 16, wide: false, div: 1,
    render(len, r, sr) {
      const out = new Float32Array(Math.round(len * sr));
      for (let s = 0, k = 0; s < len; s += 1, k ^= 1) {
        burst(out, s + 0.1, r, sr, { f: k ? 2800 : 2100, q: 10, att: 0.001, dur: 0.05, amp: 0.5 });
        burst(out, s + 0.1, r, sr, { noise: 'brown', f: 700, q: 2, att: 0.001, dur: 0.03, amp: 0.3 });
      }
      return out;
    },
  },
};

/** Renderiza o loop de uma camada, pronto para tocar (estéreo opcional). */
export function renderLayer(name: Layer, sr: number, seed = 1): { left: Float32Array; right: Float32Array } {
  const rec = LAYER_RECIPES[name];
  const r = rng(seed * 7919 + name.length * 131);
  const lo = sr / rec.div;
  // ritmos (trem, relógio) têm eventos com período que divide o loop: o crossfade os mantém alinhados
  const left = upsample(loopify(rec.render(rec.loop + XF, r, lo), XF, lo), rec.div);
  normalize(left, rec.rms);
  let right = left;
  if (rec.wide) {
    // canal direito: o mesmo loop deslocado pela metade — descorrelacionado, sem custo extra
    right = new Float32Array(left.length);
    const h = Math.floor(left.length / 2);
    right.set(left.subarray(h));
    right.set(left.subarray(0, h), left.length - h);
  }
  return { left, right };
}

/* ---------- Eventos esporádicos de algumas camadas ---------- */

export interface Sporadic { every: number; jit: number; gain: number; render(sr: number, r: Rng): Float32Array }

export const SPORADIC: Partial<Record<Layer, Sporadic>> = {
  birds: {
    every: 3.5, jit: 0.8, gain: 1,
    render(sr, r) {
      const out = new Float32Array(Math.round(1.2 * sr));
      const ph = 2 + Math.floor(r() * 4), fc = between(r, 2600, 4600), sp = between(r, 0.08, 0.18);
      for (let i = 0; i < ph; i++) tone(out, i * sp, sr, { f0: fc * between(r, 0.9, 1.15), f1: fc * between(r, 0.75, 1.3), att: 0.008, dur: between(r, 0.05, 0.1), amp: between(r, 0.15, 0.3), vib: [between(r, 25, 45), fc * 0.015] });
      return normalize(roomVerb(out, sr, 0.3), 0.012, 0.12);
    },
  },
  thunder: {
    every: 24, jit: 0.5, gain: 1,
    render(sr, r) {
      const out = new Float32Array(Math.round(9 * sr));
      const n = filter(noise('brown', out.length, r), 'lowpass', between(r, 90, 170), 0.7, sr);
      const e = (t: number) => (t < 1.8 ? t / 1.8 : Math.pow(0.001, (t - 1.8) / 6));
      add(out, shape(n, (t) => e(t) * (0.8 + 0.2 * Math.sin(TAU * 0.7 * t)), sr));
      return normalize(out, 0.05, 0.4);
    },
  },
  sea: {
    every: 11, jit: 0.5, gain: 1,
    render(sr, r) {
      const out = new Float32Array(Math.round(6 * sr));
      burst(out, 0, r, sr, { noise: 'pink', type: 'highpass', f: 800, q: 0.5, att: 1.8, dur: 3.2, amp: 0.5 });
      burst(out, 0, r, sr, { noise: 'brown', type: 'lowpass', f: 400, q: 0.5, att: 1.5, dur: 3.5, amp: 0.9 });
      return normalize(out, 0.035, 0.3);
    },
  },
  cafe: {
    every: 5.5, jit: 0.6, gain: 1,
    render(sr, r) {
      const out = new Float32Array(Math.round(1.6 * sr));
      const k = r();
      if (k < 0.55) { const f = between(r, 2800, 5000); burst(out, 0, r, sr, { f, q: 30, att: 0.002, dur: 0.35, amp: 0.1 }); burst(out, between(r, 0.08, 0.16), r, sr, { f: f * 1.34, q: 30, att: 0.002, dur: 0.3, amp: 0.06 }); }
      else if (k < 0.85) burst(out, 0, r, sr, { noise: 'brown', f: between(r, 180, 260), q: 3, dur: 0.1, amp: 0.5 });
      else burst(out, 0, r, sr, { f: 6500, q: 0.8, att: 0.4, dur: 1.1, amp: 0.12 });
      return normalize(roomVerb(out, sr, 0.3), 0.01, 0.12);
    },
  },
  city: {
    every: 16, jit: 0.5, gain: 1,
    render(sr, r) {
      const out = new Float32Array(Math.round(6 * sr));
      burst(out, 0, r, sr, { noise: 'pink', f: 380, fEnd: 900, q: 0.8, att: 2.2, dur: 3, amp: 0.7 });
      return normalize(out, 0.025, 0.25);
    },
  },
};

/* ---------- Sons pontuais ---------- */

type SpotRender = (out: Float32Array, p: Spot, r: Rng, sr: number) => void;

const SPOT_RECIPES: Record<Spot['s'], { len: (p: Spot) => number; render: SpotRender }> = {
  steps: {
    len: (p) => (p.n ?? 4) * (p.pace ?? 0.6) + 0.6,
    render(out, p, r, sr) {
      const n = p.n ?? 4, pace = p.pace ?? 0.6, s = p.surface ?? 'wood';
      for (let i = 0; i < n; i++) {
        const t = i * pace * between(r, 0.93, 1.07), a = between(r, 0.75, 1);
        burst(out, t, r, sr, { noise: 'brown', f: between(r, 110, 170), q: 1.2, att: 0.005, dur: 0.09, amp: 0.9 * a });
        if (s === 'gravel') for (let k = 0; k < 5; k++) burst(out, t + between(r, 0, 0.12), r, sr, { f: between(r, 2000, 5500), q: 1, att: 0.002, dur: between(r, 0.02, 0.05), amp: 0.35 * a });
        else if (s === 'snow') burst(out, t, r, sr, { noise: 'pink', f: between(r, 1200, 2000), q: 1.2, att: 0.01, dur: 0.12, amp: 0.5 * a });
        else if (s === 'grass') burst(out, t, r, sr, { noise: 'pink', type: 'lowpass', f: 1400, q: 0.7, att: 0.01, dur: 0.1, amp: 0.35 * a });
        else if (s === 'metal') { burst(out, t, r, sr, { f: between(r, 850, 950), q: 14, att: 0.002, dur: 0.35, amp: 0.5 * a }); burst(out, t, r, sr, { noise: 'brown', f: 160, q: 1, att: 0.004, dur: 0.08, amp: 0.7 * a }); }
        else if (s === 'stone') burst(out, t, r, sr, { f: between(r, 1400, 2000), q: 2, att: 0.002, dur: 0.05, amp: 0.5 * a });
        else {
          burst(out, t, r, sr, { noise: 'pink', f: between(r, 400, 700), q: 2, att: 0.004, dur: 0.07, amp: 0.4 * a });
          if (r() < 0.35) tone(out, t + 0.02, sr, { f0: between(r, 220, 300), f1: between(r, 150, 200), att: 0.02, dur: 0.18, amp: 0.05 * a, wave: 'sawtooth', vib: [18, 8], lp: 1200 });
        }
      }
    },
  },
  door: {
    len: (p) => (p.kind === 'close' ? 0.8 : 2.4),
    render(out, p, r, sr) {
      if (p.kind === 'close') { burst(out, 0, r, sr, { noise: 'brown', f: 120, q: 1, att: 0.005, dur: 0.25, amp: 1.1 }); burst(out, 0.02, r, sr, { f: 2200, q: 8, att: 0.002, dur: 0.05, amp: 0.25 }); return; }
      const du = between(r, 1.2, 1.8);
      burst(out, 0, r, sr, { f: 700, fEnd: between(r, 1100, 1500), q: 10, att: 0.12, dur: du, amp: 0.3 });
      tone(out, 0, sr, { f0: between(r, 130, 170), f1: between(r, 220, 300), att: 0.12, dur: du, amp: 0.06, wave: 'sawtooth', vib: [11, 10], lp: 1500 });
      burst(out, du + 0.1, r, sr, { noise: 'brown', f: 150, q: 1, att: 0.01, dur: 0.14, amp: 0.5 });
    },
  },
  knock: {
    len: (p) => (p.n ?? 3) * 0.3 + 0.4,
    render(out, p, r, sr) {
      for (let i = 0; i < (p.n ?? 3); i++) {
        const t = i * between(r, 0.22, 0.3);
        burst(out, t, r, sr, { noise: 'brown', f: between(r, 170, 210), q: 1.5, dur: 0.1, amp: 1 });
        burst(out, t, r, sr, { f: between(r, 800, 1000), q: 3, att: 0.002, dur: 0.04, amp: 0.35 });
      }
    },
  },
  doorbell: {
    len: () => 1.5,
    render(out, _p, _r, sr) { [2093, 2637, 3136].forEach((f, i) => tone(out, i * 0.07, sr, { f0: f, att: 0.003, dur: 1.1, amp: 0.1 })); },
  },
  keys: {
    len: () => 0.9,
    render(out, _p, r, sr) { for (let i = 0; i < 6; i++) burst(out, i * between(r, 0.03, 0.09), r, sr, { f: between(r, 3500, 6500), q: 20, att: 0.002, dur: between(r, 0.08, 0.18), amp: 0.2 }); },
  },
  roar: {
    len: () => 4.5,
    render(out, _p, r, sr) {
      const du = between(r, 2.2, 3.4);
      growl(out, 0, r, sr, { dur: du, lp: 320, amp: 1 });
      tone(out, 0, sr, { f0: between(r, 58, 70), f1: between(r, 36, 44), att: 0.6, dur: du, amp: 0.4, wave: 'triangle', vib: [26, 9] });
    },
  },
  howl: {
    len: () => 3.6,
    render(out, _p, r, sr) {
      const f = between(r, 360, 440);
      tone(out, 0, sr, { f0: f, f1: f * 1.7, att: 0.7, dur: 0.9, amp: 0.09, wave: 'triangle', vib: [5, 5] });
      tone(out, 1.5, sr, { f0: f * 1.7, f1: f * 1.35, att: 0.1, dur: 1.6, amp: 0.09, wave: 'triangle', vib: [5.5, 6] });
      tone(out, 0, sr, { f0: f * 2, f1: f * 3.4, att: 0.7, dur: 0.9, amp: 0.03, vib: [5, 8] });
    },
  },
  bark: {
    len: (p) => (p.n ?? 3) * 0.65 + 0.3,
    render(out, p, r, sr) {
      for (let i = 0; i < (p.n ?? 3); i++) {
        const t = i * between(r, 0.45, 0.65);
        burst(out, t, r, sr, { noise: 'pink', f: between(r, 600, 1000), q: 2, att: 0.01, dur: 0.14, amp: 0.5 });
        tone(out, t, sr, { f0: between(r, 340, 420), f1: between(r, 220, 280), att: 0.01, dur: 0.1, amp: 0.1, wave: 'sawtooth', lp: 1800 });
      }
    },
  },
  owl: {
    len: () => 1.8,
    render(out, _p, r, sr) { [0, 0.45, 0.95].forEach((o, i) => tone(out, o, sr, { f0: between(r, 370, 390), f1: between(r, 320, 340), att: 0.07, dur: i < 2 ? 0.28 : 0.55, amp: 0.14 })); },
  },
  bell: {
    len: (p) => (p.n ?? 3) * 2.4 + 2,
    render(out, p, _r, sr) {
      for (let i = 0; i < (p.n ?? 3); i++) ([[220, 0.5], [440, 0.3], [528, 0.25], [660, 0.2], [880, 0.12], [1320, 0.06]] as const).forEach(([f, a]) => tone(out, i * 2.4, sr, { f0: f, att: 0.005, dur: 4, amp: a * 0.3 }));
    },
  },
  horn: {
    len: (p) => (p.kind === 'foghorn' ? 4.2 : 2),
    render(out, p, r, sr) {
      if (p.kind === 'foghorn') { [98, 147, 196].forEach((f, i) => tone(out, 0, sr, { f0: f, att: 1.2, dur: 2.6, amp: 0.12 - i * 0.03, wave: 'triangle' })); return; }
      [523, 659].forEach((f) => tone(out, 0, sr, { f0: f, f1: f * 1.01, att: 0.08, dur: 1.6, amp: 0.08, wave: 'triangle' }));
      burst(out, 0, r, sr, { f: 3000, q: 2, att: 0.05, dur: 1.5, amp: 0.04 });
    },
  },
  hooves: {
    len: (p) => (p.n ?? 8) * (p.pace ?? 0.35) + 0.4,
    render(out, p, r, sr) {
      const pace = p.pace ?? 0.35;
      for (let i = 0; i < (p.n ?? 8); i++) {
        burst(out, i * pace, r, sr, { f: i % 2 ? 1100 : 850, q: 4, att: 0.002, dur: 0.05, amp: 0.4 });
        burst(out, i * pace, r, sr, { noise: 'brown', f: 140, q: 1, att: 0.003, dur: 0.07, amp: 0.7 });
      }
    },
  },
  creak: {
    len: () => 1.8,
    render(out, _p, r, sr) {
      const du = between(r, 0.9, 1.5);
      burst(out, 0, r, sr, { f: 500, fEnd: between(r, 420, 680), q: 12, att: 0.2, dur: du, amp: 0.25 });
      tone(out, 0, sr, { f0: between(r, 85, 100), f1: between(r, 105, 125), att: 0.2, dur: du, amp: 0.04, wave: 'sawtooth', vib: [9, 6], lp: 1200 });
    },
  },
  drip: {
    len: (p) => (p.n ?? 4) * 2.2 + 0.4,
    render(out, p, r, sr) {
      let t = 0;
      for (let i = 0; i < (p.n ?? 4); i++) {
        const f = between(r, 900, 1500);
        tone(out, t, sr, { f0: f, f1: f * 0.65, att: 0.002, dur: 0.12, amp: 0.14 });
        burst(out, t, r, sr, { f, q: 6, att: 0.002, dur: 0.05, amp: 0.08 });
        t += between(r, 0.9, 2.2);
      }
    },
  },
  gust: {
    len: () => 4.4,
    render(out, _p, r, sr) { burst(out, 0, r, sr, { noise: 'pink', f: 500, fEnd: 900, q: 0.7, att: 1.5, dur: 2.6, amp: 0.6 }); },
  },
  rustle: {
    len: () => 1,
    render(out, _p, r, sr) { for (let i = 0; i < 3; i++) burst(out, i * 0.18, r, sr, { noise: 'pink', f: between(r, 2500, 3500), q: 0.6, att: 0.06, dur: 0.3, amp: 0.25 }); },
  },
  purr: {
    len: () => 5,
    render(out, _p, r, sr) { growl(out, 0, r, sr, { dur: 4, lp: 180, amp: 0.9 }); },
  },
  musicbox: {
    len: () => 5.5,
    render(out, _p, r, sr) {
      const sc = [1046, 1175, 1318, 1568, 1760, 2093];
      for (let i = 0; i < 9; i++) {
        const f = sc[Math.floor(r() * sc.length)], t = i * 0.42;
        tone(out, t, sr, { f0: f, att: 0.002, dur: 1.5, amp: 0.09 });
        tone(out, t, sr, { f0: f * 2.76, att: 0.002, dur: 0.5, amp: 0.02 });
      }
    },
  },
};

/**
 * Renderiza um som pontual: síntese + filtro que tira o agudo + reverberação
 * leve, com o pico ajustado pela intensidade `w` pedida.
 */
export function renderSpot(p: Spot, sr: number, seed = 1): Float32Array {
  const rec = SPOT_RECIPES[p.s];
  const r = rng(seed);
  const out = new Float32Array(Math.round(rec.len(p) * sr));
  rec.render(out, p, r, sr);
  filter(out, 'lowpass', 4200, 0.7, sr);
  const wet = roomVerb(out, sr, 0.4);
  const pk = peak(wet);
  if (pk > 0) { const g = (0.32 * p.w) / pk; for (let i = 0; i < wet.length; i++) wet[i] *= g; }
  return wet;
}
