import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [app, adapter, index, ui, domain, rust, lib, build, desktopBuild, serviceWorker, styles] = await Promise.all([
  read('app.js'), read('platform-adapter.js'), read('index.html'), read('master-template-ui.js'), read('master-template-domain.js'),
  read('src-tauri/src/data.rs'), read('src-tauri/src/lib.rs'), read('build.mjs'), read('desktop-build.mjs'), read('service-worker.js'), read('styles.css')
]);

assert.match(index, /id="productGroupMasterTemplateSlot"/, 'Ürün grubunda ana şablon slotu bulunmalı.');
assert.ok(index.indexOf('/master-template-domain.js') < index.indexOf('/platform-adapter.js'), 'Domain, veri adaptöründen önce yüklenmeli.');
assert.ok(index.indexOf('app.js') < index.indexOf('/master-template-ui.js'), 'UI, uygulama runtime köprüsünden sonra yüklenmeli.');
assert.match(app, /TyanaProjectRuntime = Object\.freeze\(\{[\s\S]*captureSnapshot:[\s\S]*applyMasterTemplate:/, 'Uygulama yalnız kontrollü snapshot köprüsü açmalı.');
assert.match(app, /currentProjectId = null; currentProjectVersion = 0;[\s\S]*applyProductTemplate\('blank'\);[\s\S]*applySnapshot\(snapshot\)/, 'Şablon yeni, bağımsız proje olarak uygulanmalı.');

for (const method of ['listMasterTemplates', 'getMasterTemplate', 'saveMasterTemplate', 'archiveMasterTemplate']) assert.match(adapter, new RegExp(`${method}:`), `${method} veri adaptöründe bulunmalı.`);
assert.match(adapter, /master_template_list/); assert.match(adapter, /master_template_get/); assert.match(adapter, /master_template_save/); assert.match(adapter, /master_template_archive/);
assert.match(adapter, /WEB_MASTER_TEMPLATE_KEY/, 'Web güvenli yedeği yerel kayıt alanına sahip olmalı.');

for (const table of ['master_templates', 'master_template_revisions']) assert.match(rust, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`), `${table} SQLite tablosu eksik.`);
assert.match(rust, /master_templates_active_name_idx[\s\S]*WHERE status = 'active'/, 'Grup + ada göre etkin şablon tekilliği bulunmalı.');
assert.match(rust, /content_sha256/); assert.match(rust, /master_template_revisions[\s\S]*PRIMARY KEY \(template_id, version\)/);
for (const command of ['master_template_list', 'master_template_get', 'master_template_save', 'master_template_archive']) {
  assert.match(rust, new RegExp(`pub[(]crate[)] fn ${command}`), `${command} Rust komutu eksik.`);
  assert.match(lib, new RegExp(command), `${command} Tauri invoke listesine eklenmeli.`);
}
assert.match(rust, /"master_template"/, 'Ana şablon değişiklikleri hash-zincirli audit kaydına yazılmalı.');
assert.match(rust, /üretilmiş doküman kayıtları ana şablona kopyalanamaz/);
assert.match(rust, /her proses adımı standart operasyon koduna bağlı olmalıdır/);

assert.match(domain, /REPLACE_ROOT_PRODUCT_IDENTITY/);
assert.match(domain, /preserveChildItemMasters: true/);
assert.match(domain, /resetApprovals: true/);
assert.match(domain, /resetGeneratedDocuments: true/);
assert.match(ui, /Bu Yapıyı Ana Şablon Kaydet/);
assert.match(ui, /Şablondan Yeni Ürün/);
assert.match(ui, /380 kodlu proses kartı bağlantıları/);
assert.match(ui, /domain\.IDENTITY_FIELDS\.map/);
assert.match(styles, /\.product-master-template-card/); assert.match(styles, /\.master-template-identity-grid/);

for (const source of [build, desktopBuild, serviceWorker]) {
  assert.match(source, /master-template-domain\.js/);
  assert.match(source, /master-template-ui\.js/);
}

console.log(JSON.stringify({ result: 'PASS master-template-runtime-smoke', persistence: 'SQLite + immutable revisions + audit', webFallback: 'localStorage', ui: 'group-scoped save/reuse with identity gate' }));
