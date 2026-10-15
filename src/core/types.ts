import type { SoundVariant } from '../../supabase/functions/_shared/sound-library';

/** Camadas contínuas de ambiente. */
export const LAYERS = [
  'wind', 'leaves', 'birds', 'rain', 'thunder', 'sea', 'water', 'fire',
  'cafe', 'crowd', 'city', 'train', 'night', 'cricket', 'clock',
] as const;
export type Layer = (typeof LAYERS)[number];

/** Sons pontuais que acontecem na cena. */
export const SPOTS = [
  'steps', 'door', 'knock', 'doorbell', 'keys', 'roar', 'howl', 'bark', 'owl',
  'bell', 'horn', 'hooves', 'creak', 'drip', 'gust', 'rustle', 'purr', 'musicbox',
] as const;
export type SpotName = (typeof SPOTS)[number];

export const MOODS = ['rain', 'sea', 'fire', 'forest', 'night', 'city', 'tension', 'warm', 'cold', 'calm'] as const;
export type Mood = (typeof MOODS)[number];

export type Surface = 'wood' | 'gravel' | 'stone' | 'grass' | 'snow' | 'metal';

export interface Spot {
  s: SpotName;
  /** segundos após a página abrir */
  at: number;
  /** intensidade 0.15–1 */
  w: number;
  surface?: Surface;
  kind?: string;
  n?: number;
  pace?: number;
  rep?: number;
  gap?: number;
  /** como o som é (lugar, distância, intensidade...): escolhe a gravação no repositório */
  v?: SoundVariant;
}

export type Ambience = Partial<Record<Layer, number>>;

export interface ScenePlan {
  mood: Mood | null;
  ambience: Ambience;
  spots: Spot[];
  /** como soa cada camada nesta cena (ex.: chuva em telhado de metal) */
  looks?: Partial<Record<Layer, SoundVariant>>;
}

export interface GlossaryEntry {
  term: string;
  desc: string;
}

export type BookKind = 'builtin' | 'file' | 'pasted' | 'cloud';

export interface BookMeta {
  id: string;
  title: string;
  kind: BookKind;
  sub: string;
  emoji: string;
  n: number;
  idx: number;
  done: boolean;
  updatedAt: number;
}
