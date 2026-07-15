import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = new URL('.', import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, '$1');
const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/seed-processes.json': ['seed-processes.json', 'application/json; charset=utf-8'],
  '/manifest.json': ['manifest.json', 'application/manifest+json; charset=utf-8'],
  '/qflow-icon.svg': ['qflow-icon.svg', 'image/svg+xml; charset=utf-8'],
  '/service-worker.js': ['service-worker.js', 'text/javascript; charset=utf-8'],
  '/vendor/pdfmake.min.js': ['node_modules/pdfmake/build/pdfmake.min.js', 'text/javascript; charset=utf-8'],
  '/vendor/vfs_fonts.js': ['node_modules/pdfmake/build/vfs_fonts.js', 'text/javascript; charset=utf-8'],
  '/vendor/exceljs.min.js': ['node_modules/exceljs/dist/exceljs.min.js', 'text/javascript; charset=utf-8']
};

const assets = {};
for (const [pathname, [file, contentType]] of Object.entries(files)) {
  assets[pathname] = { contentType, body: await readFile(resolve(root, file), 'utf8') };
}

const processSeed = JSON.parse(await readFile(resolve(root, 'seed-processes.json'), 'utf8'));
const template = await readFile(resolve(root, 'worker.template.mjs'), 'utf8');
const worker = template
  .replace('__ASSETS__', JSON.stringify(assets))
  .replace('__PROCESS_SEED__', JSON.stringify(processSeed));

const output = resolve(root, 'dist', 'server');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'index.js'), worker, 'utf8');
console.log(`Q-Flow build ready: ${Object.keys(assets).length} web routes.`);
