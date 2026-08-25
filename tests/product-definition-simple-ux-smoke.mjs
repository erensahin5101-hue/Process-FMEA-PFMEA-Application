import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

const productStart = html.match(/<fieldset class="product-origin-card">[\s\S]*?<\/fieldset>/)?.[0] || '';
const productView = html.match(/<section id="product"[\s\S]*?<section id="flow"/)?.[0] || '';
assert.ok(productStart, 'Sıfırdan ürün tanımlama alanı bulunmalı.');
assert.match(productStart, /id="productTemplate" type="hidden" value="blank"/i, 'Tek başlangıç yolu blank olmalı.');
assert.doesNotMatch(productStart, /steering_rod|machined_component|welded_assembly|Tanıtım şablonu/i, 'Gömülü demo ürün seçeneği bulunmamalı.');

for (const [value, label] of [
  ['assembly', 'Komple mamul / montaj'],
  ['subassembly', 'Yarı mamul / alt montaj'],
  ['single_part', 'Tek parça mamul'],
  ['service_kit', 'Servis kiti / paket']
]) {
  assert.match(productStart, new RegExp(`<option value="${value}"[^>]*>${label.replace('/', '\\/')}</option>`, 'i'), `${label} ürün seviyesi seçilebilmeli.`);
}

assert.match(html, /id="productFlowScopeHint"[^>]*aria-live="polite"/i, 'Ürün seviyesinin proses akışı etkisi canlı açıklanmalı.');
assert.match(html, /id="productGroupMasterTemplateSlot"/i, 'Doğrulanmış ürün grubu ana şablonu için ayrılmış entegrasyon slotu bulunmalı.');
assert.match(html, /class="product-common-performance"[\s\S]*?class="form-grid performance-essential-grid"/i, 'Ortak performans şartları sade temel alanlarla başlamalı.');
assert.match(html, /class="performance-advanced"[\s\S]*?id="heatTreatment"[\s\S]*?id="coatingType"/i, 'Isıl işlem ve kaplama yalnız ileri ortak şartlarda bulunmalı.');
assert.doesNotMatch(productView, /name="forming"[^>]*checked|value="heat"[^>]*checked|value="coating"[^>]*checked/i, 'Yeni ürün üretim yöntemi veya özel proses seçilmiş başlamamalı.');
assert.match(productView, /name="safety" value="unknown" checked/i, 'Emniyet sınıfı doğrulanana kadar belirsiz başlamalı.');
assert.match(productView, /id="summaryProcessCount">0</i, 'Canlı özette seçili proses sayısı sıfır başlamalı.');
assert.doesNotMatch(productView, /OEM-RK|STK-RK|ROT KOLU KOMPLE/i, 'Ürün formu demo rot kolu kimliği taşımamalı.');

assert.match(app, /const productLevelProfiles = Object\.freeze\(\{[\s\S]*?assembly:[\s\S]*?subassembly:[\s\S]*?single_part:[\s\S]*?service_kit:/, 'Her ürün seviyesi için açık proses kapsamı profili bulunmalı.');
assert.match(app, /function syncProductLevelContext\(\)/, 'Ürün seviyesi açıklaması ve teknik kapsam senkronlanmalı.');
assert.match(app, /function requireSelectedProcessRoute\([\s\S]*?Sistem rotayı kendiliğinden doldurmaz/, 'Boş rota otomatik doldurulmamalı; kullanıcı seçimine yönlendirilmelidir.');
assert.doesNotMatch(app, /selected\s*=\s*\[\.\.\.activeBackbone\(\)\.processes\]/, 'Hiçbir doküman akışı ürün grubu rotasını sessizce seçmemeli.');
assert.match(app, /\['assembly', 'subassembly', 'service_kit'\]\.includes\(structure\)/, 'BOM zorunluluğu komple mamul, yarı mamul ve servis kitinde uygulanmalı.');

assert.match(styles, /\.blank-product-start\{display:grid;grid-template-columns:40px minmax\(0,1fr\) auto/, 'Sıfırdan başlangıç kartı taşmayan grid kullanmalı.');
assert.match(styles, /\.performance-essential-grid\{grid-template-columns:repeat\(4,minmax\(0,1fr\)/, 'Temel performans alanları geniş ekranda düzenli olmalı.');
assert.match(styles, /@media\(max-width:680px\)[^{]*\{[\s\S]*?\.performance-essential-grid\{grid-template-columns:minmax\(0,1fr\)/, 'Dar ekranda ortak performans alanları tek sütuna düşmeli.');

console.log('Product definition simple UX smoke PASS: blank-only start, four product levels, explicit route scope, no silent route, compact performance conditions, responsive layout.');
