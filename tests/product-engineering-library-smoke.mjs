import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../data/product-engineering-library.json', import.meta.url), 'utf8');
const library = JSON.parse(source);
const processSeed = JSON.parse(await readFile(new URL('../seed-processes.json', import.meta.url), 'utf8'));

assert.equal(library.libraryId, 'tyana.product-engineering');
assert.equal(library.metadata.owner, 'TYANA OTOMOTİV');
assert.equal(library.metadata.defaultLocale, 'tr-TR');
assert.ok(library.metadata.plannedLocales.includes('en-US'));
assert.doesNotMatch(source, /d[ıi]ta[sş]/iu, 'Eski kuruluş ibaresi kütüphanede bulunamaz.');

const assertUniqueIds = (items, collectionName) => {
  const ids = items.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length, `${collectionName} içinde yinelenen ID var.`);
  assert.ok(ids.every(Boolean), `${collectionName} içinde boş ID var.`);
  return new Set(ids);
};

assert.equal(processSeed.length, 34, 'Başlangıç proses kütüphanesi 34 kayıt içermeli.');
assertUniqueIds(processSeed, 'seedProcesses');
assert.ok(processSeed.some(process => process.id === 'post-paint-assembly' && process.name === 'Boya Sonrası Montaj'), 'Boya sonrası montaj merkezi proses kütüphanesinde bulunmalı.');
for (const key of ['code', 'name']) {
  const values = processSeed.map(process => process[key]);
  assert.equal(new Set(values).size, values.length, `seedProcesses içinde yinelenen ${key} var.`);
}

const valueSetIds = assertUniqueIds(library.valueSets, 'valueSets');
const questionSetIds = assertUniqueIds(library.questionSets, 'questionSets');
const archetypeIds = assertUniqueIds(library.componentArchetypes, 'componentArchetypes');
const productGroupIds = assertUniqueIds(library.productGroups, 'productGroups');
assertUniqueIds(library.conditionalBindings, 'conditionalBindings');
assertUniqueIds(library.templates, 'templates');
assertUniqueIds(library.qualityGates, 'qualityGates');

const assertLocalized = (item, path, keyName = 'labelKey', labelsName = 'labels') => {
  assert.equal(typeof item[keyName], 'string', `${path}.${keyName} eksik.`);
  assert.ok(item[keyName].length > 2, `${path}.${keyName} geçersiz.`);
  assert.equal(typeof item[labelsName]?.['tr-TR'], 'string', `${path}.${labelsName}.tr-TR eksik.`);
  assert.ok(item[labelsName]['tr-TR'].trim(), `${path}.${labelsName}.tr-TR boş.`);
};

for (const valueSet of library.valueSets) {
  assertLocalized(valueSet, `valueSet:${valueSet.id}`);
  assert.ok(valueSet.options.length > 1, `${valueSet.id} en az iki seçenek içermeli.`);
  assertUniqueIds(valueSet.options, `${valueSet.id}.options`);
  valueSet.options.forEach(option => assertLocalized(option, `${valueSet.id}.option:${option.id}`));
}

const questionIds = new Set();
let numericFieldCount = 0;
let repeatingGroupCount = 0;

const validateQuestion = (question, path, isTopLevel = false) => {
  assert.equal(typeof question.id, 'string', `${path}.id eksik.`);
  assert.ok(library.contracts.questionTypes.includes(question.type), `${path}.type desteklenmiyor: ${question.type}`);
  assertLocalized(question, path);
  assert.equal(typeof question.required, 'boolean', `${path}.required boolean olmalı.`);

  if (isTopLevel) {
    assert.ok(!questionIds.has(question.id), `Yinelenen soru ID: ${question.id}`);
    questionIds.add(question.id);
  }

  if (question.valueSet) {
    assert.ok(valueSetIds.has(question.valueSet), `${path} bilinmeyen valueSet kullanıyor: ${question.valueSet}`);
  }

  if (['number', 'number_range', 'tolerance'].includes(question.type)) {
    numericFieldCount += 1;
    assert.equal(typeof question.numeric, 'object', `${path} sayısal sözleşme içermeli.`);
    assert.ok(
      question.numeric.unit || Array.isArray(question.numeric.unitSelectable) || Number.isFinite(question.numeric.precision),
      `${path} birim veya hassasiyet tanımlamalı.`
    );
  }

  if (question.type === 'repeating_group') {
    repeatingGroupCount += 1;
    assert.ok(Array.isArray(question.fields) && question.fields.length > 0, `${path} alan içermeli.`);
    const fieldIds = question.fields.map(field => field.id);
    assert.equal(new Set(fieldIds).size, fieldIds.length, `${path} içinde yinelenen alan ID var.`);
    question.fields.forEach(field => validateQuestion(field, `${path}.field:${field.id}`, false));
  }
};

for (const questionSet of library.questionSets) {
  assert.equal(typeof questionSet.titleKey, 'string', `${questionSet.id}.titleKey eksik.`);
  assert.ok(questionSet.titles?.['tr-TR'], `${questionSet.id}.titles.tr-TR eksik.`);
  assert.equal(typeof questionSet.fixed, 'boolean', `${questionSet.id}.fixed boolean olmalı.`);
  assert.ok(Array.isArray(questionSet.questions) && questionSet.questions.length > 0, `${questionSet.id} soru içermeli.`);
  questionSet.questions.forEach(question => validateQuestion(question, `${questionSet.id}.${question.id}`, true));
}

assert.ok(questionIds.size >= 100, 'Teknik resim ve ürün sorgu omurgası yeterince kapsamlı değil.');
assert.ok(numericFieldCount >= 25, 'Sayısal giriş omurgası yeterince kapsamlı değil.');
assert.ok(repeatingGroupCount >= 20, 'Çok satırlı teknik veri yapısı yeterince kapsamlı değil.');

for (const archetype of library.componentArchetypes) {
  assertLocalized(archetype, `archetype:${archetype.id}`);
  assert.ok(archetype.defaultStage, `${archetype.id}.defaultStage eksik.`);
  assert.ok(archetype.defaultPrimaryMethod, `${archetype.id}.defaultPrimaryMethod eksik.`);
  assert.ok(archetype.defaultRawForm, `${archetype.id}.defaultRawForm eksik.`);
  assert.ok(archetype.questionSetIds.length > 0, `${archetype.id} soru seti içermeli.`);
  archetype.questionSetIds.forEach(id => assert.ok(questionSetIds.has(id), `${archetype.id} bilinmeyen soru setine bağlı: ${id}`));
  (archetype.requiredUpstreamArchetypeIds || []).forEach(id => assert.ok(archetypeIds.has(id), `${archetype.id} bilinmeyen üst arketipe bağlı: ${id}`));
}

const requiredProductGroups = [
  'steering',
  'suspension',
  'braking',
  'powertrain',
  'chassis-connection',
  'machined-products',
  'welded-products',
  'cast-products',
  'formed-products',
  'polymer-elastomer',
  'electrical-mechatronic',
  'service-kits',
  'custom-product'
];
requiredProductGroups.forEach(id => assert.ok(productGroupIds.has(id), `Zorunlu ürün grubu eksik: ${id}`));
const legacyAliases = library.productGroups.flatMap(group => group.legacyAliases || []);
assert.equal(new Set(legacyAliases).size, legacyAliases.length, 'Ürün grubu eski ID eşlemelerinde çakışma var.');
['chassis', 'machined', 'welded', 'cast', 'formed', 'polymer', 'electrical', 'service', '__custom__']
  .forEach(alias => assert.ok(legacyAliases.includes(alias), `Mevcut uygulama ürün grubu eşlemesi eksik: ${alias}`));

for (const productGroup of library.productGroups) {
  assertLocalized(productGroup, `productGroup:${productGroup.id}`);
  assert.ok(productGroup.productTypes.length > 0, `${productGroup.id} ürün tipi içermeli.`);
  assertUniqueIds(productGroup.productTypes, `${productGroup.id}.productTypes`);
  for (const productType of productGroup.productTypes) {
    assertLocalized(productType, `${productGroup.id}.productType:${productType.id}`);
    assert.ok(productType.defaultStructure, `${productGroup.id}.${productType.id}.defaultStructure eksik.`);
    assert.ok(productType.recommendedArchetypeIds.length > 0, `${productGroup.id}.${productType.id} arketip önermeli.`);
    productType.recommendedArchetypeIds.forEach(id => assert.ok(archetypeIds.has(id), `${productGroup.id}.${productType.id} bilinmeyen arketip kullanıyor: ${id}`));
  }
  assert.ok(productGroup.fixedQuestionSetIds.length >= 5, `${productGroup.id} sabit soru omurgası yetersiz.`);
  productGroup.fixedQuestionSetIds.forEach(id => assert.ok(questionSetIds.has(id), `${productGroup.id} bilinmeyen soru setine bağlı: ${id}`));
  assert.ok(productGroup.recommendedProcessFamilies.length >= 3, `${productGroup.id} proses omurgası yetersiz.`);
}

for (const binding of library.conditionalBindings) {
  assert.ok(library.contracts.conditionOperators.includes(binding.when.operator), `${binding.id} geçersiz koşul operatörü kullanıyor.`);
  assert.ok(binding.when.path, `${binding.id}.when.path eksik.`);
  (binding.addQuestionSetIds || []).forEach(id => assert.ok(questionSetIds.has(id), `${binding.id} bilinmeyen soru setine bağlı: ${id}`));
}

for (const template of library.templates) {
  assertLocalized(template, `template:${template.id}`);
  assert.ok(productGroupIds.has(template.productGroupId), `${template.id} bilinmeyen ürün grubuna bağlı.`);
  (template.components || []).forEach(component => assert.ok(archetypeIds.has(component.archetypeId), `${template.id} bilinmeyen arketip kullanıyor: ${component.archetypeId}`));
}

const forgedBlank = library.componentArchetypes.find(item => item.id === 'archetype.forged-blank-body');
const machinedBody = library.componentArchetypes.find(item => item.id === 'archetype.machined-body-from-forging');
assert.equal(forgedBlank.defaultStage, 'blank');
assert.equal(forgedBlank.defaultPrimaryMethod, 'hot-forging');
assert.equal(machinedBody.defaultStage, 'finished-machined');
assert.equal(machinedBody.defaultPrimaryMethod, 'machining');
assert.equal(machinedBody.defaultRawForm, 'forged-blank');
assert.ok(machinedBody.requiredUpstreamArchetypeIds.includes(forgedBlank.id));

const steeringDemo = library.templates.find(item => item.id === 'template.steering-rod-demo');
assert.equal(steeringDemo.exampleOnly, true);
assert.ok(steeringDemo.components.some(item => item.materialExample.includes('ST52')));
assert.ok(steeringDemo.components.some(item => item.materialExample.includes('41Cr4')));
assert.ok(steeringDemo.components.some(item => item.materialExample.includes('C45')));
assert.ok(library.templates.some(item => item.id === 'template.blank-product' && item.components.length === 0));

for (const gate of library.qualityGates) {
  assertLocalized(gate, `qualityGate:${gate.id}`);
  assert.ok(['block', 'warn'].includes(gate.severity), `${gate.id}.severity geçersiz.`);
  assert.ok(gate.checks.length >= 3, `${gate.id} yeterli doğrulama maddesi içermiyor.`);
}

console.log(JSON.stringify({
  library: library.libraryId,
  version: library.libraryVersion,
  valueSets: library.valueSets.length,
  questionSets: library.questionSets.length,
  questions: questionIds.size,
  numericFields: numericFieldCount,
  repeatingGroups: repeatingGroupCount,
  archetypes: library.componentArchetypes.length,
  productGroups: library.productGroups.length,
  conditionalBindings: library.conditionalBindings.length,
  qualityGates: library.qualityGates.length,
  status: 'PASS'
}, null, 2));
