import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import ExcelJS from 'exceljs';
import pdfMake from 'pdfmake/build/pdfmake.js';
import pdfFonts from 'pdfmake/build/vfs_fonts.js';

const output = resolve(import.meta.dirname, '..', 'output', 'browser');
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(await readFile(resolve(output, 'CP-RK-5101-001_Rev-C.xlsx')));
const sheet = workbook.getWorksheet('Kontrol Planı');
assert.ok(sheet);
assert.equal(sheet.getCell('A1').value, 'KONTROL PLANI / CONTROL PLAN');
assert.equal(sheet.rowCount, 11);
assert.equal(sheet.pageSetup.orientation, 'landscape');
assert.equal(sheet.pageSetup.printArea, 'A1:L11');
assert.equal(sheet.pageSetup.printTitlesRow, '8:8');
assert.equal(sheet.getRow(8).getCell(1).value, 'Op.');
assert.match(String(sheet.getRow(9).getCell(5).value), /Mafsal fonksiyonel çapı/);
assert.ok(workbook.getWorksheet('Mamul Ağacı'));
assert.ok(workbook.getWorksheet('Karakteristik Kütüğü'));
assert.equal(workbook.getWorksheet('_TYANA_METADATA').state, 'veryHidden');
assert.match(String(workbook.getWorksheet('_TYANA_METADATA').getCell('B5').value), /^[a-f0-9]{64}$/);

const controlPdf = await readFile(resolve(output, 'CP-RK-5101-001_Rev-C.pdf'));
const instructionPdf = await readFile(resolve(output, 'RK-5101-001_OP-10_incoming.pdf'));
const flowPdf = await readFile(resolve(output, 'TY-2026-0042_Proses_Akisi_Rev-C.pdf'));
assert.equal(controlPdf.subarray(0, 5).toString(), '%PDF-');
assert.equal(instructionPdf.subarray(0, 5).toString(), '%PDF-');
assert.equal(flowPdf.subarray(0, 5).toString(), '%PDF-');

// Exercise the exact PFMEA document-definition function from app.js and verify
// that pdfMake emits a non-trivial, structurally complete PDF byte stream.
const appSource = await readFile(resolve(import.meta.dirname, '..', 'app.js'), 'utf8');
const pfmeaDefinitionSource = appSource.match(/function pfmeaPdfDefinition\(snapshot\) \{[\s\S]*?(?=\nasync function exportPfmeaPdf)/)?.[0];
assert.ok(pfmeaDefinitionSource, 'PFMEA PDF definition is missing from app.js');
const fixtureProcess = { id: 'cnc', name: 'CNC Tornalama' };
const pfmeaDefinitionFactory = new Function('selectedProcessEntries', 'processes', 'pfmeaRows', 'documentCopyLabel', `${pfmeaDefinitionSource}; return pfmeaPdfDefinition;`);
const pfmeaDefinition = pfmeaDefinitionFactory(
  () => [{ routeKey: 'route-10', process: fixtureProcess, detail: { operationNo: '10' } }],
  [fixtureProcess], [], status => status === 'Yürürlükte' ? 'KONTROLLÜ KOPYA' : 'TASLAK / TANITIM'
);
const pfmeaSnapshot = {
  generatedAt: '2026-07-15T10:00:00.000Z', sha256: 'a'.repeat(64),
  product: { projectCode: 'TY-TEST-001', partNumber: 'PN-001', partName: 'Test Mamul', productGroupLabel: 'Kullanıcı Tanımlı Mamul', productionPhase: 'Seri Üretim', drawingNumber: 'DRW-001', drawingRevision: 'A', supplierName: 'TYANA OTOMOTİV', supplierSite: 'Merkez', customer: 'Test Müşteri', customerPartNumber: 'C-PN-001', coreTeam: 'Kalite / Proses', originalDate: '2026-07-01', revisionDate: '2026-07-15' },
  components: [], route: [{ routeKey: 'route-10' }], approval: { preparedBy: 'Eren', status: 'Yürürlükte' },
  standardsProfile: { iatf: 'IATF 16949:2016', apqp: 'AIAG APQP' },
  pfmea: [{ routeKey: 'route-10', processId: 'cnc', componentId: 'FINISHED_GOOD', functionText: 'Ölçüye göre işleme', failureMode: 'Çap tolerans dışı', effect: 'Montaj uygunsuzluğu', severity: '8', cause: 'Takım aşınması', preventionControl: 'Takım ömrü takibi', occurrence: '3', detectionControl: 'İlk parça ve periyodik ölçüm', detection: '4', ap: 'H', recommendedAction: 'Takım ömrü alarmı', owner: 'Proses Mühendisi', dueDate: '2026-08-01', status: 'Devam Ediyor', evidence: 'AKS-001' }]
};
pfmeaSnapshot.pfmea = Array.from({ length: 24 }, (_, index) => ({
  ...pfmeaSnapshot.pfmea[0], failureMode: `${index + 1}. risk - çap tolerans dışı`,
  ap: ['H', 'M', 'L'][index % 3], status: ['Açık', 'Devam Ediyor', 'Kapalı'][index % 3], evidence: `AKS-${String(index + 1).padStart(3, '0')}`
}));
const pfmeaDoc = pfmeaDefinition(pfmeaSnapshot);
assert.equal(pfmeaDoc.pageSize, 'A3');
assert.equal(pfmeaDoc.pageOrientation, 'landscape');
assert.equal(pfmeaDoc.content[2].table.widths.length, 14);
assert.equal(pfmeaDoc.content[2].table.body.length, 25);
assert.match(pfmeaDoc.footer(1, 1).columns[1].text, /KONTROLLÜ KOPYA.*Sayfa 1 \/ 1/);
pdfMake.vfs = pdfFonts;
const pfmeaPdf = await new Promise((resolvePdf, rejectPdf) => {
  try { pdfMake.createPdf(pfmeaDoc).getBuffer(resolvePdf); } catch (error) { rejectPdf(error); }
});
assert.equal(Buffer.from(pfmeaPdf).subarray(0, 5).toString(), '%PDF-');
assert.match(Buffer.from(pfmeaPdf).subarray(-24).toString('latin1'), /%%EOF/);
assert.ok(pfmeaPdf.length > 10000, `PFMEA PDF unexpectedly small: ${pfmeaPdf.length} bytes`);
if (process.env.PFMEA_SMOKE_OUTPUT) {
  const pfmeaOutput = resolve(process.env.PFMEA_SMOKE_OUTPUT);
  await mkdir(dirname(pfmeaOutput), { recursive: true });
  await writeFile(pfmeaOutput, pfmeaPdf);
}

const dxf = await readFile(resolve(output, 'TY-2026-0042_Proses_Akisi_Rev-C.dxf'), 'ascii');
assert.match(dxf, /\r\n\$INSUNITS\r\n70\r\n4\r\n/);
for (const layer of ['FRAME', 'TITLEBLOCK', 'PROCESS', 'CONTROL', 'TEXT']) assert.match(dxf, new RegExp(`\\r\\n${layer}\\r\\n`));
assert.equal((dxf.match(/\r\nLINE\r\n/g) || []).length > 40, true);
assert.equal((dxf.match(/\r\nTEXT\r\n/g) || []).length >= 30, true);
assert.match(dxf, /\r\nEOF$/);

console.log(JSON.stringify({ xlsx: { rows: sheet.rowCount, printArea: sheet.pageSetup.printArea, metadata: 'veryHidden' }, pdf: { controlBytes: controlPdf.length, flowBytes: flowPdf.length, instructionBytes: instructionPdf.length, pfmeaBytes: pfmeaPdf.length, pfmeaColumns: 14 }, dxf: { lineEntities: (dxf.match(/\r\nLINE\r\n/g) || []).length, textEntities: (dxf.match(/\r\nTEXT\r\n/g) || []).length, layers: 5 } }));
