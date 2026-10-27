import type { Challenge, Provenance } from './types';

// Biblioteca "Desafios que ninguém conversa".
// Conteúdo educacional: ensina a avaliar cenários, não afirma a intenção de
// ninguém. Cada guia segue os mesmos 8 passos.

const EDU: Provenance = {
  kind: 'recomendacao',
  source: 'Equipe editorial CarreiraLuz — recomendação educacional, a validar com profissionais da área',
  updatedAt: '2026-10-27',
};

const IC_AND_COORD = ['pleno', 'senior', 'coordenacao'] as const;

export const CHALLENGES: Challenge[] = [
  {
    id: 'escopo-maior',
    title: 'Como pedir um escopo maior sem parecer insatisfeito',
    teaser: 'Mostrar ambição sem soar como reclamação sobre o que você já faz.',
    category: 'crescimento-promocao',
    type: 'conversa-dificil',
    moments: ['quero-promocao', 'ganhar-influencia'],
    levels: [...IC_AND_COORD],
    minutes: 6,
    guide: {
      happening:
        'Você domina o que faz hoje e sente que poderia contribuir mais. O receio é que pedir mais responsabilidade soe como "não estou satisfeito(a) com o meu trabalho" ou como crítica ao gestor por não ter oferecido antes.',
      why: [
        'Gestores costumam distribuir escopo para quem já demonstrou dar conta, e muitas vezes não percebem que alguém está pronto(a) para mais.',
        'Escopo novo costuma significar risco para o gestor: se der errado, ele também responde.',
        'Em empresas grandes, o escopo de cada área é negociado entre lideranças; nem sempre o seu gestor tem o que oferecer sem conversar com outras pessoas.',
      ],
      understand: [
        'Pedir escopo é uma conversa sobre o problema que você quer resolver, não sobre você.',
        'Seu histórico recente de entregas é o seu principal argumento.',
        'O "não agora" é uma resposta comum e não significa "nunca".',
      ],
      prepare: [
        'Liste três entregas recentes com o resultado de cada uma (números, prazos, elogios recebidos).',
        'Escolha um problema concreto da área que ninguém está cuidando bem e que se conecta à meta do seu gestor.',
        'Pense em como liberar tempo: o que você pode delegar, automatizar ou simplificar do escopo atual.',
        'Tenha uma alternativa menor (um piloto de 60 dias, por exemplo).',
      ],
      approach: {
        steps: [
          'Peça uma conversa específica, não aproveite o fim de uma reunião de status.',
          'Comece pelo que está indo bem e pelo seu interesse em contribuir mais.',
          'Apresente o problema e a proposta, não apenas o desejo de crescer.',
          'Mostre como o seu trabalho atual continua coberto.',
          'Pergunte o que o gestor precisaria ver para dizer sim.',
        ],
        phrases: [
          { context: 'Abrir a conversa', text: 'Queria conversar sobre como posso contribuir mais com as metas do time nos próximos meses.' },
          { context: 'Apresentar a proposta', text: 'Percebi que [problema] está sem dono e afeta [meta]. Eu gostaria de assumir isso, começando por [primeiro passo].' },
          { context: 'Antecipar a objeção', text: 'Para não prejudicar o que já faço, pensei em [como liberar tempo]. Faz sentido para você?' },
          { context: 'Se a resposta for "agora não"', text: 'Entendo. O que você precisaria ver de mim para que isso fosse possível no próximo trimestre?' },
        ],
      },
      avoid: [
        { mistake: 'Comparar-se com colegas ("fulano tem mais escopo que eu").', consequence: 'A conversa vira disputa e o gestor fica na defensiva.' },
        { mistake: 'Pedir escopo enquanto há entregas atrasadas.', consequence: 'O pedido perde credibilidade imediatamente.' },
        { mistake: 'Falar só do que você quer, sem falar do que a área ganha.', consequence: 'Soa como interesse pessoal, não como contribuição.' },
      ],
      evaluate: {
        progress: [
          'O gestor sugeriu um piloto ou um próximo passo concreto.',
          'Você foi incluído(a) em reuniões ou decisões sobre o tema.',
          'Combinaram uma data para revisar a conversa.',
        ],
        nextSteps: [
          'Envie um resumo por escrito do que foi combinado.',
          'Mostre resultado rápido no novo escopo e compartilhe o aprendizado.',
          'Se não houve avanço em dois ciclos, avalie se a área tem espaço para crescer (veja o guia sobre poucas possibilidades de crescimento).',
        ],
      },
      caution: [
        'Se o seu gestor está sob pressão (reestruturação, meta em risco), escolha outro momento ou ofereça ajuda pontual primeiro.',
        'Escopo que pertence a outro time exige conversa entre lideranças; não tente assumir por conta própria.',
        'Escopo maior sem reconhecimento pode virar só mais trabalho. Combine também como o resultado será avaliado.',
      ],
    },
    marketNotes: {
      financeiro: { title: 'Em serviços financeiros', text: 'Projetos com risco regulatório costumam ter dono formal. Proponha escopo em temas onde você pode mostrar resultado sem disputar responsabilidade de áreas de controle.' },
    },
    sizeNotes: {
      grande: { title: 'Em empresas grandes', text: 'O momento de planejamento anual é quando o escopo é redistribuído. Leve a conversa algumas semanas antes desse ciclo.' },
      pequena: { title: 'Em empresas pequenas', text: 'Escopo costuma ser fluido. Muitas vezes basta começar a resolver o problema e alinhar com o fundador ou gestor no caminho.' },
    },
    provenance: EDU,
  },

  {
    id: 'vaga-interna',
    title: 'Como manifestar interesse em uma vaga interna sem comprometer a relação com o chefe',
    teaser: 'Concorrer a uma oportunidade em outra área sem parecer desleal.',
    category: 'crescimento-promocao',
    type: 'decisao-de-carreira',
    moments: ['quero-promocao', 'mudar-de-area', 'novo-cargo'],
    levels: [],
    minutes: 6,
    guide: {
      happening:
        'Abriu uma vaga em outra área que combina com o que você quer. Você tem receio de que o seu gestor interprete o interesse como falta de compromisso, ou de que a relação piore se você não for selecionado(a).',
      why: [
        'Perder uma pessoa boa gera trabalho e risco para o gestor, que precisa repor e redistribuir tarefas.',
        'Algumas empresas exigem que o gestor seja avisado ou aprove a candidatura; outras não. A regra muda a dinâmica.',
        'Em muitas culturas corporativas, mobilidade interna é incentivada no discurso e tratada com desconfiança na prática.',
      ],
      understand: [
        'Leia a política de mobilidade interna antes de qualquer conversa.',
        'Seu gestor provavelmente vai saber; é melhor que saiba por você.',
        'A forma da conversa importa mais do que o fato de você querer a vaga.',
      ],
      prepare: [
        'Confirme a política: tempo mínimo na posição, necessidade de aviso ao gestor, confidencialidade.',
        'Explique para si mesmo(a) por que a vaga faz sentido para a sua carreira (e não "para sair daqui").',
        'Pense em como garantir a transição das suas entregas caso seja selecionado(a).',
      ],
      approach: {
        steps: [
          'Converse com o gestor antes da entrevista ou logo depois de se candidatar, conforme a política.',
          'Fale da oportunidade em termos de desenvolvimento, não de insatisfação.',
          'Reconheça o que você aprendeu com o time atual.',
          'Ofereça um plano de transição responsável.',
        ],
        phrases: [
          { context: 'Abrir a conversa', text: 'Queria que você soubesse por mim: me candidatei à vaga de [cargo] em [área].' },
          { context: 'Explicar o motivo', text: 'Ela se conecta com o que quero desenvolver nos próximos anos, especialmente [competência]. Não é sobre estar insatisfeito(a) aqui.' },
          { context: 'Mostrar responsabilidade', text: 'Se der certo, quero garantir uma transição tranquila. Posso documentar [entregas] e ajudar quem assumir.' },
        ],
      },
      avoid: [
        { mistake: 'Deixar o gestor descobrir pelo RH ou pelo outro gestor.', consequence: 'Sensação de quebra de confiança, difícil de reparar.' },
        { mistake: 'Usar a vaga para negociar aumento na área atual sem real interesse.', consequence: 'Você pode perder credibilidade com as duas áreas.' },
        { mistake: 'Falar mal do time atual na entrevista.', consequence: 'O outro gestor vai se perguntar como você falará dele no futuro.' },
      ],
      evaluate: {
        progress: [
          'O gestor reagiu com apoio ou com perguntas sobre o seu plano.',
          'O processo seguiu sem ruído na relação.',
        ],
        nextSteps: [
          'Se não for selecionado(a), peça feedback ao outro gestor e compartilhe o aprendizado com o seu.',
          'Se for selecionado(a), cumpra o plano de transição.',
        ],
      },
      caution: [
        'Se a política exige confidencialidade, respeite-a; você não precisa avisar antes do momento previsto.',
        'Em times muito pequenos, sua saída pode ter impacto real. Considere o calendário de entregas críticas.',
        'Se houver sinais de retaliação, registre fatos e procure o RH.',
      ],
    },
    sizeNotes: {
      enterprise: { title: 'Em enterprises', text: 'Costuma existir um portal de vagas internas e regras formais. Siga o processo à risca; atalhos chamam atenção negativa.' },
    },
    provenance: EDU,
  },

  {
    id: 'pedir-aumento',
    title: 'Como pedir aumento e negociar remuneração',
    teaser: 'Preparar argumentos, escolher o momento e conduzir a conversa.',
    category: 'remuneracao',
    type: 'negociacao',
    moments: ['aumentar-salario'],
    levels: [],
    minutes: 8,
    guide: {
      happening:
        'Você acredita que sua remuneração não acompanha o seu trabalho ou o mercado. Falar de dinheiro é desconfortável e você teme parecer ingrato(a) ou ouvir um "não" que mude a relação.',
      why: [
        'Reajustes costumam seguir orçamento anual, faixas salariais e ciclos de avaliação, que nem sempre estão visíveis para quem pede.',
        'Gestores raramente têm autonomia total sobre salário; muitas vezes eles precisam defender o pedido para outras pessoas.',
        'Quem não pede tende a ser lembrado(a) por último quando o orçamento é distribuído.',
      ],
      understand: [
        'Aumento é uma decisão de negócio: valor que você gera, risco de perder você, faixa do cargo e orçamento disponível.',
        'Mérito (no mesmo cargo) e promoção (mudança de cargo) costumam seguir regras diferentes.',
        'Você está ajudando o gestor a defender o seu caso; dê munição a ele.',
      ],
      prepare: [
        'Pesquise referências de mercado em mais de uma fonte e anote o recorte de cada uma (cargo, porte, região, data). Desconfie de números sem fonte.',
        'Liste entregas do último ciclo com impacto mensurável.',
        'Descubra quando acontece o ciclo de mérito e quando o orçamento é definido.',
        'Defina três números: o ideal, o aceitável e o mínimo abaixo do qual você reconsideraria.',
        'Pense em alternativas além do salário: bônus, benefícios, formação, flexibilidade, data de revisão.',
      ],
      approach: {
        steps: [
          'Agende a conversa antes do fechamento do orçamento.',
          'Abra com o seu interesse em continuar e crescer.',
          'Apresente as entregas e as referências de mercado, nessa ordem.',
          'Faça um pedido claro e depois escute.',
          'Combine próximos passos e prazo de resposta.',
        ],
        phrases: [
          { context: 'Abrir', text: 'Gostaria de conversar sobre a minha remuneração. Quero continuar crescendo aqui e acho importante alinharmos isso.' },
          { context: 'Argumentar', text: 'No último ano, entreguei [resultado 1] e [resultado 2]. Pesquisei referências para cargos parecidos e o meu salário está abaixo da faixa que encontrei.' },
          { context: 'Pedir', text: 'Gostaria de propor um reajuste para [valor]. Como podemos avaliar isso?' },
          { context: 'Se não houver orçamento', text: 'Entendo. O que seria preciso para revisitarmos isso no próximo ciclo? Podemos combinar critérios e uma data?' },
        ],
      },
      avoid: [
        { mistake: 'Justificar o pedido com despesas pessoais.', consequence: 'Desloca a conversa do valor que você gera para a sua necessidade.' },
        { mistake: 'Ameaçar sair sem estar disposto(a) a sair.', consequence: 'Se a ameaça não se cumprir, sua credibilidade cai.' },
        { mistake: 'Usar um número de mercado sem fonte ou de outro recorte.', consequence: 'O argumento é facilmente contestado.' },
      ],
      evaluate: {
        progress: [
          'O gestor se comprometeu a levar o pedido adiante.',
          'Vocês combinaram critérios objetivos e uma data.',
        ],
        nextSteps: [
          'Registre por e-mail o que foi combinado.',
          'Se a resposta for negativa sem critérios claros, reflita sobre o seu valor no mercado com calma, antes de qualquer decisão.',
        ],
      },
      caution: [
        'Em momentos de corte de custos, o pedido pode ser mal recebido. Ainda assim, combinar critérios para o futuro pode valer a pena.',
        'Proposta externa como argumento é legítima, mas arriscada: use apenas se estiver disposto(a) a aceitá-la.',
        'Diferenças salariais injustificadas entre pessoas no mesmo cargo podem ter implicações legais; nesses casos, informe-se e procure orientação.',
      ],
    },
    sizeNotes: {
      grande: { title: 'Em empresas grandes', text: 'Há faixas salariais por cargo. Pergunte em que ponto da faixa você está; isso ajuda a entender se o caminho é mérito ou promoção.' },
      pequena: { title: 'Em empresas pequenas', text: 'Sem faixas formais, a negociação é mais direta, mas depende muito do caixa. Considere participação nos resultados como alternativa.' },
    },
    provenance: EDU,
  },

  {
    id: 'gestor-nao-apoia',
    title: 'Como agir quando o gestor não apoia suas ideias',
    teaser: 'Entender o "não" e encontrar outro caminho sem passar por cima.',
    category: 'relacao-gestores',
    type: 'leitura-de-cenario',
    moments: ['situacao-dificil', 'ganhar-influencia'],
    levels: [],
    minutes: 6,
    guide: {
      happening:
        'Você propõe ideias e elas não avançam: são recusadas, ficam paradas ou recebem pouco interesse. Isso gera frustração e a sensação de não ser ouvido(a).',
      why: [
        'O gestor pode estar respondendo a prioridades que você não vê (metas da diretoria, orçamento, riscos).',
        'A ideia pode estar boa, mas apresentada no momento ou formato errado.',
        'Também é possível que existam diferenças de visão ou de estilo. Antes de concluir, busque evidências.',
      ],
      understand: [
        'Um "não" pode significar "não agora", "não assim" ou "não tenho como defender isso".',
        'Você não tem como saber a intenção do gestor sem perguntar.',
        'Ideias ganham força quando resolvem um problema que o gestor já reconhece.',
      ],
      prepare: [
        'Reveja as últimas propostas: quais problemas resolviam, que dados tinham, como foram apresentadas.',
        'Pergunte-se quais são as três prioridades do seu gestor neste trimestre.',
        'Reformule a ideia conectando-a a uma dessas prioridades, com custo e risco explícitos.',
      ],
      approach: {
        steps: [
          'Peça feedback sobre a ideia anterior, de forma curiosa e sem defesa.',
          'Pergunte o que tornaria a proposta viável.',
          'Proponha um teste pequeno, com custo baixo e critério de sucesso.',
        ],
        phrases: [
          { context: 'Pedir feedback', text: 'Quero entender melhor o que pesou na decisão sobre [ideia]. O que faria você olhar de outra forma?' },
          { context: 'Conectar a uma prioridade', text: 'Vi que [meta] é prioridade. Acho que [ideia] ajuda nisso desta forma. Podemos testar em pequena escala?' },
          { context: 'Propor um teste', text: 'E se fizéssemos um piloto de quatro semanas com [critério]? Se não funcionar, encerramos.' },
        ],
      },
      avoid: [
        { mistake: 'Levar a ideia ao chefe do seu chefe sem avisar.', consequence: 'É visto como passar por cima e costuma prejudicar a relação.' },
        { mistake: 'Insistir com os mesmos argumentos.', consequence: 'A ideia fica marcada como "aquela que já foi recusada".' },
        { mistake: 'Desistir de propor.', consequence: 'Você deixa de mostrar iniciativa, que é parte do que se espera de pessoas seniores.' },
      ],
      evaluate: {
        progress: [
          'Você entendeu os critérios do gestor para aprovar ideias.',
          'Um teste pequeno foi aprovado.',
        ],
        nextSteps: [
          'Mostre resultado do teste com dados e reconheça quem ajudou.',
          'Se, após várias tentativas bem preparadas, nada avança, converse sobre isso abertamente ou busque um mentor fora da linha hierárquica.',
        ],
      },
      caution: [
        'Se a recusa vier acompanhada de falta de respeito ou exclusão sistemática, o tema deixa de ser sobre ideias; registre fatos e procure apoio.',
        'Em ambientes muito hierárquicos, propostas costumam precisar ser "do gestor" para avançar. Avalie se você aceita esse jogo.',
      ],
    },
    provenance: EDU,
  },

  {
    id: 'visibilidade',
    title: 'Como conseguir visibilidade sem parecer que está se autopromovendo',
    teaser: 'Fazer seu trabalho ser conhecido de forma natural e útil.',
    category: 'regras-nao-escritas',
    type: 'visibilidade',
    moments: ['quero-promocao', 'ganhar-influencia'],
    levels: [],
    minutes: 5,
    guide: {
      happening:
        'Você entrega bem, mas sente que poucas pessoas sabem disso. Ao mesmo tempo, não quer parecer alguém que só fala de si.',
      why: [
        'Decisões de promoção são tomadas, em geral, por pessoas que não acompanham seu dia a dia.',
        'Em empresas grandes, a reputação circula por relatos de terceiros; se ninguém fala do seu trabalho, ele fica invisível.',
        'Trabalho bem feito costuma ser silencioso: problemas evitados não aparecem.',
      ],
      understand: [
        'Visibilidade útil é compartilhar aprendizados e resultados que ajudam outras pessoas.',
        'Dar crédito a outras pessoas aumenta, e não diminui, a sua visibilidade.',
        'Seu gestor é o seu principal canal; mantenha-o informado(a) de forma regular.',
      ],
      prepare: [
        'Liste os públicos que precisam conhecer seu trabalho: gestor, gestor do gestor, áreas parceiras.',
        'Escolha um formato recorrente: resumo mensal, apresentação de aprendizados, documentação.',
        'Separe um resultado recente que possa virar um caso para compartilhar.',
      ],
      approach: {
        steps: [
          'Envie ao gestor um resumo curto e regular de resultados e próximos passos.',
          'Ofereça-se para apresentar aprendizados em fóruns do time ou de outras áreas.',
          'Reconheça publicamente quem colaborou.',
        ],
        phrases: [
          { context: 'Resumo para o gestor', text: 'Resumo do mês: [resultado], [aprendizado], [próximo passo]. Se fizer sentido, posso apresentar isso no fórum da área.' },
          { context: 'Compartilhar aprendizado', text: 'Testamos [hipótese] e aprendemos [resultado]. Fica aqui para quem estiver pensando em algo parecido. Obrigado(a), [pessoa], pela ajuda.' },
        ],
      },
      avoid: [
        { mistake: 'Falar só de esforço ("trabalhei até tarde").', consequence: 'Esforço não é resultado; pode passar a imagem de desorganização.' },
        { mistake: 'Apresentar trabalho coletivo como individual.', consequence: 'Perda de confiança das pessoas que colaboraram.' },
      ],
      evaluate: {
        progress: [
          'Pessoas de outras áreas passam a procurar você.',
          'Seu gestor menciona seu trabalho em fóruns sem você pedir.',
        ],
        nextSteps: ['Mantenha a regularidade; visibilidade se constrói ao longo de meses.'],
      },
      caution: [
        'Em algumas culturas, exposição em fóruns amplos precisa ser alinhada com o gestor antes.',
        'Visibilidade não compensa entregas inconsistentes; cuide primeiro da base.',
      ],
    },
    sizeNotes: {
      grande: { title: 'Em empresas grandes', text: 'Comitês de calibração comparam pessoas de vários times. Ser conhecido(a) por gestores de áreas parceiras ajuda nessa discussão.' },
    },
    provenance: EDU,
  },

  {
    id: 'credito-colega',
    title: 'Como lidar com um colega que leva o crédito pelo seu trabalho',
    teaser: 'Proteger sua contribuição sem transformar o caso em briga.',
    category: 'conflitos-politica',
    type: 'conversa-dificil',
    moments: ['situacao-dificil'],
    levels: [],
    minutes: 6,
    guide: {
      happening:
        'Um trabalho seu foi apresentado por outra pessoa sem a devida menção. Você ficou incomodado(a) e não sabe se fala algo ou deixa passar.',
      why: [
        'Pode ter sido descuido: em apresentações rápidas, é comum resumir "o time fez".',
        'Pode haver disputa por reconhecimento, comum quando promoções são competitivas.',
        'A falta de registros claros de quem fez o quê facilita esse tipo de situação.',
      ],
      understand: [
        'Uma situação isolada é diferente de um padrão. Comece assumindo boa-fé.',
        'Você não sabe a intenção da outra pessoa; fale sobre o fato e o impacto.',
        'Prevenir é mais eficaz do que corrigir depois.',
      ],
      prepare: [
        'Reúna registros: e-mails, versões de documentos, mensagens.',
        'Defina o que você quer: reconhecimento, mudança de comportamento, ou só sinalizar.',
      ],
      approach: {
        steps: [
          'Converse em particular com o colega, de forma direta e calma.',
          'Descreva o fato e o impacto, sem acusar.',
          'Combine como apresentar trabalhos conjuntos no futuro.',
          'Se o padrão continuar, leve ao gestor com fatos.',
        ],
        phrases: [
          { context: 'Conversa com o colega', text: 'Na reunião de ontem, a análise de [tema] foi apresentada sem menção ao meu trabalho. Pode ter sido sem querer, mas para mim é importante. Como podemos fazer daqui pra frente?' },
          { context: 'Prevenção', text: 'Para a próxima apresentação, que tal cada um apresentar a parte que conduziu?' },
          { context: 'Com o gestor (se o padrão se repetir)', text: 'Quero te contar uma situação que tem se repetido e pedir sua orientação. [Fatos].' },
        ],
      },
      avoid: [
        { mistake: 'Confrontar o colega em público.', consequence: 'Você pode ser visto(a) como a pessoa difícil da história.' },
        { mistake: 'Comentar o caso com outros colegas.', consequence: 'Vira fofoca e enfraquece sua posição.' },
      ],
      evaluate: {
        progress: ['O colega passou a dar crédito.', 'Vocês combinaram um formato para trabalhos conjuntos.'],
        nextSteps: ['Adote o hábito de registrar entregas e compartilhar resultados com o gestor de forma regular.'],
      },
      caution: [
        'Se o colega for mais sênior ou próximo da liderança, alinhe com o seu gestor antes de qualquer conversa.',
        'Se houver assédio ou retaliação, procure os canais formais da empresa.',
      ],
    },
    provenance: EDU,
  },

  {
    id: 'discordar-lideranca',
    title: 'Como discordar de uma liderança sem prejudicar a relação',
    teaser: 'Discordar com respeito, no momento certo e com alternativas.',
    category: 'comunicacao-negociacao',
    type: 'conversa-dificil',
    moments: ['situacao-dificil', 'ganhar-influencia'],
    levels: [],
    minutes: 5,
    guide: {
      happening:
        'Uma liderança tomou ou vai tomar uma decisão com a qual você não concorda. Você tem receio de que discordar seja visto como insubordinação.',
      why: [
        'Lideranças trabalham com informações e pressões que nem sempre chegam ao time.',
        'Discordância bem feita é valorizada em muitos ambientes, mas o formato importa.',
        'Em culturas hierárquicas, discordar em público costuma ter custo alto.',
      ],
      understand: [
        'Discordar da decisão não é discordar da pessoa.',
        'Antes da decisão, discordar é contribuição; depois dela, o esperado costuma ser executar e reportar riscos.',
        'Traga alternativa, não só objeção.',
      ],
      prepare: [
        'Entenda o objetivo por trás da decisão.',
        'Separe fatos de opiniões.',
        'Prepare uma alternativa e o risco que ela reduz.',
      ],
      approach: {
        steps: [
          'Peça um momento em particular.',
          'Confirme que entendeu o objetivo.',
          'Apresente sua preocupação com dados.',
          'Proponha alternativa e aceite a decisão final.',
        ],
        phrases: [
          { context: 'Entender', text: 'Quero ter certeza de que entendi o objetivo: é [objetivo], certo?' },
          { context: 'Discordar', text: 'Tenho uma preocupação: [dado] indica que [risco]. Uma alternativa seria [proposta].' },
          { context: 'Fechar', text: 'Se a decisão se mantiver, conto com você para acompanharmos [indicador] de perto.' },
        ],
      },
      avoid: [
        { mistake: 'Discordar em reunião ampla com tom de confronto.', consequence: 'A liderança tende a defender a decisão, e não a reavaliá-la.' },
        { mistake: 'Concordar na frente e criticar nos bastidores.', consequence: 'Mina a confiança quando descoberto.' },
      ],
      evaluate: {
        progress: ['Sua preocupação foi considerada, mesmo que a decisão não tenha mudado.', 'Você passou a ser consultado(a) antes de decisões parecidas.'],
        nextSteps: ['Acompanhe o indicador combinado e traga o resultado com neutralidade.'],
      },
      caution: [
        'Questões éticas ou legais são diferentes de discordância de estratégia: use canais formais de denúncia quando for o caso.',
      ],
    },
    marketNotes: {
      financeiro: { title: 'Em serviços financeiros', text: 'Se a discordância envolve risco regulatório, envolva compliance formalmente; não é uma questão de opinião.' },
    },
    provenance: EDU,
  },

  {
    id: 'influenciar-sem-autoridade',
    title: 'Como influenciar uma decisão sem ter autoridade formal',
    teaser: 'Mobilizar pessoas que não respondem a você.',
    category: 'poder-influencia',
    type: 'negociacao',
    moments: ['ganhar-influencia', 'quero-promocao'],
    levels: [...IC_AND_COORD],
    minutes: 6,
    guide: {
      happening: 'Você precisa que outra área priorize algo, mas não tem como exigir. Seus pedidos ficam na fila.',
      why: [
        'Cada área tem metas próprias; seu pedido compete com elas.',
        'Pessoas priorizam quem conhecem e em quem confiam.',
        'Pedidos vagos ou sem impacto claro costumam perder para pedidos bem explicados.',
      ],
      understand: [
        'Influência é construída antes do pedido, na relação.',
        'Descubra o que a outra área ganha com o seu pedido.',
        'Tenha clareza de quem decide e de quem influencia quem decide.',
      ],
      prepare: [
        'Mapeie as pessoas envolvidas: quem decide, quem executa, quem é afetado.',
        'Entenda as metas da outra área.',
        'Quantifique o impacto do pedido para a empresa e para a outra área.',
        'Simplifique: o que você pode fazer para reduzir o esforço deles?',
      ],
      approach: {
        steps: [
          'Converse antes com quem executa, não só com quem decide.',
          'Apresente o problema compartilhado e o ganho mútuo.',
          'Peça algo específico e pequeno.',
          'Reconheça publicamente a contribuição.',
        ],
        phrases: [
          { context: 'Abrir', text: 'Estou tentando resolver [problema] e acho que também afeta [meta da outra área]. Posso te mostrar o que encontrei?' },
          { context: 'Pedir', text: 'O que eu precisaria é [pedido específico]. Do meu lado, posso cuidar de [parte].' },
        ],
      },
      avoid: [
        { mistake: 'Escalar para o gestor da outra área logo de início.', consequence: 'Gera resistência e fama de quem "joga pesado".' },
        { mistake: 'Aparecer só quando precisa de algo.', consequence: 'A relação fica transacional e frágil.' },
      ],
      evaluate: {
        progress: ['O pedido entrou na priorização da outra área.', 'A outra área passou a procurar você também.'],
        nextSteps: ['Mantenha contato regular mesmo sem pedidos pendentes.'],
      },
      caution: ['Em empresas com metas conflitantes entre áreas, alguns temas só se resolvem entre lideranças; saiba quando pedir apoio ao seu gestor.'],
    },
    sizeNotes: {
      enterprise: { title: 'Em enterprises', text: 'Fóruns e comitês decidem prioridades. Descubra qual comitê decide o seu tema e quem leva a pauta até ele.' },
    },
    provenance: EDU,
  },

  {
    id: 'sinais-promocao',
    title: 'Como identificar se você está sendo preparado(a) para uma promoção',
    teaser: 'Sinais que costumam indicar preparação, e como confirmar.',
    category: 'crescimento-promocao',
    type: 'leitura-de-cenario',
    moments: ['quero-promocao'],
    levels: [...IC_AND_COORD],
    minutes: 4,
    guide: {
      happening: 'Você percebe mudanças no seu trabalho e se pergunta se estão preparando você para crescer, ou se é só mais trabalho.',
      why: [
        'Gestores costumam testar pessoas em responsabilidades do próximo nível antes da promoção.',
        'Nem toda responsabilidade extra é preparação: às vezes é só necessidade de cobertura.',
      ],
      understand: [
        'Sinais isolados não confirmam nada; procure um padrão.',
        'A forma mais segura de saber é perguntar.',
      ],
      prepare: [
        'Observe nos últimos meses: você foi convidado(a) para reuniões de decisão? Representou o gestor? Recebeu feedback sobre competências do próximo nível?',
        'Leia a descrição do próximo nível, se existir.',
      ],
      approach: {
        steps: ['Pergunte diretamente ao gestor, em uma conversa de carreira.', 'Peça critérios e um horizonte.'],
        phrases: [
          { context: 'Perguntar', text: 'Tenho interesse em chegar a [próximo nível]. Como você enxerga meu momento em relação a isso?' },
          { context: 'Critérios', text: 'O que você precisaria ver de mim nos próximos meses para defender essa promoção?' },
        ],
      },
      avoid: [
        { mistake: 'Assumir que a promoção é certa.', consequence: 'Frustração e possível desgaste se ela não vier.' },
      ],
      evaluate: {
        progress: ['Você recebeu critérios claros.', 'O gestor mencionou um ciclo ou data.'],
        nextSteps: ['Transforme os critérios em itens do seu PDI e revise a cada mês.'],
      },
      caution: ['Promoções dependem também de vaga, orçamento e calibração; preparação não garante promoção.'],
    },
    provenance: EDU,
  },

  {
    id: 'pouco-reconhecimento',
    title: 'Como perceber que suas entregas estão sendo pouco reconhecidas',
    teaser: 'Diferenciar sensação de fato e agir sobre o que é possível.',
    category: 'gestao-desempenho',
    type: 'leitura-de-cenario',
    moments: ['situacao-dificil', 'quero-promocao'],
    levels: [],
    minutes: 5,
    guide: {
      happening: 'Você entrega bastante, mas a avaliação, o feedback ou as oportunidades não refletem isso.',
      why: [
        'Reconhecimento depende de quem conhece o seu trabalho e de como ele se conecta às metas.',
        'Entregas operacionais tendem a ser menos lembradas do que projetos visíveis.',
        'Expectativas podem não estar alinhadas: você pode estar entregando muito no que é menos prioritário.',
      ],
      understand: [
        'Compare suas entregas com o que o gestor considera prioridade.',
        'Pergunte como seu trabalho é percebido antes de concluir.',
      ],
      prepare: [
        'Liste entregas do último semestre e marque quais estão ligadas às metas da área.',
        'Reúna feedbacks recebidos.',
      ],
      approach: {
        steps: ['Peça uma conversa de alinhamento de expectativas.', 'Pergunte o que mais importa e como você está em relação a isso.'],
        phrases: [
          { context: 'Alinhar', text: 'Quero garantir que estou focando no que mais importa. Das minhas entregas, quais tiveram mais impacto para você?' },
          { context: 'Percepção', text: 'Como você acha que meu trabalho é percebido fora do time?' },
        ],
      },
      avoid: [{ mistake: 'Reclamar de falta de reconhecimento de forma genérica.', consequence: 'Soa como insatisfação sem proposta.' }],
      evaluate: {
        progress: ['Vocês alinharam prioridades.', 'Você ajustou o foco para entregas de maior impacto.'],
        nextSteps: ['Use o guia de visibilidade para tornar os resultados conhecidos.'],
      },
      caution: ['Se o padrão persistir mesmo com alinhamento, pode ser um sinal sobre a cultura ou a liderança; avalie suas opções com calma.'],
    },
    provenance: EDU,
  },

  {
    id: 'tudo-urgente',
    title: 'Como negociar prioridades quando tudo é urgente',
    teaser: 'Dizer "não agora" com critério e sem desgaste.',
    category: 'comunicacao-negociacao',
    type: 'negociacao',
    moments: ['situacao-dificil'],
    levels: [],
    minutes: 5,
    guide: {
      happening: 'Várias pessoas pedem coisas ao mesmo tempo, todas urgentes. Você não consegue fazer tudo com qualidade.',
      why: [
        'Cada solicitante enxerga apenas a própria demanda.',
        'Sem um critério comum de prioridade, vence quem pede mais alto.',
      ],
      understand: [
        'Priorizar é uma decisão do gestor quando as demandas competem; seu papel é tornar o conflito visível.',
        'Dizer "sim" para tudo leva a entregar tudo pior.',
      ],
      prepare: [
        'Liste as demandas com prazo, solicitante, esforço e impacto.',
        'Proponha uma ordem e o que fica para depois.',
      ],
      approach: {
        steps: ['Mostre a lista ao gestor e peça validação da ordem.', 'Comunique aos solicitantes o novo prazo com o motivo.'],
        phrases: [
          { context: 'Com o gestor', text: 'Tenho cinco demandas para esta semana e capacidade para três. Minha sugestão de prioridade é esta. Você concorda?' },
          { context: 'Com o solicitante', text: 'Consigo entregar isso na quinta, porque [prioridade] precisa sair antes. Se for crítico para antes, me avise que reavaliamos com [gestor].' },
        ],
      },
      avoid: [{ mistake: 'Atrasar sem avisar.', consequence: 'Perda de confiança, maior do que um "não" antecipado.' }],
      evaluate: {
        progress: ['Os solicitantes aceitaram os novos prazos.', 'O gestor passou a mediar conflitos de prioridade.'],
        nextSteps: ['Proponha um ritual semanal de priorização.'],
      },
      caution: ['Se a sobrecarga for constante, é um problema de capacidade, não de organização pessoal; leve isso ao gestor com dados.'],
    },
    provenance: EDU,
  },

  {
    id: 'lideranca-muda-direcao',
    title: 'Como lidar com uma liderança que muda constantemente de direção',
    teaser: 'Proteger o trabalho e a energia do time quando as prioridades mudam toda semana.',
    category: 'relacao-gestores',
    type: 'leitura-de-cenario',
    moments: ['situacao-dificil'],
    levels: [],
    minutes: 5,
    guide: {
      happening: 'As prioridades mudam com frequência, trabalhos são descartados e você sente que nada chega ao fim.',
      why: [
        'A própria liderança pode estar recebendo direcionamentos conflitantes de cima.',
        'Mudanças de mercado ou de estratégia podem justificar ajustes frequentes.',
        'Também pode haver falta de clareza sobre objetivos. Não presuma a causa.',
      ],
      understand: [
        'Você pode reduzir o impacto das mudanças, mas raramente evitá-las.',
        'Registrar decisões ajuda todo mundo a enxergar o padrão.',
      ],
      prepare: [
        'Anote as mudanças recentes e o custo de cada uma (horas, entregas descartadas).',
        'Identifique o objetivo que se manteve estável apesar das mudanças.',
      ],
      approach: {
        steps: ['Confirme por escrito cada nova prioridade.', 'Pergunte o que deixa de ser feito.', 'Proponha entregas menores e incrementais.'],
        phrases: [
          { context: 'Confirmar', text: 'Para garantir que entendi: a prioridade agora é [X], e [Y] fica pausado. Correto?' },
          { context: 'Mostrar impacto', text: 'Nos últimos dois meses mudamos de direção quatro vezes. Isso custou [impacto]. Podemos combinar um ciclo mínimo antes de mudar?' },
        ],
      },
      avoid: [{ mistake: 'Ignorar as mudanças e continuar no plano antigo.', consequence: 'Desalinhamento com a liderança.' }],
      evaluate: {
        progress: ['As mudanças passaram a ser comunicadas com contexto.', 'O time combinou ciclos mínimos.'],
        nextSteps: ['Mantenha um registro de decisões compartilhado.'],
      },
      caution: ['Mudanças frequentes podem anteceder reestruturações; mantenha seu currículo e sua rede ativos sem alarmismo.'],
    },
    provenance: EDU,
  },

  {
    id: 'aliancas',
    title: 'Como construir alianças entre áreas',
    teaser: 'Relações que facilitam o trabalho e abrem portas.',
    category: 'poder-influencia',
    type: 'visibilidade',
    moments: ['ganhar-influencia', 'quero-promocao'],
    levels: [],
    minutes: 5,
    guide: {
      happening: 'Seu trabalho depende de outras áreas, mas a relação é só por demanda, e as coisas demoram.',
      why: [
        'Relações de confiança reduzem atrito e aceleram decisões.',
        'Áreas que se conhecem resolvem problemas antes de escalá-los.',
      ],
      understand: ['Alianças são construídas com ajuda mútua ao longo do tempo.', 'Comece por quem tem metas parecidas com as suas.'],
      prepare: ['Liste as cinco pessoas de outras áreas mais importantes para o seu trabalho.', 'Pesquise as metas de cada uma.'],
      approach: {
        steps: ['Proponha conversas curtas para entender o trabalho delas.', 'Ofereça ajuda antes de pedir.', 'Compartilhe informações úteis.'],
        phrases: [
          { context: 'Convite', text: 'Nossas áreas trabalham muito juntas e eu queria entender melhor os desafios de vocês. Toparia um café de 20 minutos?' },
          { context: 'Oferecer', text: 'Vi que vocês estão trabalhando em [tema]. Temos dados de [X] que podem ajudar; quer que eu envie?' },
        ],
      },
      avoid: [{ mistake: 'Procurar as pessoas apenas quando precisa.', consequence: 'Relação transacional.' }],
      evaluate: {
        progress: ['Pedidos passam a fluir mais rápido.', 'Pessoas de outras áreas convidam você para discussões.'],
        nextSteps: ['Mantenha contato regular e celebre conquistas conjuntas.'],
      },
      caution: ['Em ambientes com disputas entre áreas, alinhe com o gestor para não ser visto(a) como "do outro lado".'],
    },
    provenance: EDU,
  },

  {
    id: 'interesse-liderar',
    title: 'Como demonstrar interesse em liderar sem parecer precipitado(a)',
    teaser: 'Mostrar vontade de liderar com ações, não só com palavras.',
    category: 'lideranca',
    type: 'decisao-de-carreira',
    moments: ['quero-promocao', 'novo-cargo'],
    levels: ['pleno', 'senior'],
    minutes: 5,
    guide: {
      happening: 'Você quer liderar pessoas, mas teme que dizer isso pareça ambição demais ou pressa.',
      why: [
        'Gestores procuram sinais de que a pessoa já exerce liderança informal.',
        'Promover alguém para gestão é uma aposta de risco; evidências reduzem esse risco.',
      ],
      understand: [
        'Liderar é diferente de ser o(a) melhor técnico(a).',
        'Liderança informal (mentorar, coordenar projetos) é o caminho mais comum para a formal.',
      ],
      prepare: [
        'Liste situações em que você já liderou informalmente.',
        'Reflita sobre por que quer liderar: pessoas, impacto, remuneração? Seja honesto(a) consigo.',
      ],
      approach: {
        steps: ['Diga ao gestor que esse é seu objetivo de médio prazo.', 'Peça oportunidades de liderança informal.'],
        phrases: [
          { context: 'Declarar interesse', text: 'Meu objetivo para os próximos dois anos é liderar um time. Queria sua ajuda para entender o que preciso desenvolver.' },
          { context: 'Pedir experiência', text: 'Posso assumir a coordenação de [projeto] ou acompanhar a chegada da próxima pessoa no time?' },
        ],
      },
      avoid: [{ mistake: 'Se comportar como chefe dos colegas sem ter o papel.', consequence: 'Resistência do time e desconfiança do gestor.' }],
      evaluate: {
        progress: ['Você recebeu uma responsabilidade de liderança informal.', 'O gestor passou a discutir pessoas com você.'],
        nextSteps: ['Peça feedback de quem você liderou informalmente.'],
      },
      caution: ['Nem toda empresa tem vagas de gestão frequentes; carreiras em Y (especialista) também podem ser um caminho.'],
    },
    provenance: EDU,
  },

  {
    id: 'poucas-possibilidades',
    title: 'Como reconhecer quando a empresa oferece poucas possibilidades de crescimento',
    teaser: 'Avaliar com calma se o próximo passo está aqui ou fora.',
    category: 'mudanca-carreira',
    type: 'decisao-de-carreira',
    moments: ['mudar-de-area', 'quero-promocao', 'aumentar-salario'],
    levels: [],
    minutes: 6,
    guide: {
      happening: 'Você sente que está parado(a): não há vagas acima, o escopo não cresce e as conversas de carreira não avançam.',
      why: [
        'Estruturas enxutas têm poucas posições de liderança.',
        'Empresas em contenção de custos congelam promoções.',
        'Às vezes há espaço, mas ele não está visível para você.',
      ],
      understand: [
        'Sair não é a única resposta; mudar de área internamente também é crescimento.',
        'Decisões de carreira são melhores quando tomadas com dados, não no pico da frustração.',
      ],
      prepare: [
        'Responda: nos últimos 12 meses, aprendi algo novo relevante? Meu escopo cresceu? Recebi critérios claros para o próximo nível?',
        'Observe: pessoas do seu nível têm sido promovidas? Quanto tempo levaram?',
        'Mapeie opções internas e externas.',
      ],
      approach: {
        steps: ['Tenha uma conversa franca de carreira com o gestor.', 'Pergunte sobre o horizonte da área.', 'Defina um prazo pessoal para reavaliar.'],
        phrases: [
          { context: 'Conversa franca', text: 'Quero entender quais são as possibilidades de crescimento para mim aqui nos próximos 12 a 18 meses.' },
          { context: 'Horizonte', text: 'Há planos de expansão da área ou de novas posições?' },
        ],
      },
      avoid: [{ mistake: 'Decidir sair sem conversar.', consequence: 'Você pode perder uma oportunidade que não estava visível.' }],
      evaluate: {
        progress: ['Você tem clareza sobre o horizonte.', 'Definiu um plano A (interno) e um plano B (externo).'],
        nextSteps: ['Revise o plano a cada trimestre.'],
      },
      caution: ['Mudar de emprego também tem riscos (adaptação, período de experiência). Compare com cuidado.'],
    },
    sizeNotes: {
      pequena: { title: 'Em empresas pequenas', text: 'O crescimento da carreira costuma acompanhar o crescimento da empresa. Avalie a trajetória do negócio, não só a da área.' },
    },
    provenance: EDU,
  },
];

export const findChallenge = (id: string) => CHALLENGES.find((c) => c.id === id);
