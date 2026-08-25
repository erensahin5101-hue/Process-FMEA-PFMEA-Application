import assert from 'node:assert/strict';

const port = Number(process.env.CDP_PORT || 9223);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let target;
for (let attempt = 0; attempt < 80; attempt += 1) {
  try {
    const pages = await fetch(`http://127.0.0.1:${port}/json`).then(response => response.json());
    target = pages.find(page => page.type === 'page' && page.url.startsWith('http://tauri.localhost'));
    if (target?.webSocketDebuggerUrl) break;
  } catch {}
  await sleep(200);
}
if (!target?.webSocketDebuggerUrl) throw new Error('Kurulu WebView2 CDP hedefi bulunamadı.');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let id = 0;
const pending = new Map();
const diagnostics = [];
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') diagnostics.push(message.params?.exceptionDetails?.exception?.description || message.params?.exceptionDetails?.text || 'exception');
  if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params?.type)) diagnostics.push((message.params.args || []).map(arg => arg.value || arg.description).join(' '));
  if (!message.id || !pending.has(message.id)) return;
  const operation = pending.get(message.id); pending.delete(message.id);
  message.error ? operation.reject(new Error(message.error.message)) : operation.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const messageId = ++id; pending.set(messageId, { resolve, reject }); socket.send(JSON.stringify({ id: messageId, method, params })); });
const evaluate = async expression => {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result?.value;
};

await send('Runtime.enable');
const result = await evaluate(`(async () => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (globalThis.TyanaFmea && globalThis.TyanaGuide && globalThis.TyanaProductDefinition && qualityDocumentLibrary?.instructionPresets?.length) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  TyanaFmea.reset();
  showView('dfmea');
  await new Promise(resolve => setTimeout(resolve, 80));
  const row = TyanaFmea.snapshot().dfmeaRows[0];
  const setNumber = (field, value) => {
    const input = document.querySelector('[data-dfmea-row="' + row.id + '"] [data-dfmea-field="' + field + '"]');
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  setNumber('severity', 8); setNumber('occurrence', 3); setNumber('detection', 1);
  const dfmeaScore = document.querySelector('[data-dfmea-row="' + row.id + '"] [data-dfmea-rpn] b')?.textContent;
  showView('pfmea');
  await new Promise(resolve => setTimeout(resolve, 80));
  if (!document.querySelector('.pfmea-risk-card[data-pfmea-index]')) {
    document.querySelector('[data-action="add-pfmea-manual"]')?.click();
    await new Promise(resolve => setTimeout(resolve, 80));
  }
  const setPfmeaNumber = (field, value) => {
    const select = document.querySelector('.pfmea-risk-card[data-pfmea-index] [data-pfmea-field="' + field + '"]');
    if (!select) return;
    select.value = String(value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };
  setPfmeaNumber('severity', 8); setPfmeaNumber('occurrence', 3); setPfmeaNumber('detection', 1);
  const pfmeaScore = document.querySelector('.pfmea-risk-card[data-pfmea-index] .pfmea-rpn-card b')?.textContent;
  TyanaGuide.openCommandPalette('PFMEA');
  await new Promise(resolve => setTimeout(resolve, 30));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  const commandClosed = !document.getElementById('qflowCommandPalette')?.open;
  const topSearch = document.querySelector('.topbar .search input');
  topSearch.value = 'PFMEA';
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  const searchCleared = topSearch.value === '';
  applySourceTemplate('cp.807', { stayOnProduct: true });
  buildInstructionModels(); renderInstructions(); showView('instruction');
  const visualCard = document.querySelector('#instructionResult .professional-instruction');
  return {
    dfmeaScore,
    pfmeaScore,
    commandClosed,
    searchCleared,
    instructionCards: document.querySelectorAll('#instructionResult .professional-instruction').length,
    visualSteps: visualCard?.querySelectorAll('.instruction-step-card').length || 0,
    parameterRibbon: Boolean(visualCard?.querySelector('.instruction-parameter-ribbon')),
    reactionCallout: Boolean(visualCard?.querySelector('.instruction-reaction-callout'))
  };
})()`);

assert.equal(result.dfmeaScore, '24', 'DFMEA S×O×D ekran değeri 8×3×1=24 olmalı.');
assert.equal(result.pfmeaScore, '24', 'PFMEA S×O×D ekran değeri 8×3×1=24 olmalı.');
assert.equal(result.commandClosed, true, 'Escape komut paletini kapatmalı.');
assert.equal(result.searchCleared, true, 'Escape üst aramayı temizlemeli.');
assert.ok(result.instructionCards > 0, 'Operatör talimat kartı oluşmalı.');
assert.ok(result.visualSteps > 0, 'Operatör talimatında görsel iş adımları görünmeli.');
assert.equal(result.parameterRibbon, true, 'Sayısal şart şeridi görünmeli.');
assert.equal(result.reactionCallout, true, 'Reaksiyon planı görünmeli.');
assert.deepEqual(diagnostics, []);
socket.close();
console.log(JSON.stringify({ result: 'PASS native-visual-ux-cdp', ...result, diagnostics }));
