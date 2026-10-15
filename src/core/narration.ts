/**
 * O que o narrador descreve AGORA, no lugar onde a cena acontece — a parte do
 * texto que pode mudar o som. Tira:
 *
 * - falas ("— Vem cá — disse ele, abrindo a porta." → só "disse ele,
 *   abrindo a porta."; trechos entre aspas);
 * - lembranças, sonhos, hipóteses, comparações e negações ("lembrou do mar",
 *   "como um lobo", "se houvesse chuva", "não se ouvia nada");
 * - metáforas comuns ("mar de gente", "onda de ciúme", "fogo da paixão",
 *   "fonte de renda", "olhos escuros");
 * - nomes próprios que parecem lugar ("Rio de Janeiro" é cidade, não rio).
 *
 * Devolve o texto normalizado (minúsculas, sem acento), pronto para as regras.
 */
import { norm, plain } from './text';

/** Frases que não descrevem a cena presente. */
export const NOT_HERE = /\bcomo (um|uma|se)\b|\bfeito (um|uma)\b|parec|lembr|record|sonh|imagin|\bse (fosse|houvesse|tivesse)|\bnunca\b|\bnenhum|\bnao (se )?(ouvi|escut|havia|houve|via|sentia)|\bquando (era|eu era) (crianca|menino|menina|moco)|\boutrora\b|\bem outros tempos\b/;

/** Metáforas e expressões em que a palavra não é o som. */
const FIGURES = new RegExp([
  '\\bmar(es)? de (gente|lagrimas|duvidas|rosas|sangue|coisas|tristeza|problemas|luz|flores)',
  '\\bondas? de (ciume|calor|frio|raiva|alegria|tristeza|medo|emocao|gente|amor|saudade|indignacao|entusiasmo|pessoas)',
  '\\bfogo d[aeo]s? (paixao|olhos|juventude|ciume|amor|desejo|olhar|alma|colera)',
  '\\b(ardia|ardiam|queimava|queimavam) de (paixao|febre|ciume|vergonha|desejo|raiva)',
  '\\bfontes? de (renda|vida|inspiracao|prazer|riqueza|informacao|felicidade|alegria|dinheiro|consolo|luz)',
  '\\btempestades? (de|no|na|da) (emocoes|coracao|ideias|alma|cranio|cabeca|sentimentos|paixoes)',
  '\\bchuvas? de (balas|flores|pedras|elogios|perguntas|beijos|insultos|moedas)',
  '\\bnoites? (da|de) (ignorancia|alma|nupcias)',
  '\\b(olhos|cabelos?|vestidos?|roupas?|pele|barba|bigode|sobrancelhas?) (escur|negr|pret)\\w*',
  '\\bem chamas de\\b',
  '\\brio de (lagrimas|sangue|palavras|dinheiro|ouro)',
  '\\bvento(s)? (de|da) (mudanca|sorte|revolucao|loucura)',
  '\\bfolhas? de (papel|rosto|servico|pagamento|jornal|livro)',
  '\\bfolha (de|do|da) (caderno|livro|jornal|processo)',
].join('|'), 'g');

/** Nomes próprios com cara de lugar ou de natureza. */
const PROPER = /\b(Rio|Mar|Fonte|Lago|Lagoa|Monte|Serra|Ponte|Campo|Floresta|Praia|Ilha|Estrela|Lua|Noite)(\s+(de|do|da|dos|das)\s+[A-ZÀ-Ú][\p{L}-]+|\s+[A-ZÀ-Ú][\p{L}-]+)+/gu;

/**
 * Trechos narrados de uma linha de diálogo: "— fala — narração — fala".
 * Os pedaços pares (depois do primeiro travessão) são narração.
 */
function narratorBits(line: string): string {
  const parts = line.split(/\s*[—–]\s*/);
  // linha começa com travessão: [ '', fala, narração, fala, narração… ]
  return parts.filter((_, i) => i >= 2 && i % 2 === 0).join(' ');
}

/** Texto narrado no presente da cena, normalizado. */
export function narration(text: string): string {
  const lines = plain(text).split('\n').map((l) => {
    const t = l.trim();
    return /^[—–]/.test(t) || /^-\s/.test(t) ? narratorBits(t.replace(/^-\s/, '— ')) : t;
  });
  const prose = lines.join(' ')
    // falas entre aspas
    .replace(/“[^”]*”|"[^"]*"|«[^»]*»/g, ' ')
    // "Rio de Janeiro", "Serra da Mantiqueira": nome, não paisagem (a cidade conta como cidade)
    .replace(/\bRio de Janeiro\b/g, ' cidade ')
    .replace(PROPER, ' ');
  const sentences = norm(prose).split(/(?<=[.!?…;])\s+/).filter((s) => s && !NOT_HERE.test(s));
  return sentences.join(' ').replace(FIGURES, ' ').replace(/\s+/g, ' ').trim();
}

/** Há fala (diálogo) neste trecho? */
export const hasDialogue = (text: string) => /(^|\n)\s*[—–]/.test(text) || /[“"«]/.test(text);
