import type { CareerProfile } from '../types';

// Perfil de referência do MVP: Analista de Marketing Sênior.
// O conteúdo qualitativo foi escrito para ser revisado por profissionais da
// área. Os números dos indicadores são DEMONSTRATIVOS: servem para testar a
// interface e não devem ser lidos como dado de mercado.

export const analistaMarketingSenior: CareerProfile = {
  key: 'analista-marketing:senior',
  roleId: 'analista-marketing',
  level: 'senior',
  coverage: 'completo',
  summary:
    'A pessoa sênior em marketing é quem transforma um objetivo de negócio em um plano executável, coordena a execução com várias áreas e consegue explicar, com números, o que funcionou e por quê. Ela não precisa de alguém dizendo o próximo passo.',

  tenure: {
    kind: 'demonstrativo',
    minYears: 2,
    maxYears: 4,
    note:
      'Valor de exemplo para testar a interface. Ainda não há uma base pública integrada que meça permanência por cargo e senioridade neste recorte.',
    updatedAt: '2026-10-27',
  },

  salary: {
    kind: 'demonstrativo',
    range: {
      min: 7000,
      max: 12000,
      gross: true,
      basis: 'Salário-base mensal bruto, CLT, sem bônus, PLR e benefícios',
    },
    geography: 'Brasil (sem recorte regional)',
    note:
      'Faixa de exemplo usada para testar a interface. Não é observação de mercado. Mediana e percentis só aparecem quando houver dados observados suficientes.',
    updatedAt: '2026-10-27',
  },

  mainChallenge: {
    kind: 'qualitativo',
    headline: 'Equilibrar demandas operacionais e impacto estratégico',
    detail:
      'A pessoa sênior costuma ser a mais confiável para "apagar incêndios", e é justamente isso que consome o tempo que ela precisaria para propor e conduzir iniciativas de maior impacto. Quem não protege parte da agenda para o estratégico tende a ficar marcada como ótima executora, e não como alguém pronta para o próximo nível.',
    source: 'Referência qualitativa: práticas recorrentes de mercado, compiladas pela equipe CarreiraLuz',
    updatedAt: '2026-10-27',
  },

  differentiator: {
    kind: 'qualitativo',
    headline: 'Visão de negócio, capacidade analítica e influência sem autoridade',
    detail:
      'O profissional mediano entrega bem o que foi pedido. O que se destaca entende qual meta de negócio aquela entrega move, usa dados para escolher onde investir esforço e consegue convencer áreas sobre as quais não tem autoridade formal (produto, jurídico, vendas, dados).',
    source: 'Referência qualitativa: práticas recorrentes de mercado, compiladas pela equipe CarreiraLuz',
    updatedAt: '2026-10-27',
  },

  expectations: [
    'Planejar e conduzir campanhas e projetos de ponta a ponta, sem supervisão no dia a dia.',
    'Traduzir metas de negócio (captação, ativação, receita, retenção) em objetivos de marketing mensuráveis.',
    'Ler resultados com senso crítico e recomendar o que manter, ajustar ou parar.',
    'Ser referência para analistas mais novos, revisando trabalhos e explicando o porquê das escolhas.',
    'Negociar prazos, escopo e recursos com outras áreas e com fornecedores.',
  ],

  technical: {
    id: 'tecnico',
    title: 'Conhecimentos técnicos',
    subtitle: 'O que você precisa saber fazer e entender para executar com qualidade.',
    sections: [
      {
        title: 'Ferramentas e metodologias',
        items: [
          {
            id: 'tec-ferramentas',
            name: 'Stack de marketing e mensuração',
            description: 'Plataformas de mídia, ferramentas de automação, analytics web/app e testes A/B.',
            expected: 3,
            example:
              'Configurar um teste A/B de página de captação, definir a métrica primária antes de rodar e saber quando o resultado ainda não é conclusivo.',
          },
          {
            id: 'tec-planejamento',
            name: 'Planejamento de campanha',
            description: 'Briefing, público, mensagem, canais, cronograma, orçamento e plano de mensuração.',
            expected: 4,
            example:
              'Montar um plano de lançamento de um cartão com metas por canal, orçamento distribuído e marcos de revisão semanal.',
          },
        ],
      },
      {
        title: 'Indicadores e métricas essenciais',
        items: [
          {
            id: 'tec-metricas',
            name: 'Funil e economia da aquisição',
            description: 'CAC, conversão por etapa, LTV, payback, ROI de mídia e incrementalidade.',
            expected: 3,
            example:
              'Explicar por que uma campanha com CPA baixo pode ser ruim se atrai clientes com baixa ativação e alto risco de crédito.',
          },
        ],
      },
      {
        title: 'Conhecimento do segmento',
        items: [
          {
            id: 'tec-segmento',
            name: 'Produto, cliente e regulação do setor',
            description: 'Como o produto gera receita, quem é o cliente e quais regras limitam a comunicação.',
            expected: 3,
            example:
              'Saber que uma peça de crédito precisa informar custo efetivo total e por que o jurídico pede ajustes em promessas de "aprovação fácil".',
            contextNote:
              'Em serviços financeiros, comunicação de produtos passa por compliance e segue normas de órgãos como Banco Central e CVM, além da autorregulação do setor. Entender isso evita retrabalho e ganha a confiança do jurídico.',
          },
        ],
      },
      {
        title: 'Processos que precisa dominar',
        items: [
          {
            id: 'tec-processos',
            name: 'Fluxo de aprovação e operação entre áreas',
            description: 'Quem aprova o quê, prazos reais de cada área e como antecipar gargalos.',
            expected: 3,
            example:
              'Incluir no cronograma uma semana para revisão jurídica e alinhar com produto antes de prometer data de lançamento.',
          },
        ],
      },
      {
        title: 'Análise e tomada de decisão',
        items: [
          {
            id: 'tec-analise',
            name: 'Análise de resultados e recomendação',
            description: 'Ir além do relatório: interpretar, separar causa de coincidência e recomendar uma decisão.',
            expected: 4,
            example:
              'Fechar o relatório mensal com três recomendações priorizadas, cada uma com impacto esperado e o que seria preciso para executá-la.',
          },
        ],
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
          {
            id: 'comp-comunicacao',
            name: 'Comunicação e clareza de raciocínio',
            description: 'Começar pela conclusão, adaptar a mensagem ao público e ser breve.',
            expected: 4,
            example: 'Abrir uma apresentação para a diretoria com "Recomendamos X porque Y; precisamos de Z até sexta".',
          },
          {
            id: 'comp-critico',
            name: 'Pensamento crítico',
            description: 'Questionar premissas, inclusive as próprias, e pedir evidências antes de concluir.',
            expected: 3,
            example: 'Perguntar se o aumento de conversão veio da campanha ou de uma mudança de preço que aconteceu na mesma semana.',
          },
        ],
      },
      {
        title: 'Autogestão',
        items: [
          {
            id: 'comp-priorizacao',
            name: 'Priorização e autonomia',
            description: 'Decidir o que não fazer e avisar cedo quando algo vai atrasar.',
            expected: 4,
            example: 'Propor ao gestor trocar uma demanda de baixo impacto de data para proteger o lançamento do trimestre.',
          },
        ],
      },
      {
        title: 'Relações e influência',
        items: [
          {
            id: 'comp-conflitos',
            name: 'Gestão de conflitos',
            description: 'Tratar divergência como problema a resolver, não como disputa pessoal.',
            expected: 3,
            example: 'Mediar a discordância entre design e produto sobre o fluxo de cadastro levando dados de abandono para a conversa.',
          },
          {
            id: 'comp-influencia',
            name: 'Negociação e influência',
            description: 'Conseguir apoio de quem não responde a você, entendendo o que essa pessoa precisa.',
            expected: 3,
            example: 'Convencer o time de dados a priorizar um painel mostrando quanto tempo o painel economiza para a área deles também.',
          },
          {
            id: 'comp-colaboracao',
            name: 'Trabalho com outras áreas',
            description: 'Construir relações antes de precisar delas e dar crédito publicamente.',
            expected: 3,
            example: 'Manter uma conversa quinzenal com o ponto focal de vendas para ouvir o que os clientes estão perguntando.',
          },
        ],
      },
    ],
  },

  deliverables: {
    results: [
      'Plano de campanha completo, com metas, orçamento e mensuração definidos antes da execução.',
      'Relatórios que terminam em recomendação, não apenas em números.',
      'Campanhas entregues no prazo, com retrabalho baixo em aprovações.',
      'Aprendizados documentados e compartilhados com o time.',
    ],
    decisions: [
      'Redistribuir orçamento entre canais dentro de uma faixa combinada.',
      'Pausar uma ação que não está performando e propor alternativa.',
      'Escolher fornecedor ou formato dentro do escopo aprovado.',
      'Definir o que entra no teste e qual é a métrica de sucesso.',
    ],
    autonomy:
      'Alta na execução e na tática; compartilhada nas decisões que mudam meta, orçamento total ou posicionamento da marca. O gestor deve ser informado, não consultado a cada passo.',
    kpis: [
      'Atingimento de metas de captação, ativação ou receita atribuídas ao marketing.',
      'Eficiência de mídia (CAC, ROI) em relação ao planejado.',
      'Prazo e taxa de retrabalho nas aprovações.',
      'Qualidade das recomendações: quantas viraram decisão.',
    ],
    byLevel: [
      { level: 'pleno', expectation: 'Executa bem com orientação no planejamento; analisa resultados quando pedido.' },
      { level: 'senior', expectation: 'Planeja e executa sozinho(a), recomenda decisões e apoia pessoas mais novas.' },
      { level: 'coordenacao', expectation: 'Define prioridades do time, distribui trabalho e responde pelos resultados do grupo.' },
    ],
  },

  nextChair: {
    nextTitle: 'Coordenação de Marketing',
    shifts: [
      { today: 'Executar campanhas e analisar resultados.', next: 'Definir prioridades e decidir onde o time investe energia.' },
      { today: 'Cumprir metas da sua frente.', next: 'Conectar as iniciativas do time às metas de negócio e prestar contas por elas.' },
      { today: 'Pedir apoio de outras áreas para o seu projeto.', next: 'Influenciar decisões de outras áreas e negociar prioridades no nível da liderança.' },
      { today: 'Ser a referência técnica.', next: 'Desenvolver outras pessoas para que elas sejam a referência.' },
      { today: 'Ser avaliado(a) pelo que entrega.', next: 'Ser avaliado(a) pelo que o time entrega e pelo clima que constrói.' },
    ],
    readinessSignals: [
      'Você já coordena informalmente outras pessoas em projetos.',
      'Seu gestor delega decisões e pede sua opinião sobre prioridades.',
      'Outras áreas procuram você diretamente para resolver problemas.',
      'Você consegue explicar a estratégia da área em dois minutos para alguém de fora.',
    ],
  },
};
