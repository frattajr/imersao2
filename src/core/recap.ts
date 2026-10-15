/**
 * Recapitulação "O que aconteceu até aqui?": aparece quando a pessoa volta
 * a um livro depois de mais de 48 h. A versão por IA (função `recap`) resume
 * as páginas anteriores ao ponto de parada; esta é a reserva sem internet:
 * escolhe as 2 frases mais "carregadas de acontecimento" das últimas páginas.
 */
import { properNouns } from './chapters';
import { norm } from './text';

export const RECAP_AFTER_MS = 48 * 3600_000;

export const needsRecap = (lastSession: number | null, now: number, idx: number) =>
  !!lastSession && idx >= 2 && now - lastSession > RECAP_AFTER_MS;

/** Trecho imediatamente anterior ao ponto de parada (o que a IA resume). */
export function recapWindow(pages: string[], idx: number, maxChars = 6000): string {
  let txt = '';
  for (let p = Math.min(idx, pages.length - 1); p >= 0 && txt.length < maxChars; p--) txt = pages[p] + '\n' + txt;
  return txt.slice(-maxChars).trim();
}

const ACTION = /\b(chegou|saiu|abriu|fechou|viu|encontrou|morreu|matou|fugiu|gritou|disse|descobriu|entrou|correu|caiu|partiu|voltou|decidiu|ouviu|perdeu|ganhou|beijou|atacou|acordou|percebeu)\b/;

/** Duas frases das últimas páginas, na ordem em que aparecem. */
export function recapLocal(pages: string[], idx: number): string {
  const text = recapWindow(pages, idx, 2500);
  const names = new Set(properNouns(text, 12).map(norm));
  const sents = text.split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 30 && s.length < 320 && !/^[—–-]/.test(s));
  if (!sents.length) return '';
  const scored = sents.map((s, i) => {
    const n = norm(s);
    let score = 0;
    names.forEach((nm) => { if (n.includes(nm)) score += 2; });
    if (ACTION.test(n)) score += 2;
    score += i / sents.length; // mais perto do ponto de parada vale um pouco mais
    return { s, i, score };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, 2).sort((a, b) => a.i - b.i).map((x) => x.s).join(' ');
}
