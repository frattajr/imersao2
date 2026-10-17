import { assessGray, base64ToBytes, brightness, laplacianVariance, toGray } from '../src/quality';

function checker(w: number, h: number, cell: number, lo = 40, hi = 220) {
  const g = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) g[y * w + x] = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 ? hi : lo;
  return g;
}

test('imagem lisa é considerada tremida', () => {
  const flat = new Uint8Array(128 * 96).fill(128);
  expect(laplacianVariance(flat, 128, 96)).toBe(0);
  expect(assessGray(flat, 128, 96)).toMatchObject({ ok: false, issue: 'blur' });
});

test('imagem com bordas nítidas passa', () => {
  const q = assessGray(checker(128, 96, 4), 128, 96);
  expect(q.ok).toBe(true);
  expect(q.sharpness).toBeGreaterThan(1000);
});

test('escura e estourada são barradas antes do foco', () => {
  expect(assessGray(checker(64, 64, 4, 0, 40), 64, 64).issue).toBe('dark');
  expect(assessGray(checker(64, 64, 4, 230, 255), 64, 64).issue).toBe('bright');
});

test('luminância e base64', () => {
  expect(Array.from(toGray(new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255]), 2, 1))).toEqual([255, 0]);
  expect(brightness(new Uint8Array([0, 100, 200]))).toBe(100);
  expect(Array.from(base64ToBytes('AAEC/w=='))).toEqual([0, 1, 2, 255]);
  expect(Array.from(base64ToBytes('aGk='))).toEqual([104, 105]);
});
