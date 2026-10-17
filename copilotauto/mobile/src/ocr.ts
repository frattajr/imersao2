/**
 * Leitura de texto no aparelho (ML Kit) e interpretação dos campos.
 *
 * Os parsers são puros e testados; `recognizeText` só existe no build nativo
 * (o ML Kit não roda no Expo Go — use `npx expo run:android|ios`).
 */

/** DOT: últimos 4 dígitos = semana (01–53) + ano (2 dígitos). */
export function parseDot(text: string, today = new Date()): { week: number; year: number } | null {
  const cleaned = text.toUpperCase().replace(/O/g, '0').replace(/\s+/g, '');
  const re = /(?<!\d)(\d{2})(\d{2})(?!\d)/g;
  let found: { week: number; year: number } | null = null;
  for (const m of cleaned.matchAll(re)) {
    const week = Number(m[1]);
    const year = 2000 + Number(m[2]);
    if (week < 1 || week > 53 || year > today.getFullYear()) continue;
    found = { week, year };
  }
  return found;
}

/** Placa antiga (ABC-1234) ou Mercosul (ABC1D23). Devolve sem hífen. */
export function parsePlate(text: string): string | null {
  const t = text.toUpperCase().replace(/[^A-Z0-9]/g, ' ');
  const m = t.match(/\b([A-Z]{3})\s?(\d[A-Z0-9]\d{2})\b/);
  return m ? m[1] + m[2] : null;
}

/** Chassi (VIN): 17 caracteres, sem I, O e Q. */
export function parseVin(text: string): string | null {
  const t = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = t.match(/[A-HJ-NPR-Z0-9]{17}/);
  return m ? m[0] : null;
}

/** Maior número plausível de quilometragem (3 a 7 dígitos). */
export function parseOdometer(text: string): number | null {
  let best: number | null = null;
  for (const m of text.matchAll(/\d[\d.\s]{1,8}\d/g)) {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length >= 3 && digits.length <= 7) {
      const km = Number(digits);
      if (best === null || km > best) best = km;
    }
  }
  return best;
}

export async function recognizeText(uri: string): Promise<string> {
  try {
    // Import dinâmico: no Expo Go / web o módulo nativo não existe.
    const mod = await import('@react-native-ml-kit/text-recognition');
    const result = await mod.default.recognize(uri);
    return result.text ?? '';
  } catch {
    return '';
  }
}
