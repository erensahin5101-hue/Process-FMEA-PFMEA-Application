import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { resolve } from 'node:path';

const adapterSource = await readFile(resolve(import.meta.dirname, '..', 'platform-adapter.js'), 'utf8');

function loadAdapter(invoke) {
  const context = vm.createContext({
    __TAURI__: { core: { invoke } },
    Blob,
    ArrayBuffer,
    Uint8Array,
    TextEncoder,
    TextDecoder,
    URL,
    navigator: {},
    document: {
      createElement: () => { throw new Error('Desktop adapter unexpectedly used browser download.'); },
      body: { appendChild: () => { throw new Error('Desktop adapter unexpectedly used browser download.'); } }
    },
    setTimeout
  });
  vm.runInContext(adapterSource, context, { filename: 'platform-adapter.js' });
  return context.TyanaPlatform;
}

const calls = [];
const adapter = loadAdapter(async (command, payload, options) => {
  calls.push({ command, payload, options });
  if (command === 'prepare_export') return 'a'.repeat(32);
  if (command === 'write_export') {
    return {
      fileName: 'Cikti.pdf',
      exportType: 'pdf',
      bytesWritten: payload.byteLength
    };
  }
  throw new Error(`Unexpected command: ${command}`);
});

// The supported global API is sufficient. Deliberately do not define the
// internal Tauri object: this is the regression that previously routed desktop
// exports into an unusable WebView download.
assert.equal(adapter.isDesktop, true);
const pdf = new Uint8Array(new TextEncoder().encode('%PDF-1.7\n1 0 obj\n%%EOF\n'));
const result = await adapter.saveArtifact({ data: pdf, fileName: 'Çıktı.pdf' });
assert.deepEqual({ cancelled: result.cancelled, mode: result.mode, fileName: result.fileName, type: result.exportType }, {
  cancelled: false,
  mode: 'tauri',
  fileName: 'Cikti.pdf',
  type: 'pdf'
});
assert.equal(calls.length, 2);
assert.equal(calls[0].command, 'prepare_export');
assert.equal(calls[0].payload.suggestedName, 'Cikti.pdf');
assert.equal(calls[0].payload.exportType, 'pdf');
assert.equal(calls[0].options, undefined);
assert.equal(calls[1].command, 'write_export');
assert.ok(calls[1].payload instanceof Uint8Array);
assert.equal(calls[1].payload.byteLength, pdf.byteLength);
assert.equal(calls[1].options.headers['x-tyana-export-ticket'], 'a'.repeat(32));

const cancelledAdapter = loadAdapter(async command => {
  assert.equal(command, 'prepare_export');
  return null;
});
assert.equal((await cancelledAdapter.saveArtifact({ data: pdf, fileName: 'CP.pdf' })).cancelled, true);

let invalidInvocations = 0;
const validationAdapter = loadAdapter(async () => { invalidInvocations += 1; });
await assert.rejects(
  validationAdapter.saveArtifact({ data: new TextEncoder().encode('not a pdf'), fileName: 'bad.pdf' }),
  /içeriği seçilen dosya türüyle uyuşmuyor/
);
assert.equal(invalidInvocations, 0);

console.log(JSON.stringify({ desktopDetectedWithoutInternals: true, rawIpcBytes: pdf.byteLength, cancellation: 'ok', signatureGate: 'ok' }));
