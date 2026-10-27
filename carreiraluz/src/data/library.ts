import type { Article, CareerMoment, ChallengeCategory, ChallengeType, Provenance } from './types';

export const CATEGORIES: { id: ChallengeCategory; label: string }[] = [
  { id: 'poder-influencia', label: 'Poder e influência' },
  { id: 'comunicacao-negociacao', label: 'Comunicação e negociação' },
  { id: 'regras-nao-escritas', label: 'Regras não escritas' },
  { id: 'crescimento-promocao', label: 'Crescimento e promoção' },
  { id: 'remuneracao', label: 'Remuneração' },
  { id: 'lideranca', label: 'Liderança' },
  { id: 'mudanca-carreira', label: 'Mudança de carreira' },
  { id: 'conflitos-politica', label: 'Conflitos e política organizacional' },
  { id: 'gestao-desempenho', label: 'Gestão de desempenho' },
  { id: 'relacao-gestores', label: 'Relação com gestores' },
];

export const CHALLENGE_TYPES: { id: ChallengeType; label: string }[] = [
  { id: 'conversa-dificil', label: 'Conversa difícil' },
  { id: 'negociacao', label: 'Negociação' },
  { id: 'visibilidade', label: 'Visibilidade' },
  { id: 'leitura-de-cenario', label: 'Leitura de cenário' },
  { id: 'decisao-de-carreira', label: 'Decisão de carreira' },
];

export const MOMENTS: { id: CareerMoment; label: string }[] = [
  { id: 'quero-promocao', label: 'Quero uma promoção' },
  { id: 'novo-cargo', label: 'Vou assumir um novo cargo' },
  { id: 'mudar-de-area', label: 'Quero mudar de área' },
  { id: 'aumentar-salario', label: 'Quero ganhar mais' },
  { id: 'situacao-dificil', label: 'Estou numa situação difícil' },
  { id: 'ganhar-influencia', label: 'Quero mais influência' },
];

export const categoryLabel = (id: ChallengeCategory) => CATEGORIES.find((c) => c.id === id)?.label ?? id;
export const typeLabel = (id: ChallengeType) => CHALLENGE_TYPES.find((c) => c.id === id)?.label ?? id;

const EDU: Provenance = {
  kind: 'recomendacao',
  source: 'Equipe editorial CarreiraLuz — recomendação educacional, a validar com profissionais da área',
  updatedAt: '2026-10-27',
};

export const ARTICLES: Article[] = [
  {
    id: 'projetos-estrategicos',
    title: 'Como pedir para participar de projetos estratégicos',
    teaser: 'Chegar às iniciativas que mais importam para a empresa.',
    category: 'crescimento-promocao',
    type: 'visibilidade',
    moments: ['quero-promocao', 'ganhar-influencia'],
    levels: ['pleno', 'senior', 'coordenacao'],
    areas: [],
    minutes: 4,
    questions: ['Como pedir para participar de projetos estratégicos?', 'Como entrar em projetos importantes?'],
    sections: [
      { title: 'Em resumo', body: 'Projetos estratégicos precisam de pessoas confiáveis com uma habilidade específica. Seu pedido é mais forte quando você mostra qual problema do projeto você ajuda a resolver.' },
      {
        title: 'Passo a passo',
        bullets: [
          'Descubra quais são os projetos prioritários da empresa (planejamento anual, comunicados da liderança, OKRs).',
          'Identifique onde sua habilidade ajuda: dados, comunicação, conhecimento de cliente, execução.',
          'Converse com o seu gestor antes de falar com quem lidera o projeto.',
          'Ofereça uma contribuição delimitada, com tempo definido.',
        ],
      },
      { title: 'Frase de exemplo', body: '"Vi que o projeto de [tema] é prioridade neste ano. Tenho experiência em [habilidade] e posso dedicar algumas horas por semana para apoiar em [frente]. Faz sentido conversarmos com quem lidera?"' },
      { title: 'Evite', bullets: ['Pedir para participar sem dizer como você ajuda.', 'Comprometer tempo que seu trabalho atual não permite.'] },
    ],
    related: ['escopo-maior', 'visibilidade'],
    provenance: EDU,
  },
  {
    id: 'pronto-para-gerente',
    title: 'Como saber se estou pronto(a) para ser gerente',
    teaser: 'Perguntas honestas e sinais práticos antes da transição para a gestão.',
    category: 'lideranca',
    type: 'decisao-de-carreira',
    moments: ['quero-promocao', 'novo-cargo'],
    levels: ['senior', 'coordenacao'],
    areas: [],
    minutes: 5,
    questions: ['Como saber se estou pronto para ser gerente?', 'Estou preparado para liderar pessoas?', 'Quando virar gestor?'],
    sections: [
      { title: 'Em resumo', body: 'Gestão é outra profissão: o resultado passa a vir das pessoas do time. Estar pronto(a) tem mais a ver com já exercer liderança informal do que com tempo de casa.' },
      {
        title: 'Sinais de prontidão (referência, não diagnóstico)',
        bullets: [
          'Você já orienta pessoas e elas procuram você para isso.',
          'Você consegue abrir mão de fazer para ensinar a fazer.',
          'Você lida com conversas difíceis sem evitá-las.',
          'Você entende a estratégia da área e consegue explicá-la.',
          'Você sente energia, e não só obrigação, ao pensar em desenvolver pessoas.',
        ],
      },
      {
        title: 'Perguntas para refletir',
        bullets: [
          'Por que quero ser gerente? (Pessoas, impacto, remuneração, status?)',
          'Estou disposto(a) a ter menos tempo para o trabalho técnico?',
          'Existe um caminho de especialista na minha empresa que me atenderia?',
        ],
      },
      { title: 'Próximo passo', body: 'Converse com o seu gestor sobre o interesse e peça uma experiência de liderança informal (coordenar um projeto, acompanhar uma pessoa nova).' },
    ],
    related: ['interesse-liderar', 'sinais-promocao'],
    provenance: EDU,
  },
  {
    id: 'conversar-salario',
    title: 'Como conversar com meu chefe sobre salário',
    teaser: 'Um roteiro curto para a primeira conversa sobre remuneração.',
    category: 'remuneracao',
    type: 'negociacao',
    moments: ['aumentar-salario'],
    levels: [],
    areas: [],
    minutes: 3,
    questions: ['Como conversar com meu chefe sobre salário?', 'Como falar de dinheiro com o gestor?', 'Como pedir reajuste?'],
    sections: [
      { title: 'Em resumo', body: 'A primeira conversa sobre salário não precisa ser uma negociação. Pode ser um alinhamento: como funciona a política, onde você está na faixa e o que seria preciso para avançar.' },
      {
        title: 'Roteiro',
        bullets: [
          'Peça a conversa com antecedência e diga o tema.',
          'Pergunte como funcionam mérito e promoção na empresa.',
          'Pergunte em que ponto da faixa você está e o que levaria você ao próximo.',
          'Combine uma data para retomar.',
        ],
      },
      { title: 'Frase de exemplo', body: '"Queria entender melhor como funciona a política de remuneração e como posso evoluir dentro dela. Você me ajuda?"' },
      { title: 'Para uma negociação completa', body: 'Veja o guia "Como pedir aumento e negociar remuneração".' },
    ],
    related: ['pedir-aumento'],
    provenance: EDU,
  },
  {
    id: 'primeiros-90-dias',
    title: 'Os primeiros 90 dias em um novo cargo',
    teaser: 'O que observar, quem conhecer e quando começar a propor mudanças.',
    category: 'regras-nao-escritas',
    type: 'leitura-de-cenario',
    moments: ['novo-cargo'],
    levels: [],
    areas: [],
    minutes: 5,
    questions: ['O que fazer nos primeiros dias de um novo cargo?', 'Como começar bem em um emprego novo?'],
    sections: [
      { title: 'Em resumo', body: 'Nos primeiros 90 dias, entender vem antes de mudar. Construa relações, entenda as regras não escritas e busque uma vitória rápida e visível.' },
      {
        title: 'Primeiros 30 dias',
        bullets: ['Converse com gestor, pares e áreas parceiras.', 'Pergunte o que esperam de você e o que já foi tentado.', 'Mapeie quem decide o quê.'],
      },
      {
        title: '30 a 60 dias',
        bullets: ['Escolha uma vitória rápida alinhada à prioridade do gestor.', 'Comece a propor melhorias pequenas.'],
      },
      {
        title: '60 a 90 dias',
        bullets: ['Apresente um diagnóstico e um plano.', 'Combine metas para os próximos meses.'],
      },
    ],
    related: ['aliancas', 'visibilidade'],
    provenance: EDU,
  },
  {
    id: 'mudar-de-area',
    title: 'Como planejar uma mudança de área',
    teaser: 'Transferir o que você já sabe e preencher as lacunas certas.',
    category: 'mudanca-carreira',
    type: 'decisao-de-carreira',
    moments: ['mudar-de-area'],
    levels: [],
    areas: [],
    minutes: 5,
    questions: ['Como mudar de área?', 'Como fazer transição de carreira dentro da empresa?'],
    sections: [
      { title: 'Em resumo', body: 'Mudanças de área dão mais certo quando você leva uma habilidade valiosa para a área nova e se aproxima dela antes de pedir a transferência.' },
      {
        title: 'Passo a passo',
        bullets: [
          'Converse com pessoas da área de destino sobre o dia a dia real.',
          'Identifique o que você já sabe que é útil lá.',
          'Escolha uma ou duas lacunas para desenvolver primeiro.',
          'Participe de um projeto conjunto antes de pedir a mudança.',
        ],
      },
      { title: 'Atenção', body: 'Mudar de área pode significar começar em um nível um pouco abaixo. Avalie se a troca compensa no médio prazo.' },
    ],
    related: ['vaga-interna', 'poucas-possibilidades'],
    provenance: EDU,
  },
  {
    id: 'avaliacao-desempenho',
    title: 'Como se preparar para a avaliação de desempenho',
    teaser: 'Chegar ao ciclo com evidências, e não com memória.',
    category: 'gestao-desempenho',
    type: 'conversa-dificil',
    moments: ['quero-promocao', 'aumentar-salario'],
    levels: [],
    areas: [],
    minutes: 4,
    questions: ['Como me preparar para a avaliação de desempenho?', 'O que levar para o feedback anual?'],
    sections: [
      { title: 'Em resumo', body: 'Avaliações são decididas, muitas vezes, antes da conversa. Ajudar o gestor com evidências organizadas aumenta suas chances de ser bem representado(a) na calibração.' },
      {
        title: 'O que preparar',
        bullets: [
          'Lista de entregas do ciclo, com resultado e conexão com metas.',
          'Feedbacks recebidos de outras áreas.',
          'O que você aprendeu e o que quer desenvolver.',
        ],
      },
      { title: 'Dica', body: 'Envie esse resumo ao gestor algumas semanas antes do fechamento do ciclo.' },
    ],
    related: ['pouco-reconhecimento', 'visibilidade'],
    provenance: EDU,
  },
];

export const findArticle = (id: string) => ARTICLES.find((a) => a.id === id);
