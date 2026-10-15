/**
 * Descrição padronizada de cada som do plano, para buscar no repositório.
 */
import type { SoundDesc, SoundVariant } from '../../supabase/functions/_shared/sound-library';
import type { Layer, ScenePlan, Spot } from './types';

export const layerDesc = (name: Layer, v?: SoundVariant): SoundDesc => ({ cat: 'layer', name, ...v });

export function spotDesc(sp: Spot): SoundDesc {
  const d: SoundDesc = { cat: 'spot', name: sp.s, ...sp.v };
  // a superfície dos passos que a IA já mandava vale como material
  if (!d.material && sp.surface) d.material = sp.surface;
  if (!d.intensity) d.intensity = sp.w < 0.35 ? 'soft' : sp.w > 0.7 ? 'strong' : 'medium';
  return d;
}

/** Todas as descrições de um plano (camadas e sons pontuais). */
export function planDescs(p: ScenePlan): SoundDesc[] {
  return [
    ...(Object.keys(p.ambience) as Layer[]).map((L) => layerDesc(L, p.looks?.[L])),
    ...p.spots.map(spotDesc),
  ];
}
