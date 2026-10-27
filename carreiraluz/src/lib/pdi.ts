import type { CareerProfile, Competency, PdiHorizon, PdiItem, PdiKind } from '../data/types';

/** Autoavaliação da pessoa: id da competência → 1 a 4. */
export type SelfAssessment = Record<string, number>;

export const SELF_LABELS = ['Iniciando', 'Em desenvolvimento', 'Confortável', 'Referência'] as const;

export const KIND_LABELS: Record<PdiKind, string> = {
  competencia: 'Competência prioritária',
  lacuna: 'Lacuna a investigar',
  acao: 'Ação prática',
  conversa: 'Conversa importante',
  experiencia: 'Experiência de autonomia',
  entrega: 'Entrega para o próximo nível',
  indicador: 'Indicador de progresso',
};

export function allCompetencies(p: CareerProfile): Competency[] {
  return [p.technical, p.behavioral].flatMap((g) => g.sections.flatMap((s) => s.items));
}

/**
 * Competências com maior distância entre o esperado na cadeira e a
 * autoavaliação. Sem autoavaliação, não há como saber lacunas individuais:
 * devolve as de maior expectativa, marcadas como genéricas.
 */
export function priorities(p: CareerProfile, self: SelfAssessment, n = 3) {
  const comps = allCompetencies(p);
  const assessed = comps.filter((c) => self[c.id] != null);
  if (assessed.length) {
    const gaps = assessed
      .map((c) => ({ c, gap: c.expected - self[c.id] }))
      .filter((g) => g.gap > 0)
      .sort((a, b) => b.gap - a.gap || b.c.expected - a.c.expected);
    return { personalized: true, items: gaps.slice(0, n) };
  }
  return {
    personalized: false,
    items: [...comps].sort((a, b) => b.expected - a.expected).slice(0, n).map((c) => ({ c, gap: 0 })),
  };
}

let seq = 0;
const uid = () => `i${Date.now().toString(36)}${(seq++).toString(36)}`;

function item(horizon: PdiHorizon, kind: PdiKind, text: string, origin: PdiItem['origin'], reason?: string): PdiItem {
  return { id: uid(), horizon, kind, text, origin, reason, done: false };
}

/** Gera o mini PDI de 30/60/90 dias a partir do perfil e da autoavaliação (opcional). */
export function generatePdi(p: CareerProfile, self: SelfAssessment): PdiItem[] {
  const pr = priorities(p, self);
  const origin: PdiItem['origin'] = pr.personalized ? 'personalizada' : 'generica';
  const items: PdiItem[] = [];
  const next = p.nextChair.nextTitle;

  // 30 dias: entender e alinhar.
  for (const { c, gap } of pr.items.slice(0, 2)) {
    items.push(
      item(
        30,
        'competencia',
        `Priorizar: ${c.name}`,
        origin,
        pr.personalized
          ? `Você se avaliou ${gap} nível(is) abaixo do que esta cadeira costuma pedir.`
          : 'Competência com expectativa alta nesta cadeira. Faça a autoavaliação para personalizar.',
      ),
    );
  }
  items.push(
    item(30, 'lacuna', `Perguntar ao seu gestor como ele avalia você em "${pr.items[0]?.c.name ?? 'suas competências principais'}"`, 'generica', 'Sua autopercepção é um ponto de partida; a visão de quem acompanha seu trabalho completa o quadro.'),
    item(30, 'conversa', `Conversa de carreira: entender o que é esperado em ${next} e quais critérios pesam`, 'generica'),
    item(30, 'indicador', `Definir como medir: ${p.deliverables.kpis[0]}`, 'generica'),
  );

  // 60 dias: praticar.
  for (const { c } of pr.items.slice(0, 2)) {
    items.push(item(60, 'acao', `Praticar ${c.name.toLowerCase()}: ${c.example}`, origin));
  }
  if (p.nextChair.shifts[0]) {
    items.push(item(60, 'experiencia', `Buscar uma experiência do próximo nível: ${lowerFirst(p.nextChair.shifts[0].next)}`, 'generica'));
  }
  items.push(item(60, 'conversa', 'Conversa com uma área parceira importante para entender as metas dela', 'generica'));
  if (pr.items[2]) {
    items.push(item(60, 'competencia', `Começar a desenvolver: ${pr.items[2].c.name}`, origin));
  }

  // 90 dias: demonstrar.
  items.push(
    item(90, 'entrega', p.deliverables.results[0], 'generica'),
    item(90, 'entrega', `Conduzir uma iniciativa que mostre: ${lowerFirst(p.nextChair.shifts[1]?.next ?? p.nextChair.shifts[0]?.next ?? next)}`, 'generica'),
    item(90, 'conversa', 'Revisar o plano com o gestor: o que avançou e o que muda no próximo ciclo', 'generica'),
    item(90, 'indicador', `Comparar com o início: ${p.deliverables.kpis[1] ?? p.deliverables.kpis[0]}`, 'generica'),
  );
  return items;
}

export function progress(items: PdiItem[]): number {
  if (!items.length) return 0;
  return Math.round((items.filter((i) => i.done).length / items.length) * 100);
}

export function newItem(horizon: PdiHorizon, kind: PdiKind, text: string): PdiItem {
  return item(horizon, kind, text, 'personalizada', 'Escrito por você.');
}

function lowerFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
