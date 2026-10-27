import type { ContextNote, MarketId, SizeId } from './types';

// Como o mercado e o porte da empresa mudam a cadeira. Referência qualitativa.

export const MARKET_CONTEXT: Record<MarketId, ContextNote> = {
  financeiro: {
    title: 'Serviços financeiros e bancos',
    text: 'Setor regulado: comunicação, dados de clientes e lançamentos passam por compliance, jurídico e risco. Ciclos de aprovação são longos e erros têm custo alto. Quem entende de regulação e antecipa revisões ganha velocidade e confiança.',
  },
  tecnologia: {
    title: 'Tecnologia e SaaS',
    text: 'Ritmo rápido, cultura de experimentação e forte uso de dados. Espera-se que você teste, meça e decida rápido. Prioridades mudam com frequência.',
  },
  varejo: {
    title: 'Varejo e e-commerce',
    text: 'Calendário promocional intenso (datas sazonais), margens apertadas e foco em conversão e ticket. Execução precisa e operação bem amarrada contam muito.',
  },
  telecom: {
    title: 'Telecomunicações',
    text: 'Base de clientes grande, foco em retenção e churn, regulação setorial e operação complexa com parceiros e canais.',
  },
  saude: {
    title: 'Saúde',
    text: 'Regulação sanitária e ética na comunicação, dados sensíveis (LGPD) e muitos públicos diferentes: pacientes, profissionais de saúde, operadoras.',
  },
  industria: {
    title: 'Indústria',
    text: 'Ciclos longos, relação com distribuidores e vendas B2B. Credibilidade técnica e proximidade com a área comercial pesam.',
  },
  educacao: {
    title: 'Educação',
    text: 'Sazonalidade de captação, ciclo de decisão longo das famílias e alunos, e forte peso de reputação e resultados acadêmicos.',
  },
  consumo: {
    title: 'Bens de consumo',
    text: 'Construção de marca, relação com varejo e trade marketing. Métricas de marca convivem com metas de sell-in e sell-out.',
  },
  consultoria: {
    title: 'Consultoria',
    text: 'Trabalho por projeto, alta exigência de qualidade e de comunicação com clientes. Visibilidade depende de sócios e gerentes que patrocinam sua carreira.',
  },
  outros: {
    title: 'Outros mercados',
    text: 'Ainda não temos observações específicas para o seu mercado. As orientações gerais continuam válidas.',
  },
};

export const SIZE_CONTEXT: Record<SizeId, ContextNote> = {
  pequena: {
    title: 'Empresa pequena',
    text: 'Escopo amplo e pouca estrutura. Você tende a acumular funções e a ter acesso direto aos fundadores. Promoções são menos formais e dependem do crescimento da empresa.',
  },
  media: {
    title: 'Empresa média',
    text: 'Processos ainda em construção. Há espaço para criar o "jeito de fazer" e ganhar visibilidade, mas as posições de liderança são poucas.',
  },
  grande: {
    title: 'Empresa grande',
    text: 'Ciclos formais de avaliação e promoção, várias diretorias e aprovações em camadas. Visibilidade fora do seu time e alianças com outras áreas pesam nas decisões de carreira.',
  },
  enterprise: {
    title: 'Enterprise',
    text: 'Estrutura matricial, comitês e muitas camadas. Promoções costumam seguir calibração entre gestores; patrocinadores e reputação construída ao longo do tempo fazem diferença.',
  },
};
