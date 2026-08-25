import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const port = Number(process.env.CDP_PORT || 9222);
const output = resolve(import.meta.dirname, '..', 'output', 'browser');
await mkdir(output, { recursive: true });
const sleep = milliseconds => new Promise(resolveWait => setTimeout(resolveWait, milliseconds));

let target;
for (let attempt = 0; attempt < 60; attempt += 1) {
  try {
    const pages = await fetch(`http://127.0.0.1:${port}/json`).then(response => response.json());
    target = pages.find(page => page.type === 'page' && page.url.includes('127.0.0.1:4173')) || pages.find(page => page.type === 'page');
    if (target?.webSocketDebuggerUrl) break;
  } catch {}
  await sleep(200);
}
if (!target?.webSocketDebuggerUrl) throw new Error('Guided experience browser target unavailable');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolveOpen, rejectOpen) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', rejectOpen, { once: true }); });
let id = 0;
const pending = new Map();
const diagnostics = [];
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') diagnostics.push(message.params?.exceptionDetails?.exception?.description || message.params?.exceptionDetails?.text);
  if (message.method === 'Runtime.consoleAPICalled' && message.params?.type === 'error') diagnostics.push((message.params.args || []).map(arg => arg.value || arg.description).join(' '));
  if (!message.id || !pending.has(message.id)) return;
  const request = pending.get(message.id); pending.delete(message.id);
  message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolveSend, rejectSend) => { const messageId = ++id; pending.set(messageId, { resolve: resolveSend, reject: rejectSend }); socket.send(JSON.stringify({ id: messageId, method, params })); });
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Console.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://127.0.0.1:4173/?guided-qa=1' });
for (let attempt = 0; attempt < 100; attempt += 1) {
  if (await evaluate("document.readyState === 'complete' && Boolean(globalThis.TyanaGuide?.stages)") ) break;
  await sleep(100);
}

const initial = await evaluate(`(() => {
  applyProductTemplate('blank');
  showView('dashboard');
  TyanaGuide.render();
  TyanaGuide.open();
  const stages = TyanaGuide.stages();
  const drawer = document.getElementById('qflowGuideDrawer');
  const workspace = document.querySelector('.workspace');
  return {
    stageCount: stages.length,
    firstStage: stages[0].id,
    nextStage: document.querySelector('[data-guide-action="next"]').dataset.guideStage,
    drawerOpen: drawer.classList.contains('open') && drawer.getAttribute('aria-hidden') === 'false',
    stageButtons: document.querySelectorAll('#qflowJourneyStages [data-guide-stage]').length,
    journeyBar: Boolean(document.getElementById('qflowJourneyBar')),
    commandPalette: Boolean(document.getElementById('qflowCommandPalette')),
    overflow: Math.max(0, workspace.scrollWidth - workspace.clientWidth)
  };
})()`);
assert.equal(initial.stageCount, 13);
assert.equal(initial.firstStage, 'identity');
assert.equal(initial.nextStage, 'identity');
assert.equal(initial.drawerOpen, true);
assert.equal(initial.stageButtons, 13);
assert.equal(initial.journeyBar, true);
assert.equal(initial.commandPalette, true);
assert.equal(initial.overflow, 0);

const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
await writeFile(resolve(output, 'guided-experience-drawer.png'), Buffer.from(screenshot.data, 'base64'));

const navigation = await evaluate(`(async () => {
  TyanaGuide.navigate('bom');
  await new Promise(resolveWait => setTimeout(resolveWait, 350));
  const bom = {
    activeModule: document.getElementById('product').dataset.productModule,
    activePane: document.querySelector('#product .wizard-pane.active')?.dataset.pane,
    focused: Boolean(document.querySelector('.qflow-guided-focus'))
  };
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  await new Promise(resolveWait => setTimeout(resolveWait, 80));
  const dialog = document.getElementById('qflowCommandPalette');
  const commandOpen = dialog.open;
  const input = document.getElementById('qflowCommandInput');
  input.value = 'PFMEA';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const resultCount = document.querySelectorAll('#qflowCommandResults [data-command-id]').length;
  document.querySelector('#qflowCommandResults [data-command-id="view-pfmea"]')?.click();
  await new Promise(resolveWait => setTimeout(resolveWait, 100));
  return { ...bom, commandOpen, resultCount, activeView: document.querySelector('.view.active')?.id };
})()`);
assert.equal(navigation.activeModule, 'bom');
assert.equal(navigation.activePane, '2');
assert.equal(navigation.focused, true);
assert.equal(navigation.commandOpen, true);
assert.ok(navigation.resultCount >= 1);
assert.equal(navigation.activeView, 'pfmea');

await evaluate("document.getElementById('qflowCommandPalette')?.close(); TyanaGuide.close(); showView('dashboard'); true");
await send('Emulation.setDeviceMetricsOverride', { width: 980, height: 800, deviceScaleFactor: 1, mobile: false });
await sleep(120);
const responsive = await evaluate(`(() => {
  const bar = document.getElementById('qflowJourneyBar').getBoundingClientRect();
  return {
    viewport: document.documentElement.clientWidth,
    overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    barLeft: Math.round(bar.left),
    barRight: Math.round(bar.right),
    mapHidden: getComputedStyle(document.querySelector('.journey-map-button')).display === 'none'
  };
})()`);
assert.equal(responsive.overflow, 0);
assert.ok(responsive.barLeft >= 0 && responsive.barRight <= responsive.viewport);
assert.equal(responsive.mapHidden, true);
const barScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
await writeFile(resolve(output, 'guided-experience-next-action.png'), Buffer.from(barScreenshot.data, 'base64'));

assert.deepEqual(diagnostics, []);
socket.close();
console.log(JSON.stringify({ result: 'PASS guided-experience-browser', initial, navigation, responsive, diagnostics }));
