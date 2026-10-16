/** Regras de escolha dos sons do Freesound (usadas por scripts/build-stems-freesound.ts). */
import type { SoundDesc } from '../../supabase/functions/_shared/sound-library';

/** Como procurar cada som (inglês, que é o idioma das etiquetas do Freesound). */
export const QUERY: Record<string, string> = {
  wind: 'wind ambience', leaves: 'leaves rustling forest ambience', birds: 'birds forest ambience', rain: 'rain ambience',
  thunder: 'distant thunder storm', sea: 'sea waves shore', water: 'stream water flowing', fire: 'fireplace crackling',
  cafe: 'cafe ambience', crowd: 'crowd murmur ambience', city: 'city street ambience', train: 'train interior ambience',
  night: 'night ambience', cricket: 'crickets night', clock: 'clock ticking', tavern: 'tavern pub ambience', drone: 'dark drone ambient',
  steps: 'footsteps', door: 'door creak open', knock: 'door knock', doorbell: 'shop bell ring', keys: 'keys jingle', roar: 'monster roar',
  howl: 'wolf howl', bark: 'dog bark', owl: 'owl hoot', bell: 'church bell', horn: 'train whistle', hooves: 'horse hooves',
  creak: 'wood creak', drip: 'water drip', gust: 'wind gust', rustle: 'cloth rustle', purr: 'cat purr', musicbox: 'music box',
  heartbeat: 'heartbeat', chains: 'chains rattle',
};

/** Termos de busca para um som (o detalhe e o material afinam, mas caem fora se não acharem nada). */
export function queriesFor(d: SoundDesc): string[] {
  const base = QUERY[d.name] ?? d.name;
  const extra = [d.material, d.detail].filter(Boolean).join(' ');
  return extra ? [`${base} ${extra}`, base] : [base];
}

/** Duração aceitável: ambiente vira loop (20 s a 3 min); efeito é curto. */
export const durationFilter = (d: SoundDesc) => (d.cat === 'layer' ? 'duration:[20 TO 180]' : 'duration:[0.5 TO 8]');

export interface Hit {
  id: number; name: string; username: string; license: string; duration: number;
  avg_rating: number; num_downloads: number; previews: Record<string, string>;
}

/** O melhor resultado: nota e downloads, sem repetir o mesmo arquivo. */
export function bestHit(hits: Hit[], used: Set<number>): Hit | undefined {
  return hits
    .filter((h) => !used.has(h.id) && /creativecommons\.org\/publicdomain\/zero|Creative Commons 0/i.test(h.license))
    .sort((a, b) => (b.avg_rating * Math.log10(10 + b.num_downloads)) - (a.avg_rating * Math.log10(10 + a.num_downloads)))[0];
}

