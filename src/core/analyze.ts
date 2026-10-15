/**
 * Plano de som por palavras-chave: funciona sem internet e é o que toca
 * enquanto a IA ainda não respondeu (ou quando ela não está configurada).
 */
import { norm } from './text';
import type { Ambience, Layer, Mood, ScenePlan, Spot, Surface } from './types';

const M: Record<Layer, RegExp> = {
  wind: /vento|ventania|brisa|rajada|assobi/,
  leaves: /folha|folhag|arvore|bosque|floresta|\bmata\b|galho|trilha|jardim|carvalho|pinheiro/,
  birds: /passaro|passarinho|pardal|pombo|sabia|amanhec/,
  rain: /chuv|garoa|goteira|temporal|tempestade|aguaceiro|poca/,
  thunder: /trov|relampag|\braio|tempestade/,
  sea: /\bmar\b|onda|praia|oceano|maresia|farol|barco|navio/,
  water: /riacho|\brio\b|cachoeira|fonte|lago|correnteza|pingav/,
  fire: /fogo|fogueira|chama|lareira|brasa|crepit/,
  cafe: /cafeteria|garcom|xicara|espresso|cappuccino|padaria|restaurante|balcao/,
  crowd: /multidao|festa|mercado|feira|plateia|vozes|conversa|conversav|falavam|risada/,
  city: /cidade|\brua\b|carro|transito|avenida|metro\b|predio|buzina|onibus|calcada/,
  train: /\btrem\b|trilhos|vagao|locomotiva|ferrovia|plataforma|estacao/,
  night: /noite|madrugada|\blua\b|estrela|escur|breu/,
  cricket: /grilo|cigarra/,
  clock: /relogio|pendulo|tic-tac/,
  tavern: /taberna|taverna|estalagem|hospedaria|bodega|caneca|botequim/,
  drone: /pavor|terror|horror|medo|calafrio|arrepi|sinistr|lugubre|macabr|loucura|cadaver|tumulo|catacumba|cripta/,
};

const LAYER_MOOD: Record<Layer, Mood> = {
  rain: 'rain', thunder: 'rain', sea: 'sea', fire: 'fire', leaves: 'forest', birds: 'forest',
  water: 'forest', night: 'night', cricket: 'night', city: 'city', train: 'city', cafe: 'warm',
  crowd: 'warm', wind: 'cold', clock: 'calm', tavern: 'warm', drone: 'tension',
};

function keywordSpots(n: string): Spot[] {
  const o: Spot[] = [];
  const has = (r: RegExp) => r.test(n);
  if (has(/passos|caminhou|andou|subiu|degrau|escada/)) {
    const surface: Surface = has(/ferro|metal/) ? 'metal'
      : has(/cascalho|pedra|calcada|plataforma/) ? 'stone'
      : has(/neve/) ? 'snow'
      : has(/folhas|trilha|terra|grama/) ? 'grass' : 'wood';
    o.push({ s: 'steps', surface, n: 5, pace: 0.6, at: 2, w: 0.5 });
  }
  if (has(/bateu|batidas|bateram/)) o.push({ s: 'knock', n: 3, at: 2, w: 0.5 });
  if (has(/porta/) && has(/rang|abr/)) o.push({ s: 'door', kind: 'creak', at: 1.5, w: 0.5 });
  if (has(/rugi|monstro|fera|dragao|urso|leao/)) o.push({ s: 'roar', at: 2, w: 0.5 });
  if (has(/uivo|uivou|lobo/)) o.push({ s: 'howl', at: 2, w: 0.4 });
  if (has(/latido|latiu|cachorro/)) o.push({ s: 'bark', n: 3, at: 2, w: 0.4 });
  if (has(/coruja/)) o.push({ s: 'owl', at: 2, w: 0.4 });
  if (has(/\bsino/)) o.push({ s: has(/cafe|entrou|porta/) ? 'doorbell' : 'bell', at: 1.5, w: 0.5 });
  if (has(/apito/)) o.push({ s: 'horn', kind: 'whistle', at: 1.5, w: 0.5 });
  if (has(/cavalo|galope|carroca/)) o.push({ s: 'hooves', n: 8, pace: 0.35, at: 2, w: 0.5 });
  if (has(/gotas|goteira|pingav/)) o.push({ s: 'drip', n: 4, at: 2, w: 0.5 });
  if (has(/caixa de musica/)) o.push({ s: 'musicbox', at: 2, w: 0.5 });
  if (has(/ronron/)) o.push({ s: 'purr', at: 2, w: 0.4 });
  if (has(/chave/)) o.push({ s: 'keys', at: 2, w: 0.4 });
  if (has(/rajada|ventania/)) o.push({ s: 'gust', at: 1.5, w: 0.5 });
  if (has(/coracao (batia|bate|pulsa|batendo)|batidas do coracao|pulsacao|batimento/)) o.push({ s: 'heartbeat', n: 8, at: 1.5, w: 0.45 });
  if (has(/corrente|grilh|algema/)) o.push({ s: 'chains', at: 2, w: 0.45 });
  if (has(/rangido|rangeu|rangia/) && !o.some((x) => x.s === 'door')) o.push({ s: 'creak', at: 1.5, w: 0.5 });
  return o.slice(0, 2);
}

export function analyze(text: string): ScenePlan {
  const n = norm(text);
  const count: Partial<Record<Layer, number>> = {};
  (Object.keys(M) as Layer[]).forEach((k) => {
    const m = n.match(new RegExp(M[k].source, 'g'));
    if (m) count[k] = m.length;
  });
  const top = (Object.keys(count) as Layer[]).sort((a, b) => count[b]! - count[a]!).slice(0, 3);
  const ambience: Ambience = {};
  top.forEach((k) => (ambience[k] = Math.min(0.8, 0.4 + 0.15 * count[k]!)));
  return { mood: top.length ? LAYER_MOOD[top[0]] : 'calm', ambience, spots: keywordSpots(n) };
}

/** Cor de fundo (muito leve) para cada clima. */
export const TINT: Record<Mood, string> = {
  rain: '#7f9bb5', sea: '#6fa5ab', fire: '#d19a62', forest: '#7da582', night: '#8683c4',
  city: '#a08fb5', tension: '#b27878', warm: '#d9ae6a', cold: '#a9c7da', calm: '#9a96b0',
};

export const LAYER_LABEL: Record<Layer, string> = {
  wind: '🍃 vento', leaves: '🍂 folhas', birds: '🐦 pássaros', rain: '🌧 chuva', thunder: '⛈ trovão distante',
  sea: '🌊 mar', water: '💧 água corrente', fire: '🔥 lareira', cafe: '☕ café', crowd: '🗣 vozes',
  city: '🏙 cidade', train: '🚆 trem', night: '🌙 noite', cricket: '🦗 grilos', clock: '🕰 relógio',
  tavern: '🍺 taberna', drone: '🌑 tensão',
};

export const SPOT_LABEL: Record<Spot['s'], string> = {
  steps: '👣 passos', door: '🚪 porta', knock: '✊ batidas', doorbell: '🔔 sininho', keys: '🗝 chaves',
  roar: '🐉 rugido', howl: '🐺 uivo', bark: '🐕 latido', owl: '🦉 coruja', bell: '🔔 sino', horn: '📯 apito',
  hooves: '🐎 cavalo', creak: '🪵 rangido', drip: '💧 gotas', gust: '💨 rajada', rustle: '🧥 tecido',
  purr: '🐈 ronrom', musicbox: '🎶 caixa de música', heartbeat: '🫀 coração', chains: '⛓ correntes',
};
