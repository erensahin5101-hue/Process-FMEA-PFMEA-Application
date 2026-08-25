import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../bom-domain.js', import.meta.url), 'utf8');
const context = vm.createContext({
  console,
  crypto: globalThis.crypto,
  structuredClone,
  TextEncoder,
  TextDecoder,
  setTimeout,
  clearTimeout
});
vm.runInContext(source, context, { filename: 'bom-domain.js' });

const Bom = context.TyanaBom;
assert.ok(Bom && typeof Bom === 'object', 'bom-domain.js globalThis.TyanaBom API sunmalı.');
for (const method of [
  'normalizeComponent',
  'normalizeComponents',
  'tree',
  'path',
  'descendants',
  'wouldCreateCycle',
  'validate',
  'flatten',
  'reorder'
]) {
  assert.equal(typeof Bom[method], 'function', `TyanaBom.${method} fonksiyonu eksik.`);
}

const ROOT = 'FINISHED_GOOD';
const ids = Object.freeze({
  femaleRod: 'SA-DISI-ROT',
  ballJoint: 'SA-ROT-BASI',
  femaleBody: 'C-DISI-SABIT-GOVDE',
  tube: 'C-DISI-BORU',
  threadedBody: 'C-RB-YIVLI-GOVDE',
  joint: 'C-RB-MAFSAL',
  bearing: 'C-RB-YATAK-PLASTIK',
  rearCover: 'C-RB-ARKA-KAPAK',
  grease: 'C-RB-GRES',
  dustBoot: 'C-RB-TOZ-LASTIGI',
  retainingRing: 'C-RB-SIKMA-HALKASI',
  springRing: 'C-RB-SIKMA-YAYI',
  clamp: 'C-KELEPCE',
  bolt: 'C-CIVATA',
  nut: 'C-SOMUN',
  paint: 'C-BOYA',
  packaging: 'C-AMBALAJ'
});

function component(overrides = {}) {
  return {
    id: 'COMPONENT-ID',
    partMasterId: 'PART-MASTER-ID',
    position: '10',
    parentId: ROOT,
    itemNo: 'TY-PART-001',
    name: 'Bileşen',
    componentType: 'İç üretim parçası',
    quantity: 1,
    uom: 'adet',
    makeBuy: 'Üret',
    supplier: 'TYANA OTOMOTİV',
    materialGrade: 'Teknik resme göre',
    drawingNo: 'TR-TY-PART-001',
    drawingRevision: 'A',
    revision: 'A',
    status: 'Taslak',
    critical: false,
    reusable: false,
    referenceMode: 'embedded',
    alternativeGroupId: '',
    alternativeSelected: false,
    effectiveFrom: '2026-07-15',
    effectiveTo: '',
    producedAtProcessId: 'machining',
    firstUseProcessId: 'final-assembly',
    mountedAtProcessId: 'final-assembly',
    inspectedAtProcessId: 'final-inspection',
    installationStage: 'standard',
    prerequisiteProcessId: '',
    nextProcessId: '',
    operationLinkStatus: 'verified',
    ...overrides
  };
}

function purchased(overrides = {}) {
  return component({
    componentType: 'Satın alınan parça',
    makeBuy: 'Satın Al',
    supplier: 'TYANA Onaylı Tedarikçi',
    producedAtProcessId: '',
    ...overrides
  });
}

// Acceptance fixture: Rot Kolu Sabit Ayarlı. Positions intentionally repeat
// below different parents; only sibling-level position uniqueness is required.
const rawComponents = [
  component({
    id: ids.femaleRod,
    partMasterId: 'PM-DISI-ROT',
    position: '10',
    itemNo: 'TY-RK-SA-010',
    name: 'Dişi Rot',
    componentType: 'Alt montaj',
    reusable: true,
    referenceMode: 'reference',
    producedAtProcessId: 'female-rod-assembly',
    firstUseProcessId: 'painting',
    mountedAtProcessId: 'final-assembly'
  }),
  component({
    id: ids.ballJoint,
    partMasterId: 'PM-ROT-BASI',
    position: '20',
    itemNo: 'TY-RB-SA-020',
    name: 'Rot Başı',
    componentType: 'Alt montaj',
    reusable: true,
    referenceMode: 'reference',
    producedAtProcessId: 'ball-joint-preassembly',
    firstUseProcessId: 'painting',
    mountedAtProcessId: 'final-assembly'
  }),
  component({
    id: ids.femaleBody,
    partMasterId: 'PM-SABIT-GOVDE',
    parentId: ids.femaleRod,
    position: '10',
    itemNo: 'TY-RK-GVD-011',
    name: 'Sabit Gövde',
    materialGrade: 'C45E',
    drawingNo: 'TR-RK-GVD-011',
    producedAtProcessId: 'machining',
    firstUseProcessId: 'female-rod-assembly',
    mountedAtProcessId: 'female-rod-assembly'
  }),
  component({
    id: ids.tube,
    partMasterId: 'PM-BORU',
    parentId: ids.femaleRod,
    position: '20',
    itemNo: 'TY-RK-BRU-012',
    name: 'Boru',
    materialGrade: 'S355J2H / ST52',
    drawingNo: 'TR-RK-BRU-012',
    producedAtProcessId: 'tube-forming',
    firstUseProcessId: 'female-rod-assembly',
    mountedAtProcessId: 'female-rod-assembly'
  }),
  component({
    id: ids.threadedBody,
    partMasterId: 'PM-YIVLI-GOVDE',
    parentId: ids.ballJoint,
    position: '10',
    itemNo: 'TY-RB-GVD-021',
    name: 'Yivli / Ayarlı Gövde',
    materialGrade: 'C45E',
    drawingNo: 'TR-RB-GVD-021',
    producedAtProcessId: 'machining',
    firstUseProcessId: 'ball-joint-preassembly',
    mountedAtProcessId: 'ball-joint-preassembly'
  }),
  component({
    id: ids.joint,
    partMasterId: 'PM-MAFSAL',
    parentId: ids.ballJoint,
    position: '20',
    itemNo: 'TY-RB-MAF-022',
    name: 'Mafsal',
    materialGrade: '41Cr4',
    drawingNo: 'TR-RB-MAF-022',
    producedAtProcessId: 'machining',
    firstUseProcessId: 'ball-joint-preassembly',
    mountedAtProcessId: 'ball-joint-preassembly'
  }),
  purchased({
    id: ids.bearing,
    partMasterId: 'PM-YATAK-PLASTIK',
    parentId: ids.ballJoint,
    position: '30',
    itemNo: 'TY-RB-YTK-023',
    name: 'Plastik Yatak',
    materialGrade: 'POM / teknik şartname',
    drawingNo: 'TR-RB-YTK-023',
    alternativeGroupId: 'BEARING-TYPE',
    alternativeSelected: true,
    firstUseProcessId: 'ball-joint-preassembly',
    mountedAtProcessId: 'ball-joint-preassembly'
  }),
  purchased({
    id: ids.rearCover,
    partMasterId: 'PM-ARKA-KAPAK',
    parentId: ids.ballJoint,
    position: '40',
    itemNo: 'TY-RB-KPK-024',
    name: 'Arka Kapak',
    drawingNo: 'TR-RB-KPK-024',
    firstUseProcessId: 'ball-joint-preassembly',
    mountedAtProcessId: 'ball-joint-preassembly'
  }),
  purchased({
    id: ids.grease,
    partMasterId: 'PM-GRES',
    parentId: ids.ballJoint,
    position: '50',
    itemNo: 'TY-RB-GRS-025',
    name: 'Gres',
    componentType: 'Sarf malzeme',
    quantity: 12,
    uom: 'g',
    drawingNo: 'TS-RB-GRS-025',
    firstUseProcessId: 'ball-joint-preassembly',
    mountedAtProcessId: 'ball-joint-preassembly'
  }),
  purchased({
    id: ids.dustBoot,
    partMasterId: 'PM-TOZ-LASTIGI',
    parentId: ids.ballJoint,
    position: '60',
    itemNo: 'TY-RB-TL-026',
    name: 'Toz Lastiği',
    materialGrade: 'Otomotiv elastomeri / teknik şartname',
    drawingNo: 'TR-RB-TL-026',
    critical: true,
    firstUseProcessId: 'post-paint-assembly',
    mountedAtProcessId: 'post-paint-assembly',
    installationStage: 'post-paint',
    prerequisiteProcessId: 'painting',
    nextProcessId: 'retaining-ring-assembly',
    inspectedAtProcessId: 'final-inspection'
  }),
  purchased({
    id: ids.retainingRing,
    partMasterId: 'PM-SIKMA-HALKASI',
    parentId: ids.ballJoint,
    position: '70',
    itemNo: 'TY-RB-HLK-027',
    name: 'Sıkma Halkası',
    drawingNo: 'TR-RB-HLK-027',
    firstUseProcessId: 'retaining-ring-assembly',
    mountedAtProcessId: 'retaining-ring-assembly',
    prerequisiteProcessId: 'post-paint-assembly'
  }),
  purchased({
    id: ids.springRing,
    partMasterId: 'PM-SIKMA-YAYI',
    parentId: ids.ballJoint,
    position: '80',
    itemNo: 'TY-RB-YAY-028',
    name: 'Sıkma Yayı / Ring',
    drawingNo: 'TR-RB-YAY-028',
    firstUseProcessId: 'retaining-ring-assembly',
    mountedAtProcessId: 'retaining-ring-assembly',
    prerequisiteProcessId: 'post-paint-assembly'
  }),
  purchased({
    id: ids.clamp,
    partMasterId: 'PM-KELEPCE',
    position: '30',
    itemNo: 'TY-RK-KLP-030',
    name: 'Kelepçe',
    drawingNo: 'TR-RK-KLP-030'
  }),
  purchased({
    id: ids.bolt,
    partMasterId: 'PM-CIVATA',
    position: '40',
    itemNo: 'TY-RK-CVT-040',
    name: 'Cıvata',
    drawingNo: 'TR-RK-CVT-040'
  }),
  purchased({
    id: ids.nut,
    partMasterId: 'PM-SOMUN',
    position: '50',
    itemNo: 'TY-RK-SMN-050',
    name: 'Somun',
    drawingNo: 'TR-RK-SMN-050'
  }),
  purchased({
    id: ids.paint,
    partMasterId: 'PM-BOYA',
    position: '60',
    itemNo: 'TY-RK-BYA-060',
    name: 'Boya',
    componentType: 'Sarf malzeme',
    quantity: 0.08,
    uom: 'kg',
    drawingNo: 'TS-RK-BYA-060',
    firstUseProcessId: 'painting',
    mountedAtProcessId: 'painting'
  }),
  purchased({
    id: ids.packaging,
    partMasterId: 'PM-AMBALAJ',
    position: '70',
    itemNo: 'TY-RK-AMB-070',
    name: 'Ambalaj Bileşenleri',
    componentType: 'Ambalaj malzemesi',
    quantity: 1,
    uom: 'set',
    drawingNo: 'PK-RK-AMB-070',
    firstUseProcessId: 'packaging',
    mountedAtProcessId: 'packaging'
  })
];

const route = [
  { routeKey: 'r10', processId: 'incoming', operationNo: '10', inputComponentIds: [ids.bearing, ids.rearCover, ids.grease, ids.dustBoot, ids.retainingRing, ids.springRing, ids.clamp, ids.bolt, ids.nut, ids.paint, ids.packaging], outputItemId: ROOT },
  { routeKey: 'r20', processId: 'tube-forming', operationNo: '20', inputComponentIds: [ids.tube], outputItemId: ids.tube },
  { routeKey: 'r30', processId: 'machining', operationNo: '30', inputComponentIds: [ids.femaleBody], outputItemId: ids.femaleBody },
  { routeKey: 'r35', processId: 'machining', operationNo: '35', inputComponentIds: [ids.threadedBody], outputItemId: ids.threadedBody },
  { routeKey: 'r40', processId: 'machining', operationNo: '40', inputComponentIds: [ids.joint], outputItemId: ids.joint },
  { routeKey: 'r50', processId: 'ball-joint-preassembly', operationNo: '50', inputComponentIds: [ids.threadedBody, ids.joint, ids.bearing, ids.rearCover, ids.grease], outputItemId: ids.ballJoint },
  { routeKey: 'r60', processId: 'female-rod-assembly', operationNo: '60', inputComponentIds: [ids.tube, ids.femaleBody], outputItemId: ids.femaleRod },
  { routeKey: 'r70', processId: 'painting', operationNo: '70', inputComponentIds: [ids.femaleRod, ids.ballJoint, ids.paint], outputItemId: ROOT },
  { routeKey: 'r80', processId: 'post-paint-assembly', operationNo: '80', inputComponentIds: [ids.dustBoot], outputItemId: ids.ballJoint },
  { routeKey: 'r90', processId: 'retaining-ring-assembly', operationNo: '90', inputComponentIds: [ids.retainingRing, ids.springRing], outputItemId: ids.ballJoint },
  { routeKey: 'r100', processId: 'final-assembly', operationNo: '100', inputComponentIds: [ids.femaleRod, ids.ballJoint, ids.clamp, ids.bolt, ids.nut], outputItemId: ROOT },
  { routeKey: 'r110', processId: 'final-inspection', operationNo: '110', inputComponentIds: [], outputItemId: ROOT },
  { routeKey: 'r120', processId: 'packaging', operationNo: '120', inputComponentIds: [ids.packaging], outputItemId: ROOT }
];

const characteristics = [
  {
    id: 'CHAR-DUST-BOOT-SEATING',
    componentId: ids.dustBoot,
    routeKey: 'r80',
    processId: 'post-paint-assembly',
    classification: 'SC',
    name: 'Toz lastiği doğru oturma / yırtık / deformasyon',
    controlPlanIncluded: true,
    controlPlanRowId: 'CP-R80-DUST-BOOT'
  }
];

const pfmea = [
  {
    id: 'FMEA-R80-DUST-BOOT',
    componentId: ids.dustBoot,
    routeKey: 'r80',
    processId: 'post-paint-assembly',
    failureMode: 'Toz lastiği yırtık, deforme veya yuvasına eksik oturmuş',
    effect: 'Mafsala kir/su girişi ve erken fonksiyon kaybı',
    specialCharacteristic: 'SC',
    controlPlanCharacteristicId: 'CHAR-DUST-BOOT-SEATING',
    controlPlanRowId: 'CP-R80-DUST-BOOT'
  }
];

const records = Bom.normalizeComponents(rawComponents);
assert.equal(records.length, 17, 'Rot Kolu Sabit Ayarlı kabul BOM’u 17 kalem içermeli.');
assert.equal(new Set(records.map(item => item.id)).size, records.length, 'Normalize BOM kalıcı kimlikleri korumalı.');

const normalizationInput = { position: ' 15 ', itemNo: ' TY-DEN-015 ', name: ' Deneme Parçası ', quantity: '1,5' };
const normalizedOne = Bom.normalizeComponent(normalizationInput, 0);
assert.equal(normalizationInput.position, ' 15 ', 'normalizeComponent girdiyi değiştirmemeli.');
assert.equal(normalizedOne.position, '15');
assert.equal(normalizedOne.itemNo, 'TY-DEN-015');
assert.equal(normalizedOne.name, 'Deneme Parçası');
assert.equal(normalizedOne.quantity, 1.5, 'Türkçe ondalık miktar sayıya dönüştürülmeli.');
assert.equal(normalizedOne.parentId, ROOT, 'Üst kalemi olmayan kayıt ana mamule bağlanmalı.');

const forestResult = Bom.tree(records, ROOT);
const forest = Array.isArray(forestResult) ? forestResult : forestResult?.children;
assert.ok(Array.isArray(forest), 'tree() kök altında düğüm dizisi döndürmeli.');
assert.equal(forest.length, 7, 'Ana mamul altında 7 doğrudan BOM kalemi olmalı.');
const femaleRodNode = forest.find(node => node.id === ids.femaleRod);
const ballJointNode = forest.find(node => node.id === ids.ballJoint);
assert.equal(femaleRodNode?.children?.length, 2, 'Dişi Rot altında gövde ve boru olmalı.');
assert.equal(ballJointNode?.children?.length, 8, 'Rot Başı altında sekiz seçilmiş alt kalem olmalı.');

const pathText = value => (Array.isArray(value) ? value.map(item => typeof item === 'object' ? item.name || item.id : item).join(' > ') : String(value || ''));
const dustBootPath = pathText(Bom.path(records, ids.dustBoot, 'Rot Kolu Sabit Ayarlı'));
assert.match(dustBootPath, /Rot Kolu Sabit Ayarlı/);
assert.match(dustBootPath, /Rot Başı/);
assert.match(dustBootPath, /Toz Lastiği/);
assert.ok(dustBootPath.indexOf('Rot Başı') < dustBootPath.indexOf('Toz Lastiği'), 'BOM yolu üstten alta sıralanmalı.');

const descendantResult = Bom.descendants(records, ids.ballJoint);
const descendantIds = descendantResult.map(item => typeof item === 'object' ? item.id : item);
assert.equal(descendantIds.length, 8);
assert.ok(descendantIds.includes(ids.dustBoot));
assert.ok(descendantIds.includes(ids.bearing));
assert.equal(Bom.wouldCreateCycle(records, ids.femaleRod, ids.femaleBody), true, 'Alt montaj kendi altına taşınamaz.');
assert.equal(Bom.wouldCreateCycle(records, ids.femaleRod, ids.femaleRod), true, 'Kendi kendine üstlük döngüdür.');
assert.equal(Bom.wouldCreateCycle(records, ids.clamp, ids.femaleRod), false, 'Bağımsız kalem geçerli alt montaja taşınabilmeli.');

const flattened = Bom.flatten(records, 'Rot Kolu Sabit Ayarlı');
assert.equal(flattened.length, records.length);
const flatRoot = flattened.find(row => row.id === ids.ballJoint);
const flatDustBoot = flattened.find(row => row.id === ids.dustBoot);
assert.ok(Number(flatDustBoot.level) > Number(flatRoot.level), 'flatten() gerçek BOM seviyesini taşımalı.');
assert.match(pathText(flatDustBoot.path), /Rot Başı/);
assert.match(pathText(flatDustBoot.path), /Toz Lastiği/);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function issueArray(result) {
  if (Array.isArray(result)) return result;
  assert.ok(Array.isArray(result?.issues), 'validate() sorun dizisi veya { issues } döndürmeli.');
  return result.issues;
}

function canonicalCode(issue) {
  const value = typeof issue === 'string' ? issue : issue?.code || issue?.id || issue?.message || '';
  return String(value).trim().toLocaleUpperCase('en-US').replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function expectIssue(result, ...acceptedCodes) {
  const issues = issueArray(result);
  const actual = issues.map(canonicalCode);
  const accepted = acceptedCodes.map(canonicalCode);
  assert.ok(actual.some(code => accepted.some(expected => code === expected || code.includes(expected))), `Beklenen BOM bulgusu yok: ${accepted.join(' / ')}. Gerçek: ${actual.join(', ') || '(boş)'}`);
  return issues;
}

function validate(candidateRecords = records, overrides = {}) {
  return Bom.validate(candidateRecords, {
    route,
    characteristics,
    pfmea,
    strict: true,
    ...overrides
  });
}

const validIssues = issueArray(validate());
assert.equal(validIssues.length, 0, `Geçerli kabul BOM’u bulgu üretmemeli: ${validIssues.map(canonicalCode).join(', ')}`);

// Same position values at different hierarchy levels are deliberately valid.
assert.equal(records.filter(item => item.position === '10').length, 3);

const duplicatePosition = clone(records);
duplicatePosition.find(item => item.id === ids.bolt).position = duplicatePosition.find(item => item.id === ids.clamp).position;
expectIssue(validate(duplicatePosition), 'DUPLICATE_POSITION', 'DUPLICATE_SIBLING_POSITION');

const duplicateId = clone(records);
duplicateId.push({ ...duplicateId.find(item => item.id === ids.bearing), itemNo: 'TY-RB-YTK-DUP', position: '31' });
expectIssue(validate(duplicateId), 'DUPLICATE_ID', 'DUPLICATE_COMPONENT_ID');

const missingItemNo = clone(records);
missingItemNo.find(item => item.id === ids.bolt).itemNo = '';
expectIssue(validate(missingItemNo), 'MISSING_ITEM_NUMBER', 'MISSING_ITEM_NO');

for (const invalidQuantity of [0, -1]) {
  const invalid = clone(records);
  invalid.find(item => item.id === ids.nut).quantity = invalidQuantity;
  expectIssue(validate(invalid), 'INVALID_QUANTITY', 'NON_POSITIVE_QUANTITY');
}

const selfReference = clone(records);
selfReference.find(item => item.id === ids.femaleBody).parentId = ids.femaleBody;
expectIssue(validate(selfReference), 'SELF_REFERENCE', 'BOM_CYCLE');

const cycle = clone(records);
cycle.find(item => item.id === ids.femaleRod).parentId = ids.femaleBody;
expectIssue(validate(cycle), 'BOM_CYCLE', 'CYCLIC_BOM');

const orphan = clone(records);
orphan.find(item => item.id === ids.tube).parentId = 'MISSING-PARENT';
expectIssue(validate(orphan), 'ORPHAN_PARENT', 'MISSING_PARENT');

const invalidParentType = clone(records);
invalidParentType.find(item => item.id === ids.clamp).parentId = ids.bolt;
expectIssue(validate(invalidParentType), 'INVALID_PARENT_TYPE', 'PARENT_NOT_SUBASSEMBLY');

const revisionless = clone(records);
Object.assign(revisionless.find(item => item.id === ids.rearCover), { revision: '', drawingRevision: '' });
expectIssue(validate(revisionless), 'MISSING_DRAWING_REVISION', 'MISSING_REVISION');

const purchasedWithoutSupplier = clone(records);
purchasedWithoutSupplier.find(item => item.id === ids.bolt).supplier = '';
expectIssue(validate(purchasedWithoutSupplier), 'PURCHASED_SUPPLIER_MISSING', 'MISSING_SUPPLIER');

const internalWithoutProcess = clone(records);
internalWithoutProcess.find(item => item.id === ids.tube).producedAtProcessId = '';
expectIssue(validate(internalWithoutProcess, { route: route.filter(step => step.processId !== 'tube-forming') }), 'INTERNAL_PROCESS_UNASSIGNED', 'MISSING_PRODUCTION_PROCESS');

const criticalWithoutOperation = clone(records);
Object.assign(criticalWithoutOperation.find(item => item.id === ids.dustBoot), {
  mountedAtProcessId: '',
  firstUseProcessId: '',
  inspectedAtProcessId: '',
  operationLinkStatus: 'unassigned'
});
const routeWithoutDustBoot = route.map(step => ({ ...step, inputComponentIds: step.inputComponentIds.filter(id => id !== ids.dustBoot) }));
expectIssue(validate(criticalWithoutOperation, { route: routeWithoutDustBoot }), 'CRITICAL_OPERATION_UNASSIGNED', 'CRITICAL_COMPONENT_OPERATION_MISSING');

const missingSpecialControl = clone(characteristics);
Object.assign(missingSpecialControl[0], { controlPlanIncluded: false, controlPlanRowId: '' });
expectIssue(validate(records, { characteristics: missingSpecialControl }), 'SPECIAL_CHARACTERISTIC_MISSING_CONTROL', 'SPECIAL_CHARACTERISTIC_NOT_IN_CONTROL_PLAN');

const pfmeaWithoutControl = clone(pfmea);
Object.assign(pfmeaWithoutControl[0], { controlPlanCharacteristicId: 'CHAR-NOT-FOUND', controlPlanRowId: '' });
expectIssue(validate(records, { pfmea: pfmeaWithoutControl }), 'PFMEA_RISK_MISSING_CONTROL', 'PFMEA_CONTROL_PLAN_LINK_MISSING');

const wrongPaintOrder = clone(route);
const paintIndex = wrongPaintOrder.findIndex(step => step.processId === 'painting');
const postPaintIndex = wrongPaintOrder.findIndex(step => step.processId === 'post-paint-assembly');
const [postPaintStep] = wrongPaintOrder.splice(postPaintIndex, 1);
wrongPaintOrder.splice(paintIndex, 0, postPaintStep);
expectIssue(validate(records, { route: wrongPaintOrder }), 'PAINT_ORDER_VIOLATION', 'POST_PAINT_BEFORE_PAINT');

const unusedComponent = clone(records);
Object.assign(unusedComponent.find(item => item.id === ids.clamp), {
  firstUseProcessId: '',
  mountedAtProcessId: '',
  inspectedAtProcessId: '',
  operationLinkStatus: 'unassigned'
});
const routeWithoutComponent = route.map(step => ({ ...step, inputComponentIds: step.inputComponentIds.filter(id => id !== ids.clamp) }));
expectIssue(validate(unusedComponent, { route: routeWithoutComponent }), 'UNUSED_COMPONENT', 'OPERATION_UNASSIGNED');

const twoSelectedBearings = clone(records);
twoSelectedBearings.push(purchased({
  id: 'C-RB-YATAK-KAUCUK',
  partMasterId: 'PM-YATAK-KAUCUK',
  parentId: ids.ballJoint,
  position: '31',
  itemNo: 'TY-RB-YTK-029',
  name: 'Kauçuk Yatak',
  drawingNo: 'TR-RB-YTK-029',
  alternativeGroupId: 'BEARING-TYPE',
  alternativeSelected: true,
  firstUseProcessId: 'ball-joint-preassembly',
  mountedAtProcessId: 'ball-joint-preassembly'
}));
expectIssue(validate(twoSelectedBearings), 'ALTERNATIVE_SELECTION_INVALID', 'MULTIPLE_ALTERNATIVES_SELECTED');

const noSelectedBearing = clone(records);
noSelectedBearing.find(item => item.id === ids.bearing).alternativeSelected = false;
expectIssue(validate(noSelectedBearing), 'ALTERNATIVE_SELECTION_INVALID', 'ALTERNATIVE_SELECTION_REQUIRED');

const originalOrder = records.map(item => item.id).join('|');
const reorderedBefore = Bom.reorder(records, ids.nut, ids.clamp, 'before');
assert.notEqual(reorderedBefore, records, 'reorder() yeni bir dizi döndürmeli.');
assert.equal(records.map(item => item.id).join('|'), originalOrder, 'reorder() kaynak BOM dizisini değiştirmemeli.');
const reorderedTop = Bom.flatten(reorderedBefore, 'Rot Kolu Sabit Ayarlı').filter(row => row.parentId === ROOT).map(row => row.id);
assert.ok(reorderedTop.indexOf(ids.nut) < reorderedTop.indexOf(ids.clamp), 'before modu kardeş sırasını değiştirmeli.');

const reorderedInside = Bom.reorder(records, ids.clamp, ids.femaleRod, 'inside');
assert.equal(reorderedInside.find(item => item.id === ids.clamp).parentId, ids.femaleRod, 'inside modu kalemi hedef alt montaja bağlamalı.');
assert.equal(Bom.wouldCreateCycle(reorderedInside, ids.femaleRod, ids.clamp), true, 'Taşıma sonrası ters ilişki döngü olarak algılanmalı.');

const postPaintRoute = route.find(step => step.processId === 'post-paint-assembly');
const paintingRoute = route.find(step => step.processId === 'painting');
assert.ok(route.indexOf(paintingRoute) < route.indexOf(postPaintRoute));
assert.ok(postPaintRoute.inputComponentIds.includes(ids.dustBoot));
assert.equal(characteristics[0].componentId, ids.dustBoot);
assert.equal(characteristics[0].routeKey, postPaintRoute.routeKey);
assert.equal(pfmea[0].controlPlanCharacteristicId, characteristics[0].id);

console.log(JSON.stringify({
  product: 'Rot Kolu Sabit Ayarlı',
  components: records.length,
  topLevel: forest.length,
  femaleRodChildren: femaleRodNode.children.length,
  ballJointChildren: ballJointNode.children.length,
  selectedBearingAlternatives: records.filter(item => item.alternativeGroupId === 'BEARING-TYPE' && item.alternativeSelected).length,
  dustBootAfterPaint: true,
  validIssues: validIssues.length,
  negativeValidationScenarios: 19,
  treePathFlatten: true,
  reorder: true,
  downstreamTraceability: true
}));
