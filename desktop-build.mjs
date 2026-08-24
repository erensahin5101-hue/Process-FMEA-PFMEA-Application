import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, 'desktop-dist');
const generatedRustAssets = resolve(root, 'src-tauri', 'generated');
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));

if (dirname(output) !== root || basename(output) !== 'desktop-dist') {
  throw new Error('Güvenli olmayan masaüstü çıktı yolu reddedildi.');
}

const assets = [
  ['manifest.json', 'manifest.json'],
  ['qflow-icon.svg', 'qflow-icon.svg'],
  ['node_modules/pdfmake/build/pdfmake.min.js', 'vendor/pdfmake.min.js'],
  ['node_modules/pdfmake/build/vfs_fonts.js', 'vendor/vfs_fonts.js'],
  ['node_modules/exceljs/dist/exceljs.min.js', 'vendor/exceljs.min.js']
];

const runtimeSources = [
  'bom-domain.js',
  'master-template-domain.js',
  'platform-adapter.js',
  'app.js',
  'product-definition-workspace.js',
  'apqp-traceability.js',
  'fmea-governance.js',
  'master-template-ui.js',
  'guided-experience.js'
];

const embeddedAssets = [
  ['data/product-engineering-library.json', 'product-engineering.json.gz'],
  ['data/pfmea-engineering-library.json', 'pfmea-engineering.json.gz'],
  ['data/bom-engineering-library.json', 'bom-engineering.json.gz'],
  ['data/quality-document-library.json', 'quality-document.json.gz'],
  ['data/operation-code-library.tr-en.v1.0.0.json', 'operation-code.json.gz'],
  ['seed-processes.json', 'seed-processes.json.gz'],
  ['files/machines_master_seed.json', 'machines-master.json.gz']
];

function isWithin(parent, child) {
  const value = relative(parent, child);
  return Boolean(value) && !value.startsWith('..') && !isAbsolute(value);
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await mkdir(generatedRustAssets, { recursive: true });

for (const [sourceName, destinationName] of assets) {
  const source = resolve(root, sourceName);
  const destination = resolve(output, destinationName);
  if (!isWithin(root, source)) throw new Error(`Kaynak proje dışında: ${sourceName}`);
  if (!isWithin(output, destination)) throw new Error(`Hedef masaüstü paketinin dışında: ${destinationName}`);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
  if (destinationName.endsWith('.js')) {
    const javascript = await readFile(destination, 'utf8');
    await writeFile(destination, javascript.replace(/\/\/# sourceMappingURL=.*$/gm, ''), 'utf8');
  }
}

const runtimeSource = (await Promise.all(runtimeSources.map(async sourceName => {
  const source = resolve(root, sourceName);
  if (!isWithin(root, source)) throw new Error(`Çalışma zamanı kaynağı proje dışında: ${sourceName}`);
  return `\n/* ${sourceName} */\n${await readFile(source, 'utf8')}`;
}))).join('\n');
const runtimeBuild = await transform(runtimeSource, {
  loader: 'js',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  charset: 'utf8',
  sourcefile: 'qflow-runtime.js',
  sourcemap: false
});
await writeFile(resolve(output, 'qflow-runtime.min.js'), runtimeBuild.code, 'utf8');

const stylesheetBuild = await transform(await readFile(resolve(root, 'styles.css'), 'utf8'), {
  loader: 'css',
  target: 'chrome120',
  minify: true,
  legalComments: 'none',
  charset: 'utf8',
  sourcefile: 'styles.css',
  sourcemap: false
});
await writeFile(resolve(output, 'styles.css'), stylesheetBuild.code, 'utf8');
await copyFile(resolve(root, 'product-universe.css'), resolve(output, 'product-universe.css'));
await copyFile(resolve(root, 'operator-instruction.css'), resolve(output, 'operator-instruction.css'));

for (const [sourceName, destinationName] of embeddedAssets) {
  const source = resolve(root, sourceName);
  const destination = resolve(generatedRustAssets, destinationName);
  if (!isWithin(root, source) || !isWithin(generatedRustAssets, destination)) {
    throw new Error(`Gömülü kütüphane yolu güvenli değil: ${sourceName}`);
  }
  const compressed = gzipSync(await readFile(source), { level: 9 });
  await writeFile(destination, compressed);
}

let html = await readFile(resolve(root, 'index.html'), 'utf8');
const runtimeTags = [
  '<script src="/bom-domain.js"></script>',
  '<script src="/master-template-domain.js"></script>',
  '<script src="/platform-adapter.js"></script>',
  '<script src="app.js"></script>',
  '<script src="/product-definition-workspace.js"></script>',
  '<script src="/apqp-traceability.js"></script>',
  '<script src="/fmea-governance.js"></script>',
  '<script src="/master-template-ui.js"></script>',
  '<script src="/guided-experience.js"></script>'
];
for (const tag of runtimeTags) {
  if (!html.includes(tag)) throw new Error(`Masaüstü çalışma zamanı etiketi bulunamadı: ${tag}`);
}
html = html.replace(runtimeTags[0], '<script src="/qflow-runtime.min.js"></script>');
for (const tag of runtimeTags.slice(1)) html = html.replace(tag, '');
html = html.replaceAll(/<!--[\s\S]*?-->/g, '').replaceAll(/>\s+</g, '><').trim();
await writeFile(resolve(output, 'index.html'), html, 'utf8');

const packagedFiles = ['index.html', 'styles.css', 'product-universe.css', 'operator-instruction.css', 'qflow-runtime.min.js', ...assets.map(([, destination]) => destination)].sort();
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
  product: 'TYANA Q-FLOW',
  installationProfile: {
    id: 'tyana-qflow-default',
    displayName: 'Genel Kurulum Profili',
    organization: 'Kullanıcı Tanımlı Kuruluş',
    plant: 'Kullanıcı Tanımlı Tesis'
  },
  sourceLibraries: {
    qualityDocumentReference: 'native:quality-document',
    operationCodeLibrary: 'native:operation-code'
  },
  protection: {
    runtimeBundle: 'qflow-runtime.min.js',
    sourceMaps: false,
    embeddedLibraries: embeddedAssets.length,
    rawEngineeringLibrariesPackaged: false
  },
  version: packageJson.version,
  files
};
await writeFile(resolve(output, 'desktop-build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`TYANA desktop assets ready: ${Object.keys(files).length} verified files.`);
