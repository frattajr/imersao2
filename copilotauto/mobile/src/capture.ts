/**
 * Pós-processamento da foto no aparelho:
 * 1. miniatura 128 px → checagem de foco/luz (sem rede);
 * 2. se passou, versão de envio (lado maior 1280 px, JPEG 80%) em base64.
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as jpeg from 'jpeg-js';

import { assessGray, base64ToBytes, Quality, THUMB, toGray } from './quality';

export async function checkQuality(uri: string): Promise<Quality> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: THUMB });
  const img = await ctx.renderAsync();
  const thumb = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.95, base64: true });
  const raw = jpeg.decode(base64ToBytes(thumb.base64 ?? ''), { useTArray: true, formatAsRGBA: true });
  return assessGray(toGray(raw.data, raw.width, raw.height), raw.width, raw.height);
}

export async function prepareUpload(uri: string, width: number, height: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > 1280) {
    ctx.resize(width >= height ? { width: 1280 } : { height: 1280 });
  }
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  return out.base64 ?? '';
}
