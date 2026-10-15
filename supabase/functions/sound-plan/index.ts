/**
 * POST { title, pages: string[] (até 8), prev?: Ambience }
 * → { plans: ScenePlan[], cached: boolean }
 *
 * O resultado é guardado pelo hash do trecho: o segundo leitor do mesmo
 * livro recebe do cache, sem nova chamada à IA. É isso que mantém o custo
 * baixo quando o app cresce.
 */
import { askClaudeJson, ClaudeError, sha256 } from '../_shared/claude.ts';
import { cacheGet, cachePut, cors, isPrecompute, json, requireUser, withinDailyLimit } from '../_shared/http.ts';

const PROMPT_VERSION = 'v5';
const MODEL = Deno.env.get('SOUND_MODEL') ?? 'claude-haiku-5-5';

const prompt = (book: string, items: string[], prev: unknown) => `Você é a mixadora de som de um app de leitura imersiva. Abaixo estão ${items.length} páginas consecutivas de "${book}". Você NÃO gera áudio: para CADA página você devolve uma MATRIZ DE MIXAGEM declarativa dos stems (loops contínuos já existentes) e poucos sons pontuais. Pense no cenário completo (lugar, clima, hora, pessoas, criaturas, ações, emoção), não em palavras soltas.
STEMS (loops contínuos; use SOMENTE estes): wind (vento), leaves (folhas ao vento), birds (pássaros, dia), rain (chuva), thunder (trovão distante, raro), sea (ondas), water (riacho), fire (lareira/fogueira), cafe (café com conversas e louças), crowd (vozes ao longe), city (trânsito distante), train (trem), night (silêncio noturno), cricket (SÓ se o texto citar grilos), clock (relógio), tavern (taberna: murmúrio, canecas, lareira), drone (drone grave e sutil de tensão — medo, suspense, horror; nunca em cenas leves).
Cada stem na matriz: {"s":nome,"gain":0.15-0.8 (normal 0.3-0.5),"lowpass":Hz opcional,"priority":1|2|3}.
- "lowpass" abafa o som: 600-1200 = do outro lado da parede/porta fechada ou muito longe; 1500-3000 = abafado/distante; sem lowpass = presente e nítido.
- "priority": 1 = essencial à cena (só 1 ou 2), 2 = apoio, 3 = textura (sai primeiro se faltar espaço).
- Máximo 4 stems por página (normal 2-3). O "drone" vai baixo (0.15-0.3) e só em tensão real.
SONS PONTUAIS (use SOMENTE estes, só quando a ação ocorre na cena): steps ("surface": wood|gravel|stone|grass|snow|metal; "n": 1-12; "pace": 0.4-0.9), door ("kind": creak|close), knock ("n" 2-4), doorbell, keys, roar, howl, bark ("n"), owl, bell ("n" badaladas), horn ("kind": foghorn|whistle), hooves ("n" 6-12), creak, drip ("n"), gust, rustle, purr, musicbox, heartbeat (coração batendo; "n" 4-12), chains (correntes).
Cada som pontual: {"s":nome,"at":segundos após a página abrir (1 a 9),"w":intensidade 0.2-0.8,"rep":1-3 (opcional),"gap":segundos (opcional)} mais os parâmetros acima.
COMO SOA (use sempre que o texto indicar): "looks":{"rain":{...}} para os stems e "v":{...} em cada som pontual. Campos (SOMENTE estes valores): "material": wood|gravel|stone|grass|snow|metal|water|glass|fabric|paper|leaves|mud|sand|tile; "place": indoor|outdoor|cave|hall|vehicle|underwater; "distance": near|mid|far; "intensity": soft|medium|strong; "detail": até 6 palavras EM INGLÊS. Prefira descrições genéricas e reutilizáveis.
Regras de conforto: o som acompanha, nunca compete com a leitura. Se a cena continua no mesmo lugar, repita os mesmos stems com volumes parecidos (sem trocas bruscas); mude só quando cenário, clima ou emoção mudarem. Páginas sem local definido repetem a matriz anterior. No máximo 2 sons pontuais por página, e nenhum se não houver ação sonora. Ambiente da página anterior ao primeiro item: ${JSON.stringify(prev ?? {})}.
"mood" = clima visual: rain|sea|fire|forest|night|city|tension|warm|cold|calm.
Responda SOMENTE com JSON: {"pages":[{"mood":"tension","mix":[{"s":"rain","gain":0.45,"lowpass":1200,"priority":1},{"s":"drone","gain":0.2,"priority":3}],"looks":{"rain":{"material":"glass","place":"indoor"}},"spots":[{"s":"door","kind":"creak","at":2,"w":0.4,"v":{"place":"indoor","distance":"mid"}}]}]} com exatamente ${items.length} itens, na ordem.
${items.map((t, i) => `${i + 1}) ${t}`).join('\n')}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'método não permitido' }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: 'não autenticado' }, 401);

  let body: { title?: unknown; pages?: unknown; prev?: unknown; cacheOnly?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const title = String(body.title ?? '').slice(0, 200);
  const pages = Array.isArray(body.pages) ? body.pages.slice(0, 8).map((p) => String(p).slice(0, 2000)) : [];
  if (!pages.length) return json({ error: 'sem páginas' }, 400);

  // a chave não inclui "prev": o mesmo trecho dá o mesmo resultado para todos os leitores
  const key = 'sound:' + PROMPT_VERSION + ':' + (await sha256(JSON.stringify(pages)));
  const hit = await cacheGet<{ plans: unknown[] }>(key);
  if (hit) return json({ plans: hit.plans, cached: true });

  // livros públicos (exemplos, Project Gutenberg): só o que já foi pré-calculado, sem chamar a IA.
  // O pré-cálculo (scripts/precompute-public.ts) passa o segredo e preenche o cache para todos.
  const precompute = isPrecompute(req);
  if (body.cacheOnly === true && !precompute) return json({ plans: [], cached: false, skipped: true });

  if (!precompute && !(await withinDailyLimit(user.id))) return json({ error: 'limite diário atingido' }, 429);

  try {
    const r = await askClaudeJson<{ pages?: unknown[] }>(prompt(title, pages, body.prev), { model: MODEL, maxTokens: 4000 });
    const plans = Array.isArray(r.pages) ? r.pages.slice(0, pages.length) : [];
    if (plans.length) await cachePut(key, 'sound', { plans }, MODEL);
    return json({ plans, cached: false });
  } catch (e) {
    const status = e instanceof ClaudeError && e.status === 429 ? 429 : 502;
    console.error('sound-plan', e);
    return json({ error: 'falha na IA' }, status);
  }
});
