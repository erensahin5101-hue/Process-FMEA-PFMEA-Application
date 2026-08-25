import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const [html, guide, styles, build, desktopBuild, serviceWorker, app] = await Promise.all([
  readFile(resolve(root, 'index.html'), 'utf8'),
  readFile(resolve(root, 'guided-experience.js'), 'utf8'),
  readFile(resolve(root, 'styles.css'), 'utf8'),
  readFile(resolve(root, 'build.mjs'), 'utf8'),
  readFile(resolve(root, 'desktop-build.mjs'), 'utf8'),
  readFile(resolve(root, 'service-worker.js'), 'utf8'),
  readFile(resolve(root, 'app.js'), 'utf8')
]);

assert.match(html, /<script src="\/guided-experience\.js"><\/script>/);
assert.match(build, /'\/guided-experience\.js'/);
assert.match(desktopBuild, /'guided-experience\.js'/);
assert.match(serviceWorker, /\/guided-experience\.js/);
assert.match(app, /tyana:view-changed/);
assert.match(app, /tyana:data-changed/);

const stages = [...guide.matchAll(/id: '([^']+)', no: '(\d+)'/g)].map(match => ({ id: match[1], no: match[2] }));
assert.equal(stages.length, 13, 'Yol haritası 13 kapı içermeli.');
assert.deepEqual(stages.map(stage => stage.id), ['identity', 'drawing', 'bom', 'workplan', 'flow', 'engineering', 'characteristics', 'apqp', 'dfmea', 'pfmea', 'control', 'instruction', 'ppap']);
assert.equal(new Set(stages.map(stage => stage.no)).size, 13, 'Yol haritası sıra numaraları benzersiz olmalı.');

for (const required of ['qflowJourneyBar', 'qflowGuideDrawer', 'qflowCommandPalette', 'TyanaGuide', 'Ctrl+K', 'Boundary ve P-Diyagramı']) {
  assert.ok(guide.includes(required), `${required} yönlendirme katmanında bulunmalı.`);
}
for (const required of ['.qflow-journey-bar', '.qflow-guide-drawer', '.qflow-command-palette', '.qflow-guided-focus', '@media(max-width:650px)', '@media print']) {
  assert.ok(styles.includes(required), `${required} stili bulunmalı.`);
}

assert.match(guide, /const safe =/);
assert.match(guide, /aria-hidden/);
assert.match(guide, /aria-labelledby/);
assert.match(guide, /function isEscapeKey\(event\)/);
assert.match(guide, /event\?\.key === 'Escape'/);
assert.match(guide, /window\.addEventListener\('keydown', closeOnEscape, \{ capture: true \}\)/);
assert.match(guide, /function clearSearchField\(field\)/);

console.log(JSON.stringify({ result: 'PASS guided-experience-smoke', stages: stages.length, keyboardSearch: true, responsive: true }));
