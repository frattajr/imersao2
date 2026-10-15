/**
 * POST { url } → o arquivo (texto ou EPUB) do Project Gutenberg.
 *
 * Só para a versão web: o navegador pode bloquear o download direto do
 * gutenberg.org (CORS). Aceita apenas endereços do Gutenberg — não é um
 * proxy aberto — e só para leitores logados.
 */
import { sha256 } from '../_shared/claude.ts';
import { admin, cors, json, requireUser } from '../_shared/http.ts';

const ALLOWED = /^(www\.)?gutenberg\.org$|^gutenberg\.pglaf\.org$|^aleph\.gutenberg\.org$/;
const MAX_BYTES = 15_000_000;

export function allowedUrl(raw: unknown): URL | null {
  try {
    const u = new URL(String(raw));
    return u.protocol === 'https:' && ALLOWED.test(u.hostname) ? u : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'método não permitido' }, 405);
  const user = await requireUser(req);
  if (!user) return json({ error: 'não autenticado' }, 401);

  let body: { url?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const url = allowedUrl(body.url);
  if (!url) return json({ error: 'só endereços do Project Gutenberg' }, 400);

  // cache global: o mesmo arquivo baixado uma vez serve a todos os leitores
  const path = 'gutenberg/' + (await sha256(url.href));
  const cached = await admin().storage.from('public-books').download(path);
  if (!cached.error && cached.data) {
    return new Response(new Uint8Array(await cached.data.arrayBuffer()), {
      headers: { ...cors, 'Content-Type': 'application/octet-stream', 'X-Cache': 'hit' },
    });
  }

  const r = await fetch(url, { redirect: 'follow' });
  // o redirecionamento também precisa terminar no Gutenberg
  if (!allowedUrl(r.url) || !r.ok) return json({ error: 'não encontrado' }, 404);
  const len = Number(r.headers.get('content-length') ?? 0);
  if (len > MAX_BYTES) return json({ error: 'arquivo grande demais' }, 413);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.length > MAX_BYTES) return json({ error: 'arquivo grande demais' }, 413);
  await admin().storage.from('public-books').upload(path, buf, { contentType: 'application/octet-stream', upsert: true }).catch(() => undefined);
  return new Response(buf, {
    headers: { ...cors, 'Content-Type': 'application/octet-stream', 'X-Source-Type': r.headers.get('content-type') ?? '', 'X-Cache': 'miss' },
  });
});
