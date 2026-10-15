/**
 * Roda as funções do servidor (Supabase Edge Functions) fora do Supabase,
 * com Supabase, Claude e leitor de PDF simulados, para testar: login,
 * cache compartilhado, limite diário, entradas inválidas e PDF.
 * Uso: bun scripts/verify-functions.ts
 */
import { plugin } from 'bun';

/* ---------- simulações ---------- */
const db = { cache: new Map<string, unknown>(), usage: new Map<string, number>(), files: new Map<string, Uint8Array>(), sounds: [] as Record<string, any>[], reports: new Set<string>() };
const env: Record<string, string> = { SUPABASE_URL: 'http://sb', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'svc', ANTHROPIC_API_KEY: 'sk-test', AI_DAILY_LIMIT: '2', SOUND_GEN_DAILY_LIMIT: '3' };
let genCalls = 0;
let genBody: any = null;
const waiting: Promise<unknown>[] = [];
(globalThis as any).EdgeRuntime = { waitUntil: (p: Promise<unknown>) => waiting.push(p) };
let claudeCalls = 0;
let claudeReply = '';
let handler: (r: Request) => Promise<Response> = async () => new Response('');

(globalThis as any).Deno = {
  env: { get: (k: string) => env[k] },
  serve: (h: typeof handler) => { handler = h; },
};

const fakeClient = (headers: Record<string, string> = {}) => ({
  auth: { getUser: async () => ({ data: { user: headers.Authorization === 'Bearer bom' ? { id: 'u1' } : null } }) },
  rpc: async (fn: string, a: any) => {
    if (fn === 'claim_sound') {
      if (db.sounds.some((r) => r.key === a.p_key && (r.status === 'generating' || r.status === 'failed'))) return { data: null, error: null };
      const row = { id: crypto.randomUUID(), key: a.p_key, cat: a.p_cat, name: a.p_name, material: a.p_material, place: a.p_place, distance: a.p_distance, intensity: a.p_intensity, detail: a.p_detail, path: null, source: 'generated', status: 'generating', uses: 0, reports: 0, created_at: new Date().toISOString() };
      db.sounds.push(row);
      return { data: row.id, error: null };
    }
    if (fn === 'bump_sound_uses') { db.sounds.forEach((r) => { if (a.p_ids.includes(r.id)) r.uses++; }); return { data: null, error: null }; }
    if (fn === 'report_sound') {
      const k = a.p_owner + ':' + a.p_id;
      if (db.reports.has(k)) return { data: false, error: null };
      db.reports.add(k);
      return { data: true, error: null };
    }
    const c = (db.usage.get(a.p_owner) ?? 0) + 1; db.usage.set(a.p_owner, c);
    return { data: c <= a.p_limit, error: null };
  },
  storage: { from: (_b: string) => ({
    download: async (p: string) => (db.files.has(p) ? { data: new Blob([db.files.get(p)!]), error: null } : { data: null, error: { message: 'not found' } }),
    remove: async (ps: string[]) => { ps.forEach((p) => db.files.delete(p)); return { error: null }; },
    upload: async (p: string, data: Uint8Array) => { db.files.set(p, data); return { error: null }; },
    getPublicUrl: (p: string) => ({ data: { publicUrl: 'http://sb/storage/v1/object/public/sounds/' + p } }),
  }) },
  from: (t: string) => (t === 'sound_library' ? soundQuery() : {
    select: () => ({ eq: (_c: string, key: string) => ({ maybeSingle: async () => ({ data: db.cache.has(key) ? { value: db.cache.get(key) } : null }) }) }),
    upsert: async (row: { key: string; value: unknown }) => { db.cache.set(row.key, row.value); return { error: null }; },
  }),
});

/** Consulta encadeada mínima (select/eq/gte/limit/update) sobre db.sounds. */
function soundQuery() {
  const filters: ((r: Record<string, any>) => boolean)[] = [];
  let patch: Record<string, unknown> | null = null;
  let head = false;
  const q: any = {
    select: (_cols: string, o?: { head?: boolean }) => { head = !!o?.head; return q; },
    update: (p: Record<string, unknown>) => { patch = p; return q; },
    eq: (c: string, v: unknown) => { filters.push((r) => r[c] === v); return q; },
    gte: (c: string, v: string) => { filters.push((r) => r[c] >= v); return q; },
    limit: () => q,
    then: (res: (v: unknown) => void) => {
      const rows = db.sounds.filter((r) => filters.every((f) => f(r)));
      if (patch) { rows.forEach((r) => Object.assign(r, patch)); return res({ error: null }); }
      return res(head ? { count: rows.length, error: null } : { data: rows.map((r) => ({ ...r })), error: null });
    },
  };
  return q;
}

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
  if (String(url).includes('api.elevenlabs.io')) {
    genCalls++;
    genBody = JSON.parse(String(init?.body));
    await new Promise((res) => setTimeout(res, 50)); // geração leva um tempo
    if ((init?.headers as Record<string, string>)['xi-api-key'] !== 'el-test') return new Response('sem chave', { status: 401 });
    const mp3 = new Uint8Array(6000); mp3.set([0x49, 0x44, 0x33]);
    return new Response(mp3, { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  }
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

/* ---------- sound-resolve ---------- */
await import('../supabase/functions/sound-resolve/index.ts');
db.sounds.push({ id: 'aaaaaaaa-0000-0000-0000-000000000001', key: 'k', cat: 'layer', name: 'rain', material: null, place: null, distance: null, intensity: null, detail: null, path: 'lib/layer/rain/r1.mp3', source: 'generated', status: 'ok', uses: 0, reports: 0, created_at: '2026-01-01' });
r = await post({ descs: [{ cat: 'layer', name: 'rain' }] }, 'Bearer ruim');
ok(r.status === 401, 'sound-resolve recusa quem não está logado');
r = await post({ descs: [] });
ok(r.status === 400, 'sound-resolve recusa lista vazia');
r = await post({ descs: [{ cat: 'layer', name: 'rain', intensity: 'soft' }, { cat: 'layer', name: 'lava' }, { cat: 'spot', name: 'roar', distance: 'far' }] });
j = await r.json();
await Promise.all(waiting.splice(0));
ok(j.items[0].status === 'hit' && j.items[0].url.endsWith('/sounds/lib/layer/rain/r1.mp3'), 'reaproveita som do repositório (URL pública)');
ok(db.sounds[0].uses === 1, 'conta o uso do som reaproveitado');
ok(j.items[1].status === 'none', 'descrição inválida vira "none", sem quebrar as outras');
ok(j.items[2].status === 'none' && genCalls === 0, 'sem ELEVENLABS_API_KEY não gera nada (usa a reserva)');

env.ELEVENLABS_API_KEY = 'el-test';
r = await post({ descs: [{ cat: 'spot', name: 'roar', distance: 'far', detail: 'Huge dragon' }] });
j = await r.json();
ok(j.items[0].status === 'pending', 'som novo: responde "pending" sem esperar a geração');
r = await post({ descs: [{ cat: 'spot', name: 'roar', distance: 'far', detail: 'huge dragon' }] });
ok((await r.json()).items[0].status === 'pending', 'pedido repetido durante a geração não gera de novo');
await Promise.all(waiting.splice(0));
const gen = db.sounds.find((x) => x.name === 'roar');
ok(genCalls === 1 && gen?.status === 'ok' && db.files.has(gen.path) && gen.path.startsWith('lib/spot/roar/'), 'gera uma vez, salva no Storage e marca como pronto');
ok(genBody?.loop === false && /creature roar/.test(genBody?.text) && /far away/.test(genBody?.text), 'pedido de geração descreve o som (em inglês)');
r = await post({ descs: [{ cat: 'spot', name: 'roar', distance: 'far', detail: 'old dragon' }] });
j = await r.json();
ok(j.items[0].status === 'hit' && j.items[0].id === gen?.id && genCalls === 1, 'próximo pedido parecido reaproveita o som gerado');
r = await post({ descs: [{ cat: 'spot', name: 'owl' }, { cat: 'spot', name: 'bark' }, { cat: 'spot', name: 'howl' }] });
j = await r.json();
await Promise.all(waiting.splice(0));
ok(j.items[2].status === 'none' && genCalls === 3, 'limite diário de gerações (SOUND_GEN_DAILY_LIMIT)');
r = await post({ report: gen?.id });
ok((await r.json()).ok === true, '"som ruim" registra o voto');
r = await post({ report: gen?.id });
ok((await r.json()).ok === false, 'mesmo leitor não vota duas vezes');
r = await post({ report: 'nao-e-um-id' });
ok(r.status === 400, 'id inválido no "som ruim" → 400');
delete env.ELEVENLABS_API_KEY;

/* ---------- o app junta as linhas em parágrafos ---------- */
const { joinPdfPages, chunk } = await import('../src/core/text');
const text = joinPdfPages(j.pages ?? [[]]);
ok(chunk(joinPdfPages([['Uma linha bem longa de texto corrido de um livro qualquer para testar a leitura do PDF.', 'fim.']])).length === 1, 'parágrafos montados a partir das linhas');
void text;

if (fails) { console.error(`\n${fails} falha(s).`); process.exit(1); }
console.log('\nFunções do servidor: tudo certo.');
