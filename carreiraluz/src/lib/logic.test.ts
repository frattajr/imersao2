import { describe, expect, it } from 'vitest';
import { CHALLENGES } from '../data/challenges';
import { ROLES } from '../data/catalog';
import { getProfile } from '../data/profiles';
import { allCompetencies, generatePdi, priorities, progress } from './pdi';
import { searchLibrary } from './search';

describe('perfis', () => {
  it('perfil de referência é completo e marcado como demonstrativo nos números', () => {
    const p = getProfile('analista-marketing', 'senior')!;
    expect(p.coverage).toBe('completo');
    expect(p.salary.kind).toBe('demonstrativo');
    expect(p.tenure.kind).toBe('demonstrativo');
  });

  it('todo cargo e nível tem guia, e os genéricos não inventam números', () => {
    for (const r of ROLES) {
      for (const l of r.levels) {
        const p = getProfile(r.id, l)!;
        expect(p).toBeTruthy();
        if (p.coverage === 'parcial') {
          expect(p.salary.kind).toBe('insuficiente');
          expect(p.salary.range).toBeUndefined();
          expect(p.tenure.kind).toBe('insuficiente');
        }
      }
    }
  });
});

describe('desafios', () => {
  it('são 15 guias com os 8 passos preenchidos', () => {
    expect(CHALLENGES).toHaveLength(15);
    for (const c of CHALLENGES) {
      const g = c.guide;
      expect(g.happening.length).toBeGreaterThan(20);
      for (const list of [g.why, g.understand, g.prepare, g.approach.steps, g.approach.phrases, g.avoid, g.evaluate.progress, g.caution]) {
        expect(list.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('busca em linguagem natural', () => {
  const top = (q: string) => searchLibrary({ query: q })[0]?.entry.id;
  it('responde às perguntas de exemplo', () => {
    expect(top('Como pedir para participar de projetos estratégicos?')).toBe('projetos-estrategicos');
    expect(top('Como saber se estou pronto para ser gerente?')).toBe('pronto-para-gerente');
    expect(['conversar-salario', 'pedir-aumento']).toContain(top('Como conversar com meu chefe sobre salário?'));
  });
  it('entende sinônimos e ignora acentos', () => {
    expect(['pedir-aumento', 'conversar-salario']).toContain(top('quero ganhar mais dinheiro'));
    expect(top('colega levou o credito')).toBe('credito-colega');
  });
  it('filtra por senioridade e tema', () => {
    const r = searchLibrary({ query: '', level: 'junior', category: 'lideranca' });
    expect(r.every((x) => x.entry.category === 'lideranca')).toBe(true);
    expect(r.find((x) => x.entry.id === 'interesse-liderar')).toBeUndefined();
  });
});

describe('PDI', () => {
  const p = getProfile('analista-marketing', 'senior')!;
  it('sem autoavaliação, prioridades são genéricas', () => {
    const items = generatePdi(p, {});
    expect(items.some((i) => i.origin === 'personalizada')).toBe(false);
    expect(new Set(items.map((i) => i.horizon))).toEqual(new Set([30, 60, 90]));
    const kinds = new Set(items.map((i) => i.kind));
    for (const k of ['competencia', 'lacuna', 'acao', 'conversa', 'experiencia', 'entrega', 'indicador']) expect(kinds.has(k as never)).toBe(true);
  });
  it('com autoavaliação, prioriza a maior lacuna apontada pela pessoa', () => {
    const self = Object.fromEntries(allCompetencies(p).map((c) => [c.id, c.expected]));
    self['comp-influencia'] = 1;
    const pr = priorities(p, self);
    expect(pr.personalized).toBe(true);
    expect(pr.items[0].c.id).toBe('comp-influencia');
    const items = generatePdi(p, self);
    expect(items.find((i) => i.kind === 'competencia')?.origin).toBe('personalizada');
  });
  it('calcula progresso', () => {
    const items = generatePdi(p, {});
    items[0].done = true;
    expect(progress(items)).toBe(Math.round(100 / items.length));
  });
});
