import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ExcelJS from 'exceljs';

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

const dxf = await readFile(resolve(output, 'TY-2026-0042_Proses_Akisi_Rev-C.dxf'), 'ascii');
assert.match(dxf, /\r\n\$INSUNITS\r\n70\r\n4\r\n/);
for (const layer of ['FRAME', 'TITLEBLOCK', 'PROCESS', 'CONTROL', 'TEXT']) assert.match(dxf, new RegExp(`\\r\\n${layer}\\r\\n`));
assert.equal((dxf.match(/\r\nLINE\r\n/g) || []).length > 40, true);
assert.equal((dxf.match(/\r\nTEXT\r\n/g) || []).length >= 30, true);
assert.match(dxf, /\r\nEOF$/);

console.log(JSON.stringify({ xlsx: { rows: sheet.rowCount, printArea: sheet.pageSetup.printArea, metadata: 'veryHidden' }, pdf: { controlBytes: controlPdf.length, flowBytes: flowPdf.length, instructionBytes: instructionPdf.length }, dxf: { lineEntities: (dxf.match(/\r\nLINE\r\n/g) || []).length, textEntities: (dxf.match(/\r\nTEXT\r\n/g) || []).length, layers: 5 } }));
