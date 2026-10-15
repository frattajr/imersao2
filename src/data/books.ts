import type { Mood } from '../core/types';

export interface SampleBook {
  id: string;
  title: string;
  sub: string;
  emoji: string;
  mood: Mood;
  pages: string[];
}

/** Histórias curtas incluídas no app para demonstrar o ambiente sonoro. */
export const SAMPLE_BOOKS: SampleBook[] = [
  {
    id: "sample-farol",
    title: "A Guardiã do Farol",
    sub: "Mistério e mar",
    emoji: "🏮",
    mood: 'sea',
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
];
