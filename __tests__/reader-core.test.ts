import { mixFromSmoothed, normalizeMix, sanitizePlan } from '../src/core/plan';
import { DEFAULT_WPM, formatMinutes, minutesFor, recordPage, wordCount } from '../src/core/pace';
import { needsRecap, recapLocal, RECAP_AFTER_MS } from '../src/core/recap';
import { entitiesSoFar, segmentText, xrayInfo } from '../src/core/xray';

describe('matriz de mixagem', () => {
  it('aceita a matriz da IA: limita, ordena por prioridade e descarta inválidos', () => {
    const p = sanitizePlan({ mood: 'tension', mix: [
      { s: 'rain', gain: 0.5, lowpass: 1200, priority: 1 }, { s: 'drone', gain: 0.2, priority: 3 },
      { s: 'lava', gain: 0.5 }, { s: 'wind', gain: 0.01 }, { s: 'rain', gain: 0.9, priority: 2 },
      { s: 'fire', gain: 2, lowpass: 50, priority: 9 }, { s: 'night', gain: 0.3, priority: 2 }, { s: 'tavern', gain: 0.3, priority: 3 },
    ] })!;
    expect(p.mix!.map((m) => m.s)).toEqual(['rain', 'night', 'fire', 'tavern']);
    expect(p.mix![0]).toEqual({ s: 'rain', gain: 0.5, lowpass: 1200, priority: 1 });
    expect(p.mix![2]).toEqual({ s: 'fire', gain: 1, lowpass: 200, priority: 3 }); // limitado às faixas seguras
    expect(p.ambience).toEqual({ rain: 0.5, fire: 1, night: 0.3, tavern: 0.3 });
  });

  it('plano antigo continua funcionando (sem matriz)', () => {
    expect(sanitizePlan({ ambience: { rain: 0.5 } })!.mix).toBeUndefined();
  });

  it('depois da suavização mantém prioridade e low-pass; camada segurada vira textura', () => {
    const m = mixFromSmoothed([{ s: 'rain', gain: 0.5, lowpass: 900, priority: 1 }], { rain: 0.45, sea: 0.2 });
    expect(m).toEqual([{ s: 'rain', gain: 0.45, lowpass: 900, priority: 1 }, { s: 'sea', gain: 0.2, priority: 3 }]);
    expect(normalizeMix(m, 1)).toHaveLength(1);
  });
});

describe('ritmo de leitura', () => {
  it('aprende o ritmo e ignora páginas puladas e pausas', () => {
    let s = { wpm: DEFAULT_WPM, samples: 0 };
    s = recordPage(s, 60, 20_000); // 180 ppm
    expect(s).toEqual({ wpm: 180, samples: 1 });
    s = recordPage(s, 60, 12_000); // 300 ppm
    expect(s.wpm).toBe(240);
    expect(recordPage(s, 60, 800)).toBe(s); // pulou
    expect(recordPage(s, 60, 10 * 60_000)).toBe(s); // pausa
    expect(recordPage(s, 5, 20_000)).toBe(s); // página curta demais para medir
  });

  it('estima o tempo', () => {
    expect(wordCount('um  dois\ntrês')).toBe(3);
    expect(minutesFor(1000, 250)).toBe(4);
    expect(formatMinutes(1)).toBe('< 1 min');
    expect(formatMinutes(75)).toBe('1 h 15 min');
  });
});

describe('X-Ray', () => {
  const pages = [
    'Bentinho conheceu Capitu no quintal.',
    'Capitu tinha olhos de ressaca, dizia José Dias.',
    'Escobar chegou ao seminário.',
    'Capitu e Escobar conversavam. Ninguém sabia o que viria.',
  ];

  it('marca os termos no texto (palavra inteira, sem acento)', () => {
    const seg = segmentText('Capitu viu José Dias e o capitulo.', ['capitu', 'José Dias']);
    expect(seg.filter((x) => x.term).map((x) => x.t)).toEqual(['Capitu', 'José Dias']); // "capitulo" não
    expect(seg.map((x) => x.t).join('')).toBe('Capitu viu José Dias e o capitulo.');
  });

  it('ficha sem spoiler: só o que foi lido até a página atual', () => {
    const info = xrayInfo('Capitu', pages, 1)!;
    expect(info).toMatchObject({ firstPage: 0, mentions: 2, lastPage: 1 });
    expect(info.lastQuote).toContain('olhos de ressaca');
    expect(xrayInfo('Escobar', pages, 1)).toBeNull(); // ainda não apareceu
  });

  it('entidades do que já foi lido', () => {
    expect(entitiesSoFar(pages, 1)).toEqual(expect.arrayContaining(['Capitu', 'José']));
    expect(entitiesSoFar(pages, 1)).not.toContain('Escobar');
  });
});

describe('recapitulação', () => {
  it('só depois de 48 h e com leitura em andamento', () => {
    const now = Date.now();
    expect(needsRecap(now - RECAP_AFTER_MS - 1, now, 5)).toBe(true);
    expect(needsRecap(now - 3600_000, now, 5)).toBe(false);
    expect(needsRecap(now - RECAP_AFTER_MS - 1, now, 0)).toBe(false);
    expect(needsRecap(null, now, 5)).toBe(false);
  });

  it('reserva sem internet: 2 frases das últimas páginas, em ordem', () => {
    const r = recapLocal([
      'Era uma tarde comum, sem nada demais acontecendo por ali naquele bairro.',
      'Marina abriu a porta do farol e encontrou o velho mapa escondido na parede.',
      'O vento soprava forte lá fora enquanto a noite caía devagar sobre o mar.',
      'Então Marina descobriu que o mapa mostrava uma ilha que não existia mais.',
    ], 3);
    expect(r).toBe('Marina abriu a porta do farol e encontrou o velho mapa escondido na parede. Então Marina descobriu que o mapa mostrava uma ilha que não existia mais.');
  });
});
