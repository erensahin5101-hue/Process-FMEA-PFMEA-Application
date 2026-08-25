import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../data/quality-document-library.json', import.meta.url), 'utf8');
const library = JSON.parse(source);

assert.equal(library.schemaVersion, '1.0.0');
assert.equal(library.libraryId, 'tyana.qflow.quality-document-examples');
assert.equal(library.productName, 'TYANA Q-FLOW');
assert.deepEqual(
  {
    legalName: library.organization.legalName,
    shortName: library.organization.shortName,
    plant: library.organization.plant,
    brand: library.organization.brand,
    activeCustomer: library.organization.activeCustomer
  },
  {
    legalName: 'Anonimleştirilmiş Kaynak Kuruluş',
    shortName: 'Kaynak Kuruluş',
    plant: 'Kaynak Tesis',
    brand: 'TYANA Q-FLOW',
    activeCustomer: ''
  }
);
assert.equal(library.brandingPolicy.tenantProfileIsAuthoritative, false);
assert.equal(library.brandingPolicy.sourceDocumentBrandingImported, false);
assert.equal(library.brandingPolicy.sourceOfficeMetadataImported, false);
assert.equal(library.brandingPolicy.sourceHyperlinksImported, false);
assert.doesNotMatch(source, /192\.168\.51\.9|Ditas_Ortak|file:\/\/\//i, 'Kaynak UNC bağlantısı kütüphaneye taşınamaz.');

const uniqueIds = (items, name) => {
  assert.ok(Array.isArray(items) && items.length, `${name} boş olamaz.`);
  const ids = items.map(item => item.id);
  assert.ok(ids.every(Boolean), `${name} içinde boş id var.`);
  assert.equal(new Set(ids).size, ids.length, `${name} içinde yinelenen id var.`);
  return new Set(ids);
};

assert.equal(library.sourceControlPlans.length, 2);
assert.equal(library.sourceOperatorInstructions.length, 10);
assert.equal(library.productApplicability.length, 2);
assert.equal(library.instructionPresets.length, 10);
assert.equal(library.operationPresets.length, 10);

const controlPlanIds = uniqueIds(library.sourceControlPlans, 'sourceControlPlans');
const sourceInstructionIds = uniqueIds(library.sourceOperatorInstructions, 'sourceOperatorInstructions');
const productIds = uniqueIds(library.productApplicability, 'productApplicability');
const samplingRuleIds = uniqueIds(library.samplingRules, 'samplingRules');
const measurementMethodIds = uniqueIds(library.measurementMethods, 'measurementMethods');
const recordFormIds = uniqueIds(library.recordForms, 'recordForms');
const reactionPlanIds = uniqueIds(library.reactionPlans, 'reactionPlans');
const ppeProfileIds = uniqueIds(library.ppeProfiles, 'ppeProfiles');
const safetyProfileIds = uniqueIds(library.safetyProfiles, 'safetyProfiles');
const instructionPresetIds = uniqueIds(library.instructionPresets, 'instructionPresets');
const operationPresetIds = uniqueIds(library.operationPresets, 'operationPresets');
const validationCodes = new Set(library.validationRules.map(rule => rule.code));
assert.equal(validationCodes.size, library.validationRules.length, 'validationRules kodları benzersiz olmalı.');

for (const plan of library.sourceControlPlans) {
  assert.match(plan.sha256, /^[A-F0-9]{64}$/);
  assert.ok(plan.pageCount >= 1);
  assert.equal(plan.externalLinksImported, false);
  plan.applicableProductIds.forEach(id => assert.ok(productIds.has(id), `${plan.id}: bilinmeyen ürün ${id}`));
}
assert.ok(controlPlanIds.has('cp.806') && controlPlanIds.has('cp.807'));

const expectedTtiNumbers = Array.from({ length: 10 }, (_, index) => `TTI-${2266 + index}`);
assert.deepEqual(library.sourceOperatorInstructions.map(item => item.instructionNo).sort(), expectedTtiNumbers);
for (const instruction of library.sourceOperatorInstructions) {
  assert.match(instruction.sha256, /^[A-F0-9]{64}$/);
  assert.ok(instruction.machines.length > 0);
  instruction.productIds.forEach(id => assert.ok(productIds.has(id), `${instruction.id}: bilinmeyen ürün ${id}`));
}

for (const product of library.productApplicability) {
  assert.ok(controlPlanIds.has(product.controlPlanId));
  assert.ok(product.drawingRefs.length > 0);
  product.instructionIds.forEach(id => assert.ok(sourceInstructionIds.has(id), `${product.id}: bilinmeyen TTI ${id}`));
}
const socketBody = library.productApplicability.find(item => item.id === 'product.socket-body-family');
assert.deepEqual(socketBody.drawingRefs.map(item => [item.number, item.variant]), [['A3-8976', 'right'], ['A3-9149', 'left']]);

const requiredOperationCodes = ['202', '301', '303', '304', '321', '322', '355', '356', '435', '519'];
assert.deepEqual(library.operationPresets.map(item => item.code).sort(), requiredOperationCodes);
assert.equal(new Set(library.operationPresets.map(item => item.code)).size, library.operationPresets.length);

const allCharacteristics = [];
for (const operation of library.operationPresets) {
  assert.ok(operationPresetIds.has(operation.id));
  assert.ok(operation.nameTR && operation.nameEN && operation.family);
  assert.ok(safetyProfileIds.has(operation.safetyProfileId));
  assert.ok(operation.applicationProfiles.length > 0);
  for (const profile of operation.applicationProfiles) {
    profile.productIds.forEach(id => assert.ok(productIds.has(id), `${profile.id}: bilinmeyen ürün ${id}`));
    if (profile.instructionPresetId) assert.ok(instructionPresetIds.has(profile.instructionPresetId));
    assert.ok(profile.machines.length > 0);
    assert.ok(profile.characteristics.length > 0);
    allCharacteristics.push(...profile.characteristics);
  }
}

assert.equal(allCharacteristics.length, 54, 'İki kontrol planındaki 54 mantıksal karakteristik korunmalı.');
const characteristicIds = new Set(allCharacteristics.map(item => item.id));
assert.equal(characteristicIds.size, allCharacteristics.length, 'Karakteristik id değerleri benzersiz olmalı.');

for (const characteristic of allCharacteristics) {
  assert.ok(['product', 'process'].includes(characteristic.kind), `${characteristic.id}: karakteristik türü geçersiz.`);
  assert.ok(characteristic.nameTR && characteristic.nameEN);
  assert.ok(characteristic.spec?.raw?.trim(), `${characteristic.id}: raw şart eksik.`);
  assert.ok(characteristic.spec?.normalized?.type, `${characteristic.id}: normalize şart tipi eksik.`);
  assert.ok(characteristic.spec.normalized.verificationStatus, `${characteristic.id}: doğrulama durumu eksik.`);
  if (Number.isFinite(characteristic.spec.normalized.lower) && Number.isFinite(characteristic.spec.normalized.upper)) {
    assert.ok(characteristic.spec.normalized.lower <= characteristic.spec.normalized.upper, `${characteristic.id}: alt limit üst limitten büyük.`);
  }
  assert.ok(samplingRuleIds.has(characteristic.sampling.ruleId), `${characteristic.id}: bilinmeyen numune kuralı.`);
  assert.ok(Object.hasOwn(characteristic.sampling, 'quantity'), `${characteristic.id}: numune adedi alanı eksik.`);
  assert.ok(characteristic.measurementMethodIds.length > 0);
  characteristic.measurementMethodIds.forEach(id => assert.ok(measurementMethodIds.has(id), `${characteristic.id}: bilinmeyen ölçüm yöntemi ${id}`));
  assert.ok(recordFormIds.has(characteristic.recordFormId), `${characteristic.id}: bilinmeyen kayıt formu.`);
  assert.ok(reactionPlanIds.has(characteristic.reactionPlanId), `${characteristic.id}: bilinmeyen reaksiyon planı.`);
  assert.ok(characteristic.sourceRefs.length > 0);
  characteristic.warningCodes.forEach(code => assert.ok(validationCodes.has(code), `${characteristic.id}: bilinmeyen uyarı ${code}`));
}

for (const preset of library.instructionPresets) {
  assert.ok(sourceInstructionIds.has(preset.sourceInstructionId));
  assert.ok(requiredOperationCodes.includes(preset.operationCode));
  assert.ok(samplingRuleIds.has(preset.generalSamplingRuleId));
  assert.ok(ppeProfileIds.has(preset.ppeProfileId));
  assert.ok(safetyProfileIds.has(preset.safetyProfileId));
  preset.productIds.forEach(id => assert.ok(productIds.has(id)));
  preset.characteristicPresetIds.forEach(id => assert.ok(characteristicIds.has(id), `${preset.id}: bilinmeyen karakteristik ${id}`));
}

const requiredValidationCodes = [
  'RHT_CALIPER_METHOD',
  'UV_UNIT_INCONSISTENCY',
  'ANGLE_RESOLUTION_MISMATCH',
  'SAMPLING_CONTRADICTION',
  'SPECIAL_CHARACTERISTIC_LEGEND_MISSING',
  'DITTO_VALUE_INHERITANCE'
];
requiredValidationCodes.forEach(code => assert.ok(validationCodes.has(code), `Zorunlu doğrulama kuralı eksik: ${code}`));
for (const rule of library.validationRules) {
  assert.ok(['block', 'warn'].includes(rule.severity));
  assert.ok(rule.messageTR?.trim());
  assert.ok(rule.affectedEntityIds.length > 0);
}

const findCharacteristic = id => allCharacteristics.find(item => item.id === id);
for (const id of ['ch.202.socket.02', 'ch.202.ball.02']) {
  const item = findCharacteristic(id);
  assert.ok(item.measurementMethodIds.includes('measure.caliper-001'));
  assert.ok(item.warningCodes.includes('RHT_CALIPER_METHOD'));
}
const uv = findCharacteristic('ch.519.ball.01');
assert.match(uv.spec.raw, /w\/cm²/i);
assert.match(uv.spec.raw, /µw\/cm²/i);
assert.equal(uv.spec.normalized.verificationStatus, 'blocked');
assert.ok(uv.warningCodes.includes('UV_UNIT_INCONSISTENCY'));
const angle = findCharacteristic('ch.303.socket.05');
assert.ok(angle.measurementMethodIds.includes('measure.angle-protractor-5min'));
assert.ok(angle.warningCodes.includes('ANGLE_RESOLUTION_MISMATCH'));
assert.ok(allCharacteristics.some(item => item.warningCodes.includes('DITTO_VALUE_INHERITANCE')));
assert.ok(allCharacteristics.some(item => item.specialClassRaw?.includes('§')));

const samplingConflict = library.validationRules.find(rule => rule.code === 'SAMPLING_CONTRADICTION');
assert.equal(samplingConflict.affectedEntityIds.length, 10);
const generalSampling = library.samplingRules.find(rule => rule.id === 'sample.tti-general');
assert.equal(generalSampling.conflictPolicy, 'block-until-resolved');
assert.equal(generalSampling.triggers.length, 4);

const ppe = library.ppeProfiles.find(item => item.id === 'ppe.tti-common');
for (const id of ['safety-shoes', 'work-clothing', 'gloves', 'hearing-protection', 'eye-protection']) assert.ok(ppe.selected.includes(id));
assert.ok(ppe.warningCodes.includes('PPE_GLOVE_ROTATING_MACHINE'));
for (const safety of library.safetyProfiles) {
  assert.ok(ppeProfileIds.has(safety.ppeProfileId));
  assert.ok(safety.hazards.length > 0 && safety.mandatoryRules.length > 0);
}

console.log(JSON.stringify({
  libraryId: library.libraryId,
  controlPlans: library.sourceControlPlans.length,
  sourceInstructions: library.sourceOperatorInstructions.length,
  instructionPresets: library.instructionPresets.length,
  operationPresets: library.operationPresets.length,
  characteristics: allCharacteristics.length,
  validationRules: library.validationRules.length,
  status: 'PASS'
}, null, 2));
