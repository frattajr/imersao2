import {
  bestMatch, descKey, generationRequest, LIB_LAYERS, LIB_SPOTS, REUSE_THRESHOLD, sanitizeDesc, sanitizeVariant, similarity,
  type LibrarySound, type SoundDesc,
} from '../supabase/functions/_shared/sound-library';
import { looksLikeMp3, resolveDescs, type Store } from '../supabase/functions/_shared/sound-resolve';
import { normalize, TARGET_RMS, type BufferLike } from '../src/audio/engine';
import { sanitizePlan } from '../src/core/plan';
import { planDescs, spotDesc } from '../src/core/sound';
import { LAYERS, SPOTS } from '../src/core/types';

describe('descrição padronizada', () => {
  it('usa as mesmas listas de sons do app', () => {
    expect([...LIB_LAYERS]).toEqual([...LAYERS]);
    expect([...LIB_SPOTS]).toEqual([...SPOTS]);
  });

  it('descarta valores fora da lista e limpa o detalhe', () => {
    expect(sanitizeVariant({ material: 'plastic', place: 'cave', detail: 'Huge OLD dragon!!! roaring loud and very far' }))
      .toEqual({ place: 'cave', detail: 'huge old dragon roaring loud and' });
    expect(sanitizeVariant({ material: 'x' })).toBeUndefined();
    expect(sanitizeDesc({ cat: 'layer', name: 'roar' })).toBeNull(); // roar é som pontual, não camada
    expect(sanitizeDesc({ cat: 'spot', name: 'roar', distance: 'far' })).toEqual({ cat: 'spot', name: 'roar', distance: 'far' });
  });

  it('a chave é a mesma para os mesmos campos, em qualquer ordem, e ignora o detalhe', () => {
    const a: SoundDesc = { cat: 'spot', name: 'steps', material: 'wood', place: 'indoor', detail: 'old stairs' };
    const b: SoundDesc = { place: 'indoor', detail: 'creaky stairs', material: 'wood', name: 'steps', cat: 'spot' };
    expect(descKey(a)).toBe(descKey(b));
    expect(descKey(a)).not.toBe(descKey({ ...a, material: 'stone' }));
  });
});

describe('semelhança', () => {
  const lib: LibrarySound[] = [
    { id: '1', key: '', path: 'a.mp3', cat: 'layer', name: 'rain', material: 'metal', place: 'outdoor', intensity: 'strong', detail: 'tin roof' },
    { id: '2', key: '', path: 'b.mp3', cat: 'layer', name: 'rain', material: 'glass', place: 'indoor', intensity: 'soft' },
    { id: '3', key: '', path: 'c.mp3', cat: 'layer', name: 'sea', place: 'outdoor' },
  ];

  it('nunca troca um som por outro de nome diferente', () => {
    expect(similarity({ cat: 'layer', name: 'rain' }, lib[2])).toBe(0);
    expect(bestMatch({ cat: 'layer', name: 'wind' }, lib)).toBeNull();
  });

  it('reaproveita o mais parecido', () => {
    const m = bestMatch({ cat: 'layer', name: 'rain', material: 'metal', place: 'outdoor', intensity: 'strong', detail: 'metal roof' }, lib);
    expect(m?.sound.id).toBe('1');
    const m2 = bestMatch({ cat: 'layer', name: 'rain', material: 'glass', place: 'indoor' }, lib);
    expect(m2?.sound.id).toBe('2');
  });

  it('pedido genérico usa um som existente; pedido bem diferente é som novo', () => {
    expect(bestMatch({ cat: 'layer', name: 'rain' }, lib)).not.toBeNull();
    const diferente = { cat: 'layer' as const, name: 'rain', material: 'leaves' as const, place: 'cave' as const, distance: 'far' as const, intensity: 'medium' as const };
    expect(similarity(diferente, lib[0])).toBeLessThan(REUSE_THRESHOLD);
    expect(bestMatch(diferente, lib)).toBeNull();
  });

  it('sorteia entre variações iguais', () => {
    const twins = [lib[1], { ...lib[1], id: '2b' }];
    const want: SoundDesc = { cat: 'layer', name: 'rain', material: 'glass', place: 'indoor', intensity: 'soft' };
    expect(bestMatch(want, twins, () => 0)?.sound.id).toBe('2');
    expect(bestMatch(want, twins, () => 0.99)?.sound.id).toBe('2b');
  });

  it('monta o pedido de geração: camada em loop, som pontual curto', () => {
    const g = generationRequest({ cat: 'layer', name: 'rain', material: 'metal', detail: 'tin roof', intensity: 'soft' });
    expect(g.loop).toBe(true);
    expect(g.text).toMatch(/soft and gentle, rain falling, on metal, tin roof/);
    expect(generationRequest({ cat: 'spot', name: 'roar', distance: 'far' })).toMatchObject({ loop: false, seconds: 3 });
  });
});

describe('plano da IA com descrição', () => {
  it('aceita looks e v, descarta o resto', () => {
    const p = sanitizePlan({
      ambience: { rain: 0.5 },
      looks: { rain: { material: 'metal' }, sea: { place: 'outdoor' }, wind: 'x' },
      spots: [{ s: 'steps', at: 2, w: 0.5, surface: 'wood', v: { place: 'indoor', material: 'lava' } }],
    })!;
    expect(p.looks).toEqual({ rain: { material: 'metal' } }); // sea não está no ambiente
    expect(p.spots[0].v).toEqual({ place: 'indoor' });
    expect(spotDesc(p.spots[0])).toEqual({ cat: 'spot', name: 'steps', place: 'indoor', material: 'wood', intensity: 'medium' });
    expect(planDescs(p)).toHaveLength(2);
  });

  it('plano antigo (sem descrição) continua válido', () => {
    const p = sanitizePlan({ ambience: { fire: 0.4 }, spots: [] })!;
    expect(p.looks).toBeUndefined();
    expect(planDescs(p)).toEqual([{ cat: 'layer', name: 'fire' }]);
  });
});

/* ---------- servidor: reaproveitar ou gerar ---------- */

const mp3 = () => { const b = new Uint8Array(6000); b[0] = 0x49; b[1] = 0x44; b[2] = 0x33; return b; };

function memoryStore(seed: LibrarySound[] = [], genLimit = 10) {
  const rows = new Map<string, LibrarySound & { status: string }>();
  seed.forEach((s) => rows.set(s.id, { ...s, status: 'ok' }));
  const files = new Map<string, Uint8Array>();
  const uses = new Map<string, number>();
  let n = 0, generated = 0;
  const store: Store = {
    candidates: async (cat, name) => [...rows.values()].filter((r) => r.cat === cat && r.name === name && r.status === 'ok'),
    claim: async (d, key) => {
      if ([...rows.values()].some((r) => r.key === key && (r.status === 'generating' || r.status === 'failed'))) return null;
      const id = 'g' + ++n;
      generated++;
      rows.set(id, { ...d, id, key, path: '', status: 'generating' });
      return id;
    },
    finish: async (id, path) => { const r = rows.get(id)!; r.status = 'ok'; r.path = path; },
    fail: async (id) => { rows.get(id)!.status = 'failed'; },
    bumpUses: async (ids) => ids.forEach((i) => uses.set(i, (uses.get(i) ?? 0) + 1)),
    upload: async (path, data) => { files.set(path, data); return true; },
    publicUrl: (path) => 'https://cdn/' + path,
    withinGenLimit: async () => generated < genLimit,
  };
  return { store, rows, files, uses };
}

describe('sound-resolve', () => {
  const rainLib: LibrarySound = { id: 'r1', key: 'k', path: 'pack/rain.m4a', cat: 'layer', name: 'rain' };

  it('reaproveita do repositório e conta o uso', async () => {
    const { store, uses } = memoryStore([rainLib]);
    const later: Promise<unknown>[] = [];
    const out = await resolveDescs([{ cat: 'layer', name: 'rain', intensity: 'soft' }], store, null, (p) => later.push(p));
    await Promise.all(later);
    expect(out[0]).toMatchObject({ status: 'hit', id: 'r1', url: 'https://cdn/pack/rain.m4a' });
    expect(uses.get('r1')).toBe(1);
  });

  it('sem geração ligada, som novo fica com a reserva (none)', async () => {
    const { store } = memoryStore();
    const out = await resolveDescs([{ cat: 'spot', name: 'roar' }], store, null, () => undefined);
    expect(out[0]).toEqual({ status: 'none' });
  });

  it('gera o som novo uma vez só e reaproveita nas próximas', async () => {
    const { store, files } = memoryStore();
    let calls = 0;
    const gen = async () => { calls++; return mp3(); };
    const later: Promise<unknown>[] = [];
    const defer = (p: Promise<unknown>) => later.push(p);
    const roar: SoundDesc = { cat: 'spot', name: 'roar', distance: 'far', detail: 'huge dragon' };

    // dois leitores pedem ao mesmo tempo: só uma geração
    const [a, b] = await Promise.all([resolveDescs([roar], store, gen, defer), resolveDescs([roar], store, gen, defer)]);
    expect(a[0]).toEqual({ status: 'pending' });
    expect(b[0]).toEqual({ status: 'pending' });
    await Promise.all(later);
    expect(calls).toBe(1);
    expect([...files.keys()][0]).toMatch(/^lib\/spot\/roar\/g1\.mp3$/);

    // depois: pedido parecido reaproveita, sem gerar
    const c = await resolveDescs([{ ...roar, detail: 'old dragon' }], store, gen, defer);
    expect(c[0]).toMatchObject({ status: 'hit', id: 'g1' });
    expect(calls).toBe(1);
  });

  it('arquivo gerado inválido não entra no repositório e não é pedido de novo logo em seguida', async () => {
    const { store, rows } = memoryStore();
    let calls = 0;
    const gen = async () => { calls++; return new Uint8Array(10); };
    const later: Promise<unknown>[] = [];
    await resolveDescs([{ cat: 'spot', name: 'owl' }], store, gen, (p) => later.push(p));
    await Promise.all(later);
    expect([...rows.values()][0].status).toBe('failed');
    const again = await resolveDescs([{ cat: 'spot', name: 'owl' }], store, gen, (p) => later.push(p));
    expect(again[0]).toEqual({ status: 'pending' });
    expect(calls).toBe(1);
  });

  it('respeita o limite diário de gerações', async () => {
    const { store } = memoryStore([], 0);
    const out = await resolveDescs([{ cat: 'spot', name: 'owl' }], store, async () => mp3(), () => undefined);
    expect(out[0]).toEqual({ status: 'none' });
  });

  it('reconhece MP3', () => {
    expect(looksLikeMp3(mp3())).toBe(true);
    const sync = new Uint8Array(5000); sync[0] = 0xff; sync[1] = 0xfb;
    expect(looksLikeMp3(sync)).toBe(true);
    expect(looksLikeMp3(new Uint8Array(5000))).toBe(false);
  });
});

describe('normalização de volume no app', () => {
  const buf = (data: Float32Array): BufferLike => ({ duration: 1, getChannelData: () => data });

  it('leva arquivos baixos e altos ao mesmo nível', () => {
    const low = new Float32Array(1000).map((_, i) => 0.01 * Math.sin(i / 5));
    expect(normalize(buf(low))).toBe(true);
    const rms = Math.sqrt(low.reduce((s, v) => s + v * v, 0) / low.length);
    expect(rms).toBeCloseTo(TARGET_RMS, 2);
  });

  it('não deixa o pico estourar e recusa arquivo mudo', () => {
    const spiky = new Float32Array(1000); spiky[10] = 0.5; spiky[11] = 0.01;
    normalize(buf(spiky));
    expect(Math.max(...spiky.map(Math.abs))).toBeLessThanOrEqual(0.9 + 1e-6);
    expect(normalize(buf(new Float32Array(1000)))).toBe(false);
  });
});

/* ---------- enredo → sons ---------- */
import { analyze } from '../src/core/analyze';
import { bookProfile, enrichPlan, readCues } from '../src/core/scenery';
import { SceneSmoother } from '../src/core/smooth';
import { SAMPLE_BOOKS } from '../src/data/books';

describe('leitura do enredo', () => {
  it('reconhece lugar, distância, intensidade e materiais', () => {
    const c = readCues('Lá dentro da caverna, ao longe, gotas pingavam na pedra. A tempestade desabou.');
    expect(c).toMatchObject({ place: 'cave', distance: 'far', intensity: 'strong' });
    expect(c.materials).toContain('stone');
  });

  it('o livro tem um perfil: cenário e uma descrição por camada', () => {
    const farol = SAMPLE_BOOKS.find((b) => b.id === 'sample-farol')!;
    const p = bookProfile(farol.pages, analyze);
    expect(p.tags).toContain('lighthouse');
    expect(p.looks.sea).toMatchObject({ place: 'outdoor' });
  });

  it('a mesma camada recebe a mesma descrição em páginas diferentes (o repositório reaproveita)', () => {
    const farol = SAMPLE_BOOKS.find((b) => b.id === 'sample-farol')!;
    const prof = bookProfile(farol.pages, analyze);
    const looks = farol.pages.map((t) => enrichPlan(analyze(t), t, prof).looks?.sea).filter(Boolean)
      .map((v) => { const { intensity: _i, ...rest } = v!; return JSON.stringify(rest); });
    expect(new Set(looks).size).toBe(1);
  });

  it('escolhe detalhes de ambiente pelo lugar: rangido em escada de madeira, gotas na caverna', () => {
    const casa = enrichPlan(analyze('Subiu a escada de madeira da casa velha, no escuro.'), 'Subiu a escada de madeira da casa velha, no escuro.');
    expect(casa.details.map((d) => d.s)).toContain('creak');
    const t = 'Na caverna úmida, o silêncio era quase total.';
    expect(enrichPlan(analyze(t), t).details.map((d) => d.s)).toContain('drip');
    casa.details.forEach((d) => expect(d.w).toBeLessThanOrEqual(0.3)); // detalhes sempre baixinhos
  });

  it('o rugido de um livro de dragão vira "rugido de dragão, longe"', () => {
    const dragao = SAMPLE_BOOKS.find((b) => b.id === 'sample-dragao')!;
    const prof = bookProfile(dragao.pages, analyze, dragao.title);
    const i = dragao.pages.findIndex((t) => analyze(t).spots.some((s) => s.s === 'roar'));
    const sp = enrichPlan(analyze(dragao.pages[i]), dragao.pages[i], prof).spots.find((s) => s.s === 'roar')!;
    expect(sp.v?.detail).toBe('dragon');
  });
});

describe('suavização quando a cena muda muito', () => {
  it('cena calma: segue o pedido, transição normal', () => {
    const s = new SceneSmoother();
    const r = s.next({ rain: 0.5 }, 0);
    expect(r).toMatchObject({ amb: { rain: 0.5 }, fade: 1, gain: 1 });
  });

  it('muitas trocas seguidas: transições mais longas, volume mais baixo, sem sumiço brusco', () => {
    const s = new SceneSmoother();
    const scenes = [{ rain: 0.6 }, { sea: 0.6 }, { fire: 0.6 }, { city: 0.6 }, { cafe: 0.6 }, { wind: 0.6 }];
    let r = s.next(scenes[0], 0);
    scenes.slice(1).forEach((sc, i) => { r = s.next(sc, (i + 1) * 4000); });
    expect(r.busy).toBeGreaterThan(0.5);
    expect(r.fade).toBeGreaterThan(1.8);
    expect(r.gain).toBeLessThan(0.85);
    expect(r.amb.cafe).toBeCloseTo(0.3); // a anterior desce pela metade em vez de sumir
    expect(Object.keys(r.amb).length).toBeLessThanOrEqual(4);
  });

  it('cena agitada ignora camada fraca nova e volta ao normal depois de um tempo calmo', () => {
    const s = new SceneSmoother();
    for (let i = 0; i < 6; i++) s.next(i % 2 ? { rain: 0.7 } : { sea: 0.7 }, i * 3000);
    expect(s.next({ sea: 0.7, birds: 0.2 }, 19000).amb.birds).toBeUndefined();
    const calm = s.next({ sea: 0.7 }, 200_000);
    expect(calm.fade).toBe(1);
    expect(calm.amb).toEqual({ sea: 0.7 });
  });
});
