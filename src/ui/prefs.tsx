/**
 * Preferências da pessoa: tema, tipografia de leitura, modo de leitura e
 * conforto acústico. Guardadas no banco local (chave-valor) e aplicadas ao
 * motor de som assim que mudam.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { engine } from '../audio';
import { getRepo } from '../state/db';

/* ---------- Temas ---------- */
export type ThemeName = 'light' | 'sepia' | 'gray' | 'dark' | 'oled';

export interface Palette {
  bg: string; fg: string; mut: string; btn: string; card: string; ov: string; danger: string;
  /** cor dos ícones da barra de status */
  status: 'light' | 'dark';
}

/**
 * Contraste do texto (fg sobre bg) acima de 7:1 em todos os temas (WCAG AAA),
 * sem branco puro sobre preto puro (cansa a vista à noite).
 */
export const PALETTES: Record<ThemeName, Palette> = {
  light: { bg: '#fbfaf7', fg: '#1d1b18', mut: '#6b665d', btn: 'rgba(0,0,0,0.07)', card: 'rgba(0,0,0,0.045)', ov: '#f3f1ec', danger: '#a8392c', status: 'dark' },
  sepia: { bg: '#f1e7d0', fg: '#3b2f1e', mut: '#7a6a52', btn: 'rgba(70,45,10,0.09)', card: 'rgba(70,45,10,0.06)', ov: '#eadfc4', danger: '#a24a3c', status: 'dark' },
  gray: { bg: '#2b2d30', fg: '#e3e1dc', mut: '#a3a19b', btn: 'rgba(255,255,255,0.09)', card: 'rgba(255,255,255,0.05)', ov: '#25272a', danger: '#d77a6c', status: 'light' },
  dark: { bg: '#15151a', fg: '#e9e5da', mut: '#9a968c', btn: 'rgba(255,255,255,0.09)', card: 'rgba(255,255,255,0.05)', ov: '#121216', danger: '#b05050', status: 'light' },
  /** preto absoluto: em telas OLED os pixels pretos ficam apagados (economiza bateria) */
  oled: { bg: '#000000', fg: '#cfcac0', mut: '#86827a', btn: 'rgba(255,255,255,0.08)', card: 'rgba(255,255,255,0.04)', ov: '#000000', danger: '#c06a5c', status: 'light' },
};
export const THEME_LABEL: Record<ThemeName, string> = { light: '☀ Claro', sepia: '📜 Sépia', gray: '◐ Cinza foco', dark: '☾ Escuro', oled: '● Preto OLED' };

/* ---------- Tipografia ---------- */
export const FONTS = {
  serif: 'Literata_400Regular',
  serifMedium: 'Literata_500Medium',
  ui: 'Nunito_600SemiBold',
  uiBold: 'Nunito_800ExtraBold',
};

/**
 * Fontes de leitura para telas pequenas. Bookerly é exclusiva da Amazon (não
 * pode ser distribuída); no lugar dela: Literata (feita para leitura digital),
 * Merriweather (serifada de alto contraste) e Atkinson Hyperlegible
 * (sem serifa, criada para baixa visão).
 */
export type ReadingFont = 'literata' | 'merriweather' | 'atkinson';
export const READING_FONTS: Record<ReadingFont, { label: string; regular: string; bold: string }> = {
  literata: { label: 'Literata', regular: 'Literata_400Regular', bold: 'Literata_500Medium' },
  merriweather: { label: 'Merriweather', regular: 'Merriweather_400Regular', bold: 'Merriweather_700Bold' },
  atkinson: { label: 'Atkinson', regular: 'AtkinsonHyperlegible_400Regular', bold: 'AtkinsonHyperlegible_700Bold' },
};

export const SIZES = [0.8, 0.9, 1, 1.1, 1.22, 1.36, 1.5];
export const LINE_HEIGHTS = [1.4, 1.55, 1.7, 1.85, 2];
/** espaço entre parágrafos, em múltiplos da altura da linha */
export const PARA_SPACING = [0, 0.4, 0.8, 1.2];
/** margens laterais, em pontos */
export const MARGINS = [14, 22, 32, 46];

export interface Typography {
  font: ReadingFont;
  lineI: number;
  paraI: number;
  marginI: number;
  justify: boolean;
}
export const DEFAULT_TYPE: Typography = { font: 'literata', lineI: 2, paraI: 2, marginI: 1, justify: true };

/** Páginas (toque/deslize) ou rolagem contínua (o som acompanha o parágrafo visível). */
export type ReadingLayout = 'pages' | 'scroll';

/* ---------- Som ---------- */
export const VOLUMES = [0.35, 0.7, 1, 0];
export const VOLUME_ICON = ['🔈', '🔉', '🔊', '🔇'];
export const LEVELS = [0, 0.25, 0.5, 0.75, 1];

/** Configurações de som. Índices nas listas abaixo, exceto os booleanos. */
export interface SoundPrefs {
  /** suavidade das transições */
  fade: number;
  /** volume dos sons da história (passos, portas…) — legado, ver `sfx` */
  spots: number;
  /** frequência dos detalhes de ambiente (rangidos, gotas…) */
  details: number;
  /** suavização automática quando a cena muda muito */
  auto: boolean;
  /** volume do ambiente (stems), índice em LEVELS */
  ambient: number;
  /** volume dos efeitos pontuais, índice em LEVELS */
  sfx: number;
  /** loops de ambiente ligados */
  loops: boolean;
  /** modo foco: só o essencial, abafado, sem efeitos */
  focus: boolean;
}
export const FADE_LEVELS = [
  { label: 'Rápida', value: 0.6 }, { label: 'Normal', value: 1 }, { label: 'Suave', value: 1.4 }, { label: 'Muito suave', value: 1.8 },
];
export const SPOT_LEVELS = [
  { label: 'Desligados', value: 0 }, { label: 'Baixos', value: 0.45 }, { label: 'Médios', value: 0.75 }, { label: 'Altos', value: 1 },
];
export const DETAIL_LEVELS = [
  { label: 'Desligados', rate: 0, gain: 0 }, { label: 'Raros', rate: 0.5, gain: 0.8 }, { label: 'Normais', rate: 1, gain: 1 }, { label: 'Frequentes', rate: 1.7, gain: 1 },
];
export const DEFAULT_SOUND: SoundPrefs = { fade: 1, spots: 3, details: 2, auto: true, ambient: 3, sfx: 3, loops: true, focus: false };

export function applySoundPrefs(p: SoundPrefs): void {
  const d = DETAIL_LEVELS[p.details] ?? DETAIL_LEVELS[2];
  engine.setUserPrefs({
    fade: (FADE_LEVELS[p.fade] ?? FADE_LEVELS[1]).value,
    spots: (SPOT_LEVELS[p.spots] ?? SPOT_LEVELS[3]).value,
    details: d.gain,
    detailRate: d.rate,
  });
  engine.setComfort({ ambient: LEVELS[p.ambient] ?? 0.75, sfx: LEVELS[p.sfx] ?? 0.75, loops: p.loops, focus: p.focus });
}

/* ---------- Contexto ---------- */
interface Prefs {
  theme: ThemeName;
  c: Palette;
  sizeI: number;
  volI: number;
  type: Typography;
  layout: ReadingLayout;
  sound: SoundPrefs;
  setTheme(t: ThemeName): void;
  setSize(i: number): void;
  setVol(i: number): void;
  setType(p: Partial<Typography>): void;
  setLayout(l: ReadingLayout): void;
  setSound(p: Partial<SoundPrefs>): void;
}

const Ctx = createContext<Prefs | null>(null);
const clampI = (i: number, n: number) => Math.max(0, Math.min(n - 1, Math.round(i)));

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeS] = useState<ThemeName>('dark');
  const [sizeI, setSizeS] = useState(2);
  const [volI, setVolS] = useState(1);
  const [type, setTypeS] = useState<Typography>(DEFAULT_TYPE);
  const [layout, setLayoutS] = useState<ReadingLayout>('pages');
  const [sound, setSoundS] = useState<SoundPrefs>(DEFAULT_SOUND);

  useEffect(() => {
    void (async () => {
      const repo = await getRepo();
      const [t, s, v, ty, l, sp] = await Promise.all(['theme', 'size2', 'vol', 'type', 'layout', 'sound'].map((k) => repo.kvGet(k)));
      if (t && t in PALETTES) setThemeS(t as ThemeName);
      if (s !== null) setSizeS(clampI(Number(s), SIZES.length));
      if (v !== null) setVolS(clampI(Number(v), VOLUMES.length));
      if (l === 'pages' || l === 'scroll') setLayoutS(l);
      try { if (ty) setTypeS({ ...DEFAULT_TYPE, ...(JSON.parse(ty) as Partial<Typography>) }); } catch { /* corrompido: padrão */ }
      try { if (sp) setSoundS({ ...DEFAULT_SOUND, ...(JSON.parse(sp) as Partial<SoundPrefs>) }); } catch { /* corrompido: padrão */ }
    })();
  }, []);

  useEffect(() => { applySoundPrefs(sound); }, [sound]);

  const value = useMemo<Prefs>(() => {
    const save = (k: string, v: string) => void getRepo().then((r) => r.kvSet(k, v));
    return {
      theme, c: PALETTES[theme], sizeI, volI, type, layout, sound,
      setTheme: (t) => { setThemeS(t); save('theme', t); },
      setSize: (i) => { const x = clampI(i, SIZES.length); setSizeS(x); save('size2', String(x)); },
      setVol: (i) => { setVolS(i); save('vol', String(i)); },
      setType: (p) => setTypeS((cur) => { const next = { ...cur, ...p }; save('type', JSON.stringify(next)); return next; }),
      setLayout: (l) => { setLayoutS(l); save('layout', l); },
      setSound: (p) => setSoundS((cur) => { const next = { ...cur, ...p }; save('sound', JSON.stringify(next)); return next; }),
    };
  }, [theme, sizeI, volI, type, layout, sound]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePrefs fora do PrefsProvider');
  return v;
}
