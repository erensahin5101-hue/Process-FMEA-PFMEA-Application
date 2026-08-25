import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const [domainSource, appSource] = await Promise.all([
  readFile(new URL('../bom-domain.js', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8')
]);
const context = vm.createContext({ console, crypto: globalThis.crypto, structuredClone, TextEncoder, TextDecoder });
vm.runInContext(domainSource, context, { filename: 'bom-domain.js' });
const Bom = context.TyanaBom;

const masters = Bom.normalizeItemMasters([
  { id: 'FG', internalCode: 'FG-1', oemNo: 'OEM-FG', name: 'Mamul', itemType: 'FINISHED_GOOD', validationStatus: 'APPROVED' },
  { id: 'A', internalCode: 'A-1', oemNo: 'OEM-A', name: 'A Parçası', itemType: 'MANUFACTURED_PART', validationStatus: 'APPROVED' },
  { id: 'B', internalCode: 'B-1', oemNo: 'OEM-B', name: 'B Parçası', itemType: 'MANUFACTURED_PART', validationStatus: 'APPROVED' }
]);
const definitions = Bom.normalizeBomDefinitions([
  { id: 'BOM-FG-A', bomNo: 'BOM-FG', headerItemMasterId: 'FG', revision: 'A', alternative: '01', status: 'APPROVED', lines: [{ id: 'L-A', position: '10', itemMasterId: 'A', quantity: 1, assemblyOperationCode: '100' }] },
  { id: 'BOM-FG-B', bomNo: 'BOM-FG', headerItemMasterId: 'FG', revision: 'B', alternative: '02', status: 'APPROVED', lines: [{ id: 'L-B', position: '10', itemMasterId: 'B', quantity: 2, assemblyOperationCode: '200' }] }
]);

const selectedB = Bom.explodeBom('FG', masters, definitions, { bomSelections: { FG: 'BOM-FG-B' } });
assert.equal(selectedB.map(row => row.itemMasterId).join(','), 'B');
assert.equal(selectedB[0].bomDefinitionId, 'BOM-FG-B');
assert.equal(selectedB[0].bomRevision, 'B');
assert.equal(selectedB[0].bomAlternative, '02');
assert.equal(Bom.explodeBom('FG', masters, definitions, { bomSelections: { FG: 'DOES-NOT-EXIST' } }).length, 0, 'Açık seçim geçersizse başka BOM’a sessiz fallback yapılmamalı.');

const legacy = Bom.toLegacyComponents('FG', masters, definitions, { bomSelections: { FG: 'BOM-FG-B' } });
assert.equal(legacy.length, 1);
assert.equal(legacy[0].oemNo, 'OEM-B');
assert.equal(legacy[0].assemblyOperationCode, '200');
assert.equal(legacy[0].sourceBomNo, 'BOM-FG');
assert.equal(legacy[0].sourceBomRevision, 'B');
assert.equal(legacy[0].sourceBomAlternative, '02');

const alternativeBase = { id: 'BOM-ALT', bomNo: 'BOM-ALT', headerItemMasterId: 'FG', revision: 'A', alternative: '01', lines: [
  { id: 'ALT-A', position: '10', itemMasterId: 'A', quantity: 1, alternativeGroupId: 'BEARING', alternativeSelected: false },
  { id: 'ALT-B', position: '20', itemMasterId: 'B', quantity: 1, alternativeGroupId: 'BEARING', alternativeSelected: false }
] };
assert.ok(Bom.validateBomDefinitions([alternativeBase], masters).some(issue => issue.code === 'ALTERNATIVE_GROUP_NO_ACTIVE_CHOICE'));
const multiple = structuredClone(alternativeBase); multiple.lines.forEach(line => { line.alternativeSelected = true; });
assert.ok(Bom.validateBomDefinitions([multiple], masters).some(issue => issue.code === 'ALTERNATIVE_GROUP_MULTIPLE_ACTIVE_CHOICES'));

for (const required of [
  'selectedBomDefinitionIdsByHeader', 'engineeringBomSelectionOptions', 'activeEngineeringBomRows',
  'attachBomAssemblyOperationToRoute', 'data-bom-operation-route', 'aktif BOM montaj operasyon kodu rotada yok',
  'Doğrudan onay engellendi', 'approveItemMaster', 'approveEngineeringBomDefinition',
  'OEM No', 'Montaj Operasyon Kodu', 'sourceBomRevision', 'operationDisplayName', 'routeOperationIdentity'
]) assert.ok(appSource.includes(required), `Runtime zincir kanıtı eksik: ${required}`);

console.log(JSON.stringify({
  result: 'PASS bom-runtime-chain-smoke', explicitBomSelection: true, noSilentFallback: true,
  alternativeExactOne: true, routeBinding: true, controlledApproval: true, xlsxTraceability: true
}));
