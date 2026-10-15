/**
 * Ritmo de leitura da pessoa (palavras por minuto), aprendido página a
 * página: média móvel exponencial, ignorando páginas puladas (muito rápido)
 * e pausas (muito devagar). Serve para estimar o tempo restante do capítulo.
 */
export const DEFAULT_WPM = 200;
const MIN_WPM = 90;
const MAX_WPM = 600;
/** peso de cada nova medida (as primeiras pesam mais, para aprender rápido) */
const ALPHA = 0.18;

export const wordCount = (s: string) => (s.match(/\S+/g) ?? []).length;

export interface PaceState { wpm: number; samples: number }

/**
 * Registra o tempo gasto numa página. Devolve o novo estado (ou o mesmo, se a
 * medida não for confiável: menos de 12 palavras, menos de 1,5 s ou mais de 6 min).
 */
export function recordPage(state: PaceState, words: number, ms: number): PaceState {
  if (words < 12 || ms < 1500 || ms > 6 * 60_000) return state;
  const wpm = (words / ms) * 60_000;
  if (wpm < MIN_WPM / 2 || wpm > MAX_WPM * 1.5) return state; // pulou a página ou se distraiu
  const a = state.samples < 5 ? 0.5 : ALPHA;
  const next = state.samples ? state.wpm + a * (wpm - state.wpm) : wpm;
  return { wpm: Math.round(Math.max(MIN_WPM, Math.min(MAX_WPM, next))), samples: state.samples + 1 };
}

/** Minutos para ler `words` palavras no ritmo da pessoa (arredonda para cima). */
export const minutesFor = (words: number, wpm: number) => Math.ceil(words / Math.max(MIN_WPM, wpm || DEFAULT_WPM));

export function formatMinutes(min: number): string {
  if (min <= 1) return '< 1 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
