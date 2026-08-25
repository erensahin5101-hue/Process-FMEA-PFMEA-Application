import { readFile, writeFile } from 'node:fs/promises';

const operationLibraryUrl = new URL('../data/operation-code-library.tr-en.v1.0.0.json', import.meta.url);
const processMasterUrl = new URL('../seed-processes.json', import.meta.url);
const qualityLibraryUrl = new URL('../data/quality-document-library.json', import.meta.url);

const [operationLibrary, processMasters, qualityLibrary] = await Promise.all([
  readFile(operationLibraryUrl, 'utf8').then(JSON.parse),
  readFile(processMasterUrl, 'utf8').then(JSON.parse),
  readFile(qualityLibraryUrl, 'utf8').then(JSON.parse)
]);

const processById = new Map(processMasters.map(process => [process.id, process]));
const documentedOperationByCode = new Map((qualityLibrary.operationPresets || []).map(operation => [String(operation.code), operation]));

const normalize = value => String(value || '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .replace(/İ/g, 'I')
  .toUpperCase();

// First match wins. Rules deliberately favor the operation's dominant transformation.
// This mapping never changes the source TR/EN cells; it only supplies an editable card seed.
const mappingRules = [
  ['MAP-INCOMING', 'incoming', /HAMMADDE ALMA|RECEIVING RAW|GIRDI KONTROL|INCOMING CONTROL/],
  ['MAP-STORAGE', 'storage', /DEPOLAMA|WAREHOUSE|STORAGE|FIFO|STOK/],
  ['MAP-PACKING', 'packing', /SAYMA|TESLIM|ETIKET|POSET|BAGGING|KUTULA|BOXING|SANDIK|ENCASING|SEVK|SHIP|AMBALAJ|PACKAG|TANITIM KARTI|IDENTIFICATION CARD/],
  ['MAP-LEAKTEST', 'leaktest', /SIZDIRMAZLIK|SEALING TEST|LEAK TEST/],
  ['MAP-NDT', 'ndt', /CATLAK|CRACK CONTROL|ULTRASON|ULTRASONIC TEST|NDT|MAGNETIK|PENETRANT/],
  ['MAP-FINAL', 'final', /KONTROL|CONTROL|TEST|MUAYENE|INSPECT|MEASUR|OLC|KALIBR|CALIBR|%1%100/],
  ['MAP-MARKING', 'marking', /MARKAL|MARKA VUR|MARKING|LOGO|IMAL YILI|PRODUCTION DATE|INK JET|YAZI YAZ|YAZDIR|ISARETLE/],
  ['MAP-WASHING', 'washing', /YIKA|WASH|TEMIZ|CLEAN|KURUT|DRYING/],
  ['MAP-SHOTBLAST', 'shotblast', /KUMLA|SANDBLAST|TUFAL|DESCAL|SCALE CLEAN/],
  ['MAP-RUBBER', 'rubber-molding', /VULKAN|VULCAN|RUBBER COATING|LASTIK KAPLAMA/],
  ['MAP-PAINTING', 'painting', /BOYA|PAINT|KATAFOREZ|PRIMER|TOP COAT/],
  ['MAP-COATING', 'coating', /KAPLAMA|COATING|FOSFAT|PHOSPHATE|GALVANIZ|GALVANIZATION|DACROMENT|PLATING/],
  ['MAP-ADHESIVE', 'adhesive', /YAPISTIR|BONDING|ADHESIVE|MASTIK|SEALANT/],
  ['MAP-WELDING', 'welding', /KAYNAK|WELD|PUNTAL|BRAZ|LEHIM/],
  ['MAP-TORQUE', 'torque', /TORK|TORQU|SIKMA|TIGHTEN/],
  ['MAP-ASSEMBLY', 'press-assembly', /CAKMA|BASMA|PUSHING|PULL OUT|PRESLE|PRESSING|SIVAMA|ROLLING|FRETAJ|\bEZME\b|\bCRUSH/],
  ['MAP-ASSEMBLY', 'assembly', /MONTAJ|ASSEMB|TAKMA|PLACING|KOYMA|PUTTING|GECIRME|INSERTING|BAGLAMA|FITTING|GRES|GREASE|YAGLAMA|LUBRICATION|AYARLAMA|ADJUSTMENT|KAPAKCIK|COVER FROM/],
  ['MAP-INDUCTION', 'induction', /INDUKSIYON(?!LA ISITMA)|INDUCTION(?! HEATING)|YUZ[AE]Y SERTLES|SURFACE HARDEN/],
  ['MAP-FURNACE', 'furnace-heat', /ISIL ISLEM|HEAT TREAT|ISLAH|QUENCH|NORMALIZ|TAVLA|ANNEAL|TEMPER|GERGINLIK GIDER|STRESS RELIEF/],
  ['MAP-BILLET-HEAT', 'billet-heating', /INDUKSIYONLA ISITMA|HEATING WITH INDUCTION|ON ISITMA|PRE HEATING|^ISITMA\b|\bHEATING\b/],
  ['MAP-FORGING', 'forging', /DOVME|FORG|SISIRME|UPSETTING|HOT PRE-FORM|SICAK SEKILLENDIR|HEADING/],
  ['MAP-TUBE', 'tube-forming', /BORU.*(BUK|BUZ|EZME|PRES)|PIPE.*(BEND|CONSTRICT|CRUSH|PRESS)|TUBE.*(BEND|CONSTRICT|CRUSH|PRESS)|CUBUK BUK|BAR BENDING|MIL BUK|BUZME|CONSTRICTION/],
  ['MAP-STAMPING', 'stamping', /\bBUKME\b|\bBENDING\b|SAC|STAMPING|NOTCHING|WARPAGE SETTING|PESLIK AYARI/],
  ['MAP-DEBURR', 'deburring', /CAPAK|BURR|PAH KIR|CHAMFER|KENAR KIR|TROVAL/],
  ['MAP-GRINDING', 'grinding', /TASLA|GRIND|OVALAMA|RUBBING|PARLAT|POLISH|HONLA|SUPERFINISH/],
  ['MAP-THREAD', 'thread', /DIS AC|DIS CEK|THREAD|VIDALA|TAPPING|RE-THREAD/],
  ['MAP-DRILLING', 'drilling', /DELME|DRILL|DELIK|HOLE|RAYBA|REAM|HAVSA|COUNTERSINK|PUNTA AC|CENTER DRILL/],
  ['MAP-MILLING', 'milling', /FREZE|MILL|MILING|KANAL|CHANNEL|BRO[SŞ]|BROACH|ANAHTAR AGZI|SCREW WRENCH|YARMA|SLOTTING|NOTCH OPENING|TIRNAK AC/],
  ['MAP-CUTTING', 'cutting', /KESME|CUTTING|KIRMA|BREAKING|SAW|BOY TAMAM|LENGTH COMPLETION/],
  ['MAP-CNC', 'cnc', /TORNA|TURNING|MACHINING|ISLEME|FINIS|ROUGH|RADYUS|RADIUS|TIRTIR|KNURL|DIS TOR|IC TOR/]
];

const explicitMappings = new Map([
  ['202', 'induction'], ['301', 'cnc'], ['303', 'cnc'], ['304', 'cnc'], ['321', 'grinding'],
  ['322', 'thread'], ['355', 'cnc'], ['356', 'cnc'], ['435', 'coating'], ['519', 'ndt'], ['800', 'tube-forming']
]);

function documentedBinding(operation) {
  const source = documentedOperationByCode.get(String(operation.code));
  if (!source) return { machineIds: [], sourceRefs: [], profileIds: [] };
  const profiles = source.applicationProfiles || [];
  const machineIds = [...new Set(profiles.flatMap(profile => profile.machines || []).map(String))].sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));
  const sourceRefs = [...new Set(profiles.flatMap(profile => [
    ...(profile.sourceRefs || []),
    ...(profile.characteristics || []).flatMap(characteristic => characteristic.sourceRefs || [])
  ]).map(ref => typeof ref === 'string' ? ref : JSON.stringify(ref)))];
  return { machineIds, sourceRefs, profileIds: profiles.map(profile => profile.id).filter(Boolean) };
}

function classify(operation) {
  const explicit = explicitMappings.get(String(operation.code));
  if (explicit) return { canonicalProcessId: explicit, ruleId: 'MAP-DOCUMENTED-EXPLICIT', confidence: 'documented' };
  const haystack = normalize(`${operation.labels?.tr || ''} ${operation.labels?.en || ''}`);
  for (const [ruleId, canonicalProcessId, pattern] of mappingRules) {
    if (pattern.test(haystack)) return { canonicalProcessId, ruleId, confidence: 'high' };
  }
  return { canonicalProcessId: 'cnc', ruleId: 'MAP-FALLBACK-REVIEW', confidence: 'low' };
}

function machineClassId(processId) {
  return `machine-class.${processId}`;
}

function processCard(operation) {
  const mapping = classify(operation);
  const canonical = processById.get(mapping.canonicalProcessId);
  if (!canonical) throw new Error(`${operation.code}: canonical process not found: ${mapping.canonicalProcessId}`);
  const binding = documentedBinding(operation);
  const sourceReviewReasons = [...new Set([...(operation.reviewFlags || []), ...(mapping.confidence === 'low' ? ['canonical_mapping_requires_engineering_review'] : [])])];
  const outsourceFromSource = /FASON|CONTRACT|SEVK.*GALVANIZ|SHIPMENT TO GALVANIZATION/.test(normalize(`${operation.labels?.tr} ${operation.labels?.en}`));
  const operationTitle = String(operation.labels?.tr || '').trim();
  const machineClass = machineClassId(canonical.id);
  return {
    cardId: `standard-operation-card.${operation.code}`,
    cardType: 'standard-operation',
    operationCode: operation.code,
    canonicalProcessId: canonical.id,
    canonicalProcessCode: canonical.code,
    canonicalProcessName: canonical.name,
    family: canonical.family,
    category: canonical.category,
    desc: `${operationTitle} operasyonu için düzenlenebilir standart proses kartı; ürün, teknik resim ve tesis koşullarıyla doğrulanır.`,
    inputMaterial: canonical.inputMaterial,
    outputMaterial: canonical.outputMaterial,
    equipment: canonical.equipment,
    tooling: canonical.tooling,
    machineClassId: machineClass,
    allowedMachineClasses: [machineClass],
    equipmentRequirements: {
      selectionMode: 'machine-register-required',
      bindingKey: 'machineId',
      requiredCapabilities: [...new Set([operationTitle, canonical.name, ...(canonical.characteristics || [])])],
      calibrationRequired: canonical.category === 'Kontrol' || /OLC|MEASUR|KONTROL|CONTROL|TEST/.test(normalize(`${operation.labels?.tr} ${operation.labels?.en}`)),
      specialProcessQualificationRequired: Boolean(canonical.special),
      machineCapabilityApprovalRequired: binding.machineIds.length === 0,
      productApplicabilityValidationRequired: true,
      productSpecificMachineIds: binding.machineIds,
      documentedProfileIds: binding.profileIds,
      bindingSourceRefs: binding.sourceRefs,
      bindingEvidenceStatus: binding.machineIds.length ? 'documented-source-example' : 'machine-class-seed-awaiting-plant-approval'
    },
    controlMethod: canonical.controlMethod,
    characteristics: [...(canonical.characteristics || [])],
    riskTemplate: [...(canonical.riskTemplate || [])],
    reactionPlan: canonical.reactionPlan,
    workInstruction: `WI-OP-${operation.code}`,
    owner: canonical.owner,
    special: Boolean(canonical.special),
    outsource: Boolean(canonical.outsource || outsourceFromSource),
    pfmeaFunction: canonical.pfmeaFunction,
    processStandard: canonical.processStandard,
    standardRefs: [...new Set([
      'IATF 16949:2016 §8.5.1.1 — Control plans',
      'AIAG Control Plan — customer-required edition',
      canonical.processStandard
    ].filter(Boolean))],
    documentRef: canonical.documentRef,
    qualityLinks: {
      processFlow: { required: true, symbolClass: canonical.category === 'Kontrol' ? 'inspection' : 'operation' },
      pfmea: { required: true, function: canonical.pfmeaFunction, riskTemplates: [...(canonical.riskTemplate || [])] },
      controlPlan: { required: true, characteristics: [...(canonical.characteristics || [])], controlMethod: canonical.controlMethod },
      operatorInstruction: { required: true, templateRef: `WI-OP-${operation.code}` },
      reactionPlan: { required: true, text: canonical.reactionPlan },
      sourceDocumentRefs: binding.sourceRefs
    },
    cycleTimeSec: Number(canonical.cycleTimeSec || 0),
    setupTimeMin: Number(canonical.setupTimeMin || 0),
    revision: 'A',
    status: 'active',
    approvalStatus: 'draft',
    selectable: true,
    immutableSourceIdentity: {
      operationId: operation.id,
      sourceLibraryId: operationLibrary.libraryId,
      sourceRow: operation.sourceRef?.row,
      sourceCells: operation.sourceRef?.cells
    },
    mapping: {
      method: 'deterministic-label-rule-v1',
      ruleId: mapping.ruleId,
      confidence: mapping.confidence,
      requiresReview: sourceReviewReasons.length > 0,
      reviewReasons: sourceReviewReasons
    }
  };
}

operationLibrary.schemaVersion = '1.1.0';
operationLibrary.libraryVersion = '2026.07.18';
operationLibrary.entrySchema.standardProcessCard = 'complete editable process-card seed; immutable source identity remains in code/labels/sourceRef';
operationLibrary.machineLibraryContract = {
  schema: 'tyana.qflow.machine-register/v1',
  bindingKey: 'machineId',
  classBindingKey: 'machineClassId',
  requiredMachineFields: ['machineId', 'machineClassId', 'name', 'plant', 'workcenter', 'status', 'capabilities', 'calibrationStatus', 'qualificationStatus'],
  cardinality: 'one operation card may allow multiple machine classes; a released route must select one active machineId',
  exactBindingPolicy: 'documented product-specific IDs are suggestions with source evidence; product applicability must still be validated',
  genericBindingPolicy: 'machine-class mapping requires plant capability approval before released use'
};
operationLibrary.operations = operationLibrary.operations.map(operation => ({
  ...operation,
  standardProcessCard: processCard(operation)
}));

operationLibrary.machineClasses = processMasters.map(process => {
  const id = machineClassId(process.id);
  const cards = operationLibrary.operations.filter(operation => operation.standardProcessCard.machineClassId === id);
  const documentedMachineIds = [...new Set(cards.flatMap(operation => operation.standardProcessCard.equipmentRequirements.productSpecificMachineIds))]
    .sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));
  return {
    id,
    canonicalProcessId: process.id,
    name: process.equipment,
    family: process.family,
    category: process.category,
    requiredCapabilities: [...new Set(cards.flatMap(operation => operation.standardProcessCard.equipmentRequirements.requiredCapabilities))],
    operationCodes: cards.map(operation => operation.code),
    documentedMachineIds,
    status: 'active',
    revision: 'A'
  };
});

const machineSeedIndex = new Map();
for (const operation of operationLibrary.operations) {
  const card = operation.standardProcessCard;
  for (const machineId of card.equipmentRequirements.productSpecificMachineIds) {
    const seed = machineSeedIndex.get(machineId) || {
      machineId,
      name: machineId,
      plant: 'user-validation-required',
      workcenter: 'user-validation-required',
      status: 'validation-required',
      machineClassIds: [],
      supportedOperationCodes: [],
      supportedOperationLabels: [],
      capabilities: [],
      calibrationStatus: 'user-validation-required',
      qualificationStatus: 'user-validation-required',
      sourceRefs: [],
      sourceEvidenceStatus: 'documented-source-example'
    };
    seed.machineClassIds.push(card.machineClassId);
    seed.supportedOperationCodes.push(operation.code);
    seed.supportedOperationLabels.push(String(operation.labels?.tr || '').trim());
    seed.capabilities.push(...card.equipmentRequirements.requiredCapabilities);
    seed.sourceRefs.push(...card.equipmentRequirements.bindingSourceRefs);
    machineSeedIndex.set(machineId, seed);
  }
}
operationLibrary.machineRegisterSeeds = [...machineSeedIndex.values()]
  .map(seed => ({
    ...seed,
    machineClassIds: [...new Set(seed.machineClassIds)].sort(),
    supportedOperationCodes: [...new Set(seed.supportedOperationCodes)].sort((a, b) => a.localeCompare(b, 'tr', { numeric: true })),
    supportedOperationLabels: [...new Set(seed.supportedOperationLabels)],
    capabilities: [...new Set(seed.capabilities)],
    sourceRefs: [...new Set(seed.sourceRefs)]
  }))
  .sort((a, b) => a.machineId.localeCompare(b.machineId, 'tr', { numeric: true }));

const cards = operationLibrary.operations.map(operation => operation.standardProcessCard);
operationLibrary.statistics.completeProcessCards = cards.length;
operationLibrary.statistics.selectableProcessCards = cards.filter(card => card.selectable && card.status === 'active').length;
operationLibrary.statistics.machineClasses = operationLibrary.machineClasses.length;
operationLibrary.statistics.documentedMachineBindings = cards.filter(card => card.equipmentRequirements.productSpecificMachineIds.length > 0).length;
operationLibrary.statistics.machineClassApprovalRequired = cards.filter(card => card.equipmentRequirements.machineCapabilityApprovalRequired).length;
operationLibrary.statistics.lowConfidenceCardMappings = cards.filter(card => card.mapping.confidence === 'low').length;
operationLibrary.statistics.machineRegisterSeeds = operationLibrary.machineRegisterSeeds.length;
operationLibrary.qualityReview.cardMappingReviewRows = operationLibrary.operations
  .filter(operation => operation.standardProcessCard.mapping.requiresReview)
  .map(operation => ({
    code: operation.code,
    cardId: operation.standardProcessCard.cardId,
    confidence: operation.standardProcessCard.mapping.confidence,
    reasons: operation.standardProcessCard.mapping.reviewReasons
  }));

await writeFile(operationLibraryUrl, `${JSON.stringify(operationLibrary, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  operations: operationLibrary.operations.length,
  completeCards: operationLibrary.statistics.completeProcessCards,
  machineClasses: operationLibrary.statistics.machineClasses,
  machineRegisterSeeds: operationLibrary.statistics.machineRegisterSeeds,
  documentedMachineBindings: operationLibrary.statistics.documentedMachineBindings,
  machineClassApprovalRequired: operationLibrary.statistics.machineClassApprovalRequired,
  lowConfidenceMappings: operationLibrary.statistics.lowConfidenceCardMappings
}, null, 2));
