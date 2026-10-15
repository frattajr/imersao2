/**
 * Atualiza a grafia antiga do português (anterior às reformas de 1911/1943)
 * para a grafia atual do Brasil: "ella" → "ela", "pharmacia" → "farmacia",
 * "theatro" → "teatro", "hontem" → "ontem", "n'um" → "num", "á noite" →
 * "à noite", "portuguez" → "português".
 *
 * É conservador de propósito: só mexe em padrões que não existem na grafia
 * atual (ph, th, rh, y, consoantes dobradas que hoje são simples) e numa
 * lista de palavras comuns. Acentos que faltam só são postos nas palavras da
 * lista. Se o texto não parece ter grafia antiga, não muda nada.
 */

/** Palavras inteiras (minúsculas, sem o caso): grafia antiga → atual. */
const WORD_LIST: Record<string, string> = {
  he: 'é', hontem: 'ontem', sahir: 'sair', sahiu: 'saiu', sahia: 'saía', sahi: 'saí', sahida: 'saída',
  cahir: 'cair', cahiu: 'caiu', cahia: 'caía', cahido: 'caído', cahida: 'caída', ahi: 'aí', dahi: 'daí', bahu: 'baú',
  comprehender: 'compreender', comprehendia: 'compreendia', comprehendeu: 'compreendeu', comprehensão: 'compreensão',
  prohibir: 'proibir', prohibido: 'proibido', prohibida: 'proibida', vehemente: 'veemente', vehemencia: 'veemência',
  sómente: 'somente', tambem: 'também', alguem: 'alguém', ninguem: 'ninguém', porem: 'porém', armazem: 'armazém',
  alem: 'além', parabens: 'parabéns', vintem: 'vintém', mãi: 'mãe', mãis: 'mães', pae: 'pai',
  dôr: 'dor', côr: 'cor', flôr: 'flor', amôr: 'amor', sêr: 'ser', dôce: 'doce', êlle: 'ele',
  logar: 'lugar', logares: 'lugares', egual: 'igual', eguaes: 'iguais', egualmente: 'igualmente', egreja: 'igreja',
  assucar: 'açúcar', mez: 'mês', mezes: 'meses', atravez: 'através', atravéz: 'através', emfim: 'enfim', emquanto: 'enquanto',
  portuguez: 'português', portugueza: 'portuguesa', portuguezes: 'portugueses', inglez: 'inglês', ingleza: 'inglesa', inglezes: 'ingleses',
  francez: 'francês', franceza: 'francesa', francezes: 'franceses', hollandez: 'holandês', escocez: 'escocês', japonez: 'japonês',
  chinez: 'chinês', burguez: 'burguês', burgueza: 'burguesa', cortez: 'cortês', freguez: 'freguês', freguezes: 'fregueses',
  marquez: 'marquês', marqueza: 'marquesa', camponez: 'camponês', camponeza: 'camponesa', montanhez: 'montanhês',
  thomaz: 'tomás', luiz: 'luís', thereza: 'teresa', izabel: 'isabel',
  sciencia: 'ciência', sciencias: 'ciências', scena: 'cena', scenas: 'cenas', sceptro: 'cetro', scepticismo: 'ceticismo',
  christo: 'cristo', christão: 'cristão', christã: 'cristã', christãos: 'cristãos', christianismo: 'cristianismo',
  chronica: 'crônica', chronicas: 'crônicas', chimica: 'química', chimico: 'químico', chaos: 'caos', echo: 'eco', echos: 'ecos',
  character: 'caráter', caracter: 'caráter', characteres: 'caracteres', orchestra: 'orquestra', architectura: 'arquitetura',
  architecto: 'arquiteto', machina: 'máquina', machinas: 'máquinas', monarchia: 'monarquia', anarchia: 'anarquia', patriarcha: 'patriarca',
  escripto: 'escrito', escripta: 'escrita', escriptos: 'escritos', escriptor: 'escritor', escriptores: 'escritores', escriptorio: 'escritório',
  prompto: 'pronto', prompta: 'pronta', promptamente: 'prontamente', assumpto: 'assunto', assumptos: 'assuntos', baptismo: 'batismo',
  baptizar: 'batizar', egypto: 'egito', septembro: 'setembro', redempção: 'redenção', excepção: 'exceção', excepto: 'exceto',
  acto: 'ato', actos: 'atos', actor: 'ator', actores: 'atores', actriz: 'atriz', director: 'diretor', directora: 'diretora', directores: 'diretores',
  objecto: 'objeto', objectos: 'objetos', projecto: 'projeto', projectos: 'projetos', fructo: 'fruto', fructos: 'frutos', auctor: 'autor',
  dictar: 'ditar', dictado: 'ditado', affecto: 'afeto', affectos: 'afetos', exacto: 'exato', exacta: 'exata', exactamente: 'exatamente',
  tracto: 'trato', contracto: 'contrato', inspector: 'inspetor', sector: 'setor', reflectir: 'refletir', reflectia: 'refletia',
  effectivo: 'efetivo', effectivamente: 'efetivamente', victoria: 'vitória', victorioso: 'vitorioso', sancto: 'santo',
  acção: 'ação', acções: 'ações', direcção: 'direção', correcção: 'correção', protecção: 'proteção', collecção: 'coleção', lecção: 'lição',
  selecção: 'seleção', reacção: 'reação', redacção: 'redação', objecção: 'objeção', distincção: 'distinção',
  satisfacção: 'satisfação', affeição: 'afeição', affeiçoado: 'afeiçoado', attracção: 'atração', abstracção: 'abstração',
  hymno: 'hino', hymnos: 'hinos', solemne: 'solene', solemnes: 'solenes', solemnidade: 'solenidade', damno: 'dano', damnado: 'danado',
  somno: 'sono', columna: 'coluna', columnas: 'colunas', alumno: 'aluno', alumnos: 'alunos', outomno: 'outono', condemnar: 'condenar',
  condemnado: 'condenado', assignar: 'assinar', assignado: 'assinado', signal: 'sinal', signaes: 'sinais', physica: 'física', physico: 'físico', physionomia: 'fisionomia', philosophia: 'filosofia', philosopho: 'filósofo', pharmacia: 'farmácia',
  photographia: 'fotografia', telegrapho: 'telégrafo', theatro: 'teatro', thesouro: 'tesouro', theoria: 'teoria', methodo: 'método',
  lyrio: 'lírio', lyrios: 'lírios', lyra: 'lira', martyr: 'mártir', martyrio: 'martírio', mysterio: 'mistério', mysterios: 'mistérios',
  mysterioso: 'misterioso', mysteriosa: 'misteriosa', abysmo: 'abismo', abysmos: 'abismos', estylo: 'estilo', systema: 'sistema',
  typo: 'tipo', sympathia: 'simpatia', sympathico: 'simpático', sympathica: 'simpática', nympha: 'ninfa', rhythmo: 'ritmo',
  historia: 'história', historias: 'histórias', musica: 'música', musicas: 'músicas', comedia: 'comédia', tragedia: 'tragédia',
  tragedias: 'tragédias', theorias: 'teorias', geographia: 'geografia', orthographia: 'ortografia', idéa: 'ideia', idéas: 'ideias',
  idea: 'ideia', ideas: 'ideias', commum: 'comum', communs: 'comuns', aquella: 'aquela', aquelle: 'aquele', aquellas: 'aquelas',
  aquelles: 'aqueles', ella: 'ela', ellas: 'elas', elle: 'ele', elles: 'eles', cousa: 'coisa', cousas: 'coisas',
  dous: 'dois', douda: 'doida', doudo: 'doido', loiro: 'louro', oiro: 'ouro', bello: 'belo', bella: 'bela', bellos: 'belos',
  bellas: 'belas', bellezas: 'belezas', belleza: 'beleza', quasi: 'quase', paiz: 'país', paizes: 'países',
  sahirá: 'sairá', cahirá: 'cairá', lagrima: 'lágrima', lagrimas: 'lágrimas', camara: 'câmara', lampada: 'lâmpada',
  unico: 'único', unica: 'única', pallido: 'pálido', pallida: 'pálida', tremulo: 'trêmulo',
  silencio: 'silêncio', vespera: 'véspera', sabado: 'sábado', medico: 'médico', medicos: 'médicos', espirito: 'espírito', espiritos: 'espíritos', proprio: 'próprio',
  propria: 'própria', proprios: 'próprios', ultimo: 'último', ultima: 'última', ultimos: 'últimos', ultimas: 'últimas',
  póde: 'pode', capitulo: 'capítulo', capitulos: 'capítulos', titulo: 'título', titulos: 'títulos', pagina: 'página', paginas: 'páginas',
  numero: 'número', numeros: 'números', agua: 'água', aguas: 'águas', comodo: 'cômodo', fôra: 'fora', côrte: 'corte',
  êste: 'este', êsse: 'esse', êstes: 'estes', êsses: 'esses', aquêle: 'aquele', aquêles: 'aqueles', êle: 'ele', êles: 'eles', sôbre: 'sobre',
  rapido: 'rápido', rapida: 'rápida', subito: 'súbito', 
};

/** Map (e não objeto): "constructor", "toString" etc. não podem casar com propriedades herdadas. */
const WORDS = new Map(Object.entries(WORD_LIST));

/** contrações com apóstrofo: "d'elle" → "dele", "n'um" → "num" */
const CONTRACT = /\b([dDnN])['’](este|esta|estes|estas|isto|esse|essa|esses|essas|isso|aquele|aquela|aqueles|aquelas|aquilo|elle|ella|elles|ellas|ele|ela|eles|elas|aqui|ali|alli|ahi|aí|um|uma|uns|umas|outro|outra|outros|outras|onde|aquelle|aquella|aquelles|aquellas)\b/g;

/** Palavras que só existem na grafia antiga (nomes como "Arthur" não contam). */
const ARCHAIC_SIGNS = /\b(?:elle|ella|elles|ellas|aquelle|aquella|hontem|he|sahir|cahir|ahi|logar|egual|emfim|emquanto|quasi|alli|tambem|egreja|theatro|pharmacia|sahiu|comprehend[a-zãõç]*)\b|(?<![A-Za-zÀ-ÿ])(?:sôbre|êle|êles|êste|êsse|aquêle)(?![A-Za-zÀ-ÿ])|\b[dn]['’](?:elle|ella|um|uma|este|esta|isso|aqui)\b/gi;

/** Proporção mínima de sinais antigos por palavra para mexer no texto. */
const MIN_RATIO = 0.002;

/** O texto parece escrito na grafia antiga? */
export function looksArchaic(text: string): boolean {
  const sample = text.length > 200_000 ? text.slice(0, 200_000) : text;
  const words = sample.match(/\p{L}+/gu)?.length ?? 0;
  if (words < 30) return (sample.match(ARCHAIC_SIGNS)?.length ?? 0) >= 2;
  return (sample.match(ARCHAIC_SIGNS)?.length ?? 0) / words >= MIN_RATIO;
}

/** Nomes que mantêm a grafia histórica. */
const KEEP = new Set(['constructor', 'bahia', 'thomas', 'sophia', 'philadelphia', 'smith', 'arthur', 'goethe', 'york', 'byron']);

/** Regras de letras dentro da palavra (já em minúsculas). */
function letters(w: string): string {
  let s = w
    .replace(/ph/g, 'f')
    .replace(/th/g, 't')
    .replace(/rh/g, 'r')
    // y entre letras vira i ("systema", "lyrio"); "y" sozinho fica
    .replace(/(?<=\p{L})y|y(?=\p{L})/gu, 'i')
    // consoantes dobradas que hoje são simples (rr e ss continuam)
    .replace(/([bdfglmnpt])\1/g, (m, c: string) => (w === 'connosco' && c === 'n' ? m : c))
    .replace(/cc(?=[aou])/g, 'c');
  // h mudo entre vogais ("comprehender", "sahir") — exceto ch, lh, nh
  s = s.replace(/(?<=[aeiouáéíóú])h(?=[aeiouáéíóú])/g, '');
  return s;
}

const applyCase = (src: string, out: string): string => {
  if (src === src.toLowerCase()) return out;
  if (src === src.toUpperCase() && src.length > 1) return out.toUpperCase();
  return out.charAt(0).toUpperCase() + out.slice(1);
};

/** Uma palavra na grafia atual. */
export function modernizeWord(word: string): string {
  // "camelCase" ou sigla mista: não é palavra portuguesa
  if (/\p{Ll}\p{Lu}/u.test(word)) return word;
  const low = word.toLowerCase();
  if (KEEP.has(low)) return word;
  const direct = WORDS.get(low);
  if (direct) return applyCase(word, direct);
  const changed = letters(low);
  if (changed === low) return word;
  return applyCase(word, WORDS.get(changed) ?? changed);
}

/**
 * Texto inteiro na grafia atual. `force` aplica mesmo que o texto não
 * pareça antigo (útil para trechos curtos e testes).
 */
export function modernize(text: string, force = false): string {
  if (!force && !looksArchaic(text)) return text;
  return text
    .replace(CONTRACT, (_m, p: string, w: string) => p + modernizeWord(w).toLowerCase())
    // crase antiga: "á noite", "ás vezes"
    .replace(/(^|[\s(“"«—-])([áÁ])(s?)(?=\s)/g, (_m, pre: string, a: string, s: string) => `${pre}${a === 'Á' ? 'À' : 'à'}${s}`)
    .replace(/\p{L}+/gu, (w) => modernizeWord(w));
}
