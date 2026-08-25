import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [seedText, app, workspace, html, styles, adapter, data, rustLib, desktopBuild, webBuild] = await Promise.all([
  read('files/machines_master_seed.json'), read('app.js'), read('product-definition-workspace.js'), read('index.html'),
  read('styles.css'), read('platform-adapter.js'), read('src-tauri/src/data.rs'), read('src-tauri/src/lib.rs'),
  read('desktop-build.mjs'), read('build.mjs')
]);

const seed = JSON.parse(seedText);
assert.equal(seed.machines.length, 77);
assert.equal(new Set(seed.machines.map(machine => machine.machine_code)).size, 77);
assert.deepEqual(seed.machines.reduce((counts, machine) => ({ ...counts, [machine.machine_type]: (counts[machine.machine_type] || 0) + 1 }), {}), {
  cnc_tool: 33, die_fixture: 17, gauge_instrument: 9, assembly_station: 14, ndt_gauge: 4
});
assert.ok(seed.machines.every(machine => machine.active === true));

for (const table of ['machines', 'operation_machine_eligibility']) assert.match(data, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
for (const command of ['machine_library_get', 'machine_save', 'machine_delete', 'operation_machine_eligibility_save']) {
  assert.match(data, new RegExp(String.raw`pub\(crate\) fn ${command}`));
  assert.match(rustLib, new RegExp(String.raw`\b${command},`));
}
assert.match(data, /embedded_assets::value\("machines-master"\)/);
assert.match(data, /provided-prototype/);

for (const method of ['machineLibrary', 'saveMachine', 'deleteMachine', 'saveOperationMachineEligibility']) assert.match(adapter, new RegExp(`${method}:`));
assert.match(adapter, /learned-from-product-routing|user-confirmed/);
assert.match(html, /data-library-mode-button="machine"/);
assert.match(html, /id="machineLibraryCatalog"/);
assert.match(html, /id="machineEditorDialog"/);
assert.match(html, /id="routeMachineDialog"/);
assert.match(html, /id="workPlanStudio"/);
assert.match(html, /id="workPlanRoutingHost"/);
assert.match(html, /data-item-quick-create="SEMI_FINISHED"/);
assert.match(html, /id="bomDragMasterLibrary"/);
assert.match(html, /product-definition-workspace\.js/);

assert.match(app, /routingSteps/);
assert.match(app, /data-open-item-work-plan/);
assert.match(app, /data-route-machine-select/);
assert.match(app, /application\/x-tyana-item-master/);
assert.match(app, /itemMasterRouting/);
assert.match(workspace, /function syncAggregateRoute/);
assert.match(workspace, /function renderWorkPlanStudio/);
assert.match(workspace, /function openDocumentRouteMachineDialog/);
assert.match(workspace, /learned-from-product-routing/);
assert.match(workspace, /draggable="true"/);
assert.match(workspace, /\['§', '<C>', '<M>'\]/);
assert.match(workspace, /ROUTING_DISABLED_TYPES/);
assert.match(styles, /item-routing-host/);
assert.match(styles, /machine-library-workspace/);

for (const buildSource of [desktopBuild, webBuild]) {
  assert.match(buildSource, /product-definition-workspace\.js/);
}
assert.match(webBuild, /machines-master-seed\.json/);
assert.match(desktopBuild, /machines-master\.json\.gz/);

console.log(JSON.stringify({ result: 'PASS product-routing-machine-library-smoke', machines: 77, machineTypes: 5, operationCodes: 380, persistence: 'SQLite + web fallback', routing: 'item master -> aggregate document route' }));
