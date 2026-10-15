/**
 * Registra no repositório de sons as gravações do pacote fixo (manifest.json
 * do bucket "sounds"), para que a busca por semelhança as encontre.
 * Gera SQL; rode no SQL Editor do Supabase ou com `psql`.
 *
 * Uso: bun scripts/import-sound-pack.ts caminho/ou/url/manifest.json > pack.sql
 *
 * Nos sons pontuais, a chave por superfície ("wood", "gravel"...) vira o
 * campo "material"; "*" fica sem material (som genérico).
 */
import { descKey, LIB_LAYERS, LIB_SPOTS, MATERIALS, type SoundDesc } from '../supabase/functions/_shared/sound-library.ts';

const src = process.argv[2];
if (!src) { console.error('uso: bun scripts/import-sound-pack.ts manifest.json'); process.exit(1); }
const manifest = JSON.parse(/^https?:/.test(src) ? await (await fetch(src)).text() : await Bun.file(src).text()) as {
  layers?: Record<string, string[]>;
  spots?: Record<string, string[] | Record<string, string[]>>;
};

const q = (v: string | undefined) => (v === undefined ? 'null' : `'${v.replace(/'/g, "''")}'`);
const rows: string[] = [];
const add = (d: SoundDesc, file: string) =>
  rows.push(`(${q(descKey(d))}, ${q(d.cat)}, ${q(d.name)}, ${q(d.material)}, ${q(file)}, 'recorded', 'ok')`);

for (const [name, files] of Object.entries(manifest.layers ?? {})) {
  if (!(LIB_LAYERS as readonly string[]).includes(name)) { console.error(`camada desconhecida: ${name}`); continue; }
  files.forEach((f) => add({ cat: 'layer', name }, f));
}
for (const [name, entry] of Object.entries(manifest.spots ?? {})) {
  if (!(LIB_SPOTS as readonly string[]).includes(name)) { console.error(`som pontual desconhecido: ${name}`); continue; }
  const groups = Array.isArray(entry) ? { '*': entry } : entry;
  for (const [k, files] of Object.entries(groups)) {
    const material = (MATERIALS as readonly string[]).includes(k) ? (k as SoundDesc['material']) : undefined;
    files.forEach((f) => add({ cat: 'spot', name, material }, f));
  }
}

console.log(`-- ${rows.length} gravações do pacote (reimportar não duplica)
insert into public.sound_library (key, cat, name, material, path, source, status)
select v.* from (values
  ${rows.join(',\n  ')}
) as v(key, cat, name, material, path, source, status)
where not exists (select 1 from public.sound_library s where s.path = v.path);`);
