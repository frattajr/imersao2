/**
 * Acervo curado de clássicos em português (Brasil e Portugal), todos em
 * domínio público (autores falecidos há mais de 70 anos). Cada obra traz
 * sinopse escrita para o app (sem spoiler), tema, clima da capa e onde
 * buscar o texto: Project Gutenberg (procurado por título + autor no
 * catálogo oficial) e, se não houver lá, Wikisource em português.
 *
 * O texto é baixado no deploy (scripts/build-acervo.ts), limpo, passado
 * para a grafia atual e publicado junto com o app — então abre na hora,
 * sem depender de sites externos.
 */
import type { Mood } from '../core/types';

export const ACERVO_KINDS = ['Romance', 'Contos', 'Poesia', 'Teatro', 'Ensaio'] as const;
export type AcervoKind = (typeof ACERVO_KINDS)[number];

export interface AcervoEntry {
  slug: string;
  title: string;
  author: string;
  /** ano da primeira publicação */
  year: number;
  /** ano da morte do autor (domínio público) */
  died: number;
  origin: 'BR' | 'PT';
  kind: AcervoKind;
  mood: Mood;
  emoji: string;
  synopsis: string;
  /** temas para as fileiras e a busca */
  tags: string[];
  /** como achar o texto nas fontes */
  find: {
    /** palavras do título e do autor como aparecem no catálogo do Gutenberg */
    gutenberg?: { title: string; author: string };
    /** título da página no pt.wikisource.org */
    wikisource?: string;
  };
}

export const ACERVO: AcervoEntry[] = [
  {
    slug: 'dom-casmurro', title: 'Dom Casmurro', author: 'Machado de Assis', year: 1899, died: 1908, origin: 'BR', kind: 'Romance', mood: 'rain', emoji: '🌧️',
    synopsis: 'Já velho, Bento Santiago tenta “atar as duas pontas da vida” e conta a própria história: a infância na Rua de Matacavalos, o amor por Capitu, a menina dos “olhos de ressaca”, e a dúvida que atravessa o livro inteiro. Um narrador em quem não se pode confiar — e talvez o maior romance brasileiro.',
    tags: ['amor', 'ciúme', 'Rio de Janeiro', 'memória'], find: { gutenberg: { title: 'Dom Casmurro', author: 'Machado' }, wikisource: 'Dom Casmurro' },
  },
  {
    slug: 'memorias-postumas', title: 'Memórias Póstumas de Brás Cubas', author: 'Machado de Assis', year: 1881, died: 1908, origin: 'BR', kind: 'Romance', mood: 'night', emoji: '🪦',
    synopsis: 'Um defunto autor — não um autor defunto — resolve escrever as memórias depois de morto. Com ironia e liberdade total, Brás Cubas repassa amores, ambições e fracassos da elite do Rio no século XIX. O livro que inaugurou o Realismo no Brasil.',
    tags: ['ironia', 'Rio de Janeiro', 'memória'], find: { gutenberg: { title: 'Memorias Posthumas de Braz Cubas', author: 'Machado' }, wikisource: 'Memórias Póstumas de Brás Cubas' },
  },
  {
    slug: 'quincas-borba', title: 'Quincas Borba', author: 'Machado de Assis', year: 1891, died: 1908, origin: 'BR', kind: 'Romance', mood: 'city', emoji: '🐕',
    synopsis: 'Rubião, professor do interior, herda a fortuna do filósofo Quincas Borba — e o cachorro com o mesmo nome. Na Corte, cercado de amigos interessados, aprende na prática a filosofia do “Humanitismo”: ao vencedor, as batatas.',
    tags: ['dinheiro', 'loucura', 'Rio de Janeiro'], find: { gutenberg: { title: 'Quincas Borba', author: 'Machado' }, wikisource: 'Quincas Borba' },
  },
  {
    slug: 'o-alienista', title: 'O Alienista', author: 'Machado de Assis', year: 1882, died: 1908, origin: 'BR', kind: 'Contos', mood: 'tension', emoji: '🏚️',
    synopsis: 'Na vila de Itaguaí, o médico Simão Bacamarte funda a Casa Verde para estudar a loucura. Aos poucos, a definição de quem é louco vai se ampliando — e a cidade inteira vai parar no hospício. Sátira curta, afiada e muito divertida.',
    tags: ['loucura', 'ciência', 'sátira'], find: { gutenberg: { title: 'O Alienista', author: 'Machado' }, wikisource: 'O Alienista' },
  },
  {
    slug: 'contos-machado', title: 'Histórias sem Data', author: 'Machado de Assis', year: 1884, died: 1908, origin: 'BR', kind: 'Contos', mood: 'calm', emoji: '🕯️',
    synopsis: 'Dezoito contos do Machado maduro, entre eles “A Igreja do Diabo”, em que o Diabo resolve fundar a própria igreja, e “Cantiga de Esponsais”, sobre um músico que passa a vida atrás de uma única melodia. Ironia fina, filosofia de bolso e muito humor.',
    tags: ['contos', 'ironia', 'sátira', 'Rio de Janeiro'], find: { gutenberg: { title: 'Historias Sem Data', author: 'Machado' }, wikisource: 'Histórias sem Data' },
  },
  {
    slug: 'esau-e-jaco', title: 'Esaú e Jacó', author: 'Machado de Assis', year: 1904, died: 1908, origin: 'BR', kind: 'Romance', mood: 'city', emoji: '👬',
    synopsis: 'Os gêmeos Pedro e Paulo brigam desde a barriga da mãe: um é monarquista, o outro republicano, e os dois gostam da mesma moça, Flora. No Rio da passagem do Império para a República, o Conselheiro Aires observa tudo com sua ironia discreta.',
    tags: ['família', 'política', 'amor', 'Rio de Janeiro'], find: { gutenberg: { title: 'Esau e Jacob', author: 'Machado' }, wikisource: 'Esaú e Jacó' },
  },
  {
    slug: 'memorial-de-aires', title: 'Memorial de Aires', author: 'Machado de Assis', year: 1908, died: 1908, origin: 'BR', kind: 'Romance', mood: 'warm', emoji: '📔',
    synopsis: 'O diário do diplomata aposentado Aires, entre 1888 e 1889: a viúva Fidélia, o casal Aguiar que nunca teve filhos, o afilhado Tristão e o Rio de Janeiro do fim da escravidão. O último romance de Machado, cheio de ternura e melancolia.',
    tags: ['memória', 'amor', 'velhice', 'Rio de Janeiro'], find: { gutenberg: { title: 'Memorial de Ayres', author: 'Machado' }, wikisource: 'Memorial de Aires' },
  },
  {
    slug: 'iracema', title: 'Iracema', author: 'José de Alencar', year: 1865, died: 1877, origin: 'BR', kind: 'Romance', mood: 'forest', emoji: '🏹',
    synopsis: 'Nas matas do Ceará, a virgem dos lábios de mel, guardiã do segredo da jurema, se apaixona pelo guerreiro português Martim. Uma lenda sobre o nascimento do Brasil, escrita como poema em prosa — cheia de rios, praias, pássaros e vento.',
    tags: ['indianismo', 'amor', 'natureza', 'Ceará'], find: { gutenberg: { title: 'Iracema', author: 'Alencar' }, wikisource: 'Iracema' },
  },
  {
    slug: 'o-guarani', title: 'O Guarani', author: 'José de Alencar', year: 1857, died: 1877, origin: 'BR', kind: 'Romance', mood: 'forest', emoji: '🌿',
    synopsis: 'No século XVII, às margens do Paquequer, o índio Peri dedica a vida a proteger Ceci, filha de um fidalgo português. Ataques, traições, enchentes e a floresta inteira em volta: aventura romântica das grandes.',
    tags: ['indianismo', 'aventura', 'floresta'], find: { gutenberg: { title: 'O Guarany', author: 'Alencar' }, wikisource: 'O Guarani' },
  },
  {
    slug: 'senhora', title: 'Senhora', author: 'José de Alencar', year: 1875, died: 1877, origin: 'BR', kind: 'Romance', mood: 'warm', emoji: '💍',
    synopsis: 'Aurélia, moça pobre abandonada pelo noivo interessado em dote, fica rica de repente — e decide comprar um marido. O escolhido é justamente quem a trocou por dinheiro. Um romance sobre amor, orgulho e o mercado de casamentos da Corte.',
    tags: ['amor', 'dinheiro', 'casamento'], find: { gutenberg: { title: 'Senhora', author: 'Alencar' }, wikisource: 'Senhora' },
  },
  {
    slug: 'luciola', title: 'Lucíola', author: 'José de Alencar', year: 1862, died: 1877, origin: 'BR', kind: 'Romance', mood: 'night', emoji: '🌹',
    synopsis: 'Recém-chegado ao Rio, Paulo conhece Lúcia, a cortesã mais admirada da cidade, e descobre por trás dela uma história que ninguém imagina. Romance urbano sobre aparências e redenção.',
    tags: ['amor', 'Rio de Janeiro', 'sociedade'], find: { gutenberg: { title: 'Luciola', author: 'Alencar' }, wikisource: 'Lucíola' },
  },
  {
    slug: 'o-cortico', title: 'O Cortiço', author: 'Aluísio Azevedo', year: 1890, died: 1913, origin: 'BR', kind: 'Romance', mood: 'city', emoji: '🏘️',
    synopsis: 'Em Botafogo, o português João Romão enriquece à custa de um cortiço barulhento, onde lavadeiras, operários e malandros vivem amontoados. O cortiço é quase um personagem: acorda, ferve, briga e arde. Ótimo para ler com o som da cidade.',
    tags: ['naturalismo', 'cidade', 'Rio de Janeiro'], find: { gutenberg: { title: 'O Cortiço', author: 'Azevedo' }, wikisource: 'O Cortiço' },
  },
  {
    slug: 'o-mulato', title: 'O Mulato', author: 'Aluísio Azevedo', year: 1881, died: 1913, origin: 'BR', kind: 'Romance', mood: 'tension', emoji: '⚖️',
    synopsis: 'Raimundo volta formado da Europa para São Luís e se apaixona pela prima Ana Rosa. A sociedade maranhense, porém, guarda um segredo sobre a origem dele. Romance que enfrentou o preconceito racial do Brasil escravocrata.',
    tags: ['racismo', 'Maranhão', 'naturalismo'], find: { gutenberg: { title: 'O Mulato', author: 'Azevedo' }, wikisource: 'O Mulato' },
  },
  {
    slug: 'policarpo-quaresma', title: 'Triste Fim de Policarpo Quaresma', author: 'Lima Barreto', year: 1915, died: 1922, origin: 'BR', kind: 'Romance', mood: 'calm', emoji: '🎸',
    synopsis: 'O major Quaresma ama o Brasil acima de tudo: estuda o tupi, toca violão, planta no sítio e propõe reformas ao governo. Seu patriotismo ingênuo esbarra a cada passo na realidade da República Velha. Engraçado e comovente.',
    tags: ['patriotismo', 'sátira', 'Rio de Janeiro'], find: { gutenberg: { title: 'Triste Fim de Policarpo Quaresma', author: 'Lima Barreto' }, wikisource: 'Triste Fim de Policarpo Quaresma' },
  },
  {
    slug: 'isaias-caminha', title: 'Recordações do Escrivão Isaías Caminha', author: 'Lima Barreto', year: 1909, died: 1922, origin: 'BR', kind: 'Romance', mood: 'city', emoji: '📰',
    synopsis: 'Isaías chega do interior ao Rio para ser doutor e acaba contínuo numa grande redação de jornal. Por dentro da imprensa da época, descobre como se fabricam reputações. Retrato ácido e muito atual.',
    tags: ['imprensa', 'racismo', 'Rio de Janeiro'], find: { gutenberg: { title: 'Recordações do Escrivão Isaías Caminha', author: 'Lima Barreto' }, wikisource: 'Recordações do Escrivão Isaías Caminha' },
  },
  {
    slug: 'sargento-de-milicias', title: 'Memórias de um Sargento de Milícias', author: 'Manuel Antônio de Almeida', year: 1854, died: 1861, origin: 'BR', kind: 'Romance', mood: 'warm', emoji: '🎭',
    synopsis: '“Era no tempo do rei.” As travessuras de Leonardo, menino e depois rapaz malandro do Rio de Janeiro de D. João VI, entre festas, procissões, barbeiros, comadres e o temido major Vidigal. Leve e muito engraçado.',
    tags: ['malandragem', 'humor', 'Rio de Janeiro'], find: { gutenberg: { title: 'Memorias de um Sargento de Milicias', author: 'Almeida' }, wikisource: 'Memórias de um Sargento de Milícias' },
  },
  {
    slug: 'escrava-isaura', title: 'A Escrava Isaura', author: 'Bernardo Guimarães', year: 1875, died: 1884, origin: 'BR', kind: 'Romance', mood: 'tension', emoji: '⛓️',
    synopsis: 'Isaura, educada como moça da casa-grande, ainda é escravizada — e o novo senhor, Leôncio, não aceita ser recusado. Fugas, disfarces e perseguição num folhetim abolicionista que marcou gerações.',
    tags: ['escravidão', 'fuga', 'romance'], find: { gutenberg: { title: 'A Escrava Isaura', author: 'Guimarães' }, wikisource: 'A Escrava Isaura' },
  },
  {
    slug: 'a-moreninha', title: 'A Moreninha', author: 'Joaquim Manuel de Macedo', year: 1844, died: 1882, origin: 'BR', kind: 'Romance', mood: 'sea', emoji: '🏝️',
    synopsis: 'Augusto, estudante namorador, aposta com os amigos que não vai se apaixonar durante um fim de semana numa ilha. Lá conhece a moreninha Carolina, e uma antiga promessa de infância. O primeiro grande romance romântico brasileiro.',
    tags: ['amor', 'ilha', 'juventude'], find: { gutenberg: { title: 'A Moreninha', author: 'Macedo' }, wikisource: 'A Moreninha' },
  },
  {
    slug: 'noite-na-taverna', title: 'Noite na Taverna', author: 'Álvares de Azevedo', year: 1855, died: 1852, origin: 'BR', kind: 'Contos', mood: 'night', emoji: '🍷',
    synopsis: 'Numa taverna, de madrugada, cinco amigos bêbados contam as histórias mais sombrias que viveram: naufrágios, amores proibidos, crimes e cemitérios. O conto gótico brasileiro por excelência — feito para ler com chuva e trovão.',
    tags: ['gótico', 'terror', 'noite'], find: { gutenberg: { title: 'Noite na Taverna', author: 'Azevedo' }, wikisource: 'Noite na Taverna' },
  },
  {
    slug: 'o-ateneu', title: 'O Ateneu', author: 'Raul Pompeia', year: 1888, died: 1895, origin: 'BR', kind: 'Romance', mood: 'cold', emoji: '🏫',
    synopsis: '“Vais encontrar o mundo”, diz o pai a Sérgio na porta do internato. Lá dentro, o menino descobre a hierarquia, o medo, as amizades e a vaidade do diretor Aristarco. Memórias de colégio com uma escrita brilhante.',
    tags: ['internato', 'infância', 'memória'], find: { gutenberg: { title: 'O Atheneu', author: 'Pompeia' }, wikisource: 'O Ateneu' },
  },
  {
    slug: 'inocencia', title: 'Inocência', author: 'Visconde de Taunay', year: 1872, died: 1899, origin: 'BR', kind: 'Romance', mood: 'forest', emoji: '🦋',
    synopsis: 'No sertão de Mato Grosso, o falso médico Cirino vai tratar da febre de Inocência, filha de um sertanejo severo já prometida a outro. Amor proibido no meio das veredas, dos buritis e das borboletas.',
    tags: ['sertão', 'amor', 'natureza'], find: { gutenberg: { title: 'Innocencia', author: 'Taunay' }, wikisource: 'Inocência' },
  },
  {
    slug: 'os-sertoes', title: 'Os Sertões', author: 'Euclides da Cunha', year: 1902, died: 1909, origin: 'BR', kind: 'Ensaio', mood: 'warm', emoji: '🌵',
    synopsis: 'A terra, o homem e a luta: Euclides descreve o sertão baiano e reconstrói a Guerra de Canudos, em que o Exército arrasou o arraial de Antônio Conselheiro. Meio ciência, meio epopeia, um dos livros fundamentais do Brasil.',
    tags: ['sertão', 'guerra', 'Bahia', 'história'], find: { gutenberg: { title: 'Os Sertões', author: 'Cunha' }, wikisource: 'Os Sertões' },
  },
  {
    slug: 'espumas-flutuantes', title: 'Espumas Flutuantes', author: 'Castro Alves', year: 1870, died: 1871, origin: 'BR', kind: 'Poesia', mood: 'sea', emoji: '🌊',
    synopsis: 'O único livro que o “poeta dos escravos” publicou em vida: poemas de amor, de saudade da Bahia e de revolta, com o fôlego de quem escrevia para ser declamado em voz alta.',
    tags: ['poesia', 'romantismo', 'Bahia'], find: { gutenberg: { title: 'Espumas Fluctuantes', author: 'Castro Alves' }, wikisource: 'Espumas Flutuantes' },
  },
  {
    slug: 'navio-negreiro', title: 'O Navio Negreiro', author: 'Castro Alves', year: 1869, died: 1871, origin: 'BR', kind: 'Poesia', mood: 'sea', emoji: '⛵',
    synopsis: '“Stamos em pleno mar…” O poema começa na beleza do oceano e desce ao porão de um navio negreiro. Um dos gritos mais fortes da poesia brasileira contra a escravidão.',
    tags: ['poesia', 'escravidão', 'mar'], find: { wikisource: 'O Navio Negreiro' },
  },
  {
    slug: 'primo-basilio', title: 'O Primo Basílio', author: 'Eça de Queirós', year: 1878, died: 1900, origin: 'PT', kind: 'Romance', mood: 'warm', emoji: '✉️',
    synopsis: 'Em Lisboa, com o marido viajando, Luísa reencontra o primo Basílio, seu antigo namorado. Cartas comprometedoras caem nas mãos da criada Juliana, e a casa vira um campo de tensão. Realismo português no auge.',
    tags: ['adultério', 'Lisboa', 'realismo'], find: { gutenberg: { title: 'O Primo Bazilio', author: 'Queiroz' }, wikisource: 'O Primo Basílio' },
  },
  {
    slug: 'os-maias', title: 'Os Maias', author: 'Eça de Queirós', year: 1888, died: 1900, origin: 'PT', kind: 'Romance', mood: 'calm', emoji: '🏛️',
    synopsis: 'No casarão do Ramalhete, em Lisboa, o jovem médico Carlos da Maia vive entre amigos, salões e projetos que nunca se cumprem — até conhecer uma mulher misteriosa. A crônica de uma família e de um país inteiro.',
    tags: ['família', 'Lisboa', 'realismo'], find: { gutenberg: { title: 'Os Maias', author: 'Queiroz' }, wikisource: 'Os Maias' },
  },
  {
    slug: 'padre-amaro', title: 'O Crime do Padre Amaro', author: 'Eça de Queirós', year: 1875, died: 1900, origin: 'PT', kind: 'Romance', mood: 'tension', emoji: '⛪',
    synopsis: 'O jovem padre Amaro chega a Leiria e se hospeda na casa da S. Joaneira, cuja filha Amélia é devota e bonita. Entre beatas, cônegos e fofocas de província, nasce uma paixão perigosa.',
    tags: ['igreja', 'província', 'realismo'], find: { gutenberg: { title: 'O Crime do Padre Amaro', author: 'Queiroz' }, wikisource: 'O Crime do Padre Amaro' },
  },
  {
    slug: 'amor-de-perdicao', title: 'Amor de Perdição', author: 'Camilo Castelo Branco', year: 1862, died: 1890, origin: 'PT', kind: 'Romance', mood: 'rain', emoji: '🥀',
    synopsis: 'Simão e Teresa se amam, mas pertencem a famílias inimigas em Viseu. Cartas escondidas, conventos, duelos e um amor que não aceita meio-termo: o “Romeu e Julieta” português, escrito na cadeia.',
    tags: ['amor trágico', 'Portugal', 'romantismo'], find: { gutenberg: { title: 'Amor de Perdição', author: 'Castello Branco' }, wikisource: 'Amor de Perdição' },
  },
  {
    slug: 'pupilas-do-senhor-reitor', title: 'As Pupilas do Senhor Reitor', author: 'Júlio Dinis', year: 1867, died: 1871, origin: 'PT', kind: 'Romance', mood: 'forest', emoji: '🌾',
    synopsis: 'Numa aldeia do Minho, o bondoso reitor cuida de duas órfãs, Margarida e Clara, enquanto os irmãos Pedro e Daniel bagunçam os corações da vila. Romance campestre, cheio de festas, sinos e colheitas.',
    tags: ['aldeia', 'amor', 'campo'], find: { gutenberg: { title: 'As Pupillas do Senhor Reitor', author: 'Diniz' }, wikisource: 'As Pupilas do Senhor Reitor' },
  },
  {
    slug: 'o-mandarim', title: 'O Mandarim', author: 'Eça de Queirós', year: 1880, died: 1900, origin: 'PT', kind: 'Romance', mood: 'tension', emoji: '🔔',
    synopsis: 'Teodoro, pobre amanuense em Lisboa, encontra num livro velho uma proposta: basta tocar uma campainha para que um mandarim riquíssimo morra na China e toda a fortuna dele passe para quem tocou. Uma fábula curta e fantástica sobre dinheiro e consciência.',
    tags: ['fantástico', 'dinheiro', 'culpa', 'Lisboa', 'China'], find: { gutenberg: { title: 'O Mandarim', author: 'Queiroz' }, wikisource: 'O Mandarim' },
  },
  {
    slug: 'morgadinha', title: 'A Morgadinha dos Canaviais', author: 'Júlio Dinis', year: 1868, died: 1871, origin: 'PT', kind: 'Romance', mood: 'forest', emoji: '🍇',
    synopsis: 'Henrique, lisboeta entediado e convencido de que está doente, vai se tratar numa aldeia do Minho. Entre a morgadinha Madalena, as festas, as eleições da terra e as intrigas dos vizinhos, descobre uma vida que não conhecia. Romance de aldeia, leve e bem-humorado.',
    tags: ['aldeia', 'campo', 'amor', 'humor', 'Portugal'], find: { gutenberg: { title: 'A Morgadinha dos Cannaviaes', author: 'Diniz' }, wikisource: 'A Morgadinha dos Canaviais' },
  },
  {
    slug: 'auto-da-barca', title: 'Auto da Barca do Inferno', author: 'Gil Vicente', year: 1517, died: 1536, origin: 'PT', kind: 'Teatro', mood: 'sea', emoji: '⛴️',
    synopsis: 'Num porto, duas barcas esperam as almas: uma vai para o Paraíso, outra para o Inferno. Fidalgo, agiota, frade, sapateiro e juiz tentam embarcar na certa — e o Diabo se diverte. Sátira de 500 anos que continua afiada.',
    tags: ['teatro', 'sátira', 'morte'], find: { gutenberg: { title: 'Auto da Barca do Inferno', author: 'Vicente' }, wikisource: 'Auto da Barca do Inferno' },
  },
];

export const acervoId = (slug: string) => `pt-${slug}`;
export const isAcervoId = (id: string) => id.startsWith('pt-') && ACERVO.some((a) => acervoId(a.slug) === id);
export const acervoBySlug = (slug: string) => ACERVO.find((a) => a.slug === slug);
