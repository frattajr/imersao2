/**
 * Motor de ambiente sonoro.
 *
 * Usa só o essencial de qualquer API de áudio estilo Web Audio: buffers em
 * loop, nós de ganho e rampas de volume. Funciona com react-native-audio-api
 * (celular) e com o AudioContext do navegador. Para cada camada e som
 * pontual a ordem é: arquivo do repositório de sons (o mais parecido com a
 * descrição da cena), gravação do pacote fixo, e por fim a síntese.
 */
import type { SoundDesc, SoundVariant } from '../../supabase/functions/_shared/sound-library';
import { layerDesc, spotDesc } from '../core/sound';
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

/** Repositório de sons (ver src/services/sounds.ts). */
export interface SoundSource {
  resolve(d: SoundDesc): Promise<{ id: string; url: string } | null>;
}

/** Volume relativo de cada camada quando tocada a partir de gravação. */
const RECORDED_GAIN = 0.35;
/** Volume dos sons pontuais vindos de arquivo, multiplicado pela intensidade "w" da cena. */
const RECORDED_SPOT_GAIN = 0.8;
/** Tempo máximo esperando o repositório antes de tocar a reserva. */
const LOOKUP_TIMEOUT_MS = 2500;
const UP = 2.2;   // segundos para uma camada entrar
const DOWN = 3.6; // segundos para uma camada sair

interface Ramp { from: number; to: number; t0: number; t1: number }
interface LayerState {
  gain: GainLike;
  src: SourceLike | null;
  ramp: Ramp;
  level: number;
  recorded: boolean;
  /** id do som do repositório que está tocando (para "som ruim") */
  libId: string | null;
  loading: boolean;
  nextSporadic: number;
}

const valueAt = (r: Ramp, t: number) =>
  t >= r.t1 ? r.to : t <= r.t0 ? r.from : r.from + ((r.to - r.from) * (t - r.t0)) / (r.t1 - r.t0);

/**
 * Iguala o volume dos arquivos (gravados ou gerados vêm com níveis muito
 * diferentes): leva a média (RMS) a um alvo fixo sem deixar o pico passar de
 * 0,9. Devolve false se o arquivo está praticamente mudo.
 */
export const TARGET_RMS = 0.12;
export function normalize(b: BufferLike): boolean {
  const chans: Float32Array[] = [];
  const n = (b as unknown as { numberOfChannels?: number }).numberOfChannels ?? 1;
  for (let c = 0; c < n; c++) chans.push(b.getChannelData(c));
  let sum = 0, count = 0, peak = 0;
  for (const d of chans) {
    for (let i = 0; i < d.length; i++) { const v = d[i]; sum += v * v; const a = Math.abs(v); if (a > peak) peak = a; }
    count += d.length;
  }
  const rms = Math.sqrt(sum / Math.max(1, count));
  if (!Number.isFinite(rms) || rms < 1e-4) return false;
  const k = Math.min(TARGET_RMS / rms, 0.9 / peak);
  if (Math.abs(k - 1) < 0.05) return true;
  chans.forEach((d, c) => {
    const out = new Float32Array(d.length);
    for (let i = 0; i < d.length; i++) out[i] = d[i] * k;
    if (b.copyToChannel) b.copyToChannel(out, c);
    else d.set(out);
  });
  return true;
}

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
  private library: SoundSource | null = null;
  private looks: Partial<Record<Layer, SoundVariant>> = {};
  private recentSpots: { id: string; until: number }[] = [];

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

  /** Liga o repositório de sons (arquivos reais/gerados escolhidos pela descrição). */
  setLibrary(lib: SoundSource | null): void {
    this.library = lib;
  }

  /** Sons do repositório tocando agora (ou há pouco), para o botão "som ruim". */
  libraryIdsPlaying(): string[] {
    const ids = new Set<string>();
    this.layers.forEach((s) => { if (s.libId && s.level > 0) ids.add(s.libId); });
    const now = this.ctx?.currentTime ?? 0;
    this.recentSpots.forEach((r) => { if (r.until > now) ids.add(r.id); });
    return [...ids];
  }

  /**
   * Define o ambiente: camadas novas sobem devagar, as que saem descem mais devagar ainda.
   * `looks` diz como cada camada soa na cena; vale para a camada que ainda vai carregar
   * (uma camada que já está tocando continua com o mesmo arquivo, sem troca brusca).
   */
  setScene(amb: Ambience, looks?: Partial<Record<Layer, SoundVariant>>): void {
    if (!this.ctx) return;
    if (looks) this.looks = { ...this.looks, ...looks };
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
        const lib = this.spotLib.get(buf);
        if (lib) this.recentSpots = [...this.recentSpots.filter((x) => x.until > this.ctx!.currentTime), { id: lib, until: t0 + reps * gap + 6 }];
        for (let r = 0; r < reps; r++) {
          const src = this.ctx.createBufferSource();
          src.buffer = buf;
          if (this.fileBufs.has(buf)) {
            // a síntese já sai no volume pedido; arquivo normalizado precisa do "w" da cena
            const g = this.ctx.createGain();
            g.gain.value = sp.w * RECORDED_SPOT_GAIN;
            src.connect(g);
            g.connect(bus);
          } else {
            src.connect(bus);
          }
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
    const s: LayerState = { gain: g, src: null, ramp: { from: 0, to: 0, t0: 0, t1: 0 }, level: 0, recorded: false, libId: null, loading: false, nextSporadic: 0 };
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
      const hit = await this.lookup(layerDesc(L, this.looks[L]));
      if (hit) {
        buf = await this.fetchUrl(hit.url);
        if (buf) { s.recorded = true; s.libId = hit.id; }
      }
      const files = this.manifest?.layers?.[L];
      if (!buf && files?.length) {
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

  /**
   * Troca camadas que estão tocando a síntese por um arquivo do repositório,
   * se agora houver um (ex.: um som acabou de ser gerado). A camada desce,
   * troca e sobe de novo, devagar, para a troca não chamar atenção.
   */
  upgradeLayers(): void {
    if (!this.ctx || !this.library) return;
    this.layers.forEach((s, L) => {
      if (s.recorded || s.loading || !s.src || s.level <= 0) return;
      s.loading = true;
      void this.lookup(layerDesc(L, this.looks[L])).then(async (hit) => {
        const buf = hit ? await this.fetchUrl(hit.url) : null;
        if (!hit || !buf || !this.ctx || this.layers.get(L) !== s || !s.src) { s.loading = false; return; }
        this.rampLayer(s, 0, 1.5);
        await sleep(1600);
        if (!this.ctx || this.layers.get(L) !== s) { s.loading = false; return; }
        try { s.src?.stop(); s.src?.disconnect(); } catch { /* já parado */ }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(s.gain);
        src.start(this.ctx.currentTime + 0.02, Math.random() * Math.max(0, buf.duration - 1));
        s.src = src;
        s.recorded = true;
        s.libId = hit.id;
        s.loading = false;
        this.rampLayer(s, s.level * RECORDED_GAIN, UP);
      });
    });
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

  /** Qual som do repositório cada buffer de som pontual veio (para "som ruim"). */
  private spotLib = new WeakMap<BufferLike, string>();
  /** Buffers que vieram de arquivo (já normalizados): o volume do som pontual é aplicado à parte. */
  private fileBufs = new WeakSet<BufferLike>();

  private async spotBuffer(sp: Spot): Promise<BufferLike | null> {
    const found = await this.lookup(spotDesc(sp));
    if (found) {
      const b = await this.fetchUrl(found.url);
      if (b) { this.spotLib.set(b, found.id); return b; }
    }
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

  /** Consulta o repositório sem segurar o som: se demorar, segue com a reserva. */
  private lookup(d: SoundDesc): Promise<{ id: string; url: string } | null> {
    if (!this.library) return Promise.resolve(null);
    return Promise.race([
      this.library.resolve(d).catch(() => null),
      sleep(LOOKUP_TIMEOUT_MS).then(() => null),
    ]);
  }

  private fetchBuffer(file: string): Promise<BufferLike | null> {
    return this.fetchUrl(`${this.packUrl}/${file}`);
  }

  private async fetchUrl(url: string): Promise<BufferLike | null> {
    const key = 'url:' + url;
    const hit = this.bufCache.get(key);
    if (hit) return hit;
    if (!this.ctx?.decodeAudioData) return null;
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      const b = await this.ctx.decodeAudioData(await r.arrayBuffer());
      if (!normalize(b)) return null; // silencioso ou corrompido: usa a reserva
      this.fileBufs.add(b);
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
