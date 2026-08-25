import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const [appSource, domainSource] = await Promise.all([
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../bom-domain.js', import.meta.url), 'utf8')
]);

const context = vm.createContext({ console, crypto: globalThis.crypto, structuredClone, setTimeout, clearTimeout });
vm.runInContext(domainSource, context, { filename: 'bom-domain.js' });
const Bom = context.TyanaBom;

for (const field of ['inputState', 'upstreamMethod', 'primaryManufacturingMethod', 'outputState']) {
  assert.match(appSource, new RegExp(`<select data-master-field=["']${field}["']`), `${field} malzeme kartında seçilebilir olmalı.`);
}
assert.match(appSource, /data-master-field="manufacturingRouteNotes"/, 'Üretim rota notu malzeme kartında yazılabilir olmalı.');
assert.match(appSource, /componentInputStateOptions, master\.inputState/, 'Giriş durumu ortak seçenek kütüphanesini kullanmalı.');
assert.match(appSource, /manufacturingMethodOptions, master\.upstreamMethod/, 'Kaynak yöntem ortak seçenek kütüphanesini kullanmalı.');
assert.match(appSource, /manufacturingMethodOptions, master\.primaryManufacturingMethod/, 'Ana yöntem ortak seçenek kütüphanesini kullanmalı.');
assert.match(appSource, /componentOutputStateOptions, master\.outputState/, 'Çıkış durumu ortak seçenek kütüphanesini kullanmalı.');

const state = {
  inputState: 'Dövme taslak',
  upstreamMethod: 'Sıcak dövme',
  primaryManufacturingMethod: 'Talaşlı imalat',
  outputState: 'İşlenmiş parça',
  manufacturingRouteNotes: 'Dövme taslak kabulü → CNC işleme → yıkama → son kontrol'
};
const itemMasters = Bom.normalizeItemMasters([
  { id: 'MAT-FG', internalCode: 'FG-001', name: 'Ana mamul', description: 'Ana mamul', itemType: 'FINISHED_GOOD', revision: 'A', procurementType: 'MAKE' },
  { id: 'MAT-GOVDE', internalCode: 'GVD-010', name: 'İşlenmiş gövde', description: 'İşlenmiş gövde', itemType: 'MANUFACTURED_PART', revision: 'A', procurementType: 'MAKE', ...state }
]);
const bomDefinitions = Bom.normalizeBomDefinitions([{
  id: 'BOM-FG-A', bomNo: 'BOM-FG-001', headerItemMasterId: 'MAT-FG', revision: 'A', alternative: '01',
  lines: [{ id: 'LINE-10', position: '10', itemMasterId: 'MAT-GOVDE', quantity: 1, uom: 'adet', referencedRevision: 'A' }]
}]);
const masterById = new Map(itemMasters.map(master => [master.id, master]));
const projected = Bom.toLegacyComponents('MAT-FG', itemMasters, bomDefinitions).map(row => {
  const master = masterById.get(row.itemMasterId);
  return Bom.normalizeComponent({
    ...master, ...row,
    inputState: master.inputState || row.inputState,
    upstreamMethod: master.upstreamMethod || row.upstreamMethod,
    primaryManufacturingMethod: master.primaryManufacturingMethod || row.primaryManufacturingMethod,
    outputState: master.outputState || row.outputState,
    manufacturingRouteNotes: master.manufacturingRouteNotes || row.manufacturingRouteNotes
  });
});
assert.equal(projected.length, 1);
for (const [field, expected] of Object.entries(state)) assert.equal(projected[0][field], expected, `${field} master→BOM projeksiyonunda korunmalı.`);

const snapshot = JSON.parse(JSON.stringify({ engineeringUniverse: { rootItemMasterId: 'MAT-FG', itemMasters, bomDefinitions }, components: projected }));
for (const [field, expected] of Object.entries(state)) {
  assert.equal(snapshot.engineeringUniverse.itemMasters.find(master => master.id === 'MAT-GOVDE')[field], expected, `${field} snapshot ana verisinde korunmalı.`);
  assert.equal(snapshot.components[0][field], expected, `${field} snapshot BOM projeksiyonunda korunmalı.`);
}

assert.match(appSource, /itemMasters: jsonClone\(engineeringUniverse\.itemMasters\)/, 'Snapshot gerçek item-master kayıtlarını yazmalı.');
assert.match(appSource, /itemMasters: normalizeEngineeringItemMasters\(stored\.itemMasters\)/, 'Snapshot geri yükleme üretim durumu normalizasyonunu kullanmalı.');
assert.match(appSource, /inputState: master\.inputState \|\| row\.inputState[\s\S]*upstreamMethod: master\.upstreamMethod \|\| row\.upstreamMethod[\s\S]*primaryManufacturingMethod: master\.primaryManufacturingMethod \|\| row\.primaryManufacturingMethod[\s\S]*outputState: master\.outputState \|\| row\.outputState[\s\S]*manufacturingRouteNotes: master\.manufacturingRouteNotes \|\| row\.manufacturingRouteNotes/, 'Gerçek BOM projeksiyonu beş üretim durumu alanını master karttan aktarmalı.');
assert.match(appSource, /'Giriş Durumu'[\s\S]*'Önceki \/ Kaynak Yöntem'[\s\S]*'Ana Dönüşüm Yöntemi'[\s\S]*'Çıkış Durumu'[\s\S]*'Bileşen Proses Omurgası'/, 'Excel BOM başlık sözleşmesi beş üretim alanını içermeli.');
assert.match(appSource, /bomRows\.forEach\(item => bomSheet\.addRow\(\[[\s\S]*?item\.inputState, item\.upstreamMethod, item\.primaryManufacturingMethod, item\.outputState, item\.manufacturingRouteNotes/, 'Gerçek Excel dışa aktarıcısı beş üretim alanını satıra yazmalı.');

console.log(JSON.stringify({ result: 'PASS item-master-production-state-smoke', chain: 'Dövme taslak → Talaşlı imalat → İşlenmiş parça', masterToBom: true, snapshotRoundTrip: true, exporterContract: true }));
