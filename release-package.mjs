import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const tauriConfig = JSON.parse(await readFile(resolve(root, 'src-tauri', 'tauri.conf.json'), 'utf8'));
const cargoToml = await readFile(resolve(root, 'src-tauri', 'Cargo.toml'), 'utf8');
const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const localAppData = process.env.LOCALAPPDATA || resolve(homedir(), 'AppData', 'Local');
const cargoTargetRoot = process.env.CARGO_TARGET_DIR || resolve(localAppData, 'TYANA', 'QFlow', 'cargo-target');
const targetDirectory = resolve(cargoTargetRoot, 'x86_64-pc-windows-msvc', 'release', 'bundle', 'nsis');
const outputDirectory = resolve(root, 'release-desktop');
const execFileAsync = promisify(execFile);

if (!cargoVersion || packageJson.version !== cargoVersion || packageJson.version !== tauriConfig.version) {
  throw new Error(`Release sürümleri eşleşmiyor: package=${packageJson.version}, cargo=${cargoVersion || 'yok'}, tauri=${tauriConfig.version || 'yok'}.`);
}

function isWithin(parent, child) {
  const value = relative(parent, child);
  return Boolean(value) && !value.startsWith('..') && !isAbsolute(value);
}

if (!isWithin(cargoTargetRoot, targetDirectory) || !isWithin(root, outputDirectory) || basename(outputDirectory) !== 'release-desktop') {
  throw new Error('Release yolu proje sınırları dışında veya güvenli değil.');
}

const candidates = (await readdir(targetDirectory, { withFileTypes: true }))
  .filter(entry => entry.isFile() && /-setup\.exe$/i.test(entry.name) && entry.name.includes(`_${packageJson.version}_`))
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
const sourceQualityLibraryBytes = await readFile(resolve(root, 'data', 'quality-document-library.json'));
const sourceQualityLibrary = JSON.parse(sourceQualityLibraryBytes.toString('utf8'));
const sourceQualityLibrarySha256 = createHash('sha256').update(sourceQualityLibraryBytes).digest('hex');
const operationLibraryBytes = await readFile(resolve(root, 'data', 'operation-code-library.tr-en.v1.0.0.json'));
const operationLibrary = JSON.parse(operationLibraryBytes.toString('utf8'));
const operationLibrarySha256 = createHash('sha256').update(operationLibraryBytes).digest('hex');
const desktopManifestBytes = await readFile(resolve(root, 'desktop-dist', 'desktop-build-manifest.json'));
const desktopManifestSha256 = createHash('sha256').update(desktopManifestBytes).digest('hex');
const signatureCommand = `(Get-AuthenticodeSignature -LiteralPath '${installerTarget.replaceAll("'", "''")}').Status.ToString()`;
let authenticodeStatus = 'UnknownError';
try {
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', signatureCommand], { windowsHide: true });
  authenticodeStatus = stdout.trim() || authenticodeStatus;
} catch {
  authenticodeStatus = 'VerificationFailed';
}
const signatureStatus = authenticodeStatus === 'Valid' ? 'signed' : authenticodeStatus === 'NotSigned' ? 'unsigned' : 'invalid';
if (process.env.REQUIRE_SIGNED_RELEASE === '1' && signatureStatus !== 'signed') {
  throw new Error(`İmzalı release kapısı başarısız: Authenticode durumu ${authenticodeStatus}.`);
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
  version: packageJson.version,
  platform: 'Windows',
  architecture: 'x86_64',
  installer: installerName,
  bytes: installerStat.size,
  sha256,
  sourceQualityLibrary: {
    id: sourceQualityLibrary.libraryId,
    version: sourceQualityLibrary.libraryVersion,
    sha256: sourceQualityLibrarySha256
  },
  operationCodeLibrary: {
    id: operationLibrary.libraryId,
    version: operationLibrary.libraryVersion,
    entries: operationLibrary.records?.length || operationLibrary.operations?.length || 0,
    sha256: operationLibrarySha256
  },
  desktopAssetManifestSha256: desktopManifestSha256,
  licenseProfile: {
    mode: 'device-bound-full-trial-or-permanent-activation',
    durationDays: 30,
    permanentActivation: true,
    clockRollbackProtection: true,
    dualLocalAnchor: true
  },
  packageProtection: {
    devtools: false,
    sourceMaps: false,
    minifiedRuntime: true,
    engineeringLibrariesEmbeddedInNativeBinary: true
  },
  signatureStatus,
  authenticodeStatus,
  webView2: 'offline-installer-bundled',
  generatedAt: new Date().toISOString()
};

await writeFile(resolve(outputDirectory, 'SHA256SUMS.txt'), `${sha256}  ${installerName}\n`, 'utf8');
await writeFile(resolve(outputDirectory, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(manifest));
