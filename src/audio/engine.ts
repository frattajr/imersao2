/**
 * Motor de áudio adaptativo (mixer de stems).
 *
 * Grafo:
 *   stem (loop) → low-pass → ganho do stem ┐
 *   stem (loop) → low-pass → ganho do stem ┼→ barramento AMBIENTE ─┐
 *                                          ┘   (sofre ducking)     ├→ master → saída
 *   efeito pontual → ganho ─→ barramento SFX ┐                      │
 *   detalhe de ambiente → barramento DETALHES ┴→ barramento EFEITOS ┘
 *
 * - A cena chega como uma MATRIZ DE MIXAGEM declarativa (stems, ganho,
 *   low-pass e prioridade — ver core/types.ts `MixStem`), vinda da IA, de um
 *   plano calibrado ou das palavras-chave. O motor só executa a matriz.
 * - Transições com curva de potência constante (equal-power) de 2,5 s a 4 s,
 *   para a troca de cenário não "afundar" o volume no meio.
 * - Ducking: o ambiente abaixa ~4 dB enquanto um efeito pontual toca.
 * - Conforto: volumes separados de ambiente e efeitos, loops liga/desliga e
 *   modo foco (menos stems, agudos cortados, sem efeitos).
 * - Bateria: no máximo 4 stems; stem que silencia é parado (o buffer fica em
 *   cache); o contexto de áudio é suspenso quando nada toca; relógio de 0,5 s.
 *
 * Usa só o subconjunto do Web Audio comum a react-native-audio-api (celular)
 * e ao navegador. Os sons vêm do repositório (ElevenLabs/pacote inicial);
 * stem sem arquivo ainda fica em silêncio e entra quando ficar pronto.
 */
import type { SoundDesc, SoundVariant } from '../../supabase/functions/_shared/sound-library';
import { ambienceToMix, MAX_STEMS, normalizeMix } from '../core/plan';
import type { AmbientDetail } from '../core/scenery';
import { layerDesc, spotDesc } from '../core/sound';
import type { Ambience, Layer, MixStem, Spot } from '../core/types';

/* ---------- Subconjunto da API de áudio que usamos ---------- */
export interface ParamLike {
  value: number;
  setValueAtTime(v: number, t: number): unknown;
  linearRampToValueAtTime(v: number, t: number): unknown;
  cancelScheduledValues(t: number): unknown;
}
export interface NodeLike { connect(n: unknown): unknown; disconnect(): void }
export interface GainLike extends NodeLike { gain: ParamLike }
export interface FilterLike extends NodeLike { type: string; frequency: ParamLike; Q: ParamLike }
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
  /** opcional: sem filtro, o low-pass é ignorado */
  createBiquadFilter?(): FilterLike;
  resume(): Promise<unknown>;
  suspend(): Promise<unknown>;
  decodeAudioData?(data: ArrayBuffer): Promise<BufferLike>;
}

/** Repositório de sons (ver src/services/sounds.ts). */
export interface SoundSource {
  resolve(d: SoundDesc): Promise<{ id: string; url: string } | null>;
}

/** Arquivos guardados para ler sem internet (ver src/services/offline.ts). */
export interface OfflineStore {
  get(url: string): Promise<ArrayBuffer | null>;
}

/* ---------- Constantes de mixagem ---------- */
/** Volume de um stem com ganho 1 (arquivos normalizados em TARGET_RMS). */
const STEM_GAIN = 0.35;
/** Volume dos efeitos pontuais, multiplicado pela intensidade "w" da cena. */
const SFX_GAIN = 0.8;
/** Detalhes de ambiente (rangidos, gotas…) ficam bem abaixo dos efeitos da ação. */
const DETAIL_GAIN = 0.55;
/** Transições: 2,5 s para entrar, 4 s para sair (multiplicadas pela preferência e pela agitação da cena). */
export const FADE_IN = 2.5;
export const FADE_OUT = 4;
/** Ducking: quanto o ambiente abaixa enquanto um efeito toca (0,63 ≈ −4 dB). */
export const DUCK_LEVEL = 0.63;
const DUCK_ATTACK = 0.25;
const DUCK_RELEASE = 1.4;
/** Low-pass "aberto" (sem corte audível). */
const OPEN_LP = 20000;
/** Modo foco: só os stems essenciais, agudos cortados, sem efeitos. */
const FOCUS_MAX_STEMS = 2;
const FOCUS_LP = 1800;
const FOCUS_GAIN = 0.75;
/** Tempo máximo esperando o repositório antes de seguir sem o som. */
const LOOKUP_TIMEOUT_MS = 2500;
const TICK_MS = 500;

/**
 * Curva de potência constante: no cruzamento de dois stems a soma de
 * potência fica estável (sem o "buraco" de volume de uma rampa linear).
 * Aproximada por 4 segmentos lineares (a API comum não tem setValueCurve).
 */
export function equalPowerPoints(from: number, to: number, dur: number): { dt: number; v: number }[] {
  const up = to > from;
  return [0.25, 0.5, 0.75, 1].map((x) => {
    const k = up ? Math.sin((x * Math.PI) / 2) : 1 - Math.cos((x * Math.PI) / 2);
    return { dt: x * dur, v: x === 1 ? to : from + (to - from) * k };
  });
}

function rampParam(p: ParamLike, from: number, to: number, t: number, dur: number): void {
  p.cancelScheduledValues(t);
  p.setValueAtTime(from, t);
  if (dur <= 0.02) { p.setValueAtTime(to, t); return; }
  for (const pt of equalPowerPoints(from, to, dur)) p.linearRampToValueAtTime(pt.v, t + pt.dt);
}

/** Duração de uma transição, sempre entre 2,5 s e 4 s × preferência (agitação só alonga). */
export function fadeSeconds(entering: boolean, sceneFade: number, userFade: number): number {
  const base = entering ? FADE_IN : FADE_OUT;
  return Math.min(4 * Math.max(1, userFade) * 1.5, Math.max(FADE_IN * Math.min(1, userFade), base * userFade * Math.max(1, sceneFade)));
}

interface Ramp { from: number; to: number; t0: number; t1: number }
interface StemState {
  gain: GainLike;
  filter: FilterLike | null;
  lowpass: number;
  src: SourceLike | null;
  ramp: Ramp;
  /** ganho pedido pela matriz, já com volume de cena aplicado */
  level: number;
  priority: number;
  libId: string | null;
  loading: boolean;
}

const valueAt = (r: Ramp, t: number) =>
  t >= r.t1 ? r.to : t <= r.t0 ? r.from : r.from + ((r.to - r.from) * (t - r.t0)) / (r.t1 - r.t0);

/**
 * Iguala o volume dos arquivos (gerados ou gravados vêm com níveis muito
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

/**
 * Junta janelas de ducking que se sobrepõem e devolve os pontos do envelope
 * (tempo, ganho) a partir de `now`. Exportada para teste.
 */
export function duckEnvelope(windows: [number, number][], now: number): { t: number; v: number }[] {
  const ws = windows.filter(([, e]) => e + DUCK_RELEASE > now).sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [s, e] of ws) {
    const last = merged[merged.length - 1];
    if (last && s - DUCK_ATTACK <= last[1] + DUCK_RELEASE) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  const pts: { t: number; v: number }[] = [];
  for (const [s, e] of merged) {
    pts.push({ t: Math.max(now, s - DUCK_ATTACK), v: 1 }, { t: Math.max(now, s), v: DUCK_LEVEL });
    pts.push({ t: Math.max(now, e), v: DUCK_LEVEL }, { t: Math.max(now, e) + DUCK_RELEASE, v: 1 });
  }
  return pts;
}

export interface ComfortPrefs {
  /** volume do ambiente (stems), 0–1 */
  ambient: number;
  /** volume dos efeitos pontuais e detalhes, 0–1 */
  sfx: number;
  /** loops de ambiente ligados */
  loops: boolean;
  /** modo foco: só o essencial, abafado, sem efeitos */
  focus: boolean;
}

export class AmbientEngine {
  private ctx: CtxLike | null = null;
  private master!: GainLike;
  private ambBus!: GainLike;
  private duckGain!: GainLike;
  private fxBus!: GainLike;
  private spotBus!: GainLike;
  private detailBus!: GainLike;
  private stems = new Map<Layer, StemState>();
  private bufCache = new Map<string, BufferLike>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private volume = 0.7;
  private enabled = true;
  private fade = 1;
  private sceneGain = 1;
  /** preferências da pessoa (tela Configurações / painel de áudio do leitor) */
  private user = { fade: 1, spots: 1, details: 1, detailRate: 1 };
  private comfort: ComfortPrefs = { ambient: 1, sfx: 1, loops: true, focus: false };
  private details: AmbientDetail[] = [];
  private nextDetail = 0;
  private lastDetail = '';
  private library: SoundSource | null = null;
  private offline: OfflineStore | null = null;
  private looks: Partial<Record<Layer, SoundVariant>> = {};
  private lastMix: MixStem[] = [];
  private recentSpots: { id: string; until: number }[] = [];
  private ducks: [number, number][] = [];
  private lastSound = 0;
  /** o próprio motor suspendeu o áudio por silêncio (não é bloqueio do navegador) */
  private idleSuspended = false;
  private retryAt = 0;

  constructor(private makeCtx: () => CtxLike) {}

  /** Cria o contexto de áudio (chame a partir de um toque do usuário). */
  start(): void {
    if (this.ctx) {
      if (this.enabled && this.ctx.state === 'suspended') this.wake();
      return;
    }
    const ctx = this.makeCtx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
    this.duckGain = ctx.createGain();
    this.duckGain.connect(this.master);
    this.ambBus = ctx.createGain();
    this.ambBus.connect(this.duckGain);
    this.fxBus = ctx.createGain();
    this.fxBus.connect(this.master);
    this.spotBus = ctx.createGain();
    this.spotBus.connect(this.fxBus);
    this.detailBus = ctx.createGain();
    this.detailBus.connect(this.fxBus);
    this.applyBusLevels(0);
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  get running(): boolean {
    return !!this.ctx;
  }

  /**
   * O navegador (ou o sistema) não deixou o áudio tocar: há cena para tocar,
   * o som está ligado, mas o contexto continua suspenso sem ter sido o motor a
   * suspender. Precisa de um toque da pessoa (chame `start()` nele).
   */
  get needsUnlock(): boolean {
    const ctx = this.ctx;
    return !!ctx && this.enabled && ctx.state === 'suspended' && !this.idleSuspended && this.lastMix.length > 0;
  }

  private wake(): void {
    this.idleSuspended = false;
    if (this.ctx) void Promise.resolve(this.ctx.resume()).catch(() => undefined);
  }

  /** Volume geral (0 = mudo: suspende o áudio). */
  setVolume(v: number): void {
    this.volume = v;
    this.enabled = v > 0;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    rampParam(this.master.gain, this.master.gain.value, v, t, 0.3);
    if (v > 0 && this.ctx.state === 'suspended') this.wake();
  }

  /** Conforto acústico: volumes separados, loops e modo foco. */
  setComfort(p: Partial<ComfortPrefs>): void {
    const prev = this.comfort;
    this.comfort = { ...prev, ...p };
    if (!this.ctx) return;
    this.applyBusLevels(0.6);
    // foco ou loops mudaram: reaplica a última matriz com as novas regras
    if (prev.focus !== this.comfort.focus || prev.loops !== this.comfort.loops) this.applyMix(this.lastMix);
  }

  get comfortPrefs(): ComfortPrefs {
    return { ...this.comfort };
  }

  async pause(): Promise<void> {
    if (this.ctx && this.ctx.state === 'running') { this.idleSuspended = true; await this.ctx.suspend(); }
  }

  async resume(): Promise<void> {
    if (this.ctx && this.enabled && this.ctx.state === 'suspended') { this.idleSuspended = false; await this.ctx.resume(); }
  }

  /** Liga o repositório de sons (arquivos escolhidos pela descrição). */
  setLibrary(lib: SoundSource | null): void {
    this.library = lib;
  }

  /** Arquivos baixados para ler sem internet: consultados antes da rede. */
  setOfflineStore(store: OfflineStore | null): void {
    this.offline = store;
  }

  /** Sons do repositório tocando agora (ou há pouco), para o botão "som ruim". */
  libraryIdsPlaying(): string[] {
    const ids = new Set<string>();
    this.stems.forEach((s) => { if (s.libId && s.level > 0) ids.add(s.libId); });
    const now = this.ctx?.currentTime ?? 0;
    this.recentSpots.forEach((r) => { if (r.until > now) ids.add(r.id); });
    return [...ids];
  }

  /**
   * Executa a matriz de mixagem da cena.
   * `looks` diz como cada stem soa (vale para o stem que ainda vai carregar:
   * um stem que já toca continua com o mesmo arquivo, sem troca brusca).
   * `fade`/`gain` vêm da suavização automática (cena agitada = mais lento e baixo).
   */
  setMix(mix: MixStem[], looks?: Partial<Record<Layer, SoundVariant>>, opts?: { fade?: number; gain?: number }): void {
    if (looks) this.looks = { ...this.looks, ...looks };
    this.fade = Math.max(1, Math.min(2.5, opts?.fade ?? 1));
    this.sceneGain = Math.max(0.5, Math.min(1, opts?.gain ?? 1));
    this.lastMix = mix;
    if (!this.ctx) return;
    this.applyMix(mix);
  }

  /** Atalho para o formato simples { stem: ganho } (palavras-chave, planos antigos). */
  setScene(amb: Ambience, looks?: Partial<Record<Layer, SoundVariant>>, opts?: { fade?: number; gain?: number }): void {
    this.setMix(ambienceToMix(amb), looks, opts);
  }

  /**
   * Preferências: suavidade das transições (multiplica o tempo), volume dos
   * efeitos da história e dos detalhes, e frequência dos detalhes (0 = desligados).
   */
  setUserPrefs(p: { fade: number; spots: number; details: number; detailRate: number }): void {
    this.user = { ...p };
    if (this.ctx) this.applyBusLevels(0.4);
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
    if (!this.details.length || this.user.detailRate <= 0 || this.comfort.focus) { this.nextDetail = 0; return; }
    if (!was || !this.nextDetail) this.nextDetail = this.ctx.currentTime + (8 + Math.random() * 10) / this.user.detailRate;
  }

  /** Interrompe (com fade curto) os efeitos pontuais da página anterior. */
  clearSpots(): void {
    if (!this.ctx) return;
    const old = this.spotBus, t = this.ctx.currentTime;
    rampParam(old.gain, old.gain.value, 0, t, 0.8);
    setTimeout(() => { try { old.disconnect(); } catch { /* já desconectado */ } }, 1500);
    this.spotBus = this.ctx.createGain();
    this.spotBus.connect(this.fxBus);
    this.ducks = [];
    this.scheduleDuck();
  }

  /** Toca os efeitos pontuais da cena, cada um no seu momento (com ducking do ambiente). */
  playSpots(spots: Spot[]): void {
    if (!this.ctx || !this.enabled || this.user.spots <= 0 || this.comfort.focus || this.comfort.sfx <= 0) return;
    if (spots.length && this.ctx.state === 'suspended') this.wake();
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
          const at = Math.max(this.ctx.currentTime + 0.05, t0 + r * gap);
          const src = this.ctx.createBufferSource();
          src.buffer = buf;
          const g = this.ctx.createGain();
          g.gain.value = sp.w * SFX_GAIN * this.sceneGain;
          src.connect(g);
          g.connect(bus);
          src.start(at);
          this.ducks.push([at, at + Math.min(buf.duration, 8)]);
        }
        this.scheduleDuck();
      });
    }
  }

  /**
   * Carrega os stems que ainda não têm arquivo (o som estava sendo gerado).
   * Chamado quando o repositório avisa que entrou um som novo e a cada 20 s.
   */
  retryMissing(): void {
    if (!this.ctx || !this.library) return;
    this.stems.forEach((s, L) => {
      if (!s.src && !s.loading && s.level > 0) void this.loadStem(L, s);
    });
  }

  /** Para tudo e libera o contexto (ex.: ao fechar o app). */
  async dispose(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stems.forEach((s) => { try { s.src?.stop(); } catch { /* */ } });
    this.stems.clear();
    const c = this.ctx;
    this.ctx = null;
    try { await (c as unknown as { close?: () => Promise<void> })?.close?.(); } catch { /* */ }
  }

  /* ---------- interno ---------- */

  private applyBusLevels(dur: number): void {
    const t = this.ctx!.currentTime;
    const amb = this.comfort.loops ? this.comfort.ambient * (this.comfort.focus ? FOCUS_GAIN : 1) : 0;
    const fx = this.comfort.focus ? 0 : this.comfort.sfx;
    rampParam(this.ambBus.gain, this.ambBus.gain.value, amb, t, dur);
    rampParam(this.fxBus.gain, this.fxBus.gain.value, fx, t, dur);
    rampParam(this.spotBus.gain, this.spotBus.gain.value, this.user.spots, t, dur);
    rampParam(this.detailBus.gain, this.detailBus.gain.value, DETAIL_GAIN * this.user.details, t, dur);
  }

  /** Matriz efetiva: aplica loops/foco e o limite de stems por prioridade. */
  private effectiveMix(mix: MixStem[]): MixStem[] {
    if (!this.comfort.loops) return [];
    const focus = this.comfort.focus;
    return normalizeMix(focus ? mix.filter((m) => m.priority <= 2) : mix, focus ? FOCUS_MAX_STEMS : MAX_STEMS)
      .map((m) => (focus ? { ...m, lowpass: Math.min(m.lowpass ?? OPEN_LP, FOCUS_LP) } : m));
  }

  private applyMix(mix: MixStem[]): void {
    const ctx = this.ctx!;
    const eff = this.effectiveMix(mix);
    const want = new Map(eff.map((m) => [m.s, m]));
    if (this.enabled && ctx.state === 'suspended' && eff.length) this.wake();
    // stems que saem: descem devagar (4 s × preferência)
    this.stems.forEach((s, L) => {
      if (want.has(L) || s.level <= 0) return;
      s.level = 0;
      this.rampStem(s, 0, fadeSeconds(false, this.fade, this.user.fade));
    });
    // stems que entram ou mudam
    for (const m of eff) {
      const s = this.stems.get(m.s) ?? this.createStem(m.s);
      const level = m.gain * this.sceneGain;
      const entering = level > valueAt(s.ramp, ctx.currentTime) / STEM_GAIN + 0.01;
      s.level = level;
      s.priority = m.priority;
      const dur = fadeSeconds(entering, this.fade, this.user.fade);
      if (s.src) this.rampStem(s, level * STEM_GAIN, dur);
      this.setLowpass(s, m.lowpass ?? OPEN_LP, dur);
      if (!s.src && !s.loading) void this.loadStem(m.s, s);
    }
  }

  private createStem(L: Layer): StemState {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(this.ambBus);
    let filter: FilterLike | null = null;
    if (ctx.createBiquadFilter) {
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = OPEN_LP;
      filter.Q.value = 0.5; // corte suave, sem ressonância
      filter.connect(g);
    }
    const s: StemState = { gain: g, filter, lowpass: OPEN_LP, src: null, ramp: { from: 0, to: 0, t0: 0, t1: 0 }, level: 0, priority: 3, libId: null, loading: false };
    this.stems.set(L, s);
    return s;
  }

  private rampStem(s: StemState, to: number, dur: number): void {
    const t = this.ctx!.currentTime, from = valueAt(s.ramp, t);
    s.ramp = { from, to, t0: t, t1: t + dur };
    rampParam(s.gain.gain, from, to, t, dur);
  }

  private setLowpass(s: StemState, hz: number, dur: number): void {
    if (!s.filter || Math.abs(hz - s.lowpass) < 50) return;
    const t = this.ctx!.currentTime;
    // a frequência soa logarítmica: o "meio" do caminho é a média geométrica
    const mid = Math.sqrt(s.lowpass * hz);
    s.filter.frequency.cancelScheduledValues(t);
    s.filter.frequency.setValueAtTime(s.lowpass, t);
    s.filter.frequency.linearRampToValueAtTime(mid, t + dur * 0.5);
    s.filter.frequency.linearRampToValueAtTime(hz, t + dur);
    s.lowpass = hz;
  }

  private async loadStem(L: Layer, s: StemState): Promise<void> {
    s.loading = true;
    try {
      const hit = await this.lookup(layerDesc(L, this.looks[L]));
      const buf = hit ? await this.fetchUrl(hit.url) : null;
      if (!this.ctx || !buf || !hit || this.stems.get(L) !== s) return;
      s.libId = hit.id;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(s.filter ?? s.gain);
      src.start(this.ctx.currentTime + 0.02, Math.random() * Math.max(0, buf.duration - 1));
      s.src = src;
      this.rampStem(s, s.level * STEM_GAIN, fadeSeconds(true, this.fade, this.user.fade));
    } finally {
      s.loading = false;
    }
  }

  /** Reagenda o envelope de ducking do ambiente a partir de agora. */
  private scheduleDuck(): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    this.ducks = this.ducks.filter(([, e]) => e + DUCK_RELEASE > now);
    const p = this.duckGain.gain;
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    if (!this.ducks.length) { p.linearRampToValueAtTime(1, now + 0.4); return; }
    for (const pt of duckEnvelope(this.ducks, now)) p.linearRampToValueAtTime(pt.v, pt.t);
  }

  /** De qual som do repositório veio cada buffer de efeito (para "som ruim"). */
  private spotLib = new WeakMap<BufferLike, string>();

  private async spotBuffer(sp: Spot): Promise<BufferLike | null> {
    const found = await this.lookup(spotDesc(sp));
    if (!found) return null; // sem arquivo: não toca (o som novo toca nas próximas vezes)
    const b = await this.fetchUrl(found.url);
    if (b) this.spotLib.set(b, found.id);
    return b;
  }

  /** Consulta o repositório sem segurar a cena: se demorar, segue sem o som por enquanto. */
  private lookup(d: SoundDesc): Promise<{ id: string; url: string } | null> {
    const lib = this.library;
    if (!lib) return Promise.resolve(null);
    return new Promise((res) => {
      const t = setTimeout(() => res(null), LOOKUP_TIMEOUT_MS);
      lib.resolve(d).catch(() => null).then((v) => { clearTimeout(t); res(v); });
    });
  }

  private async fetchUrl(url: string): Promise<BufferLike | null> {
    const key = 'url:' + url;
    const hit = this.bufCache.get(key);
    if (hit) return hit;
    if (!this.ctx?.decodeAudioData) return null;
    try {
      // offline primeiro (capítulo baixado), depois a rede
      let data = this.offline ? await this.offline.get(url).catch(() => null) : null;
      if (!data) {
        const r = await fetch(url);
        if (!r.ok) return null;
        data = await r.arrayBuffer();
      }
      const b = await this.ctx.decodeAudioData(data);
      if (!normalize(b)) return null; // silencioso ou corrompido
      this.bufCache.set(key, b);
      return b;
    } catch {
      return null;
    }
  }

  private tickDetails(now: number): void {
    if (!this.details.length || !this.nextDetail || now < this.nextDetail) return;
    if (this.user.detailRate <= 0 || this.comfort.focus || this.comfort.sfx <= 0) { this.nextDetail = 0; return; }
    // intervalo longo e irregular; mais longo ainda quando a cena está agitada
    this.nextDetail = now + ((20 + Math.random() * 35) * this.fade) / this.user.detailRate;
    const pool = this.details.length > 1 ? this.details.filter((d) => d.s !== this.lastDetail) : this.details;
    const d = pool[Math.floor(Math.random() * pool.length)];
    this.lastDetail = d.s;
    const sp: Spot = { s: d.s, at: 0, w: d.w, v: d.v, n: d.s === 'drip' ? 3 : d.s === 'bark' ? 2 : undefined };
    const bus = this.detailBus;
    void this.spotBuffer(sp).then((buf) => {
      if (!buf || !this.ctx || !this.enabled) return;
      const g = this.ctx.createGain();
      g.gain.value = d.w * SFX_GAIN * this.sceneGain;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(g);
      g.connect(bus);
      src.start(this.ctx.currentTime + 0.05);
    });
  }

  /**
   * Economia de bateria: para os stems que já silenciaram (o buffer fica em
   * cache, voltar é instantâneo) e suspende o áudio quando nada toca há 12 s.
   */
  private reap(): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    let active = false;
    this.stems.forEach((s) => {
      if (s.level > 0 || now < s.ramp.t1 + 2) { active = true; return; }
      if (s.src) { try { s.src.stop(); s.src.disconnect(); } catch { /* já parado */ } s.src = null; }
    });
    if (active || (this.details.length && this.nextDetail && this.nextDetail - now < 30)) this.lastSound = now;
    else if (ctx.state === 'running' && now - this.lastSound > 12) { this.idleSuspended = true; void ctx.suspend(); }
  }

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
