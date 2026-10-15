/**
 * Visual limpo: escuro e modo parágrafo como padrão, contraste das cores
 * (texto, destaque, capas) e vitrine sem livros repetidos.
 */
jest.mock('../src/audio', () => ({ engine: { setUserPrefs: jest.fn(), setComfort: jest.fn(), setVolume: jest.fn() } }));
jest.mock('../src/state/db', () => ({ getRepo: jest.fn() }));

import { shelfRows } from '../src/core/catalog';
import type { Mood } from '../src/core/types';
import { COVER_ART } from '../src/ui/Cover';
import { DEFAULT_LAYOUT, DEFAULT_THEME, LAYOUTS, PALETTES, resolveTheme, THEME_CHOICES, type ThemeName } from '../src/ui/prefs';

function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('padrões do visual', () => {
  it('abre no escuro e no modo parágrafo', () => {
    expect(DEFAULT_THEME).toBe('dark');
    expect(DEFAULT_LAYOUT).toBe('pages');
    expect(LAYOUTS[0]).toBe('pages');
    expect(THEME_CHOICES[0]).toBe('dark');
    expect(resolveTheme(DEFAULT_THEME, new Date(2026, 0, 1, 12))).toBe('dark');
  });
});

describe('contraste das cores', () => {
  const themes = Object.keys(PALETTES) as ThemeName[];
  it.each(themes)('%s: texto AAA, secundário e destaque AA', (t) => {
    const p = PALETTES[t];
    expect(contrast(p.fg, p.bg)).toBeGreaterThanOrEqual(7);
    expect(contrast(p.fg, p.surface)).toBeGreaterThanOrEqual(7);
    expect(contrast(p.mut, p.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.accent, p.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.accent, p.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.onAccent, p.accent)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(Object.keys(COVER_ART) as Mood[])('capa %s: título legível sobre o fundo', (m) => {
    for (const bg of COVER_ART[m].colors) expect(contrast('#f3eee4', bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('vitrine sem repetição', () => {
  const b = (...ids: string[]) => ids.map((id) => ({ id }));
  it('cada livro aparece numa fileira editorial só, e nunca repete o destaque', () => {
    const rows = shelfRows([
      { key: 'a', items: b('h', '1', '2', '3') },
      { key: 'b', items: b('1', '2', '3', '4', '5', '6') },
    ], { hero: 'h' });
    expect(rows.map((r) => r.items.map((i) => i.id))).toEqual([['1', '2', '3'], ['4', '5', '6']]);
  });
  it('fileira que fica com poucos livros novos some', () => {
    const rows = shelfRows([
      { key: 'a', items: b('1', '2', '3') },
      { key: 'b', items: b('1', '2', '3', '4') },
    ]);
    expect(rows.map((r) => r.key)).toEqual(['a']);
  });
  it('fileiras pessoais repetem à vontade e não "gastam" livros', () => {
    const rows = shelfRows([
      { key: 'continuar', items: b('1'), min: 1, personal: true },
      { key: 'a', items: b('1', '2', '3') },
    ]);
    expect(rows.map((r) => r.key)).toEqual(['continuar', 'a']);
    expect(rows[1].items.map((i) => i.id)).toEqual(['1', '2', '3']);
  });
  it('no máximo N fileiras de clima; fileira "sempre" aparece vazia', () => {
    const rows = shelfRows([
      { key: 'chuva', items: b('1', '2', '3'), climate: true },
      { key: 'mar', items: b('4', '5', '6'), climate: true },
      { key: 'noite', items: b('7', '8', '9'), climate: true },
      { key: 'meus', items: [], always: true, personal: true },
    ], { maxClimate: 2 });
    expect(rows.map((r) => r.key)).toEqual(['chuva', 'mar', 'meus']);
  });
});
