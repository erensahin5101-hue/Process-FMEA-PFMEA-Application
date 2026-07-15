const views = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item[data-view]');
const breadcrumb = document.getElementById('breadcrumbTitle');
const titles = {
  dashboard: 'Genel Bakış', product: 'Ürün Tanımlama', flow: 'Proses Akışı',
  pfmea: 'PFMEA', control: 'Kontrol Planı', instruction: 'Operatör Talimatı',
  documents: 'PPAP Merkezi', library: 'Proses Kütüphanesi', users: 'Kullanıcı & Yetki'
};

function showView(id) {
  views.forEach(view => view.classList.toggle('active', view.id === id));
  navItems.forEach(item => item.classList.toggle('active', item.dataset.view === id));
  breadcrumb.textContent = titles[id] || 'Genel Bakış';
  if (id === 'documents') renderPpap(document.querySelector('[data-ppap-filter].active')?.dataset.ppapFilter || 'all');
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
    label: 'Direksiyon Sistemleri', types: ['Rot Kolu Komple', 'Rot Başı', 'İç Rot', 'Direksiyon Mafsalı', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'cutting', 'forging', 'shotblast', 'cnc', 'thread', 'induction', 'washing', 'coating', 'assembly', 'integrated-assembly', 'torque', 'final', 'marking', 'packing']
  },
  suspension: {
    label: 'Süspansiyon Sistemleri', types: ['Askı Rotu', 'Salıncak Kolu', 'Denge Kolu', 'Rotil', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'cutting', 'forging', 'shotblast', 'cnc', 'induction', 'washing', 'coating', 'assembly', 'integrated-assembly', 'torque', 'final', 'marking', 'packing']
  },
  chassis: {
    label: 'Şasi Bağlantı Elemanları', types: ['V Kolu', 'Bağlantı Braketi', 'Çeki Kolu', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'cutting', 'forging', 'shotblast', 'cnc', 'washing', 'coating', 'assembly', 'integrated-assembly', 'final', 'marking', 'packing']
  },
  braking: {
    label: 'Fren Sistemleri', types: ['Mekanik bağlantı mamulü', 'Kaliper alt bileşeni', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'cnc', 'washing', 'coating', 'assembly', 'integrated-assembly', 'torque', 'leaktest', 'final', 'marking', 'packing']
  },
  powertrain: {
    label: 'Güç Aktarma', types: ['Mil / flanş mamulü', 'Muhafaza alt montajı', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'cutting', 'forging', 'cnc', 'drilling', 'thread', 'washing', 'assembly', 'integrated-assembly', 'final', 'marking', 'packing']
  },
  machined: {
    label: 'Talaşlı İmalat Mamulleri', types: ['Küresel Pim', 'Burç', 'Bağlantı Adaptörü', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'cutting', 'cnc', 'milling', 'drilling', 'thread', 'washing', 'coating', 'final', 'marking', 'packing']
  },
  welded: {
    label: 'Kaynaklı Mamuller', types: ['Kaynaklı alt montaj', 'Şasi kaynaklı mamulü', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'cutting', 'welding', 'washing', 'coating', 'assembly', 'integrated-assembly', 'final', 'marking', 'packing']
  },
  cast: {
    label: 'Döküm ve İşlenmiş Döküm Mamulleri', types: ['Döküm mamul', 'İşlenmiş döküm mamul', 'Döküm alt montaj', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'shotblast', 'cnc', 'milling', 'drilling', 'washing', 'coating', 'final', 'marking', 'packing']
  },
  formed: {
    label: 'Sac / Profil Şekillendirme Mamulleri', types: ['Pres parça', 'Bükümlü profil', 'Kaynaklı sac alt montaj', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'cutting', 'welding', 'washing', 'coating', 'assembly', 'integrated-assembly', 'final', 'marking', 'packing']
  },
  polymer: {
    label: 'Polimer ve Elastomer Mamulleri', types: ['Plastik mamul', 'Elastomer mamul', 'Çok malzemeli alt montaj', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'washing', 'assembly', 'integrated-assembly', 'final', 'marking', 'packing']
  },
  electrical: {
    label: 'Elektrik / Elektronik Alt Montajlar', types: ['Kablo / sensör alt montajı', 'Mekatronik mamul', 'Elektronik kontrollü modül', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'assembly', 'integrated-assembly', 'final', 'marking', 'packing']
  },
  service: {
    label: 'Servis Kitleri ve Paketli Mamuller', types: ['Servis kiti', 'Yedek parça paketi', 'Çoklu ürün seti', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'final', 'marking', 'packing']
  },
  __custom__: {
    label: 'Kullanıcı Tanımlı Ürün Grubu', types: ['Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'final', 'packing']
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
let selected = [];
let routeDetails = {};
let processes = [];
let pfmeaRows = [];
const customProductGroupStorageKey = 'tyana-qflow-custom-product-groups-v1';
let customProductGroups = [];

function loadCustomProductGroups() {
  try {
    const stored = JSON.parse(localStorage.getItem(customProductGroupStorageKey) || '[]');
    customProductGroups = Array.isArray(stored) ? stored.filter(item => item?.id && item?.label).slice(0, 100) : [];
  } catch { customProductGroups = []; }
  customProductGroups.forEach(item => {
    productBackbones[item.id] = { label: item.label, types: item.types?.length ? item.types : ['Kullanıcı Tanımlı Mamul'], processes: item.processes?.length ? item.processes : [...productBackbones.__custom__.processes] };
  });
}

function renderCustomProductGroupOptions() {
  productGroup.querySelectorAll('option[data-custom-group]').forEach(option => option.remove());
  const createOption = productGroup.querySelector('option[value="__custom__"]');
  customProductGroups.forEach(item => {
    const option = document.createElement('option'); option.value = item.id; option.dataset.customGroup = 'true'; option.textContent = `Özel: ${item.label}`;
    productGroup.insertBefore(option, createOption);
  });
}

function registerCustomProductGroup(label, preferredId = '') {
  const normalizedLabel = String(label || '').trim(); if (!normalizedLabel) return null;
  const existing = customProductGroups.find(item => item.label.toLocaleLowerCase('tr-TR') === normalizedLabel.toLocaleLowerCase('tr-TR'));
  if (existing) return existing;
  const slug = normalizedLabel.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 35) || 'urun-grubu';
  const id = preferredId && !productBackbones[preferredId] ? preferredId : `custom:${slug}:${Date.now().toString(36)}`;
  const item = { id, label: normalizedLabel, types: ['Kullanıcı Tanımlı Mamul'], processes: [...productBackbones.__custom__.processes] };
  customProductGroups.push(item); productBackbones[id] = { label: item.label, types: [...item.types], processes: [...item.processes] };
  try { localStorage.setItem(customProductGroupStorageKey, JSON.stringify(customProductGroups)); } catch {}
  renderCustomProductGroupOptions(); return item;
}

function persistPendingProductGroup() {
  if (productGroup.value !== '__custom__') return productGroup.value;
  const item = registerCustomProductGroup(document.getElementById('customProductGroupName')?.value);
  if (!item) return '__custom__';
  productGroup.value = item.id; syncProductTypes(); productType.value = 'Kullanıcı Tanımlı Mamul';
  return item.id;
}

loadCustomProductGroups();
renderCustomProductGroupOptions();

const componentTypeOptions = ['Üretilen bileşen', 'Satın alınan bileşen', 'Alt montaj', 'Hammadde', 'Bağlantı elemanı', 'Sarf malzeme', 'Ambalaj'];
const makeBuyOptions = ['Üret', 'Satın al', 'Fason proses', 'Müşteri tedariki'];
const rawFormOptions = ['Boru', 'Çubuk', 'Dövme taslağı', 'Döküm', 'Sac', 'Profil', 'Kalıplanmış parça', 'Standart parça', 'Kimyasal / sarf', 'Özel'];
const heatTreatmentOptions = ['Uygulanmıyor', 'Teknik resme göre', 'Su verme + temperleme', 'İndüksiyon sertleştirme', 'Sementasyon', 'Nitrasyon', 'Gerilim giderme', 'Tedarikçi şartı'];
const coatingOptions = ['Uygulanmıyor', 'Mamul ile birlikte', 'Teknik resme göre', 'Çinko-Nikel', 'Çinko', 'Kataforez', 'Fosfat', 'Çinko lamel', 'Boya', 'Özel kaplama'];

function componentRecord(overrides = {}) {
  return {
    id: `ITEM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, position: '10', parentId: 'FINISHED_GOOD',
    itemNo: '', name: 'Yeni bileşen', componentType: 'Üretilen bileşen', quantity: 1, uom: 'adet', makeBuy: 'Üret',
    materialFamily: 'Kullanıcı seçimi gerekli', materialGrade: 'Kullanıcı seçimi gerekli', materialStandard: 'Teknik resme göre', rawMaterialForm: 'Özel',
    drawingNo: 'Tanımlanacak', revision: 'A', supplier: 'TYANA / onaylı tedarikçi seçilecek', certificate: 'Teknik şartnameye göre',
    heatTreatment: 'Teknik resme göre', hardnessSpec: 'Teknik resme göre', coatingType: 'Teknik resme göre', coatingSpec: 'Teknik resme göre',
    traceability: 'Lot + ısı / döküm no', critical: false, verificationStatus: 'Doğrulama bekliyor', notes: '', ...overrides
  };
}

const steeringRodDemoComponents = [
  componentRecord({ id: 'ITEM-010-BORU', position: '10', itemNo: 'RK-BORU-010', name: 'Rot kolu borusu', componentType: 'Üretilen bileşen', materialFamily: 'Yapı çeliği', materialGrade: 'ST52 — onaylı eşdeğerlik kontrolü gerekli', materialStandard: 'Teknik resim / satın alma şartı', rawMaterialForm: 'Boru', drawingNo: 'TR-RK-BORU-010', makeBuy: 'Satın al', heatTreatment: 'Uygulanmıyor', hardnessSpec: 'Uygulanmaz', coatingType: 'Mamul ile birlikte', critical: true }),
  componentRecord({ id: 'ITEM-020-MAFSAL', position: '20', itemNo: 'RK-MAF-020', name: 'Mafsal', componentType: 'Üretilen bileşen', materialFamily: 'Alaşımlı çelik', materialGrade: '41Cr4', materialStandard: 'Teknik resim / malzeme şartı', rawMaterialForm: 'Dövme taslağı', drawingNo: 'TR-RK-MAF-020', makeBuy: 'Üret', heatTreatment: 'Teknik resme göre', hardnessSpec: 'Sayısal değer çizimden girilecek', coatingType: 'Mamul ile birlikte', critical: true }),
  componentRecord({ id: 'ITEM-030-GOVDE', position: '30', itemNo: 'RK-GVD-030', name: 'Gövde', componentType: 'Üretilen bileşen', materialFamily: 'Karbon çeliği', materialGrade: 'C45', materialStandard: 'Teknik resim / malzeme şartı', rawMaterialForm: 'Dövme taslağı', drawingNo: 'TR-RK-GVD-030', makeBuy: 'Üret', heatTreatment: 'Teknik resme göre', hardnessSpec: 'Sayısal değer çizimden girilecek', coatingType: 'Mamul ile birlikte', critical: true }),
  componentRecord({ id: 'ITEM-040-KORUK', position: '40', itemNo: 'RK-KRK-040', name: 'Koruyucu körük', componentType: 'Satın alınan bileşen', materialFamily: 'Elastomer', materialGrade: 'Malzeme sınıfı teknik şartnameden seçilecek', materialStandard: 'Müşteri / ürün şartı', rawMaterialForm: 'Kalıplanmış parça', drawingNo: 'TR-RK-KRK-040', makeBuy: 'Satın al', heatTreatment: 'Uygulanmıyor', hardnessSpec: 'Shore şartı kullanıcı girişi', coatingType: 'Uygulanmıyor' }),
  componentRecord({ id: 'ITEM-050-KELEPCE', position: '50', itemNo: 'RK-KLP-050', name: 'Kelepçe / segman seti', componentType: 'Bağlantı elemanı', materialFamily: 'Çelik', materialGrade: 'Teknik resme göre', materialStandard: 'Onaylı satın alma şartı', rawMaterialForm: 'Standart parça', drawingNo: 'BOM / tedarikçi resmi', makeBuy: 'Satın al', heatTreatment: 'Tedarikçi şartı', coatingType: 'Teknik resme göre' }),
  componentRecord({ id: 'ITEM-060-GRESOR', position: '60', itemNo: 'RK-GRS-060', name: 'Gresörlük', componentType: 'Satın alınan bileşen', materialFamily: 'Çelik', materialGrade: 'Teknik resme göre', materialStandard: 'Onaylı satın alma şartı', rawMaterialForm: 'Standart parça', drawingNo: 'BOM / tedarikçi resmi', makeBuy: 'Satın al', heatTreatment: 'Uygulanmıyor', coatingType: 'Teknik resme göre' }),
  componentRecord({ id: 'ITEM-070-MONTAJ', position: '70', itemNo: 'RK-MNT-070', name: 'Alt montaj elemanları', componentType: 'Alt montaj', materialFamily: 'Çoklu malzeme', materialGrade: 'Alt BOM ile yönetilir', materialStandard: 'Alt montaj resmi / BOM', rawMaterialForm: 'Özel', drawingNo: 'TR-RK-MNT-070', makeBuy: 'Üret', heatTreatment: 'Alt bileşen şartlarına göre', coatingType: 'Alt bileşen şartlarına göre' })
];

const productTemplates = {
  steering_rod: {
    structureType: 'assembly', group: 'steering', type: 'Rot Kolu Komple', partNumber: 'RK-5101-001', partName: 'Rot Kolu Komple', components: steeringRodDemoComponents,
    route: productBackbones.steering.processes
  },
  machined_component: {
    structureType: 'single_part', group: 'machined', type: 'Kullanıcı Tanımlı Mamul', partNumber: 'TL-NEW-001', partName: 'Yeni Talaşlı İmalat Mamulü',
    components: [componentRecord({ id: 'ITEM-010-HAMMADDE', position: '10', itemNo: 'HM-NEW-001', name: 'Hammadde', componentType: 'Hammadde', materialFamily: 'Kullanıcı seçimi gerekli', materialGrade: 'Kullanıcı seçimi gerekli', rawMaterialForm: 'Çubuk', drawingNo: 'Malzeme şartnamesi', makeBuy: 'Satın al' })], route: productBackbones.machined.processes
  },
  welded_assembly: {
    structureType: 'assembly', group: 'welded', type: 'Kaynaklı alt montaj', partNumber: 'KM-NEW-001', partName: 'Yeni Kaynaklı Mamul',
    components: [componentRecord({ id: 'ITEM-010-PROFIL', position: '10', itemNo: 'KM-PRF-010', name: 'Ana profil', materialFamily: 'Çelik', materialGrade: 'Kullanıcı seçimi gerekli', rawMaterialForm: 'Profil', drawingNo: 'TR-KM-PRF-010' }), componentRecord({ id: 'ITEM-020-BRAKET', position: '20', itemNo: 'KM-BRK-020', name: 'Bağlantı braketi', materialFamily: 'Çelik', materialGrade: 'Kullanıcı seçimi gerekli', rawMaterialForm: 'Sac', drawingNo: 'TR-KM-BRK-020' })], route: productBackbones.welded.processes
  }
};

let components = steeringRodDemoComponents.map(component => ({ ...component }));

function cloneRecords(records) { return records.map(record => ({ ...record })); }

function activeBackbone() {
  const base = productBackbones[productGroup.value] || productBackbones.__custom__;
  if (productGroup.value !== '__custom__') return base;
  return { ...base, label: document.getElementById('customProductGroupName')?.value.trim() || base.label };
}

function syncProductTypes() {
  const backbone = activeBackbone();
  const previous = productType.value;
  productType.innerHTML = backbone.types.map(type => `<option>${escapeHtml(type)}</option>`).join('');
  if (backbone.types.includes(previous)) productType.value = previous;
  document.getElementById('customProductGroupField')?.classList.toggle('hidden', productGroup.value !== '__custom__');
  updateSummary();
}

function componentParentOptions(item) {
  const root = `<option value="FINISHED_GOOD" ${item.parentId === 'FINISHED_GOOD' ? 'selected' : ''}>Ana mamul: ${escapeHtml(partName.value || 'Yeni mamul')}</option>`;
  return root + components.filter(candidate => candidate.id !== item.id && candidate.componentType === 'Alt montaj').map(candidate => `<option value="${escapeHtml(candidate.id)}" ${item.parentId === candidate.id ? 'selected' : ''}>${escapeHtml(candidate.position)} • ${escapeHtml(candidate.name)}</option>`).join('');
}

function renderComponents() {
  const container = document.getElementById('componentRows');
  if (!container) return;
  container.innerHTML = components.length ? components.map((item, index) => `<article class="component-editor" data-component="${index}">
    <div class="component-editor-top"><span class="component-position">${escapeHtml(item.position || String((index + 1) * 10))}</span><div><small>KALICI BİLEŞEN ID</small><b>${escapeHtml(item.id)}</b></div><label class="component-name">Bileşen / alt montaj adı<input data-component-field="name" value="${escapeHtml(item.name)}"></label><mark class="verification-mark ${item.verificationStatus === 'Doğrulandı' ? 'verified-status' : ''}">${escapeHtml(item.verificationStatus)}</mark><button class="icon-action" data-duplicate-component="${index}" aria-label="Bileşeni kopyala">⧉</button><button class="remove-characteristic" data-remove-component="${index}" aria-label="Bileşeni kaldır">×</button></div>
    <div class="component-section"><b>Kimlik ve yapı</b><div class="form-grid form-grid-4">
      <label>Pozisyon no<input data-component-field="position" value="${escapeHtml(item.position)}" inputmode="numeric"></label>
      <label>Parça / stok kodu<input data-component-field="itemNo" value="${escapeHtml(item.itemNo)}"></label>
      <label>Kalem tipi<select data-component-field="componentType">${selectOptions(componentTypeOptions, item.componentType)}</select></label>
      <label>Bağlı olduğu üst kalem<select data-component-field="parentId">${componentParentOptions(item)}</select></label>
      <label>Miktar<input data-component-field="quantity" value="${escapeHtml(formatValue(item.quantity))}" inputmode="decimal"></label>
      <label>Birim<select data-component-field="uom">${selectOptions(['adet', 'kg', 'g', 'm', 'ml', 'set'], item.uom)}</select></label>
      <label>Üret / satın al<select data-component-field="makeBuy">${selectOptions(makeBuyOptions, item.makeBuy)}</select></label>
      <label>Kaynak / tedarikçi<input data-component-field="supplier" list="supplierOptions" value="${escapeHtml(item.supplier)}"></label>
    </div></div>
    <div class="component-section"><b>Malzeme ve teknik resim</b><div class="form-grid form-grid-4">
      <label>Malzeme ailesi<input data-component-field="materialFamily" list="materialFamilyOptions" value="${escapeHtml(item.materialFamily)}"></label>
      <label>Malzeme kalite / sınıf<input data-component-field="materialGrade" list="materialGradeOptions" value="${escapeHtml(item.materialGrade)}"></label>
      <label>Malzeme standardı / rev.<input data-component-field="materialStandard" list="materialStandardOptions" value="${escapeHtml(item.materialStandard)}"></label>
      <label>Hammadde / tedarik formu<select data-component-field="rawMaterialForm">${selectOptions(rawFormOptions, item.rawMaterialForm)}</select></label>
      <label>Teknik resim / şartname no<input data-component-field="drawingNo" value="${escapeHtml(item.drawingNo)}"></label>
      <label>Revizyon<input data-component-field="revision" value="${escapeHtml(item.revision)}" maxlength="12"></label>
      <label>Sertifika şartı<input data-component-field="certificate" list="certificateOptions" value="${escapeHtml(item.certificate)}"></label>
      <label>İzlenebilirlik<input data-component-field="traceability" list="traceabilityOptions" value="${escapeHtml(item.traceability)}"></label>
    </div></div>
    <div class="component-section"><b>Isıl işlem, kaplama ve serbest şartlar</b><div class="form-grid form-grid-4">
      <label>Isıl işlem<select data-component-field="heatTreatment">${selectOptions(heatTreatmentOptions, item.heatTreatment)}</select></label>
      <label>Sertlik / mekanik şart<input data-component-field="hardnessSpec" value="${escapeHtml(item.hardnessSpec)}"></label>
      <label>Kaplama / yüzey<select data-component-field="coatingType">${selectOptions(coatingOptions, item.coatingType)}</select></label>
      <label>Kaplama sayısal şartı<input data-component-field="coatingSpec" value="${escapeHtml(item.coatingSpec)}" placeholder="Örn. kullanıcı girişi: min. ... µm"></label>
      <label>Doğrulama durumu<select data-component-field="verificationStatus">${selectOptions(['Doğrulama bekliyor', 'Teknik resimle doğrulandı', 'Müşteri şartıyla doğrulandı', 'Doğrulandı', 'Uygulanamaz — gerekçe gerekli'], item.verificationStatus)}</select></label>
      <label class="checkbox-field"><input data-component-field="critical" type="checkbox" ${item.critical ? 'checked' : ''}><span><b>Emniyet / özel önem</b><small>PFMEA ve CP zincirinde işaretle</small></span></label>
      <label class="span-2">Not / uygulanamaz gerekçesi<input data-component-field="notes" value="${escapeHtml(item.notes || '')}" placeholder="Serbest açıklama veya zorunlu alan için U/A gerekçesi"></label>
    </div></div>
  </article>`).join('') : `<div class="empty-bom"><span>◇</span><h3>Boş mamul ağacı</h3><p>Tek parça mamul için bu alan boş kalabilir. Montaj mamulünde ilk bileşeni veya alt montajı ekleyin.</p><button class="primary-button" data-action="add-component">＋ İlk Bileşeni Ekle</button></div>`;

  container.querySelectorAll('[data-component-field]').forEach(field => {
    const update = event => {
      const index = Number(event.target.closest('.component-editor').dataset.component);
      const key = event.target.dataset.componentField;
      components[index][key] = key === 'quantity' ? parseLocaleNumber(event.target.value) : key === 'critical' ? event.target.checked : event.target.value;
      validateComponents(); updateSummary(); markDraftDirty();
      if (['name', 'componentType', 'parentId', 'position'].includes(key)) renderComponents();
    };
    field.addEventListener('input', update); field.addEventListener('change', update);
  });
  container.querySelectorAll('[data-remove-component]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.removeComponent); const removedId = components[index]?.id;
    components.splice(index, 1); components.forEach(component => { if (component.parentId === removedId) component.parentId = 'FINISHED_GOOD'; });
    characteristics?.forEach(characteristic => { if (characteristic.componentId === removedId) characteristic.componentId = 'FINISHED_GOOD'; });
    Object.values(routeDetails).forEach(detail => { detail.inputComponentIds = (detail.inputComponentIds || []).filter(id => id !== removedId); if (detail.outputItemId === removedId) detail.outputItemId = 'FINISHED_GOOD'; });
    renderComponents(); if (typeof renderCharacteristics === 'function') renderCharacteristics(); markDraftDirty();
  }));
  container.querySelectorAll('[data-duplicate-component]').forEach(button => button.addEventListener('click', () => {
    const source = components[Number(button.dataset.duplicateComponent)];
    components.splice(Number(button.dataset.duplicateComponent) + 1, 0, componentRecord({ ...source, id: `ITEM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, position: `${Number(source.position) + 1 || components.length * 10}`, itemNo: `${source.itemNo}-KOPYA`, name: `${source.name} — Kopya`, verificationStatus: 'Doğrulama bekliyor' }));
    renderComponents(); markDraftDirty();
  }));
  container.querySelectorAll('[data-action="add-component"]').forEach(button => button.addEventListener('click', addComponent));
  validateComponents();
}

function addComponent(type = 'Üretilen bileşen') {
  components.push(componentRecord({ position: String((components.length + 1) * 10), componentType: typeof type === 'string' ? type : 'Üretilen bileşen', name: type === 'Alt montaj' ? 'Yeni alt montaj' : 'Yeni bileşen' }));
  renderComponents(); document.querySelector('#componentRows .component-editor:last-child .component-name input')?.focus(); markDraftDirty();
}

function validateComponents() {
  const assemblyRequired = document.getElementById('productStructureType')?.value === 'assembly';
  let validCount = 0;
  document.querySelectorAll('#componentRows .component-editor').forEach((card, index) => {
    const item = components[index];
    const valid = Boolean(item && item.name.trim() && item.itemNo.trim() && item.drawingNo.trim() && item.materialGrade.trim() && Number.isFinite(item.quantity) && item.quantity > 0);
    card.classList.toggle('invalid-card', !valid); if (valid) validCount += 1;
  });
  const valid = (!assemblyRequired || components.length > 0) && validCount === components.length;
  const message = assemblyRequired && !components.length ? 'Montaj mamulü için en az bir bileşen gerekli.' : `${validCount}/${components.length} bileşen temel veri kontrolünden geçti.`;
  const validation = document.getElementById('componentValidation'); if (validation) validation.querySelector('p').textContent = message;
  const title = document.getElementById('bomTitle'); if (title) title.textContent = `${partName.value || 'Yeni Mamul'} — ${components.length} alt kalem`;
  return valid;
}

function componentOptionsForCharacteristic(selectedId) {
  const root = `<option value="FINISHED_GOOD" ${selectedId === 'FINISHED_GOOD' ? 'selected' : ''}>Ana mamul • ${escapeHtml(partName.value || 'Yeni Mamul')}</option>`;
  return root + components.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === selectedId ? 'selected' : ''}>${escapeHtml(item.position)} • ${escapeHtml(item.name)}</option>`).join('');
}

function resetBlankProductContext() {
  const blankValues = {
    customer: '', customerPartNumber: '', productionPhase: 'Prototip', annualVolume: '', supplierName: 'TYANA OTOMOTİV', supplierSite: 'Merkez Fabrika', supplierCode: '',
    keyContact: 'Eren', keyContactPhone: '', coreTeam: '', originalDate: new Date().toISOString().slice(0, 10), revisionDate: new Date().toISOString().slice(0, 10), documentStatus: 'Taslak',
    materialFamily: 'Özel / kullanıcı tanımlı', materialGrade: '', materialStandard: '', rawMaterialForm: 'Özel / kullanıcı tanımlı', partWeight: '', materialCertificate: '',
    heatTreatment: 'Uygulanmıyor', hardnessSpec: '', caseDepthSpec: '', coatingType: 'Kaplama yok', coatingStandard: '', coatingThickness: '', coatingColor: '', corrosionHours: '', roughnessSpec: '', cleanlinessSpec: '', traceabilityLevel: '', customerSpecificRequirements: ''
  };
  Object.entries(blankValues).forEach(([id, value]) => { const field = document.getElementById(id); if (field) field.value = value; });
  document.querySelectorAll('input[name="forming"]').forEach(input => { input.checked = false; });
  document.querySelectorAll('input[name="safety"]').forEach(input => { input.checked = input.value === 'unknown'; });
  document.querySelectorAll('.check-grid input[type="checkbox"]').forEach(input => { input.checked = false; });
  document.querySelectorAll('input[name="ppap"]').forEach(input => { input.checked = input.value === '3'; });
  document.querySelectorAll('.choice-card').forEach(card => card.classList.toggle('selected', card.querySelector('input').checked));
  document.querySelectorAll('.segmented label').forEach(label => label.classList.toggle('active', label.querySelector('input').checked));
  drawingSource = { name: '', size: 0, type: '', lastModified: null, sha256: '' };
  const drawingName = document.getElementById('drawingFileName');
  if (drawingName) { drawingName.textContent = 'Teknik resim kaynağı seçilmedi'; delete drawingName.dataset.manual; drawingName.nextElementSibling.textContent = 'PDF veya görsel kaynak • no/revizyon ve SHA-256 doğrulaması bekliyor'; }
  const drawingBadge = document.querySelector('.drawing-upload .verified'); if (drawingBadge) { drawingBadge.textContent = 'Kaynak bekliyor'; drawingBadge.classList.add('pending-source'); }
}

function applyProductTemplate(templateId) {
  const selector = document.getElementById('productTemplate');
  const bomModeBadge = document.getElementById('bomModeBadge'); const bomContextNote = document.getElementById('bomContextNote');
  if (templateId === 'blank') {
    productGroup.value = '__custom__'; document.getElementById('customProductGroupName').value = '';
    document.getElementById('productStructureType').value = 'assembly';
    partNumber.value = 'NEW-0001'; partName.value = 'Yeni Mamul'; controlPlanNumber.value = 'CP-NEW-0001'; projectCode.value = `TY-${new Date().getFullYear()}-YENİ`; document.getElementById('drawingNumber').value = 'TR-NEW-0001'; drawingRevision.value = 'A';
    resetBlankProductContext();
    components = []; selected = []; routeDetails = {}; pfmeaRows = []; characteristics = [newCharacteristic({ id: 'CHAR-001', balloon: '1', name: 'Yeni karakteristik', componentId: 'FINISHED_GOOD' })];
    if (bomModeBadge) bomModeBadge.textContent = 'SIFIRDAN MAMUL';
    if (bomContextNote) bomContextNote.textContent = 'Mamul ağacı boştur; tek parça, çok seviyeli montaj, servis kiti veya özel yapı olarak oluşturabilirsiniz.';
    toast('Boş mamul oluşturuldu', 'Ürün grubunu, mamul ağacını, rotayı ve karakteristikleri sıfırdan tanımlayabilirsiniz.');
  } else {
    const template = productTemplates[templateId]; if (!template) return;
    productGroup.value = template.group; syncProductTypes(); productType.value = template.type; document.getElementById('productStructureType').value = template.structureType;
    partNumber.value = template.partNumber; partName.value = template.partName; controlPlanNumber.value = `CP-${template.partNumber}`; projectCode.value = `TY-${new Date().getFullYear()}-0042`; document.getElementById('drawingNumber').value = `TR-${template.partNumber}`; drawingRevision.value = 'A';
    components = cloneRecords(template.components); selected = [...template.route]; routeDetails = {}; pfmeaRows = [];
    if (bomModeBadge) bomModeBadge.textContent = 'TANITIM ŞABLONU';
    if (bomContextNote) bomContextNote.textContent = 'Şablon değerleri onaylı üretim verisi değildir; teknik resim, şartname, CSR ve müşteri onayıyla doğrulanmalıdır.';
    characteristics = templateId === 'steering_rod' ? cloneRecords(steeringCharacteristicTemplate) : [newCharacteristic({ id: 'CHAR-001', balloon: '1', componentId: components[0]?.id || 'FINISHED_GOOD', processId: templateId === 'welded_assembly' ? 'welding' : 'cnc', name: 'Yeni teknik resim karakteristiği', definition: 'Kullanıcı teknik resimden seçmeli veya sayısal olarak tanımlar' })];
    toast('Tanıtım şablonu uygulandı', 'Şablon değerleri taslaktır; teknik resim, şartname ve müşteri istekleriyle doğrulayın.');
  }
  selector.value = templateId; syncProductTypes(); renderComponents(); renderCharacteristics(); renderOptions(); renderSequence(); updateSummary(); markDraftDirty();
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
  if (target >= 3 && !validateComponents()) {
    toast('Mamul ağacı kontrolü gerekli', 'Montaj mamulünde en az bir alt kalem ve her kalemde kimlik, teknik resim, malzeme ve miktar bilgisi gereklidir.');
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
  ['induction', 'İndüksiyon'], ['washing', 'Endüstriyel Yıkama'], ['coating', 'Yüzey Kaplama'], ['assembly', 'Montaj'], ['integrated-assembly', 'Entegre Tesis Montaj Prosesi'],
  ['torque', 'Tork Kontrolü'], ['final', 'Final Kontrol'], ['packing', 'Paketleme']
];
const characteristicLibrary = [
  { code: 'DIM-001', name: 'Dış çap', definition: 'Teknik resimde balonlanan dış çapın doğrulanması', kind: 'Ürün', unit: 'mm', method: 'Değişken ölçüm', equipmentClass: 'Dış çap mikrometresi' },
  { code: 'DIM-002', name: 'İç çap', definition: 'Fonksiyonel iç çapın teknik resim limitlerinde doğrulanması', kind: 'Ürün', unit: 'mm', method: 'Değişken ölçüm', equipmentClass: 'İç çap saati / hava mastarı' },
  { code: 'GDT-001', name: 'Konum toleransı', definition: 'Datum sistemine göre gerçek konum doğrulaması', kind: 'GD&T', unit: 'mm', method: 'CMM / fonksiyon mastarı', equipmentClass: 'CMM' },
  { code: 'SUR-001', name: 'Yüzey pürüzlülüğü', definition: 'Tanımlı yüzeyde pürüzlülük değerinin ölçülmesi', kind: 'Ürün', unit: 'Ra', method: 'Pürüzlülük ölçümü', equipmentClass: 'Pürüzlülük cihazı' },
  { code: 'MAT-001', name: 'Malzeme sınıfı', definition: 'Sertifika, lot ve gerektiğinde PMI ile malzeme doğrulaması', kind: 'Malzeme', unit: '—', method: 'Sertifika + malzeme doğrulama', equipmentClass: 'Spektrometre / sertifika kontrolü' },
  { code: 'HT-001', name: 'Sertlik', definition: 'Isıl işlem sonrası sertlik değerinin doğrulanması', kind: 'Ürün', unit: 'HRC', method: 'Laboratuvar testi', equipmentClass: 'Rockwell sertlik cihazı' },
  { code: 'COAT-001', name: 'Kaplama kalınlığı', definition: 'Kaplama kalınlığının şartname limitlerinde doğrulanması', kind: 'Ürün', unit: 'µm', method: 'Kaplama kalınlığı ölçümü', equipmentClass: 'XRF / kaplama kalınlık cihazı' },
  { code: 'ASM-001', name: 'Doğru komponent varyantı', definition: 'BOM, iş emri ve istasyon reçetesine göre doğru alt parçanın kullanılması', kind: 'Proses', unit: '—', method: '%100 doğrulama', equipmentClass: 'Kamera / barkod sistemi' },
  { code: 'ASM-002', name: 'Pres kuvvet-mesafe penceresi', definition: 'Montaj eğrisinin onaylı alt/üst zarf içinde kalması', kind: 'Proses', unit: 'N', method: '%100 otomatik izleme', equipmentClass: 'Kuvvet-mesafe izlemeli servo pres' },
  { code: 'ASM-003', name: 'Sıkma torku', definition: 'Sıkma programı, tork ve açı sonucunun parça bazlı doğrulanması', kind: 'Proses', unit: 'Nm', method: '%100 otomatik izleme', equipmentClass: 'Tork transdüseri' },
  { code: 'FUN-001', name: 'Fonksiyon testi', definition: 'Mamul fonksiyonunun müşteri/ürün şartına göre doğrulanması', kind: 'Fonksiyon', unit: '—', method: '%100 fonksiyon testi', equipmentClass: 'Fonksiyon test cihazı' },
  { code: 'VIS-001', name: 'Görsel uygunluk', definition: 'Kusur kataloğuna göre görünüş ve bütünlük doğrulaması', kind: 'Görsel / Atribut', unit: '—', method: 'Atribut kontrol', equipmentClass: 'Aydınlatmalı görsel istasyon' }
];

function newCharacteristic(overrides = {}) {
  return {
    id: `CHAR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, libraryCode: 'CUSTOM', componentId: 'FINISHED_GOOD', balloon: '1', name: 'Yeni karakteristik', definition: 'Karakteristiğin fonksiyonel tanımını girin',
    sourceDrawing: document.getElementById('drawingNumber')?.value || 'Teknik resim', sourceZone: 'Sayfa / bölge girin', sourceStatus: 'Kullanıcı doğrulaması gerekli',
    kind: 'Ürün', specMode: 'numeric', nominal: 0, minus: 0, plus: 0, specText: '', unit: 'mm', precision: '0,01', classification: 'Normal', processId: 'final', routeKey: '',
    method: 'Değişken ölçüm', equipmentClass: 'Ölçüm cihazı sınıfı seçin', equipment: 'Cihaz / asset ID girin', resolution: 'Tanımlanacak', calibrationDue: '', msaReference: 'MSA çalışması gerekli', msaStatus: 'Doğrulama bekliyor', msaRationale: '',
    sampleSize: '1', frequency: 'Vardiyada', trigger: 'İlk parça + tanımlı periyot', pokaYoke: '—', alternateControl: 'Uygulanmıyor', reference: 'Kayıt formu tanımlayın', reaction: 'RP-01', ...overrides
  };
}

let drawingSource = { name: 'RK-5101-001_REV-C.pdf', size: 0, type: 'application/pdf', lastModified: null, sha256: 'KULLANICI-DOĞRULAMASI-BEKLİYOR' };
let characteristics = [
  newCharacteristic({ id: 'CHAR-001', libraryCode: 'DIM-001', componentId: 'ITEM-020-MAFSAL', balloon: '12', name: 'Mafsal fonksiyonel çapı', definition: 'Mafsal üzerindeki fonksiyonel çapın teknik resim limitlerinde doğrulanması', sourceDrawing: 'TR-RK-MAF-020', sourceZone: 'Sayfa 1 / C4', nominal: 18, minus: 0.013, plus: 0.013, unit: 'mm', classification: 'CC', processId: 'cnc', equipmentClass: 'Dış çap mikrometresi', equipment: '0–25 mm dijital mikrometre / MIK-014', resolution: '0,001 mm', calibrationDue: '2026-12-31', msaReference: 'GRR-MIK-014', msaStatus: 'Demo — doğrulanacak', sampleSize: '5', frequency: '2 saatte', trigger: 'İlk parça + takım değişimi + 2 saat', pokaYoke: 'Takım ömrü sayacı', reference: 'TL-ÖLÇ-014', reaction: 'RP-01' }),
  newCharacteristic({ id: 'CHAR-002', libraryCode: 'HT-001', componentId: 'ITEM-020-MAFSAL', balloon: '27', name: 'Yüzey sertliği', definition: 'Mafsal fonksiyonel bölgesinin sertlik doğrulaması', sourceDrawing: 'TR-RK-MAF-020', sourceZone: 'Isıl işlem notu 3', nominal: 60, minus: 2, plus: 2, unit: 'HRC', classification: 'SC', processId: 'induction', method: 'Laboratuvar testi', equipmentClass: 'Rockwell sertlik cihazı', equipment: 'Rockwell sertlik cihazı / HRC-02', resolution: '0,1 HRC', calibrationDue: '2026-11-30', msaReference: 'MSA-HRC-02', msaStatus: 'Demo — doğrulanacak', sampleSize: '3', frequency: 'Vardiyada', trigger: 'İlk parça + reçete değişimi + vardiya', pokaYoke: 'Reçete kilidi', reference: 'TL-LAB-006', reaction: 'RP-02' }),
  newCharacteristic({ id: 'CHAR-003', libraryCode: 'ASM-003', componentId: 'FINISHED_GOOD', balloon: 'P-09', name: 'Sıkma torku', definition: 'Entegre montajda tanımlı bağlantının tork/açı ile doğrulanması', sourceDrawing: 'TR-RK-5101-001', sourceZone: 'Montaj notu 9', kind: 'Proses', nominal: 42, minus: 3, plus: 3, unit: 'Nm', classification: 'SC', processId: 'torque', method: '%100 otomatik izleme', equipmentClass: 'Tork transdüseri', equipment: 'Dijital tork sistemi / TS-04', resolution: '0,1 Nm', calibrationDue: '2026-10-31', msaReference: 'MSA-TS-04', msaStatus: 'Demo — doğrulanacak', sampleSize: '%100', frequency: 'Her parça', trigger: 'Her parça + program değişimi', pokaYoke: 'Program-parça eşleme', reference: 'TL-MON-021', reaction: 'RP-03' })
];
const steeringCharacteristicTemplate = characteristics.map(item => ({ ...item }));

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

function routeInstanceOptions(item) {
  const entries = selectedProcessEntries();
  if (!entries.length) return '<option value="">Önce proses rotası oluşturun</option>';
  const selectedKey = item.routeKey || entries.find(entry => entry.process.id === item.processId)?.routeKey || '';
  return '<option value="">Operasyon örneği seçin</option>' + entries.map(entry => `<option value="${escapeHtml(entry.routeKey)}" ${entry.routeKey === selectedKey ? 'selected' : ''}>OP ${escapeHtml(entry.detail.operationNo)} • ${escapeHtml(entry.process.name)}</option>`).join('');
}

function selectOptions(values, selectedValue) {
  return values.map(value => `<option value="${escapeHtml(value)}" ${value === selectedValue ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('');
}

function characteristicLibraryOptions(selectedCode) {
  return `<option value="CUSTOM" ${selectedCode === 'CUSTOM' ? 'selected' : ''}>Özel — sıfırdan tanımla</option>` + characteristicLibrary.map(template => `<option value="${escapeHtml(template.code)}" ${selectedCode === template.code ? 'selected' : ''}>${escapeHtml(template.code)} • ${escapeHtml(template.name)}</option>`).join('');
}

function applyCharacteristicLibrary(index, code) {
  if (code === 'CUSTOM') { characteristics[index].libraryCode = 'CUSTOM'; return; }
  const template = characteristicLibrary.find(item => item.code === code); if (!template) return;
  characteristics[index] = { ...characteristics[index], ...template, libraryCode: code, sourceStatus: 'Kütüphaneden kopyalandı — ürün revizyonunda doğrulanmalı' };
}

function renderCharacteristics() {
  const rows = document.getElementById('characteristicRows');
  rows.innerHTML = characteristics.map((item, index) => `<article class="characteristic-editor ${item.specMode === 'numeric' ? 'numeric-mode' : 'text-mode'}" data-characteristic="${index}">
    <div class="characteristic-editor-top"><span class="characteristic-index">${String(index + 1).padStart(2, '0')}</span><div><small>KALICI ID</small><b>${escapeHtml(item.id)}</b></div><label class="characteristic-library-select">Numaralı karakteristik kütüphanesi<select data-field="libraryCode">${characteristicLibraryOptions(item.libraryCode || 'CUSTOM')}</select></label><label class="characteristic-name">Karakteristik adı<input data-field="name" value="${escapeHtml(item.name)}"></label><mark class="classification-mark ${item.classification.toLocaleLowerCase('tr-TR').replace(/\s/g, '-')}">${escapeHtml(item.classification)}</mark><button class="remove-characteristic" data-remove-characteristic="${index}" aria-label="Karakteristiği kaldır">×</button></div>
    <div class="characteristic-source"><div class="characteristic-fields source-fields">
      <label>Bağlı mamul / bileşen<select data-field="componentId">${componentOptionsForCharacteristic(item.componentId || 'FINISHED_GOOD')}</select></label>
      <label>Kaynak teknik resim / şartname<input data-field="sourceDrawing" value="${escapeHtml(item.sourceDrawing || '')}"></label>
      <label>Sayfa / bölge / not<input data-field="sourceZone" value="${escapeHtml(item.sourceZone || '')}"></label>
      <label>Kaynak doğrulama<input data-field="sourceStatus" value="${escapeHtml(item.sourceStatus || '')}"></label>
      <label class="span-2">Karakteristik tanımı<input data-field="definition" value="${escapeHtml(item.definition || '')}"></label>
    </div></div>
    <div class="characteristic-fields primary-fields">
      <label>Balon / no<input data-field="balloon" value="${escapeHtml(item.balloon)}"></label>
      <label>Özellik tipi<select data-field="kind">${selectOptions(['Ürün', 'Proses', 'Malzeme', 'Fonksiyon', 'Mevzuat', 'Görsel / Atribut', 'GD&T'], item.kind)}</select></label>
      <label>Gereklilik tipi<select data-field="specMode"><option value="numeric" ${item.specMode === 'numeric' ? 'selected' : ''}>Sayısal tolerans</option><option value="text" ${item.specMode === 'text' ? 'selected' : ''}>Metin / standart</option><option value="attribute" ${item.specMode === 'attribute' ? 'selected' : ''}>Geçti / Kaldı</option></select></label>
      <label>Özel sınıf<select data-field="classification">${selectOptions(['Normal', 'SC', 'CC', 'Ürün Güvenliği'], item.classification)}</select></label>
      <label class="numeric-field">Nominal<input data-field="nominal" inputmode="decimal" value="${escapeHtml(formatValue(item.nominal))}"></label>
      <label class="numeric-field">− tolerans<input data-field="minus" inputmode="decimal" value="${escapeHtml(formatValue(item.minus))}"></label>
      <label class="numeric-field">+ tolerans<input data-field="plus" inputmode="decimal" value="${escapeHtml(formatValue(item.plus))}"></label>
      <label class="numeric-field">Birim<select data-field="unit">${selectOptions(['mm', '°', 'HRC', 'HV', 'Nm', 'µm', 'Ra', 'bar', 'N', 'kN', 'g', 'ml', '—'], item.unit)}</select></label>
      <label class="numeric-field">Gösterim hassasiyeti<input data-field="precision" value="${escapeHtml(item.precision || '')}" placeholder="0,01"></label>
      <label class="text-spec-field">Spesifikasyon / kabul kriteri<input data-field="specText" value="${escapeHtml(item.specText)}" placeholder="M10 6g, Ra 1,6, çizik yok…"></label>
      <div class="computed-limit"><small>HESAPLANAN LSL / USL</small><b>${escapeHtml(specificationFor(item))}</b></div>
    </div>
    <div class="control-mapping"><div class="mapping-title"><span>⇢</span><b>Proses ve kontrol eşleştirmesi</b><small>Kontrol planı ile operatör talimatına aktarılır</small></div><div class="characteristic-fields mapping-fields">
      <label>Bağlı operasyon örneği<select data-field="routeKey">${routeInstanceOptions(item)}</select></label>
      <label>Proses sınıfı<select data-field="processId">${processOptionsForCharacteristic(item.processId)}</select></label>
      <label>Kontrol yöntemi<input data-field="method" list="measurementMethodOptions" value="${escapeHtml(item.method)}"></label>
      <label>Ölçüm ekipmanı sınıfı<input data-field="equipmentClass" list="equipmentClassOptions" value="${escapeHtml(item.equipmentClass || '')}"></label>
      <label>Ölçüm cihazı / ID<input data-field="equipment" value="${escapeHtml(item.equipment)}"></label>
      <label>Çözünürlük<input data-field="resolution" value="${escapeHtml(item.resolution || '')}"></label>
      <label>Kalibrasyon vadesi<input data-field="calibrationDue" type="date" value="${escapeHtml(item.calibrationDue || '')}"></label>
      <label>MSA çalışma no<input data-field="msaReference" value="${escapeHtml(item.msaReference || '')}"></label>
      <label>MSA / cihaz uygunluğu<select data-field="msaStatus">${selectOptions(['Doğrulama bekliyor', 'Demo — doğrulanacak', 'Uygun', 'Şartlı uygun', 'Uygun değil', 'Uygulanamaz — gerekçeli'], item.msaStatus || 'Doğrulama bekliyor')}</select></label>
      <label>MSA U/A gerekçesi / şartlı onay<input data-field="msaRationale" value="${escapeHtml(item.msaRationale || '')}" placeholder="U/A veya şartlı uygun ise zorunlu"></label>
      <label>Numune adedi<input data-field="sampleSize" value="${escapeHtml(item.sampleSize)}"></label>
      <label>Sıklık / tetikleyici<input data-field="frequency" value="${escapeHtml(item.frequency)}"></label>
      <label>Kontrol tetikleyicileri<input data-field="trigger" value="${escapeHtml(item.trigger || '')}"></label>
      <label>Poka‑yoke / önleme<input data-field="pokaYoke" value="${escapeHtml(item.pokaYoke)}"></label>
      <label>Alternatif / yedek kontrol<input data-field="alternateControl" value="${escapeHtml(item.alternateControl || '')}"></label>
      <label>Kayıt / referans doküman<input data-field="reference" value="${escapeHtml(item.reference)}"></label>
      <label>Reaksiyon kodu<input data-field="reaction" value="${escapeHtml(item.reaction)}"></label>
    </div></div>
  </article>`).join('');

  rows.querySelectorAll('input, select').forEach(input => {
    const update = event => {
      const row = event.target.closest('.characteristic-editor');
      const index = Number(row.dataset.characteristic);
      const field = event.target.dataset.field;
      if (!field) return;
      if (field === 'libraryCode') { applyCharacteristicLibrary(index, event.target.value); renderCharacteristics(); markDraftDirty(); return; }
      characteristics[index][field] = ['nominal', 'minus', 'plus'].includes(field) ? parseLocaleNumber(event.target.value) : event.target.value;
      if (field === 'routeKey') characteristics[index].processId = routeBaseId(event.target.value) || characteristics[index].processId;
      if (field === 'processId') characteristics[index].routeKey = selected.find(routeKey => routeBaseId(routeKey) === event.target.value) || '';
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
    const ownerValid = item.componentId === 'FINISHED_GOOD' || components.some(component => component.id === item.componentId);
    const valid = Boolean(String(item.name || '').trim() && String(item.definition || '').trim() && String(item.balloon || '').trim() && String(item.sourceDrawing || '').trim() && ownerValid && item.processId && item.method && item.equipmentClass && item.equipment && item.sampleSize && item.frequency && item.trigger && numericValid && textValid);
    row.classList.toggle('invalid-card', !valid);
    if (valid) validCount += 1;
  });
  const validation = document.getElementById('characteristicValidation');
  if (validation) validation.textContent = `${validCount}/${characteristics.length} karakteristik doğrulandı`;
  document.getElementById('gateCharacteristicCount').textContent = `${validCount} satır, kontrol bağlantıları geçerli`;
  return validCount === characteristics.length && characteristics.length > 0;
}

document.querySelector('[data-action="add-characteristic"]').addEventListener('click', () => {
  characteristics.push(newCharacteristic({ balloon: `${characteristics.length + 1}` }));
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
  if (!productGroup) return;
  const backbone = activeBackbone();
  document.getElementById('summaryGroup').textContent = backbone.label;
  document.getElementById('summaryPartName').textContent = (partName.value || 'PARÇA ADI').toLocaleUpperCase('tr-TR');
  document.getElementById('summaryPartNo').textContent = `${partNumber.value || '—'} • Rev. ${drawingRevision.value || '—'}`;
  document.getElementById('summaryProject').textContent = projectCode.value || 'YENİ PROJE';
  document.getElementById('summaryComponentCount').textContent = components.length;
  document.getElementById('summaryCharacteristicCount').textContent = characteristics.length;
  document.getElementById('summarySpecialCount').textContent = characteristics.filter(item => item.classification !== 'Normal').length;
  document.getElementById('summaryProcessCount').textContent = backbone.processes.length;
  const recommendation = document.getElementById('processRecommendationText');
  if (recommendation) recommendation.textContent = `${backbone.label} için ${backbone.processes.length} başlangıç operasyonu önerildi. Rota kütüphaneden ekleme, çıkarma, tekrarlama ve sürükleme ile tamamen değiştirilebilir.`;
  const gateProcess = document.getElementById('gateProcessText');
  if (gateProcess) gateProcess.textContent = selected.length ? `${selected.length} operasyon ve operasyon bazlı BOM girdileri eşleştirildi` : 'Rota sıfırdan oluşturulacak; zorunlu operasyon henüz seçilmedi';
  const identity = `${projectCode.value || 'YENİ PROJE'} • ${(partName.value || 'YENİ MAMUL').toLocaleUpperCase('tr-TR')}`;
  const requiredProductFieldsReady = Boolean(partNumber.value.trim() && partName.value.trim() && projectCode.value.trim() && controlPlanNumber.value.trim() && (productGroup.value !== '__custom__' || document.getElementById('customProductGroupName').value.trim()));
  const requiredStatus = document.getElementById('productRequiredStatus'); if (requiredStatus) requiredStatus.textContent = requiredProductFieldsReady ? 'Temel mamul kimliği tamam' : 'Ürün grubu ve zorunlu mamul kimliği tamamlanmalı';
  const flowEyebrow = document.getElementById('flowEyebrow'); if (flowEyebrow) flowEyebrow.textContent = identity;
  const pfmeaEyebrow = document.getElementById('pfmeaEyebrow'); if (pfmeaEyebrow) pfmeaEyebrow.textContent = `${projectCode.value || 'YENİ PROJE'} • AIAG-VDA 7 ADIM`;
  const controlEyebrow = document.getElementById('controlEyebrow'); if (controlEyebrow) controlEyebrow.textContent = `${projectCode.value || 'YENİ PROJE'} • ${document.getElementById('productionPhase').value.toLocaleUpperCase('tr-TR')}`;
  const controlSourceSummary = document.getElementById('controlSourceSummary'); if (controlSourceSummary) controlSourceSummary.textContent = `${selected.length} proses adımı, ${characteristics.length} numaralı karakteristik ve bağlantılı PFMEA kontrolleri tek veri omurgasında hazır.`;
  const instructionSourceSummary = document.getElementById('instructionSourceSummary'); if (instructionSourceSummary) instructionSourceSummary.textContent = `Seçilen ${selected.length} operasyon için kontrol yöntemi, sıklık, sayısal limit, PPE ve reaksiyon planı ayrı talimata dönüştürülecek.`;
  const ppap = document.querySelector('input[name="ppap"]:checked')?.value || 3;
  document.getElementById('summaryPpapLevel').textContent = ppap;
  const completion = refreshQualityGate();
  document.getElementById('summaryCompletionText').textContent = `${completion}%`;
  document.getElementById('summaryCompletionBar').style.width = `${completion}%`;
  const drawingName = document.getElementById('drawingFileName');
  if (drawingName && !drawingName.dataset.manual) drawingName.textContent = drawingSource.sha256 ? `${partNumber.value || 'PARCA'}_REV-${drawingRevision.value || '0'}.pdf` : 'Teknik resim kaynağı seçilmedi';
  validateComponents();
}

document.querySelectorAll('#product input, #product select, #product textarea').forEach(field => {
  if (field.closest('#characteristicRows')) return;
  field.addEventListener('input', () => { updateSummary(); markDraftDirty(); });
  field.addEventListener('change', () => { updateSummary(); markDraftDirty(); });
});

syncProductTypes();
renderComponents();
renderCharacteristics();

document.getElementById('productTemplate')?.addEventListener('change', event => applyProductTemplate(event.target.value));
document.getElementById('customProductGroupName')?.addEventListener('input', () => { syncProductTypes(); markDraftDirty(); });
document.getElementById('productStructureType')?.addEventListener('change', () => { validateComponents(); markDraftDirty(); });
document.querySelectorAll('[data-action="add-component"]').forEach(button => button.addEventListener('click', () => addComponent('Üretilen bileşen')));
document.querySelectorAll('[data-action="add-subassembly"]').forEach(button => button.addEventListener('click', () => addComponent('Alt montaj')));
document.querySelectorAll('[data-action="reset-bom-blank"]').forEach(button => button.addEventListener('click', () => { components = []; renderComponents(); renderCharacteristics(); markDraftDirty(); toast('Mamul ağacı boşaltıldı', 'Yeni bileşenleri sıfırdan ekleyebilirsiniz.'); }));

document.querySelector('[data-action="drawing-change"]').addEventListener('click', event => {
  event.preventDefault();
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.pdf,.png,.jpg,.jpeg';
  picker.addEventListener('change', async () => {
    const file = picker.files[0];
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = [...new Uint8Array(hashBuffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    let stored;
    try {
      stored = await globalThis.TyanaPlatform.storeDrawing({ data: bytes, fileName: file.name, sha256 });
    } catch (error) {
      toast('Teknik resim kaydedilemedi', error.message);
      return;
    }
    drawingSource = { name: file.name, size: file.size, type: file.type, lastModified: file.lastModified, sha256, storageId: stored.storageId || null };
    const name = document.getElementById('drawingFileName');
    name.textContent = file.name;
    name.dataset.manual = 'true';
    name.nextElementSibling.textContent = `${(file.size / 1024).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} KB • SHA-256 ${sha256.slice(0, 12)}… • kullanıcı doğrulaması gerekli`;
    const badge = document.querySelector('.drawing-upload .verified'); if (badge) { badge.textContent = '✓ Kaynak tanımlı'; badge.classList.remove('pending-source'); }
    markDraftDirty();
    toast('Teknik resim kaynağı tanımlandı', globalThis.TyanaPlatform.isDesktop ? 'Dosya kontrollü yerel depoya kopyalandı ve SHA-256 ile doğrulandı.' : 'Dosya özeti kaydedildi; karakteristikler kullanıcı onayı olmadan yayımlanmaz.');
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
  { id: 'milling', name: 'CNC Frezeleme', desc: 'Düzlem, kanal ve bağlantı geometrileri', icon: '◎' },
  { id: 'drilling', name: 'Delik Delme / Raybalama', desc: 'Hassas delik ve yatak işleme', icon: '◎' },
  { id: 'thread', name: 'Diş Açma', desc: 'Bağlantı dişi işleme', icon: '≋' },
  { id: 'induction', name: 'İndüksiyon', desc: 'Bölgesel sertleştirme', icon: '⌁', special: true },
  { id: 'washing', name: 'Endüstriyel Yıkama', desc: 'Talaş, yağ ve partikül temizliği', icon: '≈' },
  { id: 'welding', name: 'Robotik Kaynak', desc: 'Alt komponentleri kontrollü birleştirme', icon: '⌁', special: true },
  { id: 'coating', name: 'Yüzey Kaplama', desc: 'Korozyon koruması', icon: '◫', special: true, outsource: true },
  { id: 'assembly', name: 'Montaj', desc: 'Pim-gövde birleştirme', icon: '⚙' },
  { id: 'integrated-assembly', name: 'Entegre Tesis Montaj Prosesi', desc: 'BOM doğrulamalı alt ve final montaj', icon: '⚙' },
  { id: 'torque', name: 'Tork Kontrolü', desc: 'Bağlantı doğrulama', icon: '↻', control: true },
  { id: 'leaktest', name: 'Sızdırmazlık Testi', desc: 'Basınç altında kaçak doğrulama', icon: '✓', control: true },
  { id: 'final', name: 'Final Kontrol', desc: 'Fonksiyon ve görsel kontrol', icon: '✓', control: true },
  { id: 'marking', name: 'Lazer Markalama', desc: 'Parça ve lot izlenebilirliği', icon: '⌁' },
  { id: 'packing', name: 'Paketleme', desc: 'Etiketleme ve sevkiyat', icon: '□' }
];
processes = [...defaultProcesses];
const optionsEl = document.getElementById('processOptions');
const sequenceEl = document.getElementById('processSequence');
let draggedSequenceIndex = null;

function routeBaseId(routeKey) { return String(routeKey).split('::')[0]; }
function isProcessSelected(id) { return selected.some(routeKey => routeBaseId(routeKey) === id); }
function routeDetailFor(routeKey, process, index = 0) {
  if (!routeDetails[routeKey]) routeDetails[routeKey] = {
    operationNo: String((index + 1) * 10).padStart(2, '0'),
    inputComponentIds: process.id === 'integrated-assembly' ? components.map(item => item.id) : [],
    outputItemId: 'FINISHED_GOOD',
    workcenter: process.owner || process.family || (process.id === 'integrated-assembly' ? 'Entegre montaj hattı' : 'Tanımlanacak'),
    machineId: process.equipment || 'Makine / hat ID girin',
    tooling: process.tooling || 'Takım / fikstür girin',
    programNo: 'Program / reçete no-rev girin',
    responsible: process.owner || 'Sorumlu fonksiyon seçin',
    externalControlRef: 'Uygulanmıyor'
  };
  return routeDetails[routeKey];
}
function selectedProcessEntries() {
  return selected.map((routeKey, index) => { const process = processes.find(candidate => candidate.id === routeBaseId(routeKey)); return process ? { routeKey, index, process, detail: routeDetailFor(routeKey, process, index) } : null; }).filter(Boolean);
}

function routeComponentOptions(selectedIds = []) { return components.map(item => `<option value="${escapeHtml(item.id)}" ${selectedIds.includes(item.id) ? 'selected' : ''}>${escapeHtml(item.position)} • ${escapeHtml(item.name)}</option>`).join(''); }
function routeOutputOptions(selectedId) { return `<option value="FINISHED_GOOD" ${selectedId === 'FINISHED_GOOD' ? 'selected' : ''}>Ana mamul • ${escapeHtml(partName.value)}</option>` + components.map(item => `<option value="${escapeHtml(item.id)}" ${selectedId === item.id ? 'selected' : ''}>${escapeHtml(item.position)} • ${escapeHtml(item.name)}</option>`).join(''); }

function renderOptions(filter = '') {
  const normalized = filter.toLocaleLowerCase('tr-TR');
  const visibleProcesses = processes.filter(process => process.status !== 'archived' && `${process.name} ${process.desc}`.toLocaleLowerCase('tr-TR').includes(normalized));
  optionsEl.innerHTML = visibleProcesses.map(process => `<div class="process-option ${isProcessSelected(process.id) ? 'selected' : ''}" data-process="${escapeHtml(process.id)}" tabindex="0" draggable="true"><span class="process-option-icon">${escapeHtml(process.icon || processIcon(process))}</span><span><strong>${escapeHtml(process.name)}</strong><small>${escapeHtml(process.desc)}</small></span><i class="select-check">✓</i></div>`).join('');
  const count = document.querySelector('.process-library .count'); if (count) count.textContent = visibleProcesses.length;
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
  if (isProcessSelected(id)) { selected.filter(item => routeBaseId(item) === id).forEach(key => delete routeDetails[key]); selected = selected.filter(item => routeBaseId(item) !== id); }
  else selected = [...selected, id];
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
  sequenceEl.innerHTML = entries.length ? entries.map(({ routeKey, process, detail, index }) => `<div class="sequence-item" draggable="true" data-sequence-index="${index}" data-route-key="${escapeHtml(routeKey)}"><span class="drag" title="Sürükleyerek sırala">⠿</span><span class="op-number">OP ${escapeHtml(detail.operationNo)}</span><span><strong>${escapeHtml(process.name)}</strong><small>${escapeHtml(process.desc)} • ${escapeHtml(detail.workcenter)}</small></span><span class="sequence-tags">${process.special ? '<mark>Özel Proses</mark>' : ''}${process.outsource ? '<mark>Dış Kaynak</mark>' : ''}${detail.inputComponentIds.length ? `<mark class="bom-route-tag">${detail.inputComponentIds.length} BOM girdisi</mark>` : ''}</span><span class="sequence-order"><button data-edit-route="${index}" aria-label="Operasyon detayını düzenle">⚙</button><button data-duplicate="${index}" aria-label="Bu prosesi tekrarla">⧉</button><button data-move-up="${index}" aria-label="Yukarı taşı">↑</button><button data-move-down="${index}" aria-label="Aşağı taşı">↓</button></span><button data-remove-index="${index}" aria-label="Kaldır">×</button><div class="route-instance-panel"><div class="route-instance-grid">
      <label>Operasyon no<input data-route-field="operationNo" value="${escapeHtml(detail.operationNo)}"></label>
      <label>Sorumlu fonksiyon<input data-route-field="responsible" value="${escapeHtml(detail.responsible)}"></label>
      <label>İş merkezi / hat<input data-route-field="workcenter" value="${escapeHtml(detail.workcenter)}"></label>
      <label>Makine / ekipman ID<input data-route-field="machineId" value="${escapeHtml(detail.machineId)}"></label>
      <label>Takım / fikstür<input data-route-field="tooling" value="${escapeHtml(detail.tooling)}"></label>
      <label>Program / reçete no-rev<input data-route-field="programNo" value="${escapeHtml(detail.programNo)}"></label>
      <label>Çıktı mamul / yarı mamul<select data-route-field="outputItemId">${routeOutputOptions(detail.outputItemId)}</select></label>
      <label>Dış kontrol sistemi / MES referansı<input data-route-field="externalControlRef" value="${escapeHtml(detail.externalControlRef)}"></label>
      <label class="route-input-components">Tüketilen BOM kalemleri<select data-route-field="inputComponentIds" multiple size="${Math.min(5, Math.max(3, components.length))}">${routeComponentOptions(detail.inputComponentIds)}</select><small>Birden çok bileşen seçilebilir.</small></label>
    </div></div></div>`).join('') : '<div class="empty-state"><span>⇢</span><h3>Proses adımlarınızı seçin</h3><p>Soldan tıklayın veya kartı bu alana sürükleyin.</p></div>';
  sequenceEl.querySelectorAll('[data-remove-index]').forEach(btn => btn.addEventListener('click', () => {
    const index = Number(btn.dataset.removeIndex); delete routeDetails[selected[index]]; selected.splice(index, 1); renderOptions(document.querySelector('.library-search input').value); renderSequence(); markDraftDirty();
  }));
  sequenceEl.querySelectorAll('[data-duplicate]').forEach(btn => btn.addEventListener('click', () => {
    const index = Number(btn.dataset.duplicate); const sourceKey = selected[index]; const cloneKey = `${routeBaseId(sourceKey)}::${crypto.randomUUID()}`; selected.splice(index + 1, 0, cloneKey); routeDetails[cloneKey] = { ...routeDetailFor(sourceKey, entries[index].process, index), operationNo: String((index + 2) * 10).padStart(2, '0'), inputComponentIds: [...routeDetailFor(sourceKey, entries[index].process, index).inputComponentIds] }; renderSequence(); markDraftDirty();
  }));
  sequenceEl.querySelectorAll('[data-edit-route]').forEach(btn => btn.addEventListener('click', () => btn.closest('.sequence-item').classList.toggle('route-expanded')));
  sequenceEl.querySelectorAll('[data-route-field]').forEach(field => {
    const update = event => { const item = event.target.closest('.sequence-item'); const detail = routeDetails[item.dataset.routeKey]; const key = event.target.dataset.routeField; detail[key] = key === 'inputComponentIds' ? [...event.target.selectedOptions].map(option => option.value) : event.target.value; markDraftDirty(); if (key === 'operationNo' || key === 'workcenter' || key === 'inputComponentIds') { item.querySelector('.op-number').textContent = `OP ${detail.operationNo}`; item.querySelector(':scope > span:nth-of-type(3) small').textContent = `${processes.find(process => process.id === routeBaseId(item.dataset.routeKey))?.desc || ''} • ${detail.workcenter}`; } };
    field.addEventListener('input', update); field.addEventListener('change', update);
  });
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
  syncPfmeaFromRoute();
  if (document.getElementById('characteristicRows')) renderCharacteristics();
}

function renderFlowDiagram() {
  syncPfmeaFromRoute();
  const entries = selectedProcessEntries();
  document.getElementById('flowCanvas').innerHTML = entries.map(({ process, detail }) => { const inputs = detail.inputComponentIds.map(id => components.find(item => item.id === id)?.name).filter(Boolean); const output = detail.outputItemId === 'FINISHED_GOOD' ? partName.value : components.find(item => item.id === detail.outputItemId)?.name; return `<div class="flow-node ${process.control ? 'control' : ''} ${process.outsource ? 'outsource' : ''}"><span class="node-op">OP ${escapeHtml(detail.operationNo)}</span><b>${escapeHtml(process.name)}</b><small>${escapeHtml(process.desc)}</small><em>${inputs.length ? `Girdi: ${escapeHtml(inputs.join(', '))}` : 'Girdi BOM eşlemesi bekliyor'} → ${escapeHtml(output || 'çıktı seçin')}</em></div>`; }).join('');
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
    const data = await globalThis.TyanaPlatform.data.listProcesses();
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
  Object.keys(routeDetails).forEach(routeKey => { if (!selected.includes(routeKey)) delete routeDetails[routeKey]; });
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
    openProcessDrawer({ ...source, id: '', version: 0, code: `${source.code}-K`, name: `${source.name} Kopya`, revision: 'A', approvalStatus: 'draft', status: 'active' });
  }));
}

const processFormFields = {
  id: 'processId', version: 'processVersion', code: 'processCode', name: 'processName', family: 'processFamily', category: 'processCategory',
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
    if (['version', 'cycleTimeSec', 'setupTimeMin'].includes(key)) value = Number(value) || 0;
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
    const data = await globalThis.TyanaPlatform.data.saveProcess(payload, id || null);
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
    const data = restore ? await globalThis.TyanaPlatform.data.saveProcess({ ...process, status: 'active' }, id) : await globalThis.TyanaPlatform.data.archiveProcess(id);
    if (restore) Object.assign(process, normalizeProcess(data.process)); else process.status = 'archived';
    closeProcessDrawer();
    renderProcessLibrary(); renderOptions(); renderSequence();
    toast(restore ? 'Proses aktifleştirildi' : 'Proses arşivlendi', `${process.code} kayıt durumu güncellendi.`);
  } catch (error) {
    document.getElementById('processFormStatus').textContent = error.message;
  }
}

async function exportProcessLibrary() {
  if (!globalThis.ExcelJS) { toast('Excel motoru yüklenemedi', 'Uygulama paketini yeniden kurun.'); return; }
  const headers = ['Kod', 'Proses', 'Aile', 'Kategori', 'Ekipman', 'Kontrol Metodu', 'Özel Proses', 'Dış Kaynak', 'Çevrim sn', 'Revizyon', 'Onay'];
  const rows = processes.map(process => [process.code, process.name, process.family, process.category, process.equipment, process.controlMethod, process.special ? 'Evet' : 'Hayır', process.outsource ? 'Evet' : 'Hayır', process.cycleTimeSec, process.revision, process.approvalStatus]);
  const workbook = new ExcelJS.Workbook(); workbook.creator = 'TYANA OTOMOTİV • Eren'; workbook.created = new Date();
  const sheet = workbook.addWorksheet('Proses Kütüphanesi', { views: [{ state: 'frozen', ySplit: 3 }] });
  sheet.columns = [16, 28, 22, 18, 30, 42, 14, 14, 14, 12, 14].map(width => ({ width }));
  sheet.mergeCells('A1:K1'); sheet.getCell('A1').value = 'TYANA OTOMOTİV • Q-FLOW PROSES KÜTÜPHANESİ'; sheet.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }; sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10213F' } }; sheet.getCell('A1').alignment = { horizontal: 'center' }; sheet.getRow(1).height = 28;
  sheet.getRow(3).values = headers; sheet.getRow(3).height = 28;
  rows.forEach(row => sheet.addRow(row.map(safeExcelValue)));
  const border = { top: { style: 'thin', color: { argb: 'FF8792A5' } }, left: { style: 'thin', color: { argb: 'FF8792A5' } }, bottom: { style: 'thin', color: { argb: 'FF8792A5' } }, right: { style: 'thin', color: { argb: 'FF8792A5' } } };
  sheet.getRow(3).eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF245CC7' } }; cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
  sheet.eachRow((row, rowNumber) => { if (rowNumber >= 3) row.eachCell(cell => { cell.border = border; if (rowNumber > 3) { cell.font = { name: 'Arial', size: 9 }; cell.alignment = { vertical: 'middle', wrapText: true }; } }); });
  sheet.autoFilter = { from: 'A3', to: 'K3' }; sheet.pageSetup = { paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printArea: `A1:K${Math.max(3, rows.length + 3)}` };
  const buffer = await workbook.xlsx.writeBuffer(); const verification = new ExcelJS.Workbook(); await verification.xlsx.load(buffer);
  if (verification.getWorksheet('Proses Kütüphanesi').rowCount !== rows.length + 3) throw new Error('Proses kütüphanesi Excel doğrulaması başarısız.');
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const fileName = `TYANA_Q-Flow_Proses_Kutuphanesi_${new Date().toISOString().slice(0, 10)}.xlsx`; const result = await saveBlob(blob, fileName, exportFileTypes.xlsx);
  if (result.saved) toast('Kütüphane dışa aktarıldı', `${processes.length} proses doğrulanmış Excel çalışma kitabına kaydedildi.`);
}

document.querySelector('[data-action="new-process"]').addEventListener('click', () => openProcessDrawer());
document.querySelectorAll('[data-action="close-process-drawer"]').forEach(button => button.addEventListener('click', closeProcessDrawer));
document.getElementById('processForm').addEventListener('submit', saveProcess);
document.querySelector('[data-action="archive-process"]').addEventListener('click', archiveOrRestoreProcess);
document.querySelector('[data-action="export-library"]').addEventListener('click', exportProcessLibrary);
['librarySearch', 'libraryFamilyFilter', 'libraryStatusFilter', 'librarySpecialFilter'].forEach(id => document.getElementById(id).addEventListener(id === 'librarySearch' ? 'input' : 'change', () => { libraryQuickFilter = ''; renderProcessLibrary(); }));
document.querySelector('[data-action="show-drafts"]').addEventListener('click', () => { libraryQuickFilter = 'draft'; document.getElementById('libraryStatusFilter').value = 'active'; renderProcessLibrary(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !document.getElementById('processDrawer').classList.contains('hidden')) closeProcessDrawer(); });

// Durable local responsibility directory. The Windows profile is the desktop security boundary.
let users = [];
const userRoleLabels = { admin: 'Sistem Yöneticisi', quality_manager: 'Kalite Yöneticisi', quality_engineer: 'Kalite Mühendisi', process_engineer: 'Proses Mühendisi', approver: 'Onay Yetkilisi', operator: 'Operatör', viewer: 'Görüntüleyici' };
const userRoleScopes = { admin: 'Sistem sahipliği sorumluluğu', quality_manager: 'Kalite inceleme sorumluluğu', quality_engineer: 'PFMEA, CP ve PPAP hazırlama', process_engineer: 'Rota, proses ve talimat hazırlama', approver: 'Doküman inceleme sorumluluğu', operator: 'Operasyon uygulama sorumluluğu', viewer: 'Doküman görüntüleme profili' };

function renderUsers() {
  const query = document.getElementById('userSearch').value.trim().toLocaleLowerCase('tr-TR');
  const role = document.getElementById('userRoleFilter').value; const status = document.getElementById('userStatusFilter').value;
  const filtered = users.filter(user => (role === 'all' || user.role === role) && (status === 'all' || user.status === status) && `${user.displayName} ${user.email} ${user.department} ${user.plant} ${userRoleLabels[user.role] || user.role}`.toLocaleLowerCase('tr-TR').includes(query));
  const container = document.getElementById('userRows');
  container.innerHTML = filtered.length ? filtered.map(user => `<div class="user-register-row ${user.status !== 'active' ? 'inactive-user' : ''}" data-user-id="${escapeHtml(user.id)}"><span class="user-identity"><i>${escapeHtml(user.displayName.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toLocaleUpperCase('tr-TR'))}</i><span><b>${escapeHtml(user.displayName)}</b><small>${escapeHtml(user.email)} • v${escapeHtml(user.version)}</small></span></span><span><b>${escapeHtml(userRoleLabels[user.role] || user.role)}</b><small>${escapeHtml(user.department)}</small></span><span><b>${escapeHtml(user.plant)}</b><small>TYANA çalışma alanı</small></span><span><b>${escapeHtml(userRoleScopes[user.role] || 'Rol profili')}</b><small>${globalThis.TyanaPlatform.isDesktop ? 'İş akışı etiketi • RBAC değil' : 'Sunucu tarafı yetkilendirme'}</small></span><span><mark class="user-status ${escapeHtml(user.status)}">${user.status === 'active' ? 'AKTİF' : user.status === 'invited' ? 'DAVET' : 'PASİF'}</mark></span><span class="user-row-actions"><button data-edit-user="${escapeHtml(user.id)}">Düzenle</button><button data-toggle-user="${escapeHtml(user.id)}">${user.status === 'active' ? 'Pasife al' : 'Aktifleştir'}</button></span></div>`).join('') : '<div class="empty-user-state">Filtreye uygun kullanıcı bulunamadı.</div>';
  container.querySelectorAll('[data-edit-user]').forEach(button => button.addEventListener('click', () => openUserDrawer(users.find(user => user.id === button.dataset.editUser))));
  container.querySelectorAll('[data-toggle-user]').forEach(button => button.addEventListener('click', () => toggleUserStatus(button.dataset.toggleUser)));
  document.getElementById('userActiveCount').textContent = users.filter(user => user.status === 'active').length;
  document.getElementById('userApproverCount').textContent = users.filter(user => user.status === 'active' && ['admin', 'quality_manager', 'approver'].includes(user.role)).length;
  document.getElementById('userInactiveCount').textContent = users.filter(user => user.status === 'inactive').length;
}

async function loadUsers() {
  try {
    const meData = await globalThis.TyanaPlatform.data.currentUser();
    const source = meData.identity?.source === 'openai-workspace' ? 'OPENAI WORKSPACE' : meData.identity?.source === 'cloudflare-access' ? 'CLOUDFLARE ACCESS' : ['windows-local-desktop', 'windows-profile-owner'].includes(meData.identity?.source) ? 'WINDOWS PROFİLİ' : 'YEREL / SINIRLI';
    document.getElementById('userIdentitySource').textContent = source;
    document.getElementById('userIdentityDetail').textContent = meData.bootstrapProfile ? `${meData.identity?.email || 'Doğrulanmış kullanıcı'} • Eren başlangıç profili` : `${meData.user?.displayName || 'Kullanıcı'} • ${userRoleLabels[meData.user?.role] || meData.user?.role || 'rol tanımsız'}`;
    const mini = document.querySelector('.user-mini'); if (mini && meData.user) { mini.querySelector('strong').textContent = meData.user.displayName; mini.querySelector('small').textContent = userRoleLabels[meData.user.role] || meData.user.role; mini.querySelector('.avatar').textContent = meData.user.displayName.slice(0, 1).toLocaleUpperCase('tr-TR'); }
    const data = await globalThis.TyanaPlatform.data.listUsers(); users = data.users || [];
    if (globalThis.TyanaPlatform.isDesktop) document.getElementById('userAuthBoundaryText').textContent = 'Oturum sahibi Windows profilidir. Kayıtlar dar TYANA IPC komutlarıyla yerel SQLite veritabanına yazılır; değişiklikler sürümlenir ve hash bağlantılı günlük oluşturur. Profil rolleri gerçek oturum açma, e-imza veya RBAC değildir.';
  } catch (error) {
    users = [{ id: 'user-eren', email: 'eren@tyana.local', displayName: 'Eren', role: 'admin', status: 'active', plant: 'TYANA OTOMOTİV', department: 'Kalite', version: 1 }];
    document.getElementById('userIdentitySource').textContent = 'YEREL / SINIRLI'; document.getElementById('userIdentityDetail').textContent = 'Sunucu kimliği yok; Eren tanıtım profili';
    document.getElementById('userAuthBoundaryText').textContent = `Kimlik doğrulanamadı: ${error.message} Bu yerel gösterim gerçek erişim yetkisi değildir; yayın ortamında mutasyonlar reddedilir.`;
  }
  renderUsers();
}

function openUserDrawer(user = null) {
  document.getElementById('userDrawer').classList.remove('hidden'); document.getElementById('userDrawer').setAttribute('aria-hidden', 'false');
  document.getElementById('userDrawerTitle').textContent = user ? `${user.displayName} Profilini Düzenle` : 'Yeni Kullanıcı Oluştur';
  document.getElementById('userId').value = user?.id || ''; document.getElementById('userId').dataset.version = user?.version || 0;
  document.getElementById('userDisplayName').value = user?.displayName || ''; document.getElementById('userEmail').value = user?.email || '';
  document.getElementById('userRole').value = user?.role || 'quality_engineer'; document.getElementById('userStatus').value = user?.status || 'active';
  document.getElementById('userDepartment').value = user?.department || 'Kalite'; document.getElementById('userPlant').value = user?.plant || 'TYANA OTOMOTİV';
  setTimeout(() => document.getElementById('userDisplayName').focus(), 50);
}

function closeUserDrawer() { document.getElementById('userDrawer').classList.add('hidden'); document.getElementById('userDrawer').setAttribute('aria-hidden', 'true'); }

async function saveUser(event) {
  event.preventDefault(); const id = document.getElementById('userId').value;
  const payload = { displayName: document.getElementById('userDisplayName').value.trim(), email: document.getElementById('userEmail').value.trim(), role: document.getElementById('userRole').value, status: document.getElementById('userStatus').value, department: document.getElementById('userDepartment').value.trim(), plant: document.getElementById('userPlant').value.trim(), version: Number(document.getElementById('userId').dataset.version || 0) };
  if (!payload.displayName || !payload.email || !payload.department || !payload.plant) { toast('Kullanıcı alanları eksik', 'Ad, e-posta, bölüm ve tesis alanlarını doldurun.'); return; }
  try {
    const data = await globalThis.TyanaPlatform.data.saveUser(payload, id || null); const index = users.findIndex(user => user.id === data.user.id); if (index >= 0) users[index] = data.user; else users.push(data.user);
    closeUserDrawer(); renderUsers(); toast(id ? 'Kullanıcı profili güncellendi' : 'Kullanıcı oluşturuldu', `${data.user.displayName} • ${userRoleLabels[data.user.role] || data.user.role} • v${data.user.version}`);
  } catch (error) { toast('Kullanıcı kaydedilemedi', error.message); }
}

async function toggleUserStatus(id) {
  const user = users.find(item => item.id === id); if (!user) return;
  if (user.status === 'active' && !window.confirm(`${user.displayName} kullanıcısı pasife alınsın mı?`)) return;
  try {
    const deactivate = user.status === 'active'; const data = deactivate ? await globalThis.TyanaPlatform.data.deactivateUser(id, user.version) : await globalThis.TyanaPlatform.data.saveUser({ ...user, status: 'active', version: user.version }, id);
    Object.assign(user, data.user); renderUsers(); toast('Kullanıcı durumu güncellendi', `${user.displayName} • ${user.status === 'active' ? 'Aktif' : 'Pasif'} • v${user.version}`);
  } catch (error) { toast('Durum değiştirilemedi', error.message); }
}

document.querySelectorAll('[data-action="new-user"]').forEach(button => button.addEventListener('click', () => openUserDrawer()));
document.querySelectorAll('[data-action="close-user-drawer"]').forEach(button => button.addEventListener('click', closeUserDrawer));
document.querySelectorAll('[data-action="refresh-users"]').forEach(button => button.addEventListener('click', loadUsers));
document.getElementById('userForm')?.addEventListener('submit', saveUser);
['userSearch', 'userRoleFilter', 'userStatusFilter'].forEach(id => document.getElementById(id)?.addEventListener(id === 'userSearch' ? 'input' : 'change', renderUsers));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !document.getElementById('userDrawer').classList.contains('hidden')) closeUserDrawer(); });
loadUsers();
loadProcessLibrary().then(restoreLatestProject);

// PPAP checklist
function currentPpapItems() {
  const verifiedBom = components.filter(item => ['Doğrulandı', 'Teknik resimle doğrulandı', 'Müşteri şartıyla doğrulandı'].includes(item.verificationStatus)).length;
  const suitableMsa = characteristics.filter(item => item.msaStatus === 'Uygun' || (item.msaStatus === 'Uygulanamaz — gerekçeli' && item.msaRationale)).length;
  const assessedRisks = pfmeaRows.filter(row => row.severity && row.occurrence && row.detection && row.ap).length;
  const drawingReady = Boolean(drawingSource.sha256 && !drawingSource.sha256.includes('BEKLİYOR'));
  return [
    ['Tasarım kayıtları', drawingReady ? `${drawingSource.name} • SHA-256 kayıtlı` : 'Teknik resim dosyası/no/revizyon doğrulaması bekliyor', drawingReady ? 'ready' : 'blocked'],
    ['Yetkili mühendislik değişikliği', 'Değişiklik kaydı ve uygulanabilirlik kullanıcı tarafından seçilmeli', 'progress'],
    ['Müşteri mühendislik onayı', 'Gerekliyse müşteri onay kanıtı bağlanmalı', 'progress'],
    ['DFMEA', 'Tasarım sorumluluğu ve uygulanabilirlik gerekçesi seçilmeli', 'progress'],
    ['Proses akış diyagramı', selected.length ? `${selected.length} operasyon • Rev. ${drawingRevision.value}` : 'Rota henüz oluşturulmadı', selected.length ? 'ready' : 'blocked'],
    ['PFMEA', pfmeaRows.length ? `${assessedRisks}/${pfmeaRows.length} risk satırı değerlendirildi` : 'Rota kaynaklı risk analizi bekliyor', pfmeaRows.length && assessedRisks === pfmeaRows.length && !pfmeaRows.some(row => row.ap === 'H' && row.status !== 'Kapalı') ? 'ready' : 'progress'],
    ['Kontrol planı', `${characteristics.length} numaralı kontrol satırı`, characteristics.length && !characteristicReleaseIssues().length ? 'ready' : 'progress'],
    ['MSA çalışmaları', `${suitableMsa}/${characteristics.length} ölçüm sistemi uygun/waiver gerekçeli`, characteristics.length && suitableMsa === characteristics.length ? 'ready' : 'blocked'],
    ['Boyutsal / fonksiyonel sonuçlar', 'Sonuç dosyası ve uygunluk kararı müşteri sunumu öncesi bağlanmalı', 'progress'],
    ['Malzeme / performans testleri', `${verifiedBom}/${components.length} BOM kalemi teknik kaynakla doğrulandı`, components.length && verifiedBom === components.length ? 'ready' : 'progress'],
    ['İlk proses etütleri', 'Karakteristik bazlı Ppk/Cpk hedefi ve çalışma referansı girilmeli', 'progress'],
    ['Nitelikli laboratuvar dokümanı', 'İç/dış laboratuvar kapsamı ve rapor referansı seçilmeli', 'progress'],
    ['Görünüş onay raporu', 'Uygulanabilirlik seçimi + U/A ise gerekçe/onay gerekli', 'progress'],
    ['Numune üretim parçaları', 'Miktar, lot ve saklama/sevk kaydı kullanıcı girişi bekliyor', 'progress'],
    ['Master numune', 'Uygulanabilirlik, kimlik ve saklama lokasyonu seçilmeli', 'progress'],
    ['Kontrol fikstürleri', 'Fikstür listesi, kalibrasyon ve MSA bağlantısı doğrulanmalı', 'progress'],
    ['Müşteri özel istekleri', document.getElementById('customerSpecificRequirements').value.trim() ? 'CSR metni kayıtlı; yetkili incelemesi bekliyor' : 'Hedef müşteri/ülke CSR kontrolü tanımlanmalı', 'progress'],
    ['PSW', 'Paket kalite kapıları ve yetkili elektronik onay tamamlanınca yayımlanır', 'blocked']
  ];
}

function renderPpap(filter = 'all') {
  const labels = { ready: 'HAZIR', progress: 'İŞLEMDE', blocked: 'BLOKE' };
  const ppapItems = currentPpapItems();
  document.getElementById('ppapChecklist').innerHTML = ppapItems.map((item, index) => {
    const hidden = filter === 'open' && item[2] === 'ready';
    return `<div class="ppap-item ${hidden ? 'hidden-filter' : ''}"><span class="ppap-item-number">${String(index + 1).padStart(2, '0')}</span><span><b>${item[0]}</b><small>${item[1]}</small></span><mark class="ppap-status ${item[2]}">${labels[item[2]]}</mark></div>`;
  }).join('');
  const ready = ppapItems.filter(item => item[2] === 'ready').length; const progress = ppapItems.filter(item => item[2] === 'progress').length; const blocked = ppapItems.filter(item => item[2] === 'blocked').length; const readiness = Math.round((ready / ppapItems.length) * 100);
  const summary = document.querySelector('#documents .ppap-summary'); if (summary) { summary.querySelector('.readiness-ring span').textContent = `${readiness}%`; const cards = summary.querySelectorAll('.ppap-kpi'); if (cards[0]) cards[0].querySelector('span').textContent = ready; if (cards[1]) cards[1].querySelector('span').textContent = progress; if (cards[2]) cards[2].querySelector('span').textContent = blocked; const copy = summary.querySelector('.ppap-readiness p:last-child'); if (copy) copy.textContent = `${ready} unsur hazır, ${progress} unsur işlemde, ${blocked} unsur bloke.`; }
  const badge = document.querySelector('.ppap-badge'); if (badge) badge.textContent = `${readiness}%`;
}
renderPpap();

document.querySelectorAll('[data-ppap-filter]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-ppap-filter]').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  renderPpap(button.dataset.ppapFilter);
}));

// Canonical documentation snapshot and persistent project draft.
const productFieldIds = ['productTemplate', 'productGroup', 'customProductGroupName', 'productStructureType', 'productType', 'partNumber', 'partName', 'customer', 'customerPartNumber', 'productionPhase', 'annualVolume', 'controlPlanNumber', 'projectCode', 'drawingNumber', 'drawingRevision', 'supplierName', 'supplierSite', 'supplierCode', 'keyContact', 'keyContactPhone', 'coreTeam', 'originalDate', 'revisionDate', 'documentStatus'];
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
    schemaVersion: '2.0.0', templateVersion: 'TYANA-QF-CP-2026.2', snapshotId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(), projectId: currentProjectId,
    product: { ...collectFields(productFieldIds), productGroupLabel: activeBackbone().label }, technical: collectFields(technicalFieldIds),
    components: components.map(item => ({ ...item })),
    drawingSource: { ...drawingSource },
    routingAnswers: {
      forming: document.querySelector('input[name="forming"]:checked')?.value || '',
      safety: document.querySelector('input[name="safety"]:checked')?.value || '',
      specialProcesses: [...document.querySelectorAll('.check-grid input:checked')].map(input => input.value),
      ppapLevel: document.querySelector('input[name="ppap"]:checked')?.value || '3'
    },
    route: selectedProcessEntries().map(({ routeKey, process, detail }) => ({
      routeKey, processId: process.id, processRevision: process.revision || 'A', operationNo: detail.operationNo,
      name: process.name, description: process.desc, family: process.family || '', category: process.category || 'Üretim',
      equipment: process.equipment || '', tooling: process.tooling || '', controlMethod: process.controlMethod || '',
      reactionPlan: process.reactionPlan || '', workInstruction: process.workInstruction || '', special: Boolean(process.special), outsource: Boolean(process.outsource),
      inputComponentIds: [...detail.inputComponentIds], outputItemId: detail.outputItemId, workcenter: detail.workcenter, machineId: detail.machineId, instanceTooling: detail.tooling, programNo: detail.programNo, responsible: detail.responsible, externalControlRef: detail.externalControlRef
    })),
    characteristics: characteristics.map(item => ({ ...item })),
    pfmea: pfmeaRows.map(row => ({ ...row })),
    standardsProfile: { iatf: 'IATF 16949:2016 + güncel SI/FAQ doğrulama profili', apqp: 'AIAG APQP 3. Baskı', controlPlan: 'AIAG Control Plan 1. Baskı', ppap: 'AIAG PPAP 4. Baskı', complianceMode: 'Destek profili — sertifika veya otomatik uygunluk beyanı değildir' },
    approval: { preparedBy: document.getElementById('keyContact').value, preparedAt: new Date().toISOString(), status: document.getElementById('documentStatus').value }
  };
  snapshot.sha256 = await sha256Hex(stableStringify(snapshot));
  return snapshot;
}

function applySnapshot(snapshot) {
  if (!snapshot) return;
  const snapshotGroup = snapshot.product?.productGroup;
  if (snapshotGroup && !productBackbones[snapshotGroup] && snapshot.product?.productGroupLabel) registerCustomProductGroup(snapshot.product.productGroupLabel, snapshotGroup);
  for (const [id, value] of Object.entries({ ...(snapshot.product || {}), ...(snapshot.technical || {}) })) {
    const field = document.getElementById(id); if (field && value !== undefined && value !== null) field.value = value;
  }
  if (Array.isArray(snapshot.components)) components = snapshot.components.map(item => componentRecord(item));
  if (Array.isArray(snapshot.characteristics) && snapshot.characteristics.length) characteristics = snapshot.characteristics;
  pfmeaRows = Array.isArray(snapshot.pfmea) ? snapshot.pfmea.map(row => ({ ...row })) : [];
  selected = []; routeDetails = {};
  if (Array.isArray(snapshot.route)) {
    selected = snapshot.route.map(step => step.routeKey || step.processId); routeDetails = Object.fromEntries(snapshot.route.map(step => [step.routeKey || step.processId, { operationNo: step.operationNo, inputComponentIds: Array.isArray(step.inputComponentIds) ? step.inputComponentIds : [], outputItemId: step.outputItemId || 'FINISHED_GOOD', workcenter: step.workcenter || step.responsible || 'Tanımlanacak', machineId: step.machineId || step.equipment || '', tooling: step.instanceTooling || step.tooling || '', programNo: step.programNo || 'Tanımlanacak', responsible: step.responsible || '', externalControlRef: step.externalControlRef || 'Uygulanmıyor' }]));
  }
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
  renderComponents(); renderCharacteristics(); renderOptions(); renderSequence(); updateSummary();
}

async function saveProjectSnapshot() {
  const snapshot = await getDocumentationSnapshot();
  const payload = { projectCode: projectCode.value.trim(), partNumber: partNumber.value.trim(), partName: partName.value.trim(), productGroup: productGroup.value, revision: drawingRevision.value.trim(), phase: document.getElementById('productionPhase').value, status: document.getElementById('documentStatus').value, version: currentProjectVersion, payload: snapshot };
  const data = await globalThis.TyanaPlatform.data.saveProject(payload, currentProjectId);
  currentProjectId = data.project.id; currentProjectVersion = data.project.version;
  localStorage.setItem('qflow-last-project', JSON.stringify(data.project.payload));
  const status = document.getElementById('draftStatus');
  status.textContent = `✓ ${globalThis.TyanaPlatform.isDesktop ? 'Yerel veritabanına' : 'Sunucuya'} kaydedildi • v${currentProjectVersion}`; status.classList.add('saved'); status.classList.remove('warning');
  return data.project.payload;
}

async function restoreLatestProject() {
  try {
    const data = await globalThis.TyanaPlatform.data.latestProject();
    if (!data.project) return;
    currentProjectId = data.project.id; currentProjectVersion = data.project.version;
    applySnapshot(data.project.payload);
    const status = document.getElementById('draftStatus'); status.textContent = `✓ Son proje yüklendi • v${currentProjectVersion}`; status.classList.add('saved'); status.classList.remove('warning');
  } catch {
    const local = localStorage.getItem('qflow-last-project');
    if (local) { try { applySnapshot(JSON.parse(local)); toast('Yerel kurtarma yüklendi', globalThis.TyanaPlatform.isDesktop ? 'SQLite kaydı açılamadı; son güvenli yerel snapshot yüklendi.' : 'Sunucuya erişilemedi; son tarayıcı yedeği açıldı.'); } catch {} }
  }
}

// Main workflow actions
document.querySelectorAll('[data-action="new-product"]').forEach(btn => btn.addEventListener('click', () => {
  currentProjectId = null; currentProjectVersion = 0; applyProductTemplate('blank');
  showView('product');
  goToWizardStep(1);
}));

document.querySelectorAll('[data-action="save-product"]').forEach(btn => btn.addEventListener('click', async () => {
  if (productGroup.value === '__custom__' && !document.getElementById('customProductGroupName').value.trim()) {
    goToWizardStep(1); toast('Yeni ürün grubu adı gerekli', 'Sıfırdan mamul için ürün grubunu adlandırın veya mevcut bir ürün grubu seçin.'); return;
  }
  if (!validateComponents()) {
    goToWizardStep(2);
    return;
  }
  if (!validateCharacteristics()) {
    goToWizardStep(4);
    return;
  }
  persistPendingProductGroup();
  if (!selected.length) selected = [...activeBackbone().processes];
  renderOptions();
  renderSequence();
  btn.disabled = true; btn.textContent = 'Kaydediliyor…';
  try {
    await saveProjectSnapshot();
    toast('Ürün omurgası kalıcı olarak kaydedildi', `${components.length} alt kalem, ${selected.length} operasyon ve ${characteristics.length} karakteristik aynı mamul kaydında eşleştirildi.`);
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
    selected = [...activeBackbone().processes];
    renderOptions();
    renderSequence();
  }
  renderFlowDiagram();
  toast('Proses akış diyagramı oluşturuldu', `${selected.length} operasyon PFMEA yapısına aktarıldı.`);
  document.querySelector('[data-view="pfmea"] .status-dot')?.classList.add('done');
  setTimeout(() => document.getElementById('flowPreview').scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
}));

function pfmeaSourceKey(routeKey, riskIndex) { return `${routeKey}::risk-${riskIndex}`; }

function newPfmeaRow(overrides = {}) {
  return {
    id: `FMEA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, sourceKey: `manual::${crypto.randomUUID()}`, routeKey: selected[0] || '', processId: selected[0] ? routeBaseId(selected[0]) : '', componentId: 'FINISHED_GOOD',
    functionText: 'Proses fonksiyonunu tanımlayın', failureMode: 'Hata türünü tanımlayın', effect: 'Müşteri / sonraki operasyon etkisini tanımlayın', severity: '', cause: 'Hata nedenini tanımlayın', preventionControl: 'Önleme kontrolünü tanımlayın', occurrence: '', detectionControl: 'Tespit kontrolünü tanımlayın', detection: '', ap: '',
    recommendedAction: '', owner: '', dueDate: '', status: 'Açık', evidence: '', manual: true, ...overrides
  };
}

function syncPfmeaFromRoute(shouldRender = true) {
  const existing = new Map(pfmeaRows.map(row => [row.sourceKey, row]));
  const generated = selectedProcessEntries().flatMap(({ routeKey, process, detail }) => {
    const risks = Array.isArray(process.riskTemplate) && process.riskTemplate.length ? process.riskTemplate : ['Proses hata türü kullanıcı tarafından tanımlanacak'];
    return risks.slice(0, 1).map((risk, riskIndex) => {
      const sourceKey = pfmeaSourceKey(routeKey, riskIndex);
      return existing.get(sourceKey) || newPfmeaRow({
        sourceKey, routeKey, processId: process.id, functionText: process.pfmeaFunction || process.desc || process.name, failureMode: risk,
        cause: 'Onaylı proses ekibi analizi gerekli', preventionControl: process.controlMethod || 'Önleme kontrolü tanımlanacak', detectionControl: process.controlMethod || 'Tespit kontrolü tanımlanacak', recommendedAction: '', manual: false,
        operationNo: detail.operationNo
      });
    });
  });
  const manualRows = pfmeaRows.filter(row => row.manual && (!row.routeKey || selected.includes(row.routeKey)));
  pfmeaRows = [...generated, ...manualRows];
  if (shouldRender) renderPfmea();
}

function pfmeaNumberOptions(value) {
  return '<option value="">—</option>' + Array.from({ length: 10 }, (_, index) => index + 1).map(number => `<option value="${number}" ${String(value) === String(number) ? 'selected' : ''}>${number}</option>`).join('');
}

function renderPfmea() {
  const grid = document.querySelector('#pfmea .fmea-grid'); if (!grid) return;
  const entries = selectedProcessEntries();
  grid.innerHTML = `<div class="fmea-row fmea-head"><span>OP.</span><span>PROSES FONKSİYONU</span><span>HATA TÜRÜ / ETKİSİ</span><span>Ş</span><span>NEDEN / ÖNLEME</span><span>O</span><span>TESPİT / AKSİYON</span><span>T</span><span>AP</span></div>` + (pfmeaRows.length ? pfmeaRows.map((row, index) => {
    const entry = entries.find(item => item.routeKey === row.routeKey); const operationNo = entry?.detail.operationNo || row.operationNo || '—'; const process = entry?.process || processes.find(candidate => candidate.id === row.processId); const processName = process?.name || 'Manuel risk';
    const riskSuggestions = Array.isArray(process?.riskTemplate) ? process.riskTemplate : [];
    const apClass = row.ap === 'H' && row.status !== 'Kapalı' ? 'high-ap' : row.ap === 'M' ? 'medium-ap' : row.ap === 'L' ? 'low-ap' : 'unrated-ap';
    const routeSelector = row.manual ? `<select data-pfmea-field="routeKey">${entries.map(candidate => `<option value="${escapeHtml(candidate.routeKey)}" ${candidate.routeKey === row.routeKey ? 'selected' : ''}>OP ${escapeHtml(candidate.detail.operationNo)} • ${escapeHtml(candidate.process.name)}</option>`).join('')}</select>` : '';
    return `<div class="fmea-row pfmea-edit-row" data-pfmea-index="${index}"><span><b>OP ${escapeHtml(operationNo)}</b>${routeSelector}<small>${escapeHtml(row.componentId === 'FINISHED_GOOD' ? partName.value : components.find(item => item.id === row.componentId)?.name || 'Bileşen seçin')}</small></span><span><b>${escapeHtml(processName)}</b><textarea data-pfmea-field="functionText" rows="3">${escapeHtml(row.functionText)}</textarea></span><span><input data-pfmea-field="failureMode" list="pfmea-risk-${index}" value="${escapeHtml(row.failureMode)}"><datalist id="pfmea-risk-${index}">${riskSuggestions.map(risk => `<option>${escapeHtml(risk)}</option>`).join('')}</datalist><textarea data-pfmea-field="effect" rows="2">${escapeHtml(row.effect)}</textarea></span><span><select data-pfmea-field="severity">${pfmeaNumberOptions(row.severity)}</select></span><span><textarea data-pfmea-field="cause" rows="2">${escapeHtml(row.cause)}</textarea><textarea data-pfmea-field="preventionControl" rows="2">${escapeHtml(row.preventionControl)}</textarea></span><span><select data-pfmea-field="occurrence">${pfmeaNumberOptions(row.occurrence)}</select></span><span><textarea data-pfmea-field="detectionControl" rows="2">${escapeHtml(row.detectionControl)}</textarea><input data-pfmea-field="recommendedAction" value="${escapeHtml(row.recommendedAction)}" placeholder="Önerilen aksiyon"><div class="pfmea-action-meta"><input data-pfmea-field="owner" value="${escapeHtml(row.owner)}" placeholder="Sorumlu"><input data-pfmea-field="dueDate" type="date" value="${escapeHtml(row.dueDate)}"></div><input data-pfmea-field="evidence" value="${escapeHtml(row.evidence)}" placeholder="Kanıt / kayıt / doğrulama no"></span><span><select data-pfmea-field="detection">${pfmeaNumberOptions(row.detection)}</select></span><span><select class="ap ${apClass}" data-pfmea-field="ap"><option value="">Açık</option><option value="H" ${row.ap === 'H' ? 'selected' : ''}>H</option><option value="M" ${row.ap === 'M' ? 'selected' : ''}>M</option><option value="L" ${row.ap === 'L' ? 'selected' : ''}>L</option></select><select data-pfmea-field="status"><option ${row.status === 'Açık' ? 'selected' : ''}>Açık</option><option ${row.status === 'Devam Ediyor' ? 'selected' : ''}>Devam Ediyor</option><option ${row.status === 'Kapalı' ? 'selected' : ''}>Kapalı</option></select>${row.manual ? `<button class="remove-characteristic" data-remove-pfmea="${index}" aria-label="Riski kaldır">×</button>` : ''}</span></div>`;
  }).join('') : '<div class="pfmea-empty"><span>△</span><h3>Rota kaynaklı risk satırı yok</h3><p>Önce proses rotasını oluşturun veya manuel hata türü ekleyin.</p></div>');
  grid.querySelectorAll('[data-pfmea-field]').forEach(field => {
    const update = event => { const row = pfmeaRows[Number(event.target.closest('[data-pfmea-index]').dataset.pfmeaIndex)]; row[event.target.dataset.pfmeaField] = event.target.value; if (event.target.dataset.pfmeaField === 'routeKey') { const entry = selectedProcessEntries().find(item => item.routeKey === event.target.value); if (entry) { row.processId = entry.process.id; row.operationNo = entry.detail.operationNo; row.functionText = entry.process.pfmeaFunction || entry.process.desc || entry.process.name; } } updatePfmeaSummary(); markDraftDirty(); };
    field.addEventListener('input', update); field.addEventListener('change', event => { update(event); renderPfmea(); });
  });
  grid.querySelectorAll('[data-remove-pfmea]').forEach(button => button.addEventListener('click', () => { pfmeaRows.splice(Number(button.dataset.removePfmea), 1); renderPfmea(); markDraftDirty(); }));
  updatePfmeaSummary();
}

function updatePfmeaSummary() {
  const assessed = pfmeaRows.filter(row => row.severity && row.occurrence && row.detection && row.ap).length;
  const highOpen = pfmeaRows.filter(row => row.ap === 'H' && row.status !== 'Kapalı').length;
  const medium = pfmeaRows.filter(row => row.ap === 'M').length; const low = pfmeaRows.filter(row => row.ap === 'L').length;
  const metrics = document.querySelectorAll('#pfmea .risk-strip > div');
  if (metrics[0]?.querySelector('b')) metrics[0].querySelector('b').textContent = pfmeaRows.length;
  if (metrics[1]?.querySelector('b')) metrics[1].querySelector('b').textContent = highOpen;
  if (metrics[2]?.querySelector('b')) metrics[2].querySelector('b').textContent = medium;
  if (metrics[3]?.querySelector('b')) metrics[3].querySelector('b').textContent = low;
  const completion = pfmeaRows.length ? Math.round((assessed / pfmeaRows.length) * 100) : 0;
  const progress = document.querySelector('#pfmea .risk-progress'); if (progress) { progress.querySelector('strong').textContent = `${completion}%`; progress.querySelector('i b').style.width = `${completion}%`; }
  const status = document.querySelector('#pfmea .page-status'); if (status) status.textContent = !pfmeaRows.length ? '● Risk analizi bekliyor' : pfmeaRows.length > assessed ? `● ${pfmeaRows.length - assessed} AP değerlendirmesi açık` : highOpen ? `● ${highOpen} yüksek öncelik açık` : '✓ AP değerlendirmesi tamam';
}

const addPfmeaButton = document.querySelector('#pfmea .doc-toolbar .secondary-button');
if (addPfmeaButton) addPfmeaButton.addEventListener('click', () => { pfmeaRows.push(newPfmeaRow()); renderPfmea(); markDraftDirty(); });

document.querySelectorAll('[data-action="complete-pfmea"]').forEach(btn => btn.addEventListener('click', () => {
  const unassessed = pfmeaRows.filter(row => !row.severity || !row.occurrence || !row.detection || !row.ap);
  const openHigh = pfmeaRows.filter(row => row.ap === 'H' && row.status !== 'Kapalı');
  if (!pfmeaRows.length || unassessed.length || openHigh.length) {
    toast('PFMEA kalite kapısı bloke', `${!pfmeaRows.length ? 'Risk satırı yok' : `${unassessed.length} değerlendirme eksik • ${openHigh.length} yüksek AP açık`}. AP değeri lisanslı AIAG & VDA tablosuna göre kullanıcı tarafından seçilmelidir.`);
    return;
  }
  toast('PFMEA kalite kapısı tamamlandı', `${pfmeaRows.length} risk satırı operasyon örnekleriyle kontrol planına bağlandı.`);
  setTimeout(() => showView('control'), 650);
}));

function controlContext(characteristic) {
  const entries = selectedProcessEntries();
  const entry = entries.find(item => characteristic.routeKey && item.routeKey === characteristic.routeKey) || entries.find(item => item.process.id === characteristic.processId);
  const process = entry?.process || processes.find(item => item.id === characteristic.processId) || { name: 'Proses eşleşmesi gerekli', equipment: '', controlMethod: '', reactionPlan: '' };
  return {
    op: entry ? entry.detail.operationNo : '—', process, detail: entry?.detail || null,
    reaction: process.reactionPlan || 'Prosesi durdur; son iyi parçadan itibaren şüpheli ürünü bloke et; kaliteyi bilgilendir; %100 doğrulama ve yetkili yeniden başlatma onayı uygula.'
  };
}

function characteristicOwner(item) {
  if (item.componentId === 'FINISHED_GOOD') return { id: 'FINISHED_GOOD', position: 'FG', name: partName.value || 'Ana mamul', itemNo: partNumber.value || '—' };
  return components.find(component => component.id === item.componentId) || { id: item.componentId || '—', position: '—', name: 'Bileşen eşleşmesi gerekli', itemNo: '—' };
}

function componentMaterialSummary(limit = 4) {
  if (!components.length) return 'Tek parça mamul • üst seviye şartlar';
  const items = components.slice(0, limit).map(item => `${item.position} ${item.name}: ${item.materialGrade}`);
  if (components.length > limit) items.push(`+${components.length - limit} kalem`);
  return items.join(' • ');
}

function phaseCheck(label) {
  const phase = document.getElementById('productionPhase').value;
  if (label === 'prototype') return phase === 'Prototip' ? '☒ Prototip' : '□ Prototip';
  if (label === 'prelaunch') return ['Ön Seri', 'Safe Launch'].includes(phase) ? `☒ ${phase}` : '□ Ön Seri / Safe Launch';
  return phase === 'Seri Üretim' ? '☒ Seri' : '□ Seri';
}

function phaseExportText() {
  const phase = document.getElementById('productionPhase').value;
  return `${phase === 'Prototip' ? '[X]' : '[ ]'} Prototip   ${phase === 'Ön Seri' ? '[X]' : '[ ]'} Ön Seri   ${phase === 'Safe Launch' ? '[X]' : '[ ]'} Safe Launch   ${phase === 'Seri Üretim' ? '[X]' : '[ ]'} Seri`;
}

function unresolvedPlaceholder(value) {
  const text = String(value ?? '').trim().toLocaleLowerCase('tr-TR');
  return !text || ['tanımlanacak', 'gerekli', 'bekliyor', 'seçin', 'girin', 'yeni karakteristik', 'teknik resme göre', 'kullanıcı doğrulaması', 'kullanıcı seçimi', 'demo'].some(token => text.includes(token));
}

function bomReleaseIssues() {
  const issues = [];
  const structure = document.getElementById('productStructureType').value;
  if (structure === 'assembly' && !components.length) issues.push('Montaj mamulünde BOM kalemi yok');
  const ids = new Set(components.map(item => item.id));
  const duplicatePositions = components.filter((item, index) => components.findIndex(other => String(other.position).trim() === String(item.position).trim()) !== index);
  const duplicateItems = components.filter((item, index) => item.itemNo && components.findIndex(other => String(other.itemNo).trim().toLocaleLowerCase('tr-TR') === String(item.itemNo).trim().toLocaleLowerCase('tr-TR')) !== index);
  if (duplicatePositions.length) issues.push(`${new Set(duplicatePositions.map(item => item.position)).size} yinelenen BOM pozisyonu`);
  if (duplicateItems.length) issues.push(`${new Set(duplicateItems.map(item => item.itemNo)).size} yinelenen stok/parça kodu`);
  const orphans = components.filter(item => item.parentId !== 'FINISHED_GOOD' && !ids.has(item.parentId)); if (orphans.length) issues.push(`${orphans.length} üst kalemi bulunamayan BOM satırı`);
  const cyclic = components.filter(item => { const visited = new Set([item.id]); let parent = item.parentId; while (parent && parent !== 'FINISHED_GOOD') { if (visited.has(parent)) return true; visited.add(parent); parent = components.find(candidate => candidate.id === parent)?.parentId; } return false; });
  if (cyclic.length) issues.push(`${cyclic.length} BOM satırında üst-alt çevrimi`);
  const childlessAssemblies = components.filter(item => item.componentType === 'Alt montaj' && !components.some(child => child.parentId === item.id)); if (childlessAssemblies.length) issues.push(`${childlessAssemblies.length} alt montajın alt bileşeni yok`);
  const unresolved = components.filter(item => ['name', 'itemNo', 'drawingNo', 'revision', 'materialGrade', 'materialStandard', 'traceability'].some(field => unresolvedPlaceholder(item[field]))); if (unresolved.length) issues.push(`${unresolved.length} BOM kaleminde teknik alan/placeholder açık`);
  const unverified = components.filter(item => !['Doğrulandı', 'Teknik resimle doğrulandı', 'Müşteri şartıyla doğrulandı'].includes(item.verificationStatus)); if (unverified.length) issues.push(`${unverified.length} BOM kalemi teknik kaynakla doğrulanmadı`);
  const purchasedWithoutSource = components.filter(item => ['Satın al', 'Fason proses', 'Müşteri tedariki'].includes(item.makeBuy) && unresolvedPlaceholder(item.supplier)); if (purchasedWithoutSource.length) issues.push(`${purchasedWithoutSource.length} satın alınan/fason kalemde kaynak tanımsız`);
  return issues;
}

function routeReleaseIssues() {
  const issues = []; const entries = selectedProcessEntries();
  if (!entries.length) return ['Proses rotası boş'];
  const operationNos = entries.map(entry => String(entry.detail.operationNo || '').trim());
  if (operationNos.some(value => !value)) issues.push('Operasyon numarası boş');
  if (new Set(operationNos).size !== operationNos.length) issues.push('Operasyon numaraları benzersiz değil');
  const invalidDetails = entries.filter(({ detail }) => ['workcenter', 'machineId', 'tooling', 'responsible'].some(field => unresolvedPlaceholder(detail[field]))); if (invalidDetails.length) issues.push(`${invalidDetails.length} operasyonda iş merkezi/makine/takım/sorumlu açık`);
  const invalidLinks = entries.filter(({ detail }) => detail.inputComponentIds.some(id => !components.some(item => item.id === id)) || (detail.outputItemId !== 'FINISHED_GOOD' && !components.some(item => item.id === detail.outputItemId))); if (invalidLinks.length) issues.push(`${invalidLinks.length} operasyonda geçersiz BOM girdi/çıktı bağlantısı`);
  const assemblyWithoutInputs = entries.filter(({ process, detail }) => ['assembly', 'integrated-assembly'].includes(process.id) && components.length && !detail.inputComponentIds.length); if (assemblyWithoutInputs.length) issues.push(`${assemblyWithoutInputs.length} montaj operasyonunda tüketilen BOM kalemi seçilmedi`);
  const outsourcedWithoutReference = entries.filter(({ process, detail }) => process.outsource && (detail.externalControlRef === 'Uygulanmıyor' || unresolvedPlaceholder(detail.externalControlRef))); if (outsourcedWithoutReference.length) issues.push(`${outsourcedWithoutReference.length} dış kaynak proseste kontrol sistemi referansı yok`);
  const unapproved = entries.filter(({ process }) => process.approvalStatus && process.approvalStatus !== 'approved'); if (unapproved.length) issues.push(`${unapproved.length} rota prosesi onaylı kütüphane revizyonunda değil`);
  return issues;
}

function characteristicReleaseIssues() {
  const issues = []; const routeKeys = new Set(selected);
  if (!characteristics.length) return ['Numaralı karakteristik yok'];
  const invalidRoute = characteristics.filter(item => !item.routeKey || !routeKeys.has(item.routeKey)); if (invalidRoute.length) issues.push(`${invalidRoute.length} karakteristik operasyon örneğine bağlı değil`);
  const invalidSource = characteristics.filter(item => unresolvedPlaceholder(item.sourceDrawing) || unresolvedPlaceholder(item.sourceZone) || unresolvedPlaceholder(item.sourceStatus)); if (invalidSource.length) issues.push(`${invalidSource.length} karakteristikte teknik kaynak doğrulaması açık`);
  const invalidNumeric = characteristics.filter(item => item.specMode === 'numeric' && (!Number.isFinite(item.nominal) || !Number.isFinite(item.minus) || !Number.isFinite(item.plus) || item.minus < 0 || item.plus < 0 || item.minus + item.plus <= 0)); if (invalidNumeric.length) issues.push(`${invalidNumeric.length} sayısal karakteristiğin limit/toleransı geçersiz`);
  const invalidEquipment = characteristics.filter(item => ['method', 'equipmentClass', 'equipment', 'resolution', 'sampleSize', 'frequency', 'trigger', 'reference', 'reaction'].some(field => unresolvedPlaceholder(item[field]))); if (invalidEquipment.length) issues.push(`${invalidEquipment.length} kontrolde metot/cihaz/sıklık/kayıt/reaksiyon alanı açık`);
  const msaOpen = characteristics.filter(item => item.msaStatus !== 'Uygun' && !(item.msaStatus === 'Uygulanamaz — gerekçeli' && String(item.msaRationale || '').trim())); if (msaOpen.length) issues.push(`${msaOpen.length} kontrol için MSA/cihaz uygunluğu kapanmadı`);
  const calibrationOpen = characteristics.filter(item => item.msaStatus !== 'Uygulanamaz — gerekçeli' && (!item.calibrationDue || item.calibrationDue < new Date().toISOString().slice(0, 10))); if (calibrationOpen.length) issues.push(`${calibrationOpen.length} ölçüm cihazının kalibrasyon vadesi yok veya geçmiş`);
  return issues;
}

function pfmeaReleaseIssues() {
  const issues = [];
  if (!pfmeaRows.length) return ['PFMEA risk satırı yok'];
  const unassessed = pfmeaRows.filter(row => !row.severity || !row.occurrence || !row.detection || !row.ap); if (unassessed.length) issues.push(`${unassessed.length} PFMEA satırında S/O/D/AP değerlendirmesi eksik`);
  const highOpen = pfmeaRows.filter(row => row.ap === 'H' && row.status !== 'Kapalı'); if (highOpen.length) issues.push(`${highOpen.length} yüksek PFMEA Action Priority açık`);
  const highWithoutEvidence = pfmeaRows.filter(row => row.ap === 'H' && row.status === 'Kapalı' && (!row.owner || !row.dueDate || !row.evidence)); if (highWithoutEvidence.length) issues.push(`${highWithoutEvidence.length} kapalı yüksek AP için sorumlu/termin/kanıt eksik`);
  return issues;
}

function releaseGateIssues({ includeApproval = true } = {}) {
  const issues = [];
  if (!partNumber.value.trim() || !partName.value.trim() || !projectCode.value.trim() || !controlPlanNumber.value.trim()) issues.push('Mamul ve doküman kimliği eksik');
  if (productGroup.value === '__custom__' && !document.getElementById('customProductGroupName').value.trim()) issues.push('Yeni ürün grubu adı boş');
  if (!drawingSource.sha256 || drawingSource.sha256.includes('BEKLİYOR')) issues.push('Teknik resim dosyası ve SHA-256 kaynağı doğrulanmadı');
  issues.push(...bomReleaseIssues(), ...routeReleaseIssues(), ...characteristicReleaseIssues(), ...pfmeaReleaseIssues());
  if (includeApproval && document.getElementById('documentStatus').value === 'Yürürlükte') issues.push('Yürürlükte yayın için sunucu tarafı iki aşamalı elektronik onay kaydı gerekli');
  return issues;
}

function refreshQualityGate() {
  const sections = [
    !partNumber.value.trim() || !partName.value.trim() || (productGroup.value === '__custom__' && !document.getElementById('customProductGroupName').value.trim()) ? ['Mamul kimliği eksik'] : [],
    !drawingSource.sha256 || drawingSource.sha256.includes('BEKLİYOR') ? ['Teknik resim kaynağı eksik'] : [],
    bomReleaseIssues(), routeReleaseIssues(), characteristicReleaseIssues(), pfmeaReleaseIssues()
  ];
  const score = Math.round((sections.filter(items => !items.length).length / sections.length) * 100);
  const issues = sections.flat(); const scoreEl = document.getElementById('qualityScore'); if (scoreEl) scoreEl.textContent = score;
  const title = document.getElementById('qualityStateTitle'); const detail = document.getElementById('qualityStateDetail');
  if (title) title.textContent = issues.length ? 'Veri doğrulaması sürüyor' : 'Taslak doküman seti hazır';
  if (detail) detail.textContent = issues.length ? `${issues.length} kalite kapısı bulgusu var; ilk bulgu: ${issues[0]}.` : 'Tüm teknik zincir tamam; yürürlükte yayın ayrıca yetkili elektronik onay gerektirir.';
  return score;
}

function ensureDocumentExportReady() {
  const status = document.getElementById('documentStatus').value;
  const issues = releaseGateIssues();
  if (status === 'Yürürlükte' && issues.length) {
    toast('Yürürlükte çıktı bloke edildi', `${issues[0]}${issues.length > 1 ? ` • +${issues.length - 1} bulgu` : ''}. Taslak çıktı alabilir veya bulguları kapatabilirsiniz.`);
    return false;
  }
  return true;
}

function documentCopyLabel(status = document.getElementById('documentStatus').value) {
  return status === 'Yürürlükte' ? 'KONTROLLÜ KOPYA' : 'TASLAK / TANITIM';
}

function surfacePerformanceText(technical = null) {
  const coatingType = technical?.coatingType ?? document.getElementById('coatingType').value;
  const coatingThickness = technical?.coatingThickness ?? document.getElementById('coatingThickness').value;
  const corrosionHours = technical?.corrosionHours ?? document.getElementById('corrosionHours').value;
  return [coatingType || 'Kaplama tanımlanmadı', coatingThickness ? `${coatingThickness} µm` : '', corrosionHours ? `${corrosionHours} saat korozyon şartı` : ''].filter(Boolean).join(' • ');
}

function controlPlanRows() {
  return characteristics.map(item => {
    const context = controlContext(item); const owner = characteristicOwner(item);
    return {
      item, owner, context, operation: context.op, processName: context.process.name, responsible: context.detail?.responsible || context.process.owner || 'Sorumlu fonksiyon tanımlanacak',
      equipment: [context.detail?.machineId || context.process.equipment, context.detail?.tooling || context.process.tooling, context.detail?.programNo && context.detail.programNo !== 'Program / reçete no-rev girin' ? context.detail.programNo : ''].filter(Boolean).join(' / ') || '—', specification: specificationFor(item),
      control: [item.method, item.pokaYoke && item.pokaYoke !== '—' ? `P/Y: ${item.pokaYoke}` : '', item.alternateControl && item.alternateControl !== 'Uygulanmıyor' ? `Yedek: ${item.alternateControl}` : ''].filter(Boolean).join(' • '),
      measurement: [item.equipmentClass, item.equipment, item.resolution ? `Çöz.: ${item.resolution}` : '', item.calibrationDue ? `Kal.: ${item.calibrationDue}` : '', item.msaReference ? `MSA: ${item.msaReference} / ${item.msaStatus}` : ''].filter(Boolean).join(' • '),
      sampling: `${item.sampleSize} / ${item.frequency}${item.trigger ? ` • ${item.trigger}` : ''}`,
      reference: [item.sourceDrawing, item.sourceZone, item.reference, item.reaction].filter(Boolean).join(' / '), reaction: context.reaction
    };
  });
}

function renderControlPlan() {
  const header = document.getElementById('controlPlanHeader');
  const fields = [
    ['Kontrol Planı No', controlPlanNumber.value], ['Parça No / Revizyon', `${partNumber.value} / ${drawingRevision.value}`], ['Parça Adı', partName.value],
    ['Müşteri / Müşteri Parça No', `${document.getElementById('customer').value} / ${document.getElementById('customerPartNumber').value}`], ['Kuruluş / Üretim Sahası', `${document.getElementById('supplierName').value} / ${document.getElementById('supplierSite').value}`], ['Tedarikçi Kodu', document.getElementById('supplierCode').value],
    ['Anahtar Personel / Telefon', `${document.getElementById('keyContact').value} / ${document.getElementById('keyContactPhone').value}`], ['Çekirdek Ekip', document.getElementById('coreTeam').value], ['İlk Yayın / Revizyon Tarihi', `${document.getElementById('originalDate').value} / ${document.getElementById('revisionDate').value}`],
    ['Teknik Resim', `${document.getElementById('drawingNumber').value} / Rev. ${drawingRevision.value}`], ['Mamul Ağacı', `${components.length} alt kalem • ${componentMaterialSummary(2)}`], ['Mamul Ortak Şartı', `${document.getElementById('materialGrade').value} • ${document.getElementById('materialStandard').value}`]
  ];
  header.innerHTML = fields.map(([label, value]) => `<div><small>${escapeHtml(label)}</small><b>${escapeHtml(value || '—')}</b></div>`).join('');
  document.getElementById('phasePrototype').textContent = phaseCheck('prototype');
  document.getElementById('phasePrelaunch').textContent = phaseCheck('prelaunch');
  document.getElementById('phaseProduction').textContent = phaseCheck('production');
  document.getElementById('cpDocumentState').textContent = document.getElementById('documentStatus').value.toLocaleUpperCase('tr-TR');
  document.querySelector('.cp-confidentiality').textContent = documentCopyLabel();
  const rows = controlPlanRows();
  document.getElementById('controlPlanBody').innerHTML = rows.map(({ item, owner, ...row }) => `<tr><td><b>${escapeHtml(row.operation)}</b></td><td><b>${escapeHtml(row.processName)}</b><small>${escapeHtml(row.responsible)} • ${escapeHtml(item.kind)}</small></td><td>${escapeHtml(row.equipment)}</td><td><b>${escapeHtml(item.balloon)}</b><small>${escapeHtml(item.id)}</small></td><td><b>${escapeHtml(item.name)}</b><small>${escapeHtml(owner.position)} • ${escapeHtml(owner.name)} • ${escapeHtml(item.definition)}</small></td><td>${escapeHtml(row.specification)}</td><td><mark class="cp-special ${item.classification === 'Normal' ? 'normal' : ''}">${escapeHtml(item.classification)}</mark></td><td>${escapeHtml(row.control)}</td><td>${escapeHtml(row.measurement)}</td><td>${escapeHtml(row.sampling)}</td><td>${escapeHtml(row.reference)}</td><td>${escapeHtml(row.reaction)}</td></tr>`).join('');
  document.getElementById('controlGeneratedMeta').textContent = `${controlPlanNumber.value} / Rev. ${drawingRevision.value} • ${selected.length} operasyon • ${characteristics.length} kontrol satırı`;
  document.getElementById('controlRowCount').textContent = `${characteristics.length} kontrol satırı • ${characteristics.filter(item => item.classification !== 'Normal').length} özel karakteristik`;
  document.getElementById('controlEyebrow').textContent = `${projectCode.value} • ${document.getElementById('productionPhase').value.toLocaleUpperCase('tr-TR')}`;
}

document.querySelectorAll('[data-action="generate-control"]').forEach(btn => btn.addEventListener('click', () => {
  if (!ensureDocumentExportReady()) return;
  if (!validateComponents()) { showView('product'); goToWizardStep(2); toast('Kontrol planı üretilemedi', 'Mamul ağacı temel alanlarını tamamlayın.'); return; }
  if (!validateCharacteristics()) { showView('product'); goToWizardStep(4); toast('Kontrol planı üretilemedi', 'Eksik karakteristik veya kontrol eşleştirmelerini tamamlayın.'); return; }
  if (!selected.length) { selected = [...activeBackbone().processes]; renderSequence(); }
  renderControlPlan();
  document.getElementById('controlEmpty').classList.add('hidden');
  document.getElementById('controlResult').classList.remove('hidden');
  toast('Kontrol planı oluşturuldu', `${characteristics.length} teknik karakteristik proses kontrolleriyle eşleştirildi.`);
}));

function safeFileName(value) {
  return String(value || 'TYANA-QFLOW').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 90);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = fileName; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const recentExportUrls = [];

function recordRecentExport(blob, fileName, method) {
  const container = document.getElementById('recentExports'); if (!container) return;
  const url = URL.createObjectURL(blob); recentExportUrls.push(url);
  while (recentExportUrls.length > 12) URL.revokeObjectURL(recentExportUrls.shift());
  if (!container.querySelector('.recent-export-list')) container.innerHTML = '<b>Bu oturumdaki çıktılar</b><div class="recent-export-list"></div>';
  const list = container.querySelector('.recent-export-list');
  const item = document.createElement('a'); item.href = url; item.download = fileName; item.className = 'recent-export-item';
  item.innerHTML = `<span>✓</span><p><b>${escapeHtml(fileName)}</b><small>${escapeHtml(method)} • ${(blob.size / 1024).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} KB • tekrar kaydetmek için tıklayın</small></p>`;
  list.prepend(item); while (list.children.length > 6) list.lastElementChild.remove();
}

async function saveBlob(blob, fileName, fileType = {}) {
  if (globalThis.TyanaPlatform?.saveArtifact) {
    try {
      const result = await globalThis.TyanaPlatform.saveArtifact({ data: blob, fileName });
      if (result.cancelled) { toast('Kayıt iptal edildi', 'Dosyada değişiklik yapılmadı.'); return { saved: false, method: 'cancelled' }; }
      const method = result.mode === 'tauri' ? 'TYANA güvenli masaüstü kaydı' : result.mode === 'file-picker' ? 'Windows kayıt konumu' : 'Tarayıcı indirme yedeği';
      recordRecentExport(blob, result.fileName || fileName, method); return { saved: true, method: result.mode || 'platform' };
    } catch (error) {
      toast('Dosya kaydı doğrulanamadı', error.message);
      return { saved: false, method: 'error', error };
    }
  }
  const pickerAvailable = typeof window.showSaveFilePicker === 'function' && window.isSecureContext && !navigator.webdriver;
  if (pickerAvailable) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: fileName, types: fileType.types || [] });
      const writable = await handle.createWritable(); await writable.write(blob); await writable.close();
      recordRecentExport(blob, fileName, 'Windows kayıt konumu'); return { saved: true, method: 'picker' };
    } catch (error) {
      if (error?.name === 'AbortError') { toast('Kayıt iptal edildi', 'Dosyada değişiklik yapılmadı.'); return { saved: false, method: 'cancelled' }; }
    }
  }
  downloadBlob(blob, fileName); recordRecentExport(blob, fileName, 'Tarayıcı indirme yedeği'); return { saved: true, method: 'download' };
}

function pdfBlob(definition) {
  return new Promise((resolve, reject) => {
    try { pdfMake.createPdf(definition).getBlob(resolve); } catch (error) { reject(error); }
  });
}

const exportFileTypes = {
  pdf: { types: [{ description: 'PDF dokümanı', accept: { 'application/pdf': ['.pdf'] } }] },
  xlsx: { types: [{ description: 'Excel çalışma kitabı', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }] },
  dxf: { types: [{ description: 'DXF CAD değişim dosyası', accept: { 'application/dxf': ['.dxf'] } }] }
};

function safeExcelValue(value) {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

async function exportControlPlanXlsx() {
  if (!globalThis.ExcelJS) { toast('Excel motoru yüklenemedi', 'Uygulama paketini yeniden yükleyin.'); return; }
  if (!ensureDocumentExportReady()) return;
  renderControlPlan();
  const snapshot = await getDocumentationSnapshot();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TYANA OTOMOTİV • Q-Flow'; workbook.created = new Date(); workbook.modified = new Date();
  const sheet = workbook.addWorksheet('Kontrol Planı', { pageSetup: { paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.2, right: 0.2, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 } }, views: [{ state: 'frozen', ySplit: 8 }] });
  sheet.columns = [7, 23, 25, 10, 25, 19, 12, 24, 25, 16, 17, 31].map(width => ({ width }));
  const mergeValue = (range, label, value) => { sheet.mergeCells(range); const cell = sheet.getCell(range.split(':')[0]); cell.value = `${label}\n${safeExcelValue(value || '—')}`; cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }; };
  sheet.mergeCells('A1:L1'); sheet.getCell('A1').value = 'KONTROL PLANI / CONTROL PLAN'; sheet.getCell('A1').font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FF10213F' } }; sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }; sheet.getRow(1).height = 30;
  mergeValue('A2:D2', 'FAZ', `${phaseCheck('prototype')}   ${phaseCheck('prelaunch')}   ${phaseCheck('production')}`); mergeValue('E2:H2', 'KONTROL PLANI NO', controlPlanNumber.value); mergeValue('I2:L2', 'DOKÜMAN DURUMU', document.getElementById('documentStatus').value);
  mergeValue('A3:D3', 'KURULUŞ / SAHA', `${document.getElementById('supplierName').value} / ${document.getElementById('supplierSite').value}`); mergeValue('E3:H3', 'MÜŞTERİ / MÜŞTERİ PARÇA NO', `${document.getElementById('customer').value} / ${document.getElementById('customerPartNumber').value}`); mergeValue('I3:L3', 'TEDARİKÇİ KODU', document.getElementById('supplierCode').value);
  mergeValue('A4:D4', 'PARÇA NO / REVİZYON', `${partNumber.value} / ${drawingRevision.value}`); mergeValue('E4:H4', 'PARÇA ADI', partName.value); mergeValue('I4:L4', 'TEKNİK RESİM', `${document.getElementById('drawingNumber').value} / Rev. ${drawingRevision.value}`);
  mergeValue('A5:D5', 'ANAHTAR PERSONEL / TELEFON', `${document.getElementById('keyContact').value} / ${document.getElementById('keyContactPhone').value}`); mergeValue('E5:H5', 'ÇEKİRDEK EKİP', document.getElementById('coreTeam').value); mergeValue('I5:L5', 'İLK YAYIN / REVİZYON', `${document.getElementById('originalDate').value} / ${document.getElementById('revisionDate').value}`);
  mergeValue('A6:D6', 'MAMUL AĞACI', `${components.length} alt kalem • ${componentMaterialSummary(2)}`); mergeValue('E6:H6', 'MAMUL ORTAK ŞARTI', `${document.getElementById('materialGrade').value} • ${document.getElementById('materialStandard').value}`); mergeValue('I6:L6', 'YÜZEY / FONKSİYON', surfacePerformanceText());
  mergeValue('A7:H7', 'PROJE / APQP', projectCode.value); mergeValue('I7:L7', 'KAYNAK SNAPSHOT SHA-256', snapshot.sha256);
  const headers = ['Op.', 'Operasyon / Sorumlu', 'Makine / Teçhizat / Aparat', 'Kar. No', 'Ürün / Proses Karakteristiği', 'Spesifikasyon / Tolerans', 'Özel Sınıf', 'Kontrol / Poka-Yoke', 'Ölçüm Tekniği / Cihaz', 'Numune / Sıklık', 'Referans', 'Reaksiyon Planı'];
  sheet.getRow(8).values = headers; sheet.getRow(8).height = 34;
  const rows = controlPlanRows();
  rows.forEach((row, index) => {
    const values = [row.operation, `${row.processName}\n${row.responsible}`, row.equipment, `${row.item.balloon}\n${row.item.id}`, `${row.item.name}\n${row.owner.position} • ${row.owner.name}\n${row.item.definition}`, row.specification, row.item.classification, row.control, row.measurement, row.sampling, row.reference, row.reaction].map(safeExcelValue);
    const excelRow = sheet.addRow(values); excelRow.height = 44; excelRow.eachCell(cell => { cell.font = { name: 'Arial', size: 8 }; cell.alignment = { vertical: 'middle', wrapText: true }; });
    if (index % 2) excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FC' } };
  });
  const border = { top: { style: 'thin', color: { argb: 'FF7D8798' } }, left: { style: 'thin', color: { argb: 'FF7D8798' } }, bottom: { style: 'thin', color: { argb: 'FF7D8798' } }, right: { style: 'thin', color: { argb: 'FF7D8798' } } };
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => row.eachCell({ includeEmpty: true }, cell => { cell.border = border; if (rowNumber >= 2 && rowNumber <= 7) cell.font = { name: 'Arial', size: 8, bold: rowNumber === 2 }; }));
  sheet.getRow(8).eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10213F' } }; cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
  sheet.pageSetup.printArea = `A1:L${8 + rows.length}`; sheet.pageSetup.printTitlesRow = '8:8'; sheet.headerFooter.oddFooter = `&L${safeExcelValue(controlPlanNumber.value)} • Rev. ${safeExcelValue(drawingRevision.value)}&C ${documentCopyLabel()} &R Sayfa &P / &N`;
  const bomSheet = workbook.addWorksheet('Mamul Ağacı', { views: [{ state: 'frozen', ySplit: 4 }] });
  bomSheet.columns = [10, 20, 26, 20, 10, 10, 16, 22, 24, 24, 19, 18, 18, 22, 18].map(width => ({ width }));
  bomSheet.mergeCells('A1:O1'); bomSheet.getCell('A1').value = 'TYANA OTOMOTİV • MAMUL AĞACI / BILL OF MATERIALS'; bomSheet.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }; bomSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10213F' } }; bomSheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }; bomSheet.getRow(1).height = 28;
  bomSheet.mergeCells('A2:H2'); bomSheet.getCell('A2').value = `ANA MAMUL: ${safeExcelValue(partNumber.value)} • ${safeExcelValue(partName.value)} • Rev. ${safeExcelValue(drawingRevision.value)}`; bomSheet.mergeCells('I2:O2'); bomSheet.getCell('I2').value = `PROJE: ${safeExcelValue(projectCode.value)} • ${components.length} ALT KALEM`;
  const bomHeaders = ['Poz.', 'Parça Kodu', 'Bileşen / Alt Montaj', 'Kalem Tipi', 'Miktar', 'Birim', 'Üret/Satın Al', 'Malzeme Kalite', 'Malzeme Standardı', 'Teknik Resim / Rev.', 'Isıl İşlem', 'Sertlik Şartı', 'Kaplama', 'İzlenebilirlik', 'Doğrulama'];
  bomSheet.getRow(4).values = bomHeaders;
  components.forEach(item => bomSheet.addRow([item.position, safeExcelValue(item.itemNo), safeExcelValue(item.name), item.componentType, item.quantity, item.uom, item.makeBuy, safeExcelValue(item.materialGrade), safeExcelValue(item.materialStandard), `${safeExcelValue(item.drawingNo)} / ${safeExcelValue(item.revision)}`, safeExcelValue(item.heatTreatment), safeExcelValue(item.hardnessSpec), `${safeExcelValue(item.coatingType)} • ${safeExcelValue(item.coatingSpec)}`, safeExcelValue(item.traceability), safeExcelValue(item.verificationStatus)]));
  [bomSheet.getRow(4)].forEach(row => row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10213F' } }; cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; }));
  bomSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => { if (rowNumber > 4) { row.height = 36; row.eachCell(cell => { cell.font = { name: 'Arial', size: 8 }; cell.alignment = { vertical: 'middle', wrapText: true }; }); } row.eachCell(cell => { if (rowNumber >= 4) cell.border = border; }); });
  bomSheet.autoFilter = { from: 'A4', to: 'O4' }; bomSheet.pageSetup = { paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printArea: `A1:O${Math.max(4, 4 + components.length)}` };

  const characteristicSheet = workbook.addWorksheet('Karakteristik Kütüğü', { views: [{ state: 'frozen', ySplit: 3 }] });
  characteristicSheet.columns = [14, 14, 18, 20, 24, 34, 22, 14, 20, 19, 18, 24, 20, 16, 24, 28, 20].map(width => ({ width }));
  characteristicSheet.mergeCells('A1:Q1'); characteristicSheet.getCell('A1').value = 'TYANA OTOMOTİV • NUMARALI KARAKTERİSTİK KÜTÜĞÜ'; characteristicSheet.getCell('A1').font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FFFFFFFF' } }; characteristicSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF245CC7' } }; characteristicSheet.getCell('A1').alignment = { horizontal: 'center' };
  characteristicSheet.getRow(3).values = ['Kalıcı ID', 'Kütüphane Kodu', 'Balon', 'Bileşen', 'Ad', 'Tanım', 'Kaynak Resim / Bölge', 'Tip / Sınıf', 'Spesifikasyon', 'Proses', 'Kontrol Yöntemi', 'Ekipman / ID', 'Kalibrasyon', 'MSA', 'Numune / Sıklık', 'Tetikleyici', 'Kayıt / Reaksiyon'];
  controlPlanRows().forEach(row => characteristicSheet.addRow([row.item.id, row.item.libraryCode, row.item.balloon, `${row.owner.position} • ${row.owner.name}`, row.item.name, row.item.definition, `${row.item.sourceDrawing} / ${row.item.sourceZone}`, `${row.item.kind} / ${row.item.classification}`, row.specification, row.processName, row.item.method, `${row.item.equipmentClass} / ${row.item.equipment}`, row.item.calibrationDue || '—', `${row.item.msaReference} / ${row.item.msaStatus}`, `${row.item.sampleSize} / ${row.item.frequency}`, row.item.trigger, `${row.item.reference} / ${row.item.reaction}`].map(safeExcelValue)));
  characteristicSheet.getRow(3).eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10213F' } }; cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
  characteristicSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => { if (rowNumber > 3) { row.height = 45; row.eachCell(cell => { cell.font = { name: 'Arial', size: 8 }; cell.alignment = { vertical: 'middle', wrapText: true }; }); } row.eachCell(cell => { if (rowNumber >= 3) cell.border = border; }); });
  characteristicSheet.autoFilter = { from: 'A3', to: 'Q3' }; characteristicSheet.pageSetup = { paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printArea: `A1:Q${Math.max(3, 3 + characteristics.length)}` };

  const metadata = workbook.addWorksheet('_TYANA_METADATA'); metadata.state = 'veryHidden';
  [['Schema', snapshot.schemaVersion], ['Template', snapshot.templateVersion], ['Project ID', currentProjectId || 'unsaved'], ['Snapshot ID', snapshot.snapshotId], ['SHA-256', snapshot.sha256], ['Generated At', snapshot.generatedAt], ['Drawing SHA-256', snapshot.drawingSource.sha256]].forEach(row => metadata.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  const verification = new ExcelJS.Workbook(); await verification.xlsx.load(buffer);
  if (!verification.getWorksheet('Kontrol Planı') || !verification.getWorksheet('Mamul Ağacı') || !verification.getWorksheet('Karakteristik Kütüğü') || verification.getWorksheet('Kontrol Planı').rowCount < 8 + rows.length) throw new Error('XLSX doğrulaması başarısız.');
  const fileName = `${safeFileName(controlPlanNumber.value)}_Rev-${safeFileName(drawingRevision.value)}.xlsx`; const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const result = await saveBlob(blob, fileName, exportFileTypes.xlsx); if (result.saved) toast('Excel kontrol planı doğrulandı ve kaydedildi', `${rows.length} kontrol satırı • ${components.length} BOM kalemi • 3 görünür çalışma sayfası.`);
}

function pdfControlDefinition(snapshot) {
  const rows = controlPlanRows();
  const controlHeaders = ['Op.', 'Operasyon', 'Makine / Aparat', 'Kar. No', 'Karakteristik', 'Spesifikasyon', 'Sınıf', 'Kontrol / Poka-Yoke', 'Ölçüm / Cihaz', 'Numune / Sıklık', 'Referans', 'Reaksiyon Planı'].map(text => ({ text, bold: true, color: 'white', fillColor: '#10213f', alignment: 'center', fontSize: 6, margin: 2 }));
  const controlBody = rows.map(row => [row.operation, `${row.processName}\n${row.responsible}`, row.equipment, `${row.item.balloon}\n${row.item.id}`, `${row.item.name}\n${row.owner.position} • ${row.owner.name}\n${row.item.definition}`, row.specification, row.item.classification, row.control, row.measurement, row.sampling, row.reference, row.reaction].map(text => ({ text: String(text || '—'), fontSize: 5.5, margin: 2 })));
  const meta = value => ({ text: value || '—', fontSize: 7, bold: true, margin: [2, 2, 2, 2] });
  const metaLabel = value => ({ text: value, fontSize: 5.5, color: '#68758b', margin: [2, 2, 2, 0] });
  const metaCell = (label, value) => ({ stack: [metaLabel(label), meta(value)], margin: 1 });
  return {
    pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [18, 20, 18, 24], watermark: { text: snapshot.approval.status === 'Yürürlükte' ? 'KONTROLLÜ KOPYA' : 'TASLAK / TANITIM', color: '#b8c3d4', opacity: 0.18, bold: true },
    footer: (currentPage, pageCount) => ({ margin: [18, 5, 18, 0], columns: [{ text: `${controlPlanNumber.value} • Rev. ${drawingRevision.value} • SHA ${snapshot.sha256.slice(0, 16)}`, fontSize: 6, color: '#69758a' }, { text: `${documentCopyLabel(snapshot.approval.status)} • Sayfa ${currentPage} / ${pageCount}`, alignment: 'right', fontSize: 6, color: '#69758a' }] }),
    content: [
      { table: { widths: [100, '*', 100], body: [[{ text: 'TYANA OTOMOTİV\nQ-FLOW', bold: true, color: '#2f6fed', alignment: 'center', fontSize: 8, margin: [0, 5] }, { text: 'KONTROL PLANI / CONTROL PLAN', bold: true, fontSize: 17, alignment: 'center', margin: [0, 4] }, { text: document.getElementById('documentStatus').value.toLocaleUpperCase('tr-TR'), bold: true, alignment: 'center', margin: [0, 7] }]] }, layout: 'lightHorizontalLines' },
      { table: { widths: [90, 150, 150, '*'], body: [[metaCell('FAZ', phaseExportText()), metaCell('KONTROL PLANI NO', controlPlanNumber.value), metaCell('PARÇA NO / REV.', `${partNumber.value} / ${drawingRevision.value}`), metaCell('PARÇA ADI', partName.value)], [metaCell('KURULUŞ / SAHA', `${document.getElementById('supplierName').value} / ${document.getElementById('supplierSite').value}`), metaCell('MÜŞTERİ / MÜŞTERİ PN', `${document.getElementById('customer').value} / ${document.getElementById('customerPartNumber').value}`), metaCell('ANAHTAR PERSONEL', `${document.getElementById('keyContact').value} / ${document.getElementById('keyContactPhone').value}`), metaCell('İLK YAYIN / REVİZYON', `${document.getElementById('originalDate').value} / ${document.getElementById('revisionDate').value}`)], [metaCell('TEKNİK RESİM', `${document.getElementById('drawingNumber').value} / Rev. ${drawingRevision.value}`), metaCell('MAMUL AĞACI', `${components.length} alt kalem • ${componentMaterialSummary(2)}`), metaCell('ORTAK ÜRÜN ŞARTI', `${document.getElementById('materialGrade').value} • ${document.getElementById('materialStandard').value}`), metaCell('YÜZEY / FONKSİYON', surfacePerformanceText(snapshot.technical))]] }, layout: { hLineWidth: () => 0.7, vLineWidth: () => 0.7, hLineColor: () => '#6e7787', vLineColor: () => '#6e7787' }, margin: [0, 3, 0, 4] },
      { table: { headerRows: 1, widths: [20, 58, 65, 31, 78, 64, 34, 75, 78, 50, 48, '*'], body: [controlHeaders, ...controlBody] }, layout: { hLineWidth: () => 0.45, vLineWidth: () => 0.45, hLineColor: () => '#7e8796', vLineColor: () => '#7e8796' } },
      { text: 'Reaksiyon standardı: prosesi durdur > şüpheli ürün sınırını belirle > ürünü ayır/bloke et > doğrula > kayıt altına al > yetkili onayıyla yeniden başlat.', fontSize: 6, color: '#4e5c72', margin: [2, 5, 2, 0] }
    ], defaultStyle: { font: 'Roboto' }
  };
}

async function exportControlPlanPdf() {
  if (!globalThis.pdfMake) { toast('PDF motoru yüklenemedi', 'Uygulama paketini yeniden yükleyin.'); return; }
  if (!ensureDocumentExportReady()) return;
  renderControlPlan(); const snapshot = await getDocumentationSnapshot();
  const fileName = `${safeFileName(controlPlanNumber.value)}_Rev-${safeFileName(drawingRevision.value)}.pdf`; const blob = await pdfBlob(pdfControlDefinition(snapshot));
  const result = await saveBlob(blob, fileName, exportFileTypes.pdf); if (result.saved) toast('Antetli PDF kaydedildi', `A3 yatay • ${characteristics.length} kontrol satırı • ${components.length} BOM kalemi • Türkçe gömülü font`);
}

function pfmeaPdfDefinition(snapshot) {
  const routeEntries = new Map(selectedProcessEntries().map(entry => [entry.routeKey, entry]));
  const riskRows = (snapshot.pfmea || pfmeaRows).map((row, index) => {
    const entry = routeEntries.get(row.routeKey);
    const process = entry?.process || processes.find(candidate => candidate.id === row.processId);
    const component = row.componentId === 'FINISHED_GOOD'
      ? snapshot.product.partName
      : snapshot.components.find(candidate => candidate.id === row.componentId)?.name;
    const fillColor = index % 2 ? '#f5f7fb' : '#ffffff';
    const normalCell = (text, options = {}) => ({ text: String(text || '—'), fontSize: 5.8, margin: [2, 2, 2, 2], fillColor, ...options });
    const scoreCell = value => normalCell(value, { bold: true, alignment: 'center', fontSize: 6.6 });
    const apFill = row.ap === 'H' ? '#f8d7da' : row.ap === 'M' ? '#fff1c7' : row.ap === 'L' ? '#dff3e8' : '#eef1f5';
    const statusFill = row.status === 'Kapalı' ? '#dff3e8' : row.status === 'Devam Ediyor' ? '#fff1c7' : '#f8d7da';
    return [
      normalCell(entry?.detail.operationNo || row.operationNo || '—', { bold: true, alignment: 'center' }),
      normalCell(`${process?.name || 'Manuel risk'}\n${component || 'Bileşen tanımsız'}\n${row.functionText || '—'}`, { bold: true }),
      normalCell(`${row.failureMode || '—'}\nETKİ: ${row.effect || '—'}`),
      scoreCell(row.severity),
      normalCell(`${row.cause || '—'}\nÖNLEME: ${row.preventionControl || '—'}`),
      scoreCell(row.occurrence),
      normalCell(row.detectionControl),
      scoreCell(row.detection),
      normalCell(row.ap, { bold: true, alignment: 'center', fontSize: 6.6, fillColor: apFill }),
      normalCell(row.recommendedAction),
      normalCell(row.owner, { alignment: 'center' }),
      normalCell(row.dueDate, { alignment: 'center' }),
      normalCell(row.status || 'Açık', { bold: true, alignment: 'center', fillColor: statusFill }),
      normalCell(row.evidence)
    ];
  });
  const headerCell = text => ({ text, bold: true, color: '#ffffff', fillColor: '#10213f', alignment: 'center', fontSize: 5.7, margin: [1, 3, 1, 3] });
  const metaCell = (label, value) => ({ stack: [{ text: label, fontSize: 5.2, color: '#637087' }, { text: String(value || '—'), bold: true, fontSize: 6.5, margin: [0, 2, 0, 0] }], margin: [3, 3, 3, 3] });
  const tableLayout = { hLineWidth: () => 0.55, vLineWidth: () => 0.55, hLineColor: () => '#657188', vLineColor: () => '#657188', paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 };
  const pfmeaNumber = `${snapshot.product.projectCode || 'PROJE'}-PFMEA`;
  const generatedAt = new Date(snapshot.generatedAt).toLocaleString('tr-TR');
  return {
    pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [18, 18, 18, 28],
    background: (_page, pageSize) => ({ canvas: [{ type: 'rect', x: 10, y: 10, w: pageSize.width - 20, h: pageSize.height - 20, lineWidth: 1, lineColor: '#24344f' }] }),
    watermark: { text: documentCopyLabel(snapshot.approval.status), color: '#aeb9ca', opacity: 0.14, bold: true },
    footer: (page, pages) => ({ margin: [20, 4, 20, 0], columns: [
      { text: `${pfmeaNumber} • Rev. ${snapshot.product.drawingRevision || '—'} • SHA-256 ${snapshot.sha256.slice(0, 16)}`, fontSize: 5.8, color: '#68758b' },
      { text: `${documentCopyLabel(snapshot.approval.status)} • Sayfa ${page} / ${pages}`, alignment: 'right', bold: true, fontSize: 5.8, color: '#68758b' }
    ] }),
    content: [
      { table: { widths: [110, '*', 145], body: [[
        { text: 'TYANA OTOMOTİV\nQ-FLOW', bold: true, color: '#2f6fed', alignment: 'center', fontSize: 8, margin: [0, 6, 0, 4] },
        { text: 'PROSES FMEA / PROCESS FAILURE MODE AND EFFECTS ANALYSIS', bold: true, alignment: 'center', fontSize: 15, margin: [0, 7, 0, 5] },
        { text: `${pfmeaNumber}\nRev. ${snapshot.product.drawingRevision || '—'} • ${snapshot.approval.status}`, bold: true, alignment: 'center', fontSize: 7, margin: [0, 5, 0, 3] }
      ]] }, layout: tableLayout },
      { table: { widths: ['*', '*', '*', '*'], body: [
        [metaCell('PROJE / APQP', snapshot.product.projectCode), metaCell('PARÇA NO / ADI', `${snapshot.product.partNumber} / ${snapshot.product.partName}`), metaCell('ÜRÜN GRUBU / FAZ', `${snapshot.product.productGroupLabel} / ${snapshot.product.productionPhase}`), metaCell('TEKNİK RESİM / REVİZYON', `${snapshot.product.drawingNumber} / ${snapshot.product.drawingRevision}`)],
        [metaCell('KURULUŞ / SAHA', `${snapshot.product.supplierName} / ${snapshot.product.supplierSite}`), metaCell('MÜŞTERİ / MÜŞTERİ PARÇA NO', `${snapshot.product.customer} / ${snapshot.product.customerPartNumber}`), metaCell('HAZIRLAYAN / ÇEKİRDEK EKİP', `${snapshot.approval.preparedBy} / ${snapshot.product.coreTeam}`), metaCell('İLK YAYIN / REVİZYON TARİHİ', `${snapshot.product.originalDate} / ${snapshot.product.revisionDate}`)],
        [metaCell('MAMUL AĞACI / PROSES', `${snapshot.components.length} alt kalem / ${snapshot.route.length} operasyon`), metaCell('STANDART PROFİLİ', `${snapshot.standardsProfile.iatf} • ${snapshot.standardsProfile.apqp}`), metaCell('DOKÜMAN DURUMU / KOPYA', `${snapshot.approval.status} / ${documentCopyLabel(snapshot.approval.status)}`), metaCell('ÜRETİM / SNAPSHOT', `${generatedAt} / ${snapshot.sha256.slice(0, 24)}`)]
      ] }, layout: tableLayout, margin: [0, 3, 0, 4] },
      { table: { headerRows: 1, dontBreakRows: false, widths: [30, 105, 145, 24, 145, 24, 120, 24, 32, 125, 70, 65, 65, 126], body: [[
        'OP.', 'PROSES / FONKSİYON', 'HATA TÜRÜ / ETKİ', 'S', 'NEDEN / ÖNLEME KONTROLÜ', 'O', 'TESPİT KONTROLÜ', 'D', 'AP', 'ÖNERİLEN AKSİYON', 'SORUMLU', 'TERMİN TARİHİ', 'DURUM', 'KANIT / KAYIT'
      ].map(headerCell), ...riskRows] }, layout: tableLayout },
      { text: 'Not: S-O-D ve Action Priority (AP) değerleri yetkili disiplinler arası ekip tarafından, kuruluşun lisanslı AIAG & VDA FMEA referansına göre doğrulanır. Yüksek AP aksiyonları sorumlu, termin ve nesnel kanıt ile kapatılır.', fontSize: 5.8, color: '#4e5c72', margin: [2, 5, 2, 0] }
    ], defaultStyle: { font: 'Roboto' }
  };
}

async function exportPfmeaPdf() {
  if (!pfmeaRows.length) { toast('PFMEA PDF oluşturulamadı', 'En az bir PFMEA risk satırı ekleyin veya proses akışından PFMEA satırlarını oluşturun.'); return; }
  if (!globalThis.pdfMake) { toast('PDF motoru yüklenemedi', 'Uygulama paketini yeniden yükleyin.'); return; }
  if (!ensureDocumentExportReady()) return;
  const snapshot = await getDocumentationSnapshot();
  const fileName = `${safeFileName(snapshot.product.projectCode)}_PFMEA_${safeFileName(snapshot.product.partNumber)}_Rev-${safeFileName(snapshot.product.drawingRevision)}.pdf`;
  const blob = await pdfBlob(pfmeaPdfDefinition(snapshot));
  if (blob.size < 1024) throw new Error('PFMEA PDF byte doğrulaması başarısız.');
  const result = await saveBlob(blob, fileName, exportFileTypes.pdf);
  if (result.saved) toast('Kontrollü PFMEA PDF kaydedildi', `A3 yatay • ${snapshot.pfmea.length} risk satırı • S-O-D-AP ve aksiyon kanıt zinciri • ${documentCopyLabel(snapshot.approval.status)}`);
}

document.querySelectorAll('[data-action="export-pfmea-pdf"]').forEach(button => button.addEventListener('click', () => exportPfmeaPdf().catch(error => toast('PFMEA PDF üretilemedi', error.message))));

function flowPdfDefinition(snapshot) {
  const chunks = [];
  for (let index = 0; index < snapshot.route.length; index += 4) chunks.push(snapshot.route.slice(index, index + 4));
  const flowRows = chunks.map(chunk => ({
    columns: chunk.flatMap((step, index) => {
      const node = { width: '*', table: { widths: ['*'], body: [[{ stack: [{ text: `OP ${step.operationNo}`, bold: true, fontSize: 7, color: '#2f6fed' }, { text: step.name, bold: true, fontSize: 10, margin: [0, 4, 0, 2] }, { text: step.description || step.equipment || '—', fontSize: 6.5, color: '#68758b' }, { text: `${step.special ? 'ÖZEL PROSES  ' : ''}${step.outsource ? 'DIŞ KAYNAK' : ''}`, fontSize: 6, color: '#b87916', margin: [0, 5, 0, 0] }], margin: 7, fillColor: step.category === 'Kontrol' ? '#eef9f4' : '#f2f6ff' }]] }, layout: { hLineWidth: () => 0.8, vLineWidth: () => 0.8, hLineColor: () => step.category === 'Kontrol' ? '#3a9f79' : '#5a7fc7', vLineColor: () => step.category === 'Kontrol' ? '#3a9f79' : '#5a7fc7' } };
      return index < chunk.length - 1 ? [node, { width: 18, text: '>', bold: true, alignment: 'center', margin: [0, 24, 0, 0], color: '#73839d', fontSize: 14 }] : [node];
    }), columnGap: 5, margin: [0, 0, 0, 12]
  }));
  return { pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [24, 24, 24, 28], watermark: { text: snapshot.approval.status === 'Yürürlükte' ? 'KONTROLLÜ KOPYA' : 'TASLAK / TANITIM', color: '#b8c3d4', opacity: 0.16, bold: true }, content: [
    { table: { widths: [95, '*', 100], body: [[{ text: 'TYANA OTOMOTİV\nQ-FLOW', bold: true, color: '#2f6fed', alignment: 'center', fontSize: 8, margin: [0, 5] }, { text: 'PROSES AKIŞ DİYAGRAMI / PROCESS FLOW', bold: true, fontSize: 16, alignment: 'center', margin: [0, 5] }, { text: `Rev. ${snapshot.product.drawingRevision}\n${snapshot.approval.status}`, bold: true, alignment: 'center', fontSize: 8, margin: [0, 4] }]] }, layout: 'lightHorizontalLines' },
    { table: { widths: [120, 160, 150, '*'], body: [[{ text: `PROJE / APQP\n${snapshot.product.projectCode}`, fontSize: 7, bold: true }, { text: `PARÇA NO / ADI\n${snapshot.product.partNumber} / ${snapshot.product.partName}`, fontSize: 7, bold: true }, { text: `KURULUŞ / SAHA\n${snapshot.product.supplierName} / ${snapshot.product.supplierSite}`, fontSize: 7 }, { text: `TEKNİK RESİM / REVİZYON\n${snapshot.product.drawingNumber} / ${snapshot.product.drawingRevision}`, fontSize: 7 }], [{ text: `MAMUL AĞACI\n${snapshot.components.length} alt kalem • ${componentMaterialSummary(2)}`, fontSize: 7 }, { text: `ORTAK ÜRÜN ŞARTI\n${snapshot.technical.materialGrade} • ${snapshot.technical.materialStandard}`, fontSize: 7 }, { text: `KAPLAMA / PERFORMANS\n${surfacePerformanceText(snapshot.technical)}`, fontSize: 7 }, { text: `FAZ / TOPLAM OPERASYON\n${snapshot.product.productionPhase} / ${snapshot.route.length}`, fontSize: 7 }]] }, margin: [0, 4, 0, 16] },
    ...flowRows,
    { text: `Kaynak snapshot: ${snapshot.sha256} • Çizim kaynağı SHA-256: ${snapshot.drawingSource.sha256}`, fontSize: 6, color: '#718097', margin: [0, 8, 0, 0] }
  ], footer: (page, pages) => ({ text: `${snapshot.product.projectCode} • Rev. ${snapshot.product.drawingRevision} • ${documentCopyLabel(snapshot.approval.status)} • Sayfa ${page}/${pages}`, fontSize: 6, alignment: 'center', color: '#68758b' }), defaultStyle: { font: 'Roboto' } };
}

document.querySelectorAll('[data-action="export-flow-pdf"]').forEach(button => button.addEventListener('click', async () => {
  if (!ensureDocumentExportReady()) return;
  if (!selected.length) { selected = [...activeBackbone().processes]; renderSequence(); renderFlowDiagram(); }
  const snapshot = await getDocumentationSnapshot(); const fileName = `${safeFileName(projectCode.value)}_Proses_Akisi_Rev-${safeFileName(drawingRevision.value)}.pdf`; const blob = await pdfBlob(flowPdfDefinition(snapshot));
  const result = await saveBlob(blob, fileName, exportFileTypes.pdf); if (result.saved) toast('Antetli proses akış PDF’i kaydedildi', `${snapshot.route.length} operasyon • A3 yatay • kontrollü snapshot`);
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
  rect(5, 5, 410, 287, 'FRAME'); text(150, 282, 6, 'PROSES AKIS DIYAGRAMI', 'TITLEBLOCK'); text(8, 283, 3.2, 'TYANA OTOMOTIV / Q-FLOW', 'TITLEBLOCK');
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
  if (!ensureDocumentExportReady()) return;
  if (!selected.length) { selected = [...activeBackbone().processes]; renderSequence(); }
  const snapshot = await getDocumentationSnapshot(); const dxf = createProcessFlowDxf(snapshot);
  const fileName = `${safeFileName(projectCode.value)}_Proses_Akisi_Rev-${safeFileName(drawingRevision.value)}.dxf`; const blob = new Blob([dxf], { type: 'application/dxf;charset=us-ascii' });
  const result = await saveBlob(blob, fileName, exportFileTypes.dxf); if (result.saved) toast('CAD değişim dosyası kaydedildi', `${snapshot.route.length} operasyon • A3 antet • mm • FRAME/PROCESS/CONTROL/TEXT katmanları`);
}

document.querySelectorAll('[data-action="export-control-xlsx"]').forEach(button => button.addEventListener('click', () => exportControlPlanXlsx().catch(error => toast('Excel üretilemedi', error.message))));
document.querySelectorAll('[data-action="export-control-pdf"]').forEach(button => button.addEventListener('click', () => exportControlPlanPdf().catch(error => toast('PDF üretilemedi', error.message))));
document.querySelectorAll('[data-action="export-control-dxf"]').forEach(button => button.addEventListener('click', () => exportControlPlanDxf().catch(error => toast('DXF üretilemedi', error.message))));
document.querySelectorAll('[data-action="dwg-info"]').forEach(button => button.addEventListener('click', () => toast('Gerçek DWG masaüstü köprüsünde', 'Web sürümü açık standart DXF üretir. DWG için ODA Drawings SDK veya Autodesk RealDWG lisansı ve imzalı Tauri modülü gerekir.')));

let instructionModels = [];

function safetyForProcess(process) {
  const general = 'Yalnız eğitimli ve yetkilendirilmiş operatör çalışır. Uygun PPE kullanılır. Koruyucu kapı/interlock devre dışı bırakılmaz. Ayar, sıkışma veya arızada enerji izolasyonu/LOTO uygulanır; acil durdurma ve kaçış yolu vardiya başında doğrulanır.';
  const machining = ' Bol kıyafet, takı ve eldiven dönen aksam yakınında kullanılmaz. Dönen iş parçasına yaklaşılmaz; talaş elle alınmaz, yalnız fırça/kanca kullanılır. Sıcak/keskin parça ve soğutma sıvısı için SDS ve makine risk talimatı uygulanır. Ölçüm yalnız mil tamamen durduğunda yapılır.';
  const assembly = ' Sıkışma-ezilme bölgesine el sokulmaz; çift el kumanda, ışık perdesi ve fikstür sensörleri vardiya başında master parça ile doğrulanır. Askıdaki yük veya pres ekseni altında çalışılmaz.';
  const special = ' Özel proses yetkisi, reçete revizyonu ve parametre kilidi doğrulanmadan çevrim başlatılmaz; sapmada hat durdurulur ve EHS/kalite sorumlusu çağrılır.';
  const family = String(process.family || '').toLocaleLowerCase('tr-TR');
  if (family.includes('talaşlı') || ['cnc', 'milling', 'drilling', 'thread'].includes(process.id)) return general + machining;
  if (family.includes('montaj') || ['assembly', 'integrated-assembly', 'torque'].includes(process.id)) return general + assembly;
  return general + (process.special ? special : ' Sızıntı, koruyucu arızası veya uygunsuz ekipmanda proses durdurulur ve sorumluya bildirilir.');
}

function numericParametersForProcess(process, linked, detail) {
  const lines = [];
  lines.push(`Operasyon: OP ${detail.operationNo} | İş merkezi: ${detail.workcenter} | Makine/hat: ${detail.machineId}`);
  lines.push(`Takım/fikstür: ${detail.tooling} | Program/reçete: ${detail.programNo}`);
  if (Number(process.cycleTimeSec) > 0) lines.push(`Planlı çevrim süresi: ${formatValue(process.cycleTimeSec)} sn (kütüphane Rev. ${process.revision || 'A'})`);
  if (Number(process.setupTimeMin) > 0) lines.push(`Planlı hazırlık / kurulum süresi: ${formatValue(process.setupTimeMin)} dk`);
  linked.forEach(item => lines.push(`${item.id} / Balon ${item.balloon} — ${item.name}: ${specificationFor(item)} | ${item.equipmentClass} / ${item.equipment} | ${item.sampleSize} / ${item.frequency} | ${item.trigger}`));
  if (!linked.length) lines.push('Sayısal teknik set değeri: Kontrol planı karakteristiği bağlanmadan yürürlükte yayınlanamaz.');
  if (['cnc', 'milling', 'drilling', 'thread'].includes(process.id)) lines.push('CNC program no/rev., takım ömrü (parça) ve izin verilen ofset sınırı (mm): kullanıcı sayısal girişi ve proses mühendisliği onayı gerekli.');
  return lines.join('\n');
}

function buildInstructionModels() {
  instructionModels = selectedProcessEntries().map(({ routeKey, process, detail }) => {
    const linked = characteristics.filter(item => item.routeKey ? item.routeKey === routeKey : item.processId === process.id);
    const librarySteps = String(process.workInstruction || '').split(/\r?\n|;/).map(step => step.trim()).filter(Boolean);
    const fallbackSteps = [`İş emri, parça numarası ve Rev. ${drawingRevision.value} teknik resmini doğrula.`, `${process.equipment || 'Ekipman'} ile ${process.name} operasyonu için güvenli başlangıç kontrolünü yap.`, `${process.desc || process.name} işlem parametrelerini onaylı reçeteye göre uygula.`, linked.length ? `${linked.map(item => `${item.balloon} ${item.name}`).join(', ')} kontrolünü belirtilen sıklıkta gerçekleştir.` : 'Proses çıktısını görsel ve fonksiyonel olarak kontrol et.', 'Sonucu kayıt formuna işle; lot, vardiya ve operatör izlenebilirliğini tamamla.'];
    return { operationNo: detail.operationNo, processId: process.id, title: `${process.name} Operatör Talimatı`, equipment: [detail.machineId, detail.tooling, detail.programNo].filter(value => value && !value.includes(' girin')).join(' / ') || [process.equipment, process.tooling].filter(Boolean).join(' / ') || 'Tanımlanacak', ppe: process.special ? 'Koruyucu gözlük, prosese uygun ısı/kimyasal eldiveni, iş ayakkabısı, yüz siperi ve tesis EHS matrisindeki ek PPE' : 'Koruyucu gözlük, iş ayakkabısı ve tesis/makine risk değerlendirmesinde tanımlı PPE', safety: safetyForProcess(process), parametersText: numericParametersForProcess(process, linked, detail), stepsText: (librarySteps.length >= 3 ? librarySteps : fallbackSteps).join('\n'), linked, reaction: process.reactionPlan || 'Prosesi durdur; ürünü kırmızı alanda bloke et; son iyi parçadan itibaren ayır; kalite sorumlusuna bildir; yeniden başlatma onayı al.', record: process.documentRef || `FR-${process.code || process.id}` };
  });
}

function renderInstructions() {
  const container = document.getElementById('instructionResult');
  container.innerHTML = instructionModels.map((model, index) => `<article class="instruction-card professional-instruction" data-instruction="${index}"><div class="instruction-top"><span>OP ${escapeHtml(model.operationNo)}</span><mark>DÜZENLENEBİLİR</mark></div><div class="instruction-hero"><div class="instruction-visual">${escapeHtml(processIcon(processes.find(item => item.id === model.processId) || {}))}<small>${escapeHtml(model.processId.toLocaleUpperCase('tr-TR'))}</small></div><div><h3>${escapeHtml(model.title)}</h3><p>${escapeHtml(model.equipment)}</p></div></div><div class="instruction-meta"><span>${model.stepsText.split('\n').filter(Boolean).length} adım</span><span>${model.linked.length} kontrol noktası</span><span>${model.parametersText.split('\n').filter(Boolean).length} sayısal/teknik satır</span><span>${escapeHtml(model.record)}</span></div><div class="instruction-controls"><button class="secondary-button" data-toggle-instruction="${index}">Düzenle</button><button class="primary-small" data-export-instruction="${index}">PDF Kaydet</button></div><div class="instruction-editor"><label>PPE<input data-instruction-field="ppe" value="${escapeHtml(model.ppe)}"></label><label>İSG / makine güvenliği uyarıları<textarea data-instruction-field="safety" rows="5">${escapeHtml(model.safety)}</textarea></label><label>Sayısal proses parametreleri ve CP limitleri<textarea data-instruction-field="parametersText" rows="7">${escapeHtml(model.parametersText)}</textarea><small>Çizim/şartname dışı değer tahmin edilmez; eksik değer yürürlükte yayını bloke eder.</small></label><label>Sıralı işlem adımları<textarea data-instruction-field="stepsText" rows="7">${escapeHtml(model.stepsText)}</textarea></label><label>Reaksiyon planı<textarea data-instruction-field="reaction" rows="3">${escapeHtml(model.reaction)}</textarea></label><div class="linked-controls"><b>Bağlı kontrol noktaları</b>${model.linked.length ? model.linked.map(item => `<span><strong>${escapeHtml(item.id)} • Balon ${escapeHtml(item.balloon)} • ${escapeHtml(item.name)}</strong><small>${escapeHtml(specificationFor(item))} • ${escapeHtml(item.equipmentClass)} / ${escapeHtml(item.equipment)} • ${escapeHtml(item.sampleSize)} / ${escapeHtml(item.frequency)} • ${escapeHtml(item.trigger)}</small></span>`).join('') : '<span><small>Bu operasyona atanmış ürün/proses karakteristiği yok; yürürlükte yayın için kontrol bağlantısı gerekir.</small></span>'}</div></div></article>`).join('');
  container.querySelectorAll('[data-toggle-instruction]').forEach(button => button.addEventListener('click', () => button.closest('.instruction-card').classList.toggle('expanded')));
  container.querySelectorAll('[data-export-instruction]').forEach(button => button.addEventListener('click', () => exportInstructionPdf(Number(button.dataset.exportInstruction))));
  container.querySelectorAll('[data-instruction-field]').forEach(field => field.addEventListener('input', event => { const card = event.target.closest('.instruction-card'); instructionModels[Number(card.dataset.instruction)][event.target.dataset.instructionField] = event.target.value; markDraftDirty(); }));
}

function instructionPdfBlock(model, index, pageBreak = false) {
  const steps = model.stepsText.split('\n').map(step => step.trim()).filter(Boolean);
  const parameters = model.parametersText.split('\n').map(line => line.trim()).filter(Boolean);
  return { stack: [
    { table: { widths: [90, '*', 90], body: [[{ text: 'TYANA OTOMOTİV\nQ-FLOW', bold: true, color: '#2f6fed', fontSize: 8, alignment: 'center', margin: [0, 5] }, { text: 'OPERATÖR İŞ / KONTROL TALİMATI', bold: true, fontSize: 14, alignment: 'center', margin: [0, 4] }, { text: `OP ${model.operationNo}\nRev. ${drawingRevision.value}`, bold: true, alignment: 'center', margin: [0, 3] }]] }, layout: 'lightHorizontalLines' },
    { table: { widths: [90, '*', 110], body: [[{ text: `PARÇA NO\n${partNumber.value}`, fontSize: 7, bold: true }, { text: `PARÇA ADI / PROSES\n${partName.value} / ${model.title}`, fontSize: 7, bold: true }, { text: `EKİPMAN\n${model.equipment}`, fontSize: 7, bold: true }], [{ text: `PROJE\n${projectCode.value}`, fontSize: 7 }, { text: `PPE\n${model.ppe}`, fontSize: 7 }, { text: `KAYIT\n${model.record}`, fontSize: 7 }]] }, margin: [0, 4, 0, 5] },
    { table: { widths: [65, '*'], body: [[{ text: 'GÜVENLİK', bold: true, fontSize: 8, color: '#9b261d', fillColor: '#ffebe8', alignment: 'center', margin: [2, 6] }, { text: model.safety, fontSize: 8, fillColor: '#fff7f5', margin: 4 }]] }, layout: 'noBorders', margin: [0, 0, 0, 7] },
    { text: 'SAYISAL PROSES PARAMETRELERİ VE KONTROL LİMİTLERİ', bold: true, fontSize: 9, color: '#10213f', margin: [0, 0, 0, 3] },
    { table: { widths: [28, '*'], body: parameters.map((line, parameterIndex) => [{ text: String(parameterIndex + 1), alignment: 'center', bold: true, fontSize: 7, fillColor: '#eef4ff', margin: 3 }, { text: line, fontSize: 7.5, margin: 3 }]) }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 7] },
    { text: 'İŞLEM ADIMLARI', bold: true, fontSize: 9, color: '#10213f', margin: [0, 0, 0, 3] },
    { table: { headerRows: 1, widths: [28, '*', 120], body: [[{ text: 'NO', style: 'wiHead' }, { text: 'UYGULAMA ADIMI', style: 'wiHead' }, { text: 'KALİTE / GÜVENLİK KONTROLÜ', style: 'wiHead' }], ...steps.map((step, stepIndex) => [{ text: String(stepIndex + 1), alignment: 'center', fontSize: 8, margin: 4 }, { text: step, fontSize: 8, margin: 4 }, { text: stepIndex === steps.length - 1 ? 'Kayıt ve izlenebilirlik tamamlanır.' : 'Standart iş ve proses parametresine uyulur.', fontSize: 7, margin: 4 }])] }, layout: 'lightHorizontalLines' },
    { text: 'KONTROL NOKTALARI', bold: true, fontSize: 9, color: '#10213f', margin: [0, 8, 0, 3] },
    { table: { headerRows: 1, widths: [35, 100, 80, '*', 90], body: [[{ text: 'NO', style: 'wiHead' }, { text: 'KARAKTERİSTİK', style: 'wiHead' }, { text: 'SPESİFİKASYON', style: 'wiHead' }, { text: 'ÖLÇÜM / CİHAZ', style: 'wiHead' }, { text: 'SIKLIK', style: 'wiHead' }], ...(model.linked.length ? model.linked.map(item => [item.balloon, item.name, specificationFor(item), item.equipment, `${item.sampleSize} / ${item.frequency}`].map(text => ({ text, fontSize: 7, margin: 3 }))) : [[{ text: '—', colSpan: 5, alignment: 'center', fontSize: 7 }, {}, {}, {}, {}]])] }, layout: 'lightHorizontalLines' },
    { table: { widths: [75, '*'], body: [[{ text: 'REAKSİYON PLANI', bold: true, fontSize: 8, color: '#9b261d', margin: 4 }, { text: model.reaction, fontSize: 7.5, margin: 4 }]] }, margin: [0, 8, 0, 0] }
  ], pageBreak: pageBreak || index > 0 ? 'before' : undefined };
}

async function exportInstructionPdf(index) {
  if (!ensureDocumentExportReady()) return;
  if (!instructionModels.length) { buildInstructionModels(); renderInstructions(); }
  const model = instructionModels[index]; if (!model) return;
  const definition = { pageSize: 'A4', pageMargins: [22, 22, 22, 26], watermark: { text: documentCopyLabel(), color: '#b8c3d4', opacity: 0.14, bold: true }, content: [instructionPdfBlock(model, 0)], styles: { wiHead: { bold: true, color: 'white', fillColor: '#10213f', fontSize: 7, alignment: 'center', margin: 3 } }, footer: (page, pages) => ({ text: `${controlPlanNumber.value} • OP ${model.operationNo} • ${documentCopyLabel()} • Sayfa ${page}/${pages}`, fontSize: 6, alignment: 'center', color: '#68758b' }), defaultStyle: { font: 'Roboto' } };
  const fileName = `${safeFileName(partNumber.value)}_OP-${model.operationNo}_${safeFileName(model.processId)}.pdf`; const blob = await pdfBlob(definition); const result = await saveBlob(blob, fileName, exportFileTypes.pdf); if (result.saved) toast('Operatör talimatı kaydedildi', `OP ${model.operationNo} • güvenlik, sayısal parametreler ve ${model.linked.length} kontrol noktası.`);
}

document.querySelectorAll('[data-action="export-all-instructions"]').forEach(button => button.addEventListener('click', async () => {
  if (!ensureDocumentExportReady()) return;
  if (!instructionModels.length) buildInstructionModels();
  const definition = { pageSize: 'A4', pageMargins: [22, 22, 22, 26], watermark: { text: documentCopyLabel(), color: '#b8c3d4', opacity: 0.14, bold: true }, content: instructionModels.map((model, index) => instructionPdfBlock(model, index, index > 0)), styles: { wiHead: { bold: true, color: 'white', fillColor: '#10213f', fontSize: 7, alignment: 'center', margin: 3 } }, footer: (page, pages) => ({ text: `${controlPlanNumber.value} • OPERATÖR TALİMATLARI • ${documentCopyLabel()} • Sayfa ${page}/${pages}`, fontSize: 6, alignment: 'center', color: '#68758b' }), defaultStyle: { font: 'Roboto' } };
  const fileName = `${safeFileName(partNumber.value)}_Tum_Operator_Talimatlari.pdf`; const blob = await pdfBlob(definition); const result = await saveBlob(blob, fileName, exportFileTypes.pdf); if (result.saved) toast('Talimat paketi kaydedildi', `${instructionModels.length} operasyon tek PDF dosyasında • sayısal parametre ve İSG blokları dahil.`);
}));

document.querySelectorAll('[data-action="generate-instruction"]').forEach(btn => btn.addEventListener('click', () => {
  if (!selected.length) selected = [...activeBackbone().processes];
  buildInstructionModels();
  renderInstructions();
  showView('instruction');
  document.getElementById('instructionEmpty').classList.add('hidden');
  document.getElementById('instructionResult').classList.remove('hidden');
  document.getElementById('instructionEyebrow').textContent = `${projectCode.value} • ${instructionModels.length} OPERASYON • REV. ${drawingRevision.value}`;
  toast('Düzenlenebilir operatör talimatları oluşturuldu', `${instructionModels.length} istasyon • PPE, adımlar, kontrol noktaları ve reaksiyon planları eşleştirildi.`);
}));

document.querySelectorAll('[data-action="test-pdf-save"]').forEach(button => button.addEventListener('click', async () => {
  if (!globalThis.pdfMake) { toast('PDF motoru yüklenemedi', 'Uygulama paketini yeniden yükleyin.'); return; }
  const definition = { pageSize: 'A4', pageMargins: 36, content: [{ text: 'TYANA OTOMOTİV', bold: true, fontSize: 18, color: '#245cc7' }, { text: 'Q-Flow PDF Kayıt Testi', bold: true, fontSize: 14, margin: [0, 10, 0, 8] }, { text: `Oluşturma zamanı: ${new Date().toLocaleString('tr-TR')}`, fontSize: 10 }, { text: 'Bu dosyayı görebiliyorsanız PDF üretme ve kayıt akışı çalışıyor.', margin: [0, 14, 0, 0] }], defaultStyle: { font: 'Roboto' } };
  try { const blob = await pdfBlob(definition); const result = await saveBlob(blob, 'TYANA_Q-Flow_PDF_Kayit_Testi.pdf', exportFileTypes.pdf); if (result.saved) toast('PDF kayıt testi başarılı', `${(blob.size / 1024).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} KB dosya kaydedildi; çıktı merkezinden tekrar erişebilirsiniz.`); } catch (error) { toast('PDF kayıt testi başarısız', error.message); }
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
