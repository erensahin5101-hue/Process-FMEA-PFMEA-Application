import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const [libraryText, seedText, domainSource] = await Promise.all([
  readFile(new URL('../data/bom-engineering-library.json', import.meta.url), 'utf8'),
  readFile(new URL('../seed-processes.json', import.meta.url), 'utf8'),
  readFile(new URL('../bom-domain.js', import.meta.url), 'utf8')
]);

const library = JSON.parse(libraryText);
const seedProcesses = JSON.parse(seedText);
const processIds = new Set(seedProcesses.map(process => process.id));
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

assert.ok(Bom, 'TyanaBom alan modeli yüklenemedi.');
assert.equal(library.schemaVersion, '1.1.0');
assert.equal(library.libraryId, 'tyana.bom-engineering');
assert.equal(library.metadata.owner, 'TYANA Q-FLOW');
assert.equal(library.metadata.maintainer, 'Eren');
assert.ok(!/ditaş/i.test(libraryText), 'Kütüphanede eski firma ibaresi bulunmamalı.');
assert.equal(library.contracts.rootId, Bom.ROOT_ID);
assert.equal(library.contracts.alternativeSelectionRule, 'exactly-one-per-parent-and-alternativeGroupId');
assert.equal(library.contracts.engineeringSchemaVersion, Bom.ENGINEERING_SCHEMA_VERSION);
assert.equal(library.contracts.engineeringModel, 'item-master-then-independent-bom-definitions');
assert.match(library.contracts.legacyCompatibilityRule, /migrateLegacyComponents/);
assert.equal(library.itemMasterTypes.length, 11);
assert.deepEqual(library.itemMasterTypes.map(item => item.id), [...Bom.itemMasterTypes]);
assert.equal(library.procurementTypes.length, 5);
assert.deepEqual(library.procurementTypes.map(item => item.id), [...Bom.procurementTypes]);
assert.deepEqual(library.validationStatuses.map(item => item.id), [...Bom.masterValidationStatuses]);
assert.deepEqual(library.twoStageUiContract.stage1.requiredFields, ['internalCode', 'description', 'itemType', 'revision', 'uom', 'procurementType', 'validationStatus']);
assert.ok(library.twoStageUiContract.stage1.optionalFields.includes('oemNo'));
assert.ok(library.twoStageUiContract.stage2.lineFields.includes('itemMasterId'));
assert.ok(library.twoStageUiContract.stage2.lineFields.includes('assemblyOperationCode'));

function uniqueIds(rows, label) {
  const ids = rows.map(row => row.id);
  assert.equal(new Set(ids).size, ids.length, `${label} kimlikleri benzersiz olmalı.`);
}

function uniqueRouteKeys(rows, label) {
  const keys = rows.map(row => row.routeKey);
  assert.ok(keys.every(Boolean), `${label} routeKey alanı zorunlu.`);
  assert.equal(new Set(keys).size, keys.length, `${label} kimlikleri benzersiz olmalı.`);
}

function template(id) {
  const result = library.templates.find(item => item.id === id);
  assert.ok(result, `${id} şablonu eksik.`);
  return result;
}

function catalogItem(id) {
  const result = library.catalog.find(item => item.id === id);
  assert.ok(result, `${id} katalog kaydı eksik.`);
  return result;
}

function controlsFor(components) {
  return components
    .filter(item => item.critical || !['', 'NONE'].includes(item.specialCharacteristic || ''))
    .map(item => ({
      id: `CP-${item.id}`,
      controlPlanRowId: `CP-${item.id}`,
      componentId: item.id,
      classification: item.specialCharacteristic || 'SC',
      controlPlanIncluded: true
    }));
}

function assertCanonicalComponent(item, label) {
  for (const field of ['id', 'position', 'parentId', 'itemNo', 'name', 'componentType', 'quantity', 'usageQuantity', 'uom', 'makeBuy', 'itemRevision', 'revision', 'drawingNo', 'drawingRevision', 'status']) {
    assert.notEqual(item[field], undefined, `${label}.${field} eksik.`);
  }
  assert.ok(Number(item.quantity) > 0, `${label} miktarı pozitif olmalı.`);
  assert.ok(Number(item.usageQuantity) > 0, `${label} kullanım miktarı pozitif olmalı.`);
}

const expectedComponentTypes = [
  'Mamul',
  'Alt montaj',
  'İç üretim parçası',
  'Satın alınan parça',
  'Yarı mamul',
  'Hammadde',
  'Bağlantı elemanı',
  'Sarf malzeme',
  'Ambalaj malzemesi'
];
assert.deepEqual(library.componentTypes.map(type => type.label), expectedComponentTypes);
uniqueIds(library.componentTypes, 'Bileşen tipi');
uniqueIds(library.catalog, 'Katalog');
uniqueIds(library.templates, 'Şablon');

const blank = template('template.blank-multilevel');
assert.equal(blank.productGroup, 'Kullanıcı tanımlı');
assert.deepEqual(blank.components, []);
assert.deepEqual(blank.routeTemplate, []);

const femaleRod = template('template.disi-rot-sabit');
const ballJoint = template('template.rot-basi-sabit');
const tieRod = template('template.rot-kolu-sabit-ayarli');
assert.equal(femaleRod.components.length, 2);
assert.equal(ballJoint.components.length, 9);
assert.equal(tieRod.components.length, 18);

for (const itemTemplate of library.templates) {
  uniqueIds(itemTemplate.components, `${itemTemplate.id} bileşen`);
  uniqueRouteKeys(itemTemplate.routeTemplate, `${itemTemplate.id} rota`);
  itemTemplate.components.forEach((item, index) => assertCanonicalComponent(item, `${itemTemplate.id}.components[${index}]`));

  const ids = new Set(itemTemplate.components.map(item => item.id));
  for (const item of itemTemplate.components) {
    assert.ok(item.parentId === Bom.ROOT_ID || ids.has(item.parentId), `${itemTemplate.id}/${item.id} üst bileşeni çözümlenemiyor.`);
  }

  for (const routeStep of itemTemplate.routeTemplate) {
    assert.ok(processIds.has(routeStep.processId), `${itemTemplate.id}/${routeStep.routeKey} bilinmeyen proses kimliği kullanıyor: ${routeStep.processId}`);
    for (const inputId of routeStep.inputComponentIds || []) {
      assert.ok(ids.has(inputId), `${itemTemplate.id}/${routeStep.routeKey} bilinmeyen girdi bileşeni kullanıyor: ${inputId}`);
    }
    assert.ok(routeStep.outputItemId === Bom.ROOT_ID || ids.has(routeStep.outputItemId), `${itemTemplate.id}/${routeStep.routeKey} bilinmeyen çıktı bileşeni kullanıyor.`);
  }

  if (itemTemplate.components.length) {
    const summary = Bom.summarizeValidation(Bom.validate(itemTemplate.components, {
      route: itemTemplate.routeTemplate,
      characteristics: controlsFor(itemTemplate.components),
      strict: true
    }));
    assert.equal(summary.errors.length, 0, `${itemTemplate.id} yayın doğrulaması hatalı: ${summary.errors.map(issue => issue.code).join(', ')}`);
    assert.equal(summary.warnings.length, 0, `${itemTemplate.id} rota kapsam uyarısı üretiyor: ${summary.warnings.map(issue => issue.code).join(', ')}`);
  }
}

const processFields = library.contracts.canonicalProcessFields;
const allCanonicalRecords = [
  ...library.templates.flatMap(item => item.components),
  ...library.catalog.flatMap(item => [item.root, ...item.components])
];
for (const component of allCanonicalRecords) {
  for (const field of processFields) {
    if (component[field]) assert.ok(processIds.has(component[field]), `${component.id}.${field} mevcut proses kütüphanesinde yok: ${component[field]}`);
  }
}

const topLevel = tieRod.components.filter(item => item.parentId === Bom.ROOT_ID);
assert.equal(topLevel.length, 7, 'Rot Kolu Sabit Ayarlı üst seviyesinde 7 kalem olmalı.');
assert.deepEqual(topLevel.map(item => item.name), ['Dişi Rot', 'Rot Başı', 'Kelepçe', 'Cıvata', 'Somun', 'Boya', 'Ambalaj Bileşenleri']);

const femaleRodNode = tieRod.components.find(item => item.id === 'RK-DISI-ROT');
const femaleRodChildren = tieRod.components.filter(item => item.parentId === femaleRodNode.id);
assert.deepEqual(femaleRodChildren.map(item => item.name), ['Sabit Gövde', 'Boru']);

const ballJointNode = tieRod.components.find(item => item.id === 'RK-ROT-BASI');
assert.equal(ballJointNode.reusable, true);
assert.equal(ballJointNode.reuseMode, 'reference');
assert.equal(ballJointNode.catalogItemId, 'CAT-ROT-BASI-SA');
assert.equal(ballJointNode.catalogRevision, 'A');
const ballJointChildren = tieRod.components.filter(item => item.parentId === ballJointNode.id);
assert.equal(ballJointChildren.length, 9);

const bearingGroup = tieRod.alternativeGroups.find(group => group.id === 'RB-BEARING-1OFN');
assert.ok(bearingGroup, 'Yatak alternatif grubu eksik.');
assert.equal(bearingGroup.selectionMode, 'exactly-one');
assert.equal(bearingGroup.minimumSelections, 1);
assert.equal(bearingGroup.maximumSelections, 1);
assert.ok(bearingGroup.memberIds.length >= 2, '1-of-N grubu en az iki aday içermeli.');
const bearingCandidates = tieRod.components.filter(item => item.alternativeGroupId === bearingGroup.id);
assert.deepEqual(new Set(bearingCandidates.map(item => item.id)), new Set(bearingGroup.memberIds));
assert.equal(bearingCandidates.filter(item => item.alternativeSelected).length, 1, 'Yalnız bir yatak alternatifi seçili olmalı.');
assert.equal(bearingCandidates.find(item => item.alternativeSelected).id, bearingGroup.selectedId);

const invalidAlternatives = tieRod.components.map(item => ({ ...item }));
invalidAlternatives.find(item => item.id === 'RK-RB-YATAK-PA66').alternativeSelected = true;
assert.ok(Bom.validate(invalidAlternatives).some(issue => issue.code === 'ALTERNATIVE_SELECTION_INVALID'), 'İki seçili alternatif yayın hatası üretmeli.');

const protectedPostPaintParts = allCanonicalRecords.filter(item =>
  item.installationStage === 'post-paint' && /Toz Lastiği|Sıkma Halkası|Sıkma Yayı|Kelepçe/.test(item.name)
);
assert.ok(protectedPostPaintParts.length >= 10, 'Katalog ve mamul şablonlarındaki boya sonrası koruyucu parçalar eksik.');
for (const item of protectedPostPaintParts) {
  assert.equal(item.firstUseProcessId, 'post-paint-assembly', `${item.id} ilk kullanım prosesi boya sonrası montaj olmalı.`);
  assert.equal(item.mountedAtProcessId, 'post-paint-assembly', `${item.id} montaj prosesi boya sonrası montaj olmalı.`);
  assert.equal(item.prerequisiteProcessId, 'painting', `${item.id} için boya ön koşulu zorunlu.`);
}

const dustBoot = tieRod.components.find(item => item.id === 'RK-RB-TOZ-LASTIGI');
assert.ok(dustBoot, 'Toz lastiği BOM içinde bulunmalı.');
assert.equal(dustBoot.parentId, ballJointNode.id, 'Toz lastiği Rot Başı altında olmalı.');
assert.equal(dustBoot.installationStage, 'post-paint');
assert.equal(dustBoot.installationConstraint, 'AFTER_PAINT');
assert.equal(dustBoot.paintSensitive, true);
assert.equal(dustBoot.prerequisiteProcessId, 'painting');
assert.equal(dustBoot.firstUseProcessId, 'post-paint-assembly');
assert.equal(dustBoot.mountedAtProcessId, 'post-paint-assembly');
const paintIndex = tieRod.routeTemplate.findIndex(step => step.processId === 'painting');
const postPaintIndex = tieRod.routeTemplate.findIndex(step => step.processId === dustBoot.mountedAtProcessId);
assert.ok(paintIndex >= 0 && postPaintIndex > paintIndex, 'Toz lastiği montaj operasyonu boya operasyonundan sonra olmalı.');
assert.equal(tieRod.routeTemplate[postPaintIndex].operationPurpose, 'post-paint-assembly');
assert.ok(tieRod.routeTemplate[postPaintIndex].inputComponentIds.includes(dustBoot.id));

const wrongRouteOrder = [...tieRod.routeTemplate];
const postPaintStep = wrongRouteOrder.splice(postPaintIndex, 1)[0];
wrongRouteOrder.splice(paintIndex, 0, postPaintStep);
assert.ok(Bom.validate(tieRod.components, {
  route: wrongRouteOrder,
  characteristics: controlsFor(tieRod.components),
  strict: true
}).some(issue => issue.code === 'PAINT_ORDER_VIOLATION'), 'Boya öncesine taşınan toz lastiği montajı engellenmeli.');

const tieRodTree = Bom.tree(tieRod.components);
assert.equal(tieRodTree.length, 7);
const nestedBallJoint = tieRodTree.find(item => item.id === ballJointNode.id);
assert.equal(nestedBallJoint.children.length, 9);
assert.deepEqual([...Bom.path(tieRod.components, dustBoot.id, tieRod.product.partName)], [
  'Rot Kolu Sabit Ayarlı',
  'Rot Başı',
  'Toz Lastiği'
]);

const ballJointCatalog = catalogItem('CAT-ROT-BASI-SA');
assert.equal(ballJointCatalog.reusable, true);
assert.equal(ballJointCatalog.root.catalogItemId, ballJointCatalog.id);
assert.equal(ballJointCatalog.root.catalogRevision, ballJointCatalog.revision);
assert.equal(ballJointCatalog.root.reuseMode, 'reference');
assert.equal(ballJointCatalog.components.length, 9);
assert.ok(ballJointCatalog.components.every(item => item.parentId === ballJointCatalog.root.id));
const catalogAlternativeGroup = ballJointCatalog.alternativeGroups[0];
assert.equal(catalogAlternativeGroup.selectionMode, 'exactly-one');
assert.equal(ballJointCatalog.components.filter(item => item.alternativeGroupId === catalogAlternativeGroup.id && item.alternativeSelected).length, 1);

const femaleRodCatalog = catalogItem('CAT-DISI-ROT-SABIT');
assert.equal(femaleRodCatalog.components.length, 2);
assert.ok(femaleRodCatalog.components.every(item => item.parentId === femaleRodCatalog.root.id));

for (const item of library.catalog) {
  const structuralComponents = [item.root, ...item.components];
  const summary = Bom.summarizeValidation(Bom.validate(structuralComponents));
  assert.equal(summary.errors.length, 0, `${item.id} katalog yapısı hatalı: ${summary.errors.map(issue => issue.code).join(', ')}`);
}

console.log(`PASS bom-library-smoke: schema=${library.schemaVersion}, catalog=${library.catalog.length}, templates=${library.templates.length}, tieRodItems=${tieRod.components.length}, topLevel=${topLevel.length}, ballJointChildren=${ballJointChildren.length}, bearingAlternatives=${bearingCandidates.length}, selectedBearing=1, postPaint=${dustBoot.mountedAtProcessId}`);
