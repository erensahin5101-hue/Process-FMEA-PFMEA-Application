import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const [domainSource, operationLibraryText] = await Promise.all([
  readFile(new URL('../bom-domain.js', import.meta.url), 'utf8'),
  readFile(new URL('../data/operation-code-library.tr-en.v1.0.0.json', import.meta.url), 'utf8')
]);
const operationLibrary = JSON.parse(operationLibraryText);
const context = vm.createContext({
  console,
  crypto: globalThis.crypto,
  structuredClone,
  TextEncoder,
  TextDecoder,
  setTimeout,
  clearTimeout
});
vm.runInContext(domainSource, context, { filename: 'bom-domain.js' });
const Bom = context.TyanaBom;

const operationCode = operationLibrary.operations[0].code;
const operationCodes = operationLibrary.operations.map(operation => operation.code);

function card(overrides = {}) {
  return {
    id: 'MAT-DEFAULT',
    internalCode: 'INT-DEFAULT',
    oemNo: '',
    name: 'Varsayılan kart',
    description: 'Varsayılan kart açıklaması',
    itemType: 'MANUFACTURED_PART',
    revision: 'A',
    uom: 'adet',
    procurementType: 'MAKE',
    validationStatus: 'APPROVED',
    ...overrides
  };
}

// Aşama 1: Ana mamul dahil bütün malzeme/ürün kartları önce oluşturulur.
const itemMasters = Bom.normalizeItemMasters([
  card({ id: 'MAT-FG', internalCode: 'INT-FG-001', oemNo: 'OEM-FG-7788', name: 'Ana Mamul', description: 'Yeni ana ürün', itemType: 'FINISHED_GOOD' }),
  card({ id: 'MAT-SA', internalCode: 'INT-SA-010', oemNo: 'OEM-SA-10', name: 'Alt Montaj', description: 'Kendi BOM’u olan alt montaj', itemType: 'SUBASSEMBLY' }),
  card({ id: 'MAT-PART', internalCode: 'INT-PRT-020', oemNo: '', name: 'İşlenmiş Parça', description: 'Alt montajın işlenmiş parçası' }),
  card({ id: 'MAT-RAW', internalCode: 'INT-RAW-030', oemNo: '', name: 'Hammadde Taslağı', description: 'İşlenmiş parçanın hammaddesi', itemType: 'RAW_MATERIAL', procurementType: 'BUY' })
]);
assert.equal(Bom.validateItemMasters(itemMasters, { requireApproved: true }).length, 0);
assert.equal(itemMasters[0].internalCode, 'INT-FG-001', 'İç stok kodu kartın ana kimlik kodu olmalı.');
assert.equal(itemMasters[0].oemNo, 'OEM-FG-7788', 'OEM numarası ayrı ve ikincil tanımlayıcı olarak korunmalı.');
assert.notEqual(itemMasters[0].internalCode, itemMasters[0].oemNo);

const duplicateInternalCode = itemMasters.map(master => ({ ...master }));
duplicateInternalCode[1].internalCode = itemMasters[0].internalCode;
assert.ok(Bom.validateItemMasters(duplicateInternalCode).some(finding => finding.code === 'DUPLICATE_INTERNAL_CODE'));

// Aşama 2 negatif kapısı: kütüphanede olmayan karta BOM satırı açılamaz.
const undefinedCardBom = Bom.normalizeBomDefinition({
  id: 'BOM-INVALID',
  headerItemMasterId: 'MAT-FG',
  revision: 'A',
  alternative: '01',
  status: 'APPROVED',
  lines: [{ id: 'L-INVALID-10', position: '10', itemMasterId: 'MAT-UNDEFINED', quantity: 1, uom: 'adet' }]
});
assert.ok(Bom.validateBomDefinitions([undefinedCardBom], itemMasters).some(finding => finding.code === 'UNKNOWN_BOM_LINE_MASTER'));

// Geçerli üst BOM, alt montaj BOM’u ve üretilen parçanın alt BOM’u.
const bomDefinitions = Bom.normalizeBomDefinitions([
  {
    id: 'BOM-FG-A',
    bomNo: 'BOM-INT-FG-001',
    headerItemMasterId: 'MAT-FG',
    revision: 'A',
    alternative: '01',
    status: 'APPROVED',
    baseQuantity: 1,
    uom: 'adet',
    effectiveFrom: '2026-01-01',
    lines: [{
      id: 'L-FG-10',
      position: '10',
      itemMasterId: 'MAT-SA',
      quantity: 1,
      uom: 'adet',
      referencedRevision: 'A',
      assemblyOperationCode: operationCode
    }]
  },
  {
    id: 'BOM-SA-A',
    bomNo: 'BOM-INT-SA-010',
    headerItemMasterId: 'MAT-SA',
    revision: 'A',
    alternative: '01',
    status: 'APPROVED',
    baseQuantity: 1,
    uom: 'adet',
    lines: [{
      id: 'L-SA-10',
      position: '10',
      itemMasterId: 'MAT-PART',
      quantity: 2,
      uom: 'adet',
      referencedRevision: 'A',
      assemblyOperationCode: operationCode
    }]
  },
  {
    id: 'BOM-PART-A',
    bomNo: 'BOM-INT-PRT-020',
    headerItemMasterId: 'MAT-PART',
    revision: 'A',
    alternative: '01',
    status: 'APPROVED',
    baseQuantity: 1,
    uom: 'adet',
    lines: [{
      id: 'L-PART-10',
      position: '10',
      itemMasterId: 'MAT-RAW',
      quantity: 0.75,
      uom: 'kg',
      referencedRevision: 'A',
      effectiveFrom: '2027-01-01',
      assemblyOperationCode: operationCode
    }]
  }
]);

const firstLine = bomDefinitions[0].lines[0];
assert.equal(firstLine.itemMasterId, 'MAT-SA');
assert.equal(firstLine.internalCode, undefined, 'BOM satırı stok kodunu kopyalamamalı; yalnız itemMasterId referansı taşımalı.');
assert.equal(firstLine.oemNo, undefined, 'BOM satırı OEM numarasını kopyalamamalı; karttan çözümlemeli.');
assert.equal(itemMasters.find(master => master.id === firstLine.itemMasterId).internalCode, 'INT-SA-010');

const bomFindings = Bom.validateBomDefinitions(bomDefinitions, itemMasters, {
  requireApproved: true,
  operationCodes,
  asOfDate: '2026-07-18'
});
assert.equal(bomFindings.length, 0, `Geçerli iki aşamalı BOM bulgu üretmemeli: ${bomFindings.map(finding => finding.code).join(', ')}`);

const invalidOperation = structuredClone(bomDefinitions);
invalidOperation[0].lines[0].assemblyOperationCode = 'NOT-IN-380-CODE-LIBRARY';
assert.ok(Bom.validateBomDefinitions(invalidOperation, itemMasters, { operationCodes }).some(finding => finding.code === 'UNKNOWN_ASSEMBLY_OPERATION_CODE'));

const beforeEffectivity = Bom.explodeBom('MAT-FG', itemMasters, bomDefinitions, { asOfDate: '2026-07-18' });
assert.deepEqual([...beforeEffectivity.map(row => row.itemMasterId)], ['MAT-SA', 'MAT-PART']);
assert.deepEqual([...beforeEffectivity.map(row => row.level)], [1, 2]);
assert.equal(beforeEffectivity.find(row => row.itemMasterId === 'MAT-PART').cumulativeQuantity, 2);
assert.ok(!beforeEffectivity.some(row => row.itemMasterId === 'MAT-RAW'));

const afterEffectivity = Bom.explodeBom('MAT-FG', itemMasters, bomDefinitions, { asOfDate: '2027-02-01' });
assert.deepEqual([...afterEffectivity.map(row => row.itemMasterId)], ['MAT-SA', 'MAT-PART', 'MAT-RAW']);
assert.deepEqual([...afterEffectivity.map(row => row.level)], [1, 2, 3]);
assert.equal(afterEffectivity.find(row => row.itemMasterId === 'MAT-RAW').cumulativeQuantity, 1.5);
assert.equal(afterEffectivity[0].oemNo, 'OEM-SA-10', 'Patlatılmış görünüm OEM değerini referans karttan çözmeli.');

// Mevcut ekranların flat components modeline kayıpsız projeksiyon.
const legacyProjection = Bom.toLegacyComponents('MAT-FG', itemMasters, bomDefinitions, { asOfDate: '2027-02-01' });
assert.equal(legacyProjection.length, 3);
assert.equal(legacyProjection[0].partMasterId, 'MAT-SA');
assert.equal(legacyProjection[0].itemNo, 'INT-SA-010');
assert.equal(legacyProjection[0].oemNo, 'OEM-SA-10');
assert.equal(legacyProjection[1].parentId, legacyProjection[0].id);

// Gerçek uygulama snapshot sözleşmesi JSON kaydet/yükle turunda korunmalı.
const snapshot = {
  schemaVersion: '2.0.0',
  engineeringUniverse: {
    schemaVersion: '2.0.0',
    architecture: 'ITEM_MASTER_THEN_BOM',
    rootItemMasterId: 'MAT-FG',
    itemMasters,
    bomDefinitions
  },
  components: legacyProjection
};
const restored = JSON.parse(JSON.stringify(snapshot));
assert.equal(restored.engineeringUniverse.rootItemMasterId, 'MAT-FG');
assert.equal(restored.engineeringUniverse.itemMasters.find(master => master.id === 'MAT-FG').internalCode, 'INT-FG-001');
assert.equal(restored.engineeringUniverse.itemMasters.find(master => master.id === 'MAT-FG').oemNo, 'OEM-FG-7788');
assert.equal(restored.engineeringUniverse.bomDefinitions[0].lines[0].assemblyOperationCode, operationCode);
assert.equal(Bom.validateEngineeringUniverse(restored.engineeringUniverse, { requireApproved: true, operationCodes }).errors.length, 0);
assert.equal(Bom.explodeBom(
  restored.engineeringUniverse.rootItemMasterId,
  restored.engineeringUniverse.itemMasters,
  restored.engineeringUniverse.bomDefinitions,
  { asOfDate: '2027-02-01' }
).length, 3);
assert.equal(restored.components.length, 3);

console.log(JSON.stringify({
  result: 'PASS bom-two-stage-acceptance-smoke',
  itemMasterFirst: true,
  definedCardReferencesOnly: true,
  internalCodePrimary: true,
  oemNoSecondary: true,
  nestedBomLevels: 3,
  effectivityFiltered: true,
  operationCodesValidated: operationCodes.length,
  legacyProjection: legacyProjection.length,
  snapshotRoundTrip: true
}));
