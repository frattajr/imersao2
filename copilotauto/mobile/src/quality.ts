/**
 * Checagem local de qualidade antes de enviar a foto (economiza chamadas pagas).
 *
 * Mesma métrica do servidor (`backend/app/image_quality.py`): variância do
 * Laplaciano numa miniatura em tons de cinza (foco) + luminância média (luz).
 */

export const THUMB = 128;
export const MIN_SHARPNESS = 60;
export const MIN_BRIGHTNESS = 45;
export const MAX_BRIGHTNESS = 235;

export type QualityIssue = 'blur' | 'dark' | 'bright';

export interface Quality {
  ok: boolean;
  sharpness: number;
  brightness: number;
  issue?: QualityIssue;
}

export const ISSUE_TIP: Record<QualityIssue, string> = {
  blur: 'Foto tremida ou fora de foco. Apoie o celular, toque para focar e aguarde 1 s.',
  dark: 'Foto escura. Acenda a lanterna ou procure luz natural.',
  bright: 'Luz demais. Evite sol direto e reflexo do flash; mude o ângulo.',
};

/** Converte RGBA em luminância (BT.601), arredondada como o Pillow. */
export function toGray(rgba: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let i = 0, j = 0; j < out.length; i += 4, j++) {
    out[j] = Math.round((rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000);
  }
  return out;
}

export function brightness(gray: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  return gray.length ? sum / gray.length : 0;
}

export function laplacianVariance(gray: Uint8Array, w: number, h: number): number {
  let n = 0;
  let mean = 0;
  let m2 = 0; // Welford: uma passada, sem array intermediário
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = gray[i - w] + gray[i + w] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      n++;
      const d = v - mean;
      mean += d / n;
      m2 += d * (v - mean);
    }
  }
  return n ? m2 / n : 0;
}

export function assessGray(gray: Uint8Array, w: number, h: number): Quality {
  const b = brightness(gray);
  const s = laplacianVariance(gray, w, h);
  if (b < MIN_BRIGHTNESS) return { ok: false, sharpness: s, brightness: b, issue: 'dark' };
  if (b > MAX_BRIGHTNESS) return { ok: false, sharpness: s, brightness: b, issue: 'bright' };
  if (s < MIN_SHARPNESS) return { ok: false, sharpness: s, brightness: b, issue: 'blur' };
  return { ok: true, sharpness: s, brightness: b };
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = LOOKUP[clean.charCodeAt(i)];
    const b = LOOKUP[clean.charCodeAt(i + 1)];
    const c = LOOKUP[clean.charCodeAt(i + 2)];
    const d = LOOKUP[clean.charCodeAt(i + 3)];
    out[o++] = (a << 2) | (b >> 4);
    if (i + 2 < clean.length) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < clean.length) out[o++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, o);
}
