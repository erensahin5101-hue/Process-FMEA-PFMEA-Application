import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = await readFile(resolve(root, 'data', 'pfmea-engineering-library.json'), 'utf8');
const library = JSON.parse(source);

assert.equal(library.schemaVersion, '1.2.0');
assert.equal(library.library.publisher, 'TYANA OTOMOTİV');
assert.equal(library.i18n.defaultLocale, 'tr-TR');
assert.ok(library.i18n.plannedLocales.includes('en-US'));

for (const capability of ['allowAdd', 'allowDelete', 'allowDuplicate', 'allowReorder', 'allowCustomValue', 'preserveUserOverridesOnLibraryRefresh']) {
  assert.equal(library.selectionModel[capability], true, `${capability} etkin olmalı`);
}

assert.equal(library.ratingPolicy.defaultsAreDraft, true);
assert.equal(library.ratingPolicy.actionPriorityRequiresUserSelection, true);
assert.equal(library.ratingPolicy.automaticActionPriority, false);
assert.deepEqual([library.ratingPolicy.scaleMin, library.ratingPolicy.scaleMax], [1, 10]);
assert.equal(library.ratingGuides.profile, 'PFMEA_PROCESS_10_POINT');
assert.match(library.ratingGuides.selectionRuleTR, /ekip tarafından seçilir/);
for (const dimension of ['severity', 'occurrence', 'detection']) {
  const guide = library.ratingGuides[dimension];
  assert.equal(guide.length, 10, `${dimension} rehberi 10 puan içermeli`);
  assert.deepEqual([...guide.map(item => item.score)].sort((a, b) => a - b), [1,2,3,4,5,6,7,8,9,10]);
  for (const item of guide) {
    assert.ok(item.labelTR && item.criterionTR && item.evidencePromptTR, `${dimension}.${item.score} kriter, açıklama ve kanıt sorusu taşımalı`);
  }
}
assert.equal(library.ratingGuides.actionPriorityBands.length, 5);
function suggestedAp(s, o, d) {
  const sBand = library.ratingGuides.actionPriorityBands.find(band => s >= band.sMin && s <= band.sMax);
  const oBand = sBand?.rows.find(row => o >= row.oMin && o <= row.oMax);
  return oBand?.d.find(([min, max]) => d >= min && d <= max)?.[2] || '';
}
for (let s = 1; s <= 10; s += 1) for (let o = 1; o <= 10; o += 1) for (let d = 1; d <= 10; d += 1) {
  assert.match(suggestedAp(s, o, d), /^[HML]$/, `AP matrisi S${s}/O${o}/D${d} hücresini kapsamalı`);
}
assert.equal(suggestedAp(10, 10, 10), 'H');
assert.equal(suggestedAp(9, 4, 1), 'M');
assert.equal(suggestedAp(7, 2, 4), 'L');
assert.equal(suggestedAp(1, 10, 10), 'L');
assert.deepEqual(library.methodFramework.planning.required5T, ['intent', 'timing', 'team', 'task', 'tool']);
assert.deepEqual(library.methodFramework.structureLevels.map(item => item.id), ['process-item', 'process-step', 'work-element']);
assert.deepEqual(library.methodFramework.workElementTypes.map(item => item.id), ['MAN', 'MACHINE', 'METHOD', 'MATERIAL']);
assert.deepEqual(library.methodFramework.effectLevels.map(item => item.id), ['own-plant', 'ship-to-plant', 'end-user']);
assert.ok(library.methodFramework.optimizationStatuses.includes('Uygulanmadı'));
for (const field of ['processItem', 'processStep', 'workElementType', 'workElement', 'effectOwnPlant', 'effectShipToPlant', 'effectEndUser', 'ratingTableRef']) {
  assert.ok(library.selectionModel.requiredBeforeRelease.includes(field), `${field} yayın öncesi zorunlu olmalı`);
}

const phases = library.processBackbone;
const families = library.processFamilies;
const processes = library.processTemplates;
const risks = library.riskTemplates;
assert.ok(phases.length >= 8, 'Proses omurgası en az sekiz faz içermeli');
assert.ok(families.length >= 12, 'UI filtrelemesi için proses aileleri tanımlı olmalı');
assert.ok(processes.length >= 25, 'Mühendislik kütüphanesi en az 25 proses şablonu içermeli');
assert.ok(risks.length >= 30, 'PFMEA kütüphanesi en az 30 seçilebilir risk şablonu içermeli');

const processIds = new Set(processes.map((process) => process.id));
const phaseIds = new Set(phases.map((phase) => phase.id));
const familyIds = new Set(families.map((family) => family.id));
const ownerRoleIds = new Set(library.ownerRoles.map((role) => role.id));
const evidenceTypeIds = new Set(library.evidenceTypes.map((evidence) => evidence.id));
const specialCharacteristicTypeIds = new Set(library.specialCharacteristicTypes.map((type) => type.id));
assert.equal(processIds.size, processes.length, 'Proses kimlikleri benzersiz olmalı');
assert.equal(phaseIds.size, phases.length, 'Faz kimlikleri benzersiz olmalı');
assert.equal(familyIds.size, families.length, 'Proses ailesi kimlikleri benzersiz olmalı');

const requiredProcessIds = [
  'hot-forging',
  'cnc-turning',
  'furnace-heat-treatment',
  'surface-coating',
  'robotic-welding',
  'rubber-molding',
  'plastic-injection',
  'integrated-plant-assembly',
  'post-paint-assembly',
  'leak-functional-test',
  'packaging-shipping'
];
for (const id of requiredProcessIds) assert.ok(processIds.has(id), `Zorunlu proses eksik: ${id}`);

const workElementIds = new Set();
for (const process of processes) {
  assert.ok(phaseIds.has(process.phaseId), `${process.id} geçerli faza bağlanmalı`);
  assert.ok(familyIds.has(process.familyId), `${process.id} geçerli proses ailesine bağlanmalı`);
  assert.ok(process.nameTR && process.nameKey, `${process.id} TR metin ve çeviri anahtarı taşımalı`);
  assert.ok(process.inputTR && process.inputKey && process.outputTR && process.outputKey, `${process.id} girdi/çıktı tanımı taşımalı`);
  assert.ok(Array.isArray(process.workElements) && process.workElements.length, `${process.id} iş elemanı içermeli`);
  assert.ok(Array.isArray(process.selectableCharacteristics) && process.selectableCharacteristics.length, `${process.id} seçilebilir karakteristik içermeli`);
  for (const workElement of process.workElements) {
    assert.ok(!workElementIds.has(workElement.id), `İş elemanı kimliği benzersiz olmalı: ${workElement.id}`);
    workElementIds.add(workElement.id);
    for (const field of ['code', 'nameTR', 'nameKey', 'functionTR', 'functionKey']) assert.ok(workElement[field], `${workElement.id}.${field} zorunlu`);
  }
}

for (const phase of phases) {
  for (const processId of phase.processTemplateIds) assert.ok(processIds.has(processId), `${phase.id} bilinmeyen prosese bağlanamaz: ${processId}`);
}

const riskIds = new Set();
const riskCoverage = new Set();
const workElementProcessIds = new Map();
for (const process of processes) for (const workElement of process.workElements) workElementProcessIds.set(workElement.id, process.id);
const localizedFields = ['function', 'failureMode', 'reactionPlan'];
const optionFields = ['effects', 'causes', 'preventionControls', 'detectionControls', 'recommendedActions'];
for (const risk of risks) {
  assert.ok(!riskIds.has(risk.id), `Risk kimliği benzersiz olmalı: ${risk.id}`);
  riskIds.add(risk.id);
  riskCoverage.add(risk.processTemplateId);
  assert.ok(processIds.has(risk.processTemplateId), `${risk.id} geçerli prosese bağlanmalı`);
  assert.ok(workElementIds.has(risk.workElementId), `${risk.id} geçerli iş elemanına bağlanmalı`);
  assert.equal(workElementProcessIds.get(risk.workElementId), risk.processTemplateId, `${risk.id} iş elemanı aynı prosese ait olmalı`);
  for (const field of localizedFields) {
    assert.ok(risk[field]?.tr?.trim(), `${risk.id}.${field}.tr zorunlu`);
    assert.ok(risk[field]?.key?.trim(), `${risk.id}.${field}.key zorunlu`);
  }
  for (const field of optionFields) {
    assert.ok(Array.isArray(risk[field]) && risk[field].length, `${risk.id}.${field} en az bir seçim içermeli`);
    for (const option of risk[field]) assert.ok(option.tr?.trim() && option.key?.trim(), `${risk.id}.${field} seçenekleri TR metin ve anahtar taşımalı`);
  }
  for (const rating of ['severity', 'occurrence', 'detection']) {
    assert.ok(Number.isInteger(risk.defaultRatings[rating]), `${risk.id}.${rating} tam sayı olmalı`);
    assert.ok(risk.defaultRatings[rating] >= 1 && risk.defaultRatings[rating] <= 10, `${risk.id}.${rating} 1-10 aralığında olmalı`);
  }
  assert.equal(risk.defaultRatings.status, 'draft', `${risk.id} varsayılan puanları taslak olmalı`);
  assert.ok(risk.defaultRatings.rationale?.tr && risk.defaultRatings.rationale?.key, `${risk.id} puan gerekçesi taşımalı`);
  assert.ok(Array.isArray(risk.specialCharacteristic.selectableTypes) && risk.specialCharacteristic.selectableTypes.length, `${risk.id} özel karakteristik seçenekleri taşımalı`);
  assert.ok(risk.specialCharacteristic.selectableTypes.includes(risk.specialCharacteristic.defaultType), `${risk.id} varsayılan özel karakteristiği seçeneklerde bulunmalı`);
  for (const typeId of risk.specialCharacteristic.selectableTypes) assert.ok(specialCharacteristicTypeIds.has(typeId), `${risk.id} bilinmeyen özel karakteristik türü içeremez: ${typeId}`);
  assert.ok(Array.isArray(risk.ownerRoles) && risk.ownerRoles.length, `${risk.id} sorumlu rol içermeli`);
  assert.ok(Array.isArray(risk.evidenceTypeIds) && risk.evidenceTypeIds.length, `${risk.id} kanıt türü içermeli`);
  for (const roleId of risk.ownerRoles) assert.ok(ownerRoleIds.has(roleId), `${risk.id} bilinmeyen sorumlu role bağlanamaz: ${roleId}`);
  for (const evidenceId of risk.evidenceTypeIds) assert.ok(evidenceTypeIds.has(evidenceId), `${risk.id} bilinmeyen kanıt türüne bağlanamaz: ${evidenceId}`);
}

for (const processId of processIds) assert.ok(riskCoverage.has(processId), `Her proses en az bir PFMEA risk şablonuyla kapsanmalı: ${processId}`);

assert.ok(!source.includes('D\u0130TA\u015e'), 'Eski marka ibaresi kütüphanede yer almamalı');
assert.ok(!source.includes('DITAS'), 'Eski marka ASCII ibaresi kütüphanede yer almamalı');

console.log(`PFMEA library smoke OK: ${phases.length} faz, ${families.length} aile, ${processes.length} proses, ${risks.length} risk şablonu.`);
