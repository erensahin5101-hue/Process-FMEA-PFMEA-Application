import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

for (const id of ['productType', 'customProductTypeField', 'customProductTypeName', 'productFamily', 'partNumber', 'internalProductCode', 'summaryPartNo', 'summaryInternalCode']) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `${id} alanı ürün tanımlama ekranında bulunmalı.`);
}

assert.match(html, /OEM No \*/i, 'Müşteri/OEM ürün kimliği açıkça etiketlenmeli.');
assert.match(html, /Kuruluş içi ürün \/ stok kodu \*/i, 'ERP/SAP stok kodu OEM numarasından ayrı olmalı.');
assert.match(html, /Ürün ailesi \(opsiyonel\)/i, 'Ürün ailesi ileri ve opsiyonel alan olarak anlatılmalı.');
assert.match(html, /<input id="productTemplate" type="hidden" value="blank">/i, 'Başlangıç sözleşmesi yalnız sıfırdan boş kayıt olmalı.');
assert.match(html, /Sıfırdan ürün tanımı/i, 'Boş ürün başlangıcı kullanıcıya açıkça anlatılmalı.');
assert.doesNotMatch(html, /Tanıtım şablonu|Hazır Başlangıç Şablonu|HAZIR BAŞLANGIÇ OMURGASI/i, 'Gömülü hazır ürün/BOM şablonu ürün tanımlama ekranında sunulmamalı.');
assert.doesNotMatch(app, /const\s+productTemplates\s*=|steeringRodDemoComponents|steeringCharacteristicTemplate|function\s+applyBomTemplate/i, 'Gömülü demo ürün veya BOM şablonu çalıştırılabilir başlangıç yolu olmamalı.');
assert.match(app, /let components = \[\];/, 'Yeni kurulumun BOM verisi boş başlamalı.');

assert.match(app, /function syncCustomProductTypeField/, 'Özel ürün tipi görünürlüğü yönetilmeli.');
assert.match(app, /function effectiveProductTypeLabel/, 'Özel ürün tipi doküman kimliğine dönüştürülmeli.');
assert.match(app, /productFieldIds = \[[^\]]*'customProductTypeName'[^\]]*'internalProductCode'/s, 'Özel ürün tipi ve kuruluş kodu snapshot alanlarında saklanmalı.');
assert.match(app, /productTypeLabel: effectiveProductTypeLabel\(\)/, 'Snapshot etkili ürün tipi adını taşımalı.');
assert.match(app, /snapshot\.product\.internalProductCode/g, 'Kuruluş kodu doküman çıktılarında kullanılmalı.');
assert.match(app, /OEM NO \/ KURULUŞ KODU/g, 'PDF antetleri iki ürün kimliğini birlikte göstermeli.');
assert.match(app, /internalProductCode\.value\.trim\(\)/, 'Kuruluş içi stok kodu kalite kapısında doğrulanmalı.');

assert.match(styles, /\.product-classification-grid,\.product-identity-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/, 'Ürün alanları taşmayı önleyen minmax ızgara kullanmalı.');
assert.match(styles, /@media\(max-width:680px\)\{\.product-classification-grid,\.product-identity-grid\{grid-template-columns:minmax\(0,1fr\)/, 'Dar ekranda ürün alanları tek sütuna düşmeli.');

console.log('Product identity UX smoke PASS: OEM/internal-code separation, writable custom type, optional family, snapshot/export persistence, responsive grid.');
