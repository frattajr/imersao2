/**
 * Motor de ambiente sonoro.
 *
 * Usa só o essencial de qualquer API de áudio estilo Web Audio: buffers em
 * loop, nós de ganho e rampas de volume. Funciona com react-native-audio-api
 * (celular) e com o AudioContext do navegador. Todos os sons vêm do
 * repositório da ElevenLabs (o arquivo mais parecido com a descrição da
 * cena). Som que ainda não existe é gerado; até ficar pronto, fica em silêncio.
 */
import type { SoundDesc, SoundVariant } from '../../supabase/functions/_shared/sound-library';
import { layerDesc, spotDesc } from '../core/sound';
import type { AmbientDetail } from '../core/scenery';
import type { Ambience, Layer, Spot } from '../core/types';
import { LAYERS } from '../core/types';

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

/** Repositório de sons (ver src/services/sounds.ts). */
export interface SoundSource {
  resolve(d: SoundDesc): Promise<{ id: string; url: string } | null>;
}

/** Volume relativo de cada camada quando tocada a partir de gravação. */
const RECORDED_GAIN = 0.35;
/** Volume dos sons pontuais vindos de arquivo, multiplicado pela intensidade "w" da cena. */
const RECORDED_SPOT_GAIN = 0.8;
/** Detalhes de ambiente (rangidos, gotas…) ficam bem abaixo dos sons da ação. */
const DETAIL_GAIN = 0.55;
const s0 = (x: number) => Math.max(0, x);
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
  /** id do som do repositório que está tocando (para "som ruim") */
  libId: string | null;
  loading: boolean;
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
  private timer: ReturnType<typeof setInterval> | null = null;
  private volume = 0.7;
  private enabled = true;
  private fade = 1;
  private sceneGain = 1;
  /** preferências da pessoa (tela Configurações) */
  private user = { fade: 1, spots: 1, details: 1, detailRate: 1 };
  private details: AmbientDetail[] = [];
  private nextDetail = 0;
  private lastDetail = '';
  private detailBus!: GainLike;
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
    this.detailBus = ctx.createGain();
    this.detailBus.gain.value = DETAIL_GAIN * this.user.details;
    this.detailBus.connect(this.master);
    this.timer = setInterval(() => this.tick(), 250);
  }

  get running(): boolean {
    return !!this.ctx;
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
  setScene(amb: Ambience, looks?: Partial<Record<Layer, SoundVariant>>, opts?: { fade?: number; gain?: number }): void {
    if (!this.ctx) return;
    if (looks) this.looks = { ...this.looks, ...looks };
    // cena agitada: transições mais longas e tudo um pouco mais baixo (ver core/smooth.ts)
    this.fade = Math.max(0.5, Math.min(6, (opts?.fade ?? 1) * this.user.fade));
    this.sceneGain = Math.max(0.5, Math.min(1, opts?.gain ?? 1));
    if (this.enabled && this.ctx.state === 'suspended' && Object.values(amb).some((v) => (v ?? 0) > 0)) void this.ctx.resume();
    for (const L of LAYERS) {
      const target = (amb[L] ?? 0) * this.sceneGain;
      const st = this.layers.get(L);
      if (!st && target <= 0) continue;
      const s = st ?? this.createLayer(L);
      s.level = target;
      const gainTarget = target * RECORDED_GAIN;
      this.rampLayer(s, gainTarget, (gainTarget > valueAt(s.ramp, this.ctx.currentTime) ? UP : DOWN) * this.fade);
      if (target > 0 && !s.src && !s.loading) void this.loadLayer(L, s);
    }
  }

  /**
   * Preferências da pessoa: suavidade das transições (multiplica o tempo),
   * volume dos sons da história e dos detalhes, e frequência dos detalhes
   * (0 = desligados).
   */
  setUserPrefs(p: { fade: number; spots: number; details: number; detailRate: number }): void {
    this.user = { ...p };
    if (this.ctx) this.detailBus.gain.value = DETAIL_GAIN * p.details;
    if (p.detailRate <= 0) this.nextDetail = 0;
    else if (this.details.length && !this.nextDetail && this.ctx) this.nextDetail = this.ctx.currentTime + 10;
  }

  /**
   * Detalhes de ambiente da cena (rangidos, gotas, rajadas…): um de cada vez,
   * baixinho, com intervalos longos e irregulares (20–55 s). Continuam de uma
   * página para outra enquanto o lugar for o mesmo; variam para não repetir.
   */
  setDetails(details: AmbientDetail[]): void {
    const was = this.details.length;
    this.details = details.slice(0, 3);
    if (!this.ctx) return;
    if (!this.details.length) { this.nextDetail = 0; return; }
    if (this.user.detailRate <= 0) { this.nextDetail = 0; return; }
    if (!was || !this.nextDetail) this.nextDetail = this.ctx.currentTime + (8 + Math.random() * 10) / this.user.detailRate;
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
    if (!this.ctx || !this.enabled || this.user.spots <= 0) return;
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
        const level = this.sceneGain * this.user.spots;
        if (lib) this.recentSpots = [...this.recentSpots.filter((x) => x.until > this.ctx!.currentTime), { id: lib, until: t0 + reps * gap + 6 }];
        for (let r = 0; r < reps; r++) {
          const src = this.ctx.createBufferSource();
          src.buffer = buf;
          if (this.fileBufs.has(buf)) {
            // a síntese já sai no volume pedido; arquivo normalizado precisa do "w" da cena
            const g = this.ctx.createGain();
            g.gain.value = sp.w * RECORDED_SPOT_GAIN * level;
            src.connect(g);
            g.connect(bus);
          } else if (level < 1) {
            const g = this.ctx.createGain();
            g.gain.value = level;
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
    if (active || (this.details.length && s0(this.nextDetail - now) < 30)) this.lastSound = now;
    else if (ctx.state === 'running' && now - this.lastSound > 12) void ctx.suspend();
  }

  private createLayer(L: Layer): LayerState {
    const g = this.ctx!.createGain();
    g.gain.value = 0;
    g.connect(this.master);
    const s: LayerState = { gain: g, src: null, ramp: { from: 0, to: 0, t0: 0, t1: 0 }, level: 0, libId: null, loading: false };
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
        if (buf) s.libId = hit.id;
      }
      // sem arquivo ainda (som novo sendo gerado): a camada fica em silêncio e entra quando ficar pronto
      if (!this.ctx || !buf || this.layers.get(L) !== s) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(s.gain);
      src.start(this.ctx.currentTime + 0.02, Math.random() * Math.max(0, buf.duration - 1));
      s.src = src;
      this.rampLayer(s, s.level * RECORDED_GAIN, UP * this.fade);
    } finally {
      s.loading = false;
    }
  }

  /**
   * Carrega as camadas que ainda não têm arquivo (o som estava sendo
   * gerado). Chamado quando o repositório avisa que entrou um som novo e,
   * por garantia, a cada 20 s.
   */
  retryMissing(): void {
    if (!this.ctx || !this.library) return;
    this.layers.forEach((s, L) => {
      if (!s.src && !s.loading && s.level > 0) void this.loadLayer(L, s);
    });
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
    // sem arquivo: não toca (o som novo está sendo gerado e toca nas próximas vezes)
    return null;
  }

  /** Consulta o repositório sem segurar a cena: se demorar, segue sem o som por enquanto. */
  private lookup(d: SoundDesc): Promise<{ id: string; url: string } | null> {
    if (!this.library) return Promise.resolve(null);
    return Promise.race([
      this.library.resolve(d).catch(() => null),
      sleep(LOOKUP_TIMEOUT_MS).then(() => null),
    ]);
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

  private tickDetails(now: number): void {
    if (!this.details.length || !this.nextDetail || now < this.nextDetail) return;
    // intervalo longo e irregular; mais longo ainda quando a cena está agitada
    if (this.user.detailRate <= 0) { this.nextDetail = 0; return; }
    this.nextDetail = now + ((20 + Math.random() * 35) * Math.max(1, this.fade)) / this.user.detailRate;
    const pool = this.details.length > 1 ? this.details.filter((d) => d.s !== this.lastDetail) : this.details;
    const d = pool[Math.floor(Math.random() * pool.length)];
    this.lastDetail = d.s;
    const sp: Spot = { s: d.s, at: 0, w: d.w, v: d.v, n: d.s === 'drip' ? 3 : d.s === 'bark' ? 2 : undefined };
    const bus = this.detailBus;
    void this.spotBuffer(sp).then((buf) => {
      if (!buf || !this.ctx || !this.enabled) return;
      const g = this.ctx.createGain();
      g.gain.value = (this.fileBufs.has(buf) ? d.w * RECORDED_SPOT_GAIN : 1) * this.sceneGain;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(g);
      g.connect(bus);
      src.start(this.ctx.currentTime + 0.05);
    });
  }

  private retryAt = 0;

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.reap();
    if (!this.enabled || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    this.tickDetails(now);
    if (now > this.retryAt) { this.retryAt = now + 20; this.retryMissing(); }
  }
}
