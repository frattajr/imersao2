/**
 * Obras de domínio público já sonorizadas, para a primeira experiência no
 * app (sem chave de API, sem upload). Traduções e adaptações feitas para o
 * Imersão a partir dos originais em domínio público.
 *
 * Cada página traz um plano calibrado à mão no mesmo formato que a IA
 * devolve (matriz de mixagem + efeitos), validado por sanitizePlan.
 */
import type { SampleBook } from './books';

type Stem = [s: string, gain: number, priority: 1 | 2 | 3, lowpass?: number];
type Fx = { s: string; at: number; w: number; [k: string]: unknown };

/** Plano compacto: clima, stems [nome, ganho, prioridade, low-pass?] e efeitos. */
const P = (mood: string, stems: Stem[], spots: Fx[] = [], looks: Record<string, Record<string, string>> = {}) => ({
  mood,
  mix: stems.map(([s, gain, priority, lowpass]) => ({ s, gain, priority, ...(lowpass ? { lowpass } : {}) })),
  spots,
  looks,
});

/* ---------------------------------------------------------------- */
/* O Coração Delator — Edgar Allan Poe (1843)                         */
/* ---------------------------------------------------------------- */
const NIGHT_ROOM: Stem[] = [['night', 0.3, 1, 2600], ['clock', 0.22, 2], ['drone', 0.14, 3]];
const TENSE_ROOM: Stem[] = [['night', 0.26, 1, 2200], ['drone', 0.26, 2], ['clock', 0.2, 2]];
const DAWN_ROOM: Stem[] = [['clock', 0.24, 1], ['night', 0.2, 2, 3000]];
const indoor = { night: { place: 'indoor' }, clock: { place: 'indoor', detail: 'old wall clock' } };
const heart = (at: number, w: number, n = 8): Fx => ({ s: 'heartbeat', at, w, n, v: { distance: 'near', detail: 'muffled under floor' } });

const CORACAO: SampleBook = {
  id: 'sample-poe-coracao',
  title: 'O Coração Delator',
  sub: 'Horror psicológico',
  emoji: '🫀',
  mood: 'tension',
  genre: 'Suspense',
  author: 'Edgar Allan Poe',
  credit: 'Edgar Allan Poe, 1843 · tradução e adaptação Imersão · domínio público',
  synopsis: 'Um narrador jura que não é louco enquanto conta, com calma assustadora, como planejou livrar-se do olho de um velho — até que um som abafado começa a crescer sob o assoalho.',
  pages: [
    'Parte I — O olho',
    'É verdade! Nervoso — muito, terrivelmente nervoso eu estava e estou. Mas por que dizer que sou louco? A doença aguçou meus sentidos; não os destruiu. Acima de tudo, a audição era aguda. Ouvi todas as coisas do céu e da terra. Como, então, sou louco? Escutem com que calma posso contar-lhes toda a história.',
    'É impossível dizer como a ideia entrou pela primeira vez no meu cérebro; mas, uma vez concebida, perseguiu-me dia e noite. Não havia objetivo. Não havia paixão. Eu amava o velho. Ele nunca me fizera mal. Seu ouro, eu não o desejava.',
    'Acho que era o olho dele! Sim, era isso! Um de seus olhos parecia o de um abutre — azul-pálido, coberto por uma película. Sempre que caía sobre mim, meu sangue gelava; e assim, muito gradualmente, decidi tirar a vida do velho e livrar-me do olho para sempre.',
    'Vocês me acham louco. Loucos não sabem nada. Mas deviam ter-me visto. Deviam ter visto com que sabedoria agi — com que cautela, com que previsão, com que dissimulação fui ao trabalho!',
    'Nunca fui tão gentil com o velho quanto na semana antes de matá-lo. E todas as noites, perto da meia-noite, eu girava o trinco da porta dele e a abria — ah, tão devagar! Quando a abertura bastava para minha cabeça, eu enfiava uma lanterna escura, toda fechada, para que nenhuma luz escapasse.',
    'Depois enfiava a cabeça. Movia-a lentamente — muito, muito lentamente — para não perturbar o sono do velho. Levava uma hora para pôr a cabeça inteira na abertura, até poder vê-lo deitado na cama.',
    'Então eu abria a lanterna com cautela — pois as dobradiças rangiam — só o bastante para que um raio fino caísse sobre o olho de abutre. Fiz isso por sete longas noites, sempre à meia-noite, mas encontrava o olho sempre fechado; e assim era impossível fazer o trabalho.',
    'Parte II — A oitava noite',
    'Na oitava noite fui ainda mais cauteloso ao abrir a porta. O ponteiro dos minutos de um relógio se move mais depressa do que se movia a minha mão. Nunca, antes daquela noite, sentira a extensão dos meus próprios poderes.',
    'Mal conseguia conter a sensação de triunfo. Pensar que eu estava ali, abrindo a porta pouco a pouco, e ele nem sonhava com meus pensamentos secretos. Ri baixinho com a ideia; e talvez ele tenha ouvido, pois se mexeu na cama de repente, como se assustado.',
    'Eu tinha a cabeça dentro do quarto e estava prestes a abrir a lanterna quando meu polegar escorregou no fecho de lata, e o velho saltou na cama, gritando: — Quem está aí?',
    'Fiquei imóvel e não disse nada. Durante uma hora inteira não movi um músculo, e nesse tempo não o ouvi deitar-se. Ele continuava sentado na cama, escutando — exatamente como eu fizera, noite após noite, ouvindo os besouros da morte dentro da parede.',
    'Então ouvi um leve gemido, e soube que era o gemido do terror mortal. Não era de dor nem de tristeza — era o som abafado que sobe do fundo da alma quando ela está carregada de pavor. Eu conhecia bem aquele som.',
    'Esperei muito tempo, com muita paciência, e resolvi abrir uma fresta — muito, muito pequena — na lanterna. Um único raio pálido, como o fio de uma teia de aranha, disparou da fresta e caiu sobre o olho de abutre.',
    'Estava aberto — bem, bem aberto — e fiquei furioso ao olhar para ele. Vi-o com perfeita nitidez: um azul opaco, com um véu horrendo que me gelava até a medula dos ossos.',
    'E então chegou aos meus ouvidos um som baixo, surdo, rápido, como o de um relógio envolto em algodão. Eu conhecia bem aquele som também. Era a batida do coração do velho. Ela aumentou minha fúria, como o tambor estimula a coragem do soldado.',
    'Mesmo assim me contive e fiquei imóvel. Mal respirava. Mas o infernal tamborilar do coração aumentava. Ficava mais rápido e mais rápido, mais alto e mais alto a cada instante. O terror do velho devia ser extremo!',
    'E agora, na hora morta da noite, no silêncio pavoroso daquela casa velha, um ruído tão estranho me levou a um terror incontrolável. E uma nova angústia me tomou: o som seria ouvido por um vizinho! A hora do velho havia chegado!',
    'Com um grito, escancarei a lanterna e saltei para dentro do quarto. Ele gritou uma vez — apenas uma. Num instante arrastei-o para o chão e puxei a cama pesada sobre ele. Durante muitos minutos o coração continuou batendo, abafado. Por fim, cessou. O olho não me perturbaria mais.',
    'Parte III — As tábuas do assoalho',
    'Se ainda me julgam louco, deixarão de julgar quando eu descrever as precauções que tomei. Trabalhei depressa, mas em silêncio. Ergui três tábuas do assoalho do quarto e escondi tudo entre as vigas. Depois recoloquei as tábuas com tanta habilidade que nenhum olho humano poderia ter notado algo errado.',
    'Quando terminei eram quatro horas — ainda escuro como meia-noite. Quando o sino deu a hora, bateram à porta da rua. Desci para abrir com o coração leve — pois o que tinha eu a temer agora?',
    'Entraram três homens, que se apresentaram, com perfeita cortesia, como oficiais de polícia. Um vizinho ouvira um grito durante a noite; levantara-se a suspeita de algum crime, e eles tinham vindo revistar a casa.',
    'Sorri — pois o que tinha a temer? Disse que o grito fora meu, num sonho. O velho, mencionei, estava fora, no campo. Levei os visitantes por toda a casa. Pedi que revistassem bem. Por fim, levei-os ao quarto dele, trouxe cadeiras e pedi que descansassem ali.',
    'Pus minha cadeira exatamente sobre o lugar onde repousava a vítima. Os oficiais estavam satisfeitos. Sentaram-se e conversaram sobre coisas banais, e eu respondia com alegria. Mas, pouco depois, senti que empalidecia e desejei que fossem embora.',
    'Minha cabeça doía, e eu imaginava um zumbido nos ouvidos; eles continuavam sentados, conversando. O zumbido ficou mais distinto. Falei com mais desenvoltura para me livrar da sensação, mas ela persistia, até que descobri que o barulho não estava nos meus ouvidos.',
    'Era um som baixo, surdo, rápido — muito parecido com o de um relógio envolto em algodão. Arquejei — e mesmo assim os oficiais não o ouviam. Falei mais depressa, mais alto; mas o barulho crescia sem parar.',
    'Andei de um lado para o outro no assoalho, com passos pesados — mas o barulho crescia sem parar. Arrastei a cadeira sobre as tábuas, fazendo-a ranger — mas o barulho dominava tudo. Ficava mais alto — mais alto — mais alto!',
    'E os homens ainda conversavam e sorriam. Seria possível que não ouvissem? Não! Ouviam! Suspeitavam! Sabiam! Estavam zombando do meu horror! Eu precisava gritar ou morrer! E agora — de novo! Ouçam! Mais alto! Mais alto!',
    '— Miseráveis! — gritei. — Não finjam mais! Eu confesso! Arranquem as tábuas! Aqui, aqui! É a batida do seu coração horrendo!',
  ],
  plans: [
    P('tension', NIGHT_ROOM, [], indoor),
    P('tension', NIGHT_ROOM, [], indoor),
    P('tension', NIGHT_ROOM, [], indoor),
    P('tension', TENSE_ROOM, [], indoor),
    P('tension', NIGHT_ROOM, [], indoor),
    P('night', NIGHT_ROOM, [{ s: 'door', kind: 'creak', at: 3, w: 0.35, v: { place: 'indoor', distance: 'near', intensity: 'soft' } }], indoor),
    P('night', NIGHT_ROOM, [], indoor),
    P('night', NIGHT_ROOM, [{ s: 'creak', at: 3.5, w: 0.3, v: { material: 'metal', place: 'indoor', detail: 'old door hinge' } }], indoor),
    P('night', TENSE_ROOM, [], indoor),
    P('night', TENSE_ROOM, [], indoor),
    P('night', TENSE_ROOM, [{ s: 'rustle', at: 6, w: 0.3, v: { material: 'fabric', place: 'indoor', detail: 'bed sheets' } }], indoor),
    P('tension', TENSE_ROOM, [{ s: 'keys', at: 2.5, w: 0.3, v: { material: 'metal', detail: 'tin latch slip' } }], indoor),
    P('tension', [['night', 0.22, 1, 1800], ['drone', 0.3, 2], ['clock', 0.16, 3]], [], indoor),
    P('tension', [['night', 0.22, 1, 1800], ['drone', 0.32, 2], ['clock', 0.16, 3]], [], indoor),
    P('tension', TENSE_ROOM, [], indoor),
    P('tension', TENSE_ROOM, [], indoor),
    P('tension', [['drone', 0.3, 1], ['night', 0.2, 2, 1600]], [heart(3, 0.35, 10)], indoor),
    P('tension', [['drone', 0.34, 1], ['night', 0.18, 2, 1400]], [heart(1.5, 0.45, 12)], indoor),
    P('tension', [['drone', 0.36, 1], ['night', 0.16, 2, 1400]], [heart(1, 0.55, 12)], indoor),
    P('tension', [['drone', 0.3, 1], ['night', 0.2, 2, 1800]], [heart(1, 0.4, 6), { s: 'creak', at: 4, w: 0.45, v: { material: 'wood', place: 'indoor', detail: 'heavy bed dragged' } }], indoor),
    P('night', DAWN_ROOM, [], indoor),
    P('night', DAWN_ROOM, [{ s: 'creak', at: 3, w: 0.35, v: { material: 'wood', place: 'indoor', detail: 'floorboards lifted' } }], indoor),
    P('night', DAWN_ROOM, [{ s: 'bell', n: 4, at: 2.5, w: 0.3, v: { distance: 'far', place: 'outdoor' } }, { s: 'knock', n: 3, at: 6, w: 0.45, v: { material: 'wood', distance: 'mid' } }], indoor),
    P('calm', DAWN_ROOM, [{ s: 'steps', surface: 'wood', n: 6, pace: 0.6, at: 2, w: 0.35, v: { place: 'indoor', distance: 'mid' } }], indoor),
    P('calm', DAWN_ROOM, [], indoor),
    P('calm', DAWN_ROOM, [], indoor),
    P('tension', [['drone', 0.26, 1], ['clock', 0.18, 2]], [heart(2, 0.3, 8)], indoor),
    P('tension', [['drone', 0.3, 1], ['clock', 0.14, 3]], [heart(1, 0.45, 12)], indoor),
    P('tension', [['drone', 0.34, 1]], [{ s: 'steps', surface: 'wood', n: 8, pace: 0.45, at: 1, w: 0.45, v: { place: 'indoor', intensity: 'strong' } }, heart(3, 0.55, 12)], indoor),
    P('tension', [['drone', 0.38, 1]], [heart(0.8, 0.65, 14)], indoor),
    P('tension', [['drone', 0.3, 1]], [heart(0.5, 0.7, 6)], indoor),
  ],
};

/* ---------------------------------------------------------------- */
/* O Barril de Amontillado — Edgar Allan Poe (1846)                   */
/* ---------------------------------------------------------------- */
const CARNIVAL: Stem[] = [['crowd', 0.4, 1, 3500], ['night', 0.2, 2], ['city', 0.18, 3, 2500]];
const VAULT: Stem[] = [['drone', 0.18, 2], ['fire', 0.16, 3, 2500]];
const vaultLooks = { fire: { place: 'cave', detail: 'flaming torch' }, drone: { place: 'cave' } };
const drip = (at: number): Fx => ({ s: 'drip', n: 4, at, w: 0.3, v: { place: 'cave', distance: 'mid' } });
const jester = (at: number, w = 0.3): Fx => ({ s: 'doorbell', at, w, v: { detail: 'jester cap bells', distance: 'near' } });

const AMONTILLADO: SampleBook = {
  id: 'sample-poe-amontillado',
  title: 'O Barril de Amontillado',
  sub: 'Vingança nas catacumbas',
  emoji: '🍷',
  mood: 'tension',
  genre: 'Suspense',
  author: 'Edgar Allan Poe',
  credit: 'Edgar Allan Poe, 1846 · tradução e adaptação Imersão · domínio público',
  synopsis: 'Em plena noite de carnaval, Montresor atrai o orgulhoso Fortunato para as catacumbas da família com a promessa de um vinho raro. Quanto mais fundo descem, mais claro fica o plano.',
  pages: [
    'Parte I — O carnaval',
    'Suportei como pude as mil injúrias de Fortunato; mas, quando ele passou ao insulto, jurei vingança. Eu devia punir — e punir sem ser punido. Uma ofensa não está reparada quando o castigo alcança quem vinga, nem quando o ofensor não sabe quem o castigou.',
    'Fortunato tinha um ponto fraco, embora fosse um homem a ser respeitado e até temido. Orgulhava-se de ser um grande conhecedor de vinhos. Nisso eu não era diferente dele: eu mesmo era hábil nas safras italianas e comprava muito sempre que podia.',
    'Foi ao entardecer, durante a loucura do carnaval, que encontrei meu amigo. Ele me cumprimentou com excessivo calor, pois tinha bebido muito. Vestia uma roupa listrada e justa, e na cabeça levava um chapéu cônico de guizos.',
    '— Meu caro Fortunato — disse eu —, que sorte encontrá-lo! Recebi um barril do que dizem ser Amontillado, e tenho minhas dúvidas.\n— Amontillado? Um barril? Impossível! No meio do carnaval!',
    '— Tenho minhas dúvidas — repeti —, e fui tolo o bastante para pagar o preço inteiro sem consultá-lo. Como você está ocupado, vou procurar Luchesi. Se alguém tem gosto refinado, é ele.\n— Luchesi não distingue Amontillado de xerez! Vamos, vamos às suas adegas.',
    'Pondo uma máscara de seda preta e envolvendo-me numa capa, deixei que ele me levasse depressa ao meu palácio. Não havia criados em casa: eu lhes dissera que só voltaria de manhã e lhes dera ordens explícitas de não sair. Ordens que, eu bem sabia, bastavam para garantir que todos desaparecessem assim que eu virasse as costas.',
    'Parte II — As catacumbas',
    'Peguei duas tochas e conduzi-o por uma longa escada em caracol, pedindo que tomasse cuidado. Chegamos enfim ao pé da descida e ficamos juntos sobre o chão úmido das catacumbas dos Montresor. O passo do meu amigo era vacilante, e os guizos do chapéu tilintavam a cada passada.',
    '— O barril — disse ele.\n— Está mais adiante — respondi. — Mas veja as teias brancas que brilham nas paredes desta caverna. É o salitre.',
    'Ele virou-se para mim e me olhou nos olhos com duas órbitas turvas que destilavam a embriaguez. Então tossiu, uma tosse longa, que o dobrou ao meio.\n— Não é nada — disse por fim.',
    '— Venha — disse eu, com firmeza —, vamos voltar. Sua saúde é preciosa. Você é rico, respeitado, admirado, amado; é feliz, como eu já fui. A umidade daqui vai fazer mal.\n— Basta — disse ele. — A tosse não é nada; não vai me matar. Não morrerei de uma tosse.\n— É verdade, é verdade — respondi.',
    'Abri uma garrafa de Médoc que tirei de uma longa fileira deitada no mofo. Ele a levou aos lábios com um sorriso. — Bebo — disse — aos mortos que repousam à nossa volta.\n— E eu, à sua longa vida.',
    'Seguimos. O salitre pendia como musgo das abóbadas. Estávamos abaixo do leito do rio, e as gotas de umidade escorriam entre os ossos. Os guizos tilintavam. Os olhos dele brilhavam com o vinho.',
    'Passamos por arcos baixos, descemos, avançamos e descemos de novo, até chegarmos a uma cripta profunda, onde o ar viciado fazia as tochas mais brilharem em brasa do que arderem em chama.',
    'Parte III — O nicho',
    'No fundo da cripta havia outra, menor. Suas paredes tinham sido cobertas de restos humanos, empilhados até a abóbada. Num dos lados, os ossos tinham sido derrubados e jaziam no chão, revelando um nicho de pouco mais de um metro de profundidade.',
    '— Siga — disse eu. — Aqui está o Amontillado.\nEle avançou cambaleando, enquanto eu o seguia de perto. Num instante chegou à parede de pedra e parou, confuso. Um momento depois, eu o havia acorrentado ao granito.',
    'Havia na parede dois grampos de ferro, e de um deles pendia uma corrente curta; do outro, um cadeado. Passei a corrente em volta da cintura dele e a prendi em poucos segundos. Ele estava atônito demais para resistir.',
    '— Passe a mão pela parede — disse eu. — Não pode deixar de sentir o salitre. É realmente muito úmido. Mais uma vez, eu lhe imploro: volte. Não? Então devo deixá-lo. Mas antes vou lhe prestar todas as pequenas atenções que estiverem ao meu alcance.',
    'Do monte de ossos tirei pedras e argamassa. Com elas, e com a ajuda da minha colher de pedreiro, comecei com vigor a fechar a entrada do nicho. Mal tinha assentado a primeira fileira quando percebi que a embriaguez dele passara: veio do fundo um gemido baixo, que não era de homem bêbado.',
    'Depois, um longo e obstinado silêncio. Assentei a segunda fileira, a terceira, a quarta; e então ouvi as vibrações furiosas da corrente. O barulho durou vários minutos, durante os quais parei o trabalho e me sentei sobre os ossos, para escutá-lo com mais satisfação.',
    'Quando a parede chegou à altura do meu peito, uma sucessão de gritos altos e agudos, vindos da forma acorrentada, pareceu me empurrar para trás. Hesitei, tremi. Então pus a mão sobre a sólida construção das catacumbas e me acalmei. Respondi aos gritos de quem clamava. Ecoei-os. Superei-os em volume. Ele se calou.',
    'Era meia-noite, e meu trabalho chegava ao fim. Restava uma única pedra. Então veio do nicho um riso baixo, que me arrepiou os cabelos, seguido de uma voz triste:\n— Ha! ha! ha! — uma boa piada, de fato. Vamos rir muito disso no palácio, tomando nosso vinho! Mas não está ficando tarde? Vamos embora.',
    '— Sim — respondi —, vamos embora.\n— Pelo amor de Deus, Montresor!\n— Sim — disse eu —, pelo amor de Deus!',
    'Chamei em voz alta: — Fortunato! — Nenhuma resposta. Chamei de novo. Nenhuma resposta. Enfiei uma tocha pela abertura restante e deixei-a cair lá dentro. Em resposta, veio apenas o tilintar dos guizos.',
    'Meu coração ficou pesado — por causa da umidade das catacumbas. Apressei-me em terminar o trabalho. Forcei a última pedra no lugar e a cobri de argamassa. Contra a nova parede reergui a antiga muralha de ossos. Por meio século, nenhum mortal os perturbou. Que descanse em paz!',
  ],
  plans: [
    P('city', CARNIVAL),
    P('night', [['night', 0.26, 1], ['drone', 0.14, 3]]),
    P('night', [['night', 0.26, 1], ['drone', 0.12, 3]]),
    P('city', CARNIVAL, [jester(3, 0.35)]),
    P('city', CARNIVAL),
    P('city', CARNIVAL, [jester(5, 0.25)]),
    P('night', [['night', 0.24, 1], ['crowd', 0.16, 2, 900]], [{ s: 'steps', surface: 'stone', n: 6, pace: 0.55, at: 2, w: 0.35, v: { place: 'hall' } }]),
    P('night', [['drone', 0.16, 1], ['fire', 0.14, 2, 2500]], [], vaultLooks),
    P('tension', VAULT, [{ s: 'steps', surface: 'stone', n: 8, pace: 0.7, at: 1.5, w: 0.35, v: { place: 'cave', detail: 'spiral stone stairs' } }, jester(5, 0.25)], vaultLooks),
    P('tension', VAULT, [drip(3)], vaultLooks),
    P('tension', VAULT, [], vaultLooks),
    P('tension', VAULT, [drip(5)], vaultLooks),
    P('tension', VAULT, [{ s: 'rustle', at: 2, w: 0.25, v: { material: 'glass', detail: 'dusty wine bottle' } }], vaultLooks),
    P('tension', [['drone', 0.2, 1], ['water', 0.12, 3, 900], ['fire', 0.14, 2, 2200]], [drip(2), jester(5, 0.22)], { ...vaultLooks, water: { place: 'cave', detail: 'river above vault' } }),
    P('tension', [['drone', 0.24, 1], ['fire', 0.12, 3, 1600]], [drip(4)], vaultLooks),
    P('tension', [['drone', 0.26, 1], ['fire', 0.12, 3, 1600]], [], vaultLooks),
    P('tension', [['drone', 0.26, 1], ['fire', 0.12, 3, 1600]], [{ s: 'rustle', at: 3, w: 0.25, v: { material: 'stone', detail: 'old bones shifting' } }], vaultLooks),
    P('tension', [['drone', 0.3, 1], ['fire', 0.12, 3, 1600]], [{ s: 'chains', at: 4.5, w: 0.5, v: { place: 'cave', distance: 'near' } }], vaultLooks),
    P('tension', [['drone', 0.3, 1], ['fire', 0.12, 3, 1600]], [{ s: 'chains', at: 2, w: 0.4, v: { place: 'cave', distance: 'near' } }, { s: 'keys', at: 5, w: 0.35, v: { material: 'metal', detail: 'padlock snap' } }], vaultLooks),
    P('tension', [['drone', 0.28, 1], ['fire', 0.12, 3, 1600]], [], vaultLooks),
    P('tension', [['drone', 0.3, 1], ['fire', 0.1, 3, 1600]], [{ s: 'knock', n: 4, at: 3, w: 0.3, v: { material: 'stone', detail: 'trowel tapping brick' } }], vaultLooks),
    P('tension', [['drone', 0.34, 1]], [{ s: 'chains', at: 2.5, w: 0.55, rep: 2, gap: 4, v: { place: 'cave', intensity: 'strong' } }], vaultLooks),
    P('tension', [['drone', 0.38, 1]], [], vaultLooks),
    P('tension', [['drone', 0.3, 1]], [{ s: 'knock', n: 2, at: 2, w: 0.25, v: { material: 'stone', detail: 'trowel tapping brick' } }], vaultLooks),
    P('tension', [['drone', 0.32, 1]], [], vaultLooks),
    P('tension', [['drone', 0.26, 1]], [jester(4.5, 0.3)], vaultLooks),
    P('night', [['drone', 0.18, 1], ['night', 0.14, 2, 1200]], [{ s: 'rustle', at: 3, w: 0.25, v: { material: 'stone', detail: 'old bones shifting' } }], vaultLooks),
  ],
};

/* ---------------------------------------------------------------- */
/* O Sinaleiro — Charles Dickens (1866)                               */
/* ---------------------------------------------------------------- */
const CUTTING: Stem[] = [['wind', 0.32, 1, 3000], ['drone', 0.14, 3]];
const BOX: Stem[] = [['fire', 0.26, 1], ['clock', 0.16, 2], ['wind', 0.16, 3, 900]];
const boxLooks = { fire: { place: 'indoor', detail: 'small coal stove' }, wind: { place: 'indoor' }, clock: { place: 'indoor' } };
const cutLooks = { wind: { place: 'outdoor', detail: 'deep railway cutting' } };
const sigBell = (at: number, w = 0.35): Fx => ({ s: 'bell', n: 3, at, w, v: { material: 'metal', place: 'indoor', detail: 'small railway signal bell' } });
const whistle = (at: number, w = 0.4): Fx => ({ s: 'horn', kind: 'whistle', at, w, v: { distance: 'far', detail: 'steam train whistle' } });

const SINALEIRO: SampleBook = {
  id: 'sample-dickens-sinaleiro',
  title: 'O Sinaleiro',
  sub: 'Fantasmas na ferrovia',
  emoji: '🚂',
  mood: 'tension',
  genre: 'Mistério',
  author: 'Charles Dickens',
  credit: 'Charles Dickens, 1866 · tradução e adaptação Imersão · domínio público',
  synopsis: 'No fundo de um corte ferroviário úmido, junto à boca de um túnel, um sinaleiro solitário conta a um visitante sobre uma aparição que sempre surge antes de uma tragédia.',
  pages: [
    'Parte I — O corte',
    '— Olá! Aí embaixo!\nQuando ouviu a voz que o chamava, ele estava à porta da sua cabine, com uma bandeira enrolada na mão. Em vez de olhar para cima, onde eu estava, virou-se e olhou para a linha.',
    'Havia algo de notável no seu modo de fazer aquilo. Eu estava no alto de um corte profundo e íngreme, e ele lá embaixo, encolhido na sombra. O sol se punha com tanta força que precisei proteger os olhos para vê-lo.',
    'Naquele instante, uma vibração surda subiu da terra e virou um rugido. Um trem passou lá embaixo, veloz, e o vapor quase me tirou do lugar. Quando a fumaça se dissipou, vi o homem enrolar de novo a bandeira que mostrara ao trem.',
    'Repeti a pergunta. Depois de uma pausa, ele apontou com a bandeira para um ponto no nível em que eu estava. Ali encontrei um caminho áspero, em zigue-zague, cortado na pedra, e desci por ele.',
    'O corte era extremamente fundo e incomumente íngreme. Fora aberto numa rocha pegajosa, que ficava cada vez mais úmida conforme eu descia. De um lado e de outro, uma muralha de pedra deixava ver apenas uma faixa estreita de céu.',
    'Numa ponta, a linha se perdia na distância; na outra, terminava numa luz vermelha sombria e na boca ainda mais sombria de um túnel negro, de arquitetura pesada e bárbara. Tão pouca luz do sol chegava ali que o lugar tinha um cheiro de terra, de morte.',
    'Parte II — A cabine',
    'Ele me levou até a cabine. Havia ali uma lareira, uma mesa, um livro de registro, um instrumento telegráfico com seu mostrador e agulhas, e a pequena campainha de que ele falara. O fogo estalava baixinho.',
    'Contou-me que fora estudante de filosofia natural, mas desperdiçara as oportunidades. Agora passava os dias ali, no fundo do corte, aprendendo línguas sozinho e atento às campainhas. Durante a conversa, duas vezes a campainha tocou, e ele atendeu, olhando a agulha.',
    '— Senhor — disse ele por fim, em voz baixa —, estou perturbado. Tenho estado perturbado. Se o senhor voltar amanhã à noite, às onze, eu lhe conto. E, ao descer, não grite lá do alto.',
    'Parte III — A aparição',
    'Na noite seguinte, ele me contou. Uma noite, sentado ali, ouviu um grito: "Olá! Aí embaixo!". Ergueu os olhos e viu, junto à luz vermelha perto do túnel, uma figura com o braço sobre os olhos, acenando com o outro, violentamente.',
    '"Cuidado! Cuidado!" — gritava a figura. Ele pegou a lanterna, acendeu a luz vermelha e correu na direção dela. Mas, quando chegou perto, a figura desapareceu. Ele entrou no túnel, ouviu o eco dos próprios passos e as gotas escorrendo pelas paredes. Não havia ninguém.',
    'Seis horas depois, aconteceu um acidente terrível naquela linha. Os feridos e os mortos foram trazidos pelo túnel, passando exatamente pelo lugar onde a figura estivera.',
    'Um arrepio me percorreu. Tentei explicar com a razão: coincidências, os sentidos enganados pela solidão. Ele ouviu com paciência, e então pôs a mão no meu braço.\n— Ainda não terminei, senhor.',
    'Meses depois, a figura voltou. Desta vez não gritava: ficou junto à luz vermelha, com as mãos sobre o rosto, num gesto de luto. Naquele mesmo dia, um trem passou pelo túnel, e uma jovem morreu num dos vagões.',
    '— E agora, senhor — disse ele, tremendo —, há uma semana ela voltou. Fica lá, perto da luz, e às vezes faz soar a minha campainha. A campainha toca de um jeito estranho, que só eu ouço. Ela agita o braço e grita: "Cuidado! Cuidado!". Mas cuidado com quê? Onde? O que posso fazer?',
    'Enquanto falava, ele se virou de repente para a campainha. Eu olhei também. Ela estava muda. Ele me olhou com um medo que nunca esquecerei. Não ouvi nada, mas ele ouviu.',
    'Parte IV — O aviso',
    'Na tarde seguinte, desci o caminho em zigue-zague mais cedo do que combinara. Quando cheguei ao alto do corte, vi, junto à boca do túnel, a figura de um homem com o braço esquerdo sobre os olhos, acenando com o direito, violentamente.',
    'O terror inominável que me tomou passou num instante, pois logo vi que era um homem de verdade — e que perto dele havia outros homens. A luz vermelha ainda não estava acesa. Corri para baixo.',
    '— O que houve? — perguntei.\n— O sinaleiro morreu esta manhã, senhor. Foi atingido por uma locomotiva. Estava na linha, olhando para a luz, e não se afastou.',
    'O maquinista contou: — Eu o vi lá no fim do corte. Não havia tempo para frear. Apitei, e gritei para ele: "Olá! Aí embaixo! Cuidado! Cuidado!". E pus o braço sobre os olhos para não ver, e acenei com o outro até o último instante.',
    'Sem querer, ele repetira não só as palavras que o pobre sinaleiro me dissera que o perseguiam, mas também as que eu mesmo — e não ele — tinha acrescentado em pensamento ao gesto que ele imitava. O vento passava pelo corte, frio. E a boca negra do túnel continuava ali.',
  ],
  plans: [
    P('cold', CUTTING, [], cutLooks),
    P('cold', CUTTING, [], cutLooks),
    P('cold', CUTTING, [], cutLooks),
    P('tension', [['train', 0.42, 1], ['wind', 0.2, 3, 2500]], [whistle(1.5, 0.45)], { ...cutLooks, train: { place: 'outdoor', detail: 'steam train passing fast' } }),
    P('cold', CUTTING, [{ s: 'steps', surface: 'gravel', n: 8, pace: 0.7, at: 3, w: 0.35, v: { place: 'outdoor' } }], cutLooks),
    P('cold', [['wind', 0.3, 1, 2200], ['drone', 0.16, 3]], [{ s: 'drip', n: 3, at: 4, w: 0.25, v: { place: 'outdoor', material: 'stone' } }], cutLooks),
    P('tension', [['wind', 0.26, 1, 1800], ['drone', 0.2, 2]], [], cutLooks),
    P('warm', BOX, [], boxLooks),
    P('warm', BOX, [sigBell(4, 0.3)], boxLooks),
    P('warm', BOX, [sigBell(3), sigBell(9, 0.3)], boxLooks),
    P('tension', [['fire', 0.22, 1], ['wind', 0.18, 2, 900], ['drone', 0.14, 3]], [], boxLooks),
    P('night', [['night', 0.26, 1], ['fire', 0.18, 2], ['drone', 0.18, 3]], [], { ...boxLooks, night: { place: 'outdoor' } }),
    P('tension', [['night', 0.24, 1, 2500], ['drone', 0.22, 2], ['wind', 0.16, 3, 2000]], [], cutLooks),
    P('tension', [['drone', 0.24, 1], ['wind', 0.18, 2, 1500]], [{ s: 'steps', surface: 'gravel', n: 6, pace: 0.45, at: 2, w: 0.35, v: { place: 'cave', detail: 'echo in railway tunnel' } }, { s: 'drip', n: 4, at: 5.5, w: 0.3, v: { place: 'cave' } }], cutLooks),
    P('tension', [['drone', 0.28, 1], ['wind', 0.16, 3, 1500]], [], cutLooks),
    P('tension', BOX, [], boxLooks),
    P('tension', [['drone', 0.24, 1], ['wind', 0.18, 2, 1500]], [], cutLooks),
    P('tension', [['fire', 0.18, 1], ['drone', 0.26, 2]], [sigBell(5, 0.22)], boxLooks),
    P('tension', [['fire', 0.16, 1], ['drone', 0.3, 2], ['clock', 0.12, 3]], [], boxLooks),
    P('cold', CUTTING, [], cutLooks),
    P('tension', [['wind', 0.3, 1, 2800], ['drone', 0.24, 2]], [], cutLooks),
    P('tension', [['wind', 0.28, 1, 2800], ['crowd', 0.12, 3, 1200]], [{ s: 'steps', surface: 'gravel', n: 10, pace: 0.4, at: 3, w: 0.4, v: { place: 'outdoor' } }], cutLooks),
    P('night', [['wind', 0.26, 1, 2500], ['drone', 0.2, 2]], [], cutLooks),
    P('tension', [['wind', 0.24, 1, 2500], ['drone', 0.24, 2]], [whistle(3, 0.3)], cutLooks),
    P('cold', [['wind', 0.32, 1, 2200], ['drone', 0.18, 2]], [{ s: 'gust', at: 4, w: 0.3, v: { place: 'outdoor', distance: 'far' } }], cutLooks),
  ],
};

export const CLASSICS: SampleBook[] = [CORACAO, AMONTILLADO, SINALEIRO];
