/**
 * Síntese de áudio em JavaScript puro (sem Web Audio): gera os sons em
 * Float32Array. Assim o motor do celular só precisa tocar buffers em loop e
 * controlar volumes — a parte mais portátil de qualquer biblioteca de áudio.
 */

export type Rng = () => number;

/** Gerador pseudoaleatório com semente (mulberry32). */
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const between = (r: Rng, a: number, b: number) => a + r() * (b - a);

export type NoiseKind = 'white' | 'pink' | 'brown';

export function noise(kind: NoiseKind, len: number, r: Rng): Float32Array {
  const d = new Float32Array(len);
  let l = 0, b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = r() * 2 - 1;
    if (kind === 'brown') { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; }
    else if (kind === 'pink') {
      b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25;
    } else d[i] = w;
  }
  return d;
}

export type FilterKind = 'lowpass' | 'highpass' | 'bandpass';

/** Filtro biquad (fórmulas RBJ). `freq` pode variar no tempo. */
export function filter(
  buf: Float32Array, kind: FilterKind, freq: number | ((t: number) => number), q: number, sr: number,
): Float32Array {
  let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const setF = (f: number) => {
    const fc = Math.max(20, Math.min(sr * 0.45, f));
    const w0 = (2 * Math.PI * fc) / sr, cs = Math.cos(w0), al = Math.sin(w0) / (2 * Math.max(0.05, q));
    const a0 = 1 + al;
    if (kind === 'lowpass') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; }
    else if (kind === 'highpass') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; }
    else { b0 = al; b1 = 0; b2 = -al; }
    a1 = (-2 * cs) / a0; a2 = (1 - al) / a0; b0 /= a0; b1 /= a0; b2 /= a0;
  };
  const dyn = typeof freq === 'function';
  if (!dyn) setF(freq as number);
  for (let i = 0; i < buf.length; i++) {
    if (dyn && (i & 63) === 0) setF((freq as (t: number) => number)(i / sr));
    const x = buf[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    buf[i] = y;
  }
  return buf;
}

/** Multiplica o buffer por uma função de ganho no tempo. */
export function shape(buf: Float32Array, g: (t: number) => number, sr: number): Float32Array {
  for (let i = 0; i < buf.length; i++) buf[i] *= g(i / sr);
  return buf;
}

export function add(dst: Float32Array, src: Float32Array, at = 0, gain = 1): void {
  const n = Math.min(src.length, dst.length - at);
  for (let i = Math.max(0, -at); i < n; i++) dst[at + i] += src[i] * gain;
}

/** Reamostra para cima com interpolação linear e suavização leve. */
export function upsample(buf: Float32Array, factor: number): Float32Array {
  if (factor === 1) return buf;
  const out = new Float32Array(buf.length * factor);
  for (let i = 0; i < buf.length; i++) {
    const a = buf[i], b = buf[(i + 1) % buf.length];
    for (let k = 0; k < factor; k++) out[i * factor + k] = a + ((b - a) * k) / factor;
  }
  let y = out[out.length - 1];
  for (let i = 0; i < out.length; i++) { y += (out[i] - y) * 0.6; out[i] = y; }
  return out;
}

/** Envelope: subida linear e queda exponencial (como no Web Audio). */
export function envelope(len: number, att: number, dur: number, sr: number): Float32Array {
  const e = new Float32Array(len);
  const na = Math.max(1, Math.round(att * sr)), nd = Math.max(1, Math.round(dur * sr));
  for (let i = 0; i < len; i++) {
    if (i < na) e[i] = i / na;
    else { const k = (i - na) / nd; e[i] = k >= 1 ? 0 : Math.pow(0.001, k); }
  }
  return e;
}

/** Rajada de ruído filtrado com envelope, somada em `dst` no instante `t`. */
export function burst(
  dst: Float32Array, t: number, r: Rng, sr: number,
  o: { noise?: NoiseKind; type?: FilterKind; f: number; fEnd?: number; q?: number; att?: number; dur: number; amp: number },
): void {
  const att = o.att ?? 0.003, len = Math.round((att + o.dur + 0.02) * sr);
  const n = noise(o.noise ?? 'white', len, r);
  const span = att + o.dur;
  filter(n, o.type ?? 'bandpass', o.fEnd ? (x) => o.f + (o.fEnd! - o.f) * Math.min(1, x / span) : o.f, o.q ?? 1, sr);
  const e = envelope(len, att, o.dur, sr);
  for (let i = 0; i < len; i++) n[i] *= e[i] * o.amp;
  add(dst, n, Math.round(t * sr));
}

export type Wave = 'sine' | 'triangle' | 'sawtooth' | 'square';

const osc = (w: Wave, ph: number) => {
  const p = ph - Math.floor(ph);
  if (w === 'sine') return Math.sin(2 * Math.PI * p);
  if (w === 'triangle') return 4 * Math.abs(p - 0.5) - 1;
  if (w === 'sawtooth') return 2 * p - 1;
  return p < 0.5 ? 1 : -1;
};

/** Tom com glissando, envelope e vibrato opcional. */
export function tone(
  dst: Float32Array, t: number, sr: number,
  o: { f0: number; f1?: number; att: number; dur: number; amp: number; wave?: Wave; vib?: [number, number]; lp?: number },
): void {
  const total = o.att + o.dur, len = Math.round((total + 0.02) * sr), f1 = o.f1 ?? o.f0;
  const out = new Float32Array(len);
  const e = envelope(len, o.att, o.dur, sr);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / sr;
    let f = o.f0 + (f1 - o.f0) * Math.min(1, tt / total);
    if (o.vib) f += o.vib[1] * Math.sin(2 * Math.PI * o.vib[0] * tt);
    ph += f / sr;
    out[i] = osc(o.wave ?? 'sine', ph) * e[i] * o.amp;
  }
  if (o.lp) filter(out, 'lowpass', o.lp, 0.7, sr);
  add(dst, out, Math.round(t * sr));
}

/** Rosnado/ronronar: ruído grave com tremolo rápido. */
export function growl(dst: Float32Array, t: number, r: Rng, sr: number, o: { dur: number; lp: number; amp: number; rate?: number }): void {
  const len = Math.round((o.dur + 0.8) * sr);
  const n = filter(noise('brown', len, r), 'lowpass', o.lp, 0.7, sr);
  const rate = o.rate ?? between(r, 22, 30);
  const e = envelope(len, 0.6, o.dur, sr);
  for (let i = 0; i < len; i++) n[i] *= e[i] * o.amp * (0.55 + 0.45 * Math.sin(2 * Math.PI * rate * (i / sr)));
  add(dst, n, Math.round(t * sr));
}

/**
 * Torna o buffer um loop sem emenda: o final é misturado ao começo
 * (crossfade de potência constante). Devolve um buffer `xf` mais curto.
 */
export function loopify(buf: Float32Array, xf: number, sr: number): Float32Array {
  const X = Math.min(Math.round(xf * sr), Math.floor(buf.length / 3));
  const L = buf.length - X;
  const out = buf.slice(0, L);
  for (let i = 0; i < X; i++) {
    const k = i / X;
    out[i] = buf[i] * Math.sin((k * Math.PI) / 2) + buf[L + i] * Math.cos((k * Math.PI) / 2);
  }
  return out;
}

export function rms(buf: Float32Array): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / Math.max(1, buf.length));
}

export function peak(buf: Float32Array): number {
  let p = 0;
  for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > p) p = a; }
  return p;
}

/** Ajusta o nível para um RMS alvo, sem deixar o pico passar de `maxPeak`. */
export function normalize(buf: Float32Array, targetRms: number, maxPeak = 0.9): Float32Array {
  const r = rms(buf), p = peak(buf);
  if (r === 0) return buf;
  const g = Math.min(targetRms / r, maxPeak / p);
  for (let i = 0; i < buf.length; i++) buf[i] *= g;
  return buf;
}

/**
 * Reverberação leve (Schroeder: 4 combs + 2 allpass) para os sons pontuais
 * parecerem vir de dentro do ambiente, e não colados no ouvido.
 */
export function roomVerb(buf: Float32Array, sr: number, mix = 0.35, tail = 1.6): Float32Array {
  const len = buf.length + Math.round(tail * sr);
  const dry = new Float32Array(len);
  dry.set(buf);
  const wet = new Float32Array(len);
  const scale = sr / 44100;
  for (const [d, fb] of [[1557, 0.8], [1617, 0.79], [1491, 0.78], [1422, 0.77]] as const) {
    const D = Math.round(d * scale), line = new Float32Array(D);
    let p = 0, lp = 0;
    for (let i = 0; i < len; i++) {
      const out = line[p];
      lp = out * 0.6 + lp * 0.4;
      line[p] = dry[i] + lp * fb;
      wet[i] += out * 0.25;
      p = (p + 1) % D;
    }
  }
  for (const d of [225, 556]) {
    const D = Math.round(d * scale), line = new Float32Array(D);
    let p = 0;
    for (let i = 0; i < len; i++) {
      const bo = line[p], x = wet[i];
      const y = -x + bo;
      line[p] = x + bo * 0.5;
      wet[i] = y;
      p = (p + 1) % D;
    }
  }
  for (let i = 0; i < len; i++) dry[i] = dry[i] * (1 - mix * 0.5) + wet[i] * mix;
  return dry;
}
