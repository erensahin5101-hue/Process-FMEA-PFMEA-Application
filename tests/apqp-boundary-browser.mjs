import assert from 'node:assert/strict';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const port = Number(process.env.CDP_PORT || 9222);
const output = resolve(import.meta.dirname, '..', 'output', 'browser');
await mkdir(output, { recursive: true });
const pdfOutput = resolve(import.meta.dirname, '..', 'output', 'pdf');
await mkdir(pdfOutput, { recursive: true });

async function target() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json`).then(response => response.json());
      const page = targets.find(item => item.type === 'page' && item.url.includes('127.0.0.1:4173'));
      if (page?.webSocketDebuggerUrl) return page;
    } catch {}
    await new Promise(resolveWait => setTimeout(resolveWait, 200));
  }
  throw new Error('Yerel TYANA Q-FLOW tarayıcı hedefi bulunamadı.');
}

const page = await target();
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolveOpen, rejectOpen) => {
  socket.addEventListener('open', resolveOpen, { once: true });
  socket.addEventListener('error', rejectOpen, { once: true });
});

let messageId = 0;
const pending = new Map();
const diagnostics = [];
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') diagnostics.push(message.params?.exceptionDetails?.exception?.description || message.params?.exceptionDetails?.text);
  if (message.method === 'Runtime.consoleAPICalled' && message.params?.type === 'error') diagnostics.push((message.params.args || []).map(arg => arg.value || arg.description).join(' '));
  if (!message.id || !pending.has(message.id)) return;
  const operation = pending.get(message.id);
  pending.delete(message.id);
  message.error ? operation.reject(new Error(message.error.message)) : operation.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolveSend, rejectSend) => {
  const id = ++messageId;
  pending.set(id, { resolve: resolveSend, reject: rejectSend });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result?.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Console.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false });
await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: pdfOutput });
await send('Page.reload', { ignoreCache: true });

const result = await evaluate(`(async () => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (globalThis.TyanaApqp && typeof engineeringUniverse !== 'undefined' && typeof applyProductTemplate === 'function') break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  applyProductTemplate('blank');
  showView('product');
  partName.value = 'QA Boundary Mamul';
  partNumber.value = 'QA-OEM-BD';
  projectCode.value = 'QA-APQP-001';
  drawingRevision.value = 'B';
  syncFinishedGoodMasterIdentity();
  goToWizardStep(5);
  document.querySelectorAll('.wizard-pane').forEach(pane => pane.classList.toggle('active', pane.dataset.pane === '5'));
  TyanaApqp.reset();
  TyanaApqp.mapCharacteristics();
  TyanaApqp.seedAnalysisFromProduct();
  let state = TyanaApqp.snapshot();
  if (!state.boundary.internalElements.length) {
    const root = engineeringUniverse.itemMasters.find(item => item.id === engineeringUniverse.rootItemMasterId);
    document.getElementById('boundaryInternalMaster').value = root.id;
    document.getElementById('boundaryInternalFunction').value = 'Ana sistem fonksiyonunu taşır';
    document.querySelector('[data-apqp-action="add-boundary-internal"]').click();
  }
  document.getElementById('boundaryExternalName').value = 'Araç / komşu sistem';
  document.getElementById('boundaryExternalFunction').value = 'Yük, hareket ve montaj arayüzü';
  document.querySelector('[data-apqp-action="add-boundary-external"]').click();
  state = TyanaApqp.snapshot();
  document.getElementById('boundaryInterfaceFrom').value = state.boundary.internalElements[0].id;
  document.getElementById('boundaryInterfaceTo').value = state.boundary.externalElements[0].id;
  document.getElementById('boundaryInterfaceType').value = 'physical';
  document.getElementById('boundaryInterfaceDescription').value = 'Kuvvet ve konum aktarımı';
  document.querySelector('[data-apqp-action="add-boundary-interface"]').click();
  const boundarySnapshot = TyanaApqp.snapshot();
  document.querySelector('[data-apqp-analysis-tab="pDiagram"]').click();
  const functionField = document.querySelector('[data-analysis-meta="pDiagram.functionText"]');
  functionField.value = 'Direksiyon hareketini güvenli, doğru ve gecikmesiz iletmek';
  functionField.dispatchEvent(new Event('change', { bubbles: true }));
  for (const [field, value] of [
    ['inputSignals', 'Direksiyon hareketi / mekanik enerji'],
    ['controlFactors', 'Malzeme, geometri ve tolerans seçimi'],
    ['intendedOutputs', 'Doğru tekerlek yönlendirmesi'],
    ['errorStates', 'Kırılma, ayrılma veya aşırı boşluk'],
    ['functionalRequirements', 'Basma ve çekme kuvvetlerine dayanım'],
    ['constraints', 'Müşteri paket alanı ve ağırlık sınırı'],
    ['verificationMethods', 'Dayanım, fit & function ve ölçüsel doğrulama']
  ]) {
    document.querySelector('[data-p-input="' + field + '"]').value = value;
    document.querySelector('[data-p-add="' + field + '"]').click();
  }
  for (const [key, value] of [
    ['pieceVariation', 'Malzeme ve üretim değişkenliği'],
    ['timeVariation', 'Aşınma ve korozyon'],
    ['customerUsage', 'Sürüş tarzı ve aşırı yük'],
    ['environment', 'Yol, sıcaklık ve nem'],
    ['systemInteraction', 'Komşu sistem boşlukları']
  ]) {
    document.querySelector('[data-p-noise-input="' + key + '"]').value = value;
    document.querySelector('[data-p-noise-add="' + key + '"]').click();
  }
  const finalState = TyanaApqp.snapshot();
  const workspace = document.getElementById('apqpAnalysisWorkspace');
  const tabs = [...document.querySelectorAll('[data-apqp-analysis-tab]')].map(button => ({
    text: button.innerText,
    width: button.getBoundingClientRect().width
  }));
  document.getElementById('apqpAnalysisStudio').scrollIntoView({ block: 'start' });
  return {
    schema: finalState.schemaVersion,
    boundaryNodes: finalState.boundary.internalElements.length + finalState.boundary.externalElements.length,
    boundaryInterfaces: finalState.boundary.interfaces.length,
    boundaryRefLinked: finalState.rows.every(row => row.boundaryRef === finalState.boundary.documentNo),
    pRefLinked: finalState.rows.every(row => row.pDiagramRef === finalState.pDiagram.documentNo),
    noises: Object.values(finalState.pDiagram.noiseFactors).flat().length,
    readiness: TyanaApqp.readiness(),
    activePane: document.querySelector('[data-analysis-pane="pDiagram"]') !== null,
    workspaceOverflow: workspace.scrollWidth - workspace.clientWidth,
    productActive: document.getElementById('product').classList.contains('active'),
    qualityPaneActive: document.querySelector('.wizard-pane[data-pane="5"]').classList.contains('active'),
    studioDisplay: getComputedStyle(document.getElementById('apqpAnalysisStudio')).display,
    tabs
  };
})()`);

const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
const screenshotPath = resolve(output, 'apqp-boundary-pdiagram.png');
await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
await evaluate(`(() => {
  document.querySelector('[data-apqp-analysis-tab="boundary"]').click();
  document.getElementById('apqpAnalysisStudio').scrollIntoView({ block: 'start' });
  return true;
})()`);
const boundaryScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
const boundaryScreenshotPath = resolve(output, 'apqp-boundary-diagram.png');
await writeFile(boundaryScreenshotPath, Buffer.from(boundaryScreenshot.data, 'base64'));
const pdfPath = resolve(pdfOutput, 'QA-APQP-001_Boundary_P-Diyagram_Rev-B.pdf');
await rm(pdfPath, { force: true });
diagnostics.length = 0;
const pdfExportStarted = await evaluate(`(() => {
  try { Object.defineProperty(globalThis, 'showSaveFilePicker', { value: undefined, configurable: true }); } catch {}
  globalThis.__apqpPdfExport = TyanaApqp.exportAnalysisPdf();
  return true;
})()`);
let pdfBytes = 0;
for (let attempt = 0; attempt < 80; attempt += 1) {
  try {
    pdfBytes = (await stat(pdfPath)).size;
    if (pdfBytes > 10_000) break;
  } catch {}
  await new Promise(resolveWait => setTimeout(resolveWait, 100));
}
const pdfExportState = await evaluate(`Promise.race([
  globalThis.__apqpPdfExport.then(value => ({ state: 'resolved', value })).catch(error => ({ state: 'rejected', error: error?.message || String(error) })),
  new Promise(resolve => setTimeout(() => resolve({ state: 'pending' }), 1500))
])`);

console.log(JSON.stringify({ result: 'OBSERVED apqp-boundary-browser', ...result, pdfBytes, pdfExportStarted, pdfExportState, diagnostics, screenshotPath, boundaryScreenshotPath, pdfPath }));
assert.equal(result.schema, '2.0.0');
assert.ok(result.boundaryNodes >= 2);
assert.equal(result.boundaryInterfaces, 1);
assert.equal(result.boundaryRefLinked, true);
assert.equal(result.pRefLinked, true);
assert.equal(result.noises, 5);
assert.deepEqual(result.readiness, { boundary: 100, pDiagram: 100 });
assert.equal(result.activePane, true);
assert.ok(result.workspaceOverflow <= 2, `APQP çalışma alanı yatay taşıyor: ${result.workspaceOverflow}px`);
assert.ok(result.tabs.every(tab => tab.width >= 300));
assert.equal(pdfExportStarted, true);
assert.ok(pdfBytes > 10_000);
assert.deepEqual(diagnostics, []);

console.log(JSON.stringify({ result: 'PASS apqp-boundary-browser', ...result, pdfBytes, pdfExportStarted, screenshotPath, boundaryScreenshotPath, pdfPath }));
socket.close();
