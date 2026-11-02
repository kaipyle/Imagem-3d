// Gera: SafeBov-3D.html (arquivo único, abre offline com duplo clique)
//       dist/artifact.html (mesma página, sem o esqueleto <html>, para publicação)
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = await build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true, minify: true, format: 'iife', target: 'es2020',
  legalComments: 'eof', write: false,
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = fs.readFileSync(path.join(root, 'src/template.html'), 'utf8');
const [head, body] = tpl.split('<!--BODY-->');
const bodyJs = body.replace('/*APP*/', () => js);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/artifact.html'), head + bodyJs);
fs.writeFileSync(path.join(root, 'SafeBov-3D.html'),
  '<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  '<style>html,body{margin:0}[hidden]{display:none!important}</style>\n' +
  head + '</head>\n<body>\n' + bodyJs + '</body>\n</html>\n');
console.log('ok', (js.length / 1024).toFixed(0) + ' KB de JS');
