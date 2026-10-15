import { AmbientEngine, DUCK_LEVEL, duckEnvelope, equalPowerPoints, fadeSeconds, seamlessChannels, type CtxLike } from '../src/audio/engine';
import type { MixStem } from '../src/core/types';

/* ---------- contexto de áudio simulado: registra rampas e conexões ---------- */
class Param {
  value: number;
  events: { kind: string; v: number; t: number }[] = [];
  constructor(v: number) { this.value = v; }
  setValueAtTime(v: number, t: number) { this.events.push({ kind: 'set', v, t }); this.value = v; }
  linearRampToValueAtTime(v: number, t: number) { this.events.push({ kind: 'ramp', v, t }); }
  cancelScheduledValues() { this.events = []; }
  /** último valor agendado */
  get target() { return this.events.length ? this.events[this.events.length - 1].v : this.value; }
}
class Node { out: unknown[] = []; connect(n: unknown) { this.out.push(n); return n; } disconnect() { this.out = []; } }
class Gain extends Node { gain = new Param(1); }
class Filter extends Node { type = ''; frequency = new Param(20000); Q = new Param(1); }
class Src extends Node { buffer: unknown = null; loop = false; started = false; start() { this.started = true; } stop() { this.started = false; } }

function fakeCtx() {
  const ctx = {
    sampleRate: 44100, currentTime: 0, state: 'running', destination: new Node(),
    createGain: () => new Gain(), createBiquadFilter: () => new Filter(), createBufferSource: () => new Src(),
    createBuffer: (ch: number, len: number, sr: number) => {
      const data = Array.from({ length: ch }, () => new Float32Array(len));
      return { duration: len / sr, numberOfChannels: ch, getChannelData: (c: number) => data[c] };
    },
    resume: async () => undefined, suspend: async () => undefined,
    decodeAudioData: async () => ({ duration: 30, numberOfChannels: 1, getChannelData: () => Float32Array.from({ length: 1000 }, (_, i) => 0.1 * Math.sin(i)) }),
  };
  return ctx;
}

const lib = { resolve: async (d: { name: string }) => ({ id: d.name, url: 'https://x/' + d.name }) };
(globalThis as { fetch: unknown }).fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
const flush = () => new Promise((r) => setTimeout(r, 10));

const engines: AmbientEngine[] = [];
afterEach(async () => { await Promise.all(engines.splice(0).map((e) => e.dispose())); });

function setup() {
  const ctx = fakeCtx();
  const e = new AmbientEngine(() => ctx as unknown as CtxLike);
  engines.push(e);
  e.setLibrary(lib);
  e.start();
  const stems = (e as unknown as { stems: Map<string, { gain: Gain; filter: Filter; level: number; src: Src | null }> }).stems;
  return { ctx, e, stems };
}

describe('curvas de transição', () => {
  it('potência constante: sobe rápido no começo ao entrar, desce devagar no começo ao sair', () => {
    const up = equalPowerPoints(0, 1, 4);
    expect(up.map((p) => p.dt)).toEqual([1, 2, 3, 4]);
    expect(up[0].v).toBeGreaterThan(0.25); // mais que uma reta
    expect(up[3].v).toBeCloseTo(1);
    const down = equalPowerPoints(1, 0, 4);
    expect(down[0].v).toBeGreaterThan(0.75); // segura o volume no início da saída
    expect(down[3].v).toBeCloseTo(0);
  });

  it('transições entre 2,5 s (entrar) e 4 s (sair) no padrão; agitação e preferência alongam', () => {
    expect(fadeSeconds(true, 1, 1)).toBe(2.5);
    expect(fadeSeconds(false, 1, 1)).toBe(4);
    expect(fadeSeconds(false, 2, 1)).toBeGreaterThan(4);
    expect(fadeSeconds(false, 2.5, 1)).toBeLessThanOrEqual(6);
    expect(fadeSeconds(true, 1, 1.7)).toBeGreaterThan(4);
  });

  it('ducking: junta efeitos próximos numa janela só e volta ao normal depois', () => {
    const env = duckEnvelope([[2, 3], [3.5, 4]], 0);
    expect(env.filter((p) => p.v === DUCK_LEVEL)).toHaveLength(2); // uma janela (abaixa e segura)
    expect(env[env.length - 1].v).toBe(1);
    expect(duckEnvelope([[1, 2], [10, 11]], 0).filter((p) => p.v === DUCK_LEVEL)).toHaveLength(4); // duas janelas
  });
});

describe('motor de mixagem', () => {
  const mix: MixStem[] = [
    { s: 'rain', gain: 0.5, priority: 1, lowpass: 1200 },
    { s: 'wind', gain: 0.3, priority: 2 },
    { s: 'drone', gain: 0.2, priority: 3 },
    { s: 'night', gain: 0.25, priority: 3 },
    { s: 'fire', gain: 0.4, priority: 2 },
  ];

  it('toca no máximo 4 stems, os de maior prioridade, com low-pass', async () => {
    const { e, stems } = setup();
    e.setMix(mix);
    await flush();
    const on = [...stems.entries()].filter(([, s]) => s.level > 0).map(([k]) => k);
    expect(on).toHaveLength(4);
    expect(on).not.toContain('drone'); // prioridade 3 e o mais baixo de todos
    expect(stems.get('rain')!.filter.frequency.target).toBe(1200);
    expect(stems.get('rain')!.src?.started).toBe(true);
  });

  it('modo foco: só stems essenciais/apoio (máx. 2), agudos cortados e sem efeitos', async () => {
    const { e, stems } = setup();
    e.setComfort({ focus: true });
    e.setMix(mix);
    await flush();
    const on = [...stems.entries()].filter(([, s]) => s.level > 0).map(([k]) => k);
    expect(on.sort()).toEqual(['fire', 'rain']);
    expect(stems.get('fire')!.filter.frequency.target).toBeLessThanOrEqual(1800);
    const fx = (e as unknown as { fxBus: Gain }).fxBus;
    expect(fx.gain.target).toBe(0);
  });

  it('loops desligados: nenhum stem toca; volumes de ambiente e efeitos separados', async () => {
    const { e, stems } = setup();
    e.setComfort({ loops: false, sfx: 0.4 });
    e.setMix(mix);
    await flush();
    expect([...stems.values()].every((s) => s.level === 0)).toBe(true);
    const k = e as unknown as { ambBus: Gain; fxBus: Gain };
    expect(k.ambBus.gain.target).toBe(0);
    expect(k.fxBus.gain.target).toBe(0.4);
  });

  it('stem que sai desce até zero; o que fica não é recarregado', async () => {
    const { e, stems } = setup();
    e.setMix(mix.slice(0, 2));
    await flush();
    const rainSrc = stems.get('rain')!.src;
    e.setMix([{ s: 'rain', gain: 0.5, priority: 1 }]);
    await flush();
    expect(stems.get('wind')!.level).toBe(0);
    expect(stems.get('wind')!.gain.gain.target).toBe(0);
    expect(stems.get('rain')!.src).toBe(rainSrc);
  });

  it('efeito pontual abaixa o ambiente (ducking)', async () => {
    const { e } = setup();
    e.setMix(mix.slice(0, 1));
    e.playSpots([{ s: 'door', at: 1, w: 0.5 }]);
    await flush();
    const duck = (e as unknown as { duckGain: Gain }).duckGain;
    expect(duck.gain.events.some((ev) => ev.v === DUCK_LEVEL)).toBe(true);
  });
  it('navegador bloqueou o som: pede um toque; pausa do próprio motor não pede', async () => {
    const { ctx, e } = setup();
    ctx.state = 'suspended'; // resume() não muda o estado: autoplay bloqueado
    expect(e.needsUnlock).toBe(false); // nada para tocar ainda
    e.setMix(mix.slice(0, 1));
    await flush();
    expect(e.needsUnlock).toBe(true);
    ctx.state = 'running';
    await e.pause();
    ctx.state = 'suspended';
    expect(e.needsUnlock).toBe(false);
  });
});

describe('loops e presença', () => {
  it('loop sem emenda: o último sample emenda no primeiro sem salto', () => {
    const sr = 1000, len = 10_000;
    // senoide que NÃO fecha o ciclo no fim (um loop cru daria um salto)
    const d = Float32Array.from({ length: len }, (_, i) => Math.sin(i * 0.0123));
    const [out] = seamlessChannels([d], sr, 2);
    expect(out.length).toBe(len - 2000);
    const jumpRaw = Math.abs(d[len - 1] - d[0]);
    const jumpLoop = Math.abs(out[out.length - 1] - out[0]);
    expect(jumpRaw).toBeGreaterThan(0.1);
    expect(jumpLoop).toBeLessThan(0.02);
    // o meio do arquivo fica intacto
    expect(out[5000]).toBe(d[5000]);
  });

  it('arquivo curto demais: não mexe', () => {
    const d = new Float32Array(100);
    expect(seamlessChannels([d], 1000, 2)[0]).toBe(d);
  });

  it('pausa por inatividade baixa a presença e um efeito não toca; volta ao retomar', async () => {
    const { e } = setup();
    e.setMix([{ s: 'rain', gain: 0.5, priority: 1 }]);
    await flush();
    e.setIdle(true);
    expect(e.presenceLevel).toBeLessThan(0.1);
    e.setIdle(false);
    expect(e.presenceLevel).toBe(1);
  });

  it('no máximo um efeito pontual a cada 40 s', async () => {
    const { e, ctx } = setup();
    e.setMix([{ s: 'rain', gain: 0.5, priority: 1 }]);
    const started: number[] = [];
    const orig = ctx.createBufferSource;
    ctx.createBufferSource = () => { const s = orig(); const st = s.start.bind(s); s.start = () => { if (!s.loop) started.push(ctx.currentTime); st(); }; return s; };
    e.playSpots([{ s: 'door', at: 1, w: 0.5 }]);
    e.playSpots([{ s: 'knock', at: 1, w: 0.5 }]);
    await flush();
    ctx.currentTime = 50;
    e.playSpots([{ s: 'bell', at: 1, w: 0.5 }]);
    await flush();
    expect(started.length).toBe(2);
  });
});

describe('dinâmica para leitura longa', () => {
  const tick = (e: AmbientEngine) => (e as unknown as { tick: () => void }).tick();

  it('arco da cena: entra presente e assenta; capítulo começa com respiro', async () => {
    const { e, ctx } = setup();
    e.setMix([{ s: 'rain', gain: 0.5, priority: 1 }]);
    await flush();
    e.markScene();
    expect(e.presenceLevel).toBe(1);
    ctx.currentTime = 200; tick(e);
    expect(e.presenceLevel).toBeCloseTo(0.6, 1);
    e.markScene({ chapter: true });
    expect(e.presenceLevel).toBeLessThan(0.1);
    ctx.currentTime = 210; tick(e);
    expect(e.presenceLevel).toBe(1);
  });

  it('tom: agudos macios, mais escuro à noite e com tensão', () => {
    const { e } = setup();
    e.setTone({ night: false, tension: 0 });
    const day = e.toneFrequency;
    e.setTone({ night: true, tension: 0 });
    const night = e.toneFrequency;
    e.setTone({ night: true, tension: 1 });
    expect(day).toBeLessThanOrEqual(7000);
    expect(night).toBeLessThan(day);
    expect(e.toneFrequency).toBeLessThan(night);
    expect(e.toneFrequency).toBeGreaterThanOrEqual(2200);
  });

  it('vozes sempre abafadas; tique-taque sai sozinho depois de 45 s', async () => {
    const { e, ctx, stems } = setup();
    e.setMix([{ s: 'crowd', gain: 0.5, priority: 1 }, { s: 'clock', gain: 0.3, priority: 2 }]);
    await flush();
    expect(stems.get('crowd')!.filter.frequency.target).toBeLessThanOrEqual(900);
    ctx.currentTime = 50; tick(e);
    expect(stems.get('clock')!.level).toBe(0);
    // a mesma cena pede o relógio de novo: continua fora
    e.setMix([{ s: 'crowd', gain: 0.5, priority: 1 }, { s: 'clock', gain: 0.3, priority: 2 }]);
    expect(stems.get('clock')!.level).toBe(0);
    // cena nova: pode voltar
    e.markScene();
    e.setMix([{ s: 'crowd', gain: 0.5, priority: 1 }, { s: 'clock', gain: 0.3, priority: 2 }]);
    expect(stems.get('clock')!.level).toBeGreaterThan(0);
  });

  it('efeito rítmico só uma vez por cena', async () => {
    const { e, ctx } = setup();
    let n = 0;
    const orig = ctx.createBufferSource;
    ctx.createBufferSource = () => { const s = orig(); const st = s.start.bind(s); s.start = () => { if (!s.loop) n++; st(); }; return s; };
    e.playSpots([{ s: 'steps', at: 1, w: 0.4 }]);
    await flush();
    ctx.currentTime = 60;
    e.playSpots([{ s: 'steps', at: 1, w: 0.4 }]);
    await flush();
    expect(n).toBe(1);
    e.markScene();
    ctx.currentTime = 120;
    e.playSpots([{ s: 'steps', at: 1, w: 0.4 }]);
    await flush();
    expect(n).toBe(2);
  });

  it('contra a repetição: o loop troca de tomada de tempos em tempos', async () => {
    const { e, ctx, stems } = setup();
    e.setMix([{ s: 'rain', gain: 0.5, priority: 1 }]);
    await flush();
    const first = stems.get('rain')!.src;
    ctx.currentTime = 300; tick(e);
    expect(stems.get('rain')!.src).not.toBe(first);
    expect(stems.get('rain')!.src?.started).toBe(true);
  });
});
