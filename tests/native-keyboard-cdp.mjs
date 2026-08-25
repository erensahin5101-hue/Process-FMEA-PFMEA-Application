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
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const operation = pending.get(message.id); pending.delete(message.id);
  message.error ? operation.reject(new Error(message.error.message)) : operation.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const messageId = ++id; pending.set(messageId, { resolve, reject });
  socket.send(JSON.stringify({ id: messageId, method, params }));
});
const evaluate = async expression => {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result?.value;
};
const pressEscape = async () => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await sleep(80);
};

await send('Runtime.enable');
await evaluate(`(async () => { for (let i = 0; i < 80; i += 1) { if (globalThis.TyanaGuide) break; await new Promise(resolve => setTimeout(resolve, 100)); } TyanaGuide.openCommandPalette('PFMEA'); })()`);
const closeButtonPresent = await evaluate(`Boolean(document.querySelector('[data-close-command-palette]'))`);
await evaluate(`document.querySelector('[data-close-command-palette]')?.click()`);
await sleep(80);
const closeButtonClosed = await evaluate(`!document.getElementById('qflowCommandPalette')?.open`);
await evaluate(`TyanaGuide.openCommandPalette('PFMEA')`);
await pressEscape();
const commandClosed = await evaluate(`!document.getElementById('qflowCommandPalette')?.open`);
const searchResult = await evaluate(`(() => { const input = document.querySelector('.topbar .search input'); input.value = 'PFMEA'; input.dispatchEvent(new Event('input', { bubbles: true })); return { before: input.value, paletteOpen: Boolean(document.getElementById('qflowCommandPalette')?.open) }; })()`);
await pressEscape();
const searchCleared = await evaluate(`document.querySelector('.topbar .search input')?.value === ''`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17, nativeVirtualKeyCode: 17, modifiers: 2 });
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'k', code: 'KeyK', windowsVirtualKeyCode: 75, nativeVirtualKeyCode: 75, modifiers: 2 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'k', code: 'KeyK', windowsVirtualKeyCode: 75, nativeVirtualKeyCode: 75, modifiers: 2 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17, nativeVirtualKeyCode: 17 });
await sleep(80);
const ctrlKOpened = await evaluate(`Boolean(document.getElementById('qflowCommandPalette')?.open)`);
await pressEscape();
assert.equal(commandClosed, true, 'Gerçek Escape komutu palette kapatmalı.');
assert.equal(closeButtonPresent, true, 'Komut paletinde görünür kapatma düğmesi olmalı.');
assert.equal(closeButtonClosed, true, 'Görünür kapatma düğmesi paleti kapatmalı.');
assert.equal(searchCleared, true, 'Gerçek Escape üst aramayı temizlemeli.');
assert.equal(ctrlKOpened, true, 'Gerçek Ctrl+K komut paletini açmalı.');
socket.close();
console.log(JSON.stringify({ result: 'PASS native-keyboard-cdp', commandClosed, searchCleared, ctrlKOpened, searchResult }));
