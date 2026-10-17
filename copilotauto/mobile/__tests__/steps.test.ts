import { readFileSync } from 'fs';
import { join } from 'path';

import { STEPS } from '../src/steps';
import { TERMS_VERSION } from '../src/terms';

const backend = (f: string) => readFileSync(join(__dirname, '../../backend/app', f), 'utf8');

test('todo componente do app existe no catálogo do servidor', () => {
  const ids = [...backend('catalog.py').matchAll(/id="([a-z_]+)"/g)].map((m) => m[1]);
  expect(new Set(STEPS.map((s) => s.componentId))).toEqual(new Set(ids));
});

test('versão dos termos igual à do servidor', () => {
  expect(backend('prompts.py')).toContain(`TERMS_VERSION = "${TERMS_VERSION}"`);
});

test('20 fotos: 4 pneus × (DOT + banda)', () => {
  expect(STEPS).toHaveLength(20);
  expect(STEPS.filter((s) => s.module === 'tires')).toHaveLength(8);
});
