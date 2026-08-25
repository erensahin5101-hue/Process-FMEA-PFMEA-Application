import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, app, workspace, fmea, css, desktopBuild] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../product-definition-workspace.js', import.meta.url), 'utf8'),
  readFile(new URL('../fmea-governance.js', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../desktop-build.mjs', import.meta.url), 'utf8')
]);

for (const moduleId of ['product', 'bom', 'workplan']) {
  assert.match(html, new RegExp(`data-view="${moduleId}"`), `${moduleId} bağımsız ana menüde bulunmalı`);
  assert.match(app, new RegExp(`${moduleId}: \\{ pane:`), `${moduleId} bağımsız modül tanımı bulunmalı`);
}
assert.match(html, /data-view="dfmea"/);
assert.match(html, /id="dfmeaGovernanceStudio"/);
assert.match(html, /id="pfmeaGovernanceStudio"/);
assert.match(html, /id="dfmeaAnalysisRows"/);
assert.match(html, /data-action="export-dfmea-pdf"/);
assert.match(html, /id="documentationAuditPanel"/);
assert.match(html, /data-action="export-audit-pdf"/);

assert.match(app, /prepareIndependentProductModules/);
assert.match(app, /openItemMasterTechnicalDetails/);
assert.doesNotMatch(app, /wizard-pane\[data-pane="2"\][^\n]+renderEngineeringBomUi/, 'Özet güncellemesi kart editörünü yeniden çizmemeli');
assert.match(app, /hasEngineeringItemMasterDrag/);
assert.match(app, /engineeringItemMasterDropId/);
assert.match(workspace, /draggedOperationCode/);
assert.match(workspace, /hasOperationDrag/);
assert.match(css, /item-master-drag-active/);
assert.match(css, /operation-drag-active/);
assert.match(html, /id="bomDefinitionDropZone"/);
assert.match(html, /class="bom-bulk-add-button"/);
assert.match(html, /id="pfmeaRatingGuideDialog"/);
assert.match(app, /function pfmeaSuggestedActionPriority/);
assert.match(app, /function applyPfmeaRatingGuideSelection/);
assert.match(app, /data-open-pfmea-rating/);
assert.match(css, /pfmea-rating-guide-list/);

const sharedQuestionCount = [...fmea.matchAll(/\['(?:[1-7]\.\d{2})',\s*[1-7],/g)].length;
const dfmeaQuestionCount = [...fmea.matchAll(/\['D\.\d{2}',\s*[1-7],/g)].length;
const pfmeaQuestionCount = [...fmea.matchAll(/\['P\.\d{2}',\s*[1-7],/g)].length;
assert.equal(sharedQuestionCount, 34);
assert.equal(dfmeaQuestionCount, 10);
assert.equal(pfmeaQuestionCount, 14);
assert.match(fmea, /Foundation FMEA/);
assert.match(fmea, /Family FMEA/);
assert.match(fmea, /Ürüne \/ prosese özel FMEA/);
assert.match(fmea, /S×O×D gösterge; AP yerine geçmez/);
assert.match(fmea, /function dfmeaRpn\(row\)/);
assert.match(fmea, /data-dfmea-rpn/);
assert.match(fmea, /riskScore\.textContent = dfmeaRpn/);
assert.match(fmea, /field\.matches\('select, input\[type="date"\]'\)/);
assert.match(fmea, /global\.TyanaFmea = Object\.freeze/);
assert.match(app, /fmeaGovernance: globalThis\.TyanaFmea/);
assert.match(fmea, /schemaVersion:\s*'1\.2\.0'/);
for (const field of ['intent', 'timing', 'task', 'tool', 'structureAnalysisRef', 'functionAnalysisRef', 'ratingTableRef', 'resultReportRef']) assert.match(fmea, new RegExp(field));
assert.match(fmea, /riskRationale/);
assert.match(fmea, /resultSeverity/);
assert.match(fmea, /resultOccurrence/);
assert.match(fmea, /resultDetection/);
assert.match(fmea, /resultAp/);
assert.match(fmea, /actionCompletionDate/);
assert.match(fmea, /questionCatalog/);
assert.match(fmea, /evidenceRows/);
assert.match(fmea, /readiness/);
assert.match(app, /function dfmeaPdfDefinition\(snapshot\)/);
assert.match(app, /function documentationAuditPdfDefinition\(snapshot, audit\)/);
assert.match(app, /function documentationAuditCategories\(\)/);
assert.match(app, /dfmeaReleaseIssues/);
assert.match(app, /fmeaGovernanceReleaseIssues\('dfmea'\)/);
assert.match(app, /fmeaGovernanceReleaseIssues\('pfmea'\)/);
assert.match(desktopBuild, /'fmea-governance\.js'/);

console.log(JSON.stringify({
  independentModules: 3,
  sharedAuditQuestions: sharedQuestionCount,
  dfmeaQuestions: dfmeaQuestionCount,
  pfmeaQuestions: pfmeaQuestionCount,
  fmeaEvidenceSchema: '1.2.0',
  documentAuditGates: 10,
  technicalPanelPersistence: true,
  dragFallbacks: ['item-master', 'operation']
}));
