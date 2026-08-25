import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { runtimeBlankProductFixtureBody } from './runtime-blank-product-fixture.mjs';

const port = Number(process.env.CDP_PORT || 9223);
const [mode = 'status', exportKind = ''] = process.argv.slice(2);

async function waitForPage() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json`).then(response => response.json());
      const target = targets.find(item => item.type === 'page' && item.url.startsWith('http://tauri.localhost'));
      if (target?.webSocketDebuggerUrl) return target;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Kurulu TYANA WebView2 CDP hedefi bulunamadı.');
}

const target = await waitForPage();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let messageId = 0;
const pending = new Map();
const diagnostics = [];
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') diagnostics.push({ method: message.method, text: message.params?.exceptionDetails?.exception?.description || message.params?.exceptionDetails?.text });
  if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params?.type)) diagnostics.push({ method: message.method, type: message.params.type, text: (message.params.args || []).map(arg => arg.value || arg.description).join(' ') });
  if (message.method === 'Log.entryAdded') diagnostics.push({ method: message.method, level: message.params?.entry?.level, text: message.params?.entry?.text, url: message.params?.entry?.url });
  if (!message.id || !pending.has(message.id)) return;
  const operation = pending.get(message.id);
  pending.delete(message.id);
  message.error ? operation.reject(new Error(message.error.message)) : operation.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++messageId;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression, awaitPromise = true) => {
  const response = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result?.value;
};

await send('Runtime.enable');

if (mode === 'status') {
  const result = await evaluate(`(async () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (globalThis.ExcelJS && globalThis.pdfMake && globalThis.TyanaBom && globalThis.TyanaProductDefinition && globalThis.TyanaGuide && typeof productEngineeringLibrary !== 'undefined' && productEngineeringLibrary && typeof pfmeaEngineeringLibrary !== 'undefined' && pfmeaEngineeringLibrary && typeof bomEngineeringLibrary !== 'undefined' && bomEngineeringLibrary && typeof qualityDocumentLibrary !== 'undefined' && qualityDocumentLibrary && typeof operationCodeLibrary !== 'undefined' && operationCodeLibrary?.operations?.length === 380 && typeof processes !== 'undefined' && processes.length >= 34) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const machineLibrary = await TyanaProductDefinition.loadMachineLibrary(true);
    const license = await TyanaPlatform.licenseStatus();
    return {
      ready: document.readyState,
      desktop: Boolean(globalThis.TyanaPlatform?.isDesktop),
      title: document.title,
      tenant: typeof tenantSnapshotProfile === 'function' ? tenantSnapshotProfile() : null,
      tauriUrl: location.href,
      librariesReady: Boolean(globalThis.TyanaBom && productEngineeringLibrary && pfmeaEngineeringLibrary && bomEngineeringLibrary && qualityDocumentLibrary && operationCodeLibrary?.operations?.length === 380 && processes.length >= 34),
      excelReady: Boolean(globalThis.ExcelJS),
      pdfReady: Boolean(globalThis.pdfMake),
      processCount: processes.length,
      productQuestionSets: productEngineeringLibrary?.questionSets?.length || 0,
      pfmeaRisks: pfmeaEngineeringLibrary?.riskTemplates?.length || 0,
      bomTemplates: bomEngineeringLibrary?.templates?.length || 0,
      bomCatalogs: bomEngineeringLibrary?.catalogs?.length || 0,
      qualityPlans: qualityDocumentLibrary?.sourceControlPlans?.length || 0,
      instructionPresets: qualityDocumentLibrary?.instructionPresets?.length || 0,
      operationCodes: operationCodeLibrary?.operations?.length || 0,
      machineLibraryReady: Boolean(globalThis.TyanaProductDefinition),
      machines: machineLibrary?.machines?.length || 0,
      machineTypes: new Set((machineLibrary?.machines || []).map(machine => machine.machineType)).size,
      guideReady: Boolean(globalThis.TyanaGuide && document.getElementById('qflowJourneyBar') && document.getElementById('qflowGuideDrawer')),
      guideStages: globalThis.TyanaGuide?.stages?.().length || 0,
      licenseActive: license.active,
      licenseDays: license.trialDays,
      licenseDevice: license.deviceId
    };
  })()`);
  console.log(JSON.stringify(result));
  assert.equal(result.desktop, true);
  assert.equal(result.title, 'TYANA Q-FLOW | Kalite Dokümantasyonu');
  assert.equal(result.tenant?.productName, 'TYANA Q-FLOW');
  assert.equal(result.tenant?.shortName, 'Kullanıcı Tanımlı Kuruluş');
  assert.equal(result.tenant?.plant, 'Kullanıcı Tanımlı Tesis');
  assert.equal(result.tauriUrl, 'http://tauri.localhost/');
  assert.equal(result.librariesReady, true);
  assert.equal(result.excelReady, true);
  assert.equal(result.pdfReady, true);
  assert.equal(result.qualityPlans, 2);
  assert.equal(result.instructionPresets, 10);
  assert.equal(result.operationCodes, 380);
  assert.equal(result.machineLibraryReady, true);
  assert.ok(result.machines >= 77, 'Kurulum tohumu olan 77 makine korunmalı; kullanıcı ekleri kabul edilir.');
  assert.equal(result.machineTypes, 5);
  assert.equal(result.guideReady, true);
  assert.equal(result.guideStages, 13);
  assert.equal(result.licenseActive, true);
  assert.equal(result.licenseDays, 30);
  assert.match(result.licenseDevice, /^[a-f0-9]{12}$/);
} else if (mode === 'product_definition') {
  const result = await evaluate(`(async () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (globalThis.TyanaProductDefinition && globalThis.TyanaApqp && globalThis.TyanaFmea && operationCodeLibrary?.operations?.length === 380 && processes?.length >= 34) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    applyProductTemplate('blank');
    productGroup.value = 'steering'; syncProductTypes();
    document.getElementById('productStructureType').value = 'single_part'; syncProductLevelContext();
    internalProductCode.value = 'QA-WORKPLAN-FG'; partNumber.value = 'QA-OEM-WORKPLAN'; partName.value = 'QA İş Planı Mamulü';
    syncFinishedGoodMasterIdentity();
    goToWizardStep(3); TyanaProductDefinition.renderWorkPlanStudio();
    const host = document.getElementById('workPlanRoutingHost');
    const initialOperationCards = document.querySelectorAll('[data-work-plan-operation]').length;
    const paletteSearch = document.getElementById('workPlanOperationSearch');
    paletteSearch.value = '114'; paletteSearch.dispatchEvent(new Event('input', { bubbles: true }));
    const operationCard = document.querySelector('[data-work-plan-operation="114"]');
    const transfer = new DataTransfer();
    operationCard.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
    host.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    host.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    await new Promise(resolve => setTimeout(resolve, 80));
    const root = engineeringUniverse.itemMasters.find(item => item.id === engineeringUniverse.rootItemMasterId);
    host.querySelector('[data-route-machine]').click();
    await new Promise(resolve => setTimeout(resolve, 80));
    const choiceCodes = [...document.querySelectorAll('#routeMachineChoices input[type=checkbox]')].map(input => input.value);
    const d24 = document.querySelector('#routeMachineChoices input[value="D24"]');
    if (d24) { d24.checked = true; d24.dispatchEvent(new Event('change', { bubbles: true })); }
    document.getElementById('routeMachineConfirm').click();
    await new Promise(resolve => setTimeout(resolve, 100));
    const itemEntry = selectedProcessEntries().find(entry => entry.detail.itemMasterRouting && entry.detail.itemMasterId === root.id);
    await TyanaProductDefinition.openDocumentRouteMachineDialog(itemEntry.routeKey);
    const documentChoiceCodes = [...document.querySelectorAll('#routeMachineChoices input[type=checkbox]')].map(input => input.value);
    const documentD24 = document.querySelector('#routeMachineChoices input[value="D24"]');
    if (documentD24) { documentD24.checked = true; documentD24.dispatchEvent(new Event('change', { bubbles: true })); }
    document.getElementById('routeMachineConfirm').click();
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      studioVisible: document.querySelector('.wizard-pane[data-pane="3"]').classList.contains('active'),
      productCards: document.querySelectorAll('[data-work-plan-master]').length,
      operationCards: initialOperationCards,
      dragDropAdded: Boolean(operationCard) && root.routingSteps[0]?.opCode === '114',
      routeSteps: root.routingSteps.length,
      selectedMachines: root.routingSteps[0]?.selectedMachines || [],
      itemChoiceCodes: choiceCodes,
      documentChoiceCodes,
      aggregateMachine: routeDetails[itemEntry.routeKey]?.machineId || '',
      machineDialogClosed: !document.getElementById('routeMachineDialog').open,
      advancedCollapsed: !document.querySelector('.advanced-process-guidance').open
    };
  })()`);
  assert.equal(result.studioVisible, true);
  assert.ok(result.productCards >= 1);
  assert.ok(result.operationCards >= 100);
  assert.equal(result.dragDropAdded, true);
  assert.equal(result.routeSteps, 1);
  assert.deepEqual(result.selectedMachines, ['D24']);
  assert.deepEqual(result.itemChoiceCodes, ['D24']);
  assert.deepEqual(result.documentChoiceCodes, ['D24']);
  assert.equal(result.aggregateMachine, 'D24');
  assert.equal(result.machineDialogClosed, true);
  assert.equal(result.advancedCollapsed, true);
  console.log(JSON.stringify({ mode, ...result }));
} else if (mode === 'product_upgrade') {
  const result = await evaluate(`(async () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (globalThis.TyanaProductDefinition && globalThis.TyanaApqp && operationCodeLibrary?.operations?.length === 380 && processes?.length >= 34) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    applyProductTemplate('blank');
    productGroup.value = 'steering'; syncProductTypes();
    document.getElementById('productStructureType').value = 'assembly'; syncProductLevelContext();
    internalProductCode.value = 'QA-UPGRADE-FG';
    partNumber.value = 'QA-OEM-UPGRADE';
    partName.value = 'QA Tam Kapsam Mamul';
    projectCode.value = '';
    controlPlanNumber.value = '';
    completeProductDocumentCodes();
    syncFinishedGoodMasterIdentity();
    updateSummary();
    const license = await TyanaPlatform.licenseStatus();
    const bulkButton = document.querySelector('[data-action="bulk-item-masters"]');
    bulkButton.click();
    const input = document.getElementById('bulkItemMasterInput');
    input.value = 'Yarı mamul;QA-YM-1001;İşlenmiş gövde;QA-OEM-YM;adet;Üret\\nHammadde;QA-HM-1001;ST52 boru;;kg;Satın Al';
    document.querySelector('[data-action="preview-bulk-item-masters"]').click();
    const previewText = document.getElementById('bulkItemMasterValidation').innerText;
    document.querySelector('[data-action="apply-bulk-item-masters"]').click();
    const root = engineeringUniverse.itemMasters.find(item => item.id === engineeringUniverse.rootItemMasterId);
    const semi = engineeringUniverse.itemMasters.find(item => item.internalCode === 'QA-YM-1001');
    const raw = engineeringUniverse.itemMasters.find(item => item.internalCode === 'QA-HM-1001');
    selectedItemMasterId = semi.id;
    showView('product');
    renderItemMasterUi();
    const technicalDetails = document.querySelector('#itemMasterEditor .item-master-advanced');
    technicalDetails.open = true;
    technicalDetails.dispatchEvent(new Event('toggle'));
    const technicalField = technicalDetails.querySelector('[data-master-field="heatTreatment"]');
    technicalField.value = 'QA kontrollÃ¼ Ä±sÄ±l iÅŸlem';
    technicalField.dispatchEvent(new Event('change', { bubbles: true }));
    updateSummary();
    const technicalPanelStayedOpen = document.querySelector('#itemMasterEditor .item-master-advanced')?.open === true;
    const technicalValueStored = engineeringUniverse.itemMasters.find(item => item.id === semi.id)?.heatTreatment;
    const productModule = document.getElementById('product').dataset.productModule;
    const itemStageMovedToProduct = document.getElementById('itemMasterStage').parentElement?.dataset?.pane === '1';
    showView('bom');
    const bomModule = document.getElementById('product').dataset.productModule;
    const bomPaneActive = document.querySelector('#product .wizard-pane[data-pane="2"]').classList.contains('active');
    createEngineeringBomDefinition(root.id);
    renderEngineeringBomStructure();
    const selectable = [...document.querySelectorAll('#bomDragMasterLibrary [data-bom-master-select]')].filter(item => [semi.id, raw.id].includes(item.value));
    selectable.forEach(item => { item.checked = true; item.dispatchEvent(new Event('change', { bubbles: true })); });
    const bomBulkButton = document.querySelector('[data-action="add-selected-bom-masters"]');
    const bomBulkButtonReadable = !bomBulkButton.disabled && bomBulkButton.getBoundingClientRect().width >= 110 && getComputedStyle(bomBulkButton).opacity === '1';
    bomBulkButton.click();
    const rootBom = engineeringUniverse.bomDefinitions.find(item => item.headerItemMasterId === root.id);
    renderEngineeringBomStructure();
    const rawPaletteCard = document.querySelector('[data-bom-drag-master="' + raw.id + '"]');
    const semiTreeTarget = document.querySelector('[data-engineering-tree-master="' + semi.id + '"]');
    const bomTransfer = new DataTransfer();
    rawPaletteCard.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: bomTransfer }));
    semiTreeTarget.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: bomTransfer }));
    semiTreeTarget.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: bomTransfer }));
    const semiBom = engineeringUniverse.bomDefinitions.find(item => item.headerItemMasterId === semi.id);
    goToWizardStep(3);
    TyanaProductDefinition.selectWorkPlanMaster(root.id);
    const contextIds = TyanaProductRoutingContext.recommendedProcessIds();
    const matchingOperationCodes = contextIds.map(processId => operationCodeEntries().find(record => record.standardProcessCard?.canonicalProcessId === processId)?.code).filter(Boolean);
    const recommendButton = document.querySelector('[data-item-route-recommend]');
    recommendButton?.click();
    const recommendedCount = engineeringUniverse.itemMasters.find(item => item.id === engineeringUniverse.rootItemMasterId)?.routingSteps?.length || 0;
    TyanaProductDefinition.selectWorkPlanMaster(semi.id);
    const copySource = document.querySelector('[data-route-copy-source]');
    const copySourceOptions = [...copySource.options].map(option => option.value);
    copySource.value = root.id;
    const copyButton = document.querySelector('[data-item-route-copy]');
    const copyButtonDisabled = copyButton.disabled;
    copyButton.click();
    goToWizardStep(5);
    TyanaApqp.mapCharacteristics();
    TyanaApqp.seedAnalysisFromProduct();
    document.getElementById('boundaryExternalName').value = 'QA Komşu Sistem';
    document.getElementById('boundaryExternalFunction').value = 'Mekanik yük aktarımı';
    document.querySelector('[data-apqp-action="add-boundary-external"]').click();
    let analysisState = TyanaApqp.snapshot();
    document.getElementById('boundaryInterfaceFrom').value = analysisState.boundary.internalElements[0].id;
    document.getElementById('boundaryInterfaceTo').value = analysisState.boundary.externalElements[0].id;
    document.getElementById('boundaryInterfaceType').value = 'physical';
    document.getElementById('boundaryInterfaceDescription').value = 'QA fiziksel bağlantı ve kuvvet aktarımı';
    document.querySelector('[data-apqp-action="add-boundary-interface"]').click();
    document.querySelector('[data-apqp-analysis-tab="pDiagram"]').click();
    const pFunction = document.querySelector('[data-analysis-meta="pDiagram.functionText"]');
    pFunction.value = 'QA direksiyon hareketini güvenli ve gecikmesiz iletmek';
    pFunction.dispatchEvent(new Event('change', { bubbles: true }));
    for (const [field, value] of [
      ['inputSignals', 'Direksiyon hareketi'],
      ['controlFactors', 'Malzeme ve tolerans seçimi'],
      ['intendedOutputs', 'Doğru tekerlek yönlendirmesi'],
      ['errorStates', 'Bağlantı fonksiyon kaybı'],
      ['functionalRequirements', 'Basma ve çekme kuvvetine dayanım']
    ]) {
      const input = document.querySelector('[data-p-input="' + field + '"]');
      input.value = value;
      document.querySelector('[data-p-add="' + field + '"]').click();
    }
    for (const [key, value] of [
      ['pieceVariation', 'Malzeme değişkenliği'],
      ['timeVariation', 'Aşınma'],
      ['customerUsage', 'Sürüş tarzı'],
      ['environment', 'Yol ve iklim şartları'],
      ['systemInteraction', 'Komşu sistem boşluğu']
    ]) {
      const input = document.querySelector('[data-p-noise-input="' + key + '"]');
      input.value = value;
      document.querySelector('[data-p-noise-add="' + key + '"]').click();
    }
    const traceability = TyanaApqp.snapshot();
    const analysisReadiness = TyanaApqp.readiness();
    showView('pfmea');
    if (!pfmeaRows.length) {
      const firstEntry = selectedProcessEntries()[0];
      pfmeaRows.push(newPfmeaRow({ routeKey: firstEntry?.routeKey || '', processId: firstEntry?.process?.id || '', operationNo: firstEntry?.detail?.operationNo || '' }));
    }
    renderPfmea();
    const ratingRow = pfmeaRows[0];
    openPfmeaRatingGuide(ratingRow.id, 'severity');
    document.querySelector('#pfmeaRatingGuideList [data-pfmea-rating-score="8"]').click();
    document.getElementById('pfmeaRatingGuideRationale').value = 'QA: son kullanıcı temel fonksiyon kaybı ekipçe doğrulandı.';
    document.getElementById('pfmeaRatingGuideSource').value = 'QA-FMEA-TABLO-REV-A';
    document.getElementById('pfmeaRatingGuideApply').click();
    const guidedRatingApplied = ratingRow.severity === '8'
      && ratingRow.severityRationale.startsWith('QA:')
      && ratingRow.ratingTableRef === 'QA-FMEA-TABLO-REV-A'
      && !document.getElementById('pfmeaRatingGuideDialog').open;
    showView('dfmea');
    TyanaFmea.render();
    const dfmeaAuditQuestions = document.querySelectorAll('#dfmeaGovernanceStudio .fmea-audit-question').length;
    const pfmeaAuditQuestions = document.querySelectorAll('#pfmeaGovernanceStudio .fmea-audit-question').length;
    document.querySelector('[data-fmea-action="add-dfmea-row"]').click();
    const dfmeaRows = document.querySelectorAll('#dfmeaAnalysisRows .dfmea-analysis-row').length;
    const fmeaSnapshot = TyanaFmea.snapshot();
    const updatedSemi = engineeringUniverse.itemMasters.find(item => item.id === semi.id);
    renderProductUpgradeCockpit();
    return {
      licenseActive: license.active,
      licenseDays: license.trialDays,
      badgeVisible: !document.getElementById('trialStatusBadge').classList.contains('hidden'),
      cockpitVisible: Boolean(document.getElementById('productUpgradeCockpit')),
      identityMetric: document.getElementById('upgradeIdentityMetric').textContent,
      previewText,
      itemMasters: engineeringUniverse.itemMasters.length,
      bomLines: rootBom?.lines?.length || 0,
      nestedBomLines: semiBom?.lines?.length || 0,
      nestedBomDropTarget: Boolean(semiTreeTarget),
      explicitBomDropZone: Boolean(document.getElementById('bomDefinitionDropZone')),
      bomBulkButtonReadable,
      ratingGuideCounts: ['severity', 'occurrence', 'detection'].map(key => pfmeaEngineeringLibrary?.ratingGuides?.[key]?.length || 0),
      ratingGuideDialog: Boolean(document.getElementById('pfmeaRatingGuideDialog')),
      apMatrixSamples: [pfmeaSuggestedActionPriority(10, 10, 10), pfmeaSuggestedActionPriority(9, 4, 1), pfmeaSuggestedActionPriority(1, 10, 10)],
      guidedRatingApplied,
      contextIds,
      matchingOperationCodes,
      recommendButton: Boolean(recommendButton),
      recommendedCount,
      copiedCount: updatedSemi.routingSteps.length,
      copiedSource: updatedSemi.routingSteps[0]?.source || '',
      copySourceOptions,
      copyButtonDisabled,
      rawIsBuy: raw.procurementType === 'BUY',
      routeAccelerator: Boolean(document.querySelector('.item-route-accelerator')),
      technicalPanelStayedOpen,
      technicalValueStored,
      productModule,
      itemStageMovedToProduct,
      bomModule,
      bomPaneActive,
      apqpRows: traceability.rows.length,
      apqpChainNodes: document.querySelectorAll('#apqpEvidenceChain article').length,
      apqpCharacteristicLinked: Boolean(traceability.rows[0]?.characteristicId),
      apqpProfile: traceability.fmeaProfile,
      apqpSchema: traceability.schemaVersion,
      boundaryInternal: traceability.boundary.internalElements.length,
      boundaryExternal: traceability.boundary.externalElements.length,
      boundaryInterfaces: traceability.boundary.interfaces.length,
      pNoiseFactors: Object.values(traceability.pDiagram.noiseFactors).flat().length,
      pFunctionStored: traceability.pDiagram.functionText,
      analysisReadiness,
      dfmeaAuditQuestions,
      pfmeaAuditQuestions,
      dfmeaRows,
      fmeaSnapshotSchema: fmeaSnapshot.schemaVersion
    };
  })()`);
  assert.equal(result.licenseActive, true);
  assert.equal(result.licenseDays, 30);
  assert.equal(result.badgeVisible, true);
  assert.equal(result.cockpitVisible, true);
  assert.equal(result.identityMetric, '5/5');
  assert.match(result.previewText, /2 kart satırı doğrulandı/);
  assert.equal(result.itemMasters, 3);
  assert.equal(result.bomLines, 2);
  assert.equal(result.nestedBomLines, 1);
  assert.equal(result.nestedBomDropTarget, true);
  assert.equal(result.explicitBomDropZone, true);
  assert.equal(result.bomBulkButtonReadable, true);
  assert.deepEqual(result.ratingGuideCounts, [10, 10, 10]);
  assert.equal(result.ratingGuideDialog, true);
  assert.deepEqual(result.apMatrixSamples, ['H', 'M', 'L']);
  assert.equal(result.guidedRatingApplied, true);
  console.log(JSON.stringify({ mode, ...result }));
  assert.ok(result.recommendedCount > 0);
  assert.equal(result.copiedCount, result.recommendedCount);
  assert.match(result.copiedSource, /^copied-from:/);
  assert.equal(result.rawIsBuy, true);
  assert.equal(result.routeAccelerator, true);
  assert.equal(result.technicalPanelStayedOpen, true);
  assert.match(result.technicalValueStored, /QA/);
  assert.equal(result.productModule, 'product');
  assert.equal(result.itemStageMovedToProduct, true);
  assert.equal(result.bomModule, 'bom');
  assert.equal(result.bomPaneActive, true);
  assert.equal(result.apqpRows, 1);
  assert.equal(result.apqpChainNodes, 11);
  assert.equal(result.apqpCharacteristicLinked, true);
  assert.equal(result.apqpProfile, 'family');
  assert.equal(result.apqpSchema, '2.0.0');
  assert.ok(result.boundaryInternal >= 2);
  assert.equal(result.boundaryExternal, 1);
  assert.equal(result.boundaryInterfaces, 1);
  assert.equal(result.pNoiseFactors, 5);
  assert.match(result.pFunctionStored, /güvenli/);
  assert.equal(result.analysisReadiness.boundary, 100);
  assert.equal(result.analysisReadiness.pDiagram, 100);
  assert.equal(result.dfmeaAuditQuestions, 44);
  assert.equal(result.pfmeaAuditQuestions, 48);
  assert.equal(result.dfmeaRows, 2);
  assert.equal(result.fmeaSnapshotSchema, '1.2.0');
} else if (mode === 'screenshot') {
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false });
  const requestedSurface = ['product', 'bom', 'workplan', 'dfmea', 'pfmea', 'pfmea_rating', 'apqp', 'documents'].includes(exportKind) ? exportKind : 'dfmea';
  await evaluate(`(() => {
    const surface = ${JSON.stringify(requestedSurface)};
    if (surface === 'apqp') {
      showView('product');
      document.querySelectorAll('.wizard-pane').forEach((pane) => pane.classList.toggle('active', pane.dataset.pane === '5'));
      TyanaApqp?.render?.();
      document.getElementById('apqpTraceabilityStudio')?.scrollIntoView({ block: 'start' });
    } else if (surface === 'documents') {
      showView('documents');
      renderDocumentationAudit?.();
      document.getElementById('documentationAuditPanel')?.scrollIntoView({ block: 'start' });
    } else if (surface === 'pfmea_rating') {
      showView('pfmea');
      renderPfmea();
      const row = pfmeaRows[0];
      if (row) openPfmeaRatingGuide(row.id, 'severity');
    } else {
      showView(surface);
      if (surface === 'dfmea' || surface === 'pfmea') TyanaFmea?.render?.();
      document.querySelector(surface === 'dfmea' ? '#dfmeaAnalysisRows' : surface === 'pfmea' ? '.pfmea-workbench' : '#product')?.scrollIntoView({ block: 'start' });
    }
    return { surface, productModule: document.getElementById('product')?.dataset.productModule };
  })()`);
  await new Promise(resolve => setTimeout(resolve, 250));
  const capture = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  const outputDirectory = new URL('../output/qa/', import.meta.url);
  const outputFile = new URL(`../output/qa/tyana-qflow-1.11-${requestedSurface}.png`, import.meta.url);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputFile, Buffer.from(capture.data, 'base64'));
  console.log(JSON.stringify({ mode, screenshot: outputFile.pathname, bytes: Buffer.byteLength(capture.data, 'base64') }));
} else if (mode === 'inspect') {
  const result = await evaluate(`(() => {
    const describe = (owner, key) => {
      const descriptor = Object.getOwnPropertyDescriptor(owner, key);
      return {
        configurable: descriptor?.configurable,
        enumerable: descriptor?.enumerable,
        writable: descriptor?.writable,
        hasGetter: typeof descriptor?.get === 'function',
        source: typeof owner?.[key] === 'function' ? Function.prototype.toString.call(owner[key]).slice(0, 600) : typeof owner?.[key]
      };
    };
    return {
      coreInvoke: describe(__TAURI__.core, 'invoke'),
      internalsInvoke: globalThis.__TAURI_INTERNALS__ ? describe(globalThis.__TAURI_INTERNALS__, 'invoke') : null,
      internalsIpc: globalThis.__TAURI_INTERNALS__ ? describe(globalThis.__TAURI_INTERNALS__, 'ipc') : null,
      saveArtifact: describe(globalThis.TyanaPlatform, 'saveArtifact'),
      tauriKeys: Object.keys(__TAURI__),
      internalKeys: globalThis.__TAURI_INTERNALS__ ? Object.keys(globalThis.__TAURI_INTERNALS__) : []
    };
  })()`);
  console.log(JSON.stringify(result));
} else if (mode === 'diagnose_assets') {
  const result = await evaluate(`(async () => {
    const inspectUrl = async url => {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        const bytes = new Uint8Array(await response.arrayBuffer());
        return { url, ok: response.ok, status: response.status, bytes: bytes.length, type: response.headers.get('content-type'), head: new TextDecoder().decode(bytes.slice(0, 80)) };
      } catch (error) {
        return { url, error: error?.message || String(error) };
      }
    };
    return {
      scripts: [...document.scripts].map(script => script.src),
      resources: performance.getEntriesByType('resource').map(entry => ({ name: entry.name, transferSize: entry.transferSize, decodedBodySize: entry.decodedBodySize })),
      assets: await Promise.all(['/vendor/pdfmake.min.js', '/vendor/vfs_fonts.js', '/vendor/exceljs.min.js', '/bom-domain.js', '/data/product-engineering-library.json', '/data/pfmea-engineering-library.json', '/data/bom-engineering-library.json', '/data/quality-document-library.json', '/data/operation-code-library.tr-en.v1.0.0.json', '/seed-processes.json', '/desktop-build-manifest.json'].map(inspectUrl))
    };
  })()`);
  console.log(JSON.stringify(result));
} else if (mode === 'reload_errors') {
  await send('Page.enable');
  await send('Log.enable');
  await send('Page.reload', { ignoreCache: true });
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log(JSON.stringify({ diagnostics }));
} else if (mode === 'diagnose_runtime') {
  const result = await evaluate(`(async () => {
    let processBridge;
    try {
      const payload = await TyanaPlatform.data.listProcesses();
      processBridge = { count: payload?.processes?.length || 0, first: payload?.processes?.[0]?.name || null };
    } catch (error) {
      processBridge = { error: error?.message || String(error) };
    }
    await loadEngineeringLibraries();
    return {
      processBridge,
      processVariable: processes.length,
      productLibrary: productEngineeringLibrary ? { sets: productEngineeringLibrary.questionSets?.length, groups: productEngineeringLibrary.productGroups?.length } : null,
      pfmeaLibrary: pfmeaEngineeringLibrary ? { risks: pfmeaEngineeringLibrary.riskTemplates?.length } : null,
      qualityLibrary: qualityDocumentLibrary ? { plans: qualityDocumentLibrary.sourceControlPlans?.length, instructions: qualityDocumentLibrary.instructionPresets?.length, rules: qualityDocumentLibrary.validationRules?.length } : null,
      operationCodeLibrary: operationCodeLibrary ? { operations: operationCodeLibrary.operations?.length, version: operationCodeLibrary.libraryVersion } : null,
      engineeringMessage: document.getElementById('engineeringQuestionRows')?.innerText?.slice(0, 500),
      objectPrototypeFrozen: Object.isFrozen(Object.prototype),
      arrayPrototypeFrozen: Object.isFrozen(Array.prototype)
    };
  })()`);
  console.log(JSON.stringify(result));
} else if (mode === 'prepare') {
  const result = await evaluate(`(async () => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (typeof applyProductTemplate === 'function' && globalThis.TyanaBom && typeof productEngineeringLibrary !== 'undefined' && productEngineeringLibrary && typeof pfmeaEngineeringLibrary !== 'undefined' && pfmeaEngineeringLibrary && typeof bomEngineeringLibrary !== 'undefined' && bomEngineeringLibrary && typeof qualityDocumentLibrary !== 'undefined' && qualityDocumentLibrary && typeof operationCodeLibrary !== 'undefined' && operationCodeLibrary?.operations?.length === 380 && typeof processes !== 'undefined' && processes.length >= 34) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (typeof applyProductTemplate !== 'function' || !globalThis.TyanaBom || !productEngineeringLibrary || !pfmeaEngineeringLibrary || !bomEngineeringLibrary || !qualityDocumentLibrary || operationCodeLibrary?.operations?.length !== 380 || processes.length < 34) throw new Error('Kurulu uygulama mühendislik motorları zamanında hazır olmadı.');
    // Startup restores the latest local project after the libraries are ready.
    // Let that restore finish before creating the isolated native acceptance model,
    // otherwise an older user project can overwrite the test fields between CDP calls.
    await TyanaPlatform.data.latestProject().catch(() => ({ project: null }));
    await new Promise(resolve => setTimeout(resolve, 250));
    currentProjectId = null;
    currentProjectVersion = 0;
    localStorage.removeItem('qflow-last-project-id');
    ${runtimeBlankProductFixtureBody}
    document.getElementById('controlPlanNumber').value = 'TYANA_NATIVE_QA_CP';
    document.getElementById('projectCode').value = 'TYANA_NATIVE_QA_PRJ';
    document.getElementById('partNumber').value = 'TYANA_NATIVE_QA_PART';
    document.getElementById('internalProductCode').value = 'TYANA_NATIVE_QA_STOCK';
    document.getElementById('partName').value = 'Native Export Acceptance';
    document.getElementById('supplierName').value = tenantOrganizationName();
    document.getElementById('supplierSite').value = tenantPlantName();
    document.getElementById('customer').value = 'Kullanıcı Tanımlı Müşteri';
    document.getElementById('customerPartNumber').value = 'CUSTOMER-REF-QA';
    document.getElementById('drawingNumber').value = 'TYANA-NATIVE-DWG-001';
    document.getElementById('drawingRevision').value = 'QA';
    document.getElementById('documentStatus').value = 'Taslak';
    selected = [...activeBackbone().processes];
    routeDetails = {};
    renderOptions();
    renderSequence();
    renderFlowDiagram();
    renderPfmea();
    buildInstructionModels();
    renderInstructions();
    globalThis.__nativeExportResults = {};
    const routeEntries = selectedProcessEntries();
    return { processes: processes.length, selected: selected.length, route: routeEntries.length, missingRouteIds: selected.filter(key => !routeEntries.some(entry => entry.routeKey === key)), pfmea: pfmeaRows.length, instructions: instructionModels.length, desktop: TyanaPlatform.isDesktop };
  })()`);
  assert.equal(result.desktop, true);
  assert.ok(result.processes >= 34);
  assert.ok(result.route >= 20);
  assert.deepEqual(result.missingRouteIds, []);
  assert.equal(result.instructions, result.route);
  console.log(JSON.stringify(result));
} else if (mode === 'flow_blob') {
  const result = await evaluate(`Promise.race([
    (async () => {
      const startedAt = performance.now();
      const snapshot = await getDocumentationSnapshot();
      const snapshotReadyAt = performance.now();
      const definition = flowPdfDefinition(snapshot);
      const definitionReadyAt = performance.now();
      const blob = await pdfBlob(definition);
      return {
        status: 'resolved',
        bytes: blob.size,
        pages: definition.content.length,
        snapshotMs: Math.round(snapshotReadyAt - startedAt),
        definitionMs: Math.round(definitionReadyAt - snapshotReadyAt),
        pdfMs: Math.round(performance.now() - definitionReadyAt)
      };
    })().catch(error => ({ status: 'error', error: error?.stack || error?.message || String(error) })),
    new Promise(resolve => setTimeout(() => resolve({ status: 'timeout' }), 120000))
  ])`);
  assert.equal(result.status, 'resolved', `Native proses PDF blob üretimi başarısız: ${JSON.stringify(result)}`);
  assert.ok(result.bytes > 8_000, `Native proses PDF blob boyutu geçersiz: ${result.bytes}`);
  console.log(JSON.stringify(result));
} else if (mode === 'filename') {
  const result = await evaluate(`(() => {
    const model = instructionModels[0];
    const names = {
      direct_dxf: 'TYANA_NATIVE_ACCEPTANCE.dxf',
      direct_xlsx: 'TYANA_NATIVE_ACCEPTANCE.xlsx',
      xlsx: safeFileName(controlPlanNumber.value) + '_Rev-' + safeFileName(drawingRevision.value) + '.xlsx',
      pfmea_xlsx: safeFileName(projectCode.value) + '_PFMEA_' + safeFileName(partNumber.value) + '_Rev-' + safeFileName(TyanaFmea.snapshot()?.profiles?.pfmea?.revision || drawingRevision.value) + '.xlsx',
      process_library_xlsx: 'TYANA_Q-Flow_Proses_Kutuphanesi_' + new Date().toISOString().slice(0, 10) + '.xlsx',
      operation_codes_xlsx: 'TYANA_Q-FLOW_TR-EN_Operasyon_Kodlari_' + new Date().toISOString().slice(0, 10) + '.xlsx',
      control_pdf: safeFileName(controlPlanNumber.value) + '_Rev-' + safeFileName(drawingRevision.value) + '.pdf',
      pfmea_pdf: safeFileName(projectCode.value) + '_PFMEA_' + safeFileName(partNumber.value) + '_Rev-' + safeFileName(drawingRevision.value) + '.pdf',
      flow_pdf: safeFileName(projectCode.value) + '_Proses_Akisi_Rev-' + safeFileName(drawingRevision.value) + '.pdf',
      instruction_pdf: safeFileName(partNumber.value) + '_OP-' + model.operationNo + '_' + safeFileName(model.processId) + '.pdf',
      all_instructions_pdf: safeFileName(partNumber.value) + '_Tum_Operator_Talimatlari.pdf',
      dxf: safeFileName(projectCode.value) + '_Proses_Akisi_Rev-' + safeFileName(drawingRevision.value) + '.dxf'
    };
    return names[${JSON.stringify(exportKind)}] || null;
  })()`);
  assert.ok(result, `Bilinmeyen export türü: ${exportKind}`);
  console.log(JSON.stringify({ exportKind, fileName: result }));
} else if (mode === 'start') {
  const expressions = {
    xlsx: 'exportControlPlanXlsx()',
    pfmea_xlsx: 'exportPfmeaXlsx()',
    control_pdf: 'exportControlPlanPdf()',
    pfmea_pdf: 'exportPfmeaPdf()',
    instruction_pdf: 'exportInstructionPdf(0)',
    all_instructions_pdf: 'exportAllInstructionsPdf()',
    dxf: 'exportControlPlanDxf()',
    flow_pdf: 'exportProcessFlowPdf()',
    process_library_xlsx: 'exportProcessLibrary()',
    operation_codes_xlsx: 'exportOperationCodeLibrary()',
    direct_dxf: `saveBlob(new Blob(['0\\r\\nSECTION\\r\\n2\\r\\nHEADER\\r\\n0\\r\\nENDSEC\\r\\n0\\r\\nEOF\\r\\n'], { type: 'application/dxf' }), 'TYANA_NATIVE_ACCEPTANCE.dxf', exportFileTypes.dxf)`,
    direct_xlsx: `(async () => {
      const workbook = new globalThis.ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Native Acceptance');
      sheet.addRow(['Kullanıcı Tanımlı Kuruluş', 'TYANA Q-FLOW', new Date().toISOString()]);
      const buffer = await workbook.xlsx.writeBuffer();
      return saveBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'TYANA_NATIVE_ACCEPTANCE.xlsx', exportFileTypes.xlsx);
    })()`
  };
  assert.ok(expressions[exportKind], `Bilinmeyen export türü: ${exportKind}`);
  const started = await evaluate(`(() => {
    globalThis.__nativeExportResults ||= {};
    globalThis.__nativeExportResults[${JSON.stringify(exportKind)}] = { status: 'pending' };
    Promise.resolve(${expressions[exportKind]}).then(
      value => { globalThis.__nativeExportResults[${JSON.stringify(exportKind)}] = { status: 'resolved', value }; },
      error => { globalThis.__nativeExportResults[${JSON.stringify(exportKind)}] = { status: 'error', error: error?.message || String(error) }; }
    );
    return 'started';
  })()`, false);
  assert.equal(started, 'started');
  console.log(JSON.stringify({ exportKind, started }));
} else if (mode === 'check') {
  const result = await evaluate(`(async () => {
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const value = globalThis.__nativeExportResults?.[${JSON.stringify(exportKind)}];
      if (value?.status && value.status !== 'pending') return value;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return globalThis.__nativeExportResults?.[${JSON.stringify(exportKind)}] || { status: 'missing' };
  })()`);
  assert.equal(result.status, 'resolved', `${exportKind} native export sonucu: ${JSON.stringify(result)}`);
  assert.equal(result.value?.saved, true, `${exportKind} dosyası yerel diske kaydedilmedi: ${JSON.stringify(result.value)}`);
  assert.equal(result.value?.method, 'tauri', `${exportKind} Tauri güvenli kayıt yolunu kullanmadı.`);
  assert.ok(result.value?.bytesWritten > 0, `${exportKind} yazılan byte sayısı doğrulanamadı.`);
  console.log(JSON.stringify({ exportKind, result }));
} else if (mode === 'peek') {
  const state = await evaluate(`globalThis.__nativeExportResults?.[${JSON.stringify(exportKind)}] || { status: 'missing' }`);
  console.log(JSON.stringify({ exportKind, result: state }));
} else if (mode === 'crypto') {
  const result = await evaluate(`Promise.race([
    sha256Blob(new Blob(['TYANA NATIVE CRYPTO ACCEPTANCE'], { type: 'text/plain' })).then(value => ({ status: 'resolved', value })),
    new Promise(resolve => setTimeout(() => resolve({ status: 'timeout' }), 5000))
  ])`);
  assert.equal(result.status, 'resolved', `WebView2 SHA-256 sonucu: ${JSON.stringify(result)}`);
  assert.match(result.value, /^[a-f0-9]{64}$/i);
  console.log(JSON.stringify({ crypto: result.status, sha256: result.value }));
} else {
  throw new Error(`Bilinmeyen mod: ${mode}`);
}

socket.close();
