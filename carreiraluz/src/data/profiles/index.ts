import type { CareerProfile, LevelId } from '../types';
import { analistaMarketingSenior } from './analista-marketing-senior';
import { buildGenericProfile } from './generic';

// Perfis com conteúdo revisado. Para incluir um cargo novo, crie o arquivo do
// perfil e registre-o aqui; os demais recortes usam o guia genérico.
const REVIEWED: Record<string, CareerProfile> = {
  [analistaMarketingSenior.key]: analistaMarketingSenior,
};

export function getProfile(roleId: string, level: LevelId): CareerProfile | null {
  return REVIEWED[`${roleId}:${level}`] ?? buildGenericProfile(roleId, level);
}

export const reviewedProfileKeys = () => Object.keys(REVIEWED);
