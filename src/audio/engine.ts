/**
 * Motor de ambiente sonoro.
 *
 * Usa só o essencial de qualquer API de áudio estilo Web Audio: buffers em
 * loop, nós de ganho e rampas de volume. Funciona com react-native-audio-api
 * (celular) e com o AudioContext do navegador. Cada camada toca uma gravação
 * real do pacote de sons quando existe; se não, um loop sintetizado.
 */
import type { Ambience, Layer, Spot } from '../core/types';
import { LAYERS } from '../core/types';
import { rng } from './dsp';
import { renderLayer, renderSpot, SPORADIC } from './recipes';

/* ---------- Subconjunto da API de áudio que usamos ---------- */
export interface ParamLike {
  value: number;
  setValueAtTime(v: number, t: number): unknown;
  linearRampToValueAtTime(v: number, t: number): unknown;
  cancelScheduledValues(t: number): unknown;
}
export interface NodeLike { connect(n: unknown): unknown; disconnect(): void }
export interface GainLike extends NodeLike { gain: ParamLike }
export interface BufferLike {
  duration: number;
  getChannelData(c: number): Float32Array;
  copyToChannel?(src: Float32Array, ch: number): void;
}
export interface SourceLike extends NodeLike {
  buffer: BufferLike | null;
  loop: boolean;
  start(when?: number, offset?: number): void;
  stop(when?: number): void;
}
export interface CtxLike {
  sampleRate: number;
  currentTime: number;
  state: string;
  destination: unknown;
  createGain(): GainLike;
  createBufferSource(): SourceLike;
  createBuffer(channels: number, length: number, sampleRate: number): BufferLike;
  resume(): Promise<unknown>;
  suspend(): Promise<unknown>;
  decodeAudioData?(data: ArrayBuffer): Promise<BufferLike>;
}

/** Pacote de gravações reais (manifest.json numa pasta pública). */
export interface PackManifest {
  layers?: Partial<Record<Layer, string[]>>;
  /** ex.: { "roar": ["roar-1.m4a"], "steps": { "wood": ["steps-wood.m4a"], "*": [...] } } */
  spots?: Partial<Record<Spot['s'], string[] | Record<string, string[]>>>;
}

/** Volume relativo de cada camada quando tocada a partir de gravação. */
const RECORDED_GAIN = 0.35;
const UP = 2.2;   // segundos para uma camada entrar
const DOWN = 3.6; // segundos para uma camada sair

interface Ramp { from: number; to: number; t0: number; t1: number }
interface LayerState {
  gain: GainLike;
  src: SourceLike | null;
  ramp: Ramp;
  level: number;
  recorded: boolean;
  loading: boolean;
  nextSporadic: number;
}

const valueAt = (r: Ramp, t: number) =>
  t >= r.t1 ? r.to : t <= r.t0 ? r.from : r.from + ((r.to - r.from) * (t - r.t0)) / (r.t1 - r.t0);

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export class AmbientEngine {
  private ctx: CtxLike | null = null;
  private master!: GainLike;
  private spotBus!: GainLike;
  private layers = new Map<Layer, LayerState>();
  private bufCache = new Map<string, BufferLike>();
  private renderQueue: Promise<unknown> = Promise.resolve();
  private manifest: PackManifest | null = null;
  private packUrl = '';
  private timer: ReturnType<typeof setInterval> | null = null;
  private volume = 0.7;
  private seed = 1;
  private enabled = true;

  constructor(private makeCtx: () => CtxLike) {}

  /** Cria o contexto de áudio (chame a partir de um toque do usuário). */
  start(): void {
    if (this.ctx) {
      if (this.enabled && this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const ctx = this.makeCtx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
    this.spotBus = ctx.createGain();
    this.spotBus.connect(this.master);
    this.timer = setInterval(() => this.tick(), 250);
  }

  get running(): boolean {
    return !!this.ctx;
  }

  /** Carrega o pacote de gravações reais (opcional). */
  async loadPack(baseUrl: string | undefined): Promise<void> {
    if (!baseUrl) return;
    try {
      const r = await fetch(baseUrl.replace(/\/$/, '') + '/manifest.json');
      if (!r.ok) return;
      this.manifest = (await r.json()) as PackManifest;
      this.packUrl = baseUrl.replace(/\/$/, '');
    } catch {
      this.manifest = null;
    }
  }

  setVolume(v: number): void {
    this.volume = v;
    this.enabled = v > 0;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(v, t + 0.3);
    if (v > 0 && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  async pause(): Promise<void> {
    if (this.ctx && this.ctx.state === 'running') await this.ctx.suspend();
  }

  async resume(): Promise<void> {
    if (this.ctx && this.enabled && this.ctx.state === 'suspended') await this.ctx.resume();
  }

  /** Define o ambiente: camadas novas sobem devagar, as que saem descem mais devagar ainda. */
  setScene(amb: Ambience): void {
    if (!this.ctx) return;
    if (this.enabled && this.ctx.state === 'suspended' && Object.values(amb).some((v) => (v ?? 0) > 0)) void this.ctx.resume();
    for (const L of LAYERS) {
      const target = amb[L] ?? 0;
      const st = this.layers.get(L);
      if (!st && target <= 0) continue;
      const s = st ?? this.createLayer(L);
      s.level = target;
      const gainTarget = target * (s.recorded ? RECORDED_GAIN : 1);
      this.rampLayer(s, gainTarget, gainTarget > valueAt(s.ramp, this.ctx.currentTime) ? UP : DOWN);
      if (target > 0 && !s.src && !s.loading) void this.loadLayer(L, s);
    }
  }

  /** Interrompe (com fade curto) os sons pontuais da página anterior. */
  clearSpots(): void {
    if (!this.ctx) return;
    const old = this.spotBus, t = this.ctx.currentTime;
    old.gain.cancelScheduledValues(t);
    old.gain.setValueAtTime(old.gain.value, t);
    old.gain.linearRampToValueAtTime(0, t + 0.8);
    setTimeout(() => { try { old.disconnect(); } catch { /* já desconectado */ } }, 1500);
    this.spotBus = this.ctx.createGain();
    this.spotBus.connect(this.master);
  }

  /** Toca os sons pontuais da cena, cada um no seu momento. */
  playSpots(spots: Spot[]): void {
    if (!this.ctx || !this.enabled) return;
    if (spots.length && this.ctx.state === 'suspended') void this.ctx.resume();
    this.lastSound = this.ctx.currentTime + 12;
    const bus = this.spotBus;
    for (const sp of spots.slice(0, 3)) {
      const reps = Math.max(1, Math.min(5, Math.round(sp.rep ?? 1)));
      const gap = sp.gap ?? 5;
      const t0 = this.ctx.currentTime + (sp.at ?? 2);
      void this.spotBuffer(sp).then((buf) => {
        if (!buf || !this.ctx || bus !== this.spotBus) return;
        for (let r = 0; r < reps; r++) {
          const src = this.ctx.createBufferSource();
          src.buffer = buf;
          src.connect(bus);
          src.start(Math.max(this.ctx.currentTime + 0.05, t0 + r * gap));
        }
      });
    }
  }

  /** Para tudo e libera o contexto (ex.: ao sair do leitor). */
  async dispose(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.layers.forEach((s) => { try { s.src?.stop(); } catch { /* */ } });
    this.layers.clear();
    const c = this.ctx;
    this.ctx = null;
    try { await (c as unknown as { close?: () => Promise<void> })?.close?.(); } catch { /* */ }
  }

  /* ---------- interno ---------- */

  private lastSound = 0;

  /**
   * Economia de bateria: para as camadas que já silenciaram há alguns
   * segundos (o buffer fica em cache, voltar é instantâneo) e suspende o
   * áudio quando nada toca há um tempo.
   */
  private reap(): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    let active = false;
    this.layers.forEach((s) => {
      if (s.level > 0 || now < s.ramp.t1 + 2) { active = true; return; }
      if (s.src) { try { s.src.stop(); s.src.disconnect(); } catch { /* já parado */ } s.src = null; }
    });
    if (active) this.lastSound = now;
    else if (ctx.state === 'running' && now - this.lastSound > 12) void ctx.suspend();
  }

  private createLayer(L: Layer): LayerState {
    const g = this.ctx!.createGain();
    g.gain.value = 0;
    g.connect(this.master);
    const s: LayerState = { gain: g, src: null, ramp: { from: 0, to: 0, t0: 0, t1: 0 }, level: 0, recorded: false, loading: false, nextSporadic: 0 };
    this.layers.set(L, s);
    return s;
  }

  private rampLayer(s: LayerState, to: number, dur: number): void {
    const ctx = this.ctx!, t = ctx.currentTime, from = valueAt(s.ramp, t);
    s.ramp = { from, to, t0: t, t1: t + dur };
    s.gain.gain.cancelScheduledValues(t);
    s.gain.gain.setValueAtTime(from, t);
    // duas etapas: a curva fica mais natural que uma reta única
    s.gain.gain.linearRampToValueAtTime(from + (to - from) * 0.7, t + dur * 0.45);
    s.gain.gain.linearRampToValueAtTime(to, t + dur);
  }

  private async loadLayer(L: Layer, s: LayerState): Promise<void> {
    s.loading = true;
    try {
      let buf: BufferLike | null = null;
      const files = this.manifest?.layers?.[L];
      if (files?.length) {
        buf = await this.fetchBuffer(files[Math.floor(Math.random() * files.length)]);
        if (buf) s.recorded = true;
      }
      if (!buf) buf = await this.synthLayer(L);
      if (!this.ctx || !buf || this.layers.get(L) !== s) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(s.gain);
      src.start(this.ctx.currentTime + 0.02, Math.random() * Math.max(0, buf.duration - 1));
      s.src = src;
      if (s.recorded) this.rampLayer(s, s.level * RECORDED_GAIN, UP);
    } finally {
      s.loading = false;
    }
  }

  /** Gera o loop sintetizado (um por vez, cedendo a vez para a interface). */
  private synthLayer(L: Layer): Promise<BufferLike | null> {
    const key = 'layer:' + L;
    const hit = this.bufCache.get(key);
    if (hit) return Promise.resolve(hit);
    const job = this.renderQueue.then(async () => {
      await sleep(16);
      const ctx = this.ctx;
      if (!ctx) return null;
      const { left, right } = renderLayer(L, ctx.sampleRate, this.seed++);
      const b = this.toBuffer([left, right]);
      this.bufCache.set(key, b);
      return b;
    });
    this.renderQueue = job.catch(() => null);
    return job;
  }

  private async spotBuffer(sp: Spot): Promise<BufferLike | null> {
    const entry = this.manifest?.spots?.[sp.s];
    if (entry) {
      const list = Array.isArray(entry) ? entry : entry[sp.surface ?? sp.kind ?? '*'] ?? entry['*'];
      if (list?.length) {
        const b = await this.fetchBuffer(list[Math.floor(Math.random() * list.length)]);
        if (b) return b;
      }
    }
    const key = 'spot:' + JSON.stringify([sp.s, sp.surface, sp.kind, sp.n, sp.pace, Math.round(sp.w * 10)]);
    const hit = this.bufCache.get(key);
    if (hit) return hit;
    await sleep(0);
    if (!this.ctx) return null;
    const b = this.toBuffer([renderSpot(sp, this.ctx.sampleRate, this.seed++)]);
    this.bufCache.set(key, b);
    return b;
  }

  private async fetchBuffer(file: string): Promise<BufferLike | null> {
    const key = 'file:' + file;
    const hit = this.bufCache.get(key);
    if (hit) return hit;
    if (!this.ctx?.decodeAudioData) return null;
    try {
      const r = await fetch(`${this.packUrl}/${file}`);
      if (!r.ok) return null;
      const b = await this.ctx.decodeAudioData(await r.arrayBuffer());
      this.bufCache.set(key, b);
      return b;
    } catch {
      return null;
    }
  }

  private toBuffer(chans: Float32Array[]): BufferLike {
    const ctx = this.ctx!;
    const b = ctx.createBuffer(chans.length, chans[0].length, ctx.sampleRate);
    chans.forEach((c, i) => {
      if (b.copyToChannel) b.copyToChannel(c, i);
      else b.getChannelData(i).set(c);
    });
    return b;
  }

  /** Eventos esporádicos (pássaros, trovão, ondas grandes, xícaras, carros). */
  private tick(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.reap();
    if (!this.enabled || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    this.layers.forEach((s, L) => {
      const sp = SPORADIC[L];
      if (!sp || s.recorded || s.level < 0.12) { s.nextSporadic = 0; return; }
      if (!s.nextSporadic) { s.nextSporadic = now + 0.5 + Math.random() * Math.min(sp.every, 4); return; }
      if (now < s.nextSporadic) return;
      s.nextSporadic = now + sp.every * (1 + (Math.random() * 2 - 1) * sp.jit);
      const key = `spor:${L}:${Math.floor(Math.random() * 4)}`;
      let b = this.bufCache.get(key);
      if (!b) {
        b = this.toBuffer([sp.render(ctx.sampleRate, rng(this.seed++))]);
        this.bufCache.set(key, b);
      }
      const src = ctx.createBufferSource();
      src.buffer = b;
      src.connect(s.gain);
      src.start(now + 0.05);
    });
  }
}
