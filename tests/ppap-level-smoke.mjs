import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const appSource = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const beginMarker = '// PPAP_LEVEL_PROFILE_BEGIN';
const endMarker = '// PPAP_LEVEL_PROFILE_END';
const begin = appSource.indexOf(beginMarker);
const end = appSource.indexOf(endMarker);
assert.ok(begin >= 0 && end > begin, 'PPAP seviye profili kaynak bloğu bulunamadı.');

const profileSource = appSource.slice(begin + beginMarker.length, end);
const context = vm.createContext({});
vm.runInContext(`${profileSource}\nglobalThis.__ppapProfile = { PPAP_DISPOSITION, ppapElementKeys, ppapLevelSubmissionMatrix, normalizedPpapLevel, ppapLevelDisposition, ppapDispositionInReadinessScope, ppapScopedStatusSummary };`, context);
const profile = context.__ppapProfile;
const dispositions = JSON.parse(JSON.stringify(profile.PPAP_DISPOSITION));
const keys = JSON.parse(JSON.stringify(profile.ppapElementKeys));
const matrix = JSON.parse(JSON.stringify(profile.ppapLevelSubmissionMatrix));

assert.deepEqual(dispositions, {
  SUBMIT: 'Gönder',
  RETAIN: 'Tesiste Sakla',
  CUSTOMER_DEFINED: 'Müşteri Belirler',
  NOT_APPLICABLE: 'Uygulanmaz'
});
assert.equal(keys.length, 18);
assert.equal(new Set(keys).size, 18);
assert.deepEqual(Object.keys(matrix), ['1', '2', '3', '4', '5']);
for (const level of Object.keys(matrix)) {
  assert.deepEqual(Object.keys(matrix[level]).sort(), [...keys].sort(), `Seviye ${level} matrisi 18 unsurun tamamını içermiyor.`);
}

const counts = level => Object.values(matrix[level]).reduce((result, disposition) => {
  result[disposition] = (result[disposition] || 0) + 1;
  return result;
}, {});
assert.deepEqual(counts('1'), { 'Tesiste Sakla': 15, Gönder: 3 });
assert.deepEqual(counts('2'), { Gönder: 8, 'Tesiste Sakla': 10 });
assert.deepEqual(counts('3'), { Gönder: 16, 'Tesiste Sakla': 2 });
assert.deepEqual(counts('4'), { 'Müşteri Belirler': 17, Gönder: 1 });
assert.deepEqual(counts('5'), { 'Tesiste Sakla': 17, Gönder: 1 });

assert.equal(matrix['1'].appearance, 'Gönder');
assert.equal(matrix['1']['sample-parts'], 'Gönder');
assert.equal(matrix['1'].psw, 'Gönder');
assert.equal(matrix['2']['design-records'], 'Gönder');
assert.equal(matrix['2'].dfmea, 'Tesiste Sakla');
assert.equal(matrix['3']['master-sample'], 'Tesiste Sakla');
assert.equal(matrix['3']['checking-aids'], 'Tesiste Sakla');
assert.equal(matrix['4'].psw, 'Gönder');
assert.equal(matrix['5']['sample-parts'], 'Gönder');
assert.equal(matrix['5'].psw, 'Tesiste Sakla');

assert.equal(profile.normalizedPpapLevel('1'), '1');
assert.equal(profile.normalizedPpapLevel('5'), '5');
assert.equal(profile.normalizedPpapLevel('99'), '3');
assert.equal(profile.ppapLevelDisposition('2', 'laboratory'), 'Gönder');
assert.equal(profile.ppapLevelDisposition('2', 'pfmea'), 'Tesiste Sakla');
assert.equal(profile.ppapDispositionInReadinessScope('1', 'Gönder'), true);
assert.equal(profile.ppapDispositionInReadinessScope('1', 'Tesiste Sakla'), true, 'Tesiste saklanan uygulanabilir PPAP kaydı tam dosya hazırlığında doğrulanmalıdır.');
assert.equal(profile.ppapDispositionInReadinessScope('4', 'Müşteri Belirler'), true, 'Çözülmemiş Seviye 4 müşteri kararı kalite kapısında kalmalı.');
assert.equal(profile.ppapDispositionInReadinessScope('3', 'Uygulanmaz'), false);
assert.equal(profile.ppapDispositionInReadinessScope('5', 'Tesiste Sakla'), true, 'Seviye 5 tesis incelemesinde saklanan kayıtlar inceleme kapsamındadır.');
assert.equal(Object.values(matrix['3']).filter(disposition => profile.ppapDispositionInReadinessScope('3', disposition)).length, 18);

const scopedSummary = JSON.parse(JSON.stringify(profile.ppapScopedStatusSummary(['ready', 'ready', 'blocked'])));
assert.deepEqual(scopedSummary, { required: 3, ready: 2, progress: 0, blocked: 1, readiness: 67 });
assert.equal(profile.ppapScopedStatusSummary([]).readiness, 0);

const functionSource = name => {
  const match = appSource.match(new RegExp(`function ${name}\\([^]*?\\n\\}`));
  assert.ok(match, `${name} kaynak fonksiyonu bulunamadı.`);
  return match[0];
};
const scopeContext = vm.createContext({});
vm.runInContext(`${profileSource}
globalThis.__records = {};
function selectedPpapLevel() { return '3'; }
function ppapRecord(key) { return globalThis.__records[key]; }
function ppapEffectiveStatus(item) { return item.__status; }
${functionSource('ppapApprovedNotApplicable')}
${functionSource('ppapEffectiveDisposition')}
${functionSource('ppapItemInReadinessScope')}
${functionSource('ppapReadinessState')}
globalThis.__scopeApi = { ppapItemInReadinessScope, ppapReadinessState };`, scopeContext);
scopeContext.__records.normal = { owner: 'Eren', dueDate: '2026-07-17', revision: 'A', applicability: 'Uygulanır', submissionDisposition: 'Müşteri Belirler', rationale: '', approvalStatus: 'Onaylandı' };
scopeContext.__records.validUa = { owner: 'Eren', dueDate: '2026-07-17', revision: 'A', applicability: 'Uygulanamaz', submissionDisposition: 'Müşteri Belirler', rationale: 'Bu parça için müşteri onayı gerekmiyor.', approvalStatus: 'Onaylandı' };
scopeContext.__records.invalidUa = { owner: 'Eren', dueDate: '2026-07-17', revision: 'A', applicability: 'Uygulanamaz', submissionDisposition: 'Müşteri Belirler', rationale: '', approvalStatus: 'Onaylandı' };
const syntheticItems = [
  Object.assign(['Normal', '', 'ready', 'normal', false, 'manual', 'Gönder'], { __status: 'ready' }),
  Object.assign(['Geçerli U/A', '', 'ready', 'validUa', true, 'manual', 'Gönder'], { __status: 'ready' }),
  Object.assign(['Eksik U/A', '', 'blocked', 'invalidUa', true, 'manual', 'Gönder'], { __status: 'blocked' })
];
const syntheticState = JSON.parse(JSON.stringify(scopeContext.__scopeApi.ppapReadinessState(syntheticItems, '3')));
assert.equal(syntheticState.required, 2, 'Onaylı U/A kapsamdan düşmeli; eksik U/A kalite kapısında kalmalı.');
assert.equal(syntheticState.ready, 1);
assert.equal(syntheticState.blocked, 1);
assert.equal(syntheticState.readiness, 50);
assert.equal(syntheticState.notApplicable, 1);
assert.equal(syntheticState.submit, 2);

assert.match(appSource, /PPAP SEVİYE \$\{level\}/, 'PPAP başlığı seçili seviyeyi dinamik göstermeli.');
assert.match(appSource, /const readinessState = ppapReadinessState\(ppapItems, level\)/, 'PPAP özeti seviye kapsamlı readiness hesabını kullanmalı.');
assert.doesNotMatch(appSource, /Math\.round\(\(ready \/ ppapItems\.length\) \* 100\)/, 'Readiness tüm 18 unsuru koşulsuz payda yapmamalı.');
assert.match(appSource, /lisanslı güncel yayın, müşteri özel şartları ve müşteri talebi ayrıca doğrulanmalıdır/, 'Lisanslı PPAP yayınına ilişkin sınır notu görünür olmalı.');

console.log(JSON.stringify({
  schema: 'PPAP 18-element submission/retention support profile',
  levels: Object.fromEntries(Object.keys(matrix).map(level => [level, counts(level)])),
  level3ReadinessScope: 18,
  level5Mode: 'supplier-site-review',
  status: 'PASS'
}, null, 2));
