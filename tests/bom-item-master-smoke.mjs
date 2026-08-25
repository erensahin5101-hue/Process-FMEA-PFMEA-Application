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

for (const method of [
  'normalizeItemMaster',
  'normalizeItemMasters',
  'normalizeBomLine',
  'normalizeBomDefinition',
  'normalizeBomDefinitions',
  'validateItemMasters',
  'validateItemMasterChange',
  'validateBomDefinitions',
  'validateEngineeringUniverse',
  'explodeBom',
  'migrateLegacyComponents',
  'toLegacyComponents'
]) assert.equal(typeof Bom[method], 'function', `TyanaBom.${method} eksik.`);

assert.equal(Bom.ENGINEERING_SCHEMA_VERSION, '2.0.0');
assert.ok(Bom.itemMasterTypes.includes('FINISHED_GOOD'));
assert.ok(Bom.procurementTypes.includes('MAKE'));
assert.ok(Bom.masterValidationStatuses.includes('APPROVED'));

function master(overrides = {}) {
  return {
    id: 'MAT-DEFAULT',
    internalCode: 'STK-DEFAULT',
    oemNo: '',
    name: 'Varsayılan kart',
    description: 'Varsayılan malzeme kartı',
    itemType: 'MANUFACTURED_PART',
    revision: 'A',
    uom: 'adet',
    procurementType: 'MAKE',
    validationStatus: 'APPROVED',
    ...overrides
  };
}

const rawMasters = [
  master({ id: 'MAT-FG', internalCode: 'FG-1000', oemNo: 'OEM-77', name: 'Yeni Mamul', description: 'Ana ürün', itemType: 'FINISHED_GOOD' }),
  master({ id: 'MAT-SA', internalCode: 'SA-1100', name: 'Alt Montaj', description: 'Tekrar kullanılabilir alt montaj', itemType: 'SUBASSEMBLY' }),
  master({ id: 'MAT-BODY', internalCode: 'PRT-1200', name: 'İşlenmiş Gövde', description: 'Talaşlı işlenmiş gövde' }),
  master({ id: 'MAT-RAW', internalCode: 'RAW-1210', name: 'Gövde Taslağı', description: 'Dövme gövde taslağı', itemType: 'RAW_MATERIAL', procurementType: 'BUY' }),
  master({ id: 'MAT-BALL', internalCode: 'PRT-1300', name: 'Mafsal', description: 'İşlenmiş mafsal' }),
  master({ id: 'MAT-NUT', internalCode: 'BUY-1400', name: 'Somun', description: 'Bağlantı somunu', itemType: 'FASTENER', procurementType: 'BUY' }),
  master({ id: 'MAT-FUTURE', internalCode: 'BUY-1500', name: 'Gelecek Revizyon Parçası', description: 'İleri tarihli BOM satırı', itemType: 'PURCHASED_PART', procurementType: 'BUY' })
];
const masters = Bom.normalizeItemMasters(rawMasters);
assert.equal(masters.length, 7);
assert.equal(masters[0].itemMasterId, masters[0].id);
assert.equal(masters[0].internalStockCode, 'FG-1000');
assert.equal(masters[0].itemNo, 'FG-1000', 'Eski ekranlar için itemNo aliası korunmalı.');
assert.equal(masters[0].oemNo, 'OEM-77');
assert.equal(masters[3].makeBuy, 'Satın al');
assert.equal(Bom.validateItemMasters(masters, { requireApproved: true }).length, 0);

const normalizedAlias = Bom.normalizeItemMaster({
  partMasterId: 'PM-ALIAS',
  itemNo: 'OLD-STOCK-01',
  customerPartNo: 'OEM-ALIAS',
  name: 'Eski kayıt',
  componentType: 'Alt montaj',
  revision: 'B',
  uom: 'adet',
  makeBuy: 'Üret',
  verificationStatus: 'Doğrulandı'
});
assert.equal(normalizedAlias.id, 'PM-ALIAS');
assert.equal(normalizedAlias.internalCode, 'OLD-STOCK-01');
assert.equal(normalizedAlias.oemNo, 'OEM-ALIAS');
assert.equal(normalizedAlias.itemType, 'SUBASSEMBLY');
assert.equal(normalizedAlias.procurementType, 'MAKE');
assert.equal(normalizedAlias.validationStatus, 'APPROVED');

const duplicateCode = masters.map(item => ({ ...item }));
duplicateCode[1].internalCode = duplicateCode[0].internalCode.toLowerCase();
assert.ok(Bom.validateItemMasters(duplicateCode).some(finding => finding.code === 'DUPLICATE_INTERNAL_CODE'));
const missingCode = masters.map(item => ({ ...item }));
missingCode[2].internalCode = '';
missingCode[2].internalStockCode = '';
missingCode[2].itemNo = '';
assert.ok(Bom.validateItemMasters(missingCode).some(finding => finding.code === 'MISSING_INTERNAL_CODE'));
const changedApprovedMaster = { ...masters[2], description: 'Kontrollü teknik açıklama değişti' };
assert.ok(Bom.validateItemMasterChange(masters[2], changedApprovedMaster).some(finding => finding.code === 'ITEM_MASTER_REVISION_BUMP_REQUIRED'));
assert.ok(Bom.validateItemMasterChange(masters[2], { ...changedApprovedMaster, revision: 'B' }).every(finding => finding.code !== 'ITEM_MASTER_REVISION_BUMP_REQUIRED'));
assert.ok(Bom.validateItemMasterChange(masters[2], { ...masters[2], internalCode: 'PRT-CHANGED' }).some(finding => finding.code === 'INTERNAL_CODE_IMMUTABLE'));

const rawBoms = [
  {
    id: 'BOM-FG-A',
    bomNo: 'BOM-FG-1000',
    headerItemMasterId: 'MAT-FG',
    revision: 'A',
    alternative: '01',
    status: 'APPROVED',
    baseQuantity: 1,
    uom: 'adet',
    effectiveFrom: '2026-01-01',
    lines: [
      { id: 'L-FG-10', position: '10', itemMasterId: 'MAT-SA', quantity: 1, uom: 'adet', referencedRevision: 'A', assemblyOperationCode: '100' },
      { id: 'L-FG-20', position: '20', itemMasterId: 'MAT-NUT', quantity: 2, uom: 'adet', referencedRevision: 'A', assemblyOperationCode: '100' },
      { id: 'L-FG-30', position: '30', itemMasterId: 'MAT-FUTURE', quantity: 1, uom: 'adet', referencedRevision: 'A', effectiveFrom: '2027-01-01' }
    ]
  },
  {
    id: 'BOM-SA-A',
    bomNo: 'BOM-SA-1100',
    headerItemMasterId: 'MAT-SA',
    revision: 'A',
    alternative: '01',
    status: 'APPROVED',
    baseQuantity: 1,
    uom: 'adet',
    lines: [
      { id: 'L-SA-10', position: '10', itemMasterId: 'MAT-BODY', quantity: 2, uom: 'adet', referencedRevision: 'A', assemblyOperationCode: '100' },
      { id: 'L-SA-20', position: '20', itemMasterId: 'MAT-BALL', quantity: 1, uom: 'adet', referencedRevision: 'A', assemblyOperationCode: '100' }
    ]
  },
  {
    id: 'BOM-BODY-A',
    bomNo: 'BOM-PRT-1200',
    headerItemMasterId: 'MAT-BODY',
    revision: 'A',
    alternative: '01',
    status: 'APPROVED',
    baseQuantity: 1,
    uom: 'adet',
    lines: [
      { id: 'L-BODY-10', position: '10', itemMasterId: 'MAT-RAW', quantity: 0.5, uom: 'kg', referencedRevision: 'A', assemblyOperationCode: '100' }
    ]
  }
];
const boms = Bom.normalizeBomDefinitions(rawBoms);
assert.equal(boms[0].id, boms[0].bomId);
assert.equal(boms[0].lines[0].id, boms[0].lines[0].lineId);
const operationCodes = operationLibrary.operations.map(operation => operation.code);
const bomIssues = Bom.validateBomDefinitions(boms, masters, { operationCodes, asOfDate: '2026-07-18' });
assert.equal(bomIssues.length, 0, `Geçerli iki aşamalı BOM bulgu üretmemeli: ${bomIssues.map(item => item.code).join(', ')}`);

const explosion = Bom.explodeBom('MAT-FG', masters, boms, { asOfDate: '2026-07-18' });
assert.equal(explosion.length, 5, 'İleri tarihli satır hariç çok seviyeli patlatma 5 occurrence üretmeli.');
assert.deepEqual([...explosion.map(row => row.level)], [1, 2, 3, 2, 1]);
assert.equal(explosion.find(row => row.itemMasterId === 'MAT-BODY').cumulativeQuantity, 2);
assert.equal(explosion.find(row => row.itemMasterId === 'MAT-RAW').cumulativeQuantity, 1, 'Alt seviye kümülatif miktar hesaplanmalı.');
assert.equal(explosion.find(row => row.itemMasterId === 'MAT-SA').leaf, false);
assert.equal(explosion.find(row => row.itemMasterId === 'MAT-NUT').leaf, true);
assert.ok(!explosion.some(row => row.itemMasterId === 'MAT-FUTURE'), 'Geçerlilik dışı BOM satırı patlatılmamalı.');
assert.equal(Bom.explodeBom('MAT-FG', masters, boms, { asOfDate: '2027-02-01' }).length, 6);

const unknownReference = structuredClone(boms);
unknownReference[0].lines[0].itemMasterId = 'MAT-NOT-FOUND';
assert.ok(Bom.validateBomDefinitions(unknownReference, masters).some(finding => finding.code === 'UNKNOWN_BOM_LINE_MASTER'));
const unknownOperation = structuredClone(boms);
unknownOperation[0].lines[0].assemblyOperationCode = 'OP-NOT-FOUND';
assert.ok(Bom.validateBomDefinitions(unknownOperation, masters, { operationCodes }).some(finding => finding.code === 'UNKNOWN_ASSEMBLY_OPERATION_CODE'));
const revisionMismatch = structuredClone(boms);
revisionMismatch[0].lines[0].referencedRevision = 'Z';
assert.ok(Bom.validateBomDefinitions(revisionMismatch, masters).some(finding => finding.code === 'BOM_LINE_REVISION_MISMATCH' && finding.severity === 'warning'));
const draftBom = structuredClone(boms);
draftBom[0].status = 'DRAFT';
assert.ok(Bom.validateBomDefinitions(draftBom, masters, { requireApproved: true }).some(finding => finding.code === 'BOM_DEFINITION_NOT_APPROVED'));
const cycle = structuredClone(boms);
cycle.push(Bom.normalizeBomDefinition({
  id: 'BOM-BALL-A',
  headerItemMasterId: 'MAT-BALL',
  revision: 'A',
  alternative: '01',
  status: 'APPROVED',
  lines: [{ id: 'L-BALL-10', position: '10', itemMasterId: 'MAT-FG', quantity: 1, uom: 'adet' }]
}));
assert.ok(Bom.validateBomDefinitions(cycle, masters).some(finding => finding.code === 'MATERIAL_BOM_CYCLE'));

const legacy = [
  {
    id: 'OLD-SA',
    partMasterId: 'PM-SA',
    parentId: Bom.ROOT_ID,
    position: '10',
    itemNo: 'OLD-SA-001',
    oemNo: 'OEM-SA',
    name: 'Eski Alt Montaj',
    componentType: 'Alt montaj',
    quantity: 1,
    uom: 'adet',
    makeBuy: 'Üret',
    revision: 'A',
    drawingRevision: 'A',
    status: 'Onaylı',
    verificationStatus: 'Doğrulandı'
  },
  {
    id: 'OLD-PART',
    partMasterId: 'PM-PART',
    parentId: 'OLD-SA',
    position: '10',
    itemNo: 'OLD-PART-001',
    name: 'Eski Parça',
    componentType: 'İç üretim parçası',
    quantity: 2,
    uom: 'adet',
    makeBuy: 'Üret',
    revision: 'A',
    drawingRevision: 'A',
    status: 'Onaylı',
    verificationStatus: 'Doğrulandı'
  }
];
const legacySnapshot = structuredClone(legacy);
const upgraded = Bom.migrateLegacyComponents(legacy, {
  finishedGood: {
    id: 'PM-FG',
    internalCode: 'OLD-FG-001',
    oemNo: 'OEM-FG',
    name: 'Eski Ana Mamul',
    revision: 'A',
    uom: 'adet',
    validationStatus: 'APPROVED'
  }
});
assert.deepEqual(legacy, legacySnapshot, 'Legacy snapshot migrasyon sırasında değiştirilmemeli.');
assert.equal(upgraded.architecture, 'ITEM_MASTER_THEN_BOM');
assert.equal(upgraded.migration.preservesLegacySnapshot, true);
assert.equal(upgraded.itemMasters.length, 3);
assert.equal(upgraded.bomDefinitions.length, 2);
assert.equal(upgraded.itemMasters.find(item => item.id === 'PM-SA').oemNo, 'OEM-SA');
assert.equal(Bom.explodeBom(upgraded.rootItemMasterId, upgraded.itemMasters, upgraded.bomDefinitions).length, 2);
const projectedLegacy = Bom.toLegacyComponents(upgraded.rootItemMasterId, upgraded.itemMasters, upgraded.bomDefinitions);
assert.equal(projectedLegacy.length, 2);
assert.equal(projectedLegacy[0].id, 'OLD-SA');
assert.equal(projectedLegacy[1].parentId, 'OLD-SA');
assert.equal(projectedLegacy[1].partMasterId, 'PM-PART');
const upgradedValidation = Bom.validateEngineeringUniverse(upgraded, { requireApproved: true });
assert.equal(upgradedValidation.errors.length, 0, `Migrasyon sonucu yayın doğrulamasından geçmeli: ${upgradedValidation.errors.map(item => item.code).join(', ')}`);

console.log(JSON.stringify({
  result: 'PASS bom-item-master-smoke',
  schema: Bom.ENGINEERING_SCHEMA_VERSION,
  itemMasters: masters.length,
  bomDefinitions: boms.length,
  explodedOccurrences: explosion.length,
  operationCodesValidated: operationCodes.length,
  legacyRecordsPreserved: upgraded.legacyComponents.length,
  migratedMasters: upgraded.itemMasters.length,
  migratedBoms: upgraded.bomDefinitions.length
}));
