/**
 * Validação do plano de som que vem da IA. Tudo que chega da rede é tratado
 * como não confiável: nomes desconhecidos são descartados e números são
 * limitados a faixas seguras.
 */
import { LAYERS, MOODS, SPOTS, type Ambience, type Mood, type ScenePlan, type Spot, type Surface } from './types';

const SURFACES: Surface[] = ['wood', 'gravel', 'stone', 'grass', 'snow', 'metal'];

export const clamp = (x: unknown, a: number, b: number, d: number): number => {
  const v = Number(x);
  return Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : d;
};

export function sanitizeSpot(o: unknown): Spot | null {
  if (!o || typeof o !== 'object') return null;
  const x = o as Record<string, unknown>;
  if (!SPOTS.includes(x.s as Spot['s'])) return null;
  const sp: Spot = { s: x.s as Spot['s'], at: clamp(x.at, 0.5, 10, 2), w: clamp(x.w, 0.15, 1, 0.5) };
  if (SURFACES.includes(x.surface as Surface)) sp.surface = x.surface as Surface;
  if (typeof x.kind === 'string') sp.kind = x.kind.slice(0, 16);
  if (x.n !== undefined) sp.n = Math.round(clamp(x.n, 1, 16, 4));
  if (x.pace !== undefined) sp.pace = clamp(x.pace, 0.25, 1.2, 0.6);
  if (x.rep !== undefined) sp.rep = Math.round(clamp(x.rep, 1, 5, 1));
  if (x.gap !== undefined) sp.gap = clamp(x.gap, 1.5, 14, 5);
  return sp;
}

export function sanitizePlan(o: unknown): ScenePlan | null {
  if (!o || typeof o !== 'object') return null;
  const x = o as Record<string, unknown>;
  const A = (x.ambience && typeof x.ambience === 'object' ? x.ambience : {}) as Record<string, unknown>;
  const amb: Ambience = {};
  LAYERS.forEach((k) => {
    const v = Number(A[k]);
    if (v >= 0.1) amb[k] = Math.min(1, v);
  });
  const ambience = Object.fromEntries(
    Object.entries(amb).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 3),
  ) as Ambience;
  const spots = (Array.isArray(x.spots) ? x.spots : []).map(sanitizeSpot).filter((s): s is Spot => !!s).slice(0, 2);
  return { mood: MOODS.includes(x.mood as Mood) ? (x.mood as Mood) : null, ambience, spots };
}

/**
 * Suaviza a troca entre cenas: mantém por um tempo, em nível mais baixo,
 * camadas da cena anterior que sumiriam de repente, e ignora variações
 * pequenas de volume para o som não ficar "respirando".
 */
export function blendAmbience(prev: Ambience, next: Ambience, carry: boolean): Ambience {
  const m: Ambience = { ...next };
  if (carry) {
    (Object.keys(prev) as (keyof Ambience)[]).forEach((k) => {
      if (!(k in m) && k !== 'thunder' && k !== 'cricket') {
        const v = (prev[k] ?? 0) * 0.55;
        if (v > 0.2 && Object.keys(m).length < 4) m[k] = v;
      }
    });
  }
  (Object.keys(m) as (keyof Ambience)[]).forEach((k) => {
    if (k in prev && Math.abs((m[k] ?? 0) - (prev[k] ?? 0)) < 0.12) m[k] = prev[k];
  });
  return m;
}
