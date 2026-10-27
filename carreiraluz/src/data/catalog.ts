import type { AreaId, LevelId, MarketId, Role, SizeId } from './types';

export const LEVELS: { id: LevelId; label: string; short: string }[] = [
  { id: 'junior', label: 'Júnior', short: 'Jr.' },
  { id: 'pleno', label: 'Pleno', short: 'Pl.' },
  { id: 'senior', label: 'Sênior', short: 'Sr.' },
  { id: 'coordenacao', label: 'Coordenação', short: 'Coord.' },
  { id: 'gerencia', label: 'Gerência', short: 'Ger.' },
  { id: 'gerencia-senior', label: 'Gerência Sênior', short: 'Ger. Sr.' },
  { id: 'diretoria', label: 'Diretoria', short: 'Dir.' },
];

export const AREAS: { id: AreaId; label: string }[] = [
  { id: 'marketing', label: 'Marketing' },
  { id: 'growth', label: 'Growth' },
  { id: 'crm', label: 'CRM' },
  { id: 'dados', label: 'Dados' },
  { id: 'produto', label: 'Produto' },
  { id: 'tecnologia', label: 'Tecnologia' },
  { id: 'rh', label: 'Recursos Humanos' },
  { id: 'financas', label: 'Finanças' },
  { id: 'comercial', label: 'Comercial' },
];

export const MARKETS: { id: MarketId; label: string; icon: string }[] = [
  { id: 'financeiro', label: 'Serviços financeiros e bancos', icon: 'bank' },
  { id: 'tecnologia', label: 'Tecnologia e SaaS', icon: 'cloud' },
  { id: 'varejo', label: 'Varejo e e-commerce', icon: 'cart' },
  { id: 'telecom', label: 'Telecomunicações', icon: 'signal' },
  { id: 'saude', label: 'Saúde', icon: 'heart' },
  { id: 'industria', label: 'Indústria', icon: 'factory' },
  { id: 'educacao', label: 'Educação', icon: 'school' },
  { id: 'consumo', label: 'Bens de consumo', icon: 'package' },
  { id: 'consultoria', label: 'Consultoria', icon: 'briefcase' },
  { id: 'outros', label: 'Outros', icon: 'more' },
];

export const SIZES: { id: SizeId; label: string; range: string; hint: string; icon: string }[] = [
  {
    id: 'pequena',
    label: 'Pequena',
    range: 'até 49 funcionários',
    hint: 'Quase todo mundo se conhece pelo nome; a mesma pessoa cuida de várias frentes.',
    icon: 'size-s',
  },
  {
    id: 'media',
    label: 'Média',
    range: '50 a 249 funcionários',
    hint: 'Já existem áreas separadas, mas as decisões ainda passam por poucas pessoas.',
    icon: 'size-m',
  },
  {
    id: 'grande',
    label: 'Grande',
    range: '250 a 999 funcionários',
    hint: 'Várias diretorias, processos formais de aprovação e ciclos de avaliação.',
    icon: 'size-l',
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    range: '1.000 ou mais funcionários',
    hint: 'Estrutura matricial, comitês, muitas camadas de gestão, às vezes operação em vários países.',
    icon: 'size-xl',
  },
];

const IC: LevelId[] = ['junior', 'pleno', 'senior'];

export const ROLES: Role[] = [
  { id: 'analista-marketing', title: 'Analista de Marketing', area: 'marketing', levels: IC, defaultLevel: 'senior', aliases: ['marketing', 'mkt', 'comunicação', 'campanhas'] },
  { id: 'coordenador-marketing', title: 'Coordenador(a) de Marketing', area: 'marketing', levels: ['coordenacao'], defaultLevel: 'coordenacao', aliases: ['coordenadora de marketing'] },
  { id: 'gerente-marketing', title: 'Gerente de Marketing', area: 'marketing', levels: ['gerencia', 'gerencia-senior'], defaultLevel: 'gerencia' },
  { id: 'diretor-marketing', title: 'Diretor(a) de Marketing', area: 'marketing', levels: ['diretoria'], defaultLevel: 'diretoria', aliases: ['cmo', 'diretora de marketing'] },

  { id: 'analista-growth', title: 'Analista de Growth', area: 'growth', levels: IC, defaultLevel: 'pleno', aliases: ['growth hacker', 'aquisição', 'performance'] },
  { id: 'gerente-growth', title: 'Gerente de Growth', area: 'growth', levels: ['gerencia', 'gerencia-senior'], defaultLevel: 'gerencia', aliases: ['head de growth'] },

  { id: 'analista-crm', title: 'Analista de CRM', area: 'crm', levels: IC, defaultLevel: 'pleno', aliases: ['relacionamento', 'lifecycle', 'retenção'] },
  { id: 'coordenador-crm', title: 'Coordenador(a) de CRM', area: 'crm', levels: ['coordenacao'], defaultLevel: 'coordenacao' },

  { id: 'analista-dados', title: 'Analista de Dados', area: 'dados', levels: IC, defaultLevel: 'pleno', aliases: ['bi', 'data analyst', 'analytics'] },
  { id: 'cientista-dados', title: 'Cientista de Dados', area: 'dados', levels: IC, defaultLevel: 'pleno', aliases: ['data scientist', 'machine learning'] },
  { id: 'gerente-dados', title: 'Gerente de Dados', area: 'dados', levels: ['gerencia', 'gerencia-senior'], defaultLevel: 'gerencia', aliases: ['head de dados'] },

  { id: 'analista-produto', title: 'Product Owner / Analista de Produto', area: 'produto', levels: IC, defaultLevel: 'pleno', aliases: ['po', 'product owner'] },
  { id: 'gerente-produto', title: 'Gerente de Produto', area: 'produto', levels: ['pleno', 'senior', 'gerencia', 'gerencia-senior'], defaultLevel: 'senior', aliases: ['pm', 'product manager'] },

  { id: 'engenheiro-software', title: 'Engenheiro(a) de Software', area: 'tecnologia', levels: IC, defaultLevel: 'pleno', aliases: ['desenvolvedor', 'programador', 'dev'] },
  { id: 'tech-lead', title: 'Tech Lead', area: 'tecnologia', levels: ['coordenacao'], defaultLevel: 'coordenacao', aliases: ['líder técnico'] },
  { id: 'gerente-engenharia', title: 'Gerente de Engenharia', area: 'tecnologia', levels: ['gerencia', 'gerencia-senior'], defaultLevel: 'gerencia', aliases: ['engineering manager'] },

  { id: 'analista-rh', title: 'Analista de RH / Business Partner', area: 'rh', levels: IC, defaultLevel: 'pleno', aliases: ['recursos humanos', 'people', 'hrbp', 'gente e gestão'] },
  { id: 'gerente-rh', title: 'Gerente de RH', area: 'rh', levels: ['gerencia', 'gerencia-senior'], defaultLevel: 'gerencia', aliases: ['gerente de pessoas'] },

  { id: 'analista-financeiro', title: 'Analista Financeiro', area: 'financas', levels: IC, defaultLevel: 'pleno', aliases: ['fp&a', 'controladoria', 'planejamento financeiro'] },
  { id: 'gerente-financeiro', title: 'Gerente Financeiro', area: 'financas', levels: ['gerencia', 'gerencia-senior'], defaultLevel: 'gerencia', aliases: ['controller'] },

  { id: 'executivo-contas', title: 'Executivo(a) de Contas', area: 'comercial', levels: IC, defaultLevel: 'pleno', aliases: ['vendas', 'account executive', 'comercial'] },
  { id: 'gerente-comercial', title: 'Gerente Comercial', area: 'comercial', levels: ['gerencia', 'gerencia-senior'], defaultLevel: 'gerencia', aliases: ['gerente de vendas'] },
];

/** Perfil usado como ponto de partida e com conteúdo revisado. */
export const DEFAULT_SELECTION = {
  roleId: 'analista-marketing',
  level: 'senior' as LevelId,
  marketId: 'financeiro' as MarketId,
  sizeId: 'grande' as SizeId,
};

export const levelLabel = (id: LevelId) => LEVELS.find((l) => l.id === id)?.label ?? id;
export const areaLabel = (id: AreaId) => AREAS.find((a) => a.id === id)?.label ?? id;
export const marketLabel = (id: MarketId) => MARKETS.find((m) => m.id === id)?.label ?? id;
export const sizeLabel = (id: SizeId) => SIZES.find((s) => s.id === id)?.label ?? id;
export const findRole = (id: string) => ROLES.find((r) => r.id === id);

/** "Analista de Marketing Sênior"; cargos de liderança não repetem o nível. */
export function roleTitle(roleId: string, level: LevelId): string {
  const role = findRole(roleId);
  if (!role) return '';
  if (role.levels.length === 1) return role.title;
  if (level === 'gerencia-senior') return `${role.title} Sênior`;
  if (level === 'gerencia') return role.title;
  return `${role.title} ${levelLabel(level)}`;
}

/** Próximo nível dentro da trilha (do individual para liderança). */
export function nextLevel(level: LevelId): LevelId | null {
  const order = LEVELS.map((l) => l.id);
  const i = order.indexOf(level);
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
}
