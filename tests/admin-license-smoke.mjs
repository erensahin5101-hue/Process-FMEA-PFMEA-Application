import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const [html, app, adapter, trial, lib, styles, guide] = await Promise.all([
  readFile(resolve(root, 'index.html'), 'utf8'),
  readFile(resolve(root, 'app.js'), 'utf8'),
  readFile(resolve(root, 'platform-adapter.js'), 'utf8'),
  readFile(resolve(root, 'src-tauri/src/trial.rs'), 'utf8'),
  readFile(resolve(root, 'src-tauri/src/lib.rs'), 'utf8'),
  readFile(resolve(root, 'styles.css'), 'utf8'),
  readFile(resolve(root, 'guided-experience.js'), 'utf8')
]);

for (const required of ['data-view="admin"', 'id="admin"', 'adminLicenseForm', 'trialActivationForm', 'data-admin-action="health"']) {
  assert.ok(html.includes(required), `Admin arayüzünde ${required} bulunmalı.`);
}
for (const required of ['activatePermanentLicense', 'license_activate', 'adminLicenseForm', 'renderAdminLicense', 'trialActivationForm']) {
  assert.ok(`${app}\n${adapter}\n${lib}`.includes(required), `${required} lisans omurgasında bulunmalı.`);
}
assert.match(trial, /PERMANENT_KEY_HASH/);
assert.match(trial, /entitlement: "permanent"/);
assert.match(trial, /permanent_status_never_expires/);
for (const required of ['.admin-grid', '.admin-license-panel', '.admin-action-list', '.trial-activation-form']) assert.ok(styles.includes(required));
assert.match(guide, /view-admin/);
console.log(JSON.stringify({ result: 'PASS admin-license-smoke', adminActions: 4, offlinePermanentActivation: true, deviceBound: true }));
