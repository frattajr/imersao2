// Gera dist/preview.html: um único arquivo com CSS e JS embutidos, sem
// <html>/<head>/<body> (o visualizador de Artifacts adiciona o esqueleto).
// Uso: npm run build && node scripts/build-preview.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const assets = join('dist', 'assets');
const files = readdirSync(assets);
const read = (ext) => files.filter((f) => f.endsWith(ext)).map((f) => readFileSync(join(assets, f), 'utf8')).join('\n');

const css = read('.css').replace(/<\/style/gi, '<\\/style');
const js = read('.js').replace(/<\/script/gi, '<\\/script');

const html = `<title>CarreiraLuz</title>
<meta name="description" content="Entenda o que precisa saber para crescer na sua carreira.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;
writeFileSync(join('dist', 'preview.html'), html);
console.log(`dist/preview.html: ${(html.length / 1024).toFixed(0)} KB`);
