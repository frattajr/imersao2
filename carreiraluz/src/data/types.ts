// Modelo de dados do CarreiraLuz.
//
// Toda informação exibida carrega a sua natureza (DataKind). A interface lê
// esses objetos e nunca mistura dado observado com estimativa ou exemplo:
// trocar os números por uma base real é trocar os arquivos em src/data, sem
// mexer nas telas.

export type LevelId =
  | 'junior'
  | 'pleno'
  | 'senior'
  | 'coordenacao'
  | 'gerencia'
  | 'gerencia-senior'
  | 'diretoria';

export type AreaId =
  | 'marketing'
  | 'growth'
  | 'crm'
  | 'dados'
  | 'produto'
  | 'tecnologia'
  | 'rh'
  | 'financas'
  | 'comercial';

export type MarketId =
  | 'financeiro'
  | 'tecnologia'
  | 'varejo'
  | 'telecom'
  | 'saude'
  | 'industria'
  | 'educacao'
  | 'consumo'
  | 'consultoria'
  | 'outros';

export type SizeId = 'pequena' | 'media' | 'grande' | 'enterprise';

/**
 * A natureza de cada informação.
 * - observado: dado medido numa base identificada (com fonte, período e recorte).
 * - estimativa: cálculo ou projeção a partir de dados, com método declarado.
 * - demonstrativo: valor de exemplo para testar a interface; não é dado de mercado.
 * - qualitativo: referência qualitativa (prática de mercado, literatura, entrevistas).
 * - recomendacao: recomendação educacional.
 * - hipotese: hipótese de produto que ainda precisa ser validada com usuários.
 * - insuficiente: não há dado confiável para o recorte escolhido.
 */
export type DataKind =
  | 'observado'
  | 'estimativa'
  | 'demonstrativo'
  | 'qualitativo'
  | 'recomendacao'
  | 'hipotese'
  | 'insuficiente';

export interface Provenance {
  kind: DataKind;
  /** Nome da fonte. Ausente quando não há fonte (ex.: dado demonstrativo). */
  source?: string;
  /** Período de referência dos dados (ex.: "2025"). */
  period?: string;
  /** Recorte geográfico. */
  geography?: string;
  /** Data da última revisão do conteúdo (AAAA-MM-DD). */
  updatedAt?: string;
  note?: string;
}

export interface Role {
  id: string;
  /** Título sem senioridade: "Analista de Marketing". */
  title: string;
  area: AreaId;
  levels: LevelId[];
  defaultLevel: LevelId;
  /** Sinônimos para a busca do seletor. */
  aliases?: string[];
}

export interface SalaryRange {
  /** Valores mensais em reais. */
  min: number;
  max: number;
  median?: number;
  percentiles?: { p10?: number; p25?: number; p50?: number; p75?: number; p90?: number };
  gross: boolean;
  /** Ex.: "CLT, salário-base mensal, sem bônus e benefícios". */
  basis: string;
}

export interface SalaryIndicator extends Provenance {
  range?: SalaryRange;
}

export interface TenureIndicator extends Provenance {
  /** Em anos. */
  minYears?: number;
  maxYears?: number;
}

export interface TextIndicator extends Provenance {
  headline: string;
  detail: string;
}

export interface Competency {
  id: string;
  name: string;
  description: string;
  /** Nível de domínio que costuma ser esperado nesta cadeira (1 a 4). */
  expected: 1 | 2 | 3 | 4;
  /** Como isso aparece no dia a dia, com exemplo concreto. */
  example: string;
  /** Ligação com o contexto (mercado/porte), quando houver. */
  contextNote?: string;
}

export interface CompetencyGroup {
  id: 'tecnico' | 'comportamental';
  title: string;
  subtitle: string;
  sections: { title: string; items: Competency[] }[];
}

export interface Deliverables {
  results: string[];
  decisions: string[];
  autonomy: string;
  kpis: string[];
  byLevel: { level: LevelId; expectation: string }[];
}

export interface NextChair {
  nextTitle: string;
  shifts: { today: string; next: string }[];
  readinessSignals: string[];
}

export interface CareerProfile {
  /** Chave "roleId:levelId". */
  key: string;
  roleId: string;
  level: LevelId;
  /** completo: conteúdo revisado para o cargo; parcial: guia genérico por senioridade e área. */
  coverage: 'completo' | 'parcial';
  summary: string;
  tenure: TenureIndicator;
  salary: SalaryIndicator;
  mainChallenge: TextIndicator;
  differentiator: TextIndicator;
  expectations: string[];
  technical: CompetencyGroup;
  behavioral: CompetencyGroup;
  deliverables: Deliverables;
  nextChair: NextChair;
}

/** Observações que mudam conforme mercado ou porte da empresa. */
export interface ContextNote {
  title: string;
  text: string;
}

export type ChallengeCategory =
  | 'poder-influencia'
  | 'comunicacao-negociacao'
  | 'regras-nao-escritas'
  | 'crescimento-promocao'
  | 'remuneracao'
  | 'lideranca'
  | 'mudanca-carreira'
  | 'conflitos-politica'
  | 'gestao-desempenho'
  | 'relacao-gestores';

export type ChallengeType =
  | 'conversa-dificil'
  | 'negociacao'
  | 'visibilidade'
  | 'leitura-de-cenario'
  | 'decisao-de-carreira';

export type CareerMoment =
  | 'quero-promocao'
  | 'novo-cargo'
  | 'mudar-de-area'
  | 'aumentar-salario'
  | 'situacao-dificil'
  | 'ganhar-influencia';

export interface Phrase {
  context: string;
  text: string;
}

/** Guia prático de 8 passos para uma situação difícil. */
export interface ChallengeGuide {
  happening: string;
  why: string[];
  understand: string[];
  prepare: string[];
  approach: { steps: string[]; phrases: Phrase[] };
  avoid: { mistake: string; consequence: string }[];
  evaluate: { progress: string[]; nextSteps: string[] };
  caution: string[];
}

export interface Challenge {
  id: string;
  title: string;
  teaser: string;
  category: ChallengeCategory;
  type: ChallengeType;
  moments: CareerMoment[];
  /** Senioridades em que a situação é mais comum. Vazio = todas. */
  levels: LevelId[];
  /** Tempo de leitura estimado, em minutos. */
  minutes: number;
  guide: ChallengeGuide;
  /** Notas específicas por mercado e porte. */
  marketNotes?: Partial<Record<MarketId, ContextNote>>;
  sizeNotes?: Partial<Record<SizeId, ContextNote>>;
  provenance: Provenance;
}

/** Conteúdo da biblioteca que não é um guia de situação difícil. */
export interface Article {
  id: string;
  title: string;
  teaser: string;
  category: ChallengeCategory;
  type: ChallengeType;
  moments: CareerMoment[];
  levels: LevelId[];
  areas: AreaId[];
  minutes: number;
  /** Perguntas em linguagem natural que este conteúdo responde. */
  questions: string[];
  sections: { title: string; body?: string; bullets?: string[] }[];
  related: string[];
  provenance: Provenance;
}

export type PdiHorizon = 30 | 60 | 90;

export type PdiKind =
  | 'competencia'
  | 'lacuna'
  | 'acao'
  | 'conversa'
  | 'experiencia'
  | 'entrega'
  | 'indicador';

export interface PdiItem {
  id: string;
  horizon: PdiHorizon;
  kind: PdiKind;
  text: string;
  /** generica: vale para qualquer pessoa no cargo; personalizada: veio da autoavaliação ou foi escrita pela pessoa. */
  origin: 'generica' | 'personalizada';
  /** Por que o item está no plano. */
  reason?: string;
  done: boolean;
}

export interface Selection {
  roleId: string;
  level: LevelId;
  marketId: MarketId;
  sizeId: SizeId;
}
