/**
 * POST { title, text (trecho lido até agora), known: string[] }
 * → { entries: { term, desc }[] }
 */
import { askClaudeJson, ClaudeError, sha256 } from '../_shared/claude.ts';
import { cacheGet, cachePut, cors, json, requireUser, withinDailyLimit } from '../_shared/http.ts';

const PROMPT_VERSION = 'v1';
const MODEL = Deno.env.get('GLOSSARY_MODEL') ?? 'claude-sonnet-5-5';

const prompt = (book: string, text: string, known: string[]) => `Você monta glossários para quem lê livros longos. Abaixo está o trecho de "${book}" lido até agora. Liste até 12 entradas úteis para lembrar durante a leitura: personagens (com o papel ou a relação), lugares, objetos importantes, termos próprios ou estrangeiros e conceitos. Use SOMENTE o que está no trecho: sem spoilers do que ainda não foi lido e sem conhecimento externo. "term" curto, como aparece no texto; "desc" com no máximo 120 caracteres, em português. Não repita estes termos já existentes: ${known.length ? known.join(', ') : '(nenhum)'}.
Responda SOMENTE com JSON: {"entries":[{"term":"","desc":""}]}

TRECHO:
${text}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'método não permitido' }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: 'não autenticado' }, 401);

  let body: { title?: unknown; text?: unknown; known?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const title = String(body.title ?? '').slice(0, 200);
  const text = String(body.text ?? '').slice(-16000);
  const known = Array.isArray(body.known) ? body.known.slice(0, 300).map((k) => String(k).slice(0, 60)) : [];
  if (text.length < 40) return json({ entries: [] });

  const key = 'gloss:' + PROMPT_VERSION + ':' + (await sha256(JSON.stringify([title, text, known])));
  const hit = await cacheGet<{ entries: unknown[] }>(key);
  if (hit) return json({ entries: hit.entries, cached: true });

  if (!(await withinDailyLimit(user.id))) return json({ error: 'limite diário atingido' }, 429);

  try {
    const r = await askClaudeJson<{ entries?: { term?: unknown; desc?: unknown }[] }>(prompt(title, text, known), { model: MODEL, maxTokens: 1500 });
    const entries = (Array.isArray(r.entries) ? r.entries : [])
      .filter((e) => e && typeof e.term === 'string' && e.term.trim())
      .slice(0, 12)
      .map((e) => ({ term: String(e.term).trim().slice(0, 60), desc: String(e.desc ?? '').trim().slice(0, 200) }));
    await cachePut(key, 'gloss', { entries }, MODEL);
    return json({ entries, cached: false });
  } catch (e) {
    const status = e instanceof ClaudeError && e.status === 429 ? 429 : 502;
    console.error('glossary', e);
    return json({ error: 'falha na IA' }, status);
  }
});
