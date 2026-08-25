import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [html, app, workspace, styles, adapter, rustLib, trial, embedded, tauriConfig, desktopBuild] = await Promise.all([
  read('index.html'),
  read('app.js'),
  read('product-definition-workspace.js'),
  read('styles.css'),
  read('platform-adapter.js'),
  read('src-tauri/src/lib.rs'),
  read('src-tauri/src/trial.rs'),
  read('src-tauri/src/embedded_assets.rs'),
  read('src-tauri/tauri.conf.json'),
  read('desktop-build.mjs')
]);

for (const id of [
  'productUpgradeCockpit',
  'upgradeIdentityMetric',
  'upgradeMasterMetric',
  'upgradeBomMetric',
  'upgradeRouteMetric',
  'upgradeCharacteristicMetric',
  'bulkItemMasterDialog',
  'trialLockOverlay',
  'trialStatusBadge'
]) assert.match(html, new RegExp(`id="${id}"`), `${id} arayüz öğesi bulunmalı.`);

assert.match(html, /data-action="add-selected-bom-masters"/);
assert.match(html, /data-action="preview-bulk-item-masters"/);
assert.match(html, /data-action="apply-bulk-item-masters"/);
assert.match(html, /TAM KAPSAM/);
assert.match(app, /function parseBulkItemMasters/);
assert.match(app, /function addSelectedEngineeringBomLines/);
assert.match(app, /function renderProductUpgradeCockpit/);
assert.match(app, /function completeProductDocumentCodes/);
assert.match(app, /function startTrialMonitor/);
assert.match(app, /TyanaProductRoutingContext/);
assert.match(workspace, /function applyRecommendedRouting/);
assert.match(workspace, /function copyRoutingFromMaster/);
assert.match(workspace, /TyanaProductRoutingContext/);
assert.match(workspace, /data-item-route-recommend/);
assert.match(workspace, /data-item-route-copy/);
assert.match(styles, /\.product-upgrade-cockpit/);
assert.match(styles, /\.item-route-accelerator/);
assert.match(styles, /\.bom-drag-choice/);

assert.match(adapter, /library_asset_get/);
assert.match(adapter, /license_status/);
for (const command of ['license_status', 'library_asset_get']) assert.match(rustLib, new RegExp(`\\b${command},`));
for (const marker of ['TRIAL_DAYS: i64 = 30', 'MachineGuid', 'RuntimeEntitlement', 'CLOCK_ROLLBACK_TOLERANCE_SECONDS', 'ensure_active']) assert.match(trial, new RegExp(marker));
assert.match(trial, /signed_record_detects_content_change/);
assert.match(trial, /full_features_are_available_until_day_thirty/);
assert.match(trial, /clock_rollback_locks_the_trial/);
assert.match(embedded, /public_asset_gate_does_not_expose_internal_seeds/);

const config = JSON.parse(tauriConfig);
assert.equal(config.app.windows[0].devtools, false);
assert.equal(config.app.security.assetProtocol.enable, false);
assert.deepEqual(config.bundle.targets, ['nsis']);
assert.match(desktopBuild, /qflow-runtime\.min\.js/);
assert.match(desktopBuild, /sourcemap: false/);
assert.match(desktopBuild, /gzipSync/);

const desktopFiles = await readdir(new URL('../desktop-dist/', import.meta.url), { recursive: true });
for (const forbidden of [
  'app.js',
  'bom-domain.js',
  'product-definition-workspace.js',
  'apqp-traceability.js',
  'fmea-governance.js',
  'seed-processes.json',
  'product-engineering-library.json',
  'operation-code-library.tr-en.v1.0.0.json'
]) assert.ok(!desktopFiles.some(file => file.replaceAll('\\', '/').endsWith(forbidden)), `${forbidden} ham biçimde masaüstü paketine girmemeli.`);
for (const required of ['index.html', 'styles.css', 'qflow-runtime.min.js', 'desktop-build-manifest.json']) {
  await access(new URL(`../desktop-dist/${required}`, import.meta.url));
}
for (const generated of [
  'product-engineering.json.gz',
  'pfmea-engineering.json.gz',
  'bom-engineering.json.gz',
  'quality-document.json.gz',
  'operation-code.json.gz',
  'seed-processes.json.gz',
  'machines-master.json.gz'
]) await access(new URL(`../src-tauri/generated/${generated}`, import.meta.url));

console.log(JSON.stringify({
  result: 'PASS product-upgrade-license-smoke',
  productDefinition: 'full-scope cockpit + bulk item/BOM + smart/copy routing',
  trial: '30-day device-bound dual-anchor gate',
  package: 'minified runtime + native compressed libraries + no source maps'
}));
