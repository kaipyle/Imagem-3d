// Gera, para cada projeto, um arquivo único que abre offline com duplo clique
// e uma cópia sem o esqueleto <html> (dist/) para publicação como artefato.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECTS = [
  { entry: 'src/main.js', template: 'src/template.html', out: 'SafeBov-3D.html', artifact: 'dist/artifact.html' },
  { entry: 'src/bovicare.js', template: 'src/template-bovicare.html', out: 'BOVICARE-3D.html', artifact: 'dist/artifact-bovicare.html' },
];

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
for (const p of PROJECTS) {
  const res = await build({
    entryPoints: [path.join(root, p.entry)],
    bundle: true, minify: true, format: 'iife', target: 'es2020',
    legalComments: 'eof', write: false,
  });
  const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const tpl = fs.readFileSync(path.join(root, p.template), 'utf8');
  const [head, body] = tpl.split('<!--BODY-->');
  const bodyJs = body.replace('/*APP*/', () => js);
  fs.writeFileSync(path.join(root, p.artifact), head + bodyJs);
  fs.writeFileSync(path.join(root, p.out),
    '<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
    '<style>html,body{margin:0}[hidden]{display:none!important}</style>\n' +
    head + '</head>\n<body>\n' + bodyJs + '</body>\n</html>\n');
  console.log('ok', p.out, (js.length / 1024).toFixed(0) + ' KB de JS');
}
