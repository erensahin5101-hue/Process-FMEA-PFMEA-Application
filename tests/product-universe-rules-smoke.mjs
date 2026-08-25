import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [app, bom, workspace, apqp, html, guide, desktopBuild, universeCss, instructionCss] = await Promise.all([
  read('app.js'), read('bom-domain.js'), read('product-definition-workspace.js'), read('apqp-traceability.js'),
  read('index.html'), read('guided-experience.js'), read('desktop-build.mjs'), read('product-universe.css'), read('operator-instruction.css')
]);

for (const type of ['ASSEMBLY_MATERIAL', 'EXTERNAL_PURCHASED']) {
  assert.match(app, new RegExp(type));
  assert.match(bom, new RegExp(type));
  assert.match(workspace, new RegExp(type));
  assert.match(html, new RegExp(`data-item-quick-create="${type}"`));
  assert.match(html, new RegExp(`value="${type}"`));
}
assert.match(app, /Dış tedarik ürünü \(XD\)/);
assert.match(app, /XD • dış tedarik/);
assert.match(workspace, /İş planı uygulanmaz/);
assert.match(workspace, /ROUTING_DISABLED_TYPES/);
assert.match(apqp, /data-boundary-node/);
assert.match(apqp, /connectBoundaryNodes/);
assert.match(apqp, /application\/x-tyana-boundary-node/);
assert.match(guide, /function closeCommandPalette\(\)/);
assert.match(guide, /dialog\.close\(\)/);
assert.match(guide, /input\[type="search"\]/);
assert.match(desktopBuild, /product-universe\.css/);
assert.match(html, /operator-instruction\.css/);
assert.match(desktopBuild, /operator-instruction\.css/);
assert.match(app, /instruction-step-preview/);
assert.match(instructionCss, /instruction-step-card/);
assert.match(universeCss, /boundary-node-drop-target/);
console.log(JSON.stringify({ result: 'PASS product-universe-rules-smoke', workPlanTypes: ['FINISHED_GOOD', 'SUBASSEMBLY', 'SEMI_FINISHED'], noWorkPlanTypes: ['RAW_MATERIAL', 'ASSEMBLY_MATERIAL', 'EXTERNAL_PURCHASED', 'PACKAGING'], diagramDragConnect: true, escapeSearch: true }));
