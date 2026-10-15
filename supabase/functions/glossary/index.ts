/**
 * POST { title, text (trecho lido até agora), known: string[], focus?: string, cacheOnly?: boolean }
 * → { entries: { term, desc }[] }
 *
 * - sem `focus`: monta até 12 entradas do glossário com o que já foi lido;
 * - com `focus`: explica só aquele termo (X-Ray, ao tocar no nome no texto).
 * Sempre sem spoiler: a IA só vê o trecho já lido. O resultado fica no cache
 * global (mesmo trecho = mesma resposta para todos os leitores); livros
 * públicos mandam `cacheOnly` e nunca disparam a IA.
 */
import { askClaudeJson, ClaudeError, sha256 } from '../_shared/claude.ts';
import { bookKeyOf, cacheGet, cachePut, cors, isPrecompute, json, requireUser, withinDailyLimit } from '../_shared/http.ts';

const PROMPT_VERSION = 'v1';
const MODEL = Deno.env.get('GLOSSARY_MODEL') ?? 'claude-sonnet-5-5';

const prompt = (book: string, text: string, known: string[]) => `Você monta glossários para quem lê livros longos. Abaixo está o trecho de "${book}" lido até agora. Liste até 12 entradas úteis para lembrar durante a leitura: personagens (com o papel ou a relação), lugares, objetos importantes, termos próprios ou estrangeiros e conceitos. Use SOMENTE o que está no trecho: sem spoilers do que ainda não foi lido e sem conhecimento externo. "term" curto, como aparece no texto; "desc" com no máximo 120 caracteres, em português. Não repita estes termos já existentes: ${known.length ? known.join(', ') : '(nenhum)'}.
Responda SOMENTE com JSON: {"entries":[{"term":"","desc":""}]}

TRECHO:
${text}`;

const focusPrompt = (book: string, text: string, term: string) => `Você explica personagens e termos para quem está lendo "${book}". Abaixo está TODO o trecho lido até agora. Explique "${term}" em até 2 frases curtas (máximo 220 caracteres), em português: quem é ou o que é, e o papel na história ATÉ AQUI. Use SOMENTE o trecho: nada do que ainda não foi lido (sem spoilers) e nada de conhecimento externo sobre o livro. Se for um termo de época ou estrangeiro, diga o significado.
Responda SOMENTE com JSON: {"entries":[{"term":"${term.replace(/"/g, '')}","desc":""}]}

TRECHO:
${text}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'método não permitido' }, 405);

  // pré-cálculo de livros públicos (segredo no cabeçalho) não precisa de leitor logado
  const user = await requireUser(req);
  if (!user && !isPrecompute(req)) return json({ error: 'não autenticado' }, 401);

  let body: { title?: unknown; text?: unknown; known?: unknown; focus?: unknown; cacheOnly?: unknown; bookKey?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const title = String(body.title ?? '').slice(0, 200);
  const text = String(body.text ?? '').slice(-16000);
  const known = Array.isArray(body.known) ? body.known.slice(0, 300).map((k) => String(k).slice(0, 60)) : [];
  const focus = typeof body.focus === 'string' ? body.focus.trim().slice(0, 60) : '';
  if (text.length < 40) return json({ entries: [] });

  const key = (focus ? 'xray:' : 'gloss:') + PROMPT_VERSION + ':' + (await sha256(JSON.stringify(focus ? [title, text, focus] : [title, text, known])));
  const hit = await cacheGet<{ entries: unknown[] }>(key);
  if (hit) return json({ entries: hit.entries, cached: true });

  const precompute = isPrecompute(req);
  if (body.cacheOnly === true && !precompute) return json({ entries: [], cached: false, skipped: true });
  if (!precompute && !(await withinDailyLimit(user!.id))) return json({ error: 'limite diário atingido' }, 429);

  try {
    const r = await askClaudeJson<{ entries?: { term?: unknown; desc?: unknown }[] }>(
      focus ? focusPrompt(title, text, focus) : prompt(title, text, known), { model: MODEL, maxTokens: focus ? 400 : 1500 });
    const entries = (Array.isArray(r.entries) ? r.entries : [])
      .filter((e) => e && typeof e.term === 'string' && e.term.trim())
      .slice(0, 12)
      .map((e) => ({ term: String(e.term).trim().slice(0, 60), desc: String(e.desc ?? '').trim().slice(0, 200) }));
    await cachePut(key, 'gloss', { entries }, MODEL, bookKeyOf(body));
    return json({ entries, cached: false });
  } catch (e) {
    const status = e instanceof ClaudeError && e.status === 429 ? 429 : 502;
    console.error('glossary', e);
    return json({ error: 'falha na IA' }, status);
  }
});
