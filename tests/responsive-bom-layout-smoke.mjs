import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const css = await readFile(resolve(root, 'styles.css'), 'utf8');

const fullWidthPaneRule = /\.form-layout\s*:has\(\s*\.wizard-pane\[data-pane\s*=\s*["']?2["']?\]\.active\s*\)\s*\{([^}]*)\}/g;
const fullWidthDeclarations = [...css.matchAll(fullWidthPaneRule)].map(match => match[1]);
assert.ok(
  fullWidthDeclarations.some(body => /grid-template-columns\s*:\s*(?:minmax\(\s*0\s*,\s*1fr\s*\)|1fr)\s*;?/i.test(body)),
  'Aktif 2. adımda .form-layout tek kolon/tam genişlik olmalı; BOM editörü özet kartıyla sıkıştırılmamalı'
);

const bomLineRules = [...css.matchAll(/\.bom-line-form\s*\{([^}]*)\}/g)];
assert.ok(bomLineRules.length > 0, '.bom-line-form CSS kuralı bulunamadı');

function braceDepthAt(index) {
  let depth = 0;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (css[cursor] === '{') depth += 1;
    else if (css[cursor] === '}') depth = Math.max(0, depth - 1);
  }
  return depth;
}

function splitTopLevelColumns(value) {
  const columns = [];
  let token = '';
  let depth = 0;
  for (const character of value.trim()) {
    if (character === '(' || character === '[') depth += 1;
    if (character === ')' || character === ']') depth = Math.max(0, depth - 1);
    if (/\s/.test(character) && depth === 0) {
      if (token) columns.push(token);
      token = '';
    } else token += character;
  }
  if (token) columns.push(token);
  return columns;
}

function declaredColumnCount(value) {
  const repeat = value.trim().match(/^repeat\(\s*(\d+)\s*,/i);
  return repeat ? Number(repeat[1]) : splitTopLevelColumns(value).length;
}

// Aynı seçici daha önce tanımlanmış olabilir. CSS cascade açısından son top-level
// kural geçerlidir; media-query içindeki mobil kurallar temel kolon sayılmaz.
const topLevelBomLineRules = bomLineRules.filter(match => braceDepthAt(match.index) === 0);
assert.ok(topLevelBomLineRules.length > 0, 'Top-level .bom-line-form CSS kuralı bulunamadı');
const baseRule = topLevelBomLineRules.at(-1)[1];
const gridDeclaration = baseRule.match(/grid-template-columns\s*:\s*([^;}]+)/i)?.[1] || '';
assert.ok(gridDeclaration, 'Temel .bom-line-form kuralında grid-template-columns tanımı bulunamadı');
assert.ok(
  declaredColumnCount(gridDeclaration) <= 4,
  `Temel BOM satırı en fazla 4 kolon olmalı; mevcut tanım ${declaredColumnCount(gridDeclaration)} kolon: ${gridDeclaration}`
);

assert.match(css, /@media\s*\(max-width\s*:\s*900px\)[\s\S]*?\.bom-line-form\s*\{[^}]*grid-template-columns\s*:\s*repeat\(\s*2\s*,/i, '900px altında BOM satırı 2 kolona düşmeli');
assert.match(css, /@media\s*\(max-width\s*:\s*560px\)[\s\S]*?\.bom-line-form[^{}]*\{[^}]*grid-template-columns\s*:\s*minmax\(\s*0\s*,\s*1fr\s*\)/i, '560px altında BOM satırı tek kolona düşmeli');
assert.match(css, /\.bom-bulk-add-button\{[^}]*min-width\s*:\s*0/i, 'Toplu BOM ekleme düğmesi dar alanda taşmamalı');
assert.match(css, /\.bom-drag-library\s+\[data-bom-drag-master\]/, 'Genel BOM kütüphanesi button kuralı toplu ekleme düğmesini etkilememeli');
assert.match(css, /@media\s*\(max-width\s*:\s*560px\)[\s\S]*?\.bom-drag-bulk-tools\s*\{[^}]*grid-template-columns\s*:\s*1fr/i, 'Dar ekranda BOM arama ve ekleme düğmesi alt alta gelmeli');

console.log(`Responsive BOM layout smoke tests passed (base columns: ${declaredColumnCount(gridDeclaration)}).`);
