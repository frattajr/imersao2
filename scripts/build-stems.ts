/**
 * Pacote inicial de stems (gerados uma vez pela ElevenLabs) publicado junto
 * com o app, para a primeira experiência ter som sem nenhuma configuração:
 * cobre todos os stems genéricos e os sons exatos das obras iniciais
 * (src/data/classics.ts). Roda no deploy (GitHub Actions) com o segredo
 * ELEVENLABS_API_KEY; arquivos já gerados ficam em cache e não são pagos de
 * novo. Sem a chave, não faz nada (e o deploy segue).
 *
 * Uso: ELEVENLABS_API_KEY=... bun scripts/build-stems.ts <pasta-cache> [--max 80]
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { descKey, generationRequest, type SoundDesc } from '../supabase/functions/_shared/sound-library';
import { analyze } from '../src/core/analyze';
import { sanitizePlan } from '../src/core/plan';
import { bookProfile, enrichPlan } from '../src/core/scenery';
import { layerDesc, planDescs, spotDesc } from '../src/core/sound';
import { LAYERS } from '../src/core/types';
import { CLASSICS } from '../src/data/classics';

export const fileOf = (d: SoundDesc) => {
  const k = (descKey(d) + '|' + (d.detail ?? '')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${k.slice(0, 90)}.mp3`;
};

/** Todos os sons que o pacote precisa ter: stems genéricos + o que as obras iniciais pedem. */
export function starterDescs(): SoundDesc[] {
  const all = new Map<string, SoundDesc>();
  const add = (d: SoundDesc) => all.set(fileOf(d), d);
  LAYERS.forEach((L) => add(layerDesc(L)));
  for (const b of CLASSICS) {
    const profile = bookProfile(b.pages, analyze, b.title);
    b.pages.forEach((text, i) => {
      const plan = sanitizePlan(b.plans?.[i]) ?? analyze(text);
      const rich = enrichPlan(plan, text, profile);
      [...planDescs(rich), ...rich.details.map((x) => spotDesc({ s: x.s, at: 0, w: x.w, v: x.v }))].forEach(add);
    });
  }
  return [...all.values()];
}

async function generate(key: string, d: SoundDesc): Promise<Uint8Array | null> {
  const req = generationRequest(d);
  const r = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ text: req.text, duration_seconds: req.seconds, prompt_influence: 0.4, loop: req.loop, model_id: 'eleven_text_to_sound_v2' }),
  });
  if (!r.ok) { console.log(`  falhou (${r.status}): ${(await r.text()).slice(0, 120)}`); return null; }
  const b = new Uint8Array(await r.arrayBuffer());
  return b.length > 4000 ? b : null;
}

if (import.meta.main) {
  const out = process.argv[2] ?? '.stems-cache';
  const args = process.argv.slice(3);
  const max = Number(args[args.indexOf('--max') + 1]) || 80;
  await mkdir(out, { recursive: true });
  const descs = starterDescs();
  const key = process.env.ELEVENLABS_API_KEY;
  let made = 0;
  const sounds: (SoundDesc & { file: string })[] = [];
  for (const d of descs) {
    const file = fileOf(d);
    if (!existsSync(join(out, file))) {
      if (!key || made >= max) continue;
      console.log(`Gerando ${file}…`);
      const b = await generate(key, d).catch(() => null);
      if (!b) continue;
      await writeFile(join(out, file), b);
      made++;
    }
    sounds.push({ ...d, file });
  }
  await writeFile(join(out, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), sounds }));
  const prev = existsSync(join(out, 'manifest.json')) ? (await readFile(join(out, 'manifest.json'), 'utf8')).length : 0;
  console.log(`Stems: ${sounds.length}/${descs.length} no pacote (${made} gerados agora)${key ? '' : ' — sem ELEVENLABS_API_KEY, nada gerado'}. ${prev} bytes de manifesto.`);
}
