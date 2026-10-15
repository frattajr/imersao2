/**
 * Ícones de traço fino, iguais em todos os aparelhos (emoji muda de desenho
 * conforme o sistema e pesa no visual). Desenhos do Lucide (licença ISC),
 * em 24×24.
 */
import { memo } from 'react';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

type Shape =
  | { p: string }
  | { c: [number, number, number] }
  | { l: [number, number, number, number] }
  | { pl: string }
  | { pg: string }
  | { r: [number, number, number, number, number] };

const ICONS = {
  back: [{ p: 'm15 18-6-6 6-6' }],
  next: [{ p: 'm9 18 6-6-6-6' }],
  down: [{ p: 'm6 9 6 6 6-6' }],
  close: [{ p: 'M18 6 6 18' }, { p: 'm6 6 12 12' }],
  search: [{ c: [11, 11, 8] }, { p: 'm21 21-4.3-4.3' }],
  settings: [
    { l: [21, 4, 14, 4] }, { l: [10, 4, 3, 4] }, { l: [21, 12, 12, 12] }, { l: [8, 12, 3, 12] }, { l: [21, 20, 16, 20] },
    { l: [12, 20, 3, 20] }, { l: [14, 2, 14, 6] }, { l: [8, 10, 8, 14] }, { l: [16, 18, 16, 22] },
  ],
  bookmark: [{ p: 'm19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z' }],
  type: [{ pl: '4 7 4 4 20 4 20 7' }, { l: [9, 20, 15, 20] }, { l: [12, 4, 12, 20] }],
  headphones: [{ p: 'M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3' }],
  list: [{ l: [8, 6, 21, 6] }, { l: [8, 12, 21, 12] }, { l: [8, 18, 21, 18] }, { l: [3, 6, 3.01, 6] }, { l: [3, 12, 3.01, 12] }, { l: [3, 18, 3.01, 18] }],
  book: [{ p: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z' }, { p: 'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z' }],
  notebook: [{ p: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20' }],
  play: [{ pg: '6 3 20 12 6 21 6 3' }],
  stop: [{ r: [6, 6, 12, 12, 2] }],
  plus: [{ p: 'M5 12h14' }, { p: 'M12 5v14' }],
  check: [{ p: 'M20 6 9 17l-5-5' }],
  info: [{ c: [12, 12, 10] }, { p: 'M12 16v-4' }, { p: 'M12 8h.01' }],
  download: [{ p: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }, { pl: '7 10 12 15 17 10' }, { l: [12, 15, 12, 3] }],
  share: [{ p: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8' }, { pl: '16 6 12 2 8 6' }, { l: [12, 2, 12, 15] }],
  copy: [{ r: [8, 8, 14, 14, 2] }, { p: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' }],
  mute: [{ pg: '11 5 6 9 2 9 2 15 6 15 11 19 11 5' }, { l: [22, 9, 16, 15] }, { l: [16, 9, 22, 15] }],
  volume: [{ pg: '11 5 6 9 2 9 2 15 6 15 11 19 11 5' }, { p: 'M15.54 8.46a5 5 0 0 1 0 7.07' }, { p: 'M19.07 4.93a10 10 0 0 1 0 14.14' }],
  moon: [{ p: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z' }],
  sun: [
    { c: [12, 12, 4] }, { p: 'M12 2v2' }, { p: 'M12 20v2' }, { p: 'm4.93 4.93 1.41 1.41' }, { p: 'm17.66 17.66 1.41 1.41' },
    { p: 'M2 12h2' }, { p: 'M20 12h2' }, { p: 'm6.34 17.66-1.41 1.41' }, { p: 'm19.07 4.93-1.41 1.41' },
  ],
  film: [
    { r: [3, 3, 18, 18, 2] }, { p: 'M7 3v18' }, { p: 'M3 7.5h4' }, { p: 'M3 12h18' }, { p: 'M3 16.5h4' }, { p: 'M17 3v18' },
    { p: 'M17 7.5h4' }, { p: 'M17 16.5h4' },
  ],
  rain: [{ p: 'M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242' }, { p: 'M16 14v6' }, { p: 'M8 14v6' }, { p: 'M12 16v6' }],
  phone: [{ r: [5, 2, 14, 20, 2] }, { p: 'M12 18h.01' }],
  flame: [{ p: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z' }],
  clock: [{ c: [12, 12, 10] }, { pl: '12 6 12 12 16 14' }],
  pen: [{ p: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z' }],
  upload: [{ p: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }, { p: 'M14 2v4a2 2 0 0 0 2 2h4' }, { p: 'M12 12v6' }, { p: 'm15 15-3-3-3 3' }],
  write: [{ p: 'M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' }, { p: 'M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z' }],
  sparkle: [{ p: 'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z' }],
  target: [{ c: [12, 12, 10] }, { c: [12, 12, 6] }, { c: [12, 12, 2] }],
  flag: [{ p: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z' }, { l: [4, 22, 4, 15] }],
  retry: [{ p: 'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8' }, { p: 'M21 3v5h-5' }],
  trash: [{ p: 'M3 6h18' }, { p: 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' }, { p: 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' }],
  translate: [{ p: 'm5 8 6 6' }, { p: 'm4 14 6-6 2-3' }, { p: 'M2 5h12' }, { p: 'M7 2h1' }, { p: 'm22 22-5-10-5 10' }, { p: 'M14 18h6' }],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof ICONS;

/** Formas cheias (o resto é só contorno). */
const FILLED = new Set<IconName>(['play', 'stop']);

export const Icon = memo(function Icon({ name, size = 22, color, filled, strokeWidth = 1.8 }: {
  name: IconName; size?: number; color: string;
  /** preenche o desenho (ex.: marcador ativo) */
  filled?: boolean; strokeWidth?: number;
}) {
  const fill = filled || FILLED.has(name) ? color : 'none';
  const k = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false} pointerEvents="none">
      {(ICONS[name] as Shape[]).map((s, i) => {
        if ('p' in s) return <Path key={i} d={s.p} {...k} />;
        if ('c' in s) return <Circle key={i} cx={s.c[0]} cy={s.c[1]} r={s.c[2]} {...k} />;
        if ('l' in s) return <Line key={i} x1={s.l[0]} y1={s.l[1]} x2={s.l[2]} y2={s.l[3]} {...k} fill="none" />;
        if ('pl' in s) return <Polyline key={i} points={s.pl} {...k} fill="none" />;
        if ('pg' in s) return <Polygon key={i} points={s.pg} {...k} />;
        return <Rect key={i} x={s.r[0]} y={s.r[1]} width={s.r[2]} height={s.r[3]} rx={s.r[4]} {...k} />;
      })}
    </Svg>
  );
});
