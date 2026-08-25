import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

const libraryUrl = new URL('../data/operation-code-library.tr-en.v1.0.0.json', import.meta.url);
const sourceUrl = new URL('../kalite_dök/OPERASYON KODLARI.xls', import.meta.url);
const libraryBytes = await readFile(libraryUrl);
assert.notDeepEqual([...libraryBytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'JSON UTF-8 BOM içermemeli.');
const library = JSON.parse(libraryBytes.toString('utf8'));

assert.equal(library.schema, 'tyana.qflow.operation-code-library/v1');
assert.equal(library.schemaVersion, '1.1.0');
assert.equal(library.libraryId, 'tyana.qflow.operation-codes.tr-en');
assert.equal(library.organization.shortName, 'TYANA Q-FLOW');
assert.equal(library.libraryVersion, '2026.07.18');
assert.equal(library.productName, 'TYANA Q-FLOW');
assert.deepEqual(library.organization, { shortName: 'TYANA Q-FLOW', plant: 'Kullanıcı tanımlı tesis' });
assert.deepEqual(library.locales, ['tr-TR', 'en-US']);
assert.equal(library.defaultLocale, 'tr-TR');

assert.deepEqual(library.source.header, {
  sourceRow: 1,
  code: 'Std.ahtr',
  tr: 'Metne ilişkin referans anahtar',
  en: null
});
assert.equal(library.source.fileName, 'OPERASYON KODLARI.xls');
assert.equal(library.source.relativePath, 'kalite_dök/OPERASYON KODLARI.xls');
assert.equal(library.source.worksheet, 'Standart_metin_anahtarı');
assert.equal(library.source.dataRange, 'A2:C381');
assert.match(library.source.sha256, /^[a-f0-9]{64}$/);
assert.match(library.source.recordsSha256, /^[a-f0-9]{64}$/);

const sourceBytes = await readFile(sourceUrl);
const sourceStats = await stat(sourceUrl);
assert.equal(sourceBytes.length, 70_144);
assert.equal(sourceStats.size, library.source.sizeBytes);
assert.equal(createHash('sha256').update(sourceBytes).digest('hex'), library.source.sha256, 'Kaynak XLS SHA-256 değişti; kütüphane yeniden çıkarılmalı.');

assert.equal(library.operations.length, 380);
assert.equal(library.statistics.sourceRows, 380);
assert.equal(library.statistics.usableEntries, 380);
assert.equal(library.statistics.uniqueCodes, 380);
assert.equal(library.statistics.numericCodes, 373);
assert.equal(library.statistics.alphanumericCodes, 7);
assert.equal(library.statistics.edgeWhitespaceRows, 14);
assert.equal(library.statistics.reviewRequiredRows, 55);
assert.equal(library.statistics.mappingAmbiguityGroups, 16);
assert.equal(library.statistics.completeProcessCards, 380);
assert.equal(library.statistics.selectableProcessCards, 380);
assert.equal(library.statistics.machineClasses, 34);
assert.equal(library.statistics.documentedMachineBindings, 10);
assert.equal(library.statistics.machineClassApprovalRequired, 370);
assert.equal(library.statistics.lowConfidenceCardMappings, 0);

assert.equal(library.machineLibraryContract.schema, 'tyana.qflow.machine-register/v1');
assert.equal(library.machineLibraryContract.bindingKey, 'machineId');
assert.equal(library.machineLibraryContract.classBindingKey, 'machineClassId');
assert.ok(library.machineLibraryContract.requiredMachineFields.includes('calibrationStatus'));
assert.equal(library.machineClasses.length, 34);
assert.equal(library.machineRegisterSeeds.length, 33);
assert.ok(library.machineRegisterSeeds.every(seed => seed.machineId && seed.machineClassIds?.length && seed.supportedOperationCodes?.length && seed.sourceRefs?.length && seed.calibrationStatus && seed.qualificationStatus));
assert.equal(new Set(library.machineRegisterSeeds.map(seed => seed.machineId)).size, library.machineRegisterSeeds.length);
assert.ok(library.machineRegisterSeeds.every(seed => seed.sourceEvidenceStatus === 'documented-source-example'));
const canonicalProcessIds = new Set(library.machineClasses.map(machineClass => machineClass.canonicalProcessId));
assert.equal(canonicalProcessIds.size, 34);
assert.ok(library.machineClasses.every(machineClass => machineClass.operationCodes.length > 0 || machineClass.status === 'active'));

const codeSet = new Set();
for (const [index, operation] of library.operations.entries()) {
  assert.equal(operation.sourceRef.row, index + 2, `${operation.code}: kaynak satır sırası bozuk.`);
  assert.deepEqual(operation.sourceRef.cells, {
    code: `A${index + 2}`,
    tr: `B${index + 2}`,
    en: `C${index + 2}`
  });
  assert.equal(operation.sourceRef.worksheet, library.source.worksheet);
  assert.equal(typeof operation.code, 'string');
  assert.ok(operation.code.length > 0);
  assert.equal(typeof operation.labels.tr, 'string');
  assert.equal(typeof operation.labels.en, 'string');
  assert.ok(operation.labels.tr.length > 0 && operation.labels.en.length > 0);
  assert.ok(!codeSet.has(operation.code), `Tekrarlanan operasyon kodu: ${operation.code}`);
  codeSet.add(operation.code);
  assert.deepEqual(operation.sourceFlags, [...new Set(operation.sourceFlags)]);
  assert.deepEqual(operation.reviewFlags, [...new Set(operation.reviewFlags)]);
  assert.equal(operation.requiresReview, operation.reviewFlags.length > 0);

  const card = operation.standardProcessCard;
  assert.ok(card, `${operation.code}: standart proses kartı yok.`);
  assert.equal(card.operationCode, operation.code);
  assert.equal(card.cardId, `standard-operation-card.${operation.code}`);
  assert.equal(card.cardType, 'standard-operation');
  assert.equal(card.selectable, true);
  assert.equal(card.status, 'active');
  assert.equal(card.approvalStatus, 'draft');
  assert.equal(card.revision, 'A');
  assert.ok(card.canonicalProcessId);
  assert.ok(card.family && card.category && card.owner);
  assert.ok(card.inputMaterial && card.outputMaterial);
  assert.ok(card.equipment && card.tooling && card.controlMethod);
  assert.ok(card.characteristics.length > 0);
  assert.ok(card.riskTemplate.length > 0);
  assert.ok(card.reactionPlan && card.workInstruction);
  assert.equal(card.allowedMachineClasses.includes(card.machineClassId), true);
  assert.equal(card.equipmentRequirements.bindingKey, 'machineId');
  assert.equal(card.equipmentRequirements.selectionMode, 'machine-register-required');
  assert.ok(Array.isArray(card.equipmentRequirements.productSpecificMachineIds));
  assert.ok(Array.isArray(card.equipmentRequirements.bindingSourceRefs));
  assert.ok(Array.isArray(card.standardRefs) && card.standardRefs.length >= 2);
  assert.equal(card.qualityLinks.controlPlan.required, true);
  assert.equal(card.qualityLinks.pfmea.required, true);
  assert.equal(card.qualityLinks.operatorInstruction.required, true);
  assert.equal(card.immutableSourceIdentity.sourceRow, operation.sourceRef.row);
  assert.match(card.mapping.confidence, /^(documented|high)$/);
}

const byCode = new Map(library.operations.map(operation => [operation.code, operation]));
assert.deepEqual(byCode.get('100').labels, { tr: 'KESME', en: 'CUTTING' });
assert.deepEqual(byCode.get('117').labels, { tr: 'TUFAL GİDERME', en: 'DEscaling' });
assert.deepEqual(byCode.get('423A').labels, { tr: 'BORU BÜKME', en: 'TUBE BENDING' });
assert.deepEqual(byCode.get('820A').labels, { tr: 'Takoz lastiği çakma', en: 'RUBBER BUSHING ASSEMBLY' });
assert.deepEqual(byCode.get('831').labels, { tr: 'KANAL ANAHTAR AĞZI AÇMA', en: 'CHANNEL screw wrench MACHINING' });
assert.deepEqual(byCode.get('860').labels, { tr: 'Rotil Gövdesinin Tenekeye Montajı', en: 'assembling of the Ball Joint to control arm' });
assert.equal(byCode.get('396').labels.en, 'DRYING AND CLEAN WITH pressured AIR ', 'Kaynak son boşluğu aynen korunmalı.');
assert.ok(byCode.get('396').sourceFlags.includes('en_edge_whitespace_preserved'));
assert.ok(byCode.get('423A').sourceFlags.includes('alphanumeric_code_preserved'));
assert.ok(byCode.get('314').reviewFlags.includes('same_tr_label_has_multiple_en_translations'));
assert.ok(byCode.get('820A').reviewFlags.includes('same_en_label_has_multiple_tr_translations'));
assert.ok(byCode.get('347').reviewFlags.includes('tr_and_en_labels_are_identical'));

for (const code of ['202', '301', '303', '304', '321', '322', '355', '356', '435', '519']) {
  const requirements = byCode.get(code).standardProcessCard.equipmentRequirements;
  assert.ok(requirements.productSpecificMachineIds.length > 0, `${code}: belgeli makine ID bağı yok.`);
  assert.ok(requirements.bindingSourceRefs.length > 0, `${code}: makine bağı kaynak referansı yok.`);
  assert.equal(requirements.machineCapabilityApprovalRequired, false);
  assert.equal(requirements.bindingEvidenceStatus, 'documented-source-example');
}
assert.deepEqual(byCode.get('301').standardProcessCard.equipmentRequirements.productSpecificMachineIds, ['T11', 'T12', 'T121', 'T122', 'T150', 'T151', 'T203', 'T204']);
assert.ok(byCode.get('301').standardProcessCard.equipmentRequirements.bindingSourceRefs.includes('tti.2269:p1'));
assert.equal(byCode.get('100').standardProcessCard.equipmentRequirements.machineCapabilityApprovalRequired, true);

const flagCount = flag => library.operations.filter(operation => operation.sourceFlags.includes(flag) || operation.reviewFlags.includes(flag)).length;
assert.equal(flagCount('alphanumeric_code_preserved'), 7);
assert.equal(flagCount('en_edge_whitespace_preserved'), 14);
assert.equal(flagCount('same_tr_label_has_multiple_en_translations'), 15);
assert.equal(flagCount('same_en_label_has_multiple_tr_translations'), 19);
assert.equal(flagCount('abbreviated_tr_label_requires_domain_review'), 21);
assert.equal(flagCount('tr_and_en_labels_are_identical'), 1);

assert.equal(library.qualityReview.mappingAmbiguities.length, 16);
assert.equal(library.qualityReview.mappingAmbiguities.filter(item => item.type === 'same_tr_label_has_multiple_en_translations').length, 7);
assert.equal(library.qualityReview.mappingAmbiguities.filter(item => item.type === 'same_en_label_has_multiple_tr_translations').length, 9);
assert.ok(library.qualityReview.mappingAmbiguities.every(item => item.resolution === 'unresolved_source_preserved_no_auto_merge'));
assert.equal(library.qualityReview.reviewRows.length, 55);
assert.equal(library.qualityReview.sourceFlagRows.length, 21);

const canonicalText = `${library.operations.map(operation => (
  `${operation.sourceRef.row}|${operation.code.length}:${operation.code}|${operation.labels.tr.length}:${operation.labels.tr}|${operation.labels.en.length}:${operation.labels.en}`
)).join('\n')}\n`;
assert.equal(createHash('sha256').update(canonicalText, 'utf8').digest('hex'), library.source.recordsSha256, 'Verbatim kayıt içeriği veya sırası değişti.');

assert.deepEqual(library.preservationPolicy, {
  verbatimCellText: false,
  trimApplied: false,
  caseNormalizationApplied: false,
  spellingCorrectionApplied: false,
  translationInferenceApplied: false,
  brandingAnonymizationApplied: true,
  sourceWhitespacePreserved: true,
  ambiguityPolicy: 'Flag for domain review; preserve every source cell; never auto-merge or guess.'
});

console.log(JSON.stringify({
  libraryId: library.libraryId,
  schema: library.schema,
  version: library.libraryVersion,
  operations: library.operations.length,
  numericCodes: library.statistics.numericCodes,
  alphanumericCodes: library.statistics.alphanumericCodes,
  reviewRequiredRows: library.statistics.reviewRequiredRows,
  mappingAmbiguityGroups: library.statistics.mappingAmbiguityGroups,
  sourceSha256: library.source.sha256,
  recordsSha256: library.source.recordsSha256,
  status: 'PASS'
}, null, 2));
