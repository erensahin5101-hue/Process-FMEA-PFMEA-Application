import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve(import.meta.dirname, '..', 'output', 'browser');
const cdpPort = Number(process.env.CDP_PORT || 9222);
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
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result?.value;
};
const screenshot = async name => {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
  await writeFile(resolve(output, name), Buffer.from(data, 'base64'));
};

await send('Page.enable'); await send('Runtime.enable'); await send('Console.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
const navigation = await send('Page.navigate', { url: 'http://127.0.0.1:4173' });
for (let attempt = 0; attempt < 30; attempt += 1) { if (await evaluate("document.readyState === 'complete' && location.hostname === '127.0.0.1'")) break; await sleep(250); }
const pageState = await evaluate("({title:document.title,href:location.href,ready:document.readyState,body:document.body?.innerText?.slice(0,120)})");
if (pageState.title !== 'Q-Flow | Otomotiv Kalite Dokümantasyonu') console.error(JSON.stringify({ navigation, pageState, errors }));
assert.equal(pageState.title, 'Q-Flow | Otomotiv Kalite Dokümantasyonu');
assert.equal(await evaluate("Boolean(window.ExcelJS && window.pdfMake)"), true);
await screenshot('01-dashboard.png');

await evaluate("document.querySelector('[data-view=product]').click(); true"); await sleep(500); await screenshot('02-product-wizard.png');
await evaluate("goToWizardStep(4); true"); await sleep(500); await screenshot('03-characteristics.png');

await evaluate("document.querySelector('[data-view=flow]').click(); selected = [...productBackbones[productGroup.value].processes]; renderOptions(); renderSequence(); renderFlowDiagram(); true"); await sleep(500); await screenshot('04-process-flow.png');
assert.equal(await evaluate("document.querySelectorAll('#processSequence .sequence-item[draggable=true]').length"), 12);

await evaluate("document.querySelector('[data-view=control]').click(); renderControlPlan(); document.getElementById('controlEmpty').classList.add('hidden'); document.getElementById('controlResult').classList.remove('hidden'); true"); await sleep(700); await screenshot('05-control-plan.png');
assert.equal(await evaluate("document.querySelectorAll('#controlPlanBody tr').length"), 3);
assert.equal(await evaluate("document.getElementById('controlPlanHeader').children.length"), 12);

await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: output });
await evaluate("exportControlPlanXlsx()"); await sleep(2500);
await evaluate("exportControlPlanPdf()"); await sleep(2500);
await evaluate("exportControlPlanDxf()"); await sleep(1000);
await evaluate("(async()=>{const snapshot=await getDocumentationSnapshot(); pdfMake.createPdf(flowPdfDefinition(snapshot)).download('DT-2026-0042_Proses_Akisi_Rev-C.pdf')})()"); await sleep(2200);

await evaluate("buildInstructionModels(); renderInstructions(); document.querySelector('[data-view=instruction]').click(); document.getElementById('instructionEmpty').classList.add('hidden'); document.getElementById('instructionResult').classList.remove('hidden'); true"); await sleep(500); await screenshot('06-operator-instructions.png');
assert.equal(await evaluate("document.querySelectorAll('#instructionResult .instruction-card').length"), 12);
await evaluate("exportInstructionPdf(0)"); await sleep(2200);

assert.deepEqual(errors, []);
console.log(JSON.stringify({ title: true, exportEngines: true, draggableSteps: 12, controlRows: 3, instructionCards: 12, runtimeErrors: errors.length, output }));
socket.close();
