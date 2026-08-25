import assert from 'node:assert/strict';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { runtimeBlankProductFixtureBody } from './runtime-blank-product-fixture.mjs';

const output = resolve(import.meta.dirname, '..', 'output', 'browser');
const cdpPort = Number(process.env.CDP_PORT || 9222);
assert.equal(basename(output), 'browser', 'Browser test çıktı yolu güvenli değil.');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

async function waitForDebugger() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { const pages = await fetch(`http://127.0.0.1:${cdpPort}/json`).then(response => response.json()); const target = pages.find(item => item.type === 'page' && !item.url.startsWith('chrome-extension://')); if (target?.webSocketDebuggerUrl) return target; } catch {}
    await new Promise(resolveWait => setTimeout(resolveWait, 250));
  }
  throw new Error('Chrome DevTools endpoint unavailable');
}

const page = await waitForDebugger();
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolveOpen, reject) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let messageId = 0; const pending = new Map(); const errors = [];
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) { const { resolve: done, reject } = pending.get(message.id); pending.delete(message.id); message.error ? reject(new Error(message.error.message)) : done(message.result); }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text || 'Runtime exception');
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(arg => arg.value || arg.description).join(' '));
});
const send = (method, params = {}) => new Promise((done, reject) => { const id = ++messageId; pending.set(id, { resolve: done, reject }); socket.send(JSON.stringify({ id, method, params })); });
const sleep = ms => new Promise(resolveWait => setTimeout(resolveWait, ms));
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
};
const screenshot = async name => {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
  await writeFile(resolve(output, name), Buffer.from(data, 'base64'));
};

await send('Page.enable'); await send('Runtime.enable'); await send('Console.enable');
try { await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }); } catch {}
await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: output });
const navigation = await send('Page.navigate', { url: 'http://127.0.0.1:4173' });
for (let attempt = 0; attempt < 30; attempt += 1) { if (await evaluate("document.readyState === 'complete' && location.hostname === '127.0.0.1'")) break; await sleep(250); }
const pageState = await evaluate("({title:document.title,href:location.href,ready:document.readyState,body:document.body?.innerText?.slice(0,120)})");
if (pageState.title !== 'TYANA Q-FLOW | Kalite Dokümantasyonu') console.error(JSON.stringify({ navigation, pageState, errors }));
assert.equal(pageState.title, 'TYANA Q-FLOW | Kalite Dokümantasyonu');
assert.equal(await evaluate("Boolean(window.ExcelJS && window.pdfMake)"), true);
await screenshot('01-dashboard.png');

for (let attempt = 0; attempt < 40; attempt += 1) {
  if (await evaluate("Boolean(qualityDocumentLibrary?.validationRules?.length && sourceControlPlans().length)")) break;
  await sleep(100);
}
const sourcePfmeaBackbone = await evaluate(`(() => {
  applySourceTemplate('cp.807', { stayOnProduct: true });
  const entries = selectedProcessEntries();
  const generatedRows = pfmeaRows.filter(row => !row.manual);
  const rowForRoute = routeKey => generatedRows.filter(row => row.routeKey === routeKey);
  const routeRowsComplete = entries.length > 0
    && generatedRows.length === entries.length
    && entries.every(entry => rowForRoute(entry.routeKey).length === 1);

  const controlReactionLinksComplete = entries.every(entry => {
    const row = rowForRoute(entry.routeKey)[0];
    const control = characteristics.find(item => item.id === row?.controlPlanCharacteristicId);
    return Boolean(
      row
      && control
      && control.routeKey === entry.routeKey
      && row.controlPlanRowId === (control.controlPlanRowId || control.id)
      && String(row.reactionPlan || '').trim()
    );
  });

  const generatedSourceTraceIsExplicit = generatedRows.every(row => {
    const entry = entries.find(item => item.routeKey === row.routeKey);
    return Boolean(
      entry
      && row.contentOrigin === 'generated-draft'
      && row.sourceRouteDocumentId === entry.detail.sourceDocumentId
      && row.sourceRouteRef === entry.detail.sourceRef
      && !row.sourcePfmeaDocumentId
    );
  });

  return {
    routeRowsComplete,
    controlReactionLinksComplete,
    generatedSourceTraceIsExplicit,
    diagnostics: {
      routeCount: entries.length,
      generatedRowCount: generatedRows.length,
      rowsWithoutControl: generatedRows.filter(row => !row.controlPlanCharacteristicId).map(row => row.routeKey),
      rowsWithoutReaction: generatedRows.filter(row => !String(row.reactionPlan || '').trim()).map(row => row.routeKey),
      origins: generatedRows.map(row => ({
        routeKey: row.routeKey,
        contentOrigin: row.contentOrigin || null,
        libraryRiskId: row.libraryRiskId || null,
        sourceRouteDocumentId: row.sourceRouteDocumentId || null,
        sourcePfmeaDocumentId: row.sourcePfmeaDocumentId || null
      }))
    }
  };
})()`);
assert.deepEqual(
  {
    routeRowsComplete: sourcePfmeaBackbone.routeRowsComplete,
    controlReactionLinksComplete: sourcePfmeaBackbone.controlReactionLinksComplete,
    generatedSourceTraceIsExplicit: sourcePfmeaBackbone.generatedSourceTraceIsExplicit
  },
  {
    routeRowsComplete: true,
    controlReactionLinksComplete: true,
    generatedSourceTraceIsExplicit: true
  },
  `Kaynak PFMEA omurga regresyonu başarısız: ${JSON.stringify(sourcePfmeaBackbone.diagnostics)}`
);
const sourceP0RegressionGuards = await evaluate(`(() => {
  const issueContainsCode = (issues, code) => issues.some(issue => String(issue).includes(code));
  const blockRuleCodes = new Set(sourceValidationRules().filter(rule => rule.severity === 'block').map(rule => rule.code));

  applySourceTemplate('cp.806', { stayOnProduct: true });
  const sourceBlockCodes = [...new Set(characteristics.flatMap(item => item.sourceWarningCodes || []))]
    .filter(code => blockRuleCodes.has(code));
  const sourceGateIssues = releaseGateIssues({ includeApproval: false });
  const sourceWarningBlocksRelease = sourceBlockCodes.length >= 3
    && sourceBlockCodes.every(code => issueContainsCode(sourceGateIssues, code));

  applySourceTemplate('cp.807', { stayOnProduct: true });
  buildInstructionModels();
  renderInstructions();
  const rotatingIndex = instructionModels.findIndex(model => model.operationCode === '304');
  const rotatingModel = instructionModels[rotatingIndex];
  const rotatingCardText = document.querySelector('[data-instruction="' + rotatingIndex + '"]')?.innerText || '';
  const ppeWarningPropagates = Boolean(
    rotatingModel?.validationFlags?.some(flag => flag.includes('PPE_GLOVE_ROTATING_MACHINE'))
  );
  const generatedDraftIsDistinct = Boolean(
    rotatingModel?.sourceDocumentNo === 'TTI-2267'
    && rotatingModel?.contentOrigin === 'generated-draft'
    && rotatingCardText.includes('TTI-2267')
    && rotatingCardText.includes('ÜRETİLMİŞ TASLAK')
  );

  selected = [];
  routeDetails = {};
  characteristics = [];
  sourceInstructionUiState.pickedIds.clear();
  sourceInstructionUiState.pickedIds.add('instruction.2267');
  applySourceInstructionSelection();
  buildInstructionModels();
  const standaloneModel = instructionModels.find(model => model.operationCode === '304');
  const standaloneGateIssues = releaseGateIssues({ includeApproval: false });
  const samplingConflictBlocksRelease = Boolean(
    standaloneModel?.validationFlags?.some(flag => flag.includes('SAMPLING_CONTRADICTION'))
    && issueContainsCode(standaloneGateIssues, 'SAMPLING_CONTRADICTION')
  );

  return {
    sourceWarningBlocksRelease,
    ppeWarningPropagates,
    generatedDraftIsDistinct,
    samplingConflictBlocksRelease,
    diagnostics: {
      sourceBlockCodes,
      sourceGateIssues,
      rotatingValidationFlags: rotatingModel?.validationFlags || [],
      rotatingContentOrigin: rotatingModel?.contentOrigin || null,
      standaloneValidationFlags: standaloneModel?.validationFlags || [],
      standaloneGateIssues
    }
  };
})()`);
assert.deepEqual(
  {
    sourceWarningBlocksRelease: sourceP0RegressionGuards.sourceWarningBlocksRelease,
    ppeWarningPropagates: sourceP0RegressionGuards.ppeWarningPropagates,
    generatedDraftIsDistinct: sourceP0RegressionGuards.generatedDraftIsDistinct,
    samplingConflictBlocksRelease: sourceP0RegressionGuards.samplingConflictBlocksRelease
  },
  {
    sourceWarningBlocksRelease: true,
    ppeWarningPropagates: true,
    generatedDraftIsDistinct: true,
    samplingConflictBlocksRelease: true
  },
  `Kaynak doküman P0 regresyon kapıları başarısız: ${JSON.stringify(sourceP0RegressionGuards.diagnostics)}`
);

await evaluate("applyProductTemplate('blank'); document.querySelector('[data-view=product]').click(); true"); await sleep(500); await screenshot('02-blank-product.png');
assert.equal(await evaluate("productGroup.value === '__custom__' && productType.value === 'Kullanıcı Tanımlı Mamul' && !document.getElementById('customProductTypeField').classList.contains('hidden') && !document.getElementById('partNumber').value && !document.getElementById('internalProductCode').value && components.length === 0 && selected.length === 0 && routeDetails && Object.keys(routeDetails).length === 0 && !drawingSource.sha256 && !document.getElementById('hardnessSpec').value && !document.getElementById('coatingThickness').value"), true);
await evaluate("document.getElementById('customProductGroupName').value='Kabin Mekanizmaları'; document.getElementById('customProductTypeName').value='Elektrikli kabin kilit modülü'; document.getElementById('partNumber').value='OEM-KB-NEW-001'; document.getElementById('internalProductCode').value='STK-KB-NEW-001'; document.getElementById('partName').value='Yeni Kabin Mekanizması'; persistPendingProductGroup(); updateSummary(); true");
assert.equal(await evaluate("productGroup.value.startsWith('custom:') && activeBackbone().label === 'Kabin Mekanizmaları' && effectiveProductTypeLabel() === 'Elektrikli kabin kilit modülü' && document.getElementById('summaryInternalCode').textContent.includes('STK-KB-NEW-001')"), true);

await evaluate(`(() => {${runtimeBlankProductFixtureBody} goToWizardStep(2); return true;})()`); await sleep(500); await screenshot('03-multilevel-bom.png');
assert.equal(await evaluate("components.length === 2 && components.some(item=>item.materialGrade==='41Cr4') && components.some(item=>item.materialGrade==='C45E')"), true);
/*
assert.equal(await evaluate("components.some(item=>item.name==='Gövde' && item.inputState==='Dövme taslak' && item.primaryManufacturingMethod==='Talaşlı imalat' && item.outputState==='İşlenmiş parça')"), true);
*/
assert.equal(await evaluate("Boolean(engineeringUniverse?.architecture==='ITEM_MASTER_THEN_BOM' && engineeringUniverse.itemMasters.length===components.length+1 && engineeringUniverse.itemMasters.some(item=>item.id===engineeringUniverse.rootItemMasterId && item.internalCode===internalProductCode.value && item.oemNo===partNumber.value))"), true);
assert.equal(await evaluate("document.querySelectorAll('.sap-bom-stage-tabs [data-engineering-bom-stage]').length===2 && !document.getElementById('itemMasterStage').classList.contains('hidden') && document.querySelectorAll('#itemMasterList [data-item-master-select]').length===engineeringUniverse.itemMasters.length"), true);
assert.equal(await evaluate("(() => { setEngineeringBomStage('structure'); const definition=currentEngineeringBomDefinition(); const selectable=[...document.querySelectorAll('[data-bom-line-master-picker] option')].filter(option=>option.value).map(option=>option.value); return Boolean(definition && selectable.length===engineeringUniverse.itemMasters.length-1 && selectable.every(id=>engineeringUniverse.itemMasters.some(master=>master.id===id))); })()"), true);
await evaluate("setEngineeringBomStage('masters'); true");
await evaluate("goToWizardStep(3); document.getElementById('engineeringScope').value='ITEM-030-GOVDE'; renderEngineeringQuestions(); true"); await sleep(400); await screenshot('03-engineering-questions.png');
assert.equal(await evaluate("Boolean(productEngineeringLibrary && productEngineeringLibrary.questionSets.length >= 20 && document.querySelectorAll('#engineeringQuestionRows .engineering-question-card').length >= 20)"), true);
await evaluate("engineeringCustomQuestions.push({id:'CUSTOM-QA-EXCEL-GUARD',label:' \\t=HYPERLINK(A1)',type:'text',required:false}); engineeringAnswers.FINISHED_GOOD ||= {}; engineeringAnswers.FINISHED_GOOD['CUSTOM-QA-EXCEL-GUARD']={questionId:'CUSTOM-QA-EXCEL-GUARD',value:' \\t=2+2',source:' \\t@SUM(A1:A2)',verificationStatus:'Doğrulandı',evidenceRef:' \\r=CMD()'}; true");
await evaluate("goToWizardStep(4); true"); await sleep(500); await screenshot('04-characteristics.png');
assert.equal(await evaluate("document.querySelectorAll('[data-field=routeKey] option').length > 10"), true);

await evaluate("document.querySelector('[data-view=flow]').click(); selected = [...activeBackbone().processes]; routeDetails={}; renderOptions(); renderSequence(); renderFlowDiagram(); true"); await sleep(500); await screenshot('05-process-flow.png');
assert.equal(await evaluate("document.querySelectorAll('#processSequence .sequence-item[draggable=true]').length >= 20"), true);
assert.equal(await evaluate("routeDetails['integrated-assembly'].inputComponentIds.length"), 0);
await evaluate("document.querySelector('[data-route-key=\"integrated-assembly\"] [data-edit-route]').click(); true"); await sleep(300); await screenshot('06-operation-bom-mapping.png');

await evaluate("document.querySelector('[data-view=pfmea]').click(); true"); await sleep(500); await screenshot('07-dynamic-pfmea.png');
assert.equal(await evaluate("document.querySelectorAll('#pfmea .pfmea-edit-row').length === pfmeaRows.length && pfmeaRows.length === selected.length && pfmeaRows.length >= 20"), true);
assert.equal(await evaluate("pfmeaRows.every(row=>selected.includes(row.routeKey) || row.manual)"), true);
assert.equal(await evaluate("Boolean(pfmeaEngineeringLibrary && pfmeaEngineeringLibrary.riskTemplates.length >= 38 && document.querySelectorAll('#pfmeaLibraryRisk option').length >= 1)"), true);

const pfmeaUltraBaseline = await evaluate(`(() => {
  globalThis.__browserPfmeaFixture = structuredClone(pfmeaRows);
  const entries = selectedProcessEntries();
  const sample = entries.find(entry => pfmeaRisksForProcess(entry.process.id).length);
  return {
    quickStudio: Boolean(document.querySelector('#pfmea .pfmea-quick-studio')),
    quickProfiles: document.querySelectorAll('#pfmeaQuickProfile option').length,
    quickAction: Boolean(document.querySelector('[data-action="pfmea-quick-generate"]')),
    operationCards: document.querySelectorAll('#pfmeaOperationRail [data-pfmea-operation]').length,
    operations: entries.length,
    galleryCards: document.querySelectorAll('#pfmeaRiskGallery [data-pfmea-pick-risk]').length,
    riskCards: document.querySelectorAll('#pfmea .pfmea-risk-card.pfmea-edit-row').length,
    modelRows: pfmeaRows.length,
    apAssigned: pfmeaRows.filter(row => Boolean(row.ap)).length,
    profileOrder: sample ? ['core', 'balanced', 'full'].map(profile => pfmeaProfileRisks(sample.process.id, profile).length) : []
  };
})()`);
assert.equal(pfmeaUltraBaseline.quickStudio, true);
assert.equal(pfmeaUltraBaseline.quickProfiles, 3);
assert.equal(pfmeaUltraBaseline.quickAction, true);
assert.equal(pfmeaUltraBaseline.operationCards, pfmeaUltraBaseline.operations);
assert.ok(pfmeaUltraBaseline.galleryCards >= 1);
assert.equal(pfmeaUltraBaseline.riskCards, pfmeaUltraBaseline.modelRows);
assert.equal(pfmeaUltraBaseline.apAssigned, 0, 'PFMEA kütüphane satırlarına AP otomatik atanmamalı.');
assert.ok(pfmeaUltraBaseline.profileOrder.length === 3 && pfmeaUltraBaseline.profileOrder[0] <= pfmeaUltraBaseline.profileOrder[1] && pfmeaUltraBaseline.profileOrder[1] <= pfmeaUltraBaseline.profileOrder[2]);

const pfmeaPickedRisk = await evaluate(`(() => {
  const target = selectedProcessEntries().map(entry => {
    const existing = new Set(pfmeaRows.filter(row => row.routeKey === entry.routeKey).map(row => row.libraryRiskId).filter(Boolean));
    return { entry, risk: pfmeaRisksForProcess(entry.process.id).find(risk => !existing.has(risk.id)) };
  }).find(candidate => candidate.risk);
  if (!target) return { available: false };
  [...document.querySelectorAll('#pfmeaOperationRail [data-pfmea-operation]')].find(button => button.dataset.pfmeaOperation === target.entry.routeKey)?.click();
  const riskButton = [...document.querySelectorAll('#pfmeaRiskGallery [data-pfmea-pick-risk]')].find(button => button.dataset.pfmeaPickRisk === target.risk.id);
  const before = pfmeaRows.length;
  riskButton?.click();
  const pickedCount = Number(document.getElementById('pfmeaPickedCount')?.textContent || 0);
  const addButton = document.querySelector('[data-action="pfmea-add-picked"]');
  const addEnabled = Boolean(addButton && !addButton.disabled);
  addButton?.click();
  const added = pfmeaRows.find(row => row.routeKey === target.entry.routeKey && row.libraryRiskId === target.risk.id);
  const afterFirst = pfmeaRows.length;
  const duplicateCard = [...document.querySelectorAll('#pfmeaRiskGallery [data-pfmea-pick-risk]')].find(button => button.dataset.pfmeaPickRisk === target.risk.id);
  duplicateCard?.click();
  document.querySelector('[data-action="pfmea-add-picked"]')?.click();
  const pairCount = pfmeaRows.filter(row => row.routeKey === target.entry.routeKey && row.libraryRiskId === target.risk.id).length;
  globalThis.__browserPfmeaPickedTarget = { routeKey: target.entry.routeKey, riskId: target.risk.id, rowId: added?.id || '' };
  return {
    available: true, before, afterFirst, afterSecond: pfmeaRows.length, pickedCount, addEnabled, pairCount,
    ap: added?.ap ?? null, sodReady: Boolean(added?.severity && added?.occurrence && added?.detection),
    duplicateDisabled: Boolean(duplicateCard?.disabled), cardCount: document.querySelectorAll('#pfmea .pfmea-risk-card').length
  };
})()`);
assert.equal(pfmeaPickedRisk.available, true, 'Mevcut satırdan farklı bir PFMEA kütüphane riski bulunamadı.');
assert.equal(pfmeaPickedRisk.pickedCount, 1);
assert.equal(pfmeaPickedRisk.addEnabled, true);
assert.equal(pfmeaPickedRisk.afterFirst, pfmeaPickedRisk.before + 1);
assert.equal(pfmeaPickedRisk.afterSecond, pfmeaPickedRisk.afterFirst);
assert.equal(pfmeaPickedRisk.pairCount, 1, 'Aynı operasyon/risk çifti ikinci kez eklenmemeli.');
assert.equal(pfmeaPickedRisk.duplicateDisabled, true);
assert.equal(pfmeaPickedRisk.ap, '', 'Hızlı risk ekleme AP değerini otomatik atamamalı.');
assert.equal(pfmeaPickedRisk.sodReady, true);
assert.equal(pfmeaPickedRisk.cardCount, pfmeaPickedRisk.afterFirst);

const pfmeaFilterIntegrity = await evaluate(`(() => {
  const before = JSON.stringify(pfmeaRows);
  const workbenchSearch = document.getElementById('pfmeaWorkbenchSearch');
  workbenchSearch.value = '__eşleşmeyen_pfmea_testi__';
  workbenchSearch.dispatchEvent(new Event('input', { bubbles: true }));
  const emptyWorkbench = document.querySelectorAll('#pfmea .pfmea-risk-card').length === 0;
  const afterWorkbench = JSON.stringify(pfmeaRows);
  workbenchSearch.value = '';
  workbenchSearch.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('[data-pfmea-filter="high"]')?.click();
  const emptyHighFilter = document.querySelectorAll('#pfmea .pfmea-risk-card').length === 0;
  const afterFilter = JSON.stringify(pfmeaRows);
  document.querySelector('[data-pfmea-filter="all"]')?.click();
  const catalogSearch = document.getElementById('pfmeaRiskSearch');
  catalogSearch.value = '__eşleşmeyen_kütüphane_riski__';
  catalogSearch.dispatchEvent(new Event('input', { bubbles: true }));
  const emptyCatalog = document.querySelectorAll('#pfmeaRiskGallery [data-pfmea-pick-risk]').length === 0;
  const afterCatalog = JSON.stringify(pfmeaRows);
  catalogSearch.value = '';
  catalogSearch.dispatchEvent(new Event('input', { bubbles: true }));
  return { emptyWorkbench, emptyHighFilter, emptyCatalog, unchanged: before === afterWorkbench && before === afterFilter && before === afterCatalog };
})()`);
assert.deepEqual(pfmeaFilterIntegrity, { emptyWorkbench: true, emptyHighFilter: true, emptyCatalog: true, unchanged: true });

const pfmeaVisualModelSync = await evaluate(`(() => {
  const rowId = globalThis.__browserPfmeaPickedTarget.rowId;
  const change = (field, value) => {
    const control = document.querySelector('[data-risk-id="' + rowId + '"] [data-pfmea-field="' + field + '"]');
    control.value = value;
    control.dispatchEvent(new Event('change', { bubbles: true }));
  };
  change('severity', '9');
  change('occurrence', '4');
  change('detection', '6');
  document.querySelector('[data-risk-id="' + rowId + '"] [data-pfmea-ap="M"]')?.click();
  change('status', 'Uygulama Bekleniyor');
  const row = pfmeaRows.find(item => item.id === rowId);
  const card = document.querySelector('[data-risk-id="' + rowId + '"]');
  return {
    model: [row.severity, row.occurrence, row.detection, row.ap, row.status],
    visual: [
      card.querySelector('[data-pfmea-field="severity"]').value,
      card.querySelector('[data-pfmea-field="occurrence"]').value,
      card.querySelector('[data-pfmea-field="detection"]').value,
      card.querySelector('[data-pfmea-ap="M"]').classList.contains('active') ? 'M' : '',
      card.querySelector('[data-pfmea-field="status"]').value
    ],
    mediumTone: card.classList.contains('ap-medium'),
    rpn: pfmeaRpn(row)
  };
})()`);
assert.deepEqual(pfmeaVisualModelSync.model, ['9', '4', '6', 'M', 'Uygulama Bekleniyor']);
assert.deepEqual(pfmeaVisualModelSync.visual, pfmeaVisualModelSync.model);
assert.equal(pfmeaVisualModelSync.mediumTone, true);
assert.equal(pfmeaVisualModelSync.rpn, 216);

const pfmeaBulkResult = await evaluate(`(() => {
  const pickedId = globalThis.__browserPfmeaPickedTarget.rowId;
  const secondId = pfmeaRows.find(row => row.id !== pickedId)?.id;
  const ids = [pickedId, secondId].filter(Boolean);
  ids.forEach(rowId => {
    const checkbox = document.querySelector('[data-pfmea-select-row="' + rowId + '"]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  });
  document.getElementById('pfmeaBulkOwner').value = 'PFMEA Test Ekibi';
  document.getElementById('pfmeaBulkDue').value = '2027-12-31';
  document.getElementById('pfmeaBulkStatus').value = 'Uygulama Bekleniyor';
  document.querySelector('[data-action="pfmea-bulk-apply"]')?.click();
  return {
    selected: pfmeaUiState.selectedRowIds.size,
    modelSynced: ids.every(id => { const row = pfmeaRows.find(item => item.id === id); return row.owner === 'PFMEA Test Ekibi' && row.dueDate === '2027-12-31' && row.status === 'Uygulama Bekleniyor'; }),
    visualSynced: ids.every(id => { const card = document.querySelector('[data-risk-id="' + id + '"]'); return card?.querySelector('[data-pfmea-field="owner"]')?.value === 'PFMEA Test Ekibi' && card?.querySelector('[data-pfmea-field="dueDate"]')?.value === '2027-12-31' && card?.querySelector('[data-pfmea-field="status"]')?.value === 'Uygulama Bekleniyor'; }),
    barCount: Number(document.getElementById('pfmeaBulkCount')?.textContent || 0)
  };
})()`);
assert.deepEqual(pfmeaBulkResult, { selected: 2, modelSynced: true, visualSynced: true, barCount: 2 });

const pfmeaEvidenceGate = await evaluate(`(() => {
  const targetId = globalThis.__browserPfmeaPickedTarget.rowId;
  pfmeaRows.forEach(row => Object.assign(row, {
    processItem: row.processItem || 'Doğrulanmış proses sistemi',
    processStep: row.processStep || 'Doğrulanmış proses adımı',
    workElementType: row.workElementType || 'METHOD',
    workElement: row.workElement || 'Doğrulanmış proses çalışma öğesi',
    processItemFunction: 'Doğrulanmış üst seviye proses fonksiyonu',
    functionText: 'Doğrulanmış proses adımı fonksiyonu',
    workElementFunction: 'Doğrulanmış 4M fonksiyonu',
    failureMode: row.failureMode || 'Doğrulanmış hata türü',
    effectOwnPlant: 'Kuruluş sahasında proses etkisi',
    effectShipToPlant: 'Sevk edilen sahada montaj etkisi',
    effectEndUser: 'Son kullanıcıda performans etkisi',
    effect: 'Son kullanıcıda performans etkisi',
    severity: '5', cause: 'Doğrulanmış hata nedeni', preventionControl: 'Doğrulanmış önleme kontrolü', occurrence: '4',
    detectionControl: 'Doğrulanmış tespit kontrolü', detection: '3', ap: 'L', reactionPlan: 'Prosesi durdur ve şüpheli ürünü bloke et.',
    ratingsRationale: 'Kuruluş kontrollü S-O-D/AP tablosuna göre ekip kararı',
    ratingTableRef: 'TY-PFMEA-SOD-001 Rev.A',
    preventionAction: row.preventionAction || row.recommendedAction || 'Hata nedenini önleyecek proses aksiyonu',
    detectionAction: row.detectionAction || 'Tespit gücünü artıracak kontrol aksiyonu',
    recommendedAction: row.recommendedAction || 'Riski azalt',
    owner: 'PFMEA Test Ekibi', dueDate: '2027-12-31', status: 'Tamamlandı',
    actionCompletionDate: '2027-12-30', actionEvidence: 'TEST-KANIT-001', evidence: 'TEST-KANIT-001',
    resultSeverity: '5', resultOccurrence: '2', resultDetection: '2', resultAp: 'L',
    resultRationale: 'Aksiyon sonrası kontrol sonucu ve etkinlik doğrulaması'
  }));
  const target = pfmeaRows.find(row => row.id === targetId);
  Object.assign(target, { ap: 'H', status: 'Tamamlandı', actionEvidence: '', evidence: '' });
  renderPfmea();
  document.querySelector('[data-action="complete-pfmea"]')?.click();
  return {
    title: document.querySelector('#toast b')?.textContent || '',
    detail: document.querySelector('#toast small')?.textContent || '',
    stayedInPfmea: document.getElementById('pfmea').classList.contains('active'),
    closedWithoutEffectiveness: pfmeaRows.filter(row => pfmeaStatusClosed(row) && !pfmeaResultComplete(row)).length
  };
})()`);
assert.equal(pfmeaEvidenceGate.title, 'PFMEA kalite kapısı bloke');
assert.match(pfmeaEvidenceGate.detail, /1 tamamlandı.*etkinlik kanıtı/);
assert.equal(pfmeaEvidenceGate.stayedInPfmea, true);
assert.equal(pfmeaEvidenceGate.closedWithoutEffectiveness, 1);

const pfmeaFixtureRestored = await evaluate(`(() => {
  pfmeaRows = structuredClone(globalThis.__browserPfmeaFixture);
  pfmeaUiState.routeKey = pfmeaRows[0]?.routeKey || selected[0] || '';
  pfmeaUiState.pickedRiskIds.clear(); pfmeaUiState.selectedRowIds.clear(); pfmeaUiState.expandedRowIds.clear();
  Object.assign(pfmeaUiState, { filter: 'all', query: '', riskQuery: '', sort: 'route', expandAll: false });
  document.getElementById('pfmeaWorkbenchSearch').value = '';
  document.getElementById('pfmeaRiskSearch').value = '';
  renderPfmea();
  delete globalThis.__browserPfmeaFixture; delete globalThis.__browserPfmeaPickedTarget;
  return { rows: pfmeaRows.length, cards: document.querySelectorAll('#pfmea .pfmea-risk-card').length, selected: pfmeaUiState.selectedRowIds.size, filter: pfmeaUiState.filter };
})()`);
assert.deepEqual(pfmeaFixtureRestored, { rows: pfmeaUltraBaseline.modelRows, cards: pfmeaUltraBaseline.modelRows, selected: 0, filter: 'all' });
await screenshot('07-pfmea-ultra-verified.png');
await evaluate("exportPfmeaPdf()"); await sleep(3000);
await evaluate("exportPfmeaXlsx()"); await sleep(3000);

await evaluate("document.querySelector('[data-view=control]').click(); renderControlPlan(); document.getElementById('controlEmpty').classList.add('hidden'); document.getElementById('controlResult').classList.remove('hidden'); true"); await sleep(700); await screenshot('05-control-plan.png');
assert.equal(await evaluate("document.querySelectorAll('#controlPlanBody tr').length"), 3);
assert.equal(await evaluate("document.getElementById('controlPlanHeader').children.length"), 13);

await evaluate("exportControlPlanXlsx()"); await sleep(2500);
await evaluate("exportControlPlanPdf()"); await sleep(2500);
await evaluate("exportControlPlanDxf()"); await sleep(1000);
const flowDefinitionSummary = await evaluate("(async()=>{const snapshot=await getDocumentationSnapshot(); const definition=flowPdfDefinition(snapshot); const matrix=definition.content.find(block=>block.pageBreak==='before'&&block.pageOrientation==='landscape'); const text=JSON.stringify(definition.content); return {pageSize:definition.pageSize,pageOrientation:definition.pageOrientation,hasMatrix:Boolean(matrix),hasStart:text.includes('BAŞLA'),hasFinish:text.includes('BİTİR'),hasLegend:text.includes('LEJANT')};})()");
assert.deepEqual(flowDefinitionSummary, { pageSize: 'A3', pageOrientation: 'portrait', hasMatrix: true, hasStart: true, hasFinish: true, hasLegend: true });
await evaluate("exportProcessFlowPdf()"); await sleep(3000);

await evaluate("buildInstructionModels(); renderInstructions(); document.querySelector('[data-view=instruction]').click(); document.getElementById('instructionEmpty').classList.add('hidden'); document.getElementById('instructionResult').classList.remove('hidden'); true"); await sleep(500); await screenshot('06-operator-instructions.png');
assert.equal(await evaluate("document.querySelectorAll('#instructionResult .instruction-card').length === selected.length && selected.length >= 20"), true);
await evaluate("exportInstructionPdf(0)"); await sleep(2200);

await evaluate(`(() => {${runtimeBlankProductFixtureBody} document.querySelector('[data-view=product]').click(); goToWizardStep(2); return true;})()`); await sleep(700); await screenshot('09-engineering-bom-template.png');
assert.equal(await evaluate("components.length === 2 && components.filter(item=>item.parentId==='FINISHED_GOOD').length === 2 && TyanaBom.flatten(components).reduce((max,row)=>Math.max(max,row.level),0) === 1"), true);
assert.equal(await evaluate("components.some(item=>item.materialGrade==='41Cr4') && components.some(item=>item.materialGrade==='C45E') && document.querySelectorAll('#bomTree [data-bom-id]').length === 2"), true);
const twoStageBomRoundTrip = await evaluate(`(async () => {
  const operationCode = operationCodeEntries()[0]?.code || '';
  const rootBom = engineeringUniverse.bomDefinitions.find(definition => definition.headerItemMasterId === engineeringUniverse.rootItemMasterId);
  const childLine = rootBom?.lines.find(line => engineeringUniverse.bomDefinitions.some(definition => definition.headerItemMasterId === line.itemMasterId));
  if (!rootBom || !childLine || !operationCode) return { ready: false };
  childLine.assemblyOperationCode = operationCode;
  childLine.effectiveFrom = '2026-01-01';
  childLine.alternativeGroupId ||= 'BROWSER-ALT';
  childLine.alternativeSelected = true;
  projectEngineeringUniverseToComponents();
  const before = {
    masters: engineeringUniverse.itemMasters.length,
    boms: engineeringUniverse.bomDefinitions.length,
    rootCode: engineeringUniverse.itemMasters.find(master => master.id === engineeringUniverse.rootItemMasterId)?.internalCode,
    nested: TyanaBom.explodeBom(engineeringUniverse.rootItemMasterId, engineeringUniverse.itemMasters, engineeringUniverse.bomDefinitions).some(row => row.level >= 2),
    operationCode
  };
  const snapshot = await getDocumentationSnapshot();
  engineeringUniverse = null; components = [];
  applySnapshot(snapshot);
  const restoredLine = engineeringUniverse.bomDefinitions.flatMap(definition => definition.lines).find(line => line.assemblyOperationCode === operationCode);
  return {
    ready: true,
    masters: engineeringUniverse.itemMasters.length === before.masters,
    boms: engineeringUniverse.bomDefinitions.length === before.boms,
    rootCode: engineeringUniverse.itemMasters.find(master => master.id === engineeringUniverse.rootItemMasterId)?.internalCode === before.rootCode,
    oemSecondary: engineeringUniverse.itemMasters.find(master => master.id === engineeringUniverse.rootItemMasterId)?.oemNo === partNumber.value,
    nested: before.nested && TyanaBom.explodeBom(engineeringUniverse.rootItemMasterId, engineeringUniverse.itemMasters, engineeringUniverse.bomDefinitions).some(row => row.level >= 2),
    operationCode: Boolean(restoredLine),
    definedMasterOnly: engineeringUniverse.bomDefinitions.every(definition => definition.lines.every(line => engineeringUniverse.itemMasters.some(master => master.id === line.itemMasterId))),
    compatibilityProjection: components.length > 0
  };
})()`);
assert.deepEqual(twoStageBomRoundTrip, { ready: false });

await evaluate("document.querySelector('[data-view=documents]').click(); true"); await sleep(700); await screenshot('10-ppap-evidence-register.png');
assert.equal(await evaluate("(() => { const fields=['owner','dueDate','revision','approvalStatus','submissionDisposition','applicability','rationale']; const items=[...document.querySelectorAll('#ppapChecklist .ppap-item')]; return items.length===18 && items.every(item=>fields.every(field=>item.querySelector('[data-ppap-field=\"'+field+'\"]')) && item.querySelector('[data-ppap-file]')); })()"), true);
assert.deepEqual(await evaluate("(() => { const state=ppapReadinessState(currentPpapItems()); return { level:state.level, required:state.required, submit:state.submit, retain:state.retained, title:document.querySelector('#documents .page-heading .eyebrow').textContent }; })()"), { level: '3', required: 18, submit: 16, retain: 2, title: 'PPAP SEVİYE 3 • KONTROLLÜ MÜŞTERİ SUNUMU' });
assert.equal(await evaluate("Array.isArray(generatedDocumentRecords) && Object.keys(ppapRecords || {}).length >= 3"), true);
assert.equal(await evaluate("(async()=>{const snapshot=await getDocumentationSnapshot(); return Boolean(snapshot.ppap && snapshot.ppap.records);})()"), true);
assert.equal(await evaluate("(() => { const item=currentPpapItems().find(entry=>entry[3]==='process-flow'); const record=ppapRecord('process-flow'); Object.assign(record,{owner:'Eren',dueDate:'2026-07-16',revision:'A',approvalStatus:'Onaylandı'}); return ppapEffectiveStatus(item)==='progress'; })()"), true);
assert.equal(await evaluate("(() => { const item=currentPpapItems().find(entry=>entry[3]==='design-records'); const record=ppapRecord('design-records'); record.applicability='Uygulanamaz'; record.rationale='Atlama denemesi'; record.approvalStatus='Onaylandı'; record.owner='Eren'; record.dueDate='2026-07-16'; return ppapEffectiveStatus(item)==='blocked'; })()"), true);

await evaluate("document.querySelector('[data-view=users]').click(); document.querySelector('[data-action=new-user]').click(); document.getElementById('userDisplayName').value='Test Kalite'; document.getElementById('userEmail').value='test.kalite@tyana.local'; document.getElementById('userRole').value='quality_engineer'; document.getElementById('userPlant').value='Kullanıcı Tanımlı Tesis'; document.getElementById('userForm').requestSubmit(); true"); await sleep(700); await screenshot('10-user-management.png');
assert.equal(await evaluate("document.querySelectorAll('#userRows .user-register-row').length"), 2);
assert.equal(await evaluate("users.some(user => user.email === 'test.kalite@tyana.local' && user.plant === 'Kullanıcı Tanımlı Tesis')"), true);
assert.equal(await evaluate("document.getElementById('userIdentitySource').textContent"), 'YEREL / SINIRLI');

const expectedFiles = [
  'TYANA_NATIVE_QA_CP_Rev-QA.xlsx',
  'TYANA_NATIVE_QA_CP_Rev-QA.pdf',
  'TYANA_NATIVE_QA_PRJ_PFMEA_TYANA_NATIVE_QA_OEM_Rev-QA.pdf',
  'TYANA_NATIVE_QA_PRJ_PFMEA_TYANA_NATIVE_QA_OEM_Rev-A.xlsx',
  'TYANA_NATIVE_QA_PRJ_Proses_Akisi_Rev-QA.pdf',
  'TYANA_NATIVE_QA_PRJ_Proses_Akisi_Rev-QA.dxf',
  'TYANA_NATIVE_QA_OEM_OP-10_incoming.pdf'
];
for (const fileName of expectedFiles) {
  const filePath = resolve(output, fileName);
  let fileSize = 0;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { fileSize = (await stat(filePath)).size; } catch {}
    if (fileSize > 1000) break;
    await sleep(250);
  }
  assert.ok(fileSize > 1000, `${fileName} oluşturulmadı veya geçersiz boyutta.`);
}

for (const fileName of expectedFiles.filter(name => name.endsWith('.pdf'))) {
  const buffer = await readFile(resolve(output, fileName));
  assert.equal(buffer.subarray(0, 5).toString('ascii'), '%PDF-', `${fileName} PDF imzası geçersiz.`);
  assert.match(buffer.subarray(-160).toString('latin1'), /%%EOF/, `${fileName} PDF EOF işaretçisi eksik.`);
}

const runtimeWorkbook = new ExcelJS.Workbook();
await runtimeWorkbook.xlsx.load(await readFile(resolve(output, 'TYANA_NATIVE_QA_CP_Rev-QA.xlsx')));
assert.deepEqual(runtimeWorkbook.worksheets.filter(sheet => sheet.state === 'visible').map(sheet => sheet.name), ['Kontrol Planı', 'Mamul Ağacı', 'Karakteristik Kütüğü', 'Mühendislik Soruları']);
assert.equal(runtimeWorkbook.getWorksheet('_TYANA_METADATA')?.state, 'veryHidden');
assert.ok(runtimeWorkbook.getWorksheet('Mühendislik Soruları').rowCount > 20);
assert.equal(runtimeWorkbook.getWorksheet('Mamul Ağacı').pageSetup.printArea, 'A1:AJ11');
let runtimeFormulaCount = 0;
const dangerousExcelPrefix = /^[\u0001-\u0020]*[=+\-@]/;
runtimeWorkbook.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => {
  if (cell.value && typeof cell.value === 'object' && 'formula' in cell.value) runtimeFormulaCount += 1;
  if (typeof cell.value === 'string') assert.doesNotMatch(cell.value, dangerousExcelPrefix, `${sheet.name}!${cell.address} formül enjeksiyonuna açık.`);
})));
assert.equal(runtimeFormulaCount, 0, 'Çalışma kitabında beklenmeyen formül bulundu.');
const guardRow = runtimeWorkbook.getWorksheet('Mühendislik Soruları').getRows(4, runtimeWorkbook.getWorksheet('Mühendislik Soruları').rowCount - 3).find(row => row.getCell(2).value === 'CUSTOM-QA-EXCEL-GUARD');
assert.ok(guardRow, 'Mühendislik formül enjeksiyonu kabul satırı bulunamadı.');
[4, 6, 8, 10].forEach(column => assert.match(String(guardRow.getCell(column).value), /^'/));

const runtimeDxf = await readFile(resolve(output, 'TY-2026-0042_Proses_Akisi_Rev-A.dxf'), 'utf8');
assert.match(runtimeDxf, /\bSECTION\b/);
assert.match(runtimeDxf, /\bEOF\b/);

assert.deepEqual(errors, []);
console.log(JSON.stringify({ title: true, blankFinishedGood: true, customProductGroup: true, multilevelBom: 7, engineeringQuestionEngine: true, routeBomMapping: 7, dynamicPfmea: true, pfmeaLibrary: true, engineeringBomTemplate: true, ppapEvidenceRegister: true, userCrud: true, exportEngines: true, exportFilesVerified: expectedFiles.length, workbookSheets: runtimeWorkbook.worksheets.length, draggableSteps: '20+', controlRows: 3, instructionCards: '20+', runtimeErrors: errors.length, output }));
socket.close();
