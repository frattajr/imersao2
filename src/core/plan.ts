/**
 * Validação do plano de som que vem da IA. Tudo que chega da rede é tratado
 * como não confiável: nomes desconhecidos são descartados e números são
 * limitados a faixas seguras.
 */
import { sanitizeVariant, type SoundVariant } from '../../supabase/functions/_shared/sound-library';
import { LAYERS, MOODS, SPOTS, type Ambience, type Layer, type MixStem, type Mood, type ScenePlan, type Spot, type StemPriority, type Surface } from './types';

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
  const v = sanitizeVariant(x.v);
  if (v) sp.v = v;
  return sp;
}

/** No máximo 4 stems ao mesmo tempo (bateria e clareza). */
export const MAX_STEMS = 4;

/** Uma linha da matriz de mixagem vinda da IA; null se inválida. */
export function sanitizeStem(o: unknown): MixStem | null {
  if (!o || typeof o !== 'object') return null;
  const x = o as Record<string, unknown>;
  if (!LAYERS.includes(x.s as Layer)) return null;
  const gain = clamp(x.gain, 0, 1, 0);
  if (gain < 0.05) return null;
  const st: MixStem = { s: x.s as Layer, gain, priority: Math.round(clamp(x.priority, 1, 3, 2)) as StemPriority };
  if (x.lowpass !== undefined && x.lowpass !== null) {
    const lp = clamp(x.lowpass, 200, 20000, 20000);
    if (lp < 18000) st.lowpass = Math.round(lp);
  }
  return st;
}

/** Ordena por prioridade (1 primeiro) e volume; descarta repetidos e o excesso. */
export function normalizeMix(stems: MixStem[], max = MAX_STEMS): MixStem[] {
  const seen = new Set<Layer>();
  return [...stems]
    .sort((a, b) => a.priority - b.priority || b.gain - a.gain)
    .filter((st) => !seen.has(st.s) && seen.add(st.s))
    .slice(0, max);
}

export const mixToAmbience = (mix: MixStem[]): Ambience =>
  Object.fromEntries(mix.map((m) => [m.s, m.gain])) as Ambience;

/** Matriz a partir do ambiente simples (planos antigos e palavras-chave): o mais alto é essencial. */
export function ambienceToMix(amb: Ambience): MixStem[] {
  return (Object.entries(amb) as [Layer, number][])
    .filter(([, g]) => g > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([s, gain], i) => ({ s, gain, priority: (i === 0 ? 1 : i === 1 ? 2 : 3) as StemPriority }));
}

export function sanitizePlan(o: unknown): ScenePlan | null {
  if (!o || typeof o !== 'object') return null;
  const x = o as Record<string, unknown>;
  let mix: MixStem[] | undefined;
  let ambience: Ambience;
  if (Array.isArray(x.mix)) {
    // formato novo: matriz de mixagem
    mix = normalizeMix(x.mix.map(sanitizeStem).filter((s): s is MixStem => !!s));
    ambience = mixToAmbience(mix);
  } else {
    // formato antigo: { ambience: { rain: 0.5 } }
    const A = (x.ambience && typeof x.ambience === 'object' ? x.ambience : {}) as Record<string, unknown>;
    const amb: Ambience = {};
    LAYERS.forEach((k) => {
      const v = Number(A[k]);
      if (v >= 0.1) amb[k] = Math.min(1, v);
    });
    ambience = Object.fromEntries(
      Object.entries(amb).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 3),
    ) as Ambience;
  }
  const spots = (Array.isArray(x.spots) ? x.spots : []).map(sanitizeSpot).filter((s): s is Spot => !!s).slice(0, 2);
  const plan: ScenePlan = { mood: MOODS.includes(x.mood as Mood) ? (x.mood as Mood) : null, ambience, spots };
  if (mix) plan.mix = mix;
  const L = (x.looks && typeof x.looks === 'object' ? x.looks : {}) as Record<string, unknown>;
  const looks: Partial<Record<Layer, SoundVariant>> = {};
  (Object.keys(ambience) as Layer[]).forEach((k) => {
    const v = sanitizeVariant(L[k]);
    if (v) looks[k] = v;
  });
  if (Object.keys(looks).length) plan.looks = looks;
  return plan;
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

/**
 * Matriz final depois da suavização: mantém prioridade e low-pass do plano,
 * usa os volumes suavizados e inclui (como textura) as camadas que a
 * suavização segurou da cena anterior.
 */
export function mixFromSmoothed(planMix: MixStem[] | undefined, amb: Ambience): MixStem[] {
  const base = new Map((planMix ?? ambienceToMix(amb)).map((m) => [m.s, m]));
  return normalizeMix((Object.entries(amb) as [Layer, number][])
    .filter(([, g]) => g > 0)
    .map(([s, gain]) => ({ ...(base.get(s) ?? { s, priority: 3 as StemPriority }), s, gain })));
}

/**
 * Um único plano para a tela inteira (página cheia): o ambiente é a média
 * das camadas pesada pelo tamanho de cada parágrafo (a cena que domina a
 * página), com no máximo um efeito pontual — o mais forte. Assim o som muda
 * só na virada de página e nunca "adianta" o que a pessoa ainda vai ler.
 */
export function mergeScreen(parts: { plan: ScenePlan; words: number }[]): ScenePlan {
  if (parts.length === 1) return { ...parts[0].plan, spots: parts[0].plan.spots.slice(0, 1) };
  const total = parts.reduce((a, p) => a + Math.max(1, p.words), 0) || 1;
  const amb = new Map<Layer, number>();
  const best = new Map<Layer, MixStem>();
  const looks: Partial<Record<Layer, SoundVariant>> = {};
  const moods = new Map<Mood, number>();
  for (const { plan, words } of parts) {
    const w = Math.max(1, words) / total;
    (Object.entries(plan.ambience) as [Layer, number][]).forEach(([L, g]) => amb.set(L, (amb.get(L) ?? 0) + g * w));
    (plan.mix ?? ambienceToMix(plan.ambience)).forEach((m) => {
      const cur = best.get(m.s);
      if (!cur || m.priority < cur.priority) best.set(m.s, m);
    });
    Object.assign(looks, plan.looks ?? {});
    if (plan.mood) moods.set(plan.mood, (moods.get(plan.mood) ?? 0) + w);
  }
  // camada citada de passagem num parágrafo curto não entra
  const kept = [...amb.entries()].filter(([, g]) => g >= 0.18).sort((a, b) => b[1] - a[1]).slice(0, MAX_STEMS);
  const ambience = Object.fromEntries(kept.map(([L, g]) => [L, Math.round(g * 100) / 100])) as Ambience;
  const mix = normalizeMix(kept.map(([L, g]) => ({ ...(best.get(L) ?? { s: L, priority: 3 as StemPriority }), s: L, gain: Math.round(g * 100) / 100 })));
  const spot = parts.flatMap((p) => p.plan.spots).sort((a, b) => b.w - a.w)[0];
  const mood = [...moods.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const out: ScenePlan = { mood, ambience, spots: spot ? [spot] : [], mix };
  if (Object.keys(looks).length) out.looks = looks;
  return out;
}
