/**
 * Repositório de sons: descrição padronizada, chave canônica e semelhança.
 *
 * Usado no servidor (Deno) e no app (Metro/Jest), por isso não importa
 * nada. A IA descreve o som com campos fixos; descrições iguais dão a mesma
 * chave, e descrições parecidas reaproveitam o mesmo arquivo.
 */

/** Mesmas listas de src/core/types.ts (um teste garante que continuam iguais). */
export const LIB_LAYERS = [
  'wind', 'leaves', 'birds', 'rain', 'thunder', 'sea', 'water', 'fire',
  'cafe', 'crowd', 'city', 'train', 'night', 'cricket', 'clock', 'tavern', 'drone',
] as const;
export const LIB_SPOTS = [
  'steps', 'door', 'knock', 'doorbell', 'keys', 'roar', 'howl', 'bark', 'owl',
  'bell', 'horn', 'hooves', 'creak', 'drip', 'gust', 'rustle', 'purr', 'musicbox', 'heartbeat', 'chains',
] as const;

export const MATERIALS = [
  'wood', 'gravel', 'stone', 'grass', 'snow', 'metal', 'water', 'glass',
  'fabric', 'paper', 'leaves', 'mud', 'sand', 'tile',
] as const;
export const PLACES = ['indoor', 'outdoor', 'cave', 'hall', 'vehicle', 'underwater'] as const;
export const DISTANCES = ['near', 'mid', 'far'] as const;
export const INTENSITIES = ['soft', 'medium', 'strong'] as const;

export type Material = (typeof MATERIALS)[number];
export type Place = (typeof PLACES)[number];
export type Distance = (typeof DISTANCES)[number];
export type Intensity = (typeof INTENSITIES)[number];

/** Como o som é, além do nome: o que a IA preenche para cada camada ou som pontual. */
export interface SoundVariant {
  material?: Material;
  place?: Place;
  distance?: Distance;
  intensity?: Intensity;
  /** até 6 palavras livres, em inglês (ex.: "tin roof", "old dragon") */
  detail?: string;
}

export interface SoundDesc extends SoundVariant {
  cat: 'layer' | 'spot';
  name: string;
}

/** Um som guardado no repositório. */
export interface LibrarySound extends SoundDesc {
  id: string;
  key: string;
  path: string;
}

const pick = <T extends string>(list: readonly T[], v: unknown): T | undefined =>
  list.includes(v as T) ? (v as T) : undefined;

export function sanitizeDetail(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const words = v.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 6);
  const s = words.join(' ').slice(0, 60).trim();
  return s || undefined;
}

export function sanitizeVariant(o: unknown): SoundVariant | undefined {
  if (!o || typeof o !== 'object') return undefined;
  const x = o as Record<string, unknown>;
  const v: SoundVariant = {
    material: pick(MATERIALS, x.material),
    place: pick(PLACES, x.place),
    distance: pick(DISTANCES, x.distance),
    intensity: pick(INTENSITIES, x.intensity),
    detail: sanitizeDetail(x.detail),
  };
  (Object.keys(v) as (keyof SoundVariant)[]).forEach((k) => v[k] === undefined && delete v[k]);
  return Object.keys(v).length ? v : undefined;
}

export function sanitizeDesc(o: unknown): SoundDesc | null {
  if (!o || typeof o !== 'object') return null;
  const x = o as Record<string, unknown>;
  const cat = x.cat === 'layer' || x.cat === 'spot' ? x.cat : null;
  if (!cat) return null;
  const names: readonly string[] = cat === 'layer' ? LIB_LAYERS : LIB_SPOTS;
  if (!names.includes(x.name as string)) return null;
  return { cat, name: x.name as string, ...sanitizeVariant(x) };
}

/** Chave canônica: campos fixos em ordem fixa. O "detail" livre fica de fora. */
export function descKey(d: SoundDesc): string {
  return [
    d.cat, d.name,
    'm=' + (d.material ?? '-'), 'p=' + (d.place ?? '-'),
    'd=' + (d.distance ?? '-'), 'i=' + (d.intensity ?? '-'),
  ].join('|');
}

const W = { material: 0.35, place: 0.2, distance: 0.2, intensity: 0.15, detail: 0.1 };

/**
 * Compara o campo pedido (want) com o do som guardado (have).
 * Igual: 1. Pedido sem o campo ("tanto faz"): 0,9 — aceita, mas prefere um
 * som genérico a um muito específico. Som guardado sem o campo: 0,5.
 * Diferentes: 0.
 */
const field = (want?: string, have?: string) =>
  want === have ? 1 : want === undefined ? 0.9 : have === undefined ? 0.5 : 0;

function jaccard(want?: string, have?: string): number {
  const a = want, b = have;
  if (!a) return b ? 0.9 : 1;
  if (!b) return 0.5;
  const A = new Set(a.split(' ')), B = new Set(b.split(' '));
  let inter = 0;
  A.forEach((w) => { if (B.has(w)) inter++; });
  return inter / (A.size + B.size - inter);
}

/**
 * Semelhança entre 0 e 1 do pedido `a` com o som guardado `b`.
 * Categoria e nome diferentes = 0 (nunca troca chuva por mar). Um pedido
 * genérico ("chuva", das palavras-chave sem IA) aceita qualquer chuva.
 */
export function similarity(a: SoundDesc, b: SoundDesc): number {
  if (a.cat !== b.cat || a.name !== b.name) return 0;
  return (
    W.material * field(a.material, b.material) +
    W.place * field(a.place, b.place) +
    W.distance * field(a.distance, b.distance) +
    W.intensity * field(a.intensity, b.intensity) +
    W.detail * jaccard(a.detail, b.detail)
  );
}

/** A partir daqui reaproveita; abaixo disso, o som é "novo". */
export const REUSE_THRESHOLD = 0.7;

/**
 * Escolhe o som guardado mais parecido. Entre os empatados (variações da
 * mesma descrição) sorteia, para o ouvido não decorar a gravação.
 */
export function bestMatch<T extends SoundDesc>(want: SoundDesc, have: T[], rand = Math.random): { sound: T; score: number } | null {
  let best: T[] = [];
  let top = 0;
  for (const h of have) {
    const s = similarity(want, h);
    if (s > top + 1e-9) { top = s; best = [h]; } else if (Math.abs(s - top) <= 1e-9 && s > 0) best.push(h);
  }
  if (!best.length || top < REUSE_THRESHOLD) return null;
  return { sound: best[Math.floor(rand() * best.length)], score: top };
}

/* ---------- pedido ao modelo que gera áudio ---------- */

const EN: Record<string, string> = {
  wind: 'wind blowing', leaves: 'leaves rustling in the wind', birds: 'birds singing', rain: 'rain falling',
  thunder: 'distant thunder rumbles', sea: 'ocean waves on the shore', water: 'stream of running water',
  fire: 'crackling fireplace', cafe: 'cozy cafe ambience with soft chatter and cups', crowd: 'distant crowd murmur',
  city: 'distant city traffic', train: 'train rolling on tracks', night: 'quiet night ambience', cricket: 'crickets chirping',
  clock: 'old clock ticking',
  tavern: 'old tavern ambience with low murmurs, wooden mugs and a crackling hearth',
  drone: 'very low dark ambient drone, subtle unease, no melody, no rhythm',
  steps: 'footsteps', door: 'a door', knock: 'knocking on a door', doorbell: 'small shop door bell',
  keys: 'jingling keys', roar: 'a creature roar', howl: 'a wolf howl', bark: 'a dog barking', owl: 'an owl hooting',
  bell: 'church bell tolling', horn: 'a horn', hooves: 'horse hooves', creak: 'wood creaking', drip: 'water drips',
  gust: 'a gust of wind', rustle: 'rustling', purr: 'a cat purring', musicbox: 'a music box melody',
  heartbeat: 'a slow muffled heartbeat', chains: 'heavy iron chains rattling',
};
const PLACE_EN: Record<Place, string> = {
  indoor: 'indoors in a small room', outdoor: 'outdoors', cave: 'inside a cave with echo', hall: 'in a large stone hall with reverb',
  vehicle: 'inside a vehicle', underwater: 'muffled underwater',
};
const DIST_EN: Record<Distance, string> = { near: 'close to the listener', mid: 'at a medium distance', far: 'far away in the distance' };
const INT_EN: Record<Intensity, string> = { soft: 'soft and gentle', medium: 'moderate', strong: 'intense' };

/** Texto (em inglês, como esses modelos entendem melhor), duração e se precisa ser loop. */
export function generationRequest(d: SoundDesc): { text: string; seconds: number; loop: boolean } {
  const parts = [
    d.intensity ? INT_EN[d.intensity] : '',
    EN[d.name] ?? d.name,
    d.material ? `on ${d.material}` : '',
    d.detail ?? '',
    d.place ? PLACE_EN[d.place] : '',
    d.distance ? DIST_EN[d.distance] : '',
  ].filter(Boolean);
  if (d.cat === 'layer') {
    return { text: `Seamless ambient loop, ${parts.join(', ')}. Steady, no music, no voices, no sudden events.`, seconds: 22, loop: true };
  }
  return { text: `Single sound effect: ${parts.join(', ')}. Natural tail, no music.`, seconds: d.name === 'steps' || d.name === 'hooves' ? 5 : 3, loop: false };
}
