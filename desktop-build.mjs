import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, 'desktop-dist');

if (dirname(output) !== root || basename(output) !== 'desktop-dist') {
  throw new Error('Güvenli olmayan masaüstü çıktı yolu reddedildi.');
}

const assets = [
  ['styles.css', 'styles.css'],
  ['app.js', 'app.js'],
  ['platform-adapter.js', 'platform-adapter.js'],
  ['seed-processes.json', 'seed-processes.json'],
  ['manifest.json', 'manifest.json'],
  ['qflow-icon.svg', 'qflow-icon.svg'],
  ['node_modules/pdfmake/build/pdfmake.min.js', 'vendor/pdfmake.min.js'],
  ['node_modules/pdfmake/build/vfs_fonts.js', 'vendor/vfs_fonts.js'],
  ['node_modules/exceljs/dist/exceljs.min.js', 'vendor/exceljs.min.js']
];

function isWithin(parent, child) {
  const value = relative(parent, child);
  return Boolean(value) && !value.startsWith('..') && !isAbsolute(value);
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const [sourceName, destinationName] of assets) {
  const source = resolve(root, sourceName);
  const destination = resolve(output, destinationName);
  if (!isWithin(root, source)) throw new Error(`Kaynak proje dışında: ${sourceName}`);
  if (!isWithin(output, destination)) throw new Error(`Hedef masaüstü paketinin dışında: ${destinationName}`);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

let html = await readFile(resolve(root, 'index.html'), 'utf8');
if (!html.includes('platform-adapter.js')) {
  const appScript = '<script src="app.js"></script>';
  if (!html.includes(appScript)) throw new Error('Masaüstü adaptörünün ekleneceği app.js etiketi bulunamadı.');
  html = html.replace(appScript, '<script src="platform-adapter.js"></script>\n  <script src="app.js"></script>');
}
await writeFile(resolve(output, 'index.html'), html, 'utf8');

const packagedFiles = ['index.html', ...assets.map(([, destination]) => destination)].sort();
const files = {};
for (const file of packagedFiles) {
  const path = resolve(output, file);
  const contents = await readFile(path);
  const metadata = await stat(path);
  files[file.replaceAll('\\', '/')] = {
    bytes: metadata.size,
    sha256: createHash('sha256').update(contents).digest('hex')
  };
}

const manifest = {
  schemaVersion: 1,
  product: 'TYANA OTOMOTİV Kalite Dokümantasyonu',
  files
};
await writeFile(resolve(output, 'desktop-build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`TYANA desktop assets ready: ${Object.keys(files).length} verified files.`);
