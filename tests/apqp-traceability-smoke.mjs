import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [html, app, apqp, styles, desktopBuild, webBuild] = await Promise.all([
  read('index.html'),
  read('app.js'),
  read('apqp-traceability.js'),
  read('styles.css'),
  read('desktop-build.mjs'),
  read('build.mjs')
]);

for (const id of [
  'apqpTraceabilityStudio',
  'apqpEvidenceChain',
  'apqpAnalysisStudio',
  'apqpAnalysisWorkspace',
  'apqpBoundaryReadiness',
  'apqpPDiagramReadiness',
  'apqpFmeaProfile',
  'apqpPriorityMethod',
  'apqpTraceabilityRows',
  'apqpCoverageValue',
  'apqpCoverageBar'
]) assert.match(html, new RegExp(`id="${id}"`), `${id} arayüz öğesi bulunmalı.`);

for (const label of ['Foundation FMEA', 'Family FMEA', 'Ürüne özel FMEA', 'AIAG-VDA AP', 'Miras RPN + AP']) {
  assert.match(html, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

assert.match(html, /data-apqp-action="map-characteristics"/);
assert.match(html, /data-apqp-action="add-row"/);
assert.match(html, /data-apqp-action="seed-analysis"/);
assert.match(html, /data-apqp-action="export-analysis-pdf"/);
assert.match(html, /data-apqp-analysis-tab="boundary"/);
assert.match(html, /data-apqp-analysis-tab="pDiagram"/);
assert.match(html, /src="\/apqp-traceability\.js"/);
assert.match(app, /apqpTraceability:\s*globalThis\.TyanaApqp/);
assert.match(app, /TyanaApqp\?\.hydrate/);
assert.match(app, /TyanaApqp\?\.reset/);

for (const marker of [
  'QFD-1/2',
  'BOUNDARY',
  'P-DİYAGRAMI',
  'DFMEA',
  'DVP&R',
  'PROSES AKIŞI',
  'PFMEA',
  'KONTROL PLANI',
  'İŞ TALİMATI',
  'function mapCharacteristics',
  'function boundaryReadiness',
  'function pDiagramReadiness',
  'function seedAnalysisFromProduct',
  'function analysisPdfDefinition',
  "schemaVersion: '2.0.0'",
  'pieceVariation',
  'timeVariation',
  'customerUsage',
  'environment',
  'systemInteraction',
  'Fiziksel bağlantı',
  'Enerji transferi',
  'DVP&R doğrulama yöntemleri',
  'application/x-tyana-apqp-row',
  'global.TyanaApqp'
]) assert.match(apqp, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

assert.match(styles, /\.apqp-traceability-studio/);
assert.match(styles, /\.apqp-evidence-chain/);
assert.match(styles, /\.apqp-phase-grid/);
assert.match(styles, /\.apqp-analysis-studio/);
assert.match(styles, /\.boundary-canvas/);
assert.match(styles, /\.p-diagram-flow/);
assert.match(styles, /\.p-noise-card/);
assert.match(styles, /\.engineering-bom-node\.drop-target/);
assert.match(styles, /\.item-route-step\.operation-drop-target/);
assert.match(desktopBuild, /'apqp-traceability\.js'/);
assert.match(webBuild, /'\/apqp-traceability\.js'/);

console.log(JSON.stringify({
  result: 'PASS apqp-traceability-smoke',
  chain: 'VOC → QFD → Boundary/P-Diagram → DFMEA/DVP&R → PFMEA/Control Plan/Instruction',
  interaction: 'editable + reorderable + characteristic mapping'
}));
