/**
 * Pacote inicial de sons a partir do Freesound (freesound.org), só com sons
 * CC0 (domínio público: uso comercial liberado, sem crédito obrigatório —
 * mesmo assim guardamos autor e link de cada um no manifesto).
 *
 * Substitui a geração pela ElevenLabs: para cada som que o pacote precisa
 * (os mesmos de scripts/build-stems.ts), procura no Freesound, escolhe o mais
 * bem avaliado com duração adequada (ambiente: loops longos; efeito: curto) e
 * baixa a prévia em MP3 de alta qualidade. A API é usada só aqui, para montar
 * o pacote uma vez; o app toca os arquivos do nosso próprio servidor.
 *
 * Uso: FREESOUND_API_KEY=... bun scripts/build-stems-freesound.ts <pasta-cache> [--max 120]
 * (chave grátis em https://freesound.org/apiv2/apply)
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SoundDesc } from '../supabase/functions/_shared/sound-library';
import { fileOf, starterDescs } from './build-stems';

import { bestHit, durationFilter, queriesFor, type Hit } from '../src/core/freesound';

async function search(token: string, q: string, filter: string): Promise<Hit[]> {
  const u = new URL('https://freesound.org/apiv2/search/text/');
  u.searchParams.set('query', q);
  u.searchParams.set('filter', `license:"Creative Commons 0" ${filter}`);
  u.searchParams.set('fields', 'id,name,username,license,duration,avg_rating,num_downloads,previews');
  u.searchParams.set('page_size', '15');
  u.searchParams.set('token', token);
  const r = await fetch(u);
  if (!r.ok) { console.log(`  busca falhou (${r.status})`); return []; }
  return ((await r.json()) as { results?: Hit[] }).results ?? [];
}

if (import.meta.main) {
  const out = process.argv[2] ?? '.stems-cache';
  const args = process.argv.slice(3);
  const max = Number(args[args.indexOf('--max') + 1]) || 120;
  const token = process.env.FREESOUND_API_KEY;
  await mkdir(out, { recursive: true });
  const mf = join(out, 'manifest.json');
  const prev = existsSync(mf) ? (JSON.parse(await readFile(mf, 'utf8')) as { sounds?: (SoundDesc & { file: string; credit?: unknown })[] }).sounds ?? [] : [];
  const credits = new Map(prev.map((s) => [s.file, s.credit]));
  const used = new Set<number>();
  const sounds: (SoundDesc & { file: string; credit?: unknown })[] = [];
  let got = 0;
  for (const d of starterDescs()) {
    const file = fileOf(d);
    if (!existsSync(join(out, file))) {
      if (!token || got >= max) continue;
      let hit: Hit | undefined;
      for (const q of queriesFor(d)) {
        hit = bestHit(await search(token, q, durationFilter(d)), used);
        if (hit) break;
      }
      const url = hit?.previews['preview-hq-mp3'];
      if (!hit || !url) { console.log(`  nada para ${file}`); continue; }
      const r = await fetch(url);
      if (!r.ok) continue;
      await writeFile(join(out, file), new Uint8Array(await r.arrayBuffer()));
      used.add(hit.id);
      credits.set(file, { source: 'freesound', id: hit.id, title: hit.name, author: hit.username, url: `https://freesound.org/s/${hit.id}/`, license: 'CC0' });
      console.log(`  ${file} ← "${hit.name}" de ${hit.username}`);
      got++;
    }
    sounds.push({ ...d, file, credit: credits.get(file) });
  }
  await writeFile(mf, JSON.stringify({ generatedAt: new Date().toISOString(), source: 'freesound (CC0)', sounds }));
  console.log(`Sons: ${sounds.length} no pacote (${got} baixados agora)${token ? '' : ' — sem FREESOUND_API_KEY, nada baixado'}.`);
}
