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
  /** superfície sólida (painéis, cartões) e linha fina de separação */
  surface: string; line: string;
  /** cor de destaque (botão principal, opção escolhida) e o texto sobre ela */
  accent: string; onAccent: string; accentSoft: string;
  /** cor dos ícones da barra de status */
  status: 'light' | 'dark';
}

/**
 * Contraste do texto (fg sobre bg) acima de 7:1 em todos os temas (WCAG AAA),
 * sem branco puro sobre preto puro (cansa a vista à noite). Uma só cor de
 * destaque, quente, como luz de vela — o resto é neutro.
 */
export const PALETTES: Record<ThemeName, Palette> = {
  light: { bg: '#fbfaf7', fg: '#1d1b18', mut: '#6b665d', btn: 'rgba(0,0,0,0.06)', card: 'rgba(0,0,0,0.04)', ov: '#f5f3ee', danger: '#a8392c', surface: '#ffffff', line: 'rgba(0,0,0,0.09)', accent: '#8a5212', onAccent: '#ffffff', accentSoft: 'rgba(138,82,18,0.12)', status: 'dark' },
  sepia: { bg: '#f1e7d0', fg: '#3b2f1e', mut: '#715f48', btn: 'rgba(70,45,10,0.08)', card: 'rgba(70,45,10,0.05)', ov: '#ece1c8', danger: '#a24a3c', surface: '#f7efdc', line: 'rgba(70,45,10,0.12)', accent: '#83501a', onAccent: '#fff8ea', accentSoft: 'rgba(131,80,26,0.13)', status: 'dark' },
  gray: { bg: '#2b2d30', fg: '#e3e1dc', mut: '#a3a19b', btn: 'rgba(255,255,255,0.08)', card: 'rgba(255,255,255,0.05)', ov: '#26282b', danger: '#d77a6c', surface: '#34363a', line: 'rgba(255,255,255,0.09)', accent: '#e3bb7d', onAccent: '#24190b', accentSoft: 'rgba(227,187,125,0.16)', status: 'light' },
  dark: { bg: '#131317', fg: '#ebe6dc', mut: '#97938a', btn: 'rgba(255,255,255,0.07)', card: 'rgba(255,255,255,0.045)', ov: '#131317', danger: '#d0786a', surface: '#1c1c22', line: 'rgba(255,255,255,0.08)', accent: '#e2b878', onAccent: '#22180a', accentSoft: 'rgba(226,184,120,0.15)', status: 'light' },
  /** preto absoluto: em telas OLED os pixels pretos ficam apagados (economiza bateria) */
  oled: { bg: '#000000', fg: '#d3cec4', mut: '#86827a', btn: 'rgba(255,255,255,0.08)', card: 'rgba(255,255,255,0.045)', ov: '#000000', danger: '#c06a5c', surface: '#121214', line: 'rgba(255,255,255,0.08)', accent: '#d8ae70', onAccent: '#1d1408', accentSoft: 'rgba(216,174,112,0.15)', status: 'light' },
};
/** "Automático": sépia de dia, escuro das 19h às 7h (sem luz branca à noite). */
export type ThemeChoice = ThemeName | 'auto';
export const THEME_LABEL: Record<ThemeChoice, string> = { dark: 'Escuro', oled: 'Preto', gray: 'Cinza', sepia: 'Sépia', light: 'Claro', auto: 'Auto' };
export const THEME_CHOICES: ThemeChoice[] = ['dark', 'oled', 'gray', 'sepia', 'light', 'auto'];
/** padrão: escuro (mais confortável para ler e para a imersão no som) */
export const DEFAULT_THEME: ThemeChoice = 'dark';
export const isNight = (d = new Date()) => d.getHours() >= 19 || d.getHours() < 7;
export const resolveTheme = (t: ThemeChoice, d = new Date()): ThemeName => (t === 'auto' ? (isNight(d) ? 'dark' : 'sepia') : t);

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

/** tamanho da letra de leitura com 100% (pontos): ~40–45 caracteres por linha num celular */
export const BASE_FONT = 19;
export const SIZES = [0.8, 0.9, 1, 1.1, 1.22, 1.36, 1.5];
export const LINE_HEIGHTS = [1.4, 1.5, 1.6, 1.7, 1.85, 2];
/** espaço entre parágrafos, em múltiplos da altura da linha (estilo "tela"; o estilo livro usa recuo) */
export const PARA_SPACING = [0, 0.4, 0.8, 1.2];
export const PARA_LABEL = ['Juntos', 'Pequeno', 'Médio', 'Grande'];
/** margens laterais, em pontos */
export const MARGINS = [12, 18, 24, 32, 46];
export const MARGIN_LABEL = ['Mínima', 'Estreita', 'Normal', 'Larga', 'Ampla'];

export interface Typography {
  font: ReadingFont;
  lineI: number;
  paraI: number;
  marginI: number;
  /** justificado (com hifenização onde a plataforma tem); no celular, à esquerda lê melhor */
  justify: boolean;
  /** estilo livro: recuo na primeira linha, sem espaço entre parágrafos, abertura de capítulo */
  book: boolean;
  /** animação ao virar a página */
  anim: boolean;
  /** névoa de cor conforme o clima da cena */
  tint: boolean;
}
export const DEFAULT_TYPE: Typography = { font: 'literata', lineI: 2, paraI: 2, marginI: 1, justify: false, book: true, anim: true, tint: true };

/**
 * Um parágrafo por tela (o padrão: foco total e o som acompanhando cada
 * trecho), página cheia (vários parágrafos por tela, como um livro) ou
 * rolagem contínua (o som acompanha o parágrafo visível).
 */
export type ReadingLayout = 'full' | 'pages' | 'scroll';
export const LAYOUT_LABEL: Record<ReadingLayout, string> = { pages: 'Parágrafo', full: 'Página', scroll: 'Rolagem' };
export const LAYOUTS: ReadingLayout[] = ['pages', 'full', 'scroll'];
export const DEFAULT_LAYOUT: ReadingLayout = 'pages';

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
  /** alto-falante do celular ou fone de ouvido */
  output: 'speaker' | 'headphones';
  /** o ambiente "respira": desce devagar depois de alguns minutos na mesma cena */
  breathe: boolean;
  /** estilo escolhido (o último aplicado) */
  preset?: SoundPreset;
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
/** Padrão = "Sutil": ambiente baixo, efeitos raros e baixos, transições suaves. */
export const DEFAULT_SOUND: SoundPrefs = {
  fade: 2, spots: 1, details: 1, auto: true, ambient: 2, sfx: 1, loops: true, focus: false, output: 'speaker', breathe: true, preset: 'sutil',
};

/** Estilos de som (escolhidos na primeira leitura e no painel de som). */
export type SoundPreset = 'sutil' | 'cinema' | 'ambiente' | 'silencio';
export const SOUND_PRESETS: Record<SoundPreset, { label: string; hint: string; icon: 'moon' | 'film' | 'rain' | 'mute'; sound: Partial<SoundPrefs>; volI?: number }> = {
  sutil: { label: 'Sutil', icon: 'moon', hint: 'Ambiente baixinho, efeitos raros. Recomendado.', sound: { fade: 2, spots: 1, details: 1, ambient: 2, sfx: 1, loops: true, focus: false } },
  cinema: { label: 'Cinema', icon: 'film', hint: 'Ambiente presente e efeitos da cena.', sound: { fade: 1, spots: 2, details: 2, ambient: 3, sfx: 2, loops: true, focus: false } },
  ambiente: { label: 'Só ambiente', icon: 'rain', hint: 'Só o som do lugar, sem efeitos.', sound: { fade: 2, spots: 0, details: 1, ambient: 2, sfx: 1, loops: true, focus: false } },
  silencio: { label: 'Silêncio', icon: 'mute', hint: 'Leitura sem som. Dá para mudar depois.', sound: {}, volI: 3 },
};

export function applySoundPrefs(p: SoundPrefs): void {
  const d = DETAIL_LEVELS[p.details] ?? DETAIL_LEVELS[2];
  engine.setUserPrefs({
    fade: (FADE_LEVELS[p.fade] ?? FADE_LEVELS[1]).value,
    spots: (SPOT_LEVELS[p.spots] ?? SPOT_LEVELS[3]).value,
    details: d.gain,
    detailRate: d.rate,
  });
  engine.setComfort({ ambient: LEVELS[p.ambient] ?? 0.5, sfx: LEVELS[p.sfx] ?? 0.25, loops: p.loops, focus: p.focus, output: p.output, breathe: p.breathe });
}

/* ---------- Contexto ---------- */
interface Prefs {
  /** escolha da pessoa (pode ser "auto") */
  theme: ThemeChoice;
  /** tema em uso agora */
  themeNow: ThemeName;
  c: Palette;
  sizeI: number;
  volI: number;
  type: Typography;
  layout: ReadingLayout;
  sound: SoundPrefs;
  setTheme(t: ThemeChoice): void;
  setSize(i: number): void;
  setVol(i: number): void;
  setType(p: Partial<Typography>): void;
  setLayout(l: ReadingLayout): void;
  setSound(p: Partial<SoundPrefs>): void;
  /** aplica um estilo de som (e o volume, no "Silêncio") */
  applyPreset(p: SoundPreset): void;
}

const Ctx = createContext<Prefs | null>(null);
const clampI = (i: number, n: number) => Math.max(0, Math.min(n - 1, Math.round(i)));

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeS] = useState<ThemeChoice>(DEFAULT_THEME);
  // "automático": confere a hora a cada minuto
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (theme !== 'auto') return;
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, [theme]);
  const themeNow = resolveTheme(theme, now);
  const [sizeI, setSizeS] = useState(2);
  const [volI, setVolS] = useState(1);
  const [type, setTypeS] = useState<Typography>(DEFAULT_TYPE);
  const [layout, setLayoutS] = useState<ReadingLayout>(DEFAULT_LAYOUT);
  const [sound, setSoundS] = useState<SoundPrefs>(DEFAULT_SOUND);

  useEffect(() => {
    void (async () => {
      const repo = await getRepo();
      const [t0, s, v, ty, l0, sp, ui] = await Promise.all(['theme', 'size2', 'vol', 'type', 'layout', 'sound', 'ui:v2'].map((k) => repo.kvGet(k)));
      // visual novo: todo mundo começa uma vez no escuro e no modo parágrafo; depois vale a escolha da pessoa
      const t = ui ? t0 : DEFAULT_THEME;
      const l = ui ? l0 : DEFAULT_LAYOUT;
      if (!ui) await Promise.all([repo.kvSet('theme', DEFAULT_THEME), repo.kvSet('layout', DEFAULT_LAYOUT), repo.kvSet('ui:v2', '1')]);
      if (t && (t in PALETTES || t === 'auto')) setThemeS(t as ThemeChoice);
      if (s !== null) setSizeS(clampI(Number(s), SIZES.length));
      if (v !== null) setVolS(clampI(Number(v), VOLUMES.length));
      if (l === 'pages' || l === 'scroll' || l === 'full') setLayoutS(l);
      try { if (ty) setTypeS({ ...DEFAULT_TYPE, ...(JSON.parse(ty) as Partial<Typography>) }); } catch { /* corrompido: padrão */ }
      try { if (sp) setSoundS({ ...DEFAULT_SOUND, ...(JSON.parse(sp) as Partial<SoundPrefs>) }); } catch { /* corrompido: padrão */ }
    })();
  }, []);

  useEffect(() => { applySoundPrefs(sound); }, [sound]);
  // volume geral (antes era salvo mas não chegava ao motor)
  useEffect(() => { engine.setVolume(VOLUMES[volI] ?? 0.7); }, [volI]);

  const value = useMemo<Prefs>(() => {
    const save = (k: string, v: string) => void getRepo().then((r) => r.kvSet(k, v));
    return {
      theme, themeNow, c: PALETTES[themeNow], sizeI, volI, type, layout, sound,
      setTheme: (t) => { setThemeS(t); save('theme', t); },
      setSize: (i) => { const x = clampI(i, SIZES.length); setSizeS(x); save('size2', String(x)); },
      setVol: (i) => { setVolS(i); save('vol', String(i)); },
      setType: (p) => setTypeS((cur) => { const next = { ...cur, ...p }; save('type', JSON.stringify(next)); return next; }),
      setLayout: (l) => { setLayoutS(l); save('layout', l); },
      setSound: (p) => setSoundS((cur) => { const next = { ...cur, ...p }; save('sound', JSON.stringify(next)); return next; }),
      applyPreset: (k) => {
        const pr = SOUND_PRESETS[k];
        setSoundS((cur) => { const next = { ...cur, ...pr.sound, preset: k }; save('sound', JSON.stringify(next)); return next; });
        // sair do "Silêncio" devolve o volume médio
        const v = pr.volI ?? (volI === 3 ? 1 : volI);
        setVolS(v); save('vol', String(v));
      },
    };
  }, [theme, themeNow, sizeI, volI, type, layout, sound]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePrefs fora do PrefsProvider');
  return v;
}
