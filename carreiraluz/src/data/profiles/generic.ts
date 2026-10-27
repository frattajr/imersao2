import { findRole, levelLabel, nextLevel, roleTitle } from '../catalog';
import type { AreaId, CareerProfile, Competency, LevelId } from '../types';

// Guia genérico: combina o que costuma valer para a ÁREA com o que costuma
// valer para a SENIORIDADE. É o que aparece enquanto um cargo ainda não tem
// conteúdo revisado. Indicadores numéricos ficam como "dados insuficientes".

const REVIEWED = '2026-10-27';

interface AreaTemplate {
  tools: string;
  toolsExample: string;
  metrics: string;
  metricsExample: string;
  process: string;
  processExample: string;
}

const AREA: Record<AreaId, AreaTemplate> = {
  marketing: {
    tools: 'Plataformas de mídia, automação de marketing, analytics e testes A/B.',
    toolsExample: 'Configurar uma campanha com UTMs padronizadas para conseguir comparar canais depois.',
    metrics: 'Alcance, conversão, CAC, ROI de mídia, lembrança de marca.',
    metricsExample: 'Mostrar o custo por cliente ativado, e não só por cadastro.',
    process: 'Briefing, aprovação, produção, veiculação e leitura de resultados.',
    processExample: 'Prever o tempo de aprovação jurídica no cronograma.',
  },
  growth: {
    tools: 'Analytics de produto, ferramentas de experimentação, SQL e plataformas de mídia.',
    toolsExample: 'Montar um funil de ativação no analytics e encontrar a etapa com maior perda.',
    metrics: 'Ativação, retenção por coorte, CAC, LTV, payback, taxa de experimento vencedor.',
    metricsExample: 'Comparar a retenção de 30 dias entre coortes antes e depois de uma mudança no onboarding.',
    process: 'Ciclo de hipótese, priorização (ICE/RICE), experimento e aprendizado.',
    processExample: 'Registrar cada experimento com hipótese, resultado e decisão tomada.',
  },
  crm: {
    tools: 'Plataformas de CRM e automação, segmentação, e-mail, push e SMS.',
    toolsExample: 'Montar uma régua de boas-vindas com segmentos por comportamento.',
    metrics: 'Abertura, clique, conversão, churn, frequência de compra, receita por base.',
    metricsExample: 'Medir a receita incremental de uma régua com grupo de controle.',
    process: 'Segmentação, jornada, consentimento e frequência de contato.',
    processExample: 'Respeitar opt-out e regras da LGPD ao criar novos segmentos.',
  },
  dados: {
    tools: 'SQL, Python ou R, ferramentas de BI, versionamento e boas práticas de modelagem.',
    toolsExample: 'Transformar uma consulta repetida em uma tabela documentada que outras pessoas reutilizam.',
    metrics: 'Qualidade dos dados, adoção de painéis, tempo de resposta, impacto das análises em decisões.',
    metricsExample: 'Acompanhar quantas análises viraram decisão no trimestre.',
    process: 'Entendimento da pergunta de negócio, coleta, validação, análise e comunicação.',
    processExample: 'Começar pela decisão que a análise vai apoiar antes de abrir o SQL.',
  },
  produto: {
    tools: 'Discovery, analytics de produto, roadmaps, prototipação e escrita de requisitos.',
    toolsExample: 'Conduzir cinco entrevistas com usuários antes de priorizar uma funcionalidade.',
    metrics: 'Adoção, retenção, conversão do fluxo, satisfação, impacto em receita ou custo.',
    metricsExample: 'Definir a métrica de sucesso de uma funcionalidade antes de construí-la.',
    process: 'Discovery, priorização, entrega com engenharia e acompanhamento pós-lançamento.',
    processExample: 'Revisar o resultado de cada entrega 30 dias depois do lançamento.',
  },
  tecnologia: {
    tools: 'Linguagens e frameworks do time, testes automatizados, CI/CD e observabilidade.',
    toolsExample: 'Adicionar testes e métricas a um serviço crítico antes de refatorá-lo.',
    metrics: 'Frequência de deploy, tempo de recuperação, taxa de falhas, tempo de ciclo.',
    metricsExample: 'Reduzir o tempo entre o merge e a produção de dias para horas.',
    process: 'Revisão de código, desenho técnico, incidentes e planejamento.',
    processExample: 'Escrever um documento de desenho curto antes de mudanças grandes.',
  },
  rh: {
    tools: 'Sistemas de RH, pesquisa de clima, ciclos de avaliação e indicadores de pessoas.',
    toolsExample: 'Cruzar resultado de clima com rotatividade por área para priorizar ações.',
    metrics: 'Turnover, tempo de contratação, engajamento, promoções internas, absenteísmo.',
    metricsExample: 'Mostrar o custo da rotatividade de uma área para justificar um plano de retenção.',
    process: 'Recrutamento, avaliação de desempenho, remuneração, desenvolvimento e relações trabalhistas.',
    processExample: 'Preparar gestores antes do ciclo de avaliação com roteiros de conversa.',
  },
  financas: {
    tools: 'Planilhas avançadas, ERP, modelagem financeira e ferramentas de BI.',
    toolsExample: 'Construir um modelo de orçamento com premissas separadas dos cálculos.',
    metrics: 'Receita, margem, EBITDA, fluxo de caixa, desvio entre orçado e realizado.',
    metricsExample: 'Explicar o desvio do mês em três causas principais, em uma página.',
    process: 'Fechamento, orçamento, forecast, análise de investimentos e controles.',
    processExample: 'Antecipar ao gestor os riscos do forecast antes da reunião com a diretoria.',
  },
  comercial: {
    tools: 'CRM de vendas, metodologias de qualificação e negociação, previsão de vendas.',
    toolsExample: 'Manter o pipeline atualizado com próximos passos e data provável de fechamento.',
    metrics: 'Meta, conversão por etapa, ticket médio, ciclo de venda, precisão do forecast.',
    metricsExample: 'Identificar em qual etapa do funil as oportunidades mais travam.',
    process: 'Prospecção, qualificação, proposta, negociação, fechamento e expansão.',
    processExample: 'Envolver jurídico e financeiro cedo em propostas fora do padrão.',
  },
};

type Tier = 'inicio' | 'meio' | 'senior' | 'gestao' | 'executivo';

const TIER: Record<LevelId, Tier> = {
  junior: 'inicio',
  pleno: 'meio',
  senior: 'senior',
  coordenacao: 'gestao',
  gerencia: 'gestao',
  'gerencia-senior': 'executivo',
  diretoria: 'executivo',
};

const LEVEL: Record<Tier, {
  expected: 1 | 2 | 3 | 4;
  expectations: string[];
  challenge: string;
  challengeDetail: string;
  differentiator: string;
  differentiatorDetail: string;
  autonomy: string;
  decisions: string[];
  shifts: { today: string; next: string }[];
}> = {
  inicio: {
    expected: 2,
    expectations: [
      'Executar tarefas bem definidas com qualidade e no prazo.',
      'Aprender as ferramentas, os processos e o vocabulário da área.',
      'Pedir ajuda cedo e fazer boas perguntas.',
    ],
    challenge: 'Ganhar confiança sem ainda ter repertório',
    challengeDetail: 'No início, o desafio é aprender rápido sem esconder dúvidas e mostrar confiabilidade em tarefas pequenas.',
    differentiator: 'Curiosidade, confiabilidade e aprendizado rápido',
    differentiatorDetail: 'Quem se destaca entrega o combinado, entende o porquê das tarefas e transforma feedback em melhoria visível.',
    autonomy: 'Baixa a moderada: a pessoa executa com orientação e revisões frequentes.',
    decisions: ['Como organizar o próprio trabalho dentro do prazo.', 'Quando pedir ajuda.'],
    shifts: [
      { today: 'Executar tarefas definidas por outras pessoas.', next: 'Conduzir entregas inteiras com pouca supervisão.' },
      { today: 'Seguir o processo.', next: 'Entender o processo a ponto de sugerir melhorias.' },
    ],
  },
  meio: {
    expected: 3,
    expectations: [
      'Conduzir entregas de ponta a ponta com orientação pontual.',
      'Analisar resultados e propor ajustes.',
      'Colaborar com outras áreas de forma autônoma.',
    ],
    challenge: 'Sair do papel de executor(a) para o de dono(a) da entrega',
    challengeDetail: 'No nível pleno, espera-se que a pessoa resolva problemas sem precisar que alguém os quebre em tarefas.',
    differentiator: 'Autonomia, senso de dono e análise crítica',
    differentiatorDetail: 'Quem se destaca antecipa problemas, propõe soluções e mostra o impacto do que faz.',
    autonomy: 'Moderada: decide o como, alinha o quê e o quando com a liderança.',
    decisions: ['Como executar uma entrega.', 'Ajustes táticos dentro do escopo combinado.'],
    shifts: [
      { today: 'Conduzir entregas com orientação.', next: 'Planejar e conduzir sozinho(a), recomendando decisões.' },
      { today: 'Analisar quando pedido.', next: 'Trazer análises e recomendações por iniciativa própria.' },
    ],
  },
  senior: {
    expected: 4,
    expectations: [
      'Planejar e executar com autonomia projetos complexos.',
      'Recomendar decisões com base em evidências.',
      'Ser referência técnica e apoiar pessoas menos experientes.',
    ],
    challenge: 'Equilibrar demandas operacionais e impacto estratégico',
    challengeDetail: 'Quem é sênior vira o recurso mais confiável para urgências, e isso consome o tempo de trabalho estratégico.',
    differentiator: 'Visão de negócio, profundidade técnica e influência sem autoridade',
    differentiatorDetail: 'Quem se destaca conecta o trabalho às metas da empresa e mobiliza outras áreas.',
    autonomy: 'Alta na execução; compartilhada em decisões que mudam meta ou orçamento.',
    decisions: ['Priorização dentro da própria frente.', 'Escolhas técnicas e táticas.', 'O que parar quando algo não funciona.'],
    shifts: [
      { today: 'Executar com excelência.', next: 'Definir prioridades para um grupo.' },
      { today: 'Ser a referência técnica.', next: 'Desenvolver outras pessoas.' },
      { today: 'Influenciar no seu projeto.', next: 'Influenciar decisões de outras áreas.' },
    ],
  },
  gestao: {
    expected: 4,
    expectations: [
      'Definir prioridades do time e responder pelos resultados.',
      'Contratar, desenvolver e dar feedback.',
      'Negociar recursos e prazos com outras lideranças.',
    ],
    challenge: 'Liderar pessoas sem deixar de entregar resultado',
    challengeDetail: 'A transição para a gestão exige soltar a execução e passar a obter resultado por meio de outras pessoas.',
    differentiator: 'Clareza de prioridades, desenvolvimento do time e trânsito entre áreas',
    differentiatorDetail: 'Quem se destaca forma um time que entrega sem depender da sua presença em tudo.',
    autonomy: 'Alta no time; compartilhada com a diretoria em orçamento e estratégia.',
    decisions: ['Prioridades e distribuição do trabalho.', 'Contratações e avaliação de desempenho.', 'Alocação de orçamento da área.'],
    shifts: [
      { today: 'Gerir a execução do time.', next: 'Definir a estratégia da área e o desenho do time.' },
      { today: 'Negociar com pares.', next: 'Negociar com a diretoria e o comitê executivo.' },
    ],
  },
  executivo: {
    expected: 4,
    expectations: [
      'Definir estratégia e metas da área em linha com a empresa.',
      'Formar lideranças e desenhar a organização.',
      'Representar a área em fóruns executivos.',
    ],
    challenge: 'Tomar decisões com informação incompleta e alto impacto',
    challengeDetail: 'No nível executivo, as decisões afetam muitas pessoas e raramente há dados completos.',
    differentiator: 'Visão estratégica, formação de líderes e capital político',
    differentiatorDetail: 'Quem se destaca constrói alianças e deixa uma estrutura que funciona sem depender de si.',
    autonomy: 'Muito alta; presta contas ao comitê executivo ou ao conselho.',
    decisions: ['Estratégia e orçamento da área.', 'Estrutura organizacional.', 'Parcerias e investimentos relevantes.'],
    shifts: [
      { today: 'Liderar uma área.', next: 'Influenciar a estratégia da empresa como um todo.' },
    ],
  },
};

function comp(id: string, name: string, description: string, expected: 1 | 2 | 3 | 4, example: string): Competency {
  return { id, name, description, expected, example };
}

export function buildGenericProfile(roleId: string, level: LevelId): CareerProfile | null {
  const role = findRole(roleId);
  if (!role) return null;
  const a = AREA[role.area];
  const t = LEVEL[TIER[level]];
  const e = t.expected;
  const lower = (Math.max(1, e - 1) as 1 | 2 | 3 | 4);
  const nxt = nextLevel(level);

  return {
    key: `${roleId}:${level}`,
    roleId,
    level,
    coverage: 'parcial',
    summary: `Guia genérico para ${roleTitle(roleId, level)}: combina o que costuma ser esperado na área com o que costuma ser esperado no nível ${levelLabel(level)}. O conteúdo específico deste cargo ainda está em construção.`,
    tenure: {
      kind: 'insuficiente',
      note: 'Ainda não temos dados confiáveis de permanência para este recorte.',
    },
    salary: {
      kind: 'insuficiente',
      note: 'Ainda não temos dados salariais confiáveis para este recorte. Preferimos não mostrar um número a mostrar um número inventado.',
    },
    mainChallenge: {
      kind: 'qualitativo',
      headline: t.challenge,
      detail: t.challengeDetail,
      source: 'Referência qualitativa genérica por senioridade (CarreiraLuz)',
      updatedAt: REVIEWED,
    },
    differentiator: {
      kind: 'qualitativo',
      headline: t.differentiator,
      detail: t.differentiatorDetail,
      source: 'Referência qualitativa genérica por senioridade (CarreiraLuz)',
      updatedAt: REVIEWED,
    },
    expectations: t.expectations,
    technical: {
      id: 'tecnico',
      title: 'Conhecimentos técnicos',
      subtitle: 'Referência genérica da área — ainda não revisada para este cargo.',
      sections: [
        { title: 'Ferramentas e metodologias', items: [comp('tec-ferramentas', 'Ferramentas da área', a.tools, e, a.toolsExample)] },
        { title: 'Indicadores e métricas essenciais', items: [comp('tec-metricas', 'Indicadores da área', a.metrics, lower, a.metricsExample)] },
        { title: 'Processos que precisa dominar', items: [comp('tec-processos', 'Processos centrais', a.process, e, a.processExample)] },
        {
          title: 'Análise e tomada de decisão',
          items: [comp('tec-analise', 'Análise e recomendação', 'Interpretar dados e transformar em decisão.', lower, 'Terminar cada análise com uma recomendação clara.')],
        },
      ],
    },
    behavioral: {
      id: 'comportamental',
      title: 'Competências comportamentais',
      subtitle: 'Como você trabalha com pessoas e lida com ambiguidade.',
      sections: [
        {
          title: 'Comunicação e pensamento',
          items: [
            comp('comp-comunicacao', 'Comunicação e clareza de raciocínio', 'Começar pela conclusão e adaptar a mensagem ao público.', e, 'Resumir um projeto em três frases para quem não participou dele.'),
            comp('comp-critico', 'Pensamento crítico', 'Questionar premissas e pedir evidências.', lower, 'Perguntar o que mais poderia explicar um resultado antes de comemorá-lo.'),
          ],
        },
        {
          title: 'Autogestão',
          items: [comp('comp-priorizacao', 'Priorização e autonomia', 'Escolher o que não fazer e avisar cedo sobre riscos.', e, 'Renegociar um prazo assim que perceber o risco, não na véspera.')],
        },
        {
          title: 'Relações e influência',
          items: [
            comp('comp-conflitos', 'Gestão de conflitos', 'Tratar divergência como problema a resolver.', lower, 'Levar dados a uma discussão que estava baseada em opinião.'),
            comp('comp-influencia', 'Negociação e influência', 'Conseguir apoio de quem não responde a você.', lower, 'Entender o que a outra área ganha antes de pedir ajuda.'),
            comp('comp-colaboracao', 'Trabalho com outras áreas', 'Construir relações antes de precisar delas.', lower, 'Reconhecer publicamente a contribuição de outras áreas.'),
          ],
        },
      ],
    },
    deliverables: {
      results: t.expectations,
      decisions: t.decisions,
      autonomy: t.autonomy,
      kpis: a.metrics.split(', ').map((m) => m.replace(/\.$/, '')),
      byLevel: [
        { level, expectation: t.expectations[0] },
        ...(nxt ? [{ level: nxt, expectation: LEVEL[TIER[nxt]].expectations[0] }] : []),
      ],
    },
    nextChair: {
      nextTitle: nxt ? levelLabel(nxt) : 'Posições executivas ou de conselho',
      shifts: t.shifts,
      readinessSignals: [
        'Você já faz parte do trabalho do próximo nível, mesmo que informalmente.',
        'Sua liderança pede sua opinião sobre prioridades.',
        'Outras áreas procuram você para resolver problemas.',
      ],
    },
  };
}
