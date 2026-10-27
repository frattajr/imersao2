import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa: o build abre em qualquer subpasta (GitHub Pages, servidor estático).
export default defineConfig({
  base: './',
  plugins: [react()],
});
