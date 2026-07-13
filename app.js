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

function syncProductTypes() {
  const backbone = productBackbones[productGroup.value];
  const previous = productType.value;
  productType.innerHTML = backbone.types.map(type => `<option>${escapeHtml(type)}</option>`).join('');
  if (backbone.types.includes(previous)) productType.value = previous;
  updateSummary();
}

productGroup.addEventListener('change', syncProductTypes);
[productType, partNumber, partName, drawingRevision, document.getElementById('annualVolume')].forEach(input => {
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
  if (target === 4 && !validateCharacteristics()) {
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

// Technical drawing characteristics
let characteristics = [
  { name: 'Pim çapı', nominal: 18, minus: 0.013, plus: 0.013, unit: 'mm', classification: 'CC' },
  { name: 'Yüzey sertliği', nominal: 60, minus: 2, plus: 2, unit: 'HRC', classification: 'SC' },
  { name: 'Sıkma torku', nominal: 42, minus: 3, plus: 3, unit: 'Nm', classification: 'Normal' }
];

function formatValue(value) {
  if (!Number.isFinite(Number(value))) return '—';
  const decimals = String(value).includes('.') ? Math.min(String(value).split('.')[1].length, 4) : 0;
  return Number(value).toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: 4 });
}

function renderCharacteristics() {
  const rows = document.getElementById('characteristicRows');
  rows.innerHTML = characteristics.map((item, index) => {
    const low = Number(item.nominal) - Number(item.minus);
    const high = Number(item.nominal) + Number(item.plus);
    return `<div class="characteristic-row" data-characteristic="${index}">
      <span>${String(index + 1).padStart(2, '0')}</span>
      <input aria-label="Karakteristik adı" data-field="name" value="${escapeHtml(item.name)}">
      <input aria-label="Nominal değer" data-field="nominal" type="number" step="any" value="${item.nominal}">
      <input aria-label="Eksi tolerans" data-field="minus" type="number" min="0" step="any" value="${item.minus}">
      <input aria-label="Artı tolerans" data-field="plus" type="number" min="0" step="any" value="${item.plus}">
      <select aria-label="Birim" data-field="unit">${['mm', '°', 'HRC', 'Nm', 'Ra', 'µm'].map(unit => `<option ${unit === item.unit ? 'selected' : ''}>${unit}</option>`).join('')}</select>
      <select aria-label="Sınıf" data-field="classification"><option ${item.classification === 'Normal' ? 'selected' : ''}>Normal</option><option ${item.classification === 'SC' ? 'selected' : ''}>SC</option><option ${item.classification === 'CC' ? 'selected' : ''}>CC</option></select>
      <span class="characteristic-limits">${formatValue(low)} – ${formatValue(high)}</span>
      <button class="remove-characteristic" data-remove-characteristic="${index}" aria-label="Karakteristiği kaldır">×</button>
    </div>`;
  }).join('');

  rows.querySelectorAll('input, select').forEach(input => input.addEventListener('input', event => {
    const row = event.target.closest('.characteristic-row');
    const index = Number(row.dataset.characteristic);
    const field = event.target.dataset.field;
    characteristics[index][field] = ['nominal', 'minus', 'plus'].includes(field) ? Number(event.target.value) : event.target.value;
    if (['nominal', 'minus', 'plus'].includes(field)) {
      const item = characteristics[index];
      row.querySelector('.characteristic-limits').textContent = `${formatValue(item.nominal - item.minus)} – ${formatValue(item.nominal + item.plus)}`;
    }
    validateCharacteristics();
    updateSummary();
  }));
  rows.querySelectorAll('select').forEach(select => select.addEventListener('change', event => {
    const row = event.target.closest('.characteristic-row');
    characteristics[Number(row.dataset.characteristic)][event.target.dataset.field] = event.target.value;
    updateSummary();
  }));
  rows.querySelectorAll('[data-remove-characteristic]').forEach(btn => btn.addEventListener('click', () => {
    if (characteristics.length === 1) {
      toast('En az bir satır gerekli', 'Doküman omurgası için bir karakteristik bırakın.');
      return;
    }
    characteristics.splice(Number(btn.dataset.removeCharacteristic), 1);
    renderCharacteristics();
    updateSummary();
  }));
  validateCharacteristics();
  updateSummary();
}

function validateCharacteristics() {
  let validCount = 0;
  document.querySelectorAll('.characteristic-row[data-characteristic]').forEach((row, index) => {
    const item = characteristics[index];
    const valid = item.name.trim() && Number.isFinite(item.nominal) && Number.isFinite(item.minus) && item.minus >= 0 && Number.isFinite(item.plus) && item.plus >= 0;
    row.querySelectorAll('input').forEach(input => input.classList.toggle('invalid', !valid && (!input.value || (input.type === 'number' && Number(input.value) < 0))));
    if (valid) validCount += 1;
  });
  const validation = document.getElementById('characteristicValidation');
  if (validation) validation.textContent = `${validCount}/${characteristics.length} karakteristik doğrulandı`;
  document.getElementById('gateCharacteristicCount').textContent = `${validCount} satır, sayısal limitler geçerli`;
  return validCount === characteristics.length && characteristics.length > 0;
}

document.querySelector('[data-action="add-characteristic"]').addEventListener('click', () => {
  characteristics.push({ name: 'Yeni karakteristik', nominal: 0, minus: 0, plus: 0, unit: 'mm', classification: 'Normal' });
  renderCharacteristics();
  document.querySelector('#characteristicRows .characteristic-row:last-child input').focus();
});

function updateSummary() {
  if (!productGroup || !productBackbones[productGroup.value]) return;
  const backbone = productBackbones[productGroup.value];
  document.getElementById('summaryGroup').textContent = backbone.label;
  document.getElementById('summaryPartName').textContent = (partName.value || 'PARÇA ADI').toLocaleUpperCase('tr-TR');
  document.getElementById('summaryPartNo').textContent = `${partNumber.value || '—'} • Rev. ${drawingRevision.value || '—'}`;
  document.getElementById('summaryCharacteristicCount').textContent = characteristics.length;
  document.getElementById('summarySpecialCount').textContent = characteristics.filter(item => item.classification !== 'Normal').length;
  document.getElementById('summaryProcessCount').textContent = backbone.processes.length;
  const ppap = document.querySelector('input[name="ppap"]:checked')?.value || 3;
  document.getElementById('summaryPpapLevel').textContent = ppap;
  const completion = [25, 50, 75, 100][currentWizardStep - 1];
  document.getElementById('summaryCompletionText').textContent = `${completion}%`;
  document.getElementById('summaryCompletionBar').style.width = `${completion}%`;
  const drawingName = document.getElementById('drawingFileName');
  if (drawingName && !drawingName.dataset.manual) drawingName.textContent = `${partNumber.value || 'PARCA'}_REV-${drawingRevision.value || '0'}.pdf`;
}

syncProductTypes();
renderCharacteristics();

document.querySelector('[data-action="drawing-change"]').addEventListener('click', event => {
  event.preventDefault();
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.pdf,.png,.jpg,.jpeg';
  picker.addEventListener('change', () => {
    if (!picker.files[0]) return;
    const name = document.getElementById('drawingFileName');
    name.textContent = picker.files[0].name;
    name.dataset.manual = 'true';
    toast('Teknik resim seçildi', 'Karakteristikleri resimdeki değerlere göre girin.');
  });
  picker.click();
});

// Process flow builder
const processes = [
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
let selected = [];
const optionsEl = document.getElementById('processOptions');
const sequenceEl = document.getElementById('processSequence');

function renderOptions(filter = '') {
  const normalized = filter.toLocaleLowerCase('tr-TR');
  optionsEl.innerHTML = processes.filter(process => `${process.name} ${process.desc}`.toLocaleLowerCase('tr-TR').includes(normalized)).map(process => `<div class="process-option ${selected.includes(process.id) ? 'selected' : ''}" data-process="${process.id}" tabindex="0"><span class="process-option-icon">${process.icon}</span><span><strong>${process.name}</strong><small>${process.desc}</small></span><i class="select-check">✓</i></div>`).join('');
  optionsEl.querySelectorAll('.process-option').forEach(item => {
    item.addEventListener('click', () => toggleProcess(item.dataset.process));
    item.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') toggleProcess(item.dataset.process); });
  });
}

function toggleProcess(id) {
  selected = selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id];
  renderOptions(document.querySelector('.library-search input').value);
  renderSequence();
}

function moveProcess(index, direction) {
  const next = index + direction;
  if (next < 0 || next >= selected.length) return;
  [selected[index], selected[next]] = [selected[next], selected[index]];
  renderSequence();
}

function renderSequence() {
  const list = selected.map(id => processes.find(process => process.id === id));
  sequenceEl.classList.toggle('empty', !list.length);
  sequenceEl.innerHTML = list.length ? list.map((process, index) => `<div class="sequence-item"><span class="drag">⠿</span><span class="op-number">OP ${String((index + 1) * 10).padStart(2, '0')}</span><span><strong>${process.name}</strong><small>${process.desc}</small></span><span class="sequence-tags">${process.special ? '<mark>Özel Proses</mark>' : ''}${process.outsource ? '<mark>Dış Kaynak</mark>' : ''}</span><span class="sequence-order"><button data-move-up="${index}" aria-label="Yukarı taşı">↑</button><button data-move-down="${index}" aria-label="Aşağı taşı">↓</button></span><button data-remove="${process.id}" aria-label="Kaldır">×</button></div>`).join('') : '<div class="empty-state"><span>⇢</span><h3>Proses adımlarınızı seçin</h3><p>Sol taraftaki kütüphaneden operasyon ekleyin.</p></div>';
  sequenceEl.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', () => toggleProcess(btn.dataset.remove)));
  sequenceEl.querySelectorAll('[data-move-up]').forEach(btn => btn.addEventListener('click', () => moveProcess(Number(btn.dataset.moveUp), -1)));
  sequenceEl.querySelectorAll('[data-move-down]').forEach(btn => btn.addEventListener('click', () => moveProcess(Number(btn.dataset.moveDown), 1)));
  document.getElementById('operationCount').textContent = `${list.length} operasyon`;
  document.getElementById('totalOps').textContent = list.length;
  document.getElementById('specialOps').textContent = list.filter(process => process.special).length;
  document.getElementById('outsourcedOps').textContent = list.filter(process => process.outsource).length;
}

function renderFlowDiagram() {
  const list = selected.map(id => processes.find(process => process.id === id));
  document.getElementById('flowCanvas').innerHTML = list.map((process, index) => `<div class="flow-node ${process.control ? 'control' : ''} ${process.outsource ? 'outsource' : ''}"><span class="node-op">OP ${String((index + 1) * 10).padStart(2, '0')}</span><b>${process.name}</b><small>${process.desc}</small></div>`).join('');
  document.getElementById('flowPreview').classList.remove('hidden');
}

document.querySelector('.library-search input').addEventListener('input', event => renderOptions(event.target.value));
renderOptions();
renderSequence();

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

// Main workflow actions
document.querySelectorAll('[data-action="new-product"]').forEach(btn => btn.addEventListener('click', () => {
  showView('product');
  goToWizardStep(1);
}));

document.querySelectorAll('[data-action="save-product"]').forEach(btn => btn.addEventListener('click', () => {
  if (!validateCharacteristics()) {
    goToWizardStep(3);
    return;
  }
  selected = [...productBackbones[productGroup.value].processes];
  renderOptions();
  renderSequence();
  document.getElementById('draftStatus').textContent = '✓ Omurga doğrulandı';
  toast('Ürün omurgası oluşturuldu', `${selected.length} operasyon ve ${characteristics.length} karakteristik eşleştirildi.`);
  setTimeout(() => showView('flow'), 500);
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
  toast('PFMEA kalite kapısı tamamlandı', 'Risk kontrolleri kontrol planı için hazır.');
  setTimeout(() => showView('control'), 650);
}));

function controlContext(characteristic) {
  const name = characteristic.name.toLocaleLowerCase('tr-TR');
  if (name.includes('sert')) return { op: '70', process: 'İndüksiyon', method: 'Rockwell sertlik cihazı', sample: '3 adet / vardiya' };
  if (name.includes('tork')) return { op: '100', process: 'Montaj', method: 'Dijital tork sistemi', sample: '%100' };
  return { op: '50', process: 'CNC Tornalama', method: characteristic.unit === 'mm' ? 'Dijital komparatör' : 'Uygun ölçüm cihazı', sample: '5 adet / 2 saatte' };
}

function renderControlPlan() {
  const grid = document.querySelector('#controlResult .control-grid');
  grid.innerHTML = '<div class="control-row control-head"><span>OP.</span><span>PROSES</span><span>KARAKTERİSTİK</span><span>SPESİFİKASYON</span><span>KONTROL METODU</span><span>NUMUNE / SIKLIK</span><span>REAKSİYON PLANI</span></div>' + characteristics.map(item => {
    const context = controlContext(item);
    const low = formatValue(item.nominal - item.minus);
    const high = formatValue(item.nominal + item.plus);
    return `<div class="control-row"><span><b>${context.op}</b></span><span>${context.process}</span><span><b>${escapeHtml(item.name)}</b>${item.classification !== 'Normal' ? `<small>◆ ${item.classification} özel karakteristik</small>` : ''}</span><span>${low} – ${high} ${item.unit}</span><span>${context.method}</span><span>${context.sample}</span><span>Prosesi durdur, son uygun parçadan itibaren ürünü ayır</span></div>`;
  }).join('');
  document.querySelector('#controlResult .generated-banner small').textContent = `CP-${partNumber.value} / Rev. ${drawingRevision.value} • ${selected.length || productBackbones[productGroup.value].processes.length} operasyon • ${characteristics.length} karakteristik`;
  document.querySelector('#controlResult .doc-footer span').textContent = `${characteristics.length} kontrol satırı gösteriliyor`;
}

document.querySelectorAll('[data-action="generate-control"]').forEach(btn => btn.addEventListener('click', () => {
  renderControlPlan();
  document.getElementById('controlEmpty').classList.add('hidden');
  document.getElementById('controlResult').classList.remove('hidden');
  toast('Kontrol planı oluşturuldu', `${characteristics.length} teknik karakteristik proses kontrolleriyle eşleştirildi.`);
}));

document.querySelectorAll('[data-action="generate-instruction"]').forEach(btn => btn.addEventListener('click', () => {
  showView('instruction');
  document.getElementById('instructionEmpty').classList.add('hidden');
  document.getElementById('instructionResult').classList.remove('hidden');
  toast('Operatör talimatları oluşturuldu', 'Kontrol metotları istasyonlara ve reaksiyon adımlarına dağıtıldı.');
}));

document.querySelectorAll('.instruction-card button').forEach(btn => btn.addEventListener('click', () => {
  const title = btn.closest('.instruction-card').querySelector('h3').textContent;
  toast('Talimat ön izlemesi hazır', `${title} • görsel adımlar ve kontrol noktaları`);
}));

document.querySelector('[data-action="ppap-package"]').addEventListener('click', () => {
  toast('PPAP kalite kapısı çalıştı', 'Paketlenebilir 14 unsur hazır; 4 açık unsur raporlandı.');
});

document.querySelectorAll('.projects-panel .chip').forEach(chip => chip.addEventListener('click', () => {
  document.querySelectorAll('.projects-panel .chip').forEach(item => item.classList.remove('active'));
  chip.classList.add('active');
}));
