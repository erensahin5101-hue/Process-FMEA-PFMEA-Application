import assert from 'node:assert/strict';

const port = Number(process.env.CDP_PORT || 9222);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let target;
for (let attempt = 0; attempt < 50; attempt += 1) {
  try {
    const pages = await fetch(`http://127.0.0.1:${port}/json`).then(response => response.json());
    target = pages.find(page => page.type === 'page' && !page.url.startsWith('chrome-extension://'));
    if (target?.webSocketDebuggerUrl) break;
  } catch {}
  await sleep(200);
}
if (!target?.webSocketDebuggerUrl) throw new Error('Chrome DevTools endpoint unavailable');

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let id = 0;
const pending = new Map();
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const request = pending.get(message.id); pending.delete(message.id);
  message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const messageId = ++id; pending.set(messageId, { resolve, reject }); socket.send(JSON.stringify({ id: messageId, method, params })); });
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
};

await send('Runtime.enable');
for (let attempt = 0; attempt < 80; attempt += 1) {
  if (await evaluate("Boolean(globalThis.TyanaProductDefinition && operationCodeLibrary?.operations?.length===380 && processes?.length>=34)")) break;
  await sleep(100);
}

const result = await evaluate(`(async()=>{
  localStorage.removeItem('tyana-qflow-machine-library-v1');
  await TyanaProductDefinition.loadMachineLibrary(true);
  setLibraryMode('machine');
  TyanaProductDefinition.renderMachineLibrary();
  const machineRows = document.querySelectorAll('#machineLibraryRows .machine-register-row').length;
  applyProductTemplate('blank');
  productGroup.value='steering'; syncProductTypes();
  productStructureType.value='single_part'; syncProductLevelContext();
  internalProductCode.value='QA-FG-001'; partNumber.value='QA-OEM-001'; partName.value='QA Ana Mamul';
  syncFinishedGoodMasterIdentity(); goToWizardStep(3); TyanaProductDefinition.renderWorkPlanStudio();
  const host=document.getElementById('workPlanRoutingHost');
  host.querySelector('[data-item-route-operation]').value='100';
  host.querySelector('[data-item-route-add]').click();
  await new Promise(resolve=>setTimeout(resolve,50));
  const root=engineeringUniverse.itemMasters.find(item=>item.id===engineeringUniverse.rootItemMasterId);
  host.querySelector('[data-route-machine]').click();
  await new Promise(resolve=>setTimeout(resolve,50));
  const machineChoiceCount=document.querySelectorAll('#routeMachineChoices input[type=checkbox]').length;
  const t11=document.querySelector('#routeMachineChoices input[value=T11]'); if(t11) t11.checked=true;
  document.getElementById('routeMachineConfirm').click();
  await new Promise(resolve=>setTimeout(resolve,100));
  const itemRoute=selectedProcessEntries().find(entry=>entry.detail.itemMasterRouting);
  return {
    machineRows,
    machineChoiceCount,
    routeSteps:root.routingSteps.length,
    selectedMachine:root.routingSteps[0]?.selectedMachines?.[0]||'',
    aggregateRoute:Boolean(itemRoute&&itemRoute.detail.itemMasterId===root.id&&itemRoute.detail.operationCode==='100'),
    groupedLibrary:document.querySelectorAll('.item-master-type-group').length,
    dragLibrary:Boolean(document.getElementById('bomDragMasterLibrary')),
    workPlanStudio:Boolean(document.getElementById('workPlanStudio')),
    machinePanelVisible:!document.getElementById('machineLibraryCatalog').classList.contains('hidden')
  };
})()`);

assert.equal(result.machineRows, 77);
assert.equal(result.machineChoiceCount, 77);
assert.equal(result.routeSteps, 1);
assert.equal(result.selectedMachine, 'T11');
assert.equal(result.aggregateRoute, true);
assert.ok(result.groupedLibrary >= 1);
assert.equal(result.dragLibrary, true);
assert.equal(result.workPlanStudio, true);
assert.equal(result.machinePanelVisible, true);
socket.close();
console.log(JSON.stringify({ result: 'PASS product-definition-runtime-smoke', ...result }));
