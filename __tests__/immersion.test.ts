import { analyze } from '../src/core/analyze';
import { mergeScreen } from '../src/core/plan';
import { SceneHold } from '../src/core/smooth';
import type { ScenePlan } from '../src/core/types';

describe('efeitos só quando o som acontece', () => {
  it('menção, lembrança e comparação não tocam efeito', () => {
    for (const t of [
      'Meu coração bateu forte quando ela sorriu.',
      'O cachorro do vizinho era só uma lembrança.',
      'Ele pensou no lobo da fábula.',
      'Lutava como um leão, rugia como uma fera.',
      'A chave do mistério estava ali.',
      'O trovão rugia ao longe.',
      'Andou pensando na vida o dia inteiro.',
    ]) expect(analyze(t).spots).toEqual([]);
  });

  it('o som narrado toca, e só um por trecho', () => {
    expect(analyze('Alguém bateu na porta três vezes.').spots[0]?.s).toBe('knock');
    expect(analyze('O cachorro latiu no quintal.').spots[0]?.s).toBe('bark');
    expect(analyze('A porta rangeu devagar. Lá fora, um lobo uivou.').spots).toHaveLength(1);
  });

  it('lembrança não muda o lugar da cena', () => {
    const a = analyze('Na sala, a lareira estalava. Lembrou do mar da infância, das ondas na praia.');
    expect(a.ambience.fire).toBeDefined();
    expect(a.ambience.sea).toBeUndefined();
  });
});

const P = (ambience: ScenePlan['ambience'], spots: ScenePlan['spots'] = [], mood: ScenePlan['mood'] = null): ScenePlan => ({ ambience, spots, mood });

describe('um som por tela (página cheia)', () => {
  it('a cena que domina a página vence; menção curta fica de fora; no máximo um efeito', () => {
    const m = mergeScreen([
      { plan: P({ rain: 0.7, night: 0.5 }, [{ s: 'door', at: 1.5, w: 0.4 }], 'rain'), words: 120 },
      { plan: P({ sea: 0.6 }, [{ s: 'bell', at: 1.5, w: 0.5 }], 'sea'), words: 15 },
      { plan: P({ rain: 0.6 }, [], 'rain'), words: 90 },
    ]);
    expect(m.mood).toBe('rain');
    expect(m.ambience.rain).toBeGreaterThan(0.5);
    expect(m.ambience.sea).toBeUndefined();
    expect(m.spots).toHaveLength(1);
    expect(m.mix?.[0].s).toBe('rain');
  });
});

describe('permanência mínima de cena', () => {
  it('não troca de lugar antes de 90 s / 3 telas; troca forte depois de 30 s', () => {
    const h = new SceneHold();
    expect(h.next({ fire: 0.6 }, 0).changed).toBe(true);
    // menção de outro lugar logo em seguida: segura
    expect(h.next({ sea: 0.6 }, 20_000)).toEqual({ amb: { fire: 0.6 }, changed: false });
    // trecho sem cena: mantém
    expect(h.next({}, 25_000).amb).toEqual({ fire: 0.6 });
    // mudança forte (tempestade) depois de 30 s
    expect(h.next({ rain: 0.8, thunder: 0.6, wind: 0.5 }, 40_000).changed).toBe(true);
    // depois de 90 s, troca normal de lugar
    expect(h.next({ city: 0.6 }, 60_000).changed).toBe(false);
    expect(h.next({ city: 0.6 }, 140_000).changed).toBe(true);
  });

  it('no mesmo lugar, ajusta volumes sem "trocar de cena"', () => {
    const h = new SceneHold();
    h.next({ fire: 0.6, night: 0.4 }, 0);
    const r = h.next({ fire: 0.8 }, 5_000);
    expect(r.changed).toBe(false);
    expect(r.amb.fire).toBe(0.8);
    expect(r.amb.night).toBe(0.4);
  });
});
