import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const targetDirectory = resolve(root, 'src-tauri', 'target', 'x86_64-pc-windows-msvc', 'release', 'bundle', 'nsis');
const outputDirectory = resolve(root, 'release-desktop');

function isWithin(parent, child) {
  const value = relative(parent, child);
  return Boolean(value) && !value.startsWith('..') && !isAbsolute(value);
}

if (!isWithin(root, targetDirectory) || !isWithin(root, outputDirectory) || basename(outputDirectory) !== 'release-desktop') {
  throw new Error('Release yolu proje sınırları dışında veya güvenli değil.');
}

const candidates = (await readdir(targetDirectory, { withFileTypes: true }))
  .filter(entry => entry.isFile() && /-setup\.exe$/i.test(entry.name))
  .map(entry => resolve(targetDirectory, entry.name));
if (candidates.length !== 1) {
  throw new Error(`Tam bir NSIS installer bekleniyordu; bulunan: ${candidates.length}.`);
}

const installerName = `TYANA-Q-Flow-${packageJson.version}-x64-Setup.exe`;
const installerTarget = resolve(outputDirectory, installerName);
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await copyFile(candidates[0], installerTarget);
await copyFile(resolve(root, 'DESKTOP.md'), resolve(outputDirectory, 'KURULUM-VE-RELEASE-NOTLARI.md'));
await copyFile(resolve(root, 'RELEASE-VALIDATION.md'), resolve(outputDirectory, 'RELEASE-VALIDATION.md'));

const installerBytes = await readFile(installerTarget);
const installerStat = await stat(installerTarget);
const sha256 = createHash('sha256').update(installerBytes).digest('hex');
const signatureStatus = process.env.TYANA_SIGNING_STATUS === 'signed' ? 'signed' : 'unsigned';
const manifest = {
  schemaVersion: 1,
  product: 'TYANA Q-Flow',
  version: packageJson.version,
  platform: 'Windows',
  architecture: 'x86_64',
  installer: installerName,
  bytes: installerStat.size,
  sha256,
  signatureStatus,
  webView2: 'offline-installer-bundled',
  generatedAt: new Date().toISOString()
};

await writeFile(resolve(outputDirectory, 'SHA256SUMS.txt'), `${sha256}  ${installerName}\n`, 'utf8');
await writeFile(resolve(outputDirectory, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(manifest));
