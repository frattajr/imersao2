/**
 * POST { descs: SoundDesc[] (até 12) }  → { items: Resolved[] }
 * POST { report: "<id do som>" }        → { ok: boolean }
 *
 * Procura no repositório de sons o mais parecido com cada descrição. Se nada
 * serve e a geração está ligada (ELEVENLABS_API_KEY), gera o som em segundo
 * plano e responde "pending": na próxima busca ele já está pronto, para este
 * e para todos os outros leitores.
 */
import { sanitizeDesc, type LibrarySound, type SoundDesc } from '../_shared/sound-library.ts';
import { resolveDescs, type Generator, type Store } from '../_shared/sound-resolve.ts';
import { admin, cors, json, requireUser } from '../_shared/http.ts';

const GEN_MODEL = Deno.env.get('SOUND_GEN_MODEL') ?? 'eleven_text_to_sound_v2';
const GEN_DAILY_LIMIT = Number(Deno.env.get('SOUND_GEN_DAILY_LIMIT') ?? 50);

const store: Store = {
  async candidates(cat, name) {
    const { data } = await admin().from('sound_library')
      .select('id, key, cat, name, material, place, distance, intensity, detail, path')
      .eq('cat', cat).eq('name', name).eq('status', 'ok').limit(300);
    return ((data ?? []) as Record<string, unknown>[]).map((r) => {
      const s = { ...r } as Record<string, unknown>;
      Object.keys(s).forEach((k) => s[k] === null && delete s[k]); // null do banco = campo não informado
      return s as unknown as LibrarySound;
    });
  },
  async claim(d, key) {
    const { data, error } = await admin().rpc('claim_sound', {
      p_key: key, p_cat: d.cat, p_name: d.name, p_material: d.material ?? null, p_place: d.place ?? null,
      p_distance: d.distance ?? null, p_intensity: d.intensity ?? null, p_detail: d.detail ?? null, p_model: GEN_MODEL,
    });
    return error ? null : ((data as string | null) ?? null);
  },
  async finish(id, path, bytes) {
    await admin().from('sound_library').update({ status: 'ok', path, bytes }).eq('id', id);
  },
  async fail(id) {
    await admin().from('sound_library').update({ status: 'failed' }).eq('id', id);
  },
  async bumpUses(ids) {
    await admin().rpc('bump_sound_uses', { p_ids: ids });
  },
  async upload(path, bytes) {
    const { error } = await admin().storage.from('sounds').upload(path, bytes, { contentType: 'audio/mpeg', upsert: true });
    return !error;
  },
  publicUrl(path) {
    return admin().storage.from('sounds').getPublicUrl(path).data.publicUrl;
  },
  async withinGenLimit() {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count, error } = await admin().from('sound_library')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'generated').gte('created_at', since);
    return !error && (count ?? 0) < GEN_DAILY_LIMIT;
  },
};

/** Gerador de efeitos sonoros da ElevenLabs (texto → MP3). */
function elevenLabs(apiKey: string): Generator {
  return async ({ text, seconds, loop }) => {
    const r = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ text, duration_seconds: seconds, prompt_influence: 0.4, loop, model_id: GEN_MODEL }),
    });
    if (!r.ok) {
      console.error('sound-generation', r.status, (await r.text()).slice(0, 300));
      return null;
    }
    return new Uint8Array(await r.arrayBuffer());
  };
}

const defer = (p: Promise<unknown>) => {
  const rt = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (rt) rt.waitUntil(p);
  else void p;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'método não permitido' }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: 'não autenticado' }, 401);

  let body: { descs?: unknown; report?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }

  if (typeof body.report === 'string') {
    if (!/^[0-9a-f-]{36}$/i.test(body.report)) return json({ error: 'id inválido' }, 400);
    const { data, error } = await admin().rpc('report_sound', { p_owner: user.id, p_id: body.report });
    return json({ ok: !error && data === true });
  }

  const raw = Array.isArray(body.descs) ? body.descs.slice(0, 12) : [];
  const descs = raw.map(sanitizeDesc);
  if (!raw.length) return json({ error: 'sem sons' }, 400);

  const valid = descs.filter((d): d is SoundDesc => !!d);
  const key = Deno.env.get('ELEVENLABS_API_KEY');
  try {
    const resolved = await resolveDescs(valid, store, key ? elevenLabs(key) : null, defer);
    let k = 0;
    return json({ items: descs.map((d) => (d ? resolved[k++] : { status: 'none' })) });
  } catch (e) {
    console.error('sound-resolve', e);
    return json({ error: 'falha ao buscar sons' }, 502);
  }
});
