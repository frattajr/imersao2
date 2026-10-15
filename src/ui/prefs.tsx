import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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
}

const Ctx = createContext<Prefs | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeS] = useState<ThemeName>('dark');
  const [sizeI, setSizeS] = useState(1);
  const [volI, setVolS] = useState(1);

  useEffect(() => {
    void (async () => {
      const repo = await getRepo();
      const t = await repo.kvGet('theme');
      const s = await repo.kvGet('size');
      const v = await repo.kvGet('vol');
      if (t === 'dark' || t === 'sepia') setThemeS(t);
      if (s !== null) setSizeS(Math.max(0, Math.min(SIZES.length - 1, Number(s))));
      if (v !== null) setVolS(Math.max(0, Math.min(VOLUMES.length - 1, Number(v))));
    })();
  }, []);

  const value = useMemo<Prefs>(() => {
    const save = (k: string, v: string) => void getRepo().then((r) => r.kvSet(k, v));
    return {
      theme, c: PALETTES[theme], sizeI, volI,
      setTheme: (t) => { setThemeS(t); save('theme', t); },
      setSize: (i) => { const x = Math.max(0, Math.min(SIZES.length - 1, i)); setSizeS(x); save('size', String(x)); },
      setVol: (i) => { setVolS(i); save('vol', String(i)); },
    };
  }, [theme, sizeI, volI]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePrefs fora do PrefsProvider');
  return v;
}
