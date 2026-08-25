import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';
import pdfMake from 'pdfmake/build/pdfmake.js';
import pdfFonts from 'pdfmake/build/vfs_fonts.js';
import {
  buildControlPlanWorkbook,
  controlPlanRowsFixture,
  instructionFixture,
  pfmeaRowsFixture,
  processFixture,
  safeExcelValue,
  snapshotFixture
} from './export-fixtures.mjs';

const root = resolve(import.meta.dirname, '..');
const outputDir = resolve(root, 'output', 'qa');
await mkdir(outputDir, { recursive: true });

const appSource = await readFile(resolve(root, 'app.js'), 'utf8');
assert.match(appSource, /function pdfControlDefinition\(snapshot\)/, 'Kontrol planı PDF tanımı app.js içinde bulunamadı.');
assert.match(appSource, /function dfmeaPdfDefinition\(snapshot\)/, 'DFMEA PDF tanımı app.js içinde bulunamadı.');
assert.match(appSource, /function pfmeaPdfDefinition\(snapshot\)/, 'PFMEA PDF tanımı app.js içinde bulunamadı.');
assert.match(appSource, /async function exportPfmeaXlsx\(\)/, 'PFMEA Excel üreticisi app.js içinde bulunamadı.');
assert.match(appSource, /function documentationAuditPdfDefinition\(snapshot, audit\)/, 'Denetim kanıt PDF tanımı app.js içinde bulunamadı.');
assert.match(appSource, /function flowPdfDefinition\(snapshot\)/, 'Proses akış PDF tanımı app.js içinde bulunamadı.');
assert.match(appSource, /function instructionPdfBlock\(model, index, pageBreak = false\)/, 'Operatör talimatı PDF bloğu app.js içinde bulunamadı.');

function extractFunctionSource(source, name) {
  const marker = `function ${name}`;
  const markerStart = source.indexOf(marker);
  assert.notEqual(markerStart, -1, `${name} app.js içinde bulunamadı.`);
  const start = source.slice(Math.max(0, markerStart - 6), markerStart) === 'async ' ? markerStart - 6 : markerStart;
  const bodyStart = source.indexOf('{', start);
  assert.notEqual(bodyStart, -1, `${name} fonksiyon gövdesi bulunamadı.`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') { blockComment = false; index += 1; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '/') { lineComment = true; index += 1; continue; }
    if (char === '/' && next === '*') { blockComment = true; index += 1; continue; }
    if (char === '\'' || char === '"' || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`${name} fonksiyonu dengeli kapanmıyor.`);
}

function compileAppFunction(functionNames, returnName, dependencies = {}) {
  const sources = functionNames.map(name => extractFunctionSource(appSource, name)).join('\n');
  const names = Object.keys(dependencies);
  const values = Object.values(dependencies);
  return new Function(...names, `'use strict';\n${sources}\nreturn ${returnName};`)(...values);
}

function copyLabel(status) {
  return ['Onaylandı', 'Yayında'].includes(status) ? 'KONTROLLÜ KOPYA' : 'TASLAK / TANITIM';
}

function componentMaterialSummary(limit = 2) {
  return snapshotFixture.components.slice(0, limit).map(item => `${item.name}: ${item.materialGrade}`).join(' • ');
}

function surfacePerformanceText(technical = snapshotFixture.technical) {
  return `${technical.coatingType} • ${technical.coatingThickness} µm • ${technical.corrosionHours} saat korozyon şartı`;
}

const tenantShortName = () => snapshotFixture.tenant.shortName;
const tenantProductName = () => snapshotFixture.tenant.productName;
const tenantSnapshotProfile = () => snapshotFixture.tenant;
const qualityDocumentLibrary = { libraryId: snapshotFixture.tenant.libraryId, libraryVersion: snapshotFixture.tenant.libraryVersion };

const formValues = {
  documentStatus: snapshotFixture.approval.status,
  supplierName: snapshotFixture.product.supplierName,
  supplierSite: snapshotFixture.product.supplierSite,
  customer: snapshotFixture.product.customer,
  customerPartNumber: snapshotFixture.product.customerPartNumber,
  keyContact: snapshotFixture.product.keyContact,
  keyContactPhone: snapshotFixture.product.keyContactPhone,
  originalDate: snapshotFixture.product.originalDate,
  revisionDate: snapshotFixture.product.revisionDate,
  drawingNumber: snapshotFixture.product.drawingNumber,
  materialGrade: snapshotFixture.technical.materialGrade,
  materialStandard: snapshotFixture.technical.materialStandard
};
const documentFixture = { getElementById: id => ({ value: formValues[id] ?? '' }) };
const input = value => ({ value });

const pdfControlDefinition = compileAppFunction(['pdfControlDefinition'], 'pdfControlDefinition', {
  controlPlanRows: () => controlPlanRowsFixture,
  controlPlanNumber: input(snapshotFixture.product.controlPlanNumber),
  drawingRevision: input(snapshotFixture.product.drawingRevision),
  documentCopyLabel: copyLabel,
  document: documentFixture,
  phaseExportText: () => `[ ] Prototip   [ ] Ön Seri   [X] ${snapshotFixture.product.productionPhase}`,
  partNumber: input(snapshotFixture.product.partNumber),
  partName: input(snapshotFixture.product.partName),
  components: snapshotFixture.components,
  componentMaterialSummary,
  surfacePerformanceText,
  tenantShortName,
  tenantProductName
});

const selectedProcessEntries = () => snapshotFixture.route.map(step => ({
  routeKey: step.routeKey,
  process: processFixture.find(process => process.id === step.processId),
  detail: { operationNo: step.operationNo }
}));
const pfmeaPdfDefinition = compileAppFunction(['pfmeaPdfDefinition'], 'pfmeaPdfDefinition', {
  selectedProcessEntries,
  processes: processFixture,
  pfmeaRows: pfmeaRowsFixture,
  PFMEA_WORK_ELEMENT_TYPES: Object.freeze([['MAN', 'İnsan'], ['MACHINE', 'Makine'], ['METHOD', 'Metot'], ['MATERIAL', 'Malzeme']]),
  pfmeaResultComplete: row => ['Kapalı', 'Tamamlandı', 'Etkinlik Doğrulandı'].includes(row.status) && Boolean(row.actionCompletionDate && row.actionEvidence && row.resultAp),
  documentCopyLabel: copyLabel,
  tenantShortName,
  tenantProductName
});
const dfmeaPdfDefinition = compileAppFunction(['dfmeaPdfDefinition'], 'dfmeaPdfDefinition', {
  documentCopyLabel: copyLabel,
  tenantShortName,
  tenantProductName
});
const documentationAuditPdfDefinition = compileAppFunction(['documentationAuditPdfDefinition'], 'documentationAuditPdfDefinition', {
  tenantShortName,
  tenantProductName
});
const auditFixture = {
  generatedAt: snapshotFixture.generatedAt,
  total: 10,
  pass: 8,
  blocked: 2,
  score: 80,
  fmeaEvidence: 5,
  categories: Array.from({ length: 10 }, (_, index) => ({
    id: `QG-${String(index + 1).padStart(2, '0')}`,
    title: ['Ürün kimliği', 'Teknik resim', 'BOM', 'Teknik şartlar', 'İş planı', 'DFMEA', 'PFMEA', 'Kontrol Planı', 'Talimat', 'PPAP'][index],
    evidence: `QA kanıtı ${index + 1}`,
    status: index < 8 ? 'pass' : 'blocked',
    issues: index < 8 ? [] : [`QA bulgusu ${index + 1}`]
  }))
};
const flowPdfDefinition = compileAppFunction(['flowPdfDefinition'], 'flowPdfDefinition', {
  componentMaterialSummary,
  surfacePerformanceText,
  documentCopyLabel: copyLabel,
  tenantShortName,
  tenantProductName
});
const longRouteSnapshot = structuredClone(snapshotFixture);
longRouteSnapshot.route = Array.from({ length: 4 }, (_, batchIndex) => snapshotFixture.route.map((step, stepIndex) => ({
  ...step,
  routeKey: `${step.routeKey}-stress-${batchIndex + 1}`,
  operationNo: String((batchIndex * snapshotFixture.route.length + stepIndex + 1) * 10),
  name: `${step.name} ${batchIndex + 1}`
}))).flat();
const longFlowDefinition = flowPdfDefinition(longRouteSnapshot);
const specificationById = new Map(controlPlanRowsFixture.map(row => [row.item.id, row.specification]));
const instructionPdfBlock = compileAppFunction(['instructionPdfBlock'], 'instructionPdfBlock', {
  drawingRevision: input(snapshotFixture.product.drawingRevision),
  partNumber: input(snapshotFixture.product.partNumber),
  partName: input(snapshotFixture.product.partName),
  projectCode: input(snapshotFixture.product.projectCode),
  specificationFor: item => specificationById.get(item.id) || 'Teknik resme göre',
  tenantSnapshotProfile,
  tenantShortName,
  tenantProductName,
  qualityDocumentLibrary
});
const createProcessFlowDxf = compileAppFunction(['dxfAscii', 'createProcessFlowDxf'], 'createProcessFlowDxf');

const definitions = {
  control: pdfControlDefinition(snapshotFixture),
  dfmea: dfmeaPdfDefinition(snapshotFixture),
  pfmea: pfmeaPdfDefinition(snapshotFixture),
  audit: documentationAuditPdfDefinition(snapshotFixture, auditFixture),
  flow: flowPdfDefinition(snapshotFixture),
  flowLong: longFlowDefinition,
  instruction: {
    pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [16, 14, 16, 22],
    watermark: { text: copyLabel(snapshotFixture.approval.status), color: '#b8c3d4', opacity: 0.14, bold: true },
    content: [instructionPdfBlock(instructionFixture, 0)],
    styles: { wiHead: { bold: true, color: 'white', fillColor: '#10213f', fontSize: 5.8, alignment: 'center', margin: 2.4 } },
    footer: (page, pages) => ({ text: `${snapshotFixture.product.controlPlanNumber} • OP ${instructionFixture.operationNo} • ${copyLabel(snapshotFixture.approval.status)} • Sayfa ${page}/${pages}`, fontSize: 6, alignment: 'center', color: '#68758b' }),
    defaultStyle: { font: 'Roboto' }
  }
};

assert.equal(definitions.control.pageSize, 'A3');
assert.equal(definitions.control.pageOrientation, 'landscape');
const controlRiskTable = definitions.control.content.find(block => block.table?.widths?.length === 12);
assert.ok(controlRiskTable, 'Kontrol planı 12 kolonlu kontrol tablosu bulunamadı.');
assert.equal(controlRiskTable.table.body.length, controlPlanRowsFixture.length + 1);
assert.equal(definitions.pfmea.pageSize, 'A3');
assert.equal(definitions.pfmea.pageOrientation, 'landscape');
const pfmeaRiskTable = definitions.pfmea.content.find(block => block.table?.widths?.length === 10);
assert.ok(pfmeaRiskTable, 'PFMEA 10 gruplu risk tablosu bulunamadı.');
assert.equal(pfmeaRiskTable.table.body.length, pfmeaRowsFixture.length + 1);
const pfmeaEvidenceTable = definitions.pfmea.content.find(block => block.table?.widths?.length === 6);
assert.ok(pfmeaEvidenceTable, 'PFMEA 7-adım denetim kanıt tablosu bulunamadı.');
assert.equal(definitions.dfmea.pageSize, 'A3');
assert.equal(definitions.dfmea.pageOrientation, 'landscape');
const dfmeaRiskTable = definitions.dfmea.content.find(block => block.table?.widths?.length === 14);
assert.ok(dfmeaRiskTable, 'DFMEA 14 kolonlu risk tablosu bulunamadı.');
assert.equal(dfmeaRiskTable.table.body.length, snapshotFixture.fmeaGovernance.dfmeaRows.length + 1);
const dfmeaEvidenceTable = definitions.dfmea.content.find(block => block.table?.widths?.length === 8);
assert.ok(dfmeaEvidenceTable, 'DFMEA 7-adım denetim kanıt tablosu bulunamadı.');
assert.equal(definitions.audit.pageSize, 'A4');
assert.equal(definitions.audit.pageOrientation, 'landscape');
const auditGateTable = definitions.audit.content.find(block => block.table?.widths?.length === 5);
assert.ok(auditGateTable, 'Dokümantasyon tutarlılık kapı tablosu bulunamadı.');
assert.equal(auditGateTable.table.body.length, auditFixture.categories.length + 1);
assert.equal(definitions.flow.pageSize, 'A3');
assert.equal(definitions.flow.pageOrientation, 'portrait');
const flowMatrix = definitions.flow.content.find(block => block.pageBreak === 'before' && block.pageOrientation === 'landscape');
assert.ok(flowMatrix, 'Proses akışı izlenebilirlik matrisi A3 yatay ek olarak bulunamadı.');
assert.equal(definitions.flowLong.pageSize, 'A3');
assert.equal(definitions.flowLong.pageOrientation, 'portrait');
assert.equal(longRouteSnapshot.route.length, 32, 'Uzun rota stres fixture’ı 25 adımın üzerinde olmalı.');
const longFlowMatrix = definitions.flowLong.content.find(block => block.pageBreak === 'before' && block.pageOrientation === 'landscape');
assert.ok(longFlowMatrix, 'Uzun rota izlenebilirlik matrisi A3 yatay ek olarak bulunamadı.');
assert.ok(definitions.flowLong.content.filter(block => block.pageBreak === 'before' && block.pageOrientation !== 'landscape').length >= 3, '32 adımlı rota en az dört portre akış sayfasına bölünmeli.');
assert.equal(definitions.instruction.pageSize, 'A4');
assert.equal(definitions.instruction.pageOrientation, 'landscape');
assert.equal(definitions.instruction.content[0].stack.length, 11);

function collectText(node, result = []) {
  if (node == null || typeof node === 'function') return result;
  if (typeof node === 'string' || typeof node === 'number') { result.push(String(node)); return result; }
  if (Array.isArray(node)) { node.forEach(value => collectText(value, result)); return result; }
  if (typeof node === 'object') {
    for (const value of Object.values(node)) collectText(value, result);
  }
  return result;
}

const oversizedRouteSnapshot = structuredClone(snapshotFixture);
const oversizedPayload = 'A'.repeat(5_000);
oversizedRouteSnapshot.route = [{
  ...oversizedRouteSnapshot.route[0],
  description: oversizedPayload,
  inputMaterial: oversizedPayload,
  outputMaterial: oversizedPayload,
  equipment: oversizedPayload,
  tooling: oversizedPayload,
  controlMethod: oversizedPayload,
  documentRef: oversizedPayload
}];
const oversizedFlowDefinition = flowPdfDefinition(oversizedRouteSnapshot);
const oversizedMatrix = oversizedFlowDefinition.content.find(block => block.pageOrientation === 'landscape');
assert.ok(oversizedMatrix, 'Aşırı uzun veri stresinde izlenebilirlik matrisi oluşmadı.');
assert.ok(Math.max(...collectText(oversizedMatrix).map(text => text.length)) <= 650, 'Proses PDF hücre metni güvenli uzunluk sınırını aştı.');

const definitionText = Object.fromEntries(Object.entries(definitions).map(([name, definition]) => [name, collectText(definition).join('\n')]));
function collectSvg(node, result = []) {
  if (node == null || typeof node === 'function') return result;
  if (Array.isArray(node)) { node.forEach(value => collectSvg(value, result)); return result; }
  if (typeof node === 'object') {
    if (typeof node.svg === 'string') result.push(node.svg);
    for (const value of Object.values(node)) collectSvg(value, result);
  }
  return result;
}

assert.match(`${definitionText.control}\n${collectText(definitions.control.header?.()).join('\n')}`, /KONTROL PLANI \/ CONTROL PLAN/);
assert.match(definitionText.control, /Komple Rot Kolu Mamulü/);
assert.match(`${definitionText.pfmea}\n${collectText(definitions.pfmea.header?.()).join('\n')}`, /PROSES FMEA \/ PROCESS FAILURE MODE AND EFFECTS ANALYSIS/);
assert.match(definitionText.pfmea, /ÖNLEME:.*TESPİT:.*REAKSİYON:/s);
assert.match(definitionText.pfmea, /AKSİYON SONRASI RİSK \/ KANIT \/ CP/);
assert.match(`${definitionText.dfmea}\n${collectText(definitions.dfmea.header?.()).join('\n')}`, /TASARIM FMEA \/ DESIGN FAILURE MODE AND EFFECTS ANALYSIS/);
assert.match(definitionText.dfmea, /AKSİYON SONRASI S\/O\/D\/AP/);
assert.match(`${definitionText.audit}\n${collectText(definitions.audit.header?.()).join('\n')}`, /DOKÜMANTASYON TUTARLILIK VE DENETİM KANIT RAPORU/);
assert.match(definitionText.audit, /FMEA 7-ADIM NESNEL KANIT KÜTÜĞÜ/);
assert.match(`${definitionText.flow}\n${collectText(definitions.flow.header?.()).join('\n')}`, /PARÇA ÜRETİM PROSES AKIŞ ŞEMASI/);
for (const expected of ['BAŞLA', 'BİTİR', 'LEJANT', 'DOKÜMAN KONTROLÜ', 'OPERASYON GİRDİ / ÇIKTI VE KONTROL MATRİSİ']) assert.match(definitionText.flow, new RegExp(expected), `Proses akışında “${expected}” bloğu eksik.`);
assert.match(definitionText.flow, /Entegre tesis montajı/);
assert.ok(collectSvg(definitions.flow).length >= snapshotFixture.route.length, 'Her proses adımı için ölçeklenebilir vektör SVG görseli bulunmalı.');
assert.ok(collectSvg(definitions.flowLong).length >= longRouteSnapshot.route.length, 'Uzun rotada tüm adımlar vektör SVG görseliyle üretilmeli.');
for (const step of longRouteSnapshot.route) {
  assert.match(definitionText.flowLong, new RegExp(step.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Uzun rota metin katmanında ${step.name} bulunamadı.`);
}
assert.match(definitionText.instruction, /OPERATÖR İŞ VE KALİTE KONTROL TALİMATI/);
assert.match(definitionText.instruction, /SAYISAL PROSES PARAMETRELERİ VE KONTROL LİMİTLERİ/);
assert.match(definitionText.instruction, /GÜVENLİK/);
const brandedDefinitionText = {
  control: `${definitionText.control}\n${collectText(definitions.control.header?.()).join('\n')}`,
  dfmea: `${definitionText.dfmea}\n${collectText(definitions.dfmea.header?.()).join('\n')}`,
  pfmea: `${definitionText.pfmea}\n${collectText(definitions.pfmea.header?.()).join('\n')}`,
  audit: `${definitionText.audit}\n${collectText(definitions.audit.header?.()).join('\n')}`,
  flow: `${definitionText.flow}\n${collectText(definitions.flow.header?.()).join('\n')}`,
  flowLong: `${definitionText.flowLong}\n${collectText(definitions.flowLong.header?.()).join('\n')}`,
  instruction: definitionText.instruction
};
for (const [name, text] of Object.entries(brandedDefinitionText)) {
  assert.match(text, /TYANA Q-FLOW/, `${name} çıktısında TYANA Q-FLOW yayıncı kimliği bulunamadı.`);
  assert.match(text, /TYANA Q-FLOW/, `${name} çıktısında TYANA Q-FLOW ürün adı bulunamadı.`);
  assert.doesNotMatch(text, /TYANA OTOMOTİV/i, `${name} çıktısına genel kütüphane sahibi tenant markası olarak sızdı.`);
}

pdfMake.vfs = pdfFonts;
function createPdfBuffer(definition) {
  return new Promise((resolvePdf, rejectPdf) => {
    try {
      pdfMake.createPdf(definition).getBuffer(buffer => resolvePdf(Buffer.from(buffer)));
    } catch (error) {
      rejectPdf(error);
    }
  });
}

function assertPdf(buffer, label) {
  assert.equal(buffer.subarray(0, 5).toString('ascii'), '%PDF-', `${label} PDF imzası geçersiz.`);
  assert.match(buffer.subarray(-128).toString('latin1'), /%%EOF/, `${label} PDF EOF işaretçisi eksik.`);
  assert.match(buffer.toString('latin1'), /startxref/, `${label} PDF xref işaretçisi eksik.`);
  assert.ok(buffer.length > 8_000, `${label} PDF olağandışı küçük: ${buffer.length} byte.`);
  assert.ok((buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length >= 1, `${label} PDF sayfa nesnesi içermiyor.`);
}

const pdfFiles = {
  control: 'kontrol-plani.pdf',
  dfmea: 'dfmea.pdf',
  pfmea: 'pfmea.pdf',
  audit: 'dokumantasyon-denetim-kaniti.pdf',
  flow: 'proses-akisi.pdf',
  flowLong: 'proses-akisi-uzun-rota.pdf',
  instruction: 'operator-talimati.pdf'
};
const pdfStats = {};
for (const [name, definition] of Object.entries(definitions)) {
  const buffer = await createPdfBuffer(definition);
  assertPdf(buffer, name);
  await writeFile(resolve(outputDir, pdfFiles[name]), buffer);
  pdfStats[name] = { bytes: buffer.length, pages: (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length };
}
assert.ok(pdfStats.flowLong.pages >= 5, `32 adımlı proses akışı en az dört portre akış ve bir yatay matris sayfası üretmeli; üretilen: ${pdfStats.flowLong.pages}.`);

assert.equal(safeExcelValue('=2+2'), "'=2+2");
assert.equal(safeExcelValue('+SUM(A1:A2)'), "'+SUM(A1:A2)");
assert.equal(safeExcelValue('-1+2'), "'-1+2");
assert.equal(safeExcelValue('@HYPERLINK(A1)'), "'@HYPERLINK(A1)");
assert.equal(safeExcelValue(' \t=2+2'), "' \t=2+2");
assert.equal(safeExcelValue('\r@SUM(A1:A2)'), "'\r@SUM(A1:A2)");
assert.equal(safeExcelValue(42), 42);
assert.equal(safeExcelValue('Kullanıcı Tanımlı Kuruluş'), 'Kullanıcı Tanımlı Kuruluş');
assert.equal(safeExcelValue('TYANA Q-FLOW'), 'TYANA Q-FLOW');

globalThis.ExcelJS = ExcelJS;
const exportPfmeaXlsx = compileAppFunction(['safeExcelHeaderFooter', 'exportPfmeaXlsx'], 'exportPfmeaXlsx', {
  pfmeaRows: pfmeaRowsFixture,
  ensureDocumentExportReady: () => true,
  getDocumentationSnapshot: async () => snapshotFixture,
  tenantProductName,
  safeExcelValue,
  safeFileName: value => String(value || '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim(),
  PFMEA_WORK_ELEMENT_TYPES: Object.freeze([['MAN', 'İnsan'], ['MACHINE', 'Makine'], ['METHOD', 'Metot'], ['MATERIAL', 'Malzeme']]),
  pfmeaResultComplete: row => ['Kapalı', 'Tamamlandı', 'Etkinlik Doğrulandı'].includes(row.status) && Boolean(row.actionCompletionDate && (row.actionEvidence || row.evidence) && row.resultAp),
  documentCopyLabel: copyLabel,
  exportFileTypes: { xlsx: [{ name: 'Excel', extensions: ['xlsx'] }] },
  saveBlob: async (blob, fileName) => {
    const filePath = resolve(outputDir, fileName);
    await writeFile(filePath, Buffer.from(await blob.arrayBuffer()));
    return { saved: true, fileName, filePath };
  },
  toast: () => {}
});
const pfmeaExcelResult = await exportPfmeaXlsx();
assert.equal(pfmeaExcelResult.saved, true);
const pfmeaWorkbook = new ExcelJS.Workbook();
await pfmeaWorkbook.xlsx.load(await readFile(pfmeaExcelResult.filePath));
assert.deepEqual(
  pfmeaWorkbook.worksheets.filter(sheet => sheet.state === 'visible').map(sheet => sheet.name),
  ['PFMEA Formu', '7 Adım Kanıtı', 'FMEA Profili', 'İzlenebilirlik']
);
assert.equal(pfmeaWorkbook.getWorksheet('_TYANA_METADATA')?.state, 'veryHidden');
assert.equal(pfmeaWorkbook.getWorksheet('PFMEA Formu').columnCount, 41);
assert.equal(pfmeaWorkbook.getWorksheet('PFMEA Formu').rowCount, 8 + pfmeaRowsFixture.length);
assert.equal(pfmeaWorkbook.getWorksheet('PFMEA Formu').pageSetup.printArea, `A1:AO${8 + pfmeaRowsFixture.length}`);
assert.equal(pfmeaWorkbook.getWorksheet('PFMEA Formu').views[0].ySplit, 8);
assert.equal(pfmeaWorkbook.getWorksheet('PFMEA Formu').getCell('A1').value, 'PROSES FMEA / PROCESS FAILURE MODE AND EFFECTS ANALYSIS');
assert.match(String(pfmeaWorkbook.getWorksheet('PFMEA Formu').getCell('A9').value), /Komple Rot Kolu/);
assert.match(String(pfmeaWorkbook.getWorksheet('PFMEA Formu').getCell('AI9').value), /CHR-/);
assert.equal(pfmeaWorkbook.getWorksheet('7 Adım Kanıtı').rowCount, 2 + snapshotFixture.fmeaGovernance.questionCatalog.pfmea.length);

const workbook = buildControlPlanWorkbook();
const xlsxBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
assert.equal(xlsxBuffer.subarray(0, 2).toString('ascii'), 'PK', 'XLSX ZIP imzası geçersiz.');
const xlsxPath = resolve(outputDir, 'kontrol-plani.xlsx');
await writeFile(xlsxPath, xlsxBuffer);

const verifiedWorkbook = new ExcelJS.Workbook();
await verifiedWorkbook.xlsx.load(await readFile(xlsxPath));
assert.equal(verifiedWorkbook.worksheets.length, 5);
assert.equal(verifiedWorkbook.worksheets.filter(sheet => sheet.state === 'visible').length, 4);
assert.deepEqual(verifiedWorkbook.worksheets.filter(sheet => sheet.state === 'visible').map(sheet => sheet.name), ['Kontrol Planı', 'Mamul Ağacı', 'Karakteristik Kütüğü', 'Mühendislik Soruları']);

const controlSheet = verifiedWorkbook.getWorksheet('Kontrol Planı');
const bomSheet = verifiedWorkbook.getWorksheet('Mamul Ağacı');
const characteristicSheet = verifiedWorkbook.getWorksheet('Karakteristik Kütüğü');
const engineeringSheet = verifiedWorkbook.getWorksheet('Mühendislik Soruları');
const metadataSheet = verifiedWorkbook.getWorksheet('_TYANA_METADATA');
assert.ok(controlSheet && bomSheet && characteristicSheet && engineeringSheet && metadataSheet);
assert.equal(verifiedWorkbook.creator, 'TYANA Q-FLOW • Kullanıcı Tanımlı Kuruluş • Eren');
assert.equal(metadataSheet.state, 'veryHidden');
assert.equal(controlSheet.getCell('A1').value, 'KONTROL PLANI / CONTROL PLAN');
assert.equal(controlSheet.rowCount, 8 + controlPlanRowsFixture.length);
assert.equal(controlSheet.pageSetup.orientation, 'landscape');
assert.equal(controlSheet.pageSetup.printArea, `A1:L${8 + controlPlanRowsFixture.length}`);
assert.equal(controlSheet.pageSetup.printTitlesRow, '8:8');
assert.equal(controlSheet.views[0].state, 'frozen');
assert.equal(controlSheet.views[0].ySplit, 8);
assert.match(String(controlSheet.getCell('E4').value), /Komple Rot Kolu Mamulü/);
assert.match(String(controlSheet.getCell('A3').value), /Kullanıcı Tanımlı Kuruluş \/ Kullanıcı Tanımlı Tesis/);
assert.match(String(controlSheet.getRow(11).getCell(5).value), /Mafsal fonksiyonel çapı/);
assert.match(String(bomSheet.getCell('A1').value), /MAMUL AĞACI/);
assert.equal(bomSheet.getRow(4).cellCount, 41);
assert.deepEqual(
  [3, 31, 32, 33, 34].map(column => bomSheet.getRow(4).getCell(column).value),
  ['OEM No', 'Kaynak BOM No', 'BOM Revizyonu', 'BOM Alternatifi', 'Montaj Operasyon Kodu']
);
assert.match(String(bomSheet.getRow(6).getCell(9).value), /41Cr4/);
assert.equal(bomSheet.getRow(6).getCell(31).value, 'QA-BOM-001');
assert.equal(bomSheet.getRow(6).getCell(34).value, '304');
assert.equal(bomSheet.pageSetup.printArea, `A1:AO${4 + snapshotFixture.components.length}`);
assert.equal(bomSheet.pageSetup.fitToWidth, 2);
assert.equal(bomSheet.pageSetup.printTitlesRow, '1:4');
assert.equal(bomSheet.pageSetup.printTitlesColumn, 'A:D');
assert.match(String(characteristicSheet.getCell('A1').value), /KARAKTERİSTİK KÜTÜĞÜ/);
assert.equal(characteristicSheet.pageSetup.printArea, `A1:Q${3 + controlPlanRowsFixture.length}`);
assert.match(String(engineeringSheet.getCell('A1').value), /MÜHENDİSLİK SORULARI/);
assert.equal(engineeringSheet.getRow(3).getCell(6).value, 'Yanıt / Sayısal Değer');
assert.match(String(engineeringSheet.getRow(7).getCell(6).value), /600/);
assert.equal(engineeringSheet.pageSetup.printArea, `A1:J${engineeringSheet.rowCount}`);
assert.equal(metadataSheet.getCell('B3').value, 'TYANA Q-FLOW');
assert.equal(metadataSheet.getCell('B4').value, 'Kullanıcı Tanımlı Kuruluş');
assert.equal(metadataSheet.getCell('B5').value, snapshotFixture.tenant.plant);
assert.equal(metadataSheet.getCell('B8').value, snapshotFixture.sha256);
assert.equal(metadataSheet.getCell('B11').value, "'=HYPERLINK(\"https://invalid.example\",\"blocked\")");
assert.match(String(controlSheet.headerFooter.oddFooter), /KONTROLLÜ KOPYA/);

const formulaErrors = [];
const formulas = [];
const unsafeStrings = [];
for (const sheet of verifiedWorkbook.worksheets) {
  sheet.eachRow({ includeEmpty: false }, row => row.eachCell({ includeEmpty: false }, cell => {
    const value = cell.value;
    if (value && typeof value === 'object' && 'formula' in value) {
      formulas.push(`${sheet.name}!${cell.address}`);
      if (typeof value.result === 'string' && /^#(?:REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!)/.test(value.result)) formulaErrors.push(`${sheet.name}!${cell.address}:${value.result}`);
    }
    if (value && typeof value === 'object' && 'error' in value) formulaErrors.push(`${sheet.name}!${cell.address}:${value.error}`);
    if (typeof value === 'string' && /^[=+@]/.test(value)) unsafeStrings.push(`${sheet.name}!${cell.address}:${value}`);
  }));
}
assert.deepEqual(formulas, [], 'Kontrol planı fixture çalışma kitabı formül içermemeli.');
assert.deepEqual(formulaErrors, [], 'Çalışma kitabında formül hata değeri bulundu.');
assert.deepEqual(unsafeStrings, [], 'Formül enjeksiyonuna açık metin bulundu.');

const dxf = createProcessFlowDxf(snapshotFixture);
assert.match(dxf, /^0\r\nSECTION\r\n2\r\nHEADER\r\n/);
assert.match(dxf, /\r\n\$INSUNITS\r\n70\r\n4\r\n/);
for (const layer of ['FRAME', 'TITLEBLOCK', 'PROCESS', 'CONTROL', 'TEXT']) assert.match(dxf, new RegExp(`\\r\\n${layer}\\r\\n`));
const lineEntities = (dxf.match(/\r\nLINE\r\n/g) || []).length;
const textEntities = (dxf.match(/\r\nTEXT\r\n/g) || []).length;
assert.ok(lineEntities > 40, `DXF çizgi sayısı yetersiz: ${lineEntities}`);
assert.ok(textEntities >= 25, `DXF metin sayısı yetersiz: ${textEntities}`);
assert.match(dxf, /KULLANICI TANIMLI KURULUS \/ KULLANICI TANIMLI TESIS/i);
assert.doesNotMatch(dxf, /TYANA OTOMOTIV/i, 'DXF antedinde genel kütüphane sahibi tenant markası olarak kalamaz.');
assert.match(dxf, /\r\nEOF$/);
await writeFile(resolve(outputDir, 'proses-akisi.dxf'), dxf, 'ascii');

console.log(JSON.stringify({
  outputDir,
  pdf: pdfStats,
  xlsx: {
    bytes: xlsxBuffer.length,
    sheets: verifiedWorkbook.worksheets.length,
    visibleSheets: verifiedWorkbook.worksheets.filter(sheet => sheet.state === 'visible').length,
    controlRows: controlSheet.rowCount,
    printArea: controlSheet.pageSetup.printArea,
    bomColumns: bomSheet.getRow(4).cellCount,
    engineeringRows: engineeringSheet.rowCount,
    formulas: formulas.length,
    formulaErrors: formulaErrors.length,
    metadata: metadataSheet.state
  },
  pfmeaXlsx: {
    bytes: (await readFile(pfmeaExcelResult.filePath)).length,
    sheets: pfmeaWorkbook.worksheets.length,
    visibleSheets: pfmeaWorkbook.worksheets.filter(sheet => sheet.state === 'visible').length,
    rows: pfmeaWorkbook.getWorksheet('PFMEA Formu').rowCount,
    columns: pfmeaWorkbook.getWorksheet('PFMEA Formu').columnCount,
    metadata: pfmeaWorkbook.getWorksheet('_TYANA_METADATA').state
  },
  dxf: { bytes: Buffer.byteLength(dxf, 'ascii'), lineEntities, textEntities, layers: 5 }
}));
