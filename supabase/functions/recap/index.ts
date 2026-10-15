/**
 * POST { title, text (páginas logo antes do ponto de parada), cacheOnly? }
 * → { summary: string }
 *
 * "O que aconteceu até aqui?": quando a pessoa volta a um livro depois de
 * mais de 48 h, um micro-resumo de 2 frases dos acontecimentos imediatamente
 * anteriores ao ponto de parada. Sem spoiler (a IA só vê o que já foi lido).
 * Cache global por trecho; livros públicos mandam `cacheOnly`.
 */
import { askClaudeJson, ClaudeError, sha256 } from '../_shared/claude.ts';
import { cacheGet, cachePut, cors, isPrecompute, json, requireUser, withinDailyLimit } from '../_shared/http.ts';

const PROMPT_VERSION = 'v1';
const MODEL = Deno.env.get('RECAP_MODEL') ?? Deno.env.get('SOUND_MODEL') ?? 'claude-haiku-5-5';

const prompt = (book: string, text: string) => `Uma pessoa está voltando a ler "${book}" depois de alguns dias. Abaixo estão as páginas que ela leu por último, terminando exatamente onde parou. Escreva um lembrete de EXATAMENTE 2 frases curtas (máximo 260 caracteres no total), em português, sobre o que acabou de acontecer — quem estava em cena, onde, e a última situação. Use SOMENTE o trecho (nada do que vem depois, nada de conhecimento externo). Tom neutro, no passado.
Responda SOMENTE com JSON: {"summary":""}

TRECHO:
${text}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'método não permitido' }, 405);
  const user = await requireUser(req);
  if (!user) return json({ error: 'não autenticado' }, 401);

  let body: { title?: unknown; text?: unknown; cacheOnly?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const title = String(body.title ?? '').slice(0, 200);
  const text = String(body.text ?? '').slice(-6000);
  if (text.length < 80) return json({ summary: '' });

  const key = 'recap:' + PROMPT_VERSION + ':' + (await sha256(JSON.stringify([title, text])));
  const hit = await cacheGet<{ summary: string }>(key);
  if (hit) return json({ summary: hit.summary, cached: true });

  const precompute = isPrecompute(req);
  if (body.cacheOnly === true && !precompute) return json({ summary: '', skipped: true });
  if (!precompute && !(await withinDailyLimit(user.id))) return json({ error: 'limite diário atingido' }, 429);

  try {
    const r = await askClaudeJson<{ summary?: unknown }>(prompt(title, text), { model: MODEL, maxTokens: 300 });
    const summary = String(r.summary ?? '').replace(/\s+/g, ' ').trim().slice(0, 400);
    if (summary) await cachePut(key, 'recap', { summary }, MODEL);
    return json({ summary, cached: false });
  } catch (e) {
    const status = e instanceof ClaudeError && e.status === 429 ? 429 : 502;
    console.error('recap', e);
    return json({ error: 'falha na IA' }, status);
  }
});
