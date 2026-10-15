/**
 * Plano de som por palavras-chave: funciona sem internet e é o que toca
 * enquanto a IA ainda não respondeu (ou quando ela não está configurada).
 */
import { narration } from './narration';
import type { Ambience, Layer, Mood, ScenePlan, Spot, Surface } from './types';

/**
 * Palavras de cada camada, pelo SENTIDO: "a chama" acende a lareira,
 * "chamou o criado" não; "conversa" não vira vozes de fundo; "olhos
 * escuros" não é noite. (Metáforas, falas e lembranças já saíram antes, em
 * `narration`.)
 */
const M: Record<Layer, RegExp> = {
  wind: /\bvento|ventania|brisa|rajada|vendaval/,
  leaves: /folhagem|folhas (secas|caidas|das arvores|ao vento|farfalh)|\barvores?\b|arvoredo|bosque|floresta|\bmata\b|galhos?\b|trilha|jardim|pomar|carvalho|pinheir|mangueira|coqueir/,
  birds: /passaro|passarinho|pardal|sabia|gorjei|cantar dos|canto dos|andorinha|bem-te-vi|amanhec/,
  rain: /chov|chuva|garoa|goteira|temporal|tempestade|aguaceiro|\bpocas?\b|pingos? de chuva/,
  thunder: /trov|relampag|\braios?\b(?! de sol| de luz)|tempestade/,
  sea: /\bmar\b|\bondas?\b|praia|oceano|maresia|farol|barco|navio|conves|enseada|rebentacao/,
  water: /riacho|\brio\b|cachoeira|correnteza|regato|ribeiro|\blago\b|lagoa|\bfonte\b|chafariz|pingav/,
  fire: /fogueira|lareira|brasas?\b|braseiro|crepit|\b(a|as|uma|das?|nas?|em|pelas?) chamas?\b|labaredas?|\bfogo\b|fogao/,
  cafe: /cafeteria|garcom|xicaras?|espresso|cappuccino|padaria|restaurante|confeitaria|balcao/,
  crowd: /multidao|plateia|\bfeira\b|mercado|\bbaile\b|algazarra|burburinho|vozerio|procissao|\bfesta\b|povareu/,
  city: /cidade|\bruas?\b|carros?\b|transito|avenida|metro\b|predios?\b|buzina|onibus|calcada|\bpraca\b|\blargo\b|bonde|carruage|cocheiro|tilburi/,
  train: /\btrem\b|trilhos|vagao|locomotiva|ferrovia|plataforma|estacao|comboio/,
  night: /\bnoite\b|madrugada|\blua\b|luar|estrelas?\b|breu|escuridao|\bo escuro\b|trevas/,
  cricket: /grilos?\b|cigarras?\b/,
  clock: /tique-?taque|tic-?tac|pendulo|relogio[^.]{0,25}(batia|bateu|soou|soava|batendo|tiquetaque)/,
  tavern: /taberna|taverna|estalagem|hospedaria|bodega|caneca|botequim|tasca/,
  drone: /cadaver|tumulo|catacumba|cripta|necroterio|sepultura|jazigo/,
};

const LAYER_MOOD: Record<Layer, Mood> = {
  rain: 'rain', thunder: 'rain', sea: 'sea', fire: 'fire', leaves: 'forest', birds: 'forest',
  water: 'forest', night: 'night', cricket: 'night', city: 'city', train: 'city', cafe: 'warm',
  crowd: 'warm', wind: 'cold', clock: 'calm', tavern: 'warm', drone: 'tension',
};

/**
 * Efeito pontual só quando o texto narra o SOM acontecendo (verbo de ação),
 * não quando só menciona a coisa: "o cachorro latiu" toca; "o cachorro do
 * vizinho" não. No máximo um efeito por trecho.
 */
function keywordSpots(n: string): Spot[] {
  const sentences = n.split(/(?<=[.!?…;])\s+/).filter(Boolean);
  const t = sentences.join(' ');
  const has = (r: RegExp) => r.test(t);
  /** alguma frase tem o som, sem o que o desmente na mesma frase */
  const hasBut = (r: RegExp, not: RegExp) => sentences.some((x) => r.test(x) && !not.test(x));
  const o: Spot[] = [];
  if (has(/\b(bateram|bateu|batia|batiam|batendo) (a|à|na|com forca na) porta|batidas na porta|toc[- ]toc/)) o.push({ s: 'knock', n: 3, at: 2, w: 0.45 });
  if (has(/porta[^.]{0,30}\b(rangeu|rangia|range|rangendo|se abriu|abriu-se|abriu devagar|bateu|fechou-se com)|(abriu|abriram|empurrou|empurrei) a porta/)) o.push({ s: 'door', kind: 'creak', at: 1.5, w: 0.45 });
  if (hasBut(/\b(rugiu|rugido|rugia|urrou|urro|bramiu|bramido)/, /trov|\bmar\b|vento|tempestade|fogo|chama|motor|ondas/)) o.push({ s: 'roar', at: 2, w: 0.45 });
  if (has(/\b(uivo|uivos|uivou|uivava|uivavam|uivando)\b/)) o.push({ s: 'howl', at: 2, w: 0.35 });
  if (has(/\b(latido|latidos|latiu|latia|latiam|latindo|ladrou|ladrava)\b/)) o.push({ s: 'bark', n: 2, at: 2, w: 0.35 });
  if (has(/coruja (piou|piava|piando)|pio da coruja|piado de coruja/)) o.push({ s: 'owl', at: 2, w: 0.35 });
  if (has(/\b(sineta|campainha) (tocou|tilintou|soou)|tilintar da sineta/)) o.push({ s: 'doorbell', at: 1.5, w: 0.4 });
  else if (has(/\bsinos? (tocou|tocavam|tocava|badal|soou|soavam|dobrav)|badalada/)) o.push({ s: 'bell', at: 1.5, w: 0.4 });
  if (has(/\b(apito|apitou|apitava)\b/)) o.push({ s: 'horn', kind: 'whistle', at: 1.5, w: 0.4 });
  if (has(/galope|galopav|galopando|tropel|trote dos cavalos|cascos (batiam|soavam)/)) o.push({ s: 'hooves', n: 6, pace: 0.35, at: 2, w: 0.4 });
  if (has(/gotas (caiam|pingavam)|goteira|pingava|pingavam|gotejav/)) o.push({ s: 'drip', n: 3, at: 2, w: 0.4 });
  if (has(/caixa de musica (tocava|tocou|comecou)/)) o.push({ s: 'musicbox', at: 2, w: 0.4 });
  if (has(/ronronav|ronronou|ronronando/)) o.push({ s: 'purr', at: 2, w: 0.35 });
  if (has(/(girou|virou|rodou) a chave|chave (na|rangeu na) fechadura|molho de chaves|chaves tilint/)) o.push({ s: 'keys', at: 2, w: 0.35 });
  if (has(/\brajada|ventania (sacudiu|uivou|batia)/)) o.push({ s: 'gust', at: 1.5, w: 0.4 });
  if (has(/coracao (batia|batendo|disparou|martelava)|batidas do (meu )?coracao|ouvia o (proprio )?coracao/)) o.push({ s: 'heartbeat', n: 6, at: 1.5, w: 0.35 });
  if (has(/correntes (arrast|tilint|rangiam)|arrastando correntes|grilhoes|algemas (tilint|batiam)/)) o.push({ s: 'chains', at: 2, w: 0.4 });
  if (has(/\b(rangido|rangeu|rangia|rangiam)\b/) && !o.some((x) => x.s === 'door')) o.push({ s: 'creak', at: 1.5, w: 0.4 });
  if (has(/\bpassos (no|na|pelo|pela|sobre|ecoav|se aproxim|subindo|descendo)|(subiu|desceu|subia|descia) (a|as) escada|degraus rang/)) {
    const surface: Surface = has(/ferro|metal/) ? 'metal'
      : has(/cascalho|pedra|calcada|plataforma/) ? 'stone'
      : has(/neve/) ? 'snow'
      : has(/folhas|trilha|terra|grama/) ? 'grass' : 'wood';
    o.push({ s: 'steps', surface, n: 4, pace: 0.6, at: 2, w: 0.4 });
  }
  return o.slice(0, 1);
}

/** Efeito narrado de um texto já filtrado por `narration` (no máximo um). */
export const keywordSpotsOf = (n: string): Spot[] => keywordSpots(n);

export function analyze(text: string): ScenePlan {
  // só a narração do presente: sem falas, lembranças, metáforas e nomes próprios
  const n = narration(text);
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

/** Nome simples de cada camada (sem ícone), para listas e frases. */
export const LAYER_NAME = Object.fromEntries(
  (Object.entries(LAYER_LABEL) as [Layer, string][]).map(([k, v]) => [k, v.replace(/^\S+\s+/, '')]),
) as Record<Layer, string>;

export const SPOT_LABEL: Record<Spot['s'], string> = {
  steps: '👣 passos', door: '🚪 porta', knock: '✊ batidas', doorbell: '🔔 sininho', keys: '🗝 chaves',
  roar: '🐉 rugido', howl: '🐺 uivo', bark: '🐕 latido', owl: '🦉 coruja', bell: '🔔 sino', horn: '📯 apito',
  hooves: '🐎 cavalo', creak: '🪵 rangido', drip: '💧 gotas', gust: '💨 rajada', rustle: '🧥 tecido',
  purr: '🐈 ronrom', musicbox: '🎶 caixa de música', heartbeat: '🫀 coração', chains: '⛓ correntes',
};

/** Nome simples de cada efeito (sem ícone). */
export const SPOT_NAME = Object.fromEntries(
  (Object.entries(SPOT_LABEL) as [Spot['s'], string][]).map(([k, v]) => [k, v.replace(/^\S+\s+/, '')]),
) as Record<Spot['s'], string>;
