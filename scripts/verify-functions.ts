/**
 * Roda as funções do servidor (Supabase Edge Functions) fora do Supabase,
 * com Supabase, Claude e leitor de PDF simulados, para testar: login,
 * cache compartilhado, limite diário, entradas inválidas e PDF.
 * Uso: bun scripts/verify-functions.ts
 */
import { plugin } from 'bun';

/* ---------- simulações ---------- */
const db = { cache: new Map<string, unknown>(), usage: new Map<string, number>(), files: new Map<string, Uint8Array>() };
let claudeCalls = 0;
let claudeReply = '';
let handler: (r: Request) => Promise<Response> = async () => new Response('');

(globalThis as any).Deno = {
  env: { get: (k: string) => ({ SUPABASE_URL: 'http://sb', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'svc', ANTHROPIC_API_KEY: 'sk-test', AI_DAILY_LIMIT: '2' } as Record<string, string>)[k] },
  serve: (h: typeof handler) => { handler = h; },
};

const fakeClient = (headers: Record<string, string> = {}) => ({
  auth: { getUser: async () => ({ data: { user: headers.Authorization === 'Bearer bom' ? { id: 'u1' } : null } }) },
  rpc: async (_fn: string, a: { p_owner: string; p_limit: number }) => {
    const c = (db.usage.get(a.p_owner) ?? 0) + 1; db.usage.set(a.p_owner, c);
    return { data: c <= a.p_limit, error: null };
  },
  storage: { from: (_b: string) => ({
    download: async (p: string) => (db.files.has(p) ? { data: new Blob([db.files.get(p)!]), error: null } : { data: null, error: { message: 'not found' } }),
    remove: async (ps: string[]) => { ps.forEach((p) => db.files.delete(p)); return { error: null }; },
  }) },
  from: (_t: string) => ({
    select: () => ({ eq: (_c: string, key: string) => ({ maybeSingle: async () => ({ data: db.cache.has(key) ? { value: db.cache.get(key) } : null }) }) }),
    upsert: async (row: { key: string; value: unknown }) => { db.cache.set(row.key, row.value); return { error: null }; },
  }),
});

plugin({
  setup(build) {
    build.module('npm:@supabase/supabase-js@2', () => ({
      loader: 'object',
      exports: { createClient: (_u: string, _k: string, o?: { global?: { headers?: Record<string, string> } }) => fakeClient(o?.global?.headers) },
    }));
    build.module('npm:unpdf', () => ({
      loader: 'object',
      exports: {
        getDocumentProxy: async (buf: Uint8Array) => {
          if (buf[5] === 0x58) throw new Error('PasswordException: encrypted');
          const page = (lines: string[]) => ({ getTextContent: async () => ({ items: lines.flatMap((l) => [{ str: l.slice(0, 10) }, { str: l.slice(10), hasEOL: true }]) }) });
          const long = 'Uma linha bem longa de texto corrido de um livro qualquer para testar a leitura do PDF. ';
          return { numPages: 2, getMetadata: async () => ({ info: { Title: 'Livro PDF' } }), getPage: async (p: number) => page(p === 1 ? [long, long, 'fim.'] : [long, '7']) };
        },
      },
    }));
  },
});

const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  if (String(url).includes('api.anthropic.com')) {
    claudeCalls++;
    const body = JSON.parse(String(init?.body));
    if (!(init?.headers as Record<string, string>)['x-api-key']) return new Response('sem chave', { status: 401 });
    if (!body.model || !body.max_tokens) return new Response('faltou campo', { status: 400 });
    return new Response(JSON.stringify({ content: [{ type: 'text', text: claudeReply }] }), { status: 200 });
  }
  return realFetch(url as string, init);
}) as typeof fetch;

/* ---------- auxiliares ---------- */
let fails = 0;
const ok = (c: unknown, m: string) => { console.log((c ? 'ok   ' : 'FALHOU ') + '- ' + m); if (!c) fails++; };
const post = (body: unknown, auth = 'Bearer bom', type = 'application/json') =>
  handler(new Request('http://f', { method: 'POST', headers: { Authorization: auth, 'Content-Type': type }, body: body instanceof Uint8Array ? body : JSON.stringify(body) }));

/* ---------- sound-plan ---------- */
await import('../supabase/functions/sound-plan/index.ts');
claudeReply = 'Claro! ```json\n{"pages":[{"mood":"sea","ambience":{"sea":0.5},"spots":[]},{"mood":"fire","ambience":{"fire":0.4},"spots":[{"s":"knock","at":2,"w":0.5}]}]}\n```';
let r = await post({ title: 'Farol', pages: ['A', 'B'] }, 'Bearer ruim');
ok(r.status === 401, 'sound-plan recusa quem não está logado');
r = await post({ title: 'Farol', pages: [] });
ok(r.status === 400, 'sound-plan recusa lote vazio');
r = await post({ title: 'Farol', pages: ['A', 'B'] });
let j = await r.json();
ok(r.status === 200 && j.plans.length === 2 && j.cached === false && claudeCalls === 1, 'primeira leitura chama a IA (e tolera texto em volta do JSON)');
r = await post({ title: 'Outro título', pages: ['A', 'B'], prev: { rain: 0.5 } });
j = await r.json();
ok(j.cached === true && claudeCalls === 1, 'segundo leitor do mesmo trecho vem do cache, sem custo');
ok(db.usage.get('u1') === 1, 'chamada do cache não conta no limite diário');
r = await post({ title: 'Farol', pages: ['C'] });
ok(r.status === 200, 'segunda chamada nova dentro do limite');
r = await post({ title: 'Farol', pages: ['D'] });
ok(r.status === 429, 'acima do limite diário responde 429');
db.usage.clear();
claudeReply = 'desculpe, não consigo';
r = await post({ title: 'Farol', pages: ['E'] });
ok(r.status === 502, 'resposta da IA sem JSON vira erro 502 (e nada é guardado)');
r = await handler(new Request('http://f', { method: 'POST', headers: { Authorization: 'Bearer bom' }, body: '{quebrado' }));
ok(r.status === 400, 'JSON inválido → 400');
r = await handler(new Request('http://f', { method: 'OPTIONS' }));
ok(r.status === 200 && r.headers.get('Access-Control-Allow-Origin') === '*', 'CORS (OPTIONS)');

/* ---------- glossary ---------- */
db.usage.clear(); claudeCalls = 0;
await import('../supabase/functions/glossary/index.ts');
claudeReply = '{"entries":[{"term":"Marina","desc":"guardiã do farol"},{"term":"","desc":"vazio"},{"term":"Orm","desc":"' + 'x'.repeat(400) + '"}]}';
r = await post({ title: 'Farol', text: 'Marina chegou ao farol. O velho Orm acendeu a fogueira e esperou.', known: [] });
j = await r.json();
ok(j.entries.length === 2 && j.entries[0].term === 'Marina' && j.entries[1].desc.length === 200, 'glossário filtra termos vazios e corta descrições longas');
r = await post({ title: 'Farol', text: 'curto', known: [] });
ok((await r.json()).entries.length === 0 && claudeCalls === 1, 'trecho curto demais não chama a IA');

/* ---------- extract-pdf ---------- */
await import('../supabase/functions/extract-pdf/index.ts');
db.files.set('u1/a.pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]));
db.files.set('u2/b.pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]));
r = await post({ path: 'u2/b.pdf' });
ok(r.status === 403, 'não deixa ler o PDF de outro leitor');
r = await post({ path: 'u1/../u2/b.pdf' });
ok(r.status === 403, 'bloqueia caminho com ..');
r = await post({ path: 'u1/a.pdf' });
j = await r.json();
ok(!db.files.has('u1/a.pdf'), 'PDF é apagado do servidor depois de lido');
ok(r.status === 200 && j.title === 'Livro PDF' && j.pages.length === 2 && j.pages[0].length === 3, 'PDF: título e linhas por página (junta pedaços da mesma linha)');
ok(j.pages[0][0].startsWith('Uma linha bem longa'), 'PDF: texto da linha completo');
db.files.set('u1/c.pdf', new Uint8Array([1, 2, 3, 4]));
r = await post({ path: 'u1/c.pdf' });
ok(r.status === 400, 'arquivo que não é PDF → 400');
r = await post({ path: 'u1/sumiu.pdf' });
ok(r.status === 404, 'arquivo inexistente → 404');
db.files.set('u1/d.pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x58]));
r = await post({ path: 'u1/d.pdf' });
ok(r.status === 422 && (await r.json()).error.includes('senha'), 'PDF protegido por senha → mensagem clara');

/* ---------- o app junta as linhas em parágrafos ---------- */
const { joinPdfPages, chunk } = await import('../src/core/text');
const text = joinPdfPages(j.pages ?? [[]]);
ok(chunk(joinPdfPages([['Uma linha bem longa de texto corrido de um livro qualquer para testar a leitura do PDF.', 'fim.']])).length === 1, 'parágrafos montados a partir das linhas');
void text;

if (fails) { console.error(`\n${fails} falha(s).`); process.exit(1); }
console.log('\nFunções do servidor: tudo certo.');
