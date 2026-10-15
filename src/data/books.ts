import { sanitizePlan } from '../core/plan';
import type { Mood, ScenePlan } from '../core/types';
import { CLASSICS } from './classics';

/** Temas da biblioteca (filtros e fileiras da tela inicial). */
export const GENRES = ['Mistério', 'Fantasia', 'Aconchego', 'Suspense', 'Aventura'] as const;
export type Genre = (typeof GENRES)[number];

export interface SampleBook {
  id: string;
  title: string;
  sub: string;
  emoji: string;
  mood: Mood;
  genre: Genre;
  /** autor fictício, para o cartaz */
  author: string;
  synopsis: string;
  pages: string[];
  /**
   * Sonorização calibrada à mão, uma por página (matriz de mixagem + efeitos),
   * no mesmo formato que a IA devolve. Com ela o livro soa bem sem servidor.
   */
  plans?: unknown[];
  /** obra em domínio público (crédito mostrado na ficha) */
  credit?: string;
}

/** Histórias curtas incluídas no app para demonstrar o ambiente sonoro. */
export const SAMPLE_BOOKS: SampleBook[] = [
  // primeiro: clássicos de domínio público já sonorizados (primeira experiência, sem configurar nada)
  ...CLASSICS,
  {
    id: "sample-farol",
    title: "A Guardiã do Farol",
    sub: "Mistério e mar",
    emoji: "🏮",
    mood: 'sea',
    genre: 'Mistério',
    author: 'Ana Ventura',
    synopsis: "Numa noite de tempestade, Marina chega a um farol abandonado e descobre que não está sozinha.",
    pages: [
      "Marina chegou ao farol quando o céu já era uma ferida escura sobre o mar.",
      "O vento empurrava a porta como se não quisesse que ela entrasse. Ela empurrou de volta, e a madeira velha rangeu.",
      "Lá dentro, cheiro de sal e madeira velha. Nenhuma luz. Só o som das ondas batendo nas pedras, bem lá embaixo.",
      "Então veio o primeiro trovão. A chuva desabou de uma vez, grossa, pesada, batendo no telhado como mil dedos impacientes.",
      "Ela acendeu a lareira com as mãos tremendo. As chamas estalaram, e a sala ganhou um brilho dourado e vivo.",
      "Foi quando ouviu o barulho. Passos no andar de cima. Lentos. Arrastados. O coração dela disparou.",
      "Subiu a escada de ferro, degrau por degrau, no escuro. Cada degrau rangia como um grito baixinho.",
      "No topo, uma sombra se mexeu. Ela prendeu a respiração… e então viu: era um gato velho, de olhos amarelos, encolhido ao lado da lâmpada gigante.",
      "Marina riu, aliviada. O gato miou e esfregou o corpo quente na perna dela, como quem diz: seja bem-vinda.",
      "Juntos, giraram a velha lente. A engrenagem girou, o feixe de luz rasgou a tempestade e varreu o mar, procurando quem estivesse perdido.",
      "Horas depois, a chuva cansou. O vento virou brisa. Do alto, ela viu a lua abrir uma estrada de prata sobre as ondas.",
      "Na floresta de pinheiros atrás do farol, os grilos recomeçaram a cantar. A noite respirava de novo.",
      "Ao amanhecer, o sol subiu devagar, dourando a água. Marina sorriu, com o café quente nas mãos e o gato dormindo ao lado.",
      "Pela primeira vez em muito tempo, ela não sentia saudade de lugar nenhum. Estava em casa.",
    ],
  },
  {
    id: "sample-dragao",
    title: "A Noite do Dragão",
    sub: "Fantasia sombria",
    emoji: "🐉",
    mood: 'fire',
    genre: 'Fantasia',
    author: 'Tomás Brandão',
    synopsis: "No último posto de vigia do vale, um menino e um velho guarda ouvem algo enorme se aproximar pelas montanhas.",
    pages: [
      "Kael subiu a trilha de cascalho até o último posto de vigia, onde o vento cortava como faca. Atrás dele, o vale dormia sob a neve fina.",
      "No posto, o velho Orm mantinha uma fogueira baixa. As brasas estalavam, e a fumaça subia reta no ar parado.",
      "— Ouviu isso? — sussurrou Orm. Longe, nas montanhas, um uivo comprido atravessou a noite, e depois outro, mais perto.",
      "Os dois ficaram em silêncio. Então a terra tremeu de leve, e um rugido grave, enorme, rolou pelo vale como um trovão que não vinha do céu.",
      "Kael pegou a lanterna e desceu a escada de pedra até a muralha. Os passos ecoavam no corredor frio, e gotas pingavam do teto.",
      "Na muralha, o vento trouxe um cheiro de fumaça e enxofre. Lá embaixo, entre as árvores, algo muito grande se movia devagar, quebrando galhos.",
      "A criatura levantou a cabeça. Seus olhos brilharam como duas brasas, e o rugido veio de novo, tão perto que a muralha vibrou.",
      "Kael tocou o grande sino de alerta. O som metálico correu pelo vale, e uma a uma, as luzes do povoado começaram a acender.",
      "O dragão hesitou. Olhou para as luzes, para o sino, para o menino pequeno na muralha. E então, abrindo as asas, subiu para a noite e sumiu entre as nuvens.",
      "Ao amanhecer, restava apenas o silêncio, a neve e o cheiro de fumaça no ar. Kael sorriu, cansado, junto da fogueira que Orm acendeu de novo.",
    ],
  },
  {
    id: "sample-cafe",
    title: "Dois Cafés e uma Conversa",
    sub: "Reencontro em dia de chuva",
    emoji: "☕",
    mood: 'warm',
    genre: 'Aconchego',
    author: 'Clara Moreno',
    synopsis: "Dez anos depois, dois velhos amigos se reencontram num café enquanto a chuva fina de outubro cai lá fora.",
    pages: [
      "A chuva fina de outubro molhava as janelas do café quando Helena empurrou a porta. O sino acima dela tilintou baixinho.",
      "Lá dentro, o ar era quente e cheirava a café moído e pão assado. Em cada mesa, vozes baixas se misturavam ao barulho das xícaras.",
      "Ela escolheu a mesa junto à janela e pediu um cappuccino. O garçom sorriu, e logo se ouviu o chiado da máquina de espresso.",
      "Na mesa ao lado, dois velhos amigos discutiam sobre futebol, rindo alto. Mais atrás, uma jovem digitava no notebook, concentrada.",
      "Foi então que Tomás entrou, sacudindo o guarda-chuva. Fazia dez anos que não se viam, e nenhum dos dois sabia por onde começar.",
      "Falaram do tempo, do trabalho, da cidade onde cada um foi parar. As colheres tilintavam nas xícaras, e a conversa foi ficando fácil.",
      "Quando a chuva parou, o sol apareceu entre as nuvens e fez brilhar as poças lá fora. O café esvaziava aos poucos.",
      "Ao saírem, caminharam pela calçada molhada, em silêncio confortável. Alguns encontros, pensou Helena, só precisam de uma xícara para recomeçar.",
    ],
  },
  {
    id: "sample-trem",
    title: "O Último Trem",
    sub: "Suspense na madrugada",
    emoji: "🚆",
    mood: 'tension',
    genre: 'Suspense',
    author: 'Rafael Duarte',
    synopsis: "Meia-noite, uma plataforma vazia e o último trem. No vagão, só uma mulher de casaco vermelho.",
    pages: [
      "Rafael correu pela plataforma vazia, a mochila batendo nas costas. O relógio da estação marcava quase meia-noite.",
      "O apito do trem cortou a madrugada. As portas se abriram com um chiado, e ele entrou no último vagão.",
      "Dentro, só uma mulher de casaco vermelho, sentada ao fundo, olhando fixamente pela janela escura.",
      "O trem partiu devagar. Os trilhos começaram a cantar: tchac-tchac, tchac-tchac, cada vez mais rápido.",
      "De repente, as luzes piscaram. Uma, duas, três vezes. E apagaram.",
      "No escuro, ele ouviu um sussurro. Alguém dizendo o nome dele, bem baixinho, bem perto.",
      "Rafael acendeu a lanterna do celular. O banco ao fundo estava vazio. Só o casaco vermelho, jogado no assento.",
      "Então o trem freou com um rangido enorme. As portas se abriram sobre uma estação que ele nunca tinha visto.",
      "Lá fora, um sino antigo tocava devagar, e na plataforma alguém acenava. Era ela. E sorria.",
    ],
  },
  {
    id: "sample-floresta",
    title: "O Tesouro da Floresta",
    sub: "Aventura e fantasia",
    emoji: "🌲",
    mood: 'forest',
    genre: 'Aventura',
    author: 'Lia Campos',
    synopsis: "Um mapa escondido num carvalho leva Lia por riachos, cachoeiras e uma caverna com um segredo.",
    pages: [
      "Lia encontrou o mapa dentro do tronco oco de um velho carvalho. O papel estava amarelado, com um X desenhado em tinta vermelha.",
      "Ela seguiu a trilha de terra, e as folhas secas estalavam sob suas botas. Os passarinhos cantavam lá no alto.",
      "Um riacho de águas claras corria entre as pedras. Lia pulou de pedra em pedra, rindo, e a água respingou no rosto.",
      "Do outro lado, uma cachoeira despencava de uma rocha enorme. Atrás da cortina d'água, havia uma caverna escondida.",
      "Ela acendeu a tocha. Gotas pingavam no escuro, e o eco repetia cada passo. Um morcego passou voando, batendo as asas.",
      "No fundo da caverna, um baú de ferro coberto de musgo. Lia girou a chave enferrujada. O trinco rangeu e a tampa se abriu.",
      "Dentro, não havia ouro. Só uma pequena caixa de música, que começou a tocar sozinha uma melodia suave, como um sonho.",
      "E a floresta inteira pareceu escutar. Os pássaros calaram, o vento parou, e uma luz dourada encheu a caverna. Lia sorriu: aquele era o verdadeiro tesouro.",
    ],
  },
  {
    id: "sample-cabana",
    title: "A Cabana na Neve",
    sub: "Inverno e amizade",
    emoji: "🏔️",
    mood: 'cold',
    genre: 'Aconchego',
    author: 'Helena Prado',
    synopsis: "Presa numa cabana durante uma nevasca, Júlia recebe uma visita inesperada que muda o seu inverno.",
    pages: [
      "Capítulo 1 — A nevasca",
      "A neve começou a cair no meio da tarde, devagar, como quem pede licença. Quando Júlia percebeu, a estrada da montanha já tinha sumido sob um manto branco.",
      "Ela chegou à cabana de madeira com as mãos dormentes. A porta rangeu, e o cheiro de lenha velha e pinho encheu o ar frio lá dentro.",
      "Acendeu a lareira com os últimos fósforos. As chamas estalaram, tímidas no começo, e logo a sala inteira ganhou um brilho alaranjado.",
      "Lá fora, o vento assobiava entre os pinheiros e jogava neve contra a janela. O velho relógio da parede marcava o tempo, tic-tac, sem pressa.",
      "Capítulo 2 — O visitante",
      "Já era noite quando ouviu as batidas na porta. Três, firmes. Júlia prendeu a respiração. Ninguém subia a montanha com aquele tempo.",
      "Abriu uma fresta. Do lado de fora, coberto de neve até as sobrancelhas, um senhor de barba branca segurava uma lanterna e um cachorro peludo.",
      "— Desculpe incomodar — disse ele, tremendo. — Meu nome é Bento. A estrada fechou, e a sua chaminé era a única luz no vale.",
      "Ela o deixou entrar. O cachorro, Farol, sacudiu a neve no assoalho e foi direto deitar perto do fogo, como se a casa fosse dele.",
      "Bento contou histórias da montanha enquanto a chaleira chiava: o inverno em que o lago congelou inteiro, a raposa que roubava luvas, o sino da capela que tocava sozinho.",
      "Capítulo 3 — Manhã branca",
      "Júlia acordou com um silêncio enorme. A nevasca tinha passado. Pela janela, o vale inteiro brilhava, branco e azul, sob um céu limpo.",
      "Bento já estava lá fora, abrindo caminho na neve com uma pá. Os passos dele afundavam, macios, e Farol pulava atrás, latindo para os flocos que caíam dos galhos.",
      "Ao longe, o sino da capela tocou. Uma vez, duas. Bento sorriu. — Está vendo? Ele sempre toca quando alguém encontra o caminho de casa.",
      "Júlia não sabia se acreditava. Mas, com a caneca quente nas mãos e o sol nascendo sobre os pinheiros, sentiu que tinha encontrado alguma coisa naquela montanha.",
    ],
  },
  {
    id: "sample-navio",
    title: "O Navio da Névoa",
    sub: "Mistério em alto-mar",
    emoji: "⛵",
    mood: 'sea',
    genre: 'Mistério',
    author: 'Diogo Arruda',
    synopsis: "Um cargueiro encontra à deriva um veleiro antigo, intacto e sem ninguém a bordo. O diário do capitão termina no meio de uma frase.",
    pages: [
      "Capítulo 1 — À deriva",
      "A névoa chegou sem aviso e engoliu o mar. Do convés do Estrela do Sul, Inês mal enxergava a própria mão na amurada molhada.",
      "Então a sirene de nevoeiro soou ao longe, grave e comprida. Não era a deles. Alguém mais estava ali, perdido no branco.",
      "Pouco depois, um veleiro antigo surgiu da névoa, balançando nas ondas, com as velas rasgadas e o casco de madeira rangendo a cada movimento.",
      "Capítulo 2 — A bordo",
      "Inês e o velho marinheiro Caetano remaram até o veleiro. A escada de corda estava solta. Subiram em silêncio, ouvindo só as ondas batendo no casco.",
      "O convés estava vazio. Cordas enroladas com capricho, uma lanterna ainda morna pendurada no mastro, e um gato preto que os observava do alto do leme.",
      "Desceram à cabine do capitão. A madeira dos degraus gemia sob os passos. Lá dentro, gotas pingavam de uma rachadura no teto, uma a uma, sobre a mesa.",
      "Sobre a mesa, um diário aberto. A última frase dizia: “Esta noite, ouvimos o sino de novo, e decidimos seguir o som até”. E mais nada.",
      "Capítulo 3 — O sino",
      "Quando voltaram ao convés, a névoa começava a se abrir. E, bem longe, por cima das ondas, um sino tocou. Devagar. Como se chamasse alguém.",
      "Caetano tirou o chapéu. — Os antigos diziam que esse sino guia os navios perdidos para casa. Só toca para quem precisa ouvir.",
      "Inês olhou para o horizonte e viu, por um instante, a silhueta de um farol onde nenhum mapa mostrava terra. Depois a névoa voltou, e o som sumiu com ela.",
      "Naquela noite, ela abriu o diário e escreveu, embaixo da última frase do capitão: “o lugar onde todos os que se perdem são finalmente encontrados.”",
    ],
  },
  {
    id: "sample-mercado",
    title: "O Mercado das Lanternas",
    sub: "Aventura na cidade antiga",
    emoji: "🪔",
    mood: 'city',
    genre: 'Aventura',
    author: 'Marcos Tavares',
    synopsis: "Uma moeda estranha leva Davi a um mercado noturno que só aparece quando todas as lanternas da cidade velha se acendem.",
    pages: [
      "Capítulo 1 — A moeda",
      "Davi achou a moeda entre as pedras da calçada, perto da fonte da praça. Era de cobre, quente ao toque, com uma lanterna gravada de um lado e uma lua do outro.",
      "Naquela noite, o relógio da torre bateu doze vezes, e as lanternas da cidade velha se acenderam sozinhas, uma por uma, rua após rua.",
      "Capítulo 2 — A rua que não existia",
      "Seguindo a luz, ele encontrou uma rua que nunca tinha visto. Estreita, de pedra, cheia de barracas coloridas e de uma multidão que falava baixinho.",
      "Havia vendedores de mapas que mudavam de lugar, de caixinhas de música que tocavam lembranças, de chaves para portas que ainda não existiam.",
      "Um cavalo puxava uma carroça de especiarias, os cascos batendo no chão de pedra. O cheiro de canela e cravo se misturava à fumaça das lanternas.",
      "Uma senhora de xale vermelho segurou o braço dele. — Essa moeda compra uma única coisa aqui, menino. Escolha bem. O mercado só abre uma vez para cada um.",
      "Capítulo 3 — A escolha",
      "Davi andou por todas as barracas. Viu relógios que voltavam no tempo e livros que se escreviam sozinhos. Mas parou diante de uma caixinha de música simples, de madeira.",
      "Quando a abriu, ouviu a melodia que a avó cantava para ele dormir. Os olhos dele se encheram d'água. Entregou a moeda sem pensar duas vezes.",
      "O sino da torre tocou uma vez. As lanternas se apagaram, a rua sumiu, e Davi estava de novo na praça, sozinho, com a caixinha nas mãos.",
      "Desde então, toda noite, ela toca a mesma canção. E Davi jura que, quando o relógio bate meia-noite, consegue ouvir ao longe as vozes do mercado.",
    ],
  },
];

/** Livros públicos (exemplos e Project Gutenberg): nunca disparam a IA, só usam cache pré-calculado. */
export const isPublicBook = (id: string) => id.startsWith('sample-') || /^gut-\d+$/.test(id);

/** Planos calibrados do livro de exemplo (validados como qualquer plano vindo de fora). */
export function bundledPlans(id: string): (ScenePlan | null)[] | undefined {
  const b = SAMPLE_BOOKS.find((x) => x.id === id);
  return b?.plans?.map((p) => sanitizePlan(p));
}
