import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { engine } from '../audio';
import { getRepo } from '../state/db';

export type ThemeName = 'dark' | 'sepia';

export interface Palette {
  bg: string; fg: string; mut: string; btn: string; card: string; ov: string; danger: string;
}

export const PALETTES: Record<ThemeName, Palette> = {
  dark: { bg: '#15151a', fg: '#e9e5da', mut: '#9a968c', btn: 'rgba(255,255,255,0.09)', card: 'rgba(255,255,255,0.05)', ov: '#121216', danger: '#b05050' },
  sepia: { bg: '#efe6d3', fg: '#3a3126', mut: '#7d7261', btn: 'rgba(60,45,20,0.09)', card: 'rgba(60,45,20,0.06)', ov: '#e9dfca', danger: '#a24a3c' },
};

export const SIZES = [0.85, 1, 1.15, 1.3, 1.5];
export const VOLUMES = [0.35, 0.7, 1, 0];
export const VOLUME_ICON = ['🔈', '🔉', '🔊', '🔇'];

/** Configurações de som (tela Configurações). Cada uma é um índice nas listas abaixo. */
export interface SoundPrefs {
  /** suavidade das transições */
  fade: number;
  /** volume dos sons da história (passos, portas…) */
  spots: number;
  /** frequência dos detalhes de ambiente (rangidos, gotas…) */
  details: number;
  /** suavização automática quando a cena muda muito */
  auto: boolean;
}
export const FADE_LEVELS = [
  { label: 'Rápida', value: 0.6 }, { label: 'Normal', value: 1 }, { label: 'Suave', value: 1.7 }, { label: 'Muito suave', value: 2.6 },
];
export const SPOT_LEVELS = [
  { label: 'Desligados', value: 0 }, { label: 'Baixos', value: 0.45 }, { label: 'Médios', value: 0.75 }, { label: 'Altos', value: 1 },
];
export const DETAIL_LEVELS = [
  { label: 'Desligados', rate: 0, gain: 0 }, { label: 'Raros', rate: 0.5, gain: 0.8 }, { label: 'Normais', rate: 1, gain: 1 }, { label: 'Frequentes', rate: 1.7, gain: 1 },
];
export const DEFAULT_SOUND: SoundPrefs = { fade: 1, spots: 2, details: 2, auto: true };

export function applySoundPrefs(p: SoundPrefs): void {
  const d = DETAIL_LEVELS[p.details] ?? DETAIL_LEVELS[2];
  engine.setUserPrefs({
    fade: (FADE_LEVELS[p.fade] ?? FADE_LEVELS[1]).value,
    spots: (SPOT_LEVELS[p.spots] ?? SPOT_LEVELS[2]).value,
    details: d.gain,
    detailRate: d.rate,
  });
}

export const FONTS = {
  serif: 'Literata_400Regular',
  serifMedium: 'Literata_500Medium',
  ui: 'Nunito_600SemiBold',
  uiBold: 'Nunito_800ExtraBold',
};

interface Prefs {
  theme: ThemeName;
  c: Palette;
  sizeI: number;
  volI: number;
  setTheme(t: ThemeName): void;
  setSize(i: number): void;
  setVol(i: number): void;
  sound: SoundPrefs;
  setSound(p: Partial<SoundPrefs>): void;
}

const Ctx = createContext<Prefs | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeS] = useState<ThemeName>('dark');
  const [sizeI, setSizeS] = useState(1);
  const [volI, setVolS] = useState(1);
  const [sound, setSoundS] = useState<SoundPrefs>(DEFAULT_SOUND);

  useEffect(() => {
    void (async () => {
      const repo = await getRepo();
      const t = await repo.kvGet('theme');
      const s = await repo.kvGet('size');
      const v = await repo.kvGet('vol');
      if (t === 'dark' || t === 'sepia') setThemeS(t);
      if (s !== null) setSizeS(Math.max(0, Math.min(SIZES.length - 1, Number(s))));
      if (v !== null) setVolS(Math.max(0, Math.min(VOLUMES.length - 1, Number(v))));
      try {
        const sp = await repo.kvGet('sound');
        if (sp) setSoundS({ ...DEFAULT_SOUND, ...(JSON.parse(sp) as Partial<SoundPrefs>) });
      } catch { /* preferência corrompida: usa o padrão */ }
    })();
  }, []);

  useEffect(() => { applySoundPrefs(sound); }, [sound]);

  const value = useMemo<Prefs>(() => {
    const save = (k: string, v: string) => void getRepo().then((r) => r.kvSet(k, v));
    return {
      theme, c: PALETTES[theme], sizeI, volI,
      setTheme: (t) => { setThemeS(t); save('theme', t); },
      setSize: (i) => { const x = Math.max(0, Math.min(SIZES.length - 1, i)); setSizeS(x); save('size', String(x)); },
      setVol: (i) => { setVolS(i); save('vol', String(i)); },
      sound,
      setSound: (p) => setSoundS((cur) => { const next = { ...cur, ...p }; save('sound', JSON.stringify(next)); return next; }),
    };
  }, [theme, sizeI, volI, sound]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePrefs fora do PrefsProvider');
  return v;
}
