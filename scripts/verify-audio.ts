/**
 * Verifica a síntese fora do celular: sem NaN, sem estourar, níveis certos,
 * emenda do loop suave, e mede o tempo de geração.
 * Uso: bun scripts/verify-audio.ts [pasta-para-salvar-wav]
 */
import { LAYERS, SPOTS, type Spot } from '../src/core/types';
import { peak, rms } from '../src/audio/dsp';
import { LAYER_RECIPES, SPORADIC, renderLayer, renderSpot } from '../src/audio/recipes';
import { rng } from '../src/audio/dsp';

const SR = 44100;
const out = process.argv[2];
let fail = 0;
const check = (c: boolean, m: string) => { if (!c) { fail++; console.error('  FALHOU:', m); } };

function wav(path: string, l: Float32Array, r: Float32Array = l) {
  const n = l.length, b = new ArrayBuffer(44 + n * 4), v = new DataView(b);
  const s = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  s(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); s(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 2, true); v.setUint32(24, SR, true); v.setUint32(28, SR * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true);
  s(36, 'data'); v.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) { v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, l[i])) * 32767, true); v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, r[i])) * 32767, true); }
  return Bun.write(path, b);
}

/** Centroide espectral aproximado (cruzamentos por zero → "brilho"). */
const brightness = (b: Float32Array) => { let z = 0; for (let i = 1; i < b.length; i++) if ((b[i - 1] < 0) !== (b[i] < 0)) z++; return Math.round((z / 2) * (SR / b.length)); };

console.log('Camadas (loop):');
let total = 0;
for (const L of LAYERS) {
  const t0 = performance.now();
  const { left, right } = renderLayer(L, SR, 1);
  const ms = performance.now() - t0; total += ms;
  const nan = left.some((x) => !Number.isFinite(x));
  const rec = LAYER_RECIPES[L];
  // emenda: diferença entre o último e o primeiro sample comparada à variação típica entre samples vizinhos
  let typ = 0; for (let i = 1; i < 2000; i++) typ += Math.abs(left[i] - left[i - 1]); typ /= 1999;
  const seam = Math.abs(left[0] - left[left.length - 1]);
  console.log(`  ${L.padEnd(8)} ${(left.length / SR).toFixed(2)}s  rms ${rms(left).toFixed(3)}  pico ${peak(left).toFixed(2)}  brilho~${brightness(left)}Hz  emenda ${(seam / (typ || 1)).toFixed(1)}x  ${ms.toFixed(0)}ms`);
  check(!nan, `${L}: NaN`);
  check(peak(left) <= 0.91, `${L}: pico alto`);
  check(L === 'thunder' || Math.abs(rms(left) - rec.rms) < rec.rms * 0.05 || peak(left) >= 0.89, `${L}: rms fora do alvo`);
  check(Math.abs(left.length / SR - rec.loop) < 0.01, `${L}: duração do loop`);
  check(L === 'thunder' || seam <= typ * 25 + 1e-4, `${L}: emenda do loop`);
  check(right.length === left.length, `${L}: canais`);
  if (out) await wav(`${out}/layer-${L}.wav`, left, right);
}
console.log(`  tempo total para gerar todas as camadas: ${(total / 1000).toFixed(2)}s (V8; no celular espere 3–8x mais, gerado aos poucos)`);

console.log('Eventos esporádicos:');
for (const [k, s] of Object.entries(SPORADIC)) {
  const b = s!.render(SR, rng(3));
  console.log(`  ${k.padEnd(8)} ${(b.length / SR).toFixed(1)}s pico ${peak(b).toFixed(2)}`);
  check(b.every(Number.isFinite) && peak(b) < 0.5, `${k}: esporádico`);
  if (out) await wav(`${out}/sporadic-${k}.wav`, b);
}

console.log('Sons pontuais:');
const extra: Spot[] = [
  { s: 'steps', at: 0, w: 0.5, surface: 'gravel', n: 6 }, { s: 'steps', at: 0, w: 0.5, surface: 'metal' },
  { s: 'door', at: 0, w: 0.5, kind: 'close' }, { s: 'horn', at: 0, w: 0.5, kind: 'foghorn' },
];
for (const sp of [...SPOTS.map((s) => ({ s, at: 0, w: 0.5 } as Spot)), ...extra]) {
  const t0 = performance.now();
  const b = renderSpot(sp, SR, 7);
  const name = sp.s + (sp.surface ? '-' + sp.surface : sp.kind ? '-' + sp.kind : '');
  console.log(`  ${name.padEnd(14)} ${(b.length / SR).toFixed(1)}s pico ${peak(b).toFixed(2)} ${(performance.now() - t0).toFixed(0)}ms`);
  check(b.every(Number.isFinite), `${name}: NaN`);
  check(Math.abs(peak(b) - 0.16) < 0.01, `${name}: pico deveria ser 0.32*w`);
  check(rms(b) > 0.002, `${name}: silencioso demais`);
  if (out) await wav(`${out}/spot-${name}.wav`, b);
}

if (fail) { console.error(`\n${fail} problema(s).`); process.exit(1); }
console.log('\nÁudio: tudo certo.');
