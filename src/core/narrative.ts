/**
 * Mapa de cenas do livro: o som acompanha a HISTÓRIA, não palavras soltas.
 *
 * 1. O livro é dividido em cenas: capítulos, separadores (* * *), saltos de
 *    tempo ("No dia seguinte", "Dias depois") e mudanças de lugar
 *    ESTABELECIDAS pela narração ("entramos na sala", "saiu para a rua",
 *    "chegaram à praia") — citar um lugar não basta.
 * 2. Cada cena tem um estado que PERSISTE até ser substituído: lugar,
 *    hora (dia / noite), tempo (chuva, tempestade, vento) e se há lareira.
 *    Se a cena começou junto à lareira, a lareira continua mesmo que o texto
 *    não fale mais dela.
 * 3. O ambiente de cada cena sai desse estado (`bedFor`): um quarto em noite
 *    de chuva tem chuva abafada lá fora; a rua do Rio de 1880 tem carroças,
 *    não carros (época do livro).
 * 4. A tensão vem do RITMO do texto (frases curtas, exclamações, perigo) e
 *    deixa o ambiente mais escuro e próximo — em vez de ligar um som a cada
 *    "medo".
 *
 * Só usa a narração do presente (sem falas, lembranças nem metáforas).
 * Roda no aparelho, sem IA; o resultado é o plano das páginas que não têm
 * plano calibrado nem da IA.
 */
import type { SoundVariant } from '../../supabase/functions/_shared/sound-library';
import { keywordSpotsOf } from './analyze';
import { headingOf } from './chapters';
import { narration } from './narration';
import { mixToAmbience, normalizeMix } from './plan';
import type { Layer, MixStem, Mood, ScenePlan, StemPriority } from './types';

export type Locale =
  | 'interior' | 'rua' | 'natureza' | 'sertao' | 'mar' | 'agua' | 'taverna' | 'igreja' | 'multidao' | 'estacao' | 'ferrovia' | 'cemiterio' | 'prisao';
export type TimeOfDay = 'dia' | 'noite';
export type Weather = 'chuva' | 'tempestade' | 'vento' | 'limpo';

export interface SceneInfo {
  start: number;
  end: number;
  /** primeira cena de um capítulo */
  chapter: boolean;
  locale?: Locale;
  time?: TimeOfDay;
  weather?: Weather;
  fire: boolean;
}

export interface SceneMap {
  scenes: SceneInfo[];
  /** cena de cada página */
  sceneOf: number[];
  /** tensão de cada página, 0–1 (suavizada) */
  tension: number[];
  /** lugar que domina o livro (para começo sem pistas) */
  dominant?: Locale;
  /** livro antigo (antes de 1920): sons de época */
  oldTimes: boolean;
}

/* ---------- lugares ---------- */

const NOUNS: [Locale, string][] = [
  ['taverna', 'taverna|taberna|estalagem|botequim|hospedaria|bodega|tasca|venda'],
  ['igreja', 'igreja|capela|convento|catedral|missa|mosteiro|sacristia|matriz'],
  ['cemiterio', 'cemiterio|cripta|catacumba|jazigo|sepultura'],
  ['prisao', 'prisao|cadeia|calabouco|masmorra|carcere|xadrez'],
  ['estacao', 'estacao|plataforma|gare'],
  ['ferrovia', 'ferrovia|trilhos|linha ferrea|tunel|trem|comboio|vagao|locomotiva'],
  ['multidao', 'mercado|feira|baile|teatro|procissao|festa|arraial'],
  ['mar', 'praia|mar|navio|barco|cais|porto|conves|enseada|costa|bote|canoa|farol|rochedo|falesia'],
  ['agua', 'rio|riacho|lago|lagoa|cachoeira|ribeirao|margem'],
  ['sertao', 'sertao|caatinga|deserto|chapada'],
  ['natureza', 'floresta|mata|bosque|campo|jardim|quintal|chacara|fazenda|roca|horta|pomar|serra|montanha|vale|trilha|aldeia|estrada|varzea|campina|picada|engenho'],
  ['rua', 'rua|praca|largo|cidade|avenida|calcada|esquina|beco|vila|bairro'],
  ['interior', 'sala|quarto|cozinha|casa|alcova|gabinete|escritorio|redacao|biblioteca|loja|sobrado|aposento|colegio|cela|corredor|salao|sotao|porao|camara|varanda|janela|leito|cama|mesa|cabana|choupana|guarita|cabine'],
];
const NOUN_ALT = NOUNS.map(([, n]) => n).join('|');
const localeOfNoun = (w: string): Locale | undefined => NOUNS.find(([, n]) => new RegExp(`^(${n})s?$`).test(w))?.[0];

/** Verbos de chegada, permanência e saída + preposição + lugar ("entramos na sala"). */
const ARRIVE = new RegExp(
  '\\b(?:entr|cheg|volt|regress|sub|desc|sa[ií]|pass|segu|caminh|fomos|fui|foi|iam|ia|estav|estive|estivemos|ficamos|ficou|fiquei|acord|sent[oa]|achava-se|encontrava-se|morav|parou|paramos|atravess|alcanc|desembarc|embarc)\\w*'
  + '\\s+(?:\\w+\\s+)?(?:a|à|ao|aos|as|na|no|nas|nos|numa|num|para a|para o|para as|para os|pela|pelo|em|ate a|ate o|dentro d[aeo]|junto a|junto ao|de volta a|de volta ao)\\s+'
  + `(?:\\w+\\s+)?(${NOUN_ALT})s?\\b`,
);
/** Começo de parágrafo que já situa o lugar ("Na sala, …", "À beira do rio, …"). */
const OPENING = new RegExp(`^(?:na|no|nas|nos|a|à|ao|em|dentro d[aeo]|a beira d[aeo]|junto a[o]?|pela|pelo)\\s+(?:\\w+\\s+)?(${NOUN_ALT})s?\\b[^.]{0,40}[,.]`);

/** Lugar estabelecido pela narração (forte): muda a cena. */
export function establishedLocale(n: string): Locale | undefined {
  const m = ARRIVE.exec(n) ?? OPENING.exec(n);
  return m ? localeOfNoun(m[1]) : undefined;
}

/** Lugares só citados (fraco): conta pistas quando ainda não se sabe onde a cena está. */
function mentionedLocales(n: string): Locale[] {
  const out: Locale[] = [];
  const re = new RegExp(`\\b(${NOUN_ALT})s?\\b`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(n))) { const L = localeOfNoun(m[1]); if (L) out.push(L); }
  return out;
}

/* ---------- tempo e hora ---------- */

const TIME_JUMP = /^(no dia seguinte|na manha seguinte|na noite seguinte|dias depois|semanas depois|meses depois|anos depois|horas depois|mais tarde|pela manha|de manha|ao amanhecer|ao anoitecer|naquela noite|nessa noite|a noite|no outro dia|passaram-se|decorreram)/;
const SEPARATOR = /^\s*([*·•~#-]\s*){3,}\s*$|^\s*[*#]\s*$/;
/** Só frases que SITUAM a hora contam ("era noite", "ao amanhecer"); "a noite anterior" não muda nada. */
const DAY = /amanhec|alvorada|de manha\b|pela manha|manha (seguinte|cedo|clara)|meio-dia|em pleno dia|o sol (nasc|brilh|batia|ardia|ia alto|entrava)|dia claro|claridade do dia/;
const NIGHT = /era noite|ja era noite|anoitec|caiu a noite|ao cair da noite|meia-noite|de madrugada|alta noite|noite (escura|fechada|alta|sem lua)|naquela noite|esta noite|nessa noite|a noite (caia|chegava|descia|ia)|luar|a lua (brilhava|nascia|iluminava|subia)|ceu estrelado|na escuridao/;
const RAIN = /\bchov|chuva|garoa|aguaceiro|chuvisc/;
const STORM = /tempestade|temporal|trovoada|\btrov|relampag|raios? (cortavam|caiam|iluminav)/;
const WIND = /ventania|vendaval|\bo vento (sopr|uiv|assobi|forte|gelad|frio|batia|sacudia)|rajadas?/;
const CLEAR = /parou de chover|a chuva (cessou|parou|passara)|estiou|ceu (limpo|azul|claro|estrelado)|sol (brilh|batia|forte|ardia)|tempo bom/;
const FIRE = /lareira|fogueira|braseiro|brasas\b|\b(a|as) chamas?\b|labaredas|crepit|fogao/;

/* ---------- tensão ---------- */

const DANGER = /grit|sangue|morte|morto|morta|matar|matou|mat(ei|aram)|medo|terror|horror|pavor|fug|corr(eu|i|ia|endo)|golpe|punhal|faca|tiro|arma|perigo|desesper|socorro|panico|trem(ia|er|endo)|assassin|cadaver|fantasma|monstro|ameac|fer(ido|ida)|agoni|furia|furios/;

/** Tensão de um trecho (0–1): frases curtas, exclamações e perigo. */
export function tensionOf(text: string, n: string): number {
  const sentences = text.split(/(?<=[.!?…])\s+/).filter((s) => s.trim().length > 1);
  const words = text.split(/\s+/).filter(Boolean).length;
  const avg = words / Math.max(1, sentences.length);
  const short = Math.max(0, Math.min(1, (16 - avg) / 10)); // média de 6 palavras = 1; 16+ = 0
  const excl = Math.min(1, ((text.match(/[!?]/g)?.length ?? 0) / Math.max(1, sentences.length)) * 1.5);
  const danger = Math.min(1, (n.match(new RegExp(DANGER.source, 'g'))?.length ?? 0) / 3);
  return Math.max(0, Math.min(1, 0.3 * short + 0.25 * excl + 0.45 * danger));
}

/* ---------- mapa ---------- */

export function buildSceneMap(pages: string[], opts: { year?: number } = {}): SceneMap {
  const scenes: SceneInfo[] = [];
  const sceneOf: number[] = new Array(pages.length).fill(0);
  const tension: number[] = new Array(pages.length).fill(0);
  let cur: SceneInfo = { start: 0, end: 0, chapter: true, fire: false };
  let time: TimeOfDay | undefined;
  let weather: Weather | undefined;
  let locale: Locale | undefined;
  let hints = new Map<Locale, number>();
  const usage = new Map<Locale, number>();

  const open = (i: number, chapter: boolean) => {
    if (i > cur.start) { cur.end = i; scenes.push(cur); }
    cur = { start: i, end: i, chapter, locale, time, weather, fire: false };
    hints = new Map();
  };

  let t = 0;
  pages.forEach((p, i) => {
    const heading = p.length < 90 && !!headingOf(p);
    const n = narration(p);
    if (heading) {
      // capítulo novo: cena nova; o lugar continua até a narração dizer outro
      open(i, true);
      weather = undefined;
      cur.weather = undefined;
    } else if (SEPARATOR.test(p)) {
      open(i, false);
    } else if (TIME_JUMP.test(n)) {
      if (i > cur.start + 1) open(i, false);
      if (/dia seguinte|manha|amanhecer|no outro dia/.test(n.slice(0, 40))) time = 'dia';
      if (/noite|anoitecer/.test(n.slice(0, 40))) time = 'noite';
      weather = undefined;
      cur.time = time; cur.weather = weather;
    }

    // lugar estabelecido pela narração: cena nova se mudou
    const est = establishedLocale(n);
    if (est && est !== locale) {
      if (i > cur.start + 1) open(i, false);
      locale = est;
      cur.locale = est;
      cur.fire = false;
    } else if (!locale) {
      // sem lugar ainda: junta as pistas (precisa de duas)
      mentionedLocales(n).forEach((L) => hints.set(L, (hints.get(L) ?? 0) + 1));
      const best = [...hints.entries()].sort((a, b) => b[1] - a[1])[0];
      if (best && best[1] >= 2) { locale = best[0]; cur.locale = locale; }
    }

    // hora e tempo: mudam o ambiente da cena dali em diante
    const nextTime: TimeOfDay | undefined = NIGHT.test(n) && !DAY.test(n) ? 'noite' : DAY.test(n) && !NIGHT.test(n) ? 'dia' : time;
    const nextWeather: Weather | undefined = STORM.test(n) ? 'tempestade' : RAIN.test(n) ? (weather === 'tempestade' ? 'tempestade' : 'chuva')
      : CLEAR.test(n) ? 'limpo' : WIND.test(n) && !weather ? 'vento' : weather;
    if ((nextTime !== time || nextWeather !== weather) && i > cur.start) {
      // mudou o tempo no meio da cena: vira uma cena nova no mesmo lugar (o som acompanha a virada)
      if (i > cur.start + 1) open(i, false);
    }
    time = nextTime; weather = nextWeather;
    cur.time = time; cur.weather = weather;
    if (FIRE.test(n)) cur.fire = true;

    sceneOf[i] = scenes.length;
    if (locale) usage.set(locale, (usage.get(locale) ?? 0) + 1);
    // tensão suavizada (sobe rápido, desce devagar)
    const raw = tensionOf(p, n);
    t = raw > t ? t + (raw - t) * 0.6 : t + (raw - t) * 0.25;
    tension[i] = Math.round(t * 100) / 100;
  });
  cur.end = pages.length;
  scenes.push(cur);

  const dominant = [...usage.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return { scenes, sceneOf, tension, dominant, oldTimes: !!opts.year && opts.year < 1920 };
}

/* ---------- ambiente de cada cena ---------- */

const S = (s: Layer, gain: number, priority: StemPriority, lowpass?: number): MixStem => (lowpass ? { s, gain, priority, lowpass } : { s, gain, priority });

/** Interior: o tempo lá fora chega abafado pela parede. */
const MUFFLED = 900;

/**
 * Matriz de mixagem de uma cena: lugar + hora + tempo + lareira. Sempre
 * poucos stems e baixos; o lugar sem som marcante fica quase em silêncio
 * (silêncio também é cenário).
 */
export function bedFor(sc: Pick<SceneInfo, 'locale' | 'time' | 'weather' | 'fire'>, dominant?: Locale): MixStem[] {
  const loc = sc.locale ?? dominant;
  const night = sc.time === 'noite';
  const w = sc.weather;
  const out: MixStem[] = [];
  const indoor = loc === 'interior' || loc === 'igreja' || loc === 'taverna' || loc === 'prisao';
  // tempo: ao ar livre, presente; dentro, abafado
  if (w === 'chuva' || w === 'tempestade') out.push(S('rain', indoor ? 0.4 : 0.55, 1, indoor ? MUFFLED : undefined));
  if (w === 'tempestade') out.push(S('thunder', 0.35, 2, indoor ? 600 : 2500));
  if (w === 'vento') out.push(S('wind', indoor ? 0.25 : 0.4, w === 'vento' && !loc ? 1 : 2, indoor ? 1200 : undefined));
  switch (loc) {
    case 'interior':
      if (sc.fire) out.push(S('fire', 0.45, 1));
      if (night && !w) out.push(S('night', 0.18, 3, 1500));
      break;
    case 'rua':
      out.push(S('city', night ? 0.25 : 0.4, w ? 2 : 1, night ? 2500 : undefined));
      if (night) out.push(S('night', 0.2, 3));
      break;
    case 'natureza':
      if (night) out.push(S('cricket', 0.35, 1), S('night', 0.22, 2));
      else out.push(S('leaves', 0.4, 1), S('birds', 0.28, 2));
      break;
    case 'sertao':
      out.push(S('wind', 0.4, 1, 6000));
      if (night) out.push(S('cricket', 0.28, 2)); else out.push(S('birds', 0.12, 3));
      break;
    case 'mar':
      out.push(S('sea', 0.55, 1), S('wind', 0.25, 2));
      break;
    case 'agua':
      out.push(S('water', 0.45, 1));
      if (night) out.push(S('cricket', 0.25, 2)); else out.push(S('leaves', 0.2, 3));
      break;
    case 'taverna':
      out.push(S('tavern', 0.45, 1), S('fire', 0.25, 2));
      break;
    case 'igreja':
      out.push(S('crowd', 0.12, 3, 600));
      break;
    case 'multidao':
      out.push(S('crowd', 0.32, 1, 900), S('city', 0.15, 3, 2000));
      break;
    case 'estacao':
      out.push(S('train', 0.42, 1), S('crowd', 0.12, 3, 800));
      break;
    case 'ferrovia':
      // linha isolada: trem ao longe e vento, sem gente
      out.push(S('wind', 0.3, 1, 4000), S('train', 0.25, 2, 2500));
      if (night) out.push(S('night', 0.2, 3));
      break;
    case 'cemiterio':
      out.push(S('wind', 0.3, 1, 3000));
      if (night) out.push(S('night', 0.25, 2));
      out.push(S('drone', 0.1, 3));
      break;
    case 'prisao':
      out.push(S('drone', 0.12, 2), S('wind', 0.1, 3, 800));
      break;
    default:
      if (night && !w) out.push(S('night', 0.2, 2));
  }
  return normalizeMix(out, 3);
}

const MOOD_OF: Partial<Record<Locale, Mood>> = {
  interior: 'warm', rua: 'city', natureza: 'forest', sertao: 'warm', mar: 'sea', agua: 'forest', taverna: 'warm',
  igreja: 'calm', multidao: 'city', estacao: 'city', ferrovia: 'cold', cemiterio: 'tension', prisao: 'tension',
};

/** Como os sons soam num livro antigo: cidade sem carros, multidão sem palavras. */
function eraLooks(old: boolean): Partial<Record<Layer, SoundVariant>> {
  const looks: Partial<Record<Layer, SoundVariant>> = { crowd: { distance: 'far', detail: 'indistinct murmur no words' } };
  if (old) {
    looks.city = { detail: '1880s street horse carriages no cars' };
    looks.train = { detail: 'old steam train' };
    looks.tavern = { detail: 'old tavern no music' };
  }
  return looks;
}

/**
 * Plano de som de uma página pelo mapa de cenas: o ambiente da cena (igual
 * em todas as páginas dela), no máximo um efeito narrado e a tensão.
 * Tensão alta em lugar fechado ou à noite acrescenta um drone muito baixo.
 */
export function scenePlan(map: SceneMap, pages: string[], i: number): ScenePlan {
  const sc = map.scenes[map.sceneOf[i] ?? 0];
  const mix = bedFor(sc, map.dominant);
  const t = map.tension[i] ?? 0;
  if (t >= 0.7 && !mix.some((m) => m.s === 'drone') && (sc.locale === 'interior' || sc.time === 'noite')) mix.push(S('drone', 0.14, 3));
  const n = narration(pages[i] ?? '');
  const plan: ScenePlan = {
    mood: sc.weather === 'chuva' || sc.weather === 'tempestade' ? 'rain' : t >= 0.6 ? 'tension' : sc.time === 'noite' && sc.locale !== 'interior' ? 'night' : MOOD_OF[sc.locale ?? map.dominant ?? 'interior'] ?? 'calm',
    ambience: mixToAmbience(mix),
    mix,
    spots: keywordSpotsOf(n).slice(0, 1),
    looks: eraLooks(map.oldTimes),
    scene: map.sceneOf[i] ?? 0,
    chapterStart: sc.chapter && sc.start === i,
    tension: t,
    night: sc.time === 'noite',
  };
  return plan;
}
