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
if (!target?.webSocketDebuggerUrl) throw new Error('Kurulu uygulamanın CDP hedefi bulunamadı.');
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let id = 0; const pending = new Map(); const diagnostics = [];
socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.method === 'Runtime.exceptionThrown') diagnostics.push(message.params?.exceptionDetails?.exception?.description || message.params?.exceptionDetails?.text || 'exception'); if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params?.type)) diagnostics.push((message.params.args || []).map(arg => arg.value || arg.description).join(' ')); if (!message.id || !pending.has(message.id)) return; const item = pending.get(message.id); pending.delete(message.id); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result); });
const send = (method, params = {}) => new Promise((resolve, reject) => { const messageId = ++id; pending.set(messageId, { resolve, reject }); socket.send(JSON.stringify({ id: messageId, method, params })); });
const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result?.value; };
await send('Runtime.enable'); await send('Page.enable');
const result = await evaluate(`(async () => {
  for (let attempt = 0; attempt < 100; attempt += 1) { if (globalThis.TyanaPlatform?.licenseStatus && globalThis.TyanaGuide && document.getElementById('admin')) break; await new Promise(resolve => setTimeout(resolve, 100)); }
  showView('admin'); await new Promise(resolve => setTimeout(resolve, 120));
  const initial = { active: document.querySelector('.view.active')?.id, actions: document.querySelectorAll('[data-admin-action]').length, form: Boolean(document.getElementById('adminLicenseForm')), state: document.getElementById('adminLicenseState')?.textContent, stageIssues: TyanaGuide.stages().map(stage => ({ id: stage.id, issues: Array.isArray(stage.issues), count: stage.issues?.length })) };
  document.getElementById('adminLicenseKey').value = 'TYANA-QFLOW-PERM-2026-EREN-ADMIN';
  document.getElementById('adminLicenseForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(resolve => setTimeout(resolve, 600));
  const license = await TyanaPlatform.licenseStatus();
  document.querySelector('[data-admin-action="open-users"]').click(); await new Promise(resolve => setTimeout(resolve, 80)); const users = document.querySelector('.view.active')?.id;
  showView('admin'); document.querySelector('[data-admin-action="open-library"]').click(); await new Promise(resolve => setTimeout(resolve, 80)); const library = document.querySelector('.view.active')?.id;
  showView('admin'); document.querySelector('[data-admin-action="open-guide"]').click(); await new Promise(resolve => setTimeout(resolve, 80)); const guideOpen = document.getElementById('qflowGuideDrawer')?.classList.contains('open'); TyanaGuide.close();
  return { initial, license: { active: license.active, state: license.state, fullFeatured: license.fullFeatured, days: license.daysRemaining }, users, library, guideOpen };
})()`);
assert.equal(result.initial.active, 'admin'); assert.ok(result.initial.actions >= 6); assert.equal(result.initial.form, true); assert.equal(result.license.active, true); assert.equal(result.license.state, 'permanent'); assert.equal(result.license.fullFeatured, true); assert.equal(result.license.days, -1); assert.equal(result.users, 'users'); assert.equal(result.library, 'library'); assert.equal(result.guideOpen, true); assert.deepEqual(diagnostics, []);
socket.close(); console.log(JSON.stringify({ result: 'PASS admin-desktop-cdp', ...result, diagnostics }));
