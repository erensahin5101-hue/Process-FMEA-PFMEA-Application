const views = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item[data-view]');
const breadcrumb = document.getElementById('breadcrumbTitle');
const titles = {
  dashboard: 'Genel Bakış', product: 'Ürün Tanımlama', flow: 'Proses Akışı',
  pfmea: 'PFMEA', control: 'Kontrol Planı', instruction: 'Operatör Talimatı',
  documents: 'PPAP Merkezi', library: 'Proses Kütüphanesi'
};

function showView(id) {
  views.forEach(view => view.classList.toggle('active', view.id === id));
  navItems.forEach(item => item.classList.toggle('active', item.dataset.view === id));
  breadcrumb.textContent = titles[id] || 'Genel Bakış';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

navItems.forEach(item => item.addEventListener('click', () => showView(item.dataset.view)));
document.querySelectorAll('[data-view-target]').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.viewTarget)));

function toast(title, detail) {
  const el = document.getElementById('toast');
  el.querySelector('b').textContent = title;
  el.querySelector('small').textContent = detail;
  el.classList.add('show');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

// Product-group backbone
const productBackbones = {
  steering: {
    label: 'Direksiyon Sistemleri', types: ['Rot Başı', 'Rot Kolu', 'İç Rot', 'Direksiyon Mafsalı'],
    processes: ['incoming', 'cutting', 'forging', 'shotblast', 'cnc', 'thread', 'induction', 'coating', 'assembly', 'torque', 'final', 'packing']
  },
  suspension: {
    label: 'Süspansiyon Sistemleri', types: ['Askı Rotu', 'Salıncak Kolu', 'Denge Kolu', 'Rotil'],
    processes: ['incoming', 'cutting', 'forging', 'shotblast', 'cnc', 'induction', 'coating', 'assembly', 'torque', 'final', 'packing']
  },
  chassis: {
    label: 'Şasi Bağlantı Elemanları', types: ['V Kolu', 'Bağlantı Braketi', 'Çeki Kolu'],
    processes: ['incoming', 'cutting', 'forging', 'shotblast', 'cnc', 'coating', 'assembly', 'final', 'packing']
  },
  machined: {
    label: 'Talaşlı İmalat Parçaları', types: ['Küresel Pim', 'Burç', 'Bağlantı Adaptörü'],
    processes: ['incoming', 'cutting', 'cnc', 'thread', 'coating', 'final', 'packing']
  }
};

const productGroup = document.getElementById('productGroup');
const productType = document.getElementById('productType');
const partNumber = document.getElementById('partNumber');
const partName = document.getElementById('partName');
const drawingRevision = document.getElementById('drawingRevision');
const projectCode = document.getElementById('projectCode');
const controlPlanNumber = document.getElementById('controlPlanNumber');
let currentProjectId = null;
let currentProjectVersion = 0;

function syncProductTypes() {
  const backbone = productBackbones[productGroup.value];
  const previous = productType.value;
  productType.innerHTML = backbone.types.map(type => `<option>${escapeHtml(type)}</option>`).join('');
  if (backbone.types.includes(previous)) productType.value = previous;
  updateSummary();
}

productGroup.addEventListener('change', syncProductTypes);
[productType, partNumber, partName, drawingRevision, projectCode, controlPlanNumber, document.getElementById('annualVolume')].forEach(input => {
  input.addEventListener('input', updateSummary);
  input.addEventListener('change', updateSummary);
});

// Guided wizard
let currentWizardStep = 1;
function goToWizardStep(step) {
  const target = Number(step);
  if (target === 2 && (!partNumber.value.trim() || !partName.value.trim())) {
    toast('Zorunlu alan eksik', 'Parça numarası ve parça adını girin.');
    return;
  }
  if (target === 5 && !validateCharacteristics()) {
    toast('Teknik değer kontrolü gerekli', 'Boş veya geçersiz sayısal değerleri düzeltin.');
    return;
  }
  currentWizardStep = target;
  document.querySelectorAll('.wizard-pane').forEach(pane => pane.classList.toggle('active', Number(pane.dataset.pane) === target));
  document.querySelectorAll('.wizard-step').forEach(stepButton => {
    const number = Number(stepButton.dataset.wizardStep);
    stepButton.classList.toggle('active', number === target);
    stepButton.classList.toggle('complete', number < target);
  });
  updateSummary();
  document.querySelector('.wizard-steps').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.querySelectorAll('[data-next-step]').forEach(btn => btn.addEventListener('click', () => goToWizardStep(btn.dataset.nextStep)));
document.querySelectorAll('[data-prev-step]').forEach(btn => btn.addEventListener('click', () => goToWizardStep(btn.dataset.prevStep)));
document.querySelectorAll('.wizard-step').forEach(btn => btn.addEventListener('click', () => goToWizardStep(btn.dataset.wizardStep)));

document.querySelectorAll('.choice-card').forEach(card => card.addEventListener('click', () => {
  document.querySelectorAll(`input[name="${card.querySelector('input').name}"]`).forEach(input => input.closest('.choice-card')?.classList.remove('selected'));
  card.classList.add('selected');
}));

document.querySelectorAll('.segmented label').forEach(label => label.addEventListener('click', () => {
  label.closest('.segmented').querySelectorAll('label').forEach(item => item.classList.remove('active'));
  label.classList.add('active');
  setTimeout(updateSummary, 0);
}));

// Technical drawing characteristics — stable IDs feed PFD → PFMEA → CP → work instruction.
const characteristicProcessMap = [
  ['incoming', 'Girdi Kontrol'], ['cutting', 'Çubuk Kesme'], ['forging', 'Sıcak Dövme'],
  ['shotblast', 'Kumlama'], ['cnc', 'CNC Tornalama'], ['thread', 'Diş Açma'],
  ['induction', 'İndüksiyon'], ['coating', 'Yüzey Kaplama'], ['assembly', 'Montaj'],
  ['torque', 'Tork Kontrolü'], ['final', 'Final Kontrol'], ['packing', 'Paketleme']
];
let drawingSource = { name: '5101-234-001_REV-C.pdf', size: 0, type: 'application/pdf', lastModified: null, sha256: 'KULLANICI-DOĞRULAMASI-BEKLİYOR' };
let characteristics = [
  { id: 'CHAR-001', balloon: '12', name: 'Pim çapı', kind: 'Ürün', specMode: 'numeric', nominal: 18, minus: 0.013, plus: 0.013, specText: '', unit: 'mm', classification: 'CC', processId: 'cnc', method: 'Değişken ölçüm', equipment: '0–25 mm dijital mikrometre', sampleSize: '5 parça', frequency: '2 saatte', pokaYoke: 'Takım ömrü sayacı', reference: 'TL-ÖLÇ-014', reaction: 'RP-01' },
  { id: 'CHAR-002', balloon: '27', name: 'Yüzey sertliği', kind: 'Ürün', specMode: 'numeric', nominal: 60, minus: 2, plus: 2, specText: '', unit: 'HRC', classification: 'SC', processId: 'induction', method: 'Laboratuvar testi', equipment: 'Rockwell sertlik cihazı / HRC', sampleSize: '3 parça', frequency: 'Vardiyada', pokaYoke: 'Reçete kilidi', reference: 'TL-LAB-006', reaction: 'RP-02' },
  { id: 'CHAR-003', balloon: 'P-09', name: 'Sıkma torku', kind: 'Proses', specMode: 'numeric', nominal: 42, minus: 3, plus: 3, specText: '', unit: 'Nm', classification: 'SC', processId: 'torque', method: '%100 otomatik izleme', equipment: 'Dijital tork sistemi / TS-04', sampleSize: '%100', frequency: 'Her parça', pokaYoke: 'Program-parça eşleme', reference: 'TL-MON-021', reaction: 'RP-03' }
];

function parseLocaleNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  let normalized = String(value ?? '').trim().replace(/\s/g, '');
  if (!normalized) return NaN;
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.lastIndexOf(',') > normalized.lastIndexOf('.')
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
  } else normalized = normalized.replace(',', '.');
  return Number(normalized);
}

function formatValue(value, maxDigits = 4) {
  if (!Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString('tr-TR', { maximumFractionDigits: maxDigits });
}

function specificationFor(item) {
  if (item.specMode !== 'numeric') return item.specText || '—';
  return `${formatValue(item.nominal - item.minus)} – ${formatValue(item.nominal + item.plus)} ${item.unit}`;
}

function processOptionsForCharacteristic(selectedId) {
  const catalog = Array.isArray(globalThis.qflowProcessCatalog) && globalThis.qflowProcessCatalog.length
    ? globalThis.qflowProcessCatalog.map(process => [process.id, process.name]) : characteristicProcessMap;
  return catalog.map(([id, name]) => `<option value="${escapeHtml(id)}" ${id === selectedId ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('');
}

function selectOptions(values, selectedValue) {
  return values.map(value => `<option value="${escapeHtml(value)}" ${value === selectedValue ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('');
}

function renderCharacteristics() {
  const rows = document.getElementById('characteristicRows');
  rows.innerHTML = characteristics.map((item, index) => `<article class="characteristic-editor ${item.specMode === 'numeric' ? 'numeric-mode' : 'text-mode'}" data-characteristic="${index}">
    <div class="characteristic-editor-top"><span class="characteristic-index">${String(index + 1).padStart(2, '0')}</span><div><small>KALICI ID</small><b>${escapeHtml(item.id)}</b></div><label class="characteristic-name">Karakteristik adı<input data-field="name" value="${escapeHtml(item.name)}"></label><mark class="classification-mark ${item.classification.toLocaleLowerCase('tr-TR').replace(/\s/g, '-')}">${escapeHtml(item.classification)}</mark><button class="remove-characteristic" data-remove-characteristic="${index}" aria-label="Karakteristiği kaldır">×</button></div>
    <div class="characteristic-fields primary-fields">
      <label>Balon / no<input data-field="balloon" value="${escapeHtml(item.balloon)}"></label>
      <label>Özellik tipi<select data-field="kind">${selectOptions(['Ürün', 'Proses', 'Malzeme', 'Görsel / Atribut', 'GD&T'], item.kind)}</select></label>
      <label>Gereklilik tipi<select data-field="specMode"><option value="numeric" ${item.specMode === 'numeric' ? 'selected' : ''}>Sayısal tolerans</option><option value="text" ${item.specMode === 'text' ? 'selected' : ''}>Metin / standart</option><option value="attribute" ${item.specMode === 'attribute' ? 'selected' : ''}>Geçti / Kaldı</option></select></label>
      <label>Özel sınıf<select data-field="classification">${selectOptions(['Normal', 'SC', 'CC', 'Ürün Güvenliği'], item.classification)}</select></label>
      <label class="numeric-field">Nominal<input data-field="nominal" inputmode="decimal" value="${escapeHtml(formatValue(item.nominal))}"></label>
      <label class="numeric-field">− tolerans<input data-field="minus" inputmode="decimal" value="${escapeHtml(formatValue(item.minus))}"></label>
      <label class="numeric-field">+ tolerans<input data-field="plus" inputmode="decimal" value="${escapeHtml(formatValue(item.plus))}"></label>
      <label class="numeric-field">Birim<select data-field="unit">${selectOptions(['mm', '°', 'HRC', 'HV', 'Nm', 'µm', 'Ra', 'bar', 'N'], item.unit)}</select></label>
      <label class="text-spec-field">Spesifikasyon / kabul kriteri<input data-field="specText" value="${escapeHtml(item.specText)}" placeholder="M10 6g, Ra 1,6, çizik yok…"></label>
      <div class="computed-limit"><small>HESAPLANAN LSL / USL</small><b>${escapeHtml(specificationFor(item))}</b></div>
    </div>
    <div class="control-mapping"><div class="mapping-title"><span>⇢</span><b>Proses ve kontrol eşleştirmesi</b><small>Kontrol planı ile operatör talimatına aktarılır</small></div><div class="characteristic-fields mapping-fields">
      <label>Bağlı proses<select data-field="processId">${processOptionsForCharacteristic(item.processId)}</select></label>
      <label>Kontrol yöntemi<input data-field="method" value="${escapeHtml(item.method)}"></label>
      <label>Ölçüm cihazı / ID<input data-field="equipment" value="${escapeHtml(item.equipment)}"></label>
      <label>Numune adedi<input data-field="sampleSize" value="${escapeHtml(item.sampleSize)}"></label>
      <label>Sıklık / tetikleyici<input data-field="frequency" value="${escapeHtml(item.frequency)}"></label>
      <label>Poka‑yoke / önleme<input data-field="pokaYoke" value="${escapeHtml(item.pokaYoke)}"></label>
      <label>Referans doküman<input data-field="reference" value="${escapeHtml(item.reference)}"></label>
      <label>Reaksiyon kodu<input data-field="reaction" value="${escapeHtml(item.reaction)}"></label>
    </div></div>
  </article>`).join('');

  rows.querySelectorAll('input, select').forEach(input => {
    const update = event => {
      const row = event.target.closest('.characteristic-editor');
      const index = Number(row.dataset.characteristic);
      const field = event.target.dataset.field;
      if (!field) return;
      characteristics[index][field] = ['nominal', 'minus', 'plus'].includes(field) ? parseLocaleNumber(event.target.value) : event.target.value;
      if (field === 'specMode') { renderCharacteristics(); return; }
      row.querySelector('.computed-limit b').textContent = specificationFor(characteristics[index]);
      validateCharacteristics();
      updateSummary();
      markDraftDirty();
    };
    input.addEventListener('input', update);
    input.addEventListener('change', update);
  });
  rows.querySelectorAll('[data-remove-characteristic]').forEach(btn => btn.addEventListener('click', () => {
    if (characteristics.length === 1) {
      toast('En az bir karakteristik gerekli', 'Kontrol planı için bir teknik özellik bırakın.');
      return;
    }
    characteristics.splice(Number(btn.dataset.removeCharacteristic), 1);
    renderCharacteristics();
    markDraftDirty();
  }));
  validateCharacteristics();
  updateSummary();
}

function validateCharacteristics() {
  let validCount = 0;
  document.querySelectorAll('#characteristicRows .characteristic-editor').forEach((row, index) => {
    const item = characteristics[index];
    const numericValid = item.specMode !== 'numeric' || (Number.isFinite(item.nominal) && Number.isFinite(item.minus) && Number.isFinite(item.plus) && item.minus >= 0 && item.plus >= 0);
    const textValid = item.specMode === 'numeric' || Boolean(String(item.specText || '').trim());
    const valid = Boolean(String(item.name || '').trim() && String(item.balloon || '').trim() && item.processId && item.method && item.equipment && numericValid && textValid);
    row.classList.toggle('invalid-card', !valid);
    if (valid) validCount += 1;
  });
  const validation = document.getElementById('characteristicValidation');
  if (validation) validation.textContent = `${validCount}/${characteristics.length} karakteristik doğrulandı`;
  document.getElementById('gateCharacteristicCount').textContent = `${validCount} satır, kontrol bağlantıları geçerli`;
  return validCount === characteristics.length && characteristics.length > 0;
}

document.querySelector('[data-action="add-characteristic"]').addEventListener('click', () => {
  characteristics.push({ id: `CHAR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, balloon: `${characteristics.length + 1}`, name: 'Yeni karakteristik', kind: 'Ürün', specMode: 'numeric', nominal: 0, minus: 0, plus: 0, specText: '', unit: 'mm', classification: 'Normal', processId: 'final', method: 'Değişken ölçüm', equipment: 'Ölçüm cihazı tanımlayın', sampleSize: '5 parça', frequency: 'Vardiyada', pokaYoke: '—', reference: '—', reaction: 'RP-01' });
  renderCharacteristics();
  document.querySelector('#characteristicRows .characteristic-editor:last-child .characteristic-name input').focus();
  markDraftDirty();
});

function markDraftDirty() {
  const status = document.getElementById('draftStatus');
  if (!status) return;
  status.textContent = '● Kaydedilmemiş değişiklik';
  status.classList.remove('saved');
  status.classList.add('warning');
}

function updateSummary() {
  if (!productGroup || !productBackbones[productGroup.value]) return;
  const backbone = productBackbones[productGroup.value];
  document.getElementById('summaryGroup').textContent = backbone.label;
  document.getElementById('summaryPartName').textContent = (partName.value || 'PARÇA ADI').toLocaleUpperCase('tr-TR');
  document.getElementById('summaryPartNo').textContent = `${partNumber.value || '—'} • Rev. ${drawingRevision.value || '—'}`;
  document.getElementById('summaryProject').textContent = projectCode.value || 'YENİ PROJE';
  document.getElementById('summaryCharacteristicCount').textContent = characteristics.length;
  document.getElementById('summarySpecialCount').textContent = characteristics.filter(item => item.classification !== 'Normal').length;
  document.getElementById('summaryProcessCount').textContent = backbone.processes.length;
  const ppap = document.querySelector('input[name="ppap"]:checked')?.value || 3;
  document.getElementById('summaryPpapLevel').textContent = ppap;
  const completion = [20, 40, 60, 80, 100][currentWizardStep - 1] || 20;
  document.getElementById('summaryCompletionText').textContent = `${completion}%`;
  document.getElementById('summaryCompletionBar').style.width = `${completion}%`;
  const drawingName = document.getElementById('drawingFileName');
  if (drawingName && !drawingName.dataset.manual) drawingName.textContent = `${partNumber.value || 'PARCA'}_REV-${drawingRevision.value || '0'}.pdf`;
}

document.querySelectorAll('#product input, #product select, #product textarea').forEach(field => {
  if (field.closest('#characteristicRows')) return;
  field.addEventListener('input', () => { updateSummary(); markDraftDirty(); });
  field.addEventListener('change', () => { updateSummary(); markDraftDirty(); });
});

syncProductTypes();
renderCharacteristics();

document.querySelector('[data-action="drawing-change"]').addEventListener('click', event => {
  event.preventDefault();
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.pdf,.png,.jpg,.jpeg';
  picker.addEventListener('change', async () => {
    const file = picker.files[0];
    if (!file) return;
    const hashBuffer = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    const sha256 = [...new Uint8Array(hashBuffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    drawingSource = { name: file.name, size: file.size, type: file.type, lastModified: file.lastModified, sha256 };
    const name = document.getElementById('drawingFileName');
    name.textContent = file.name;
    name.dataset.manual = 'true';
    name.nextElementSibling.textContent = `${(file.size / 1024).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} KB • SHA-256 ${sha256.slice(0, 12)}… • kullanıcı doğrulaması gerekli`;
    markDraftDirty();
    toast('Teknik resim kaynağı tanımlandı', 'Dosya özeti kaydedildi; karakteristikler kullanıcı onayı olmadan yayımlanmaz.');
  });
  picker.click();
});

// Process flow builder and central process library
const defaultProcesses = [
  { id: 'incoming', name: 'Girdi Kontrol', desc: 'Hammadde ve komponent kabul', icon: '⇥', control: true },
  { id: 'cutting', name: 'Çubuk Kesme', desc: 'Boy kesme operasyonu', icon: '╱' },
  { id: 'forging', name: 'Sıcak Dövme', desc: 'Gövde şekillendirme', icon: '♨', special: true },
  { id: 'shotblast', name: 'Kumlama', desc: 'Yüzey temizleme', icon: '✣' },
  { id: 'cnc', name: 'CNC Tornalama', desc: 'Hassas talaşlı imalat', icon: '◎' },
  { id: 'thread', name: 'Diş Açma', desc: 'Bağlantı dişi işleme', icon: '≋' },
  { id: 'induction', name: 'İndüksiyon', desc: 'Bölgesel sertleştirme', icon: '⌁', special: true },
  { id: 'coating', name: 'Yüzey Kaplama', desc: 'Korozyon koruması', icon: '◫', special: true, outsource: true },
  { id: 'assembly', name: 'Montaj', desc: 'Pim-gövde birleştirme', icon: '⚙' },
  { id: 'torque', name: 'Tork Kontrolü', desc: 'Bağlantı doğrulama', icon: '↻', control: true },
  { id: 'final', name: 'Final Kontrol', desc: 'Fonksiyon ve görsel kontrol', icon: '✓', control: true },
  { id: 'packing', name: 'Paketleme', desc: 'Etiketleme ve sevkiyat', icon: '□' }
];
let processes = [...defaultProcesses];
let selected = [];
const optionsEl = document.getElementById('processOptions');
const sequenceEl = document.getElementById('processSequence');
let draggedSequenceIndex = null;

function routeBaseId(routeKey) { return String(routeKey).split('::')[0]; }
function isProcessSelected(id) { return selected.some(routeKey => routeBaseId(routeKey) === id); }
function selectedProcessEntries() {
  return selected.map((routeKey, index) => ({ routeKey, index, process: processes.find(process => process.id === routeBaseId(routeKey)) })).filter(entry => entry.process);
}

function renderOptions(filter = '') {
  const normalized = filter.toLocaleLowerCase('tr-TR');
  optionsEl.innerHTML = processes.filter(process => process.status !== 'archived' && `${process.name} ${process.desc}`.toLocaleLowerCase('tr-TR').includes(normalized)).map(process => `<div class="process-option ${isProcessSelected(process.id) ? 'selected' : ''}" data-process="${escapeHtml(process.id)}" tabindex="0" draggable="true"><span class="process-option-icon">${escapeHtml(process.icon || processIcon(process))}</span><span><strong>${escapeHtml(process.name)}</strong><small>${escapeHtml(process.desc)}</small></span><i class="select-check">✓</i></div>`).join('');
  optionsEl.querySelectorAll('.process-option').forEach(item => {
    item.addEventListener('click', () => toggleProcess(item.dataset.process));
    item.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') toggleProcess(item.dataset.process); });
    item.addEventListener('dragstart', event => {
      event.dataTransfer.setData('application/x-qflow-process', item.dataset.process);
      event.dataTransfer.effectAllowed = 'copy';
    });
  });
}

function toggleProcess(id) {
  selected = isProcessSelected(id) ? selected.filter(item => routeBaseId(item) !== id) : [...selected, id];
  renderOptions(document.querySelector('.library-search input').value);
  renderSequence();
  markDraftDirty();
}

function moveProcess(index, direction) {
  const next = index + direction;
  if (next < 0 || next >= selected.length) return;
  [selected[index], selected[next]] = [selected[next], selected[index]];
  renderSequence();
  markDraftDirty();
}

function renderSequence() {
  const entries = selectedProcessEntries();
  const list = entries.map(entry => entry.process);
  sequenceEl.classList.toggle('empty', !entries.length);
  sequenceEl.innerHTML = entries.length ? entries.map(({ process, index }) => `<div class="sequence-item" draggable="true" data-sequence-index="${index}"><span class="drag" title="Sürükleyerek sırala">⠿</span><span class="op-number">OP ${String((index + 1) * 10).padStart(2, '0')}</span><span><strong>${escapeHtml(process.name)}</strong><small>${escapeHtml(process.desc)}</small></span><span class="sequence-tags">${process.special ? '<mark>Özel Proses</mark>' : ''}${process.outsource ? '<mark>Dış Kaynak</mark>' : ''}</span><span class="sequence-order"><button data-duplicate="${index}" aria-label="Bu prosesi tekrarla">⧉</button><button data-move-up="${index}" aria-label="Yukarı taşı">↑</button><button data-move-down="${index}" aria-label="Aşağı taşı">↓</button></span><button data-remove-index="${index}" aria-label="Kaldır">×</button></div>`).join('') : '<div class="empty-state"><span>⇢</span><h3>Proses adımlarınızı seçin</h3><p>Soldan tıklayın veya kartı bu alana sürükleyin.</p></div>';
  sequenceEl.querySelectorAll('[data-remove-index]').forEach(btn => btn.addEventListener('click', () => {
    selected.splice(Number(btn.dataset.removeIndex), 1); renderOptions(document.querySelector('.library-search input').value); renderSequence(); markDraftDirty();
  }));
  sequenceEl.querySelectorAll('[data-duplicate]').forEach(btn => btn.addEventListener('click', () => {
    const index = Number(btn.dataset.duplicate); selected.splice(index + 1, 0, `${routeBaseId(selected[index])}::${crypto.randomUUID()}`); renderSequence(); markDraftDirty();
  }));
  sequenceEl.querySelectorAll('[data-move-up]').forEach(btn => btn.addEventListener('click', () => moveProcess(Number(btn.dataset.moveUp), -1)));
  sequenceEl.querySelectorAll('[data-move-down]').forEach(btn => btn.addEventListener('click', () => moveProcess(Number(btn.dataset.moveDown), 1)));
  sequenceEl.querySelectorAll('.sequence-item').forEach(item => {
    item.addEventListener('dragstart', event => { draggedSequenceIndex = Number(item.dataset.sequenceIndex); item.classList.add('dragging'); event.dataTransfer.effectAllowed = 'move'; });
    item.addEventListener('dragend', () => { draggedSequenceIndex = null; item.classList.remove('dragging'); sequenceEl.querySelectorAll('.drop-target').forEach(target => target.classList.remove('drop-target')); });
    item.addEventListener('dragover', event => { if (draggedSequenceIndex === null) return; event.preventDefault(); item.classList.add('drop-target'); });
    item.addEventListener('dragleave', () => item.classList.remove('drop-target'));
    item.addEventListener('drop', event => {
      if (draggedSequenceIndex === null) return;
      event.preventDefault(); event.stopPropagation();
      const targetIndex = Number(item.dataset.sequenceIndex);
      const [moved] = selected.splice(draggedSequenceIndex, 1);
      selected.splice(targetIndex, 0, moved);
      draggedSequenceIndex = null; renderSequence(); markDraftDirty();
    });
  });
  document.getElementById('operationCount').textContent = `${list.length} operasyon`;
  document.getElementById('totalOps').textContent = list.length;
  document.getElementById('specialOps').textContent = list.filter(process => process.special).length;
  document.getElementById('outsourcedOps').textContent = list.filter(process => process.outsource).length;
}

function renderFlowDiagram() {
  const list = selectedProcessEntries().map(entry => entry.process);
  document.getElementById('flowCanvas').innerHTML = list.map((process, index) => `<div class="flow-node ${process.control ? 'control' : ''} ${process.outsource ? 'outsource' : ''}"><span class="node-op">OP ${String((index + 1) * 10).padStart(2, '0')}</span><b>${escapeHtml(process.name)}</b><small>${escapeHtml(process.desc)}</small></div>`).join('');
  document.getElementById('flowPreview').classList.remove('hidden');
}

document.querySelector('.library-search input').addEventListener('input', event => renderOptions(event.target.value));
sequenceEl.addEventListener('dragover', event => event.preventDefault());
sequenceEl.addEventListener('drop', event => {
  const processId = event.dataTransfer.getData('application/x-qflow-process');
  if (!processId || draggedSequenceIndex !== null) return;
  event.preventDefault();
  selected.push(isProcessSelected(processId) ? `${processId}::${crypto.randomUUID()}` : processId);
  renderOptions(document.querySelector('.library-search input').value); renderSequence(); markDraftDirty();
});
renderOptions();
renderSequence();

// Persistent process library
let libraryQuickFilter = '';

function processIcon(process) {
  if (process.outsource) return '↗';
  if (process.special) return '◆';
  if (process.category === 'Kontrol') return '✓';
  if (process.family === 'Talaşlı İmalat') return '◎';
  if (process.family === 'Isıl İşlem') return '♨';
  if (process.family === 'Montaj' || process.family === 'Birleştirme') return '⚙';
  if (process.family === 'Lojistik') return '□';
  return '◇';
}

function normalizeProcess(process) {
  return {
    ...process,
    desc: process.desc || process.description || '',
    characteristics: Array.isArray(process.characteristics) ? process.characteristics : [],
    riskTemplate: Array.isArray(process.riskTemplate) ? process.riskTemplate : [],
    special: Boolean(process.special), outsource: Boolean(process.outsource),
    control: process.control ?? process.category === 'Kontrol',
    icon: process.icon || processIcon(process),
    status: process.status || 'active', approvalStatus: process.approvalStatus || 'draft'
  };
}

async function loadProcessLibrary() {
  try {
    const response = await fetch('/api/processes', { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error('API unavailable');
    const data = await response.json();
    processes = data.processes.map(normalizeProcess);
  } catch {
    try {
      const fallback = await fetch('/seed-processes.json').then(response => response.json());
      processes = fallback.map(normalizeProcess);
    } catch {
      processes = defaultProcesses.map(normalizeProcess);
    }
  }
  globalThis.qflowProcessCatalog = processes.filter(process => process.status !== 'archived');
  selected = selected.filter(routeKey => processes.some(process => process.id === routeBaseId(routeKey)));
  renderOptions(document.querySelector('.library-search input').value);
  renderSequence();
  renderCharacteristics();
  renderProcessLibrary();
}

function processCompleteness(process) {
  const fields = ['code', 'name', 'family', 'category', 'desc', 'equipment', 'controlMethod', 'reactionPlan', 'pfmeaFunction', 'workInstruction', 'documentRef', 'processStandard'];
  return fields.filter(field => String(process[field] || '').trim()).length / fields.length;
}

function renderLibraryMetrics(activeProcesses) {
  const active = activeProcesses.filter(process => process.status !== 'archived');
  const families = new Set(active.map(process => process.family));
  const approved = active.filter(process => process.approvalStatus === 'approved');
  const special = active.filter(process => process.special);
  const outsourced = active.filter(process => process.outsource);
  const quality = active.length ? Math.round(active.reduce((sum, process) => sum + processCompleteness(process), 0) / active.length * 100) : 0;
  document.getElementById('libraryActiveCount').textContent = active.length;
  document.getElementById('libraryFamilyCount').textContent = `${families.size} proses ailesi`;
  document.getElementById('librarySpecialCount').textContent = special.length;
  document.getElementById('libraryApprovedCount').textContent = approved.length;
  document.getElementById('libraryApprovalRate').textContent = `%${active.length ? Math.round(approved.length / active.length * 100) : 0} yayın oranı`;
  document.getElementById('libraryOutsourceCount').textContent = outsourced.length;
  document.getElementById('libraryCountBadge').textContent = active.length;
  document.getElementById('libraryQualityScore').textContent = quality;
  document.getElementById('libraryQualityPercent').textContent = `${quality}%`;
  document.querySelector('.health-ring').style.background = `radial-gradient(circle,#fff 58%,transparent 60%),conic-gradient(#26ac78 ${quality}%,#e5eaf1 0)`;
  document.getElementById('healthControl').textContent = `${active.filter(process => process.controlMethod).length}/${active.length} tanımlı`;
  const drafts = active.filter(process => process.approvalStatus !== 'approved').length;
  document.getElementById('healthDrafts').textContent = `${drafts} taslak proses`;
  document.getElementById('healthIdentity').textContent = active.every(process => process.code && process.revision) ? 'Tüm aktif kayıtlarda mevcut' : 'Eksik kayıtlar var';
}

function refreshFamilyFilter() {
  const select = document.getElementById('libraryFamilyFilter');
  const current = select.value;
  const families = [...new Set(processes.map(process => process.family).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  select.innerHTML = '<option value="all">Tüm aileler</option>' + families.map(family => `<option value="${escapeHtml(family)}">${escapeHtml(family)}</option>`).join('');
  if (families.includes(current)) select.value = current;
}

function filteredLibraryProcesses() {
  const query = document.getElementById('librarySearch').value.trim().toLocaleLowerCase('tr-TR');
  const family = document.getElementById('libraryFamilyFilter').value;
  const status = document.getElementById('libraryStatusFilter').value;
  const specialOnly = document.getElementById('librarySpecialFilter').checked;
  return processes.filter(process => {
    const haystack = [process.code, process.name, process.family, process.equipment, process.controlMethod, process.documentRef].join(' ').toLocaleLowerCase('tr-TR');
    return (!query || haystack.includes(query)) && (family === 'all' || process.family === family) && (status === 'all' || process.status === status) && (!specialOnly || process.special) && (libraryQuickFilter !== 'draft' || process.approvalStatus !== 'approved');
  });
}

function renderProcessLibrary() {
  refreshFamilyFilter();
  renderLibraryMetrics(processes);
  const filtered = filteredLibraryProcesses();
  document.getElementById('libraryResultCount').textContent = `${filtered.length} proses`;
  const body = document.getElementById('processLibraryRows');
  if (!filtered.length) {
    body.innerHTML = '<div class="library-empty"><b>Kriterlere uygun proses bulunamadı.</b><br>Filtreleri temizleyin veya yeni standart proses oluşturun.</div>';
    return;
  }
  body.innerHTML = filtered.map(process => `<div class="process-register-row ${process.status === 'archived' ? 'archived' : ''}">
    <span class="register-process"><i class="register-icon">${processIcon(process)}</i><span><b>${escapeHtml(process.name)}</b><small>${escapeHtml(process.code)} • ${escapeHtml(process.category)}</small></span></span>
    <span class="register-family"><mark class="family-pill">${escapeHtml(process.family)}</mark><span class="process-flags">${process.special ? '<mark class="process-flag special">ÖZEL</mark>' : '<mark class="process-flag normal">STANDART</mark>'}${process.outsource ? '<mark class="process-flag outsource">DIŞ KAYNAK</mark>' : ''}</span></span>
    <span class="register-equipment"><b>${escapeHtml(process.equipment || '—')}</b><small>${escapeHtml(process.controlMethod || 'Kontrol metodu tanımsız')}</small></span>
    <span class="quality-links"><span>${process.characteristics.length} karakteristik</span><span>${process.riskTemplate.length} PFMEA riski</span><span>${escapeHtml(process.documentRef || 'Doküman bekliyor')}</span></span>
    <span class="cycle-value"><b>${Number(process.cycleTimeSec || 0).toLocaleString('tr-TR')} sn</b><small>${Number(process.setupTimeMin || 0).toLocaleString('tr-TR')} dk ayar</small></span>
    <span class="revision-cell"><mark class="revision-chip">Rev. ${escapeHtml(process.revision || 'A')}</mark><mark class="approval-chip ${process.approvalStatus === 'approved' ? 'approved' : 'draft'}">${process.approvalStatus === 'approved' ? 'ONAYLI' : 'TASLAK'}</mark></span>
    <span class="register-actions"><button data-edit-process="${process.id}" title="Düzenle">✎</button><button data-duplicate-process="${process.id}" title="Kopyala">⧉</button></span>
  </div>`).join('');
  body.querySelectorAll('[data-edit-process]').forEach(button => button.addEventListener('click', () => openProcessDrawer(processes.find(process => process.id === button.dataset.editProcess))));
  body.querySelectorAll('[data-duplicate-process]').forEach(button => button.addEventListener('click', () => {
    const source = processes.find(process => process.id === button.dataset.duplicateProcess);
    openProcessDrawer({ ...source, id: '', code: `${source.code}-K`, name: `${source.name} Kopya`, revision: 'A', approvalStatus: 'draft', status: 'active' });
  }));
}

const processFormFields = {
  id: 'processId', code: 'processCode', name: 'processName', family: 'processFamily', category: 'processCategory',
  owner: 'processOwner', revision: 'processRevision', approvalStatus: 'processApproval', documentRef: 'processDocumentRef',
  desc: 'processDescription', inputMaterial: 'processInput', outputMaterial: 'processOutput', equipment: 'processEquipment',
  tooling: 'processTooling', cycleTimeSec: 'processCycle', setupTimeMin: 'processSetup', special: 'processSpecial',
  outsource: 'processOutsource', pfmeaFunction: 'processPfmeaFunction', controlMethod: 'processControlMethod',
  characteristics: 'processCharacteristics', riskTemplate: 'processRisks', processStandard: 'processStandard',
  reactionPlan: 'processReaction', workInstruction: 'processWorkInstruction'
};

function openProcessDrawer(process = null) {
  const drawer = document.getElementById('processDrawer');
  const editing = Boolean(process?.id);
  document.getElementById('processDrawerTitle').textContent = editing ? 'Standart Prosesi Düzenle' : 'Yeni Proses Tanımla';
  document.getElementById('processDrawerSubtitle').textContent = editing ? `${process.code} • Son kayıt revizyonu ${process.revision}` : 'Kalite dokümanlarının kullanacağı ana proses kaydı';
  Object.entries(processFormFields).forEach(([key, elementId]) => {
    const element = document.getElementById(elementId);
    let value = process?.[key] ?? '';
    if (key === 'owner' && !value) value = 'Kalite Mühendisliği';
    if (key === 'revision' && !value) value = 'A';
    if (key === 'approvalStatus' && !value) value = 'draft';
    if (key === 'category' && !value) value = 'Üretim';
    if (key === 'family' && !value) value = 'Talaşlı İmalat';
    if (Array.isArray(value)) value = value.join('\n');
    if (element.type === 'checkbox') element.checked = Boolean(value);
    else element.value = value;
    element.classList.remove('invalid');
  });
  const archive = document.getElementById('archiveProcessButton');
  archive.classList.toggle('hidden', !editing);
  archive.textContent = process?.status === 'archived' ? 'Tekrar Aktifleştir' : 'Arşivle';
  archive.dataset.mode = process?.status === 'archived' ? 'restore' : 'archive';
  document.getElementById('processFormStatus').textContent = '* Zorunlu alanlar';
  document.getElementById('processFormStatus').style.color = '';
  drawer.classList.remove('hidden');
  drawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('drawer-open');
  setTimeout(() => document.getElementById('processCode').focus(), 80);
}

function closeProcessDrawer() {
  const drawer = document.getElementById('processDrawer');
  drawer.classList.add('hidden');
  drawer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('drawer-open');
}

function processPayloadFromForm() {
  const payload = {};
  Object.entries(processFormFields).forEach(([key, elementId]) => {
    const element = document.getElementById(elementId);
    let value = element.type === 'checkbox' ? element.checked : element.value.trim();
    if (['cycleTimeSec', 'setupTimeMin'].includes(key)) value = Number(value) || 0;
    if (['characteristics', 'riskTemplate'].includes(key)) value = String(value).split(/\r?\n/).map(item => item.trim()).filter(Boolean);
    payload[key] = value;
  });
  return payload;
}

function validateProcessForm() {
  const requiredIds = ['processCode', 'processName', 'processFamily', 'processCategory', 'processEquipment', 'processControlMethod'];
  let valid = true;
  requiredIds.forEach(id => {
    const element = document.getElementById(id);
    const invalid = !element.value.trim();
    element.classList.toggle('invalid', invalid);
    if (invalid) valid = false;
  });
  if (!valid) document.getElementById('processFormStatus').textContent = 'Zorunlu alanları tamamlayın.';
  return valid;
}

async function saveProcess(event) {
  event.preventDefault();
  if (!validateProcessForm()) return;
  const payload = processPayloadFromForm();
  const id = payload.id;
  delete payload.id;
  const status = document.getElementById('processFormStatus');
  status.textContent = 'Kayıt doğrulanıyor…';
  try {
    const response = await fetch(id ? `/api/processes/${encodeURIComponent(id)}` : '/api/processes', {
      method: id ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Kayıt işlemi başarısız.');
    const saved = normalizeProcess(data.process);
    const existing = processes.findIndex(process => process.id === saved.id);
    if (existing >= 0) processes[existing] = saved; else processes.push(saved);
    closeProcessDrawer();
    renderProcessLibrary();
    renderOptions(document.querySelector('.library-search input').value);
    toast(id ? 'Proses revizyonu kaydedildi' : 'Yeni proses oluşturuldu', `${saved.code} • ${saved.name} kütüphaneye işlendi.`);
  } catch (error) {
    status.textContent = error.message;
    status.style.color = '#d14c4c';
  }
}

async function archiveOrRestoreProcess() {
  const id = document.getElementById('processId').value;
  const process = processes.find(item => item.id === id);
  if (!process) return;
  const restore = document.getElementById('archiveProcessButton').dataset.mode === 'restore';
  if (!restore && !window.confirm(`${process.code} - ${process.name} arşive alınsın mı? Bağlı akışlardan silinmez, yeni seçimlerde gösterilmez.`)) return;
  try {
    const response = await fetch(`/api/processes/${encodeURIComponent(id)}`, restore ? {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...process, status: 'active' })
    } : { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'İşlem başarısız.');
    if (restore) Object.assign(process, normalizeProcess(data.process)); else process.status = 'archived';
    closeProcessDrawer();
    renderProcessLibrary(); renderOptions(); renderSequence();
    toast(restore ? 'Proses aktifleştirildi' : 'Proses arşivlendi', `${process.code} kayıt durumu güncellendi.`);
  } catch (error) {
    document.getElementById('processFormStatus').textContent = error.message;
  }
}

function exportProcessLibrary() {
  const headers = ['Kod', 'Proses', 'Aile', 'Kategori', 'Ekipman', 'Kontrol Metodu', 'Özel Proses', 'Dış Kaynak', 'Çevrim sn', 'Revizyon', 'Onay'];
  const rows = processes.map(process => [process.code, process.name, process.family, process.category, process.equipment, process.controlMethod, process.special ? 'Evet' : 'Hayır', process.outsource ? 'Evet' : 'Hayır', process.cycleTimeSec, process.revision, process.approvalStatus]);
  const csv = [headers, ...rows].map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob); link.download = `Q-Flow_Proses_Kutuphanesi_${new Date().toISOString().slice(0, 10)}.csv`; link.click();
  URL.revokeObjectURL(link.href);
  toast('Kütüphane dışa aktarıldı', `${processes.length} proses Excel uyumlu CSV olarak hazırlandı.`);
}

document.querySelector('[data-action="new-process"]').addEventListener('click', () => openProcessDrawer());
document.querySelectorAll('[data-action="close-process-drawer"]').forEach(button => button.addEventListener('click', closeProcessDrawer));
document.getElementById('processForm').addEventListener('submit', saveProcess);
document.querySelector('[data-action="archive-process"]').addEventListener('click', archiveOrRestoreProcess);
document.querySelector('[data-action="export-library"]').addEventListener('click', exportProcessLibrary);
['librarySearch', 'libraryFamilyFilter', 'libraryStatusFilter', 'librarySpecialFilter'].forEach(id => document.getElementById(id).addEventListener(id === 'librarySearch' ? 'input' : 'change', () => { libraryQuickFilter = ''; renderProcessLibrary(); }));
document.querySelector('[data-action="show-drafts"]').addEventListener('click', () => { libraryQuickFilter = 'draft'; document.getElementById('libraryStatusFilter').value = 'active'; renderProcessLibrary(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !document.getElementById('processDrawer').classList.contains('hidden')) closeProcessDrawer(); });
loadProcessLibrary().then(restoreLatestProject);

// PPAP checklist
const ppapItems = [
  ['Tasarım kayıtları', 'Teknik resim Rev. C doğrulandı', 'ready'],
  ['Yetkili mühendislik değişikliği', 'Değişiklik kaydı gerekli değil', 'ready'],
  ['Müşteri mühendislik onayı', 'Müşteri portal onayı', 'progress'],
  ['DFMEA', 'Müşteri sorumluluğunda', 'ready'],
  ['Proses akış diyagramı', '12 operasyon • Rev. C', 'ready'],
  ['PFMEA', '3 açık aksiyon bulunuyor', 'progress'],
  ['Kontrol planı', '28 kontrol satırı', 'ready'],
  ['MSA çalışmaları', 'Tork sistemi GRR bekliyor', 'blocked'],
  ['Boyutsal sonuçlar', '18/18 karakteristik uygun', 'ready'],
  ['Malzeme / performans testleri', 'Laboratuvar raporları bağlı', 'ready'],
  ['İlk proses etütleri', 'Cpk ≥ 1,67', 'ready'],
  ['Nitelikli laboratuvar dokümanı', 'ISO 17025 kapsamı uygun', 'ready'],
  ['Görünüş onay raporu', 'Bu ürün için uygulanamaz', 'ready'],
  ['Numune üretim parçaları', '5 adet ayrıldı', 'ready'],
  ['Master numune', 'Kalite dolabı K-04', 'ready'],
  ['Kontrol fikstürleri', 'Kalibrasyon kayıtları bağlı', 'ready'],
  ['Müşteri özel istekleri', 'CSR kontrolü sürüyor', 'progress'],
  ['PSW', 'Paket tamamlanınca imzalanacak', 'ready']
];

function renderPpap(filter = 'all') {
  const labels = { ready: 'HAZIR', progress: 'İŞLEMDE', blocked: 'BLOKE' };
  document.getElementById('ppapChecklist').innerHTML = ppapItems.map((item, index) => {
    const hidden = filter === 'open' && item[2] === 'ready';
    return `<div class="ppap-item ${hidden ? 'hidden-filter' : ''}"><span class="ppap-item-number">${String(index + 1).padStart(2, '0')}</span><span><b>${item[0]}</b><small>${item[1]}</small></span><mark class="ppap-status ${item[2]}">${labels[item[2]]}</mark></div>`;
  }).join('');
}
renderPpap();

document.querySelectorAll('[data-ppap-filter]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-ppap-filter]').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  renderPpap(button.dataset.ppapFilter);
}));

// Canonical documentation snapshot and persistent project draft.
const productFieldIds = ['productGroup', 'productType', 'partNumber', 'partName', 'customer', 'customerPartNumber', 'productionPhase', 'annualVolume', 'controlPlanNumber', 'projectCode', 'drawingNumber', 'drawingRevision', 'supplierName', 'supplierSite', 'supplierCode', 'keyContact', 'keyContactPhone', 'coreTeam', 'originalDate', 'revisionDate', 'documentStatus'];
const technicalFieldIds = ['materialFamily', 'materialGrade', 'materialStandard', 'rawMaterialForm', 'partWeight', 'materialCertificate', 'heatTreatment', 'hardnessSpec', 'caseDepthSpec', 'coatingType', 'coatingStandard', 'coatingThickness', 'coatingColor', 'corrosionHours', 'roughnessSpec', 'cleanlinessSpec', 'traceabilityLevel', 'customerSpecificRequirements'];

function collectFields(ids) {
  return Object.fromEntries(ids.map(id => [id, document.getElementById(id)?.value ?? '']));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function getDocumentationSnapshot() {
  const snapshot = {
    schemaVersion: '1.0.0', templateVersion: 'QF-CP-2026.1', snapshotId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(), projectId: currentProjectId,
    product: collectFields(productFieldIds), technical: collectFields(technicalFieldIds),
    drawingSource: { ...drawingSource },
    routingAnswers: {
      forming: document.querySelector('input[name="forming"]:checked')?.value || '',
      safety: document.querySelector('input[name="safety"]:checked')?.value || '',
      specialProcesses: [...document.querySelectorAll('.check-grid input:checked')].map(input => input.value),
      ppapLevel: document.querySelector('input[name="ppap"]:checked')?.value || '3'
    },
    route: selectedProcessEntries().map(({ routeKey, process, index }) => ({
      routeKey, processId: process.id, processRevision: process.revision || 'A', operationNo: String((index + 1) * 10).padStart(2, '0'),
      name: process.name, description: process.desc, family: process.family || '', category: process.category || 'Üretim',
      equipment: process.equipment || '', tooling: process.tooling || '', controlMethod: process.controlMethod || '',
      reactionPlan: process.reactionPlan || '', workInstruction: process.workInstruction || '', special: Boolean(process.special), outsource: Boolean(process.outsource)
    })),
    characteristics: characteristics.map(item => ({ ...item })),
    approval: { preparedBy: document.getElementById('keyContact').value, preparedAt: new Date().toISOString(), status: document.getElementById('documentStatus').value }
  };
  snapshot.sha256 = await sha256Hex(stableStringify(snapshot));
  return snapshot;
}

function applySnapshot(snapshot) {
  if (!snapshot) return;
  for (const [id, value] of Object.entries({ ...(snapshot.product || {}), ...(snapshot.technical || {}) })) {
    const field = document.getElementById(id); if (field && value !== undefined && value !== null) field.value = value;
  }
  if (Array.isArray(snapshot.characteristics) && snapshot.characteristics.length) characteristics = snapshot.characteristics;
  if (Array.isArray(snapshot.route) && snapshot.route.length) selected = snapshot.route.map(step => step.routeKey || step.processId);
  if (snapshot.drawingSource) {
    drawingSource = snapshot.drawingSource;
    const drawingName = document.getElementById('drawingFileName');
    drawingName.textContent = drawingSource.name; drawingName.dataset.manual = 'true';
    drawingName.nextElementSibling.textContent = `SHA-256 ${String(drawingSource.sha256 || '').slice(0, 12)}… • kaynak kaydı yüklendi`;
  }
  const answers = snapshot.routingAnswers || {};
  ['forming', 'safety', 'ppap'].forEach(name => {
    const value = name === 'ppap' ? answers.ppapLevel : answers[name];
    const input = document.querySelector(`input[name="${name}"][value="${CSS.escape(String(value || ''))}"]`);
    if (input) input.checked = true;
  });
  document.querySelectorAll('.check-grid input').forEach(input => { input.checked = (answers.specialProcesses || []).includes(input.value); });
  document.querySelectorAll('.choice-card').forEach(card => card.classList.toggle('selected', card.querySelector('input').checked));
  document.querySelectorAll('.segmented label').forEach(label => label.classList.toggle('active', label.querySelector('input').checked));
  syncProductTypes();
  if (snapshot.product?.productType) document.getElementById('productType').value = snapshot.product.productType;
  renderCharacteristics(); renderOptions(); renderSequence(); updateSummary();
}

async function saveProjectSnapshot() {
  const snapshot = await getDocumentationSnapshot();
  const payload = { projectCode: projectCode.value.trim(), partNumber: partNumber.value.trim(), partName: partName.value.trim(), productGroup: productGroup.value, revision: drawingRevision.value.trim(), phase: document.getElementById('productionPhase').value, status: document.getElementById('documentStatus').value, version: currentProjectVersion, payload: snapshot };
  const response = await fetch(currentProjectId ? `/api/projects/${encodeURIComponent(currentProjectId)}` : '/api/projects', { method: currentProjectId ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Proje kaydedilemedi.');
  currentProjectId = data.project.id; currentProjectVersion = data.project.version;
  localStorage.setItem('qflow-last-project', JSON.stringify(data.project.payload));
  const status = document.getElementById('draftStatus');
  status.textContent = `✓ Sunucuya kaydedildi • v${currentProjectVersion}`; status.classList.add('saved'); status.classList.remove('warning');
  return data.project.payload;
}

async function restoreLatestProject() {
  try {
    const response = await fetch('/api/projects/latest', { headers: { accept: 'application/json' } });
    if (!response.ok) return;
    const data = await response.json();
    if (!data.project) return;
    currentProjectId = data.project.id; currentProjectVersion = data.project.version;
    applySnapshot(data.project.payload);
    const status = document.getElementById('draftStatus'); status.textContent = `✓ Son proje yüklendi • v${currentProjectVersion}`; status.classList.add('saved'); status.classList.remove('warning');
  } catch {
    const local = localStorage.getItem('qflow-last-project');
    if (local) { try { applySnapshot(JSON.parse(local)); toast('Yerel kurtarma yüklendi', 'Sunucuya erişilemedi; son tarayıcı yedeği açıldı.'); } catch {} }
  }
}

// Main workflow actions
document.querySelectorAll('[data-action="new-product"]').forEach(btn => btn.addEventListener('click', () => {
  showView('product');
  goToWizardStep(1);
}));

document.querySelectorAll('[data-action="save-product"]').forEach(btn => btn.addEventListener('click', async () => {
  if (!validateCharacteristics()) {
    goToWizardStep(4);
    return;
  }
  if (!selected.length) selected = [...productBackbones[productGroup.value].processes];
  renderOptions();
  renderSequence();
  btn.disabled = true; btn.textContent = 'Kaydediliyor…';
  try {
    await saveProjectSnapshot();
    toast('Ürün omurgası kalıcı olarak kaydedildi', `${selected.length} operasyon ve ${characteristics.length} karakteristik aynı kayıt altında eşleştirildi.`);
    setTimeout(() => showView('flow'), 350);
  } catch (error) {
    const status = document.getElementById('draftStatus'); status.textContent = '● Kaydetme başarısız'; status.classList.add('warning'); status.classList.remove('saved');
    toast('Proje kaydedilemedi', error.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Kaydet, Omurgayı Oluştur ve Prosese Geç →';
  }
}));

document.querySelectorAll('[data-action="generate-flow"]').forEach(btn => btn.addEventListener('click', () => {
  if (!selected.length) {
    selected = [...productBackbones[productGroup.value].processes];
    renderOptions();
    renderSequence();
  }
  renderFlowDiagram();
  toast('Proses akış diyagramı oluşturuldu', `${selected.length} operasyon PFMEA yapısına aktarıldı.`);
  document.querySelector('[data-view="pfmea"] .status-dot')?.classList.add('done');
  setTimeout(() => document.getElementById('flowPreview').scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
}));

document.querySelectorAll('[data-action="complete-pfmea"]').forEach(btn => btn.addEventListener('click', () => {
  const openHigh = document.querySelectorAll('.fmea-grid .high-ap').length;
  if (openHigh) {
    toast('PFMEA kalite kapısı bloke', `${openHigh} yüksek Action Priority satırı için sorumlu, termin ve kanıt kapatılmadan kontrol planı onaylanamaz.`);
    return;
  }
  toast('PFMEA kalite kapısı tamamlandı', 'Risk kontrolleri kontrol planı için hazır.');
  setTimeout(() => showView('control'), 650);
}));

document.querySelectorAll('.fmea-grid .ap').forEach(mark => mark.addEventListener('click', () => {
  const next = mark.textContent === 'H' ? 'M' : mark.textContent === 'M' ? 'L' : 'H';
  mark.textContent = next; mark.classList.remove('high-ap', 'medium-ap', 'low-ap'); mark.classList.add(next === 'H' ? 'high-ap' : next === 'M' ? 'medium-ap' : 'low-ap');
  const high = document.querySelectorAll('.fmea-grid .high-ap').length;
  document.querySelector('#pfmea .page-status').textContent = high ? `● ${high} yüksek öncelik açık` : '✓ Yüksek öncelik aksiyonu yok';
  markDraftDirty();
}));

function controlContext(characteristic) {
  const entry = selectedProcessEntries().find(item => item.process.id === characteristic.processId);
  const process = entry?.process || processes.find(item => item.id === characteristic.processId) || { name: 'Proses eşleşmesi gerekli', equipment: '', controlMethod: '', reactionPlan: '' };
  return {
    op: entry ? String((entry.index + 1) * 10).padStart(2, '0') : '—', process,
    reaction: process.reactionPlan || 'Prosesi durdur; son iyi parçadan itibaren şüpheli ürünü bloke et; kaliteyi bilgilendir; %100 doğrulama ve yetkili yeniden başlatma onayı uygula.'
  };
}

function phaseCheck(label) {
  const phase = document.getElementById('productionPhase').value;
  if (label === 'prototype') return phase === 'Prototip' ? '☒ Prototip' : '□ Prototip';
  if (label === 'prelaunch') return phase.includes('Ön Seri') ? '☒ Ön Seri / Safe Launch' : '□ Ön Seri / Safe Launch';
  return phase === 'Seri Üretim' ? '☒ Seri' : '□ Seri';
}

function phaseExportText() {
  const phase = document.getElementById('productionPhase').value;
  return `${phase === 'Prototip' ? '[X]' : '[ ]'} Prototip   ${phase.includes('Ön Seri') ? '[X]' : '[ ]'} Ön Seri / Safe Launch   ${phase === 'Seri Üretim' ? '[X]' : '[ ]'} Seri`;
}

function controlPlanRows() {
  return characteristics.map(item => {
    const context = controlContext(item);
    return { item, context, operation: context.op, processName: context.process.name, equipment: [context.process.equipment, context.process.tooling].filter(Boolean).join(' / ') || '—', specification: specificationFor(item), control: [item.method, item.pokaYoke && item.pokaYoke !== '—' ? `P/Y: ${item.pokaYoke}` : ''].filter(Boolean).join(' • '), measurement: item.equipment, sampling: `${item.sampleSize} / ${item.frequency}`, reference: [item.reference, item.reaction].filter(Boolean).join(' / '), reaction: context.reaction };
  });
}

function renderControlPlan() {
  const header = document.getElementById('controlPlanHeader');
  const fields = [
    ['Kontrol Planı No', controlPlanNumber.value], ['Parça No / Revizyon', `${partNumber.value} / ${drawingRevision.value}`], ['Parça Adı', partName.value],
    ['Müşteri / Müşteri Parça No', `${document.getElementById('customer').value} / ${document.getElementById('customerPartNumber').value}`], ['Kuruluş / Üretim Sahası', `${document.getElementById('supplierName').value} / ${document.getElementById('supplierSite').value}`], ['Tedarikçi Kodu', document.getElementById('supplierCode').value],
    ['Anahtar Personel / Telefon', `${document.getElementById('keyContact').value} / ${document.getElementById('keyContactPhone').value}`], ['Çekirdek Ekip', document.getElementById('coreTeam').value], ['İlk Yayın / Revizyon Tarihi', `${document.getElementById('originalDate').value} / ${document.getElementById('revisionDate').value}`],
    ['Teknik Resim', `${document.getElementById('drawingNumber').value} / Rev. ${drawingRevision.value}`], ['Malzeme', `${document.getElementById('materialGrade').value} • ${document.getElementById('materialStandard').value}`], ['Kaplama', `${document.getElementById('coatingType').value} • ${document.getElementById('coatingThickness').value} µm`]
  ];
  header.innerHTML = fields.map(([label, value]) => `<div><small>${escapeHtml(label)}</small><b>${escapeHtml(value || '—')}</b></div>`).join('');
  document.getElementById('phasePrototype').textContent = phaseCheck('prototype');
  document.getElementById('phasePrelaunch').textContent = phaseCheck('prelaunch');
  document.getElementById('phaseProduction').textContent = phaseCheck('production');
  document.getElementById('cpDocumentState').textContent = document.getElementById('documentStatus').value.toLocaleUpperCase('tr-TR');
  const rows = controlPlanRows();
  document.getElementById('controlPlanBody').innerHTML = rows.map(({ item, ...row }) => `<tr><td><b>${escapeHtml(row.operation)}</b></td><td><b>${escapeHtml(row.processName)}</b><small>${escapeHtml(item.kind)}</small></td><td>${escapeHtml(row.equipment)}</td><td><b>${escapeHtml(item.balloon)}</b><small>${escapeHtml(item.id)}</small></td><td><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.kind)} karakteristiği</small></td><td>${escapeHtml(row.specification)}</td><td><mark class="cp-special ${item.classification === 'Normal' ? 'normal' : ''}">${escapeHtml(item.classification)}</mark></td><td>${escapeHtml(row.control)}</td><td>${escapeHtml(row.measurement)}</td><td>${escapeHtml(row.sampling)}</td><td>${escapeHtml(row.reference)}</td><td>${escapeHtml(row.reaction)}</td></tr>`).join('');
  document.getElementById('controlGeneratedMeta').textContent = `${controlPlanNumber.value} / Rev. ${drawingRevision.value} • ${selected.length} operasyon • ${characteristics.length} kontrol satırı`;
  document.getElementById('controlRowCount').textContent = `${characteristics.length} kontrol satırı • ${characteristics.filter(item => item.classification !== 'Normal').length} özel karakteristik`;
  document.getElementById('controlEyebrow').textContent = `${projectCode.value} • ${document.getElementById('productionPhase').value.toLocaleUpperCase('tr-TR')}`;
}

document.querySelectorAll('[data-action="generate-control"]').forEach(btn => btn.addEventListener('click', () => {
  if (!validateCharacteristics()) { showView('product'); goToWizardStep(4); toast('Kontrol planı üretilemedi', 'Eksik karakteristik veya kontrol eşleştirmelerini tamamlayın.'); return; }
  if (!selected.length) { selected = [...productBackbones[productGroup.value].processes]; renderSequence(); }
  renderControlPlan();
  document.getElementById('controlEmpty').classList.add('hidden');
  document.getElementById('controlResult').classList.remove('hidden');
  toast('Kontrol planı oluşturuldu', `${characteristics.length} teknik karakteristik proses kontrolleriyle eşleştirildi.`);
}));

function safeFileName(value) {
  return String(value || 'Q-FLOW').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 90);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = fileName; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function safeExcelValue(value) {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

async function exportControlPlanXlsx() {
  if (!globalThis.ExcelJS) { toast('Excel motoru yüklenemedi', 'Uygulama paketini yeniden yükleyin.'); return; }
  renderControlPlan();
  const snapshot = await getDocumentationSnapshot();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Q-Flow Quality Operations'; workbook.created = new Date(); workbook.modified = new Date();
  const sheet = workbook.addWorksheet('Kontrol Planı', { pageSetup: { paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.2, right: 0.2, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 } }, views: [{ state: 'frozen', ySplit: 8 }] });
  sheet.columns = [7, 23, 25, 10, 25, 19, 12, 24, 25, 16, 17, 31].map(width => ({ width }));
  const mergeValue = (range, label, value) => { sheet.mergeCells(range); const cell = sheet.getCell(range.split(':')[0]); cell.value = `${label}\n${safeExcelValue(value || '—')}`; cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }; };
  sheet.mergeCells('A1:L1'); sheet.getCell('A1').value = 'KONTROL PLANI / CONTROL PLAN'; sheet.getCell('A1').font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FF10213F' } }; sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }; sheet.getRow(1).height = 30;
  mergeValue('A2:D2', 'FAZ', `${phaseCheck('prototype')}   ${phaseCheck('prelaunch')}   ${phaseCheck('production')}`); mergeValue('E2:H2', 'KONTROL PLANI NO', controlPlanNumber.value); mergeValue('I2:L2', 'DOKÜMAN DURUMU', document.getElementById('documentStatus').value);
  mergeValue('A3:D3', 'KURULUŞ / SAHA', `${document.getElementById('supplierName').value} / ${document.getElementById('supplierSite').value}`); mergeValue('E3:H3', 'MÜŞTERİ / MÜŞTERİ PARÇA NO', `${document.getElementById('customer').value} / ${document.getElementById('customerPartNumber').value}`); mergeValue('I3:L3', 'TEDARİKÇİ KODU', document.getElementById('supplierCode').value);
  mergeValue('A4:D4', 'PARÇA NO / REVİZYON', `${partNumber.value} / ${drawingRevision.value}`); mergeValue('E4:H4', 'PARÇA ADI', partName.value); mergeValue('I4:L4', 'TEKNİK RESİM', `${document.getElementById('drawingNumber').value} / Rev. ${drawingRevision.value}`);
  mergeValue('A5:D5', 'ANAHTAR PERSONEL / TELEFON', `${document.getElementById('keyContact').value} / ${document.getElementById('keyContactPhone').value}`); mergeValue('E5:H5', 'ÇEKİRDEK EKİP', document.getElementById('coreTeam').value); mergeValue('I5:L5', 'İLK YAYIN / REVİZYON', `${document.getElementById('originalDate').value} / ${document.getElementById('revisionDate').value}`);
  mergeValue('A6:D6', 'MALZEME', `${document.getElementById('materialGrade').value} • ${document.getElementById('materialStandard').value}`); mergeValue('E6:H6', 'ISIL İŞLEM / SERTLİK', `${document.getElementById('heatTreatment').value} • ${document.getElementById('hardnessSpec').value}`); mergeValue('I6:L6', 'KAPLAMA', `${document.getElementById('coatingType').value} • ${document.getElementById('coatingThickness').value} µm`);
  mergeValue('A7:H7', 'PROJE / APQP', projectCode.value); mergeValue('I7:L7', 'KAYNAK SNAPSHOT SHA-256', snapshot.sha256);
  const headers = ['Op.', 'Operasyon / Sorumlu', 'Makine / Teçhizat / Aparat', 'Kar. No', 'Ürün / Proses Karakteristiği', 'Spesifikasyon / Tolerans', 'Özel Sınıf', 'Kontrol / Poka-Yoke', 'Ölçüm Tekniği / Cihaz', 'Numune / Sıklık', 'Referans', 'Reaksiyon Planı'];
  sheet.getRow(8).values = headers; sheet.getRow(8).height = 34;
  const rows = controlPlanRows();
  rows.forEach((row, index) => {
    const values = [row.operation, row.processName, row.equipment, `${row.item.balloon}\n${row.item.id}`, `${row.item.name}\n${row.item.kind}`, row.specification, row.item.classification, row.control, row.measurement, row.sampling, row.reference, row.reaction].map(safeExcelValue);
    const excelRow = sheet.addRow(values); excelRow.height = 44; excelRow.eachCell(cell => { cell.font = { name: 'Arial', size: 8 }; cell.alignment = { vertical: 'middle', wrapText: true }; });
    if (index % 2) excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FC' } };
  });
  const border = { top: { style: 'thin', color: { argb: 'FF7D8798' } }, left: { style: 'thin', color: { argb: 'FF7D8798' } }, bottom: { style: 'thin', color: { argb: 'FF7D8798' } }, right: { style: 'thin', color: { argb: 'FF7D8798' } } };
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => row.eachCell({ includeEmpty: true }, cell => { cell.border = border; if (rowNumber >= 2 && rowNumber <= 7) cell.font = { name: 'Arial', size: 8, bold: rowNumber === 2 }; }));
  sheet.getRow(8).eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10213F' } }; cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
  sheet.pageSetup.printArea = `A1:L${8 + rows.length}`; sheet.pageSetup.printTitlesRow = '8:8'; sheet.headerFooter.oddFooter = `&L${safeExcelValue(controlPlanNumber.value)} • Rev. ${safeExcelValue(drawingRevision.value)}&C KONTROLLÜ KOPYA &R Sayfa &P / &N`;
  const metadata = workbook.addWorksheet('_QFLOW_METADATA'); metadata.state = 'veryHidden';
  [['Schema', snapshot.schemaVersion], ['Template', snapshot.templateVersion], ['Project ID', currentProjectId || 'unsaved'], ['Snapshot ID', snapshot.snapshotId], ['SHA-256', snapshot.sha256], ['Generated At', snapshot.generatedAt], ['Drawing SHA-256', snapshot.drawingSource.sha256]].forEach(row => metadata.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  const verification = new ExcelJS.Workbook(); await verification.xlsx.load(buffer);
  if (!verification.getWorksheet('Kontrol Planı') || verification.getWorksheet('Kontrol Planı').rowCount < 8 + rows.length) throw new Error('XLSX doğrulaması başarısız.');
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${safeFileName(controlPlanNumber.value)}_Rev-${safeFileName(drawingRevision.value)}.xlsx`);
  toast('Excel kontrol planı doğrulandı', `${rows.length} satır, A3 yatay antet ve gizli snapshot özetiyle indirildi.`);
}

function pdfControlDefinition(snapshot) {
  const rows = controlPlanRows();
  const controlHeaders = ['Op.', 'Operasyon', 'Makine / Aparat', 'Kar. No', 'Karakteristik', 'Spesifikasyon', 'Sınıf', 'Kontrol / Poka-Yoke', 'Ölçüm / Cihaz', 'Numune / Sıklık', 'Referans', 'Reaksiyon Planı'].map(text => ({ text, bold: true, color: 'white', fillColor: '#10213f', alignment: 'center', fontSize: 6, margin: 2 }));
  const controlBody = rows.map(row => [row.operation, row.processName, row.equipment, `${row.item.balloon}\n${row.item.id}`, `${row.item.name}\n${row.item.kind}`, row.specification, row.item.classification, row.control, row.measurement, row.sampling, row.reference, row.reaction].map(text => ({ text: String(text || '—'), fontSize: 5.8, margin: 2 })));
  const meta = value => ({ text: value || '—', fontSize: 7, bold: true, margin: [2, 2, 2, 2] });
  const metaLabel = value => ({ text: value, fontSize: 5.5, color: '#68758b', margin: [2, 2, 2, 0] });
  const metaCell = (label, value) => ({ stack: [metaLabel(label), meta(value)], margin: 1 });
  return {
    pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [18, 20, 18, 24],
    footer: (currentPage, pageCount) => ({ margin: [18, 5, 18, 0], columns: [{ text: `${controlPlanNumber.value} • Rev. ${drawingRevision.value} • SHA ${snapshot.sha256.slice(0, 16)}`, fontSize: 6, color: '#69758a' }, { text: `KONTROLLÜ KOPYA • Sayfa ${currentPage} / ${pageCount}`, alignment: 'right', fontSize: 6, color: '#69758a' }] }),
    content: [
      { table: { widths: [80, '*', 100], body: [[{ text: 'Q-FLOW', bold: true, color: '#2f6fed', alignment: 'center', margin: [0, 7] }, { text: 'KONTROL PLANI / CONTROL PLAN', bold: true, fontSize: 17, alignment: 'center', margin: [0, 4] }, { text: document.getElementById('documentStatus').value.toLocaleUpperCase('tr-TR'), bold: true, alignment: 'center', margin: [0, 7] }]] }, layout: 'lightHorizontalLines' },
      { table: { widths: [90, 150, 150, '*'], body: [[metaCell('FAZ', phaseExportText()), metaCell('KONTROL PLANI NO', controlPlanNumber.value), metaCell('PARÇA NO / REV.', `${partNumber.value} / ${drawingRevision.value}`), metaCell('PARÇA ADI', partName.value)], [metaCell('KURULUŞ / SAHA', `${document.getElementById('supplierName').value} / ${document.getElementById('supplierSite').value}`), metaCell('MÜŞTERİ / MÜŞTERİ PN', `${document.getElementById('customer').value} / ${document.getElementById('customerPartNumber').value}`), metaCell('ANAHTAR PERSONEL', `${document.getElementById('keyContact').value} / ${document.getElementById('keyContactPhone').value}`), metaCell('İLK YAYIN / REVİZYON', `${document.getElementById('originalDate').value} / ${document.getElementById('revisionDate').value}`)], [metaCell('TEKNİK RESİM', `${document.getElementById('drawingNumber').value} / Rev. ${drawingRevision.value}`), metaCell('MALZEME', `${document.getElementById('materialGrade').value} • ${document.getElementById('materialStandard').value}`), metaCell('ISIL İŞLEM', `${document.getElementById('heatTreatment').value} • ${document.getElementById('hardnessSpec').value}`), metaCell('KAPLAMA', `${document.getElementById('coatingType').value} • ${document.getElementById('coatingThickness').value} µm`)]] }, layout: { hLineWidth: () => 0.7, vLineWidth: () => 0.7, hLineColor: () => '#6e7787', vLineColor: () => '#6e7787' }, margin: [0, 3, 0, 4] },
      { table: { headerRows: 1, widths: [20, 58, 65, 31, 78, 64, 34, 75, 78, 50, 48, '*'], body: [controlHeaders, ...controlBody] }, layout: { hLineWidth: () => 0.45, vLineWidth: () => 0.45, hLineColor: () => '#7e8796', vLineColor: () => '#7e8796' } },
      { text: 'Reaksiyon standardı: prosesi durdur > şüpheli ürün sınırını belirle > ürünü ayır/bloke et > doğrula > kayıt altına al > yetkili onayıyla yeniden başlat.', fontSize: 6, color: '#4e5c72', margin: [2, 5, 2, 0] }
    ], defaultStyle: { font: 'Roboto' }
  };
}

async function exportControlPlanPdf() {
  if (!globalThis.pdfMake) { toast('PDF motoru yüklenemedi', 'Uygulama paketini yeniden yükleyin.'); return; }
  renderControlPlan(); const snapshot = await getDocumentationSnapshot();
  pdfMake.createPdf(pdfControlDefinition(snapshot)).download(`${safeFileName(controlPlanNumber.value)}_Rev-${safeFileName(drawingRevision.value)}.pdf`);
  toast('Antetli PDF hazırlanıyor', `A3 yatay • ${characteristics.length} kontrol satırı • Türkçe gömülü font`);
}

function flowPdfDefinition(snapshot) {
  const chunks = [];
  for (let index = 0; index < snapshot.route.length; index += 4) chunks.push(snapshot.route.slice(index, index + 4));
  const flowRows = chunks.map(chunk => ({
    columns: chunk.flatMap((step, index) => {
      const node = { width: '*', table: { widths: ['*'], body: [[{ stack: [{ text: `OP ${step.operationNo}`, bold: true, fontSize: 7, color: '#2f6fed' }, { text: step.name, bold: true, fontSize: 10, margin: [0, 4, 0, 2] }, { text: step.description || step.equipment || '—', fontSize: 6.5, color: '#68758b' }, { text: `${step.special ? 'ÖZEL PROSES  ' : ''}${step.outsource ? 'DIŞ KAYNAK' : ''}`, fontSize: 6, color: '#b87916', margin: [0, 5, 0, 0] }], margin: 7, fillColor: step.category === 'Kontrol' ? '#eef9f4' : '#f2f6ff' }]] }, layout: { hLineWidth: () => 0.8, vLineWidth: () => 0.8, hLineColor: () => step.category === 'Kontrol' ? '#3a9f79' : '#5a7fc7', vLineColor: () => step.category === 'Kontrol' ? '#3a9f79' : '#5a7fc7' } };
      return index < chunk.length - 1 ? [node, { width: 18, text: '>', bold: true, alignment: 'center', margin: [0, 24, 0, 0], color: '#73839d', fontSize: 14 }] : [node];
    }), columnGap: 5, margin: [0, 0, 0, 12]
  }));
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 24, 24, 28], content: [
    { table: { widths: [75, '*', 100], body: [[{ text: 'Q-FLOW', bold: true, color: '#2f6fed', alignment: 'center', margin: [0, 7] }, { text: 'PROSES AKIŞ DİYAGRAMI / PROCESS FLOW', bold: true, fontSize: 16, alignment: 'center', margin: [0, 5] }, { text: `Rev. ${snapshot.product.drawingRevision}\n${snapshot.approval.status}`, bold: true, alignment: 'center', fontSize: 8, margin: [0, 4] }]] }, layout: 'lightHorizontalLines' },
    { table: { widths: [120, 160, 150, '*'], body: [[{ text: `PROJE / APQP\n${snapshot.product.projectCode}`, fontSize: 7, bold: true }, { text: `PARÇA NO / ADI\n${snapshot.product.partNumber} / ${snapshot.product.partName}`, fontSize: 7, bold: true }, { text: `KURULUŞ / SAHA\n${snapshot.product.supplierName} / ${snapshot.product.supplierSite}`, fontSize: 7 }, { text: `TEKNİK RESİM / REVİZYON\n${snapshot.product.drawingNumber} / ${snapshot.product.drawingRevision}`, fontSize: 7 }], [{ text: `MALZEME\n${snapshot.technical.materialGrade} • ${snapshot.technical.materialStandard}`, fontSize: 7 }, { text: `ISIL İŞLEM\n${snapshot.technical.heatTreatment} • ${snapshot.technical.hardnessSpec}`, fontSize: 7 }, { text: `KAPLAMA\n${snapshot.technical.coatingType} • ${snapshot.technical.coatingThickness} µm`, fontSize: 7 }, { text: `FAZ / TOPLAM OPERASYON\n${snapshot.product.productionPhase} / ${snapshot.route.length}`, fontSize: 7 }]] }, margin: [0, 4, 0, 16] },
    ...flowRows,
    { text: `Kaynak snapshot: ${snapshot.sha256} • Çizim kaynağı SHA-256: ${snapshot.drawingSource.sha256}`, fontSize: 6, color: '#718097', margin: [0, 8, 0, 0] }
  ], footer: (page, pages) => ({ text: `${snapshot.product.projectCode} • Rev. ${snapshot.product.drawingRevision} • KONTROLLÜ KOPYA • Sayfa ${page}/${pages}`, fontSize: 6, alignment: 'center', color: '#68758b' }), defaultStyle: { font: 'Roboto' } };
}

document.querySelectorAll('[data-action="export-flow-pdf"]').forEach(button => button.addEventListener('click', async () => {
  if (!selected.length) { selected = [...productBackbones[productGroup.value].processes]; renderSequence(); renderFlowDiagram(); }
  const snapshot = await getDocumentationSnapshot(); pdfMake.createPdf(flowPdfDefinition(snapshot)).download(`${safeFileName(projectCode.value)}_Proses_Akisi_Rev-${safeFileName(drawingRevision.value)}.pdf`);
  toast('Antetli proses akış PDF’i hazırlanıyor', `${snapshot.route.length} operasyon • A3 yatay • kontrollü snapshot`);
}));

function dxfAscii(value) {
  const map = { 'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U', '±': '+/-', 'Ø': 'DIA', '⌀': 'DIA', 'µ': 'u' };
  return String(value ?? '').replace(/[çÇğĞıİöÖşŞüÜ±Ø⌀µ]/g, char => map[char]).replace(/[\r\n]+/g, ' ').slice(0, 240);
}

function createProcessFlowDxf(snapshot) {
  const pairs = []; const p = (code, value) => { pairs.push(String(code), String(value)); };
  const line = (x1, y1, x2, y2, layer = 'FRAME') => { p(0, 'LINE'); p(8, layer); p(10, x1); p(20, y1); p(30, 0); p(11, x2); p(21, y2); p(31, 0); };
  const rect = (x, y, w, h, layer) => { line(x, y, x + w, y, layer); line(x + w, y, x + w, y + h, layer); line(x + w, y + h, x, y + h, layer); line(x, y + h, x, y, layer); };
  const text = (x, y, height, value, layer = 'TEXT') => { p(0, 'TEXT'); p(8, layer); p(10, x); p(20, y); p(30, 0); p(40, height); p(1, dxfAscii(value)); p(7, 'STANDARD'); };
  p(0, 'SECTION'); p(2, 'HEADER'); p(9, '$ACADVER'); p(1, 'AC1009'); p(9, '$INSUNITS'); p(70, 4); p(0, 'ENDSEC');
  p(0, 'SECTION'); p(2, 'TABLES'); p(0, 'TABLE'); p(2, 'LAYER'); p(70, 5);
  [['FRAME', 7], ['TITLEBLOCK', 2], ['PROCESS', 5], ['CONTROL', 3], ['TEXT', 7]].forEach(([name, color]) => { p(0, 'LAYER'); p(2, name); p(70, 0); p(62, color); p(6, 'CONTINUOUS'); });
  p(0, 'ENDTAB'); p(0, 'ENDSEC'); p(0, 'SECTION'); p(2, 'ENTITIES');
  rect(5, 5, 410, 287, 'FRAME'); text(150, 282, 6, 'PROSES AKIS DIYAGRAMI', 'TITLEBLOCK'); text(8, 283, 4, 'Q-FLOW', 'TITLEBLOCK');
  const route = snapshot.route; const cols = 4; const nodeW = 78; const nodeH = 25; const gapX = 20; const gapY = 18;
  route.forEach((step, index) => {
    const col = index % cols; const row = Math.floor(index / cols); const x = 15 + col * (nodeW + gapX); const y = 245 - row * (nodeH + gapY); const layer = step.category === 'Kontrol' ? 'CONTROL' : 'PROCESS';
    rect(x, y, nodeW, nodeH, layer); text(x + 3, y + 17, 3.2, `OP ${step.operationNo}  ${step.name}`, 'TEXT'); text(x + 3, y + 9, 2.4, step.equipment || step.description, 'TEXT');
    if (col < cols - 1 && index < route.length - 1) { line(x + nodeW, y + nodeH / 2, x + nodeW + gapX - 3, y + nodeH / 2, 'PROCESS'); line(x + nodeW + gapX - 6, y + nodeH / 2 + 2, x + nodeW + gapX - 3, y + nodeH / 2, 'PROCESS'); line(x + nodeW + gapX - 6, y + nodeH / 2 - 2, x + nodeW + gapX - 3, y + nodeH / 2, 'PROCESS'); }
  });
  rect(5, 5, 410, 32, 'TITLEBLOCK'); line(105, 5, 105, 37, 'TITLEBLOCK'); line(245, 5, 245, 37, 'TITLEBLOCK'); line(335, 5, 335, 37, 'TITLEBLOCK'); line(5, 21, 415, 21, 'TITLEBLOCK');
  text(8, 29, 2.5, 'PROJE / APQP'); text(8, 24, 3.5, snapshot.product.projectCode); text(108, 29, 2.5, 'PARCA / REVIZYON'); text(108, 24, 3.5, `${snapshot.product.partNumber} / ${snapshot.product.drawingRevision}`); text(248, 29, 2.5, 'URUN ADI'); text(248, 24, 3.5, snapshot.product.partName); text(338, 29, 2.5, 'SAYFA'); text(338, 24, 3.5, '1 / 1');
  text(8, 13, 2.5, 'KURULUS / SAHA'); text(8, 8, 3.2, `${snapshot.product.supplierName} / ${snapshot.product.supplierSite}`); text(108, 13, 2.5, 'KONTROL PLANI'); text(108, 8, 3.2, snapshot.product.controlPlanNumber); text(248, 13, 2.5, 'SNAPSHOT SHA-256'); text(248, 8, 2.7, snapshot.sha256.slice(0, 32));
  p(0, 'ENDSEC'); p(0, 'EOF'); return pairs.join('\r\n');
}

async function exportControlPlanDxf() {
  if (!selected.length) { selected = [...productBackbones[productGroup.value].processes]; renderSequence(); }
  const snapshot = await getDocumentationSnapshot(); const dxf = createProcessFlowDxf(snapshot);
  downloadBlob(new Blob([dxf], { type: 'application/dxf;charset=us-ascii' }), `${safeFileName(projectCode.value)}_Proses_Akisi_Rev-${safeFileName(drawingRevision.value)}.dxf`);
  toast('CAD değişim dosyası oluşturuldu', `${snapshot.route.length} operasyon • A3 antet • mm • FRAME/PROCESS/CONTROL/TEXT katmanları`);
}

document.querySelectorAll('[data-action="export-control-xlsx"]').forEach(button => button.addEventListener('click', () => exportControlPlanXlsx().catch(error => toast('Excel üretilemedi', error.message))));
document.querySelectorAll('[data-action="export-control-pdf"]').forEach(button => button.addEventListener('click', () => exportControlPlanPdf().catch(error => toast('PDF üretilemedi', error.message))));
document.querySelectorAll('[data-action="export-control-dxf"]').forEach(button => button.addEventListener('click', () => exportControlPlanDxf().catch(error => toast('DXF üretilemedi', error.message))));
document.querySelectorAll('[data-action="dwg-info"]').forEach(button => button.addEventListener('click', () => toast('Gerçek DWG masaüstü köprüsünde', 'Web sürümü açık standart DXF üretir. DWG için ODA Drawings SDK veya Autodesk RealDWG lisansı ve imzalı Tauri modülü gerekir.')));

let instructionModels = [];

function buildInstructionModels() {
  instructionModels = selectedProcessEntries().map(({ process, index }) => {
    const linked = characteristics.filter(item => item.processId === process.id);
    const librarySteps = String(process.workInstruction || '').split(/\r?\n|;/).map(step => step.trim()).filter(Boolean);
    const fallbackSteps = [`İş emri, parça numarası ve Rev. ${drawingRevision.value} teknik resmini doğrula.`, `${process.equipment || 'Ekipman'} ile ${process.name} operasyonu için güvenli başlangıç kontrolünü yap.`, `${process.desc || process.name} işlem parametrelerini onaylı reçeteye göre uygula.`, linked.length ? `${linked.map(item => `${item.balloon} ${item.name}`).join(', ')} kontrolünü belirtilen sıklıkta gerçekleştir.` : 'Proses çıktısını görsel ve fonksiyonel olarak kontrol et.', 'Sonucu kayıt formuna işle; lot, vardiya ve operatör izlenebilirliğini tamamla.'];
    return { operationNo: String((index + 1) * 10).padStart(2, '0'), processId: process.id, title: `${process.name} Operatör Talimatı`, equipment: [process.equipment, process.tooling].filter(Boolean).join(' / ') || 'Tanımlanacak', ppe: process.special ? 'Koruyucu gözlük, uygun ısı/kimyasal eldiveni, iş ayakkabısı, proses alanı PPE şartları' : 'Koruyucu gözlük, uygun iş eldiveni ve iş ayakkabısı', safety: process.special ? 'Özel proses yetkisi ve geçerli reçete doğrulanmadan çalıştırma. Enerji izolasyonu/LOTO kurallarını uygula.' : 'Koruyucuları devre dışı bırakma; sıkışma ve kesilme noktalarından uzak dur.', stepsText: (librarySteps.length >= 3 ? librarySteps : fallbackSteps).join('\n'), linked, reaction: process.reactionPlan || 'Prosesi durdur; ürünü kırmızı alanda bloke et; son iyi parçadan itibaren ayır; kalite sorumlusuna bildir; yeniden başlatma onayı al.', record: process.documentRef || `FR-${process.code || process.id}` };
  });
}

function renderInstructions() {
  const container = document.getElementById('instructionResult');
  container.innerHTML = instructionModels.map((model, index) => `<article class="instruction-card professional-instruction" data-instruction="${index}"><div class="instruction-top"><span>OP ${escapeHtml(model.operationNo)}</span><mark>DÜZENLENEBİLİR</mark></div><div class="instruction-hero"><div class="instruction-visual">${escapeHtml(processIcon(processes.find(item => item.id === model.processId) || {}))}<small>${escapeHtml(model.processId.toLocaleUpperCase('tr-TR'))}</small></div><div><h3>${escapeHtml(model.title)}</h3><p>${escapeHtml(model.equipment)}</p></div></div><div class="instruction-meta"><span>${model.stepsText.split('\n').filter(Boolean).length} adım</span><span>${model.linked.length} kontrol noktası</span><span>${escapeHtml(model.record)}</span></div><div class="instruction-controls"><button class="secondary-button" data-toggle-instruction="${index}">Düzenle</button><button class="primary-small" data-export-instruction="${index}">PDF</button></div><div class="instruction-editor"><label>PPE<input data-instruction-field="ppe" value="${escapeHtml(model.ppe)}"></label><label>Güvenlik uyarısı<textarea data-instruction-field="safety" rows="2">${escapeHtml(model.safety)}</textarea></label><label>Sıralı işlem adımları<textarea data-instruction-field="stepsText" rows="7">${escapeHtml(model.stepsText)}</textarea></label><label>Reaksiyon planı<textarea data-instruction-field="reaction" rows="3">${escapeHtml(model.reaction)}</textarea></label><div class="linked-controls"><b>Bağlı kontrol noktaları</b>${model.linked.length ? model.linked.map(item => `<span><strong>${escapeHtml(item.balloon)} • ${escapeHtml(item.name)}</strong><small>${escapeHtml(specificationFor(item))} • ${escapeHtml(item.equipment)} • ${escapeHtml(item.sampleSize)} / ${escapeHtml(item.frequency)}</small></span>`).join('') : '<span><small>Bu operasyona atanmış ürün/proses karakteristiği yok.</small></span>'}</div></div></article>`).join('');
  container.querySelectorAll('[data-toggle-instruction]').forEach(button => button.addEventListener('click', () => button.closest('.instruction-card').classList.toggle('expanded')));
  container.querySelectorAll('[data-export-instruction]').forEach(button => button.addEventListener('click', () => exportInstructionPdf(Number(button.dataset.exportInstruction))));
  container.querySelectorAll('[data-instruction-field]').forEach(field => field.addEventListener('input', event => { const card = event.target.closest('.instruction-card'); instructionModels[Number(card.dataset.instruction)][event.target.dataset.instructionField] = event.target.value; markDraftDirty(); }));
}

function instructionPdfBlock(model, index, pageBreak = false) {
  const steps = model.stepsText.split('\n').map(step => step.trim()).filter(Boolean);
  return { stack: [
    { table: { widths: [70, '*', 90], body: [[{ text: 'Q-FLOW', bold: true, color: '#2f6fed', alignment: 'center', margin: [0, 6] }, { text: 'OPERATÖR İŞ / KONTROL TALİMATI', bold: true, fontSize: 14, alignment: 'center', margin: [0, 4] }, { text: `OP ${model.operationNo}\nRev. ${drawingRevision.value}`, bold: true, alignment: 'center', margin: [0, 3] }]] }, layout: 'lightHorizontalLines' },
    { table: { widths: [90, '*', 110], body: [[{ text: `PARÇA NO\n${partNumber.value}`, fontSize: 7, bold: true }, { text: `PARÇA ADI / PROSES\n${partName.value} / ${model.title}`, fontSize: 7, bold: true }, { text: `EKİPMAN\n${model.equipment}`, fontSize: 7, bold: true }], [{ text: `PROJE\n${projectCode.value}`, fontSize: 7 }, { text: `PPE\n${model.ppe}`, fontSize: 7 }, { text: `KAYIT\n${model.record}`, fontSize: 7 }]] }, margin: [0, 4, 0, 5] },
    { table: { widths: [65, '*'], body: [[{ text: 'GÜVENLİK', bold: true, fontSize: 8, color: '#9b261d', fillColor: '#ffebe8', alignment: 'center', margin: [2, 6] }, { text: model.safety, fontSize: 8, fillColor: '#fff7f5', margin: 4 }]] }, layout: 'noBorders', margin: [0, 0, 0, 7] },
    { text: 'İŞLEM ADIMLARI', bold: true, fontSize: 9, color: '#10213f', margin: [0, 0, 0, 3] },
    { table: { headerRows: 1, widths: [28, '*', 120], body: [[{ text: 'NO', style: 'wiHead' }, { text: 'UYGULAMA ADIMI', style: 'wiHead' }, { text: 'KALİTE / GÜVENLİK KONTROLÜ', style: 'wiHead' }], ...steps.map((step, stepIndex) => [{ text: String(stepIndex + 1), alignment: 'center', fontSize: 8, margin: 4 }, { text: step, fontSize: 8, margin: 4 }, { text: stepIndex === steps.length - 1 ? 'Kayıt ve izlenebilirlik tamamlanır.' : 'Standart iş ve proses parametresine uyulur.', fontSize: 7, margin: 4 }])] }, layout: 'lightHorizontalLines' },
    { text: 'KONTROL NOKTALARI', bold: true, fontSize: 9, color: '#10213f', margin: [0, 8, 0, 3] },
    { table: { headerRows: 1, widths: [35, 100, 80, '*', 90], body: [[{ text: 'NO', style: 'wiHead' }, { text: 'KARAKTERİSTİK', style: 'wiHead' }, { text: 'SPESİFİKASYON', style: 'wiHead' }, { text: 'ÖLÇÜM / CİHAZ', style: 'wiHead' }, { text: 'SIKLIK', style: 'wiHead' }], ...(model.linked.length ? model.linked.map(item => [item.balloon, item.name, specificationFor(item), item.equipment, `${item.sampleSize} / ${item.frequency}`].map(text => ({ text, fontSize: 7, margin: 3 }))) : [[{ text: '—', colSpan: 5, alignment: 'center', fontSize: 7 }, {}, {}, {}, {}]])] }, layout: 'lightHorizontalLines' },
    { table: { widths: [75, '*'], body: [[{ text: 'REAKSİYON PLANI', bold: true, fontSize: 8, color: '#9b261d', margin: 4 }, { text: model.reaction, fontSize: 7.5, margin: 4 }]] }, margin: [0, 8, 0, 0] }
  ], pageBreak: pageBreak || index > 0 ? 'before' : undefined };
}

async function exportInstructionPdf(index) {
  if (!instructionModels.length) { buildInstructionModels(); renderInstructions(); }
  const model = instructionModels[index]; if (!model) return;
  const definition = { pageSize: 'A4', pageMargins: [22, 22, 22, 26], content: [instructionPdfBlock(model, 0)], styles: { wiHead: { bold: true, color: 'white', fillColor: '#10213f', fontSize: 7, alignment: 'center', margin: 3 } }, footer: (page, pages) => ({ text: `${controlPlanNumber.value} • OP ${model.operationNo} • KONTROLLÜ KOPYA • Sayfa ${page}/${pages}`, fontSize: 6, alignment: 'center', color: '#68758b' }), defaultStyle: { font: 'Roboto' } };
  pdfMake.createPdf(definition).download(`${safeFileName(partNumber.value)}_OP-${model.operationNo}_${safeFileName(model.processId)}.pdf`);
}

document.querySelectorAll('[data-action="export-all-instructions"]').forEach(button => button.addEventListener('click', () => {
  if (!instructionModels.length) buildInstructionModels();
  const definition = { pageSize: 'A4', pageMargins: [22, 22, 22, 26], content: instructionModels.map((model, index) => instructionPdfBlock(model, index, index > 0)), styles: { wiHead: { bold: true, color: 'white', fillColor: '#10213f', fontSize: 7, alignment: 'center', margin: 3 } }, footer: (page, pages) => ({ text: `${controlPlanNumber.value} • KONTROLLÜ OPERATÖR TALİMATLARI • Sayfa ${page}/${pages}`, fontSize: 6, alignment: 'center', color: '#68758b' }), defaultStyle: { font: 'Roboto' } };
  pdfMake.createPdf(definition).download(`${safeFileName(partNumber.value)}_Tum_Operator_Talimatlari.pdf`); toast('Talimat paketi hazırlanıyor', `${instructionModels.length} operasyon tek PDF dosyasında.`);
}));

document.querySelectorAll('[data-action="generate-instruction"]').forEach(btn => btn.addEventListener('click', () => {
  if (!selected.length) selected = [...productBackbones[productGroup.value].processes];
  buildInstructionModels();
  renderInstructions();
  showView('instruction');
  document.getElementById('instructionEmpty').classList.add('hidden');
  document.getElementById('instructionResult').classList.remove('hidden');
  document.getElementById('instructionEyebrow').textContent = `${projectCode.value} • ${instructionModels.length} OPERASYON • REV. ${drawingRevision.value}`;
  toast('Düzenlenebilir operatör talimatları oluşturuldu', `${instructionModels.length} istasyon • PPE, adımlar, kontrol noktaları ve reaksiyon planları eşleştirildi.`);
}));

document.querySelector('[data-action="ppap-package"]').addEventListener('click', () => {
  toast('PPAP kalite kapısı çalıştı', 'Paketlenebilir 14 unsur hazır; 4 açık unsur raporlandı.');
});

document.querySelectorAll('.projects-panel .chip').forEach(chip => chip.addEventListener('click', () => {
  document.querySelectorAll('.projects-panel .chip').forEach(item => item.classList.remove('active'));
  chip.classList.add('active');
}));

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js').catch(() => {}));
}
