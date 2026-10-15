/**
 * Lê o enredo para descrever COMO cada som deve soar (a mesma descrição que
 * o Laboratório de som usa) e quais detalhes de ambiente combinam com a cena.
 *
 * - `bookProfile`: olha o livro inteiro e fixa uma descrição por camada
 *   (a chuva do farol é sempre "chuva forte no telhado, ao ar livre…").
 *   Assim o livro soa coerente e a mesma descrição volta sempre → o
 *   repositório reaproveita o arquivo em vez de gerar outro.
 * - `enrichPlan`: completa o plano da página com essas descrições, ajusta
 *   pelo que o trecho diz (perto/longe, forte/suave, dentro/fora) e escolhe
 *   os detalhes de ambiente (rangidos, gotas, rajadas…) que tocam espaçados.
 */
import type { Distance, Intensity, Material, Place, SoundVariant } from '../../supabase/functions/_shared/sound-library';
import { norm } from './text';
import type { Layer, ScenePlan, Spot, SpotName } from './types';

/** O que o trecho diz sobre o lugar. */
export interface SceneCues {
  place?: Place;
  distance?: Distance;
  intensity?: Intensity;
  materials: Material[];
  /** palavras (em inglês) que identificam o cenário: "lighthouse", "dragon", "ship"… */
  tags: string[];
}

const has = (n: string, r: RegExp) => r.test(n);

const PLACE_RULES: [RegExp, Place][] = [
  [/caverna|gruta|tunel|subterran|masmorra/, 'cave'],
  [/salao|catedral|igreja|castelo|palacio|biblioteca/, 'hall'],
  [/vagao|cabine|carruagem|dentro do carro|dentro do trem|conves/, 'vehicle'],
  [/debaixo d.?agua|submers|mergulh/, 'underwater'],
  [/la dentro|dentro d[aeo]|sala|quarto|cozinha|casa|cafe\b|cafeteria|escada|andar de cima|loja|interior|janela|lareira|teto/, 'indoor'],
  [/floresta|bosque|praia|mar\b|campo|rua|ceu|jardim|trilha|ao ar livre|montanha|estrada|ponte/, 'outdoor'],
];

const MATERIAL_RULES: [RegExp, Material][] = [
  [/madeira|assoalho|tabua|navio|barco|cabana/, 'wood'],
  [/pedra|rocha|calcada|paralelep/, 'stone'],
  [/ferro|metal|aco\b|zinco|lata/, 'metal'],
  [/vidro|janela|vidraca/, 'glass'],
  [/neve|gelo/, 'snow'],
  [/cascalho/, 'gravel'],
  [/grama|gramado/, 'grass'],
  [/folhas secas|folhagem/, 'leaves'],
  [/areia/, 'sand'],
  [/lama|barro/, 'mud'],
];

const TAG_RULES: [RegExp, string][] = [
  [/farol/, 'lighthouse'], [/navio|barco|conves/, 'ship'], [/dragao/, 'dragon'], [/castelo/, 'castle'],
  [/telhado/, 'roof'], [/tempestade|temporal/, 'storm'], [/pinheir/, 'pine'], [/cafe\b|cafeteria/, 'cafe'],
  [/estacao|plataforma/, 'station'], [/madrugada|meia.noite/, 'midnight'], [/inverno/, 'winter'], [/velh[ao]/, 'old'],
];

export function readCues(text: string): SceneCues {
  const n = norm(text);
  const place = PLACE_RULES.find(([r]) => has(n, r))?.[1];
  const distance: Distance | undefined = has(n, /ao longe|distante|longe|la embaixo|horizonte|ecoou/) ? 'far'
    : has(n, /ao lado|bem perto|perto|encostad|sussurr/) ? 'near' : undefined;
  const intensity: Intensity | undefined = has(n, /tempestade|desabou|violent|forte|furios|pesad|estrondo|grossa/) ? 'strong'
    : has(n, /suave|fina|leve|baixinho|calma|devagar|brisa|silencio/) ? 'soft' : undefined;
  const materials = MATERIAL_RULES.filter(([r]) => has(n, r)).map(([, m]) => m);
  const tags = TAG_RULES.filter(([r]) => has(n, r)).map(([, t]) => t);
  return { place, distance, intensity, materials, tags };
}

/** Material que faz sentido para cada camada (chuva bate em algo; fogo queima algo). */
const LAYER_MATERIALS: Partial<Record<Layer, Material[]>> = {
  rain: ['metal', 'glass', 'wood', 'stone', 'leaves'],
  fire: ['wood'],
  wind: ['glass'],
  leaves: ['leaves'],
  water: ['stone'],
};
/** Camadas que só existem num tipo de lugar (não faz sentido "mar dentro do quarto"). */
const OUTDOOR_ONLY: Layer[] = ['sea', 'birds', 'cricket', 'leaves', 'thunder', 'city'];

function layerVariant(L: Layer, c: SceneCues): SoundVariant {
  const v: SoundVariant = {};
  const mats = LAYER_MATERIALS[L];
  const m = mats && c.materials.find((x) => mats.includes(x));
  if (m) v.material = m;
  if (c.place && !(OUTDOOR_ONLY.includes(L) && c.place !== 'outdoor')) v.place = c.place;
  if (L === 'thunder') v.distance = 'far';
  if (c.intensity) v.intensity = c.intensity;
  const tag = c.tags.find((t) => ['roof', 'lighthouse', 'ship', 'pine', 'castle', 'station', 'winter'].includes(t));
  if (tag && (L === 'rain' || L === 'wind' || L === 'sea' || L === 'leaves' || L === 'train')) v.detail = tag === 'roof' ? 'on the roof' : tag;
  return v;
}

export interface BookProfile {
  /** uma descrição por camada para o livro todo */
  looks: Partial<Record<Layer, SoundVariant>>;
  /** cenário do livro (aparece em várias páginas): "lighthouse", "dragon", "ship"… */
  tags: string[];
}

/**
 * Perfil sonoro do livro: para cada camada que aparece, a descrição mais
 * comum entre as páginas onde ela está, e as marcas do cenário que se repetem.
 */
export function bookProfile(pages: string[], planFor: (text: string) => ScenePlan, title = ''): BookProfile {
  const votes = new Map<Layer, Map<string, number>>();
  const tagCount = new Map<string, number>();
  // o título diz muito do cenário ("A Noite do Dragão"): conta como duas páginas
  readCues(title).tags.forEach((t) => tagCount.set(t, 2));
  pages.forEach((p) => {
    const plan = planFor(p);
    const cues = readCues(p);
    cues.tags.forEach((t) => tagCount.set(t, (tagCount.get(t) ?? 0) + 1));
    (Object.keys(plan.ambience) as Layer[]).forEach((L) => {
      const v = layerVariant(L, cues);
      delete v.intensity; // intensidade muda de página para página; o resto é o "jeito" do livro
      const k = JSON.stringify(v);
      const m = votes.get(L) ?? new Map<string, number>();
      m.set(k, (m.get(k) ?? 0) + (Object.keys(v).length ? 1.2 : 1)); // prefere descrições com conteúdo
      votes.set(L, m);
    });
  });
  const looks: Partial<Record<Layer, SoundVariant>> = {};
  votes.forEach((m, L) => {
    const best = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    const v = JSON.parse(best[0]) as SoundVariant;
    if (Object.keys(v).length) looks[L] = v;
  });
  // marca do cenário: aparece em mais de uma página (ou no título/começo de um texto curto)
  const tags = [...tagCount.entries()].filter(([, n]) => n >= 2 || pages.length <= 3).map(([t]) => t);
  return { looks, tags };
}

/** Detalhes de ambiente: sons pequenos que voltam de tempos em tempos, combinando com o lugar. */
export interface AmbientDetail { s: SpotName; w: number; v: SoundVariant }

function pickDetails(plan: ScenePlan, c: SceneCues, n: string): AmbientDetail[] {
  const A = plan.ambience;
  const out: AmbientDetail[] = [];
  const add = (s: SpotName, w: number, v: SoundVariant) => { if (!out.some((d) => d.s === s)) out.push({ s, w, v }); };
  const wooden = c.materials.includes('wood') || c.tags.includes('ship') || c.tags.includes('lighthouse') || /escada|assoalho|cabana|casa velha/.test(n);
  if ((c.place === 'indoor' || c.place === 'vehicle' || c.tags.includes('ship')) && wooden) add('creak', 0.3, { material: 'wood', place: c.place ?? 'indoor', distance: 'mid', intensity: 'soft' });
  if (c.place === 'cave' || /goteira|pingav|umid/.test(n)) add('drip', 0.3, { place: c.place === 'cave' ? 'cave' : 'indoor', distance: 'mid', intensity: 'soft' });
  if ((A.wind ?? 0) > 0.2 || (A.sea ?? 0) > 0.3 || c.tags.includes('storm')) add('gust', 0.25, { place: c.place === 'indoor' ? 'indoor' : 'outdoor', distance: 'far', intensity: 'soft' });
  if ((A.leaves ?? 0) > 0.2 || /floresta|bosque|mato/.test(n)) add('rustle', 0.25, { material: 'leaves', place: 'outdoor', distance: 'mid', intensity: 'soft' });
  if (((A.night ?? 0) > 0.2 || /noite|madrugada/.test(n)) && /floresta|bosque|pinheir|arvore|campo/.test(n)) add('owl', 0.2, { place: 'outdoor', distance: 'far', intensity: 'soft' });
  if (((A.night ?? 0) > 0.2 || (A.city ?? 0) > 0.2) && /rua|cidade|vila|aldeia/.test(n)) add('bark', 0.18, { place: 'outdoor', distance: 'far', intensity: 'soft' });
  if (/gato/.test(n) && c.place === 'indoor') add('purr', 0.2, { place: 'indoor', distance: 'near', intensity: 'soft' });
  return out.slice(0, 3);
}

/** Plano da página com as descrições de cada som e os detalhes de ambiente. */
export function enrichPlan(plan: ScenePlan, text: string, book: BookProfile = { looks: {}, tags: [] }): ScenePlan & { details: AmbientDetail[] } {
  const n = norm(text);
  const page = readCues(text);
  // o cenário do livro vale em todas as páginas (o farol continua lá mesmo quando o texto não fala dele)
  const c: SceneCues = { ...page, tags: [...new Set([...page.tags, ...book.tags])] };
  const profile = book.looks;
  const looks: Partial<Record<Layer, SoundVariant>> = {};
  (Object.keys(plan.ambience) as Layer[]).forEach((L) => {
    // o que a IA já descreveu vale mais; senão o perfil do livro; a intensidade vem da página
    const v: SoundVariant = { ...profile[L], ...plan.looks?.[L] };
    if (!plan.looks?.[L]?.intensity && c.intensity) v.intensity = c.intensity;
    if (Object.keys(v).length) looks[L] = v;
  });
  const spots: Spot[] = plan.spots.map((sp) => {
    if (sp.v) return sp;
    const v: SoundVariant = {};
    if (c.place) v.place = c.place;
    if (c.distance) v.distance = c.distance;
    else if (sp.s === 'roar' || sp.s === 'howl' || sp.s === 'bell' || sp.s === 'horn') v.distance = 'far';
    const tag = c.tags.find((t) => (sp.s === 'roar' ? t === 'dragon' : sp.s === 'creak' ? t === 'ship' || t === 'old' : sp.s === 'horn' ? t === 'ship' || t === 'station' : false));
    if (tag) v.detail = tag === 'old' ? 'old wood' : tag;
    return Object.keys(v).length ? { ...sp, v } : sp;
  });
  return { ...plan, spots, looks: Object.keys(looks).length ? looks : plan.looks, details: pickDetails(plan, c, n) };
}
