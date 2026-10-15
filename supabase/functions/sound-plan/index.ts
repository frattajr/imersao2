/**
 * POST { title, pages: string[] (até 8), prev?: Ambience }
 * → { plans: ScenePlan[], cached: boolean }
 *
 * O resultado é guardado pelo hash do trecho: o segundo leitor do mesmo
 * livro recebe do cache, sem nova chamada à IA. É isso que mantém o custo
 * baixo quando o app cresce.
 */
import { askClaudeJson, ClaudeError, sha256 } from '../_shared/claude.ts';
import { cacheGet, cachePut, cors, json, requireUser, withinDailyLimit } from '../_shared/http.ts';

const PROMPT_VERSION = 'v3';
const MODEL = Deno.env.get('SOUND_MODEL') ?? 'claude-haiku-5-5';

const prompt = (book: string, items: string[], prev: unknown) => `Você é designer de som de audiolivros. Abaixo estão ${items.length} páginas consecutivas de "${book}". Para CADA página escolha (1) o ambiente sonoro contínuo que acompanha o cenário e (2) poucos sons pontuais REAIS e sutis de coisas que acontecem na cena. Pense no cenário completo (lugar, clima, hora, pessoas, criaturas, ações), não só em palavras soltas.
AMBIENTES (camadas contínuas; use SOMENTE estas): wind (vento), leaves (folhas ao vento), birds (pássaros, dia/amanhecer), rain (chuva), thunder (trovão distante, raro), sea (ondas), water (riacho, cachoeira), fire (lareira/fogueira), cafe (café ou restaurante com conversas e louças), crowd (vozes de multidão ao longe), city (cidade, trânsito distante), train (trem, trilhos), night (silêncio noturno), cricket (SOMENTE se o texto citar grilos ou cigarras), clock (relógio, interiores calmos).
SONS PONTUAIS (use SOMENTE estes, só quando a ação ocorre ou é muito provável na cena): steps (passos; "surface": wood|gravel|stone|grass|snow|metal; "n": 1-12 passos; "pace": 0.4-0.9 s entre passos), door ("kind": creak|close), knock (batidas; "n" 2-4), doorbell (sininho de porta de loja/café), keys (chaves), roar (rugido distante de criatura, dragão, fera), howl (uivo de lobo), bark (latido distante; "n"), owl (coruja), bell (sino de igreja; "n" badaladas), horn ("kind": foghorn|whistle, para navio ou trem), hooves (cavalo; "n" 6-12), creak (rangido de madeira, navio, escada), drip (gotas em caverna; "n"), gust (rajada de vento), rustle (tecido, papel, folhas de perto), purr (gato ronronando), musicbox (caixa de música).
Cada som pontual: {"s":nome,"at":segundos após a página abrir (1 a 9, sincronize com o momento da leitura),"w":intensidade 0.2-0.8,"rep":repetições 1-3 (opcional),"gap":segundos entre repetições (opcional)} mais os parâmetros acima.
Regras: no máximo 3 ambientes por página, nível 0.2-1 (normal 0.3-0.6, bem sutil). No máximo 2 sons pontuais por página, e nenhum se a página não tiver ação sonora. Se a cena continua no mesmo lugar, repita os mesmos ambientes da página anterior com níveis parecidos, para o som fluir sem trocas bruscas; mude só quando cenário ou clima mudarem. Páginas sem local definido repetem o ambiente anterior. Ambiente da página anterior ao primeiro item: ${JSON.stringify(prev ?? {})}.
"mood" = clima visual: rain|sea|fire|forest|night|city|tension|warm|cold|calm.
Responda SOMENTE com JSON: {"pages":[{"mood":"calm","ambience":{"cafe":0.5},"spots":[{"s":"doorbell","at":1.5,"w":0.5}]}]} com exatamente ${items.length} itens, na ordem.
${items.map((t, i) => `${i + 1}) ${t}`).join('\n')}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'método não permitido' }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: 'não autenticado' }, 401);

  let body: { title?: unknown; pages?: unknown; prev?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const title = String(body.title ?? '').slice(0, 200);
  const pages = Array.isArray(body.pages) ? body.pages.slice(0, 8).map((p) => String(p).slice(0, 2000)) : [];
  if (!pages.length) return json({ error: 'sem páginas' }, 400);

  // a chave não inclui "prev": o mesmo trecho dá o mesmo resultado para todos os leitores
  const key = 'sound:' + PROMPT_VERSION + ':' + (await sha256(JSON.stringify(pages)));
  const hit = await cacheGet<{ plans: unknown[] }>(key);
  if (hit) return json({ plans: hit.plans, cached: true });

  if (!(await withinDailyLimit(user.id))) return json({ error: 'limite diário atingido' }, 429);

  try {
    const r = await askClaudeJson<{ pages?: unknown[] }>(prompt(title, pages, body.prev), { model: MODEL, maxTokens: 2500 });
    const plans = Array.isArray(r.pages) ? r.pages.slice(0, pages.length) : [];
    if (plans.length) await cachePut(key, 'sound', { plans }, MODEL);
    return json({ plans, cached: false });
  } catch (e) {
    const status = e instanceof ClaudeError && e.status === 429 ? 429 : 502;
    console.error('sound-plan', e);
    return json({ error: 'falha na IA' }, status);
  }
});
