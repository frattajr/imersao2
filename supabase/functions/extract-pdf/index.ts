/**
 * POST { path }  — caminho do PDF que o app acabou de enviar ao bucket
 * "imports" (sempre dentro da pasta do próprio leitor)
 * → { title, pages: string[][] }  (linhas de texto de cada página)
 *
 * O PDF é lido em memória e apagado do Storage em seguida: nada fica
 * guardado. O app reconstrói os parágrafos (src/core/text.ts → joinPdfPages).
 */
import { getDocumentProxy } from 'npm:unpdf';
import { admin, cors, json, requireUser } from '../_shared/http.ts';

const MAX_BYTES = 30 * 1024 * 1024;
const MAX_PAGES = 2000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'método não permitido' }, 405);
  const user = await requireUser(req);
  if (!user) return json({ error: 'não autenticado' }, 401);

  let path = '';
  try { path = String((await req.json()).path ?? ''); } catch { return json({ error: 'JSON inválido' }, 400); }
  if (!path.startsWith(user.id + '/') || path.includes('..')) return json({ error: 'caminho inválido' }, 403);
  const store = admin().storage.from('imports');
  const { data: blob, error: dlErr } = await store.download(path);
  void store.remove([path]);
  if (dlErr || !blob) return json({ error: 'Arquivo não encontrado.' }, 404);
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (!buf.length) return json({ error: 'Arquivo vazio.' }, 400);
  if (buf.length > MAX_BYTES) return json({ error: 'PDF grande demais (máximo 30 MB).' }, 413);
  if (!(buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)) return json({ error: 'Este arquivo não é um PDF.' }, 400);

  try {
    const pdf = await getDocumentProxy(buf);
    let title = '';
    try {
      const meta = await pdf.getMetadata();
      title = String((meta?.info as { Title?: string } | undefined)?.Title ?? '').slice(0, 200);
    } catch { /* sem metadados */ }

    const pages: string[][] = [];
    const n = Math.min(pdf.numPages, MAX_PAGES);
    for (let p = 1; p <= n; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const lines: string[] = [];
      let line = '';
      for (const it of tc.items as { str?: string; hasEOL?: boolean }[]) {
        line += it.str ?? '';
        if (it.hasEOL) { lines.push(line); line = ''; }
      }
      if (line) lines.push(line);
      pages.push(lines);
    }
    const chars = pages.reduce((s, l) => s + l.join('').length, 0);
    if (chars < 200) return json({ error: 'Este PDF não tem texto (provavelmente é digitalizado, só imagens).' }, 422);
    return json({ title, pages });
  } catch (e) {
    console.error('extract-pdf', e);
    const msg = /password|encrypt/i.test(String(e)) ? 'Este PDF é protegido por senha.' : 'Não foi possível ler este PDF.';
    return json({ error: msg }, 422);
  }
});
