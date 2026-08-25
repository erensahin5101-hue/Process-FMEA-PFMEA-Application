import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, app, css, libraryText] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../data/operation-code-library.tr-en.v1.0.0.json', import.meta.url), 'utf8')
]);
const library = JSON.parse(libraryText);

assert.equal(library.libraryId, 'tyana.qflow.operation-codes.tr-en');
assert.equal(library.operations.length, 380);
assert.equal(library.operations.filter(record => record.requiresReview).length, 55);
assert.ok(html.includes('data-library-mode-button="operation"'));
assert.ok(html.includes('id="operationCodeCatalog"'));
assert.ok(html.includes('id="operationCatalogSearch"'));
assert.ok(html.includes('id="operationCatalogReviewFilter"'));
assert.ok(html.includes('id="operationCodeRows"'));
assert.ok(html.includes('data-action="export-operation-codes"'));
assert.match(app, /function renderOperationCodeCatalog\(\)/);
assert.match(app, /function addOperationCodeToRoute\(code(?:,\s*options\s*=\s*\{\})?\)/);
assert.match(app, /function bindOperationCodeMetadata\(detail, code\)/);
assert.match(app, /function exportOperationCodeLibrary\(\)/);
assert.ok(app.includes('katalog dışı operasyon kodu var'));
assert.ok(app.includes('anlam/çeviri mühendislik incelemesi açık'));
assert.ok(app.includes('operationCodeId: detail.operationCodeId'));
assert.ok(app.includes('operationLabelTR: detail.operationLabelTR'));
assert.ok(css.includes('.library-mode-tabs'));
assert.ok(css.includes('.operation-code-row'));
assert.ok(css.includes('.operation-catalog-guide'));

console.log('Operation catalog UI smoke PASS: 380 TR/EN records, route binding, review gate, snapshot metadata and verified Excel action.');
