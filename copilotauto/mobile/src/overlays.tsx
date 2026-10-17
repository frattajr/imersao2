/**
 * Silhuetas de enquadramento desenhadas sobre a câmera.
 *
 * Cada guia é desenhada num viewBox 100×160 (proporção de tela em retrato) e
 * escurece tudo fora da área útil com uma máscara, para o usuário entender
 * exatamente onde o componente deve ficar.
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, G, Line, Mask, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { Overlay } from './steps';

const STROKE = '#F5C542';
const W = 100;
const H = 160;

type Shape = { cutout: React.ReactNode; guide: React.ReactNode };

const sw = { stroke: STROKE, strokeWidth: 0.8, fill: 'none' } as const;
const dash = { ...sw, strokeDasharray: '2 1.5' } as const;

const SHAPES: Record<Overlay, Shape> = {
  cap: {
    cutout: <Circle cx={50} cy={78} r={30} fill="black" />,
    guide: <Circle cx={50} cy={78} r={30} {...sw} />,
  },
  reservoir: {
    cutout: <Rect x={22} y={40} width={56} height={76} rx={8} fill="black" />,
    guide: (
      <G>
        <Rect x={22} y={40} width={56} height={76} rx={8} {...sw} />
        <Line x1={26} y1={62} x2={40} y2={62} {...sw} />
        <SvgText x={42} y={64} fill={STROKE} fontSize={5}>MAX</SvgText>
        <Line x1={26} y1={96} x2={40} y2={96} {...sw} />
        <SvgText x={42} y={98} fill={STROKE} fontSize={5}>MIN</SvgText>
      </G>
    ),
  },
  bolts: {
    cutout: <Rect x={8} y={60} width={84} height={36} rx={6} fill="black" />,
    guide: (
      <G>
        <Rect x={8} y={60} width={84} height={36} rx={6} {...dash} />
        {[24, 50, 76].map((cx) => <Circle key={cx} cx={cx} cy={78} r={7} {...sw} />)}
      </G>
    ),
  },
  towers: {
    cutout: (
      <G>
        <Circle cx={28} cy={80} r={18} fill="black" />
        <Circle cx={72} cy={80} r={18} fill="black" />
      </G>
    ),
    guide: (
      <G>
        <Circle cx={28} cy={80} r={18} {...sw} />
        <Circle cx={72} cy={80} r={18} {...sw} />
      </G>
    ),
  },
  rails: {
    cutout: (
      <G>
        <Rect x={14} y={40} width={22} height={80} rx={3} fill="black" />
        <Rect x={64} y={40} width={22} height={80} rx={3} fill="black" />
      </G>
    ),
    guide: (
      <G>
        <Rect x={14} y={40} width={22} height={80} rx={3} {...sw} />
        <Rect x={64} y={40} width={22} height={80} rx={3} {...sw} />
      </G>
    ),
  },
  dot: {
    cutout: <Rect x={18} y={68} width={64} height={22} rx={3} fill="black" />,
    guide: (
      <G>
        <Path d="M -10 140 A 70 70 0 0 1 110 140" {...dash} />
        <Rect x={18} y={68} width={64} height={22} rx={3} {...sw} />
        <SvgText x={50} y={64} fill={STROKE} fontSize={5} textAnchor="middle">DOT ···· SSAA</SvgText>
      </G>
    ),
  },
  tread: {
    cutout: <Rect x={20} y={24} width={60} height={112} rx={10} fill="black" />,
    guide: (
      <G>
        <Rect x={20} y={24} width={60} height={112} rx={10} {...sw} />
        {[38, 50, 62].map((x) => <Line key={x} x1={x} y1={28} x2={x} y2={132} {...dash} />)}
        <Path d="M 82 76 l 6 4 l -6 4 z" fill={STROKE} />
        <SvgText x={89} y={74} fill={STROKE} fontSize={4.5}>TWI</SvgText>
      </G>
    ),
  },
  gap: {
    cutout: <Rect x={10} y={50} width={80} height={60} rx={4} fill="black" />,
    guide: (
      <G>
        <Rect x={10} y={50} width={80} height={60} rx={4} {...dash} />
        <Line x1={14} y1={104} x2={86} y2={56} {...sw} />
        <SvgText x={50} y={46} fill={STROKE} fontSize={4.5} textAnchor="middle">capô ↗ · para-lama ↘</SvgText>
      </G>
    ),
  },
  panel: {
    cutout: <Rect x={4} y={58} width={92} height={44} rx={3} fill="black" />,
    guide: (
      <G>
        <Rect x={4} y={58} width={92} height={44} rx={3} {...dash} />
        <Line x1={8} y1={80} x2={92} y2={80} {...sw} />
        <SvgText x={50} y={54} fill={STROKE} fontSize={4.5} textAnchor="middle">reflexo reto nesta linha</SvgText>
      </G>
    ),
  },
  pedals: {
    cutout: (
      <G>
        <Rect x={18} y={56} width={26} height={44} rx={5} fill="black" />
        <Rect x={56} y={56} width={26} height={44} rx={5} fill="black" />
      </G>
    ),
    guide: (
      <G>
        <Rect x={18} y={56} width={26} height={44} rx={5} {...sw} />
        <Rect x={56} y={56} width={26} height={44} rx={5} {...sw} />
      </G>
    ),
  },
  wheel: {
    cutout: <Circle cx={50} cy={80} r={40} fill="black" />,
    guide: (
      <G>
        <Circle cx={50} cy={80} r={40} {...sw} />
        <Circle cx={50} cy={80} r={31} {...dash} />
        <SvgText x={6} y={82} fill={STROKE} fontSize={5}>9h</SvgText>
        <SvgText x={88} y={82} fill={STROKE} fontSize={5}>3h</SvgText>
      </G>
    ),
  },
  odometer: {
    cutout: <Rect x={14} y={66} width={72} height={26} rx={3} fill="black" />,
    guide: (
      <G>
        <Rect x={14} y={66} width={72} height={26} rx={3} {...sw} />
        <SvgText x={50} y={62} fill={STROKE} fontSize={4.5} textAnchor="middle">km TOTAL (não o parcial)</SvgText>
      </G>
    ),
  },
};

export function CameraOverlay({ kind }: { kind: Overlay }) {
  const shape = SHAPES[kind];
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      pointerEvents="none"
    >
      <Defs>
        <Mask id="hole" x={0} y={0} width={W} height={H}>
          <Rect x={0} y={0} width={W} height={H} fill="white" />
          {shape.cutout}
        </Mask>
      </Defs>
      <Rect x={0} y={0} width={W} height={H} fill="rgba(0,0,0,0.55)" mask="url(#hole)" />
      {shape.guide}
    </Svg>
  );
}
