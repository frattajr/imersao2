/**
 * Jornada do leitor: pontos e níveis, sequência com dias de descanso,
 * semana flexível, desafio da semana, primeiros passos, conquistas e
 * sugestão de meta.
 */
import { dayKey, type ReadingDays } from '../src/core/catalog';
import {
  apply, BADGES, challengeFor, CHALLENGES, emptyJourney, goalAdvice, hydrate, levelOf, MAX_FREEZES, minutesLeft, settle, STEPS, stepsLeft,
  streakOf, weekKey, weekView, type JourneyEvent, type JourneyState,
} from '../src/core/journey';

const at = (s: string, h = 12) => new Date(`${s}T${String(h).padStart(2, '0')}:00:00`);
const ctx = (now: Date, goal = 10, weekTarget = 4) => ({ now, goal, weekTarget });
const min = (n: number) => n * 60_000;

/** Lê `minutes` minutos em trechos de 1 min. */
function readFor(s: JourneyState, days: ReadingDays, now: Date, minutes: number, extra: Partial<Extract<JourneyEvent, { type: 'read' }>> = {}, goal = 10) {
  let st = s, d = days;
  const all: string[] = [];
  let goalReached = false;
  for (let i = 0; i < minutes; i++) {
    const r = apply(st, d, { type: 'read', ms: min(1), words: 200, ...extra }, ctx(now, goal));
    st = r.state; d = r.days; all.push(...r.unlocked.map((b) => b.id)); goalReached ||= r.goalReached;
  }
  return { s: st, days: d, unlocked: all, goalReached };
}

describe('pontos e níveis', () => {
  it('sobe rápido no começo e dá nome ao nível', () => {
    expect(levelOf(0)).toMatchObject({ n: 1, name: 'Primeiras páginas', next: 'Leitor curioso' });
    expect(levelOf(25)).toMatchObject({ n: 2, name: 'Leitor curioso' });
    expect(levelOf(60).name).toBe('Leitor de cabeceira');
    expect(levelOf(40).pct).toBeCloseTo(0.5);
    // depois do último nome, um nível a cada 1000 pontos
    expect(levelOf(4900)).toMatchObject({ n: 14, name: 'Lenda da biblioteca' });
  });
  it('1 ponto por minuto, +5 pela meta do dia, +10 capítulo, +25 livro (+20 se fechar o desafio)', () => {
    const { s: s1, days } = readFor(emptyJourney(), {}, at('2026-10-14'), 10);
    expect(Math.round(s1.points)).toBe(10 + 5);
    const ch = apply(s1, days, { type: 'chapter' }, ctx(at('2026-10-14')));
    expect(ch.pointsGained).toBe(10 + (ch.challenge ? 20 : 0));
    const fin = apply(ch.state, days, { type: 'finish', bookId: 'x' }, ctx(at('2026-10-14')));
    expect(fin.pointsGained).toBe(25 + (fin.challenge ? 20 : 0));
  });
  it('parada longa conta no máximo 3 minutos', () => {
    const r = apply(emptyJourney(), {}, { type: 'read', ms: min(40) }, ctx(at('2026-10-14')));
    expect(r.days['2026-10-14']).toBe(3);
  });
});

describe('sequência com dias de descanso', () => {
  it('conta dias seguidos e liga pelo descanso (sem contar o dia de descanso)', () => {
    const days = { '2026-10-10': 5, '2026-10-11': 5, '2026-10-13': 5 };
    expect(streakOf(days, [], at('2026-10-13'))).toBe(1);
    expect(streakOf(days, ['2026-10-12'], at('2026-10-13'))).toBe(3);
    // hoje ainda não leu: vale a sequência até ontem
    expect(streakOf(days, ['2026-10-12'], at('2026-10-14'))).toBe(3);
  });
  it('falta de um dia usa o descanso guardado e a sequência continua', () => {
    const days = { '2026-10-10': 5, '2026-10-11': 5 };
    const s = settle(emptyJourney(), days, at('2026-10-13'));
    expect(s.rest).toEqual(['2026-10-12']);
    expect(s.freezes).toBe(0);
    // uma vez por dia só
    expect(settle(s, days, at('2026-10-13'))).toBe(s);
  });
  it('descanso não cobre parte da falta: guarda para depois', () => {
    const days = { '2026-10-10': 5 };
    const s = settle(emptyJourney(), days, at('2026-10-14'));
    expect(s.rest).toEqual([]);
    expect(s.freezes).toBe(1);
  });
  it('a cada 7 dias seguidos ganha um descanso (máx. 2)', () => {
    let s = emptyJourney();
    let days: ReadingDays = {};
    let earned = 0;
    for (let i = 1; i <= 14; i++) {
      const d = at(`2026-10-${String(i).padStart(2, '0')}`);
      const r = apply(s, days, { type: 'read', ms: min(2) }, ctx(d));
      s = r.state; days = r.days; if (r.freezeEarned) earned++;
    }
    expect(earned).toBe(1); // começou com 1; no dia 7 vai a 2; no 14 já está no máximo
    expect(s.freezes).toBe(MAX_FREEZES);
    expect(s.best).toBe(14);
  });
  it('voltar depois de uma pausa vira conquista, nunca bronca', () => {
    let { s, days } = readFor(emptyJourney(), {}, at('2026-10-01'), 2);
    s = { ...s, freezes: 0 };
    const r = apply(s, days, { type: 'read', ms: min(2) }, ctx(at('2026-10-09')));
    expect(r.comeback).toBe(true);
    expect(r.unlocked.map((b) => b.id)).toContain('comeback');
  });
});

describe('semana flexível e desafio', () => {
  it('semana começa na segunda; calendário mostra meta, leitura e descanso', () => {
    expect(weekKey(at('2026-10-15'))).toBe('2026-10-12'); // quinta → segunda
    expect(weekKey(at('2026-10-18'))).toBe('2026-10-12'); // domingo
    const v = weekView({ '2026-10-12': 12, '2026-10-13': 3 }, ['2026-10-14'], at('2026-10-15'), 10);
    expect(v.map((d) => d.label).join('')).toBe('STQQSSD');
    expect(v[0]).toMatchObject({ met: true, read: true });
    expect(v[1]).toMatchObject({ met: false, read: true });
    expect(v[2].rest).toBe(true);
    expect(v[3].today).toBe(true);
    expect(v[4].future).toBe(true);
  });
  it('meta de dias da semana cumprida dá pontos uma vez', () => {
    let s = emptyJourney();
    let days: ReadingDays = {};
    let hits = 0;
    for (const d of ['2026-10-12', '2026-10-13', '2026-10-14']) {
      const r = readFor(s, days, at(d), 10);
      s = r.s; days = r.days;
    }
    const r = apply(s, days, { type: 'read', ms: min(3) }, ctx(at('2026-10-15'), 10, 3));
    if (r.weekReached) hits++;
    const r2 = apply(r.state, r.days, { type: 'read', ms: min(1) }, ctx(at('2026-10-15'), 10, 3));
    if (r2.weekReached) hits++;
    expect(hits).toBe(1);
    expect(r2.state.weeksMet).toEqual(['2026-10-12']);
  });
  it('o desafio é o mesmo a semana toda e varia entre semanas', () => {
    expect(challengeFor('2026-10-12')).toBe(challengeFor('2026-10-12'));
    const ids = new Set(Array.from({ length: 20 }, (_, i) => challengeFor(dayKey(new Date(2026, 0, 5 + i * 7))).id));
    expect(ids.size).toBeGreaterThanOrEqual(4);
  });
  it('desafio concluído dá pontos uma vez', () => {
    // acha uma semana cujo desafio é o de grifos
    let monday = new Date(2026, 0, 5, 12);
    while (challengeFor(weekKey(monday)).id !== 'highlights') monday = new Date(monday.getTime() + 7 * 86_400_000);
    const wk = weekKey(monday);
    let s: JourneyState = emptyJourney(monday);
    let got = 0;
    for (let i = 0; i < 4; i++) {
      const r = apply(s, {}, { type: 'highlight', note: false }, ctx(monday));
      s = r.state;
      if (r.challenge) { got++; expect(i).toBe(2); expect(r.pointsGained).toBe(20); }
    }
    expect(got).toBe(1);
    expect(s.challenges[wk]).toBe('highlights');
  });
  it('todo desafio tem progresso que chega ao alvo com os eventos certos', () => {
    const w = { key: '2026-10-12', chapters: 1, books: 0, highlights: 3, soundMin: 25, nights: ['a', 'b'], newBooks: ['x'] };
    const days = { '2026-10-12': 30, '2026-10-13': 20, '2026-10-14': 15 };
    for (const c of CHALLENGES) expect(c.progress(w, days, at('2026-10-15'))).toBeGreaterThanOrEqual(c.target);
  });
});

describe('primeiros passos', () => {
  it('7 passos; concluir todos dá conquista, pontos e um dia de descanso', () => {
    expect(STEPS).toHaveLength(7);
    let s = emptyJourney();
    s = { ...s, freezes: 0 };
    let days: ReadingDays = {};
    const step = (ev: JourneyEvent, d = at('2026-10-12')) => { const r = apply(s, days, ev, ctx(d)); s = r.state; days = r.days; return r; };
    step({ type: 'preset' });
    expect(stepsLeft(s)[0].id).toBe('five');
    for (const d of ['2026-10-12', '2026-10-13']) for (let i = 0; i < 10; i++) step({ type: 'read', ms: min(1), bookId: 'acervo:iracema', classic: true }, at(d));
    step({ type: 'finish', bookId: 'conto' });
    step({ type: 'highlight', note: true });
    expect(stepsLeft(s).map((x) => x.id)).toEqual(['three']);
    const r = step({ type: 'read', ms: min(2) }, at('2026-10-14'));
    expect(r.stepsCompleted).toBe(true);
    expect(r.unlocked.map((b) => b.id)).toContain('steps');
    expect(s.freezes).toBe(1);
  });
});

describe('conquistas', () => {
  it('ids únicos e todas com título e explicação', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    BADGES.forEach((b) => { expect(b.title).toBeTruthy(); expect(b.desc).toMatch(/\.$/); });
  });
  it('imersão: chuva tocando, coruja depois das 22h, madrugador antes das 8h', () => {
    expect(readFor(emptyJourney(), {}, at('2026-10-14', 15), 10, { sound: true, layers: ['rain', 'wind'] }).unlocked).toContain('rain');
    // sem som não conta
    expect(readFor(emptyJourney(), {}, at('2026-10-14', 15), 10, { sound: false, layers: ['rain'] }).unlocked).not.toContain('rain');
    expect(readFor(emptyJourney(), {}, at('2026-10-14', 23), 10).unlocked).toContain('owl');
    expect(readFor(emptyJourney(), {}, at('2026-10-14', 6), 10).unlocked).toContain('early');
  });
  it('maratona: 30 minutos num dia; primeira página e meta cumprida', () => {
    const r = readFor(emptyJourney(), {}, at('2026-10-14'), 30);
    expect(r.unlocked).toEqual(expect.arrayContaining(['first', 'goal', 'marathon']));
    expect(r.goalReached).toBe(true);
  });
  it('cada conquista sai uma vez só', () => {
    const a = readFor(emptyJourney(), {}, at('2026-10-14'), 12);
    const b = readFor(a.s, a.days, at('2026-10-14'), 12);
    expect(b.unlocked).not.toContain('first');
    expect(b.unlocked).not.toContain('goal');
  });
});

describe('sessão e resumo', () => {
  it('resume a leitura ao sair (só se passou de 30 s)', () => {
    let s = apply(emptyJourney(), {}, { type: 'session-start', bookId: 'b', title: 'Livro' }, ctx(at('2026-10-14'))).state;
    const r = readFor(s, {}, at('2026-10-14'), 11);
    s = apply(r.s, r.days, { type: 'session-end' }, ctx(at('2026-10-14'))).state;
    expect(s.session).toBeUndefined();
    expect(s.last).toMatchObject({ title: 'Livro', goal: true, seen: false, words: 2200 });
    expect(s.last!.ms).toBe(min(11));
    expect(s.last!.badges).toEqual(expect.arrayContaining(['first', 'goal']));
    expect(s.last!.finished).toBeFalsy();
    // terminou o livro na leitura: a Jornada não sugere "continuar" um livro acabado
    let f = apply(emptyJourney(), {}, { type: 'session-start', bookId: 'b' }, ctx(at('2026-10-14'))).state;
    const rf = readFor(f, {}, at('2026-10-14'), 1);
    f = apply(rf.s, rf.days, { type: 'finish', bookId: 'b' }, ctx(at('2026-10-14'))).state;
    f = apply(f, rf.days, { type: 'session-end' }, ctx(at('2026-10-14'))).state;
    expect(f.last).toMatchObject({ finished: true });
    const short = apply(apply(emptyJourney(), {}, { type: 'session-start', bookId: 'b' }, ctx(at('2026-10-14'))).state, {},
      { type: 'session-end' }, ctx(at('2026-10-14'))).state;
    expect(short.last).toBeUndefined();
  });
});

describe('sugestões', () => {
  it('sobe a meta quando cumpre quase todo dia; desce quando fica longe', () => {
    const today = at('2026-10-15');
    const week = (m: number[]) => Object.fromEntries(m.map((x, i) => [dayKey(new Date(2026, 9, 14 - i)), x]));
    expect(goalAdvice(week([12, 11, 15, 10, 13, 10, 0]), 10, today)?.to).toBe(15);
    expect(goalAdvice(week([3, 2, 4, 0, 0, 0, 0]), 10, today)?.to).toBe(5);
    expect(goalAdvice(week([12, 0, 0, 10, 0, 0, 0]), 10, today)).toBeNull();
    // dispensada há menos de uma semana: não insiste
    expect(goalAdvice(week([3, 2, 4, 0, 0, 0, 0]), 10, today, '2026-10-13')).toBeNull();
  });
  it('minutos que faltam e estado salvo de versão antiga', () => {
    expect(minutesLeft({ '2026-10-15': 6.2 }, 10, at('2026-10-15'))).toBe(4);
    expect(minutesLeft({ '2026-10-15': 12 }, 10, at('2026-10-15'))).toBe(0);
    const h = hydrate({ points: 50, c: { minutes: 40 } });
    expect(h.points).toBe(50);
    expect(h.c.minutes).toBe(40);
    expect(h.c.climateMin).toEqual({});
    expect(h.freezes).toBe(1);
  });
});
