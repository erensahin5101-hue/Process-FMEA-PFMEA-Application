import assert from 'node:assert/strict';

await import('../master-template-domain.js');
const domain = globalThis.TyanaMasterTemplates;
assert.ok(domain, 'Ana şablon domain motoru yüklenmeli.');
assert.equal(domain.SCHEMA_VERSION, '1.0.0');

const source = {
  schemaVersion: '4.0.0', templateVersion: 'TYANA-QF-2026.6-GENERIC', snapshotId: 'SOURCE-SNAPSHOT', generatedAt: '2026-07-18T10:00:00.000Z', projectId: 'PROJECT-OLD', sha256: 'old-digest',
  product: { productTemplate: 'blank', productGroup: 'steering', productGroupLabel: 'Direksiyon Sistemleri', productStructureType: 'assembly', productType: 'Rot Kolu', productTypeLabel: 'Rot Kolu', partName: 'Eski Rot Kolu', partNumber: 'OEM-OLD', internalProductCode: 'SAP-OLD', customer: 'OEM A', customerPartNumber: 'OLD-REF', projectCode: 'APQP-OLD', controlPlanNumber: 'CP-OLD', drawingNumber: 'DRW-OLD', drawingRevision: 'C', productionPhase: 'Seri Üretim', annualVolume: '120000', documentStatus: 'İncelemede' },
  technical: { materialFamily: 'Çelik', customerSpecificRequirements: 'Korunacak teknik şart' },
  engineeringUniverse: {
    rootItemMasterId: 'MAT-FG',
    itemMasters: [
      { id: 'MAT-FG', internalCode: 'SAP-OLD', oemNo: 'OEM-OLD', name: 'Eski Rot Kolu', drawingNo: 'DRW-OLD', drawingRevision: 'C', status: 'Onaylı', validationStatus: 'APPROVED' },
      { id: 'MAT-TUBE', internalCode: 'SAP-TUBE', oemNo: 'SUP-TUBE', name: 'ST52 Boru', drawingNo: 'DRW-TUBE', drawingRevision: 'A', status: 'Onaylı', validationStatus: 'APPROVED' }
    ],
    bomDefinitions: [{ id: 'BOM-FG', headerItemMasterId: 'MAT-FG', bomNo: 'BOM-SAP-OLD', revision: 'C', alternative: '01', status: 'APPROVED', lines: [{ id: 'L10', itemMasterId: 'MAT-TUBE', quantity: 1 }] }],
    bomSelections: { 'MAT-FG': 'BOM-FG' }
  },
  bom: { history: [{ at: 'old' }] },
  components: [{ id: 'MAT-TUBE', itemMasterId: 'MAT-TUBE', parentId: 'FINISHED_GOOD', itemNo: 'SAP-TUBE', name: 'ST52 Boru', quantity: 1 }],
  route: [{ routeKey: 'turning-1', processId: 'cnc', operationNo: '20', operationCode: '0200', operationLabelTR: 'Tornalama', operationLabelEN: 'Turning', machineId: 'CNC-01', workcenter: 'Talaşlı İmalat', inputComponentIds: ['MAT-TUBE'], outputItemId: 'FINISHED_GOOD' }],
  characteristics: [{ id: 'CC-01', routeKey: 'turning-1', name: 'Dış çap', nominal: 25, upperTolerance: 0.1, lowerTolerance: -0.1, sourceDrawing: 'DRW-OLD' }],
  pfmea: [{ id: 'PF-01', routeKey: 'turning-1', characteristicIds: ['CC-01'], failureMode: 'Çap tolerans dışı', preventionControl: 'Program kilidi' }],
  ppap: { submissionLevel: '3', records: { controlPlan: { status: 'ready' } }, generatedDocuments: [{ name: 'old.pdf', sha256: 'old' }] },
  drawingSource: { name: 'DRW-OLD.pdf', sha256: 'drawing-digest', storageId: 'drawing-old' },
  approval: { preparedBy: 'Eren', preparedAt: '2026-07-18T10:00:00.000Z', status: 'İncelemede' }
};

const readiness = domain.assessReadiness(source);
assert.equal(readiness.ready, true, JSON.stringify(readiness.issues));
assert.deepEqual(readiness.metrics, { itemMasters: 2, bomDefinitions: 1, components: 1, routeSteps: 1, codedOperations: 1, characteristics: 1, pfmeaRows: 1 });

const payload = domain.createTemplatePayload(source, { name: 'Direksiyon Ana Omurgası', description: 'Rot kolu ürün grubu kontrollü yapısı' });
assert.equal(payload.kind, 'PRODUCT_GROUP_MASTER_TEMPLATE');
assert.equal(payload.productGroup, 'steering');
assert.equal(payload.snapshot.product.partNumber, '');
assert.equal(payload.snapshot.product.internalProductCode, '');
assert.equal(payload.snapshot.product.partName, '');
assert.equal(payload.snapshot.engineeringUniverse.itemMasters.find(item => item.id === 'MAT-FG').internalCode, '');
assert.equal(payload.snapshot.engineeringUniverse.itemMasters.find(item => item.id === 'MAT-TUBE').internalCode, 'SAP-TUBE', 'Ortak alt malzeme kartı korunmalı.');
assert.equal(payload.snapshot.engineeringUniverse.bomDefinitions[0].bomNo, '');
assert.equal(payload.snapshot.characteristics[0].sourceDrawing, '{{DRAWING_NUMBER}}');
assert.deepEqual(payload.snapshot.ppap.generatedDocuments, []);
assert.equal(payload.snapshot.drawingSource, undefined);
assert.equal(payload.snapshot.projectId, undefined);
assert.equal(source.product.partNumber, 'OEM-OLD', 'Kaynak snapshot mutasyona uğramamalı.');
assert.equal(source.ppap.generatedDocuments.length, 1, 'Kaynak çıktı kayıtları korunmalı.');

const record = { id: 'TPL-1', version: 3, payload };
assert.equal(domain.validateTemplateRecord(record).valid, true);
const instantiated = domain.instantiate(record, { partName: 'Yeni Rot Kolu', partNumber: 'OEM-NEW', internalProductCode: 'SAP-NEW', customer: 'OEM B', customerPartNumber: 'NEW-REF', projectCode: 'APQP-NEW', controlPlanNumber: 'CP-NEW', drawingNumber: 'DRW-NEW', drawingRevision: 'A', productionPhase: 'Ön Seri', annualVolume: '75000' }, { snapshotId: 'SNAP-NEW', generatedAt: '2026-07-18T12:00:00.000Z' });

assert.equal(instantiated.projectId, null);
assert.equal(instantiated.product.partName, 'Yeni Rot Kolu');
assert.equal(instantiated.product.partNumber, 'OEM-NEW');
assert.equal(instantiated.product.internalProductCode, 'SAP-NEW');
assert.equal(instantiated.product.documentStatus, 'Taslak');
assert.equal(instantiated.engineeringUniverse.itemMasters.find(item => item.id === 'MAT-FG').internalCode, 'SAP-NEW');
assert.equal(instantiated.engineeringUniverse.itemMasters.find(item => item.id === 'MAT-TUBE').internalCode, 'SAP-TUBE');
assert.equal(instantiated.engineeringUniverse.bomDefinitions[0].bomNo, 'BOM-SAP-NEW');
assert.equal(instantiated.route[0].operationCode, '0200');
assert.equal(instantiated.route[0].machineId, 'CNC-01');
assert.equal(instantiated.characteristics[0].sourceDrawing, 'DRW-NEW');
assert.deepEqual(instantiated.pfmea[0].characteristicIds, ['CC-01']);
assert.deepEqual(instantiated.ppap.generatedDocuments, []);
assert.equal(instantiated.masterTemplateOrigin.id, 'TPL-1');
assert.equal(instantiated.masterTemplateOrigin.version, 3);
assert.equal(instantiated.approval.status, 'Taslak');
assert.equal(instantiated.engineeringUniverse.itemMasters.every(item => item.validationStatus === 'PENDING_REVIEW'), true, 'Kopyalanan ana veri onayları sıfırlanmalı.');

assert.throws(() => domain.instantiate(record, { partName: 'Eksik Kimlik' }), /OEM No zorunludur/);
const uncoded = structuredClone(source); uncoded.route[0].operationCode = ''; uncoded.route[0].operationCodeId = '';
assert.equal(domain.assessReadiness(uncoded).ready, false);
assert.ok(domain.assessReadiness(uncoded).errors.some(issue => issue.code === 'ROUTE_OPERATION_CODE'));

console.log(JSON.stringify({ result: 'PASS master-template-domain-smoke', schema: domain.SCHEMA_VERSION, preserved: ['BOM', 'route', 'operationCode', 'machine', 'characteristics', 'PFMEA'], isolated: ['identity', 'drawing', 'generatedDocuments', 'approvals'] }));
