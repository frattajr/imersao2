import type { Status } from './types';

export const colors = {
  bg: '#0F1115',
  surface: '#191C22',
  line: '#2A2F38',
  text: '#F2F3F5',
  muted: '#A3A9B4',
  accent: '#F5C542',
  onAccent: '#14161A',
};

export const STATUS: Record<Status, { color: string; label: string }> = {
  GREEN: { color: '#3DBE7A', label: 'Sem indícios visuais' },
  YELLOW: { color: '#F5C542', label: 'Atenção' },
  RED: { color: '#F0605D', label: 'Indício relevante' },
  INCONCLUSIVE: { color: '#8C93A0', label: 'Inconclusivo' },
};

export const brl = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR');
