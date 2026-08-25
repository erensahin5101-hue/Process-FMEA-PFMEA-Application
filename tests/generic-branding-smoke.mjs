import assert from 'node:assert/strict';
import { createReadStream } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Eğitim ve kaynak dokümanları bilinçli olarak kalite_dök altında saklanır. Bu test
// yalnız dağıtılan ürünün kaynaklarını, veri kütüphanelerini ve üretilmiş paketleri
// tarar; böylece tarihsel doküman kanıtlarını silmeye zorlamaz.
const runtimeRootFiles = [
  'app.js',
  'bom-domain.js',
  'build.mjs',
  'desktop-build.mjs',
  'desktop-release.mjs',
  'index.html',
  'manifest.json',
  'package.json',
  'platform-adapter.js',
  'qflow-icon.svg',
  'release-package.mjs',
  'rust-toolchain.toml',
  'seed-processes.json',
  'service-worker.js',
  'styles.css',
  'worker.template.mjs'
];
const runtimeDirectories = ['data', 'src-tauri', 'dist', 'desktop-dist', 'release-desktop'];
const ignoredDirectoryNames = new Set(['target', 'vendor', 'node_modules']);
const textExtensions = new Set([
  '.css', '.html', '.js', '.json', '.md', '.mjs', '.ps1', '.rs', '.svg', '.toml', '.ts', '.txt', '.xml', '.yaml', '.yml'
]);
const releaseBinaryExtensions = new Set(['.exe', '.msi']);

function normalizeBrandText(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replaceAll('ı', 'i')
    .toLowerCase();
}

function containsOldBrand(value) {
  // `editAs` gibi üçüncü taraf kütüphane sembolleri "ditas" alt dizisini taşıyabilir.
  // Marka yalnız sözcük/kimlik başlangıcında aranır; yol, görünen metin ve eski prefixler yine yakalanır.
  return /(?:^|[^a-z])ditas/.test(normalizeBrandText(value));
}

async function existing(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(path, files = []) {
  const metadata = await stat(path);
  if (metadata.isFile()) {
    files.push(path);
    return files;
  }
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectoryNames.has(entry.name)) continue;
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) await collectFiles(child, files);
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

async function binaryContainsOldBrand(path) {
  const containsLiteralOldBrand = value => /(?:^|[^\p{L}])dita[şs](?=$|[^\p{L}])/iu.test(
    String(value)
      .toLocaleLowerCase('tr-TR')
      .replaceAll('ı', 'i')
  );
  let tail = Buffer.alloc(0);
  for await (const chunk of createReadStream(path, { highWaterMark: 64 * 1024 })) {
    const window = tail.length ? Buffer.concat([tail, chunk]) : chunk;
    if (
      containsLiteralOldBrand(window.toString('utf8'))
      || containsLiteralOldBrand(window.toString('latin1'))
      || containsLiteralOldBrand(window.toString('utf16le'))
    ) return true;
    tail = window.subarray(Math.max(0, window.length - 64));
  }
  return false;
}

const candidates = [];
for (const file of runtimeRootFiles) {
  const path = resolve(root, file);
  if (await existing(path)) candidates.push(path);
}
for (const directory of runtimeDirectories) {
  const path = resolve(root, directory);
  if (await existing(path)) await collectFiles(path, candidates);
}

const violations = [];
for (const path of [...new Set(candidates)]) {
  const pathFromRoot = relative(root, path).replaceAll('\\', '/');
  const extension = extname(path).toLowerCase();
  const isReleaseBinary = pathFromRoot.startsWith('release-desktop/') && releaseBinaryExtensions.has(extension);
  if (!textExtensions.has(extension) && !isReleaseBinary) continue;

  if (containsOldBrand(pathFromRoot)) {
    violations.push(`${pathFromRoot} (dosya/yol adı)`);
    continue;
  }

  const oldBrandFound = isReleaseBinary
    ? await binaryContainsOldBrand(path)
    : containsOldBrand(await readFile(path, 'utf8'));
  if (oldBrandFound) {
    violations.push(pathFromRoot);
  }
}

assert.ok(candidates.length > 0, 'Marka nötrlüğü için taranacak çalışma zamanı dosyası bulunamadı');
assert.deepEqual(
  violations,
  [],
  `Eski kuruluş markası çalışma zamanı/build/release yüzeyinde kaldı:\n${violations.map(item => `- ${item}`).join('\n')}`
);

console.log(`Generic branding smoke tests passed (${candidates.length} runtime/build/release file scanned; kalite_dök excluded).`);
