const views = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item[data-view]');
const breadcrumb = document.getElementById('breadcrumbTitle');
const titles = {
  dashboard: 'Genel Bakış', product: 'Ürün Kartları', bom: 'Ürün Ağaçları', workplan: 'İş Planları', flow: 'Proses Akışı',
  dfmea: 'DFMEA', pfmea: 'PFMEA', control: 'Kontrol Planı', instruction: 'Operatör Talimatı',
  documents: 'PPAP Merkezi', library: 'Proses Kütüphanesi', users: 'Kullanıcı & Yetki'
};
titles.admin = 'Admin Merkezi';

const productModuleDefinitions = Object.freeze({
  product: { pane: 1, eyebrow: 'ÜRÜN ANA VERİSİ • BAĞIMSIZ MODÜL 01', title: 'Ürün Kartları ve Teknik Tanımlama', description: 'Ana mamulü ve tüm alt ürün kartlarını tanımlayın; bu modülde BOM miktarı veya operasyon sırası tutulmaz.' },
  bom: { pane: 2, eyebrow: 'ÜRÜN YAPISI • BAĞIMSIZ MODÜL 02', title: 'Çok Seviyeli Ürün Ağaçları', description: 'Onaylı ürün kartlarını sürükleyerek üst–alt ilişkisi, miktar, revizyon, alternatif ve geçerlilik bilgileriyle bağlayın.' },
  workplan: { pane: 3, eyebrow: 'ÜRETİM ROTALARI • BAĞIMSIZ MODÜL 03', title: 'İş Planları ve Makine Atamaları', description: 'Her üretilen kart için 380 standart operasyon kartından rota kurun, sırayı değiştirin ve uygun makineleri atayın.' }
});

function activateProductModule(moduleId = 'product') {
  const module = productModuleDefinitions[moduleId] || productModuleDefinitions.product;
  const productView = document.getElementById('product');
  if (!productView) return;
  productView.dataset.productModule = moduleId;
  document.querySelectorAll('#product .wizard-pane').forEach(pane => pane.classList.toggle('active', Number(pane.dataset.pane) === module.pane));
  document.querySelectorAll('#product .product-module-switcher [data-view-target]').forEach(button => button.classList.toggle('active', button.dataset.viewTarget === moduleId));
  const eyebrow = document.getElementById('productModuleEyebrow'); if (eyebrow) eyebrow.textContent = module.eyebrow;
  const title = document.getElementById('productModuleTitle'); if (title) title.textContent = module.title;
  const description = document.getElementById('productModuleDescription'); if (description) description.textContent = module.description;
  if (typeof currentWizardStep !== 'undefined') currentWizardStep = module.pane;
  if (moduleId === 'product') {
    setEngineeringBomStage('masters');
    renderItemMasterUi();
  } else if (moduleId === 'bom') {
    setEngineeringBomStage('structure');
    renderEngineeringBomStructure();
  } else if (moduleId === 'workplan') {
    globalThis.TyanaProductDefinition?.renderWorkPlanStudio();
  }
}

function showView(id) {
  const physicalViewId = Object.hasOwn(productModuleDefinitions, id) ? 'product' : id;
  views.forEach(view => view.classList.toggle('active', view.id === physicalViewId));
  navItems.forEach(item => item.classList.toggle('active', item.dataset.view === id));
  breadcrumb.textContent = titles[id] || 'Genel Bakış';
  if (Object.hasOwn(productModuleDefinitions, id)) activateProductModule(id);
  if (id === 'documents') {
    renderPpap(document.querySelector('[data-ppap-filter].active')?.dataset.ppapFilter || 'all');
    renderDocumentationAudit();
  }
  if (id === 'dfmea') globalThis.TyanaFmea?.render();
  if (id === 'pfmea') renderPfmea();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  window.dispatchEvent(new CustomEvent('tyana:view-changed', { detail: { id } }));
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

let activeLicenseStatus = null;

function renderLicenseStatus(status) {
  activeLicenseStatus = status;
  const badge = document.getElementById('trialStatusBadge');
  if (badge && globalThis.TyanaPlatform?.isDesktop) {
    badge.classList.remove('hidden', 'warning', 'danger');
    badge.classList.toggle('warning', status.active && status.state !== 'permanent' && Number(status.daysRemaining) <= 7);
    badge.classList.toggle('danger', !status.active);
    badge.querySelector('b').textContent = status.state === 'permanent' ? 'KALICI' : status.active ? `${status.daysRemaining} GÜN` : 'KİLİTLİ';
    badge.querySelector('small').textContent = status.state === 'permanent' ? 'Tam sürüm' : status.active ? 'Tam sürüm' : 'Süre doldu';
  }
  if (status.active) {
    document.getElementById('trialLockOverlay')?.classList.add('hidden');
    document.body.classList.remove('trial-locked');
    return true;
  }
  const overlay = document.getElementById('trialLockOverlay');
  if (overlay) {
    document.getElementById('trialLockTitle').textContent = status.state === 'expired' ? '30 günlük kullanım süresi sona erdi' : 'Lisans doğrulaması kilitlendi';
    document.getElementById('trialLockMessage').textContent = status.message || 'Uygulama güvenlik nedeniyle kilitlendi.';
    document.getElementById('trialLockDevice').textContent = status.deviceId || 'Doğrulanamadı';
    document.getElementById('trialLockExpiry').textContent = status.expiresAt ? new Date(status.expiresAt).toLocaleString('tr-TR') : 'Doğrulanamadı';
    overlay.classList.remove('hidden');
    document.body.classList.add('trial-locked');
  }
  return false;
}

async function initializeTrialGate() {
  try {
    const status = await globalThis.TyanaPlatform.licenseStatus();
    return renderLicenseStatus(status);
  } catch (error) {
    return renderLicenseStatus({
      active: false,
      state: 'tampered',
      daysRemaining: 0,
      deviceId: 'DOĞRULANAMADI',
      expiresAt: '',
      message: `Cihaz lisansı doğrulanamadı: ${error.message}`
    });
  }
}

function startTrialMonitor() {
  if (!globalThis.TyanaPlatform?.isDesktop || window.__tyanaTrialMonitor) return;
  const verify = () => globalThis.TyanaPlatform.licenseStatus().then(renderLicenseStatus).catch(error => renderLicenseStatus({
    active: false,
    state: 'tampered',
    daysRemaining: 0,
    deviceId: activeLicenseStatus?.deviceId || 'DOĞRULANAMADI',
    expiresAt: activeLicenseStatus?.expiresAt || '',
    message: `Cihaz lisansı yeniden doğrulanamadı: ${error.message}`
  }));
  window.__tyanaTrialMonitor = window.setInterval(verify, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') verify(); });
}

function renderAdminLicense(status = activeLicenseStatus) {
  if (!status) return;
  const permanent = status.state === 'permanent';
  const state = document.getElementById('adminLicenseState');
  const detail = document.getElementById('adminLicenseDetail');
  const badge = document.getElementById('adminLicenseBadge');
  const title = document.getElementById('adminLicenseTitle');
  const message = document.getElementById('adminLicenseMessage');
  const device = document.getElementById('adminLicenseDevice');
  const expiry = document.getElementById('adminLicenseExpiry');
  if (!state) return;
  state.textContent = permanent ? 'KALICI' : status.active ? 'AKTİF' : 'KİLİTLİ';
  detail.textContent = permanent ? 'Cihaz bağlı tam sürüm' : status.active ? `${status.daysRemaining} gün tam sürüm` : 'Aktivasyon bekleniyor';
  badge.textContent = permanent ? 'KALICI LİSANS' : status.active ? '30 GÜN DENEME' : 'KİLİTLİ';
  badge.classList.toggle('permanent', permanent);
  title.textContent = permanent ? 'Kalıcı tam sürüm etkin' : status.active ? '30 günlük tam sürüm denemesi' : 'Lisans doğrulaması gerekiyor';
  message.textContent = status.message || 'Lisans durumu okunuyor.';
  device.textContent = status.deviceId || '—';
  expiry.textContent = permanent ? 'Süresiz' : status.expiresAt ? new Date(status.expiresAt).toLocaleString('tr-TR') : '—';
  const input = document.getElementById('adminLicenseKey');
  const submit = document.querySelector('#adminLicenseForm button[type="submit"]');
  if (input) input.disabled = permanent;
  if (submit) { submit.disabled = permanent; submit.textContent = permanent ? 'Kalıcı Lisans Etkin' : 'Kalıcı Lisansı Etkinleştir'; }
}

function refreshAdminPanel() {
  renderAdminLicense(activeLicenseStatus);
  const score = document.getElementById('journeyScoreValue')?.textContent || '0%';
  const scoreTarget = document.getElementById('adminReadinessScore'); if (scoreTarget) scoreTarget.textContent = score;
  const health = document.getElementById('adminDataHealth'); const healthDetail = document.getElementById('adminDataHealthDetail');
  const loaded = Boolean(productEngineeringLibrary && pfmeaEngineeringLibrary && bomEngineeringLibrary && qualityDocumentLibrary && operationCodeLibrary);
  if (health) health.textContent = loaded ? 'HAZIR' : 'BEKLEMEDE';
  if (healthDetail) healthDetail.textContent = loaded ? 'Mühendislik kütüphaneleri yüklü' : 'Kütüphaneler yükleniyor';
  const tenant = document.getElementById('adminTenantName'); const plant = document.getElementById('adminTenantPlant');
  if (tenant) tenant.textContent = tenantProductName();
  if (plant) plant.textContent = tenantPlantName();
}

async function activatePermanentFromForm(form) {
  const input = form.querySelector('input'); const feedback = document.getElementById('adminLicenseFeedback');
  const key = input?.value.trim();
  if (!key) { if (feedback) feedback.textContent = 'Lisans anahtarını girin.'; input?.focus(); return; }
  const button = form.querySelector('button[type="submit"]'); if (button) { button.disabled = true; button.textContent = 'Doğrulanıyor…'; }
  try {
    const status = await globalThis.TyanaPlatform.activatePermanentLicense(key);
    renderLicenseStatus(status); renderAdminLicense(status);
    if (feedback) feedback.textContent = 'Kalıcı lisans başarıyla etkinleştirildi. Bu cihazda süresiz tam sürüm kullanılabilir.';
    if (input) { input.value = ''; input.disabled = true; }
    toast('Kalıcı lisans etkin', 'Cihaz bağlı tam sürüm aktivasyonu tamamlandı.');
  } catch (error) {
    if (feedback) feedback.textContent = error.message || 'Lisans aktivasyonu başarısız.';
    if (button) { button.disabled = false; button.textContent = 'Kalıcı Lisansı Etkinleştir'; }
  }
}

document.getElementById('adminLicenseForm')?.addEventListener('submit', event => { event.preventDefault(); activatePermanentFromForm(event.currentTarget); });
document.getElementById('trialActivationForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const feedback = document.getElementById('trialActivationFeedback');
  try {
    const status = await globalThis.TyanaPlatform.activatePermanentLicense(form.querySelector('input')?.value || '');
    renderLicenseStatus(status); renderAdminLicense(status); form.reset();
    if (feedback) feedback.textContent = 'Kalıcı lisans etkinleştirildi.';
  } catch (error) { if (feedback) feedback.textContent = error.message || 'Aktivasyon başarısız.'; }
});
document.querySelectorAll('[data-admin-action]').forEach(button => button.addEventListener('click', async () => {
  const action = button.dataset.adminAction;
  if (action === 'refresh') { const status = await globalThis.TyanaPlatform.licenseStatus(); renderLicenseStatus(status); renderAdminLicense(status); refreshAdminPanel(); toast('Admin durumu yenilendi', 'Lisans, çalışma alanı ve veri omurgası tekrar okundu.'); }
  if (action === 'open-users') showView('users');
  if (action === 'open-library') showView('library');
  if (action === 'open-guide') globalThis.TyanaGuide?.open?.();
  if (action === 'health') { globalThis.TyanaGuide?.open?.(); toast('Kalite zinciri denetimi açıldı', 'Akıllı Rehber eksik kapıları ve sıradaki doğru işi gösteriyor.'); }
  if (action === 'export-audit') document.querySelector('[data-action="export-audit-pdf"]')?.click();
}));
window.addEventListener('tyana:view-changed', event => { if (event.detail?.id === 'admin') refreshAdminPanel(); });

document.querySelector('[data-action="close-application"]')?.addEventListener('click', () => window.close());

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

const defaultTenantProfile = Object.freeze({
  id: 'tyana-qflow-default', profileVersion: '1.0.0', productName: 'TYANA Q-FLOW',
  legalName: 'Kullanıcı Tanımlı Kuruluş', shortName: 'Kullanıcı Tanımlı Kuruluş', plant: 'Kullanıcı Tanımlı Tesis', supplierCode: '',
  brand: 'TYANA Q-FLOW', activeCustomer: '', accent: '#2f6fed', navy: '#102b5c'
});
let activeTenantProfile = { ...defaultTenantProfile };

function tenantProductName() { return activeTenantProfile.productName || 'TYANA Q-FLOW'; }
function tenantOrganizationName() { return activeTenantProfile.legalName || activeTenantProfile.shortName || 'Kullanıcı Tanımlı Kuruluş'; }
function tenantShortName() { return activeTenantProfile.shortName || activeTenantProfile.legalName || 'Kullanıcı Tanımlı Kuruluş'; }
function tenantPlantName() { return activeTenantProfile.plant || 'Üretim tesisi kullanıcı tarafından doğrulanacak'; }
function tenantBrandLine() { return `${tenantProductName()} • ${tenantShortName()}`; }
function tenantSnapshotProfile() {
  return { id: activeTenantProfile.id, profileVersion: activeTenantProfile.profileVersion, productName: tenantProductName(), legalName: tenantOrganizationName(), shortName: tenantShortName(), plant: tenantPlantName(), supplierCode: activeTenantProfile.supplierCode || '', brand: tenantBrandLine(), activeCustomer: activeTenantProfile.activeCustomer || '', libraryId: activeTenantProfile.libraryId || '', libraryVersion: activeTenantProfile.libraryVersion || '' };
}

function applyTenantProfile(options = {}) {
  activeTenantProfile = {
    ...defaultTenantProfile,
    libraryId: qualityDocumentLibrary?.libraryId || '', libraryVersion: qualityDocumentLibrary?.libraryVersion || '',
    accent: defaultTenantProfile.accent, navy: defaultTenantProfile.navy
  };
  document.documentElement.style.setProperty('--tenant-accent', activeTenantProfile.accent);
  document.documentElement.style.setProperty('--tenant-navy', activeTenantProfile.navy);
  document.title = `${tenantProductName()} | Kalite Dokümantasyonu`;
  const plantPill = document.getElementById('tenantPlantPill');
  if (plantPill) plantPill.innerHTML = `<span class="pulse"></span>${escapeHtml(tenantShortName())} • ${escapeHtml(tenantPlantName())}`;
  const commandTitle = document.getElementById('tenantCommandTitle');
  if (commandTitle) commandTitle.textContent = `${tenantProductName()} üretim ve kalite dokümantasyon merkezi`;
  const commandSubtitle = document.getElementById('tenantCommandSubtitle');
  if (commandSubtitle) commandSubtitle.textContent = `${tenantProductName()} • kontrollü kaynaklar, proses presetleri ve yayın kapıları`;
  const printMark = document.getElementById('cpOrganizationMark');
  if (printMark) printMark.innerHTML = `${escapeHtml(tenantShortName())}<br><small>${escapeHtml(tenantProductName())}</small>`;
  const supplier = document.getElementById('supplierName'); const site = document.getElementById('supplierSite'); const code = document.getElementById('supplierCode');
  const legacySupplier = !supplier?.value || /TYANA OTOMOTİV/i.test(supplier.value) || options.forceProductFields;
  if (supplier && legacySupplier) supplier.value = tenantOrganizationName();
  if (site && (!site.value || /(?:Merkez|Niğde) Fabrikası/i.test(site.value) || options.forceProductFields)) site.value = tenantPlantName();
  if (code && (/^TYA-/i.test(code.value) || options.forceProductFields)) code.value = activeTenantProfile.supplierCode || '';
}

// Product-group backbone
const productBackbones = {
  steering: {
    label: 'Direksiyon Sistemleri', types: ['Rot Kolu Sabit', 'Rot Kolu Sabit Ayarlı', 'Rot Kolu Ayarlı', 'Rot Kolu Komple', 'Rot Başı', 'İç Rot', 'Direksiyon Mafsalı', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'storage', 'cutting', 'billet-heating', 'forging', 'shotblast', 'cnc', 'drilling', 'thread', 'deburring', 'grinding', 'furnace-heat', 'induction', 'ndt', 'washing', 'coating', 'painting', 'press-assembly', 'assembly', 'integrated-assembly', 'post-paint-assembly', 'torque', 'final', 'marking', 'packing']
  },
  suspension: {
    label: 'Süspansiyon Sistemleri', types: ['Askı Rotu', 'Salıncak Kolu', 'Denge Kolu', 'Rotil', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'storage', 'cutting', 'billet-heating', 'forging', 'shotblast', 'cnc', 'deburring', 'grinding', 'furnace-heat', 'induction', 'ndt', 'washing', 'coating', 'painting', 'press-assembly', 'assembly', 'integrated-assembly', 'torque', 'final', 'marking', 'packing']
  },
  chassis: {
    label: 'Şasi Bağlantı Elemanları', types: ['V Kolu', 'Bağlantı Braketi', 'Çeki Kolu', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'storage', 'cutting', 'tube-forming', 'stamping', 'forging', 'shotblast', 'cnc', 'deburring', 'welding', 'washing', 'coating', 'painting', 'press-assembly', 'assembly', 'integrated-assembly', 'final', 'marking', 'packing']
  },
  braking: {
    label: 'Fren Sistemleri', types: ['Mekanik bağlantı mamulü', 'Kaliper alt bileşeni', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'storage', 'casting', 'cnc', 'drilling', 'deburring', 'washing', 'coating', 'press-assembly', 'assembly', 'integrated-assembly', 'torque', 'leaktest', 'final', 'marking', 'packing']
  },
  powertrain: {
    label: 'Güç Aktarma', types: ['Mil / flanş mamulü', 'Muhafaza alt montajı', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'storage', 'cutting', 'billet-heating', 'forging', 'furnace-heat', 'cnc', 'drilling', 'thread', 'deburring', 'grinding', 'washing', 'press-assembly', 'assembly', 'integrated-assembly', 'final', 'marking', 'packing']
  },
  machined: {
    label: 'Talaşlı İmalat Mamulleri', types: ['Küresel Pim', 'Burç', 'Bağlantı Adaptörü', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'storage', 'cutting', 'cnc', 'milling', 'drilling', 'thread', 'deburring', 'grinding', 'washing', 'coating', 'final', 'marking', 'packing']
  },
  welded: {
    label: 'Kaynaklı Mamuller', types: ['Kaynaklı alt montaj', 'Şasi kaynaklı mamulü', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'storage', 'cutting', 'stamping', 'tube-forming', 'welding', 'adhesive', 'washing', 'coating', 'painting', 'press-assembly', 'assembly', 'integrated-assembly', 'final', 'marking', 'packing']
  },
  cast: {
    label: 'Döküm ve İşlenmiş Döküm Mamulleri', types: ['Döküm mamul', 'İşlenmiş döküm mamul', 'Döküm alt montaj', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'storage', 'casting', 'shotblast', 'ndt', 'furnace-heat', 'cnc', 'milling', 'drilling', 'deburring', 'washing', 'coating', 'painting', 'final', 'marking', 'packing']
  },
  formed: {
    label: 'Sac / Profil Şekillendirme Mamulleri', types: ['Pres parça', 'Bükümlü profil', 'Kaynaklı sac alt montaj', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'storage', 'cutting', 'stamping', 'tube-forming', 'welding', 'washing', 'coating', 'painting', 'press-assembly', 'assembly', 'integrated-assembly', 'final', 'marking', 'packing']
  },
  polymer: {
    label: 'Polimer ve Elastomer Mamulleri', types: ['Plastik mamul', 'Elastomer mamul', 'Çok malzemeli alt montaj', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'storage', 'rubber-molding', 'plastic-injection', 'adhesive', 'washing', 'press-assembly', 'assembly', 'integrated-assembly', 'final', 'marking', 'packing']
  },
  electrical: {
    label: 'Elektrik / Elektronik Alt Montajlar', types: ['Kablo / sensör alt montajı', 'Mekatronik mamul', 'Elektronik kontrollü modül', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'storage', 'adhesive', 'assembly', 'integrated-assembly', 'leaktest', 'final', 'marking', 'packing']
  },
  service: {
    label: 'Servis Kitleri ve Paketli Mamuller', types: ['Servis kiti', 'Yedek parça paketi', 'Çoklu ürün seti', 'Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'storage', 'final', 'marking', 'packing']
  },
  __custom__: {
    label: 'Kullanıcı Tanımlı Ürün Grubu', types: ['Kullanıcı Tanımlı Mamul'],
    processes: ['incoming', 'final', 'packing']
  }
};

const productGroup = document.getElementById('productGroup');
const productType = document.getElementById('productType');
const customProductTypeName = document.getElementById('customProductTypeName');
const partNumber = document.getElementById('partNumber');
const internalProductCode = document.getElementById('internalProductCode');
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
const pfmeaUiState = {
  routeKey: '', pickedRiskIds: new Set(), selectedRowIds: new Set(), expandedRowIds: new Set(),
  filter: 'all', query: '', riskQuery: '', sort: 'route', expandAll: false
};
const pfmeaRatingGuideState = { rowId: '', field: '', selectedScore: 0 };
let productEngineeringLibrary = null;
let pfmeaEngineeringLibrary = null;
let bomEngineeringLibrary = null;
let qualityDocumentLibrary = null;
let operationCodeLibrary = null;
const sourceInstructionUiState = { pickedIds: new Set(), query: '', profile: 'route' };
let bomCatalog = [];
let bomSelectedId = 'FINISHED_GOOD';
let bomViewMode = 'tree';
let bomExpandedIds = new Set();
let bomHistory = [];
let bomUndoStack = [];
let bomDraggedId = null;
let ppapRecords = {};
let generatedDocumentRecords = [];
let engineeringAnswers = {};
let engineeringCustomQuestions = [];
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
  productGroup.value = item.id; syncProductTypes(); productType.value = 'Kullanıcı Tanımlı Mamul'; syncCustomProductTypeField();
  return item.id;
}

function isCustomProductType(value = productType?.value) {
  return value === 'Kullanıcı Tanımlı Mamul';
}

function effectiveProductTypeLabel(source = null) {
  if (source) return String(source.productTypeLabel || (source.productType === 'Kullanıcı Tanımlı Mamul' ? source.customProductTypeName : source.productType) || 'Kullanıcı tanımlı mamul').trim();
  return String(isCustomProductType() ? customProductTypeName?.value : productType?.value || 'Kullanıcı tanımlı mamul').trim();
}

function syncCustomProductTypeField({ focus = false } = {}) {
  const field = document.getElementById('customProductTypeField');
  const visible = isCustomProductType();
  field?.classList.toggle('hidden', !visible);
  if (customProductTypeName) {
    customProductTypeName.required = visible;
    customProductTypeName.setAttribute('aria-required', String(visible));
    if (visible && focus) customProductTypeName.focus();
  }
  return visible;
}

loadCustomProductGroups();
renderCustomProductGroupOptions();

const componentTypeOptions = ['Hammadde', 'Satın alınan parça', 'İç üretim parçası', 'Yarı mamul', 'Alt montaj', 'Mamul', 'Sarf malzeme', 'Ambalaj malzemesi', 'Dış proses girdisi', 'Üretilen bileşen', 'Satın alınan bileşen', 'Bağlantı elemanı', 'Ambalaj'];
const makeBuyOptions = ['Üret', 'Satın al', 'Fason proses', 'Müşteri tedariki'];
const rawFormOptions = ['Boru', 'Çubuk', 'Dövme taslağı', 'Döküm', 'Sac', 'Profil', 'Kalıplanmış parça', 'Standart parça', 'Kimyasal / sarf', 'Özel'];
const heatTreatmentOptions = ['Uygulanmıyor', 'Teknik resme göre', 'Su verme + temperleme', 'İndüksiyon sertleştirme', 'Sementasyon', 'Nitrasyon', 'Gerilim giderme', 'Tedarikçi şartı'];
const coatingOptions = ['Uygulanmıyor', 'Mamul ile birlikte', 'Teknik resme göre', 'Çinko-Nikel', 'Çinko', 'Kataforez', 'Fosfat', 'Çinko lamel', 'Boya', 'Özel kaplama'];
const componentInputStateOptions = ['Hammadde', 'Boru / profil', 'Kesilmiş taslak', 'Dövme taslak', 'Döküm taslak', 'Preslenmiş / bükülmüş taslak', 'Kalıplanmış parça', 'Yarı mamul', 'İşlenmiş komponent', 'Satın alınan bitmiş parça', 'Alt montaj', 'Özel / kullanıcı tanımlı'];
const manufacturingMethodOptions = ['Satın alma / tedarikçi prosesi', 'Malzeme hazırlama ve kesme', 'Sıcak dövme', 'Soğuk dövme', 'Döküm', 'Boru / profil şekillendirme', 'Presleme / bükme', 'Talaşlı imalat', 'Delik / diş işleme', 'Kaynak / lehim', 'Isıl işlem', 'Kaplama / boya', 'Plastik enjeksiyon', 'Elastomer kalıplama', 'Yapıştırma / sızdırmazlık', 'Entegre tesis montajı', 'Kontrol / fonksiyon testi', 'Paketleme', 'Özel / kullanıcı tanımlı'];
const componentOutputStateOptions = ['Hazırlanmış taslak', 'Dövülmüş taslak', 'Dökülmüş taslak', 'Şekillendirilmiş parça', 'İşlenmiş parça', 'Isıl işlemli parça', 'Kaplanmış parça', 'Kaynaklı alt montaj', 'Fonksiyonel alt montaj', 'Nihai mamul', 'Satın alınan komponent', 'Özel / kullanıcı tanımlı'];

function componentRecord(overrides = {}) {
  const record = {
    id: `ITEM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, position: '10', parentId: 'FINISHED_GOOD',
    itemNo: '', name: 'Yeni bileşen', componentType: 'İç üretim parçası', quantity: 1, usageQuantity: 1, uom: 'adet', makeBuy: 'Üret',
    materialFamily: 'Kullanıcı seçimi gerekli', materialGrade: 'Kullanıcı seçimi gerekli', materialStandard: 'Teknik resme göre', rawMaterialForm: 'Özel',
    inputState: 'Hammadde', upstreamMethod: 'Satın alma / tedarikçi prosesi', primaryManufacturingMethod: 'Özel / kullanıcı tanımlı', outputState: 'Özel / kullanıcı tanımlı', manufacturingRouteNotes: '',
    drawingNo: 'Tanımlanacak', drawingRevision: 'A', itemRevision: 'A', revision: 'A', supplier: `${tenantShortName()} / onaylı tedarikçi seçilecek`, certificate: 'Teknik şartnameye göre',
    heatTreatment: 'Teknik resme göre', hardnessSpec: 'Teknik resme göre', coatingType: 'Teknik resme göre', coatingSpec: 'Teknik resme göre',
    traceability: 'Lot + ısı / döküm no', critical: false, specialCharacteristic: 'NONE', verificationStatus: 'Doğrulama bekliyor', status: 'Taslak',
    alternativePartNo: '', alternativeGroupId: '', alternativeSelected: true, effectiveFrom: '', effectiveTo: '', description: '', notes: '',
    reusable: false, catalogItemId: '', catalogRevision: '', reuseMode: 'embedded', producedAtProcessId: '', firstUseProcessId: '', mountedAtProcessId: '', inspectedAtProcessId: '',
    installationStage: 'Proses akışına göre', prerequisiteProcessId: '', nextProcessId: '', assemblySequence: '', operationLinkStatus: 'Henüz atanmadı', paintSensitive: false,
    changeReason: '', ...overrides
  };
  const normalized = globalThis.TyanaBom ? globalThis.TyanaBom.normalizeComponent(record) : record;
  normalized.operationLinkStatus = ({ verified: 'Doğrulandı', assigned: 'Atandı', pending: 'Henüz atanmadı' })[normalized.operationLinkStatus] || normalized.operationLinkStatus;
  normalized.installationStage = ({ 'post-paint': 'Boya sonrası montaj', 'pre-paint': 'Boya öncesi montaj', 'final-assembly': 'Final montaj', packaging: 'Paketleme aşaması', 'surface-treatment': 'Proses akışına göre' })[normalized.installationStage] || normalized.installationStage;
  normalized.specialCharacteristic = ({ 'fit-function': 'SC', safety: 'Emniyet' })[normalized.specialCharacteristic] || normalized.specialCharacteristic;
  return normalized;
}

// Yeni ürün kayıtları her zaman boş ana veriden başlar. Kurumsal tekrar kullanım,
// doğrulanmış kullanıcı ana şablonlarıyla yönetilir; gömülü demo mamul bulunmaz.
let components = [];

// Canonical engineering model: define every item master first, then reuse those
// masters in one or more independently revisioned, multi-level BOM definitions.
// `components` remains a generated compatibility projection for PFMEA, routing,
// control-plan and export modules that still consume the historical flat model.
let engineeringUniverse = null;
let engineeringBomStage = 'masters';
let selectedItemMasterId = '';
let selectedBomHeaderItemMasterId = '';
let selectedBomDefinitionId = '';
let selectedBomDefinitionIdsByHeader = {};
let engineeringUniverseProjectionSignature = '';
const openItemMasterTechnicalDetails = new Set();
let draggedEngineeringItemMasterId = '';

function hasEngineeringItemMasterDrag(event) {
  return Boolean(draggedEngineeringItemMasterId)
    || [...(event?.dataTransfer?.types || [])].includes('application/x-tyana-item-master')
    || [...(event?.dataTransfer?.types || [])].includes('text/plain');
}

function engineeringItemMasterDropId(event) {
  return event?.dataTransfer?.getData('application/x-tyana-item-master')
    || event?.dataTransfer?.getData('text/plain')
    || draggedEngineeringItemMasterId;
}

function clearEngineeringItemMasterDrag() {
  draggedEngineeringItemMasterId = '';
  document.getElementById('product')?.classList.remove('item-master-drag-active');
  document.querySelectorAll('.drop-target,.drag-target').forEach(target => target.classList.remove('drop-target', 'drag-target'));
}

const engineeringItemTypeLabels = Object.freeze({
  FINISHED_GOOD: 'Ana mamul', SUBASSEMBLY: 'Alt montaj', SEMI_FINISHED: 'Yarı mamul',
  MANUFACTURED_PART: 'İç üretim parçası', PURCHASED_PART: 'Satın alınan parça',
  ASSEMBLY_MATERIAL: 'Montaj malzemesi', EXTERNAL_PURCHASED: 'Dış tedarik ürünü (XD)',
  RAW_MATERIAL: 'Hammadde', FASTENER: 'Bağlantı elemanı', CONSUMABLE: 'Sarf malzeme', PACKAGING: 'Ambalaj'
});
const engineeringItemTypeLegacy = Object.freeze({
  FINISHED_GOOD: 'Mamul', SUBASSEMBLY: 'Alt montaj', SEMI_FINISHED: 'Yarı mamul',
  MANUFACTURED_PART: 'İç üretim parçası', PURCHASED_PART: 'Satın alınan parça',
  ASSEMBLY_MATERIAL: 'Montaj malzemesi', EXTERNAL_PURCHASED: 'Dış tedarik ürünü (XD)',
  RAW_MATERIAL: 'Hammadde', FASTENER: 'Bağlantı elemanı', CONSUMABLE: 'Sarf malzeme', PACKAGING: 'Ambalaj malzemesi'
});
const engineeringProcurementLabels = Object.freeze({ MAKE: 'Üret', BUY: 'Satın al', BOTH: 'Üret / satın al', PHANTOM: 'Hayalet montaj', CUSTOMER_SUPPLIED: 'Müşteri tedariki' });
const engineeringValidationLabels = Object.freeze({ DRAFT: 'Taslak', PENDING_REVIEW: 'İncelemede', APPROVED: 'Onaylı', REJECTED: 'Reddedildi', OBSOLETE: 'Kullanım dışı' });
const engineeringValidationLegacy = Object.freeze({ DRAFT: 'Doğrulama bekliyor', PENDING_REVIEW: 'Doğrulama bekliyor', APPROVED: 'Doğrulandı', REJECTED: 'Reddedildi', OBSOLETE: 'Uygulanamaz' });

function jsonClone(value) { return JSON.parse(JSON.stringify(value)); }

function engineeringProductionStateDefaults(record = {}) {
  const itemType = String(record.itemType || '').toUpperCase();
  const procurementType = String(record.procurementType || '').toUpperCase();
  if (itemType === 'FINISHED_GOOD') return {
    inputState: 'Alt montaj',
    upstreamMethod: 'Entegre tesis montajı',
    primaryManufacturingMethod: 'Entegre tesis montajı',
    outputState: 'Nihai mamul',
    manufacturingRouteNotes: 'Alt bileşen kabulü → entegre tesis montajı → final kontrol → nihai mamul'
  };
  if (itemType === 'SUBASSEMBLY') return {
    inputState: 'İşlenmiş komponent',
    upstreamMethod: 'Talaşlı imalat',
    primaryManufacturingMethod: 'Entegre tesis montajı',
    outputState: 'Fonksiyonel alt montaj',
    manufacturingRouteNotes: 'Komponent kabulü → montaj → fonksiyon kontrolü'
  };
  if (procurementType === 'BUY' || ['PURCHASED_PART', 'ASSEMBLY_MATERIAL', 'EXTERNAL_PURCHASED', 'RAW_MATERIAL', 'FASTENER', 'CONSUMABLE', 'PACKAGING'].includes(itemType)) return {
    inputState: itemType === 'RAW_MATERIAL' ? 'Hammadde' : 'Satın alınan bitmiş parça',
    upstreamMethod: 'Satın alma / tedarikçi prosesi',
    primaryManufacturingMethod: 'Satın alma / tedarikçi prosesi',
    outputState: 'Satın alınan komponent',
    manufacturingRouteNotes: 'Tedarikçi prosesi → giriş kalite kontrol → onaylı stok'
  };
  return {
    inputState: 'Hammadde',
    upstreamMethod: 'Malzeme hazırlama ve kesme',
    primaryManufacturingMethod: 'Talaşlı imalat',
    outputState: 'İşlenmiş parça',
    manufacturingRouteNotes: 'Hammadde kabulü → hazırlama → ana dönüşüm → son kontrol'
  };
}

function normalizeEngineeringItemMaster(record = {}, index = 0) {
  const normalized = globalThis.TyanaBom.normalizeItemMaster(record, index);
  const defaults = engineeringProductionStateDefaults(normalized);
  const routeAllowed = ['FINISHED_GOOD', 'SUBASSEMBLY', 'SEMI_FINISHED', 'MANUFACTURED_PART'].includes(normalized.itemType) && normalized.procurementType !== 'BUY';
  const routingSteps = routeAllowed && Array.isArray(normalized.routingSteps) ? normalized.routingSteps.map((step, stepIndex) => ({
    id: String(step?.id || `ROUTE-${normalized.id}-${stepIndex + 1}`),
    sequence: stepIndex + 1,
    opCode: String(step?.opCode || step?.operationCode || '').trim(),
    selectedMachines: [...new Set((Array.isArray(step?.selectedMachines) ? step.selectedMachines : []).map(value => String(value).trim()).filter(Boolean))],
    controlMarks: [...new Set((Array.isArray(step?.controlMarks) ? step.controlMarks : []).filter(mark => ['§', '<C>', '<M>'].includes(mark)))],
    source: String(step?.source || 'user-defined')
  })).filter(step => step.opCode) : [];
  return {
    ...normalized,
    inputState: String(normalized.inputState || '').trim() || defaults.inputState,
    upstreamMethod: String(normalized.upstreamMethod || '').trim() || defaults.upstreamMethod,
    primaryManufacturingMethod: String(normalized.primaryManufacturingMethod || '').trim() || defaults.primaryManufacturingMethod,
    outputState: String(normalized.outputState || '').trim() || defaults.outputState,
    manufacturingRouteNotes: String(normalized.manufacturingRouteNotes || '').trim() || defaults.manufacturingRouteNotes,
    routingSteps
  };
}

function normalizeEngineeringItemMasters(records = []) {
  return Array.isArray(records) ? records.map((record, index) => normalizeEngineeringItemMaster(record, index)) : [];
}

function componentProjectionSignature(records = components) {
  return JSON.stringify((records || []).map(item => ({
    id: item.id, parentId: item.parentId, position: item.position, itemMasterId: item.itemMasterId,
    itemNo: item.itemNo, oemNo: item.oemNo, name: item.name, componentType: item.componentType,
    quantity: item.quantity, usageQuantity: item.usageQuantity, uom: item.uom, makeBuy: item.makeBuy,
    itemRevision: item.itemRevision, drawingNo: item.drawingNo, drawingRevision: item.drawingRevision,
    materialFamily: item.materialFamily, materialGrade: item.materialGrade, materialStandard: item.materialStandard,
    rawMaterialForm: item.rawMaterialForm, certificate: item.certificate, heatTreatment: item.heatTreatment,
    hardnessSpec: item.hardnessSpec, coatingType: item.coatingType, coatingSpec: item.coatingSpec,
    inputState: item.inputState, upstreamMethod: item.upstreamMethod, primaryManufacturingMethod: item.primaryManufacturingMethod,
    outputState: item.outputState, manufacturingRouteNotes: item.manufacturingRouteNotes,
    traceability: item.traceability, verificationStatus: item.verificationStatus, status: item.status,
    effectiveFrom: item.effectiveFrom, effectiveTo: item.effectiveTo, alternativeGroupId: item.alternativeGroupId,
    alternativeSelected: item.alternativeSelected, operationCode: item.operationCode
  })));
}

function finishedGoodMasterSeed(id = engineeringUniverse?.rootItemMasterId || 'MASTER-FINISHED-GOOD') {
  return {
    id, itemMasterId: id,
    internalCode: internalProductCode?.value.trim() || 'ANA-MAMUL-KOD-BEKLİYOR',
    oemNo: partNumber?.value.trim() || '',
    name: partName?.value.trim() || 'Yeni Mamul', description: partName?.value.trim() || 'Yeni Mamul',
    itemType: 'FINISHED_GOOD', componentType: 'Mamul', revision: drawingRevision?.value.trim() || 'A',
    itemRevision: drawingRevision?.value.trim() || 'A', uom: 'adet', procurementType: 'MAKE', makeBuy: 'Üret',
    inputState: 'Alt montaj', upstreamMethod: 'Entegre tesis montajı', primaryManufacturingMethod: 'Entegre tesis montajı',
    outputState: 'Nihai mamul', manufacturingRouteNotes: 'Alt bileşen kabulü → entegre tesis montajı → final kontrol → nihai mamul',
    validationStatus: 'DRAFT', status: 'Taslak', drawingNo: document.getElementById('drawingNumber')?.value.trim() || '',
    drawingRevision: drawingRevision?.value.trim() || 'A', sourceOrganization: tenantOrganizationName()
  };
}

function rebuildEngineeringUniverseFromLegacy(options = {}) {
  if (!globalThis.TyanaBom) return null;
  const preserveUnused = options.preserveUnused !== false;
  const previous = engineeringUniverse;
  const migrated = globalThis.TyanaBom.migrateLegacyComponents(components, {
    rootItemMasterId: previous?.rootItemMasterId || 'MASTER-FINISHED-GOOD',
    finishedGood: finishedGoodMasterSeed(previous?.rootItemMasterId || 'MASTER-FINISHED-GOOD')
  });
  const previousById = new Map((previous?.itemMasters || []).map(master => [master.id, master]));
  migrated.itemMasters = migrated.itemMasters.map(master => normalizeEngineeringItemMaster({ ...previousById.get(master.id), ...master }));
  if (preserveUnused && previous) {
    const ids = new Set(migrated.itemMasters.map(master => master.id));
    previous.itemMasters.filter(master => !ids.has(master.id)).forEach(master => migrated.itemMasters.push(normalizeEngineeringItemMaster(master)));
  }
  engineeringUniverse = {
    schemaVersion: globalThis.TyanaBom.ENGINEERING_SCHEMA_VERSION,
    architecture: 'ITEM_MASTER_THEN_BOM', rootItemMasterId: migrated.rootItemMasterId,
    itemMasters: normalizeEngineeringItemMasters(migrated.itemMasters),
    bomDefinitions: globalThis.TyanaBom.normalizeBomDefinitions(migrated.bomDefinitions)
  };
  selectedItemMasterId = engineeringUniverse.itemMasters.some(master => master.id === selectedItemMasterId) ? selectedItemMasterId : engineeringUniverse.rootItemMasterId;
  selectedBomHeaderItemMasterId = engineeringUniverse.itemMasters.some(master => master.id === selectedBomHeaderItemMasterId) ? selectedBomHeaderItemMasterId : engineeringUniverse.rootItemMasterId;
  const knownDefinitions = new Set(engineeringUniverse.bomDefinitions.map(definition => definition.id));
  selectedBomDefinitionIdsByHeader = Object.fromEntries(Object.entries(selectedBomDefinitionIdsByHeader).filter(([, definitionId]) => knownDefinitions.has(definitionId)));
  engineeringUniverse.bomDefinitions.forEach(definition => {
    if (!selectedBomDefinitionIdsByHeader[definition.headerItemMasterId]) selectedBomDefinitionIdsByHeader[definition.headerItemMasterId] = definition.id;
  });
  const definitions = engineeringUniverse.bomDefinitions.filter(definition => definition.headerItemMasterId === selectedBomHeaderItemMasterId);
  selectedBomDefinitionId = selectedBomDefinitionIdsByHeader[selectedBomHeaderItemMasterId] || definitions[0]?.id || '';
  if (selectedBomDefinitionId) selectedBomDefinitionIdsByHeader[selectedBomHeaderItemMasterId] = selectedBomDefinitionId;
  engineeringUniverseProjectionSignature = componentProjectionSignature();
  return engineeringUniverse;
}

function resetEngineeringUniverseFromComponents() {
  engineeringUniverse = null; engineeringUniverseProjectionSignature = '';
  selectedItemMasterId = ''; selectedBomHeaderItemMasterId = ''; selectedBomDefinitionId = '';
  selectedBomDefinitionIdsByHeader = {};
  return rebuildEngineeringUniverseFromLegacy({ preserveUnused: false });
}

function ensureEngineeringUniverseFromLegacy() {
  const signature = componentProjectionSignature();
  if (!engineeringUniverse || signature !== engineeringUniverseProjectionSignature) rebuildEngineeringUniverseFromLegacy({ preserveUnused: Boolean(engineeringUniverse) });
  syncFinishedGoodMasterIdentity();
  return engineeringUniverse;
}

function syncFinishedGoodMasterIdentity() {
  if (!engineeringUniverse || !globalThis.TyanaBom) return;
  const index = engineeringUniverse.itemMasters.findIndex(master => master.id === engineeringUniverse.rootItemMasterId);
  const previous = index >= 0 ? engineeringUniverse.itemMasters[index] : {};
  const seed = finishedGoodMasterSeed(engineeringUniverse.rootItemMasterId);
  const root = normalizeEngineeringItemMaster({
    ...previous, ...seed,
    uom: previous.uom || seed.uom, procurementType: previous.procurementType || seed.procurementType,
    makeBuy: previous.makeBuy || seed.makeBuy, validationStatus: previous.validationStatus || 'DRAFT', status: previous.status || 'Taslak',
    inputState: previous.inputState || seed.inputState, upstreamMethod: previous.upstreamMethod || seed.upstreamMethod,
    primaryManufacturingMethod: previous.primaryManufacturingMethod || seed.primaryManufacturingMethod,
    outputState: previous.outputState || seed.outputState,
    manufacturingRouteNotes: previous.manufacturingRouteNotes || seed.manufacturingRouteNotes
  });
  if (index >= 0) engineeringUniverse.itemMasters[index] = root; else engineeringUniverse.itemMasters.unshift(root);
}

function projectEngineeringUniverseToComponents() {
  if (!engineeringUniverse || !globalThis.TyanaBom) return;
  const previousById = new Map(components.map(item => [item.id, item]));
  const mastersById = new Map(engineeringUniverse.itemMasters.map(master => [master.id, master]));
  const projected = globalThis.TyanaBom.toLegacyComponents(
    engineeringUniverse.rootItemMasterId,
    engineeringUniverse.itemMasters,
    engineeringUniverse.bomDefinitions,
    engineeringBomSelectionOptions({ asOfDate: '' })
  );
  components = projected.map(row => {
    const master = mastersById.get(row.itemMasterId) || {};
    const previous = previousById.get(row.id) || {};
    return componentRecord({
      ...previous, ...master, ...row,
      id: row.id, parentId: row.parentId, itemMasterId: row.itemMasterId, partMasterId: row.itemMasterId,
      itemNo: master.internalCode || row.itemNo, internalCode: master.internalCode || row.itemNo, oemNo: master.oemNo || row.oemNo,
      name: master.name || master.description || row.name,
      componentType: engineeringItemTypeLegacy[master.itemType] || master.componentType || row.componentType,
      quantity: row.quantity, usageQuantity: row.usageQuantity, uom: row.uom || master.uom || 'adet',
      makeBuy: engineeringProcurementLabels[master.procurementType] || master.makeBuy || row.makeBuy,
      itemRevision: row.itemRevision || master.revision, revision: row.revision || master.revision,
      drawingNo: master.drawingNo || '', drawingRevision: master.drawingRevision || master.revision || 'A',
      inputState: master.inputState || row.inputState, upstreamMethod: master.upstreamMethod || row.upstreamMethod,
      primaryManufacturingMethod: master.primaryManufacturingMethod || row.primaryManufacturingMethod,
      outputState: master.outputState || row.outputState,
      manufacturingRouteNotes: master.manufacturingRouteNotes || row.manufacturingRouteNotes,
      verificationStatus: engineeringValidationLegacy[master.validationStatus] || master.verificationStatus || 'Doğrulama bekliyor',
      status: engineeringValidationLabels[master.validationStatus] || master.status || 'Taslak'
    });
  });
  engineeringUniverseProjectionSignature = componentProjectionSignature();
}

function setSelectedBomDefinition(headerItemMasterId, definitionId) {
  selectedBomHeaderItemMasterId = headerItemMasterId || engineeringUniverse?.rootItemMasterId || '';
  selectedBomDefinitionId = definitionId || '';
  if (selectedBomHeaderItemMasterId) {
    if (selectedBomDefinitionId) selectedBomDefinitionIdsByHeader[selectedBomHeaderItemMasterId] = selectedBomDefinitionId;
    else delete selectedBomDefinitionIdsByHeader[selectedBomHeaderItemMasterId];
  }
}

function engineeringBomSelectionOptions(overrides = {}) {
  return { bomSelections: { ...selectedBomDefinitionIdsByHeader }, ...overrides };
}

function activeEngineeringBomRows(asOfDate = '') {
  if (!engineeringUniverse || !globalThis.TyanaBom) return [];
  return globalThis.TyanaBom.explodeBom(
    engineeringUniverse.rootItemMasterId,
    engineeringUniverse.itemMasters,
    engineeringUniverse.bomDefinitions,
    engineeringBomSelectionOptions({ asOfDate })
  );
}

function masterIsUsed(itemMasterId) {
  return engineeringUniverse?.bomDefinitions.some(definition => definition.lines.some(line => line.itemMasterId === itemMasterId)) || false;
}

function engineeringOptionMarkup(values, selected, labels = {}) {
  return values.map(value => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(labels[value] || value)}</option>`).join('');
}

function engineeringIssueSummary(issues = []) {
  const summary = globalThis.TyanaBom.summarizeValidation(issues);
  return { ...summary, text: `${summary.errors.length} kritik hata • ${summary.warnings.length} uyarı` };
}

function engineeringControlledStatusMarkup(current) {
  const editable = ['DRAFT', 'PENDING_REVIEW', 'REJECTED', 'OBSOLETE'];
  const values = current === 'APPROVED' ? ['APPROVED', ...editable] : editable;
  return engineeringOptionMarkup(values, current, engineeringValidationLabels);
}

function approveItemMaster(masterId) {
  const index = engineeringUniverse?.itemMasters.findIndex(master => master.id === masterId) ?? -1;
  if (index < 0) return false;
  const candidate = normalizeEngineeringItemMaster({ ...engineeringUniverse.itemMasters[index], validationStatus: 'PENDING_REVIEW', status: 'İncelemede' });
  const records = engineeringUniverse.itemMasters.map((master, itemIndex) => itemIndex === index ? candidate : master);
  const errors = globalThis.TyanaBom.validateItemMasters(records).filter(issue => issue.severity !== 'warning' && (issue.itemMasterId === masterId || issue.componentId === masterId || issue.conflictingItemMasterId === masterId));
  if (errors.length) { toast('Kart onaylanamadı', errors[0].message); return false; }
  engineeringUniverse.itemMasters[index] = normalizeEngineeringItemMaster({ ...candidate, validationStatus: 'APPROVED', status: 'Onaylı' });
  projectEngineeringUniverseToComponents(); renderComponents(); renderItemMasterUi(); markDraftDirty();
  toast('Malzeme kartı kontrollü onaylandı', `${candidate.internalCode} • Rev. ${candidate.revision}`); return true;
}

function approveEngineeringBomDefinition(definitionId) {
  const index = engineeringUniverse?.bomDefinitions.findIndex(definition => definition.id === definitionId) ?? -1;
  if (index < 0) return false;
  const candidate = globalThis.TyanaBom.normalizeBomDefinition({ ...engineeringUniverse.bomDefinitions[index], status: 'PENDING_REVIEW' });
  const definitions = engineeringUniverse.bomDefinitions.map((definition, definitionIndex) => definitionIndex === index ? candidate : definition);
  const itemIds = new Set([candidate.headerItemMasterId, ...candidate.lines.map(line => line.itemMasterId)]);
  const relevantMasters = engineeringUniverse.itemMasters.filter(master => itemIds.has(master.id));
  const itemIssues = globalThis.TyanaBom.validateItemMasters(relevantMasters);
  const unapprovedMaster = relevantMasters.find(master => master.validationStatus !== 'APPROVED');
  if (unapprovedMaster) { toast('BOM onaylanamadı', `${unapprovedMaster.internalCode || unapprovedMaster.name} kartı önce kontrollü onaylanmalıdır.`); return false; }
  const bomIssues = globalThis.TyanaBom.validateBomDefinitions(definitions, engineeringUniverse.itemMasters, engineeringBomSelectionOptions({ operationCodes: operationCodeEntries(), strictRevision: true }));
  const errors = [...itemIssues, ...bomIssues].filter(issue => issue.severity !== 'warning' && (itemIds.has(issue.itemMasterId) || issue.bomId === definitionId || issue.componentId === definitionId || candidate.lines.some(line => line.id === issue.componentId)));
  if (errors.length) { toast('BOM onaylanamadı', errors[0].message); return false; }
  engineeringUniverse.bomDefinitions[index] = globalThis.TyanaBom.normalizeBomDefinition({ ...candidate, status: 'APPROVED' });
  projectEngineeringUniverseToComponents(); renderComponents(); renderEngineeringBomStructure(); markDraftDirty();
  toast('BOM kontrollü onaylandı', `${candidate.bomNo} • Rev. ${candidate.revision} • Alt. ${candidate.alternative}`); return true;
}

function setEngineeringBomStage(stage) {
  engineeringBomStage = stage === 'structure' ? 'structure' : 'masters';
  document.querySelectorAll('[data-engineering-bom-pane]').forEach(pane => {
    const active = pane.dataset.engineeringBomPane === engineeringBomStage;
    pane.classList.toggle('hidden', !active); pane.classList.toggle('active', active);
  });
  document.querySelectorAll('.sap-bom-stage-tabs [data-engineering-bom-stage]').forEach(button => {
    const active = button.dataset.engineeringBomStage === engineeringBomStage;
    button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active));
  });
  if (engineeringBomStage === 'structure') renderEngineeringBomStructure();
}

function itemMasterHasWorkPlan(master = {}) {
  return ['FINISHED_GOOD', 'SUBASSEMBLY', 'SEMI_FINISHED', 'MANUFACTURED_PART'].includes(master.itemType) && master.procurementType !== 'BUY';
}

function workPlanCapabilityLabel(master = {}) {
  return itemMasterHasWorkPlan(master) ? 'İş planı var' : master.itemType === 'EXTERNAL_PURCHASED' ? 'XD • dış tedarik' : 'İş planı yok';
}

function engineeringItemBadge(master = {}) {
  return master.itemType === 'EXTERNAL_PURCHASED' ? '<mark class="external-item-badge" title="Dış tedarik ürünü">XD</mark>' : '';
}

function renderItemMasterList() {
  const container = document.getElementById('itemMasterList'); if (!container || !engineeringUniverse) return;
  const query = (document.getElementById('itemMasterSearch')?.value || '').trim().toLocaleLowerCase('tr-TR');
  const type = document.getElementById('itemMasterTypeFilter')?.value || 'all';
  const masters = engineeringUniverse.itemMasters.filter(master => (type === 'all' || master.itemType === type) && (!query || `${master.internalCode} ${master.oemNo} ${master.name} ${master.description}`.toLocaleLowerCase('tr-TR').includes(query)));
  const itemTypeOrder = ['RAW_MATERIAL', 'ASSEMBLY_MATERIAL', 'FASTENER', 'CONSUMABLE', 'PACKAGING', 'EXTERNAL_PURCHASED', 'PURCHASED_PART', 'MANUFACTURED_PART', 'SEMI_FINISHED', 'SUBASSEMBLY', 'FINISHED_GOOD'];
  const groupedMarkup = itemTypeOrder.map(itemType => {
    const group = masters.filter(master => master.itemType === itemType); if (!group.length) return '';
    return `<section class="item-master-type-group"><header><span>${escapeHtml((engineeringItemTypeLabels[itemType] || itemType).slice(0, 2))}</span><b>${escapeHtml(engineeringItemTypeLabels[itemType] || itemType)}</b><mark>${group.length}</mark></header>${group.map(master => `<button type="button" class="item-master-row ${master.id === selectedItemMasterId ? 'selected' : ''}" data-item-master-select="${escapeHtml(master.id)}" draggable="true"><span><b>${escapeHtml(master.internalCode || 'KOD BEKLİYOR')}</b><small>OEM: ${escapeHtml(master.oemNo || '—')}</small></span><span>${engineeringItemBadge(master)}<b>${escapeHtml(master.name || master.description || 'Adsız kart')}</b><small>${escapeHtml(engineeringItemTypeLabels[master.itemType] || master.itemType)} • Rev. ${escapeHtml(master.revision)} • ${workPlanCapabilityLabel(master)} • ${(master.routingSteps || []).length} operasyon</small></span><mark class="${master.validationStatus === 'APPROVED' ? 'approved' : ''}">${escapeHtml(engineeringValidationLabels[master.validationStatus] || master.validationStatus)}</mark></button>`).join('')}</section>`;
  }).join('');
  container.innerHTML = masters.length ? groupedMarkup : '<p class="bom-definition-empty">Filtreye uygun malzeme kartı yok.</p>';
  container.querySelectorAll('[data-item-master-select]').forEach(button => button.addEventListener('click', () => { selectedItemMasterId = button.dataset.itemMasterSelect; renderItemMasterUi(); }));
  container.querySelectorAll('[data-item-master-select]').forEach(button => {
    button.addEventListener('dragstart', event => {
      draggedEngineeringItemMasterId = button.dataset.itemMasterSelect;
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/x-tyana-item-master', draggedEngineeringItemMasterId);
      event.dataTransfer.setData('text/plain', draggedEngineeringItemMasterId);
      document.getElementById('product')?.classList.add('item-master-drag-active');
    });
    button.addEventListener('dragend', () => {
      clearEngineeringItemMasterDrag();
    });
  });
}

function renderItemMasterEditor() {
  const container = document.getElementById('itemMasterEditor'); if (!container || !engineeringUniverse) return;
  const master = engineeringUniverse.itemMasters.find(item => item.id === selectedItemMasterId);
  if (!master) { container.innerHTML = '<div class="empty-bom"><span>MK</span><h3>Düzenlenecek kartı seçin</h3><p>Ana mamul veya alt bileşen kartını soldaki ana veri listesinden açın.</p></div>'; return; }
  const root = master.id === engineeringUniverse.rootItemMasterId;
  const codeLocked = root || (Boolean(master.internalCode) && (master.validationStatus !== 'DRAFT' || masterIsUsed(master.id)));
  container.innerHTML = `<article class="item-master-editor-card" data-item-master-editor-id="${escapeHtml(master.id)}">
    <header class="item-master-editor-head"><span>${escapeHtml(root ? 'FG' : 'MK')}</span><div><b>${escapeHtml(master.name || master.description || 'Yeni malzeme kartı')}</b><small>Kalıcı ID: ${escapeHtml(master.id)} • Ana veri kartı; BOM miktarı burada tutulmaz.</small></div><div class="item-master-actions"><button type="button" data-item-master-edit-action="copy">Kopyala</button><button type="button" data-item-master-edit-action="save">Kaydet</button><button type="button" data-item-master-edit-action="approve" ${master.validationStatus === 'APPROVED' ? 'disabled' : ''}>Doğrula / Onayla</button>${root ? '' : '<button type="button" class="danger" data-item-master-edit-action="delete">Sil</button>'}</div></header>
    <div class="item-master-form">
      <label>Kuruluş içi ürün / stok kodu *<input data-master-field="internalCode" value="${escapeHtml(master.internalCode)}" ${codeLocked ? 'disabled' : ''}><small>${codeLocked ? 'Kalıcı anahtar kilitli; değişiklik için kontrollü kopya açın.' : 'İlk kayıtta benzersiz kod girin.'}</small></label>
      <label>OEM / tedarikçi numarası<input data-master-field="oemNo" value="${escapeHtml(master.oemNo)}"><small>İkincil ticari referans; iç kodun yerine geçmez.</small></label>
      <label>Kart tipi *<select data-master-field="itemType" ${root ? 'disabled' : ''}>${engineeringOptionMarkup(Object.keys(engineeringItemTypeLabels), master.itemType, engineeringItemTypeLabels)}</select></label>
      <label class="span-2">Kart adı / kısa tanım *<input data-master-field="name" value="${escapeHtml(master.name)}"></label>
      <label>Revizyon *<input data-master-field="revision" value="${escapeHtml(master.revision)}" maxlength="12"></label>
      <label>Temel birim *<select data-master-field="uom">${engineeringOptionMarkup(['adet','kg','g','m','mm','l','ml','set'], master.uom)}</select></label>
      <label>Üret / satın al *<select data-master-field="procurementType">${engineeringOptionMarkup(Object.keys(engineeringProcurementLabels), master.procurementType, engineeringProcurementLabels)}</select></label>
      <label>Kart durumu *<select data-master-field="validationStatus" ${master.validationStatus === 'APPROVED' ? 'disabled' : ''}>${engineeringControlledStatusMarkup(master.validationStatus)}</select><small>Onay yalnız “Doğrula / Onayla” kalite kapısından verilir.</small></label>
      <details class="item-master-advanced span-2" ${openItemMasterTechnicalDetails.has(master.id) ? 'open' : ''}><summary><span>TEKNİK DETAYLAR</span><div><b>Resim, malzeme, ısıl işlem ve kaplama bilgileri</b><small>Açık/kapalı durum ve girdiğiniz değerler kart değişse bile korunur.</small></div><i>⌄</i></summary><div class="item-master-advanced-grid">
      <label>Teknik resim no<input data-master-field="drawingNo" value="${escapeHtml(master.drawingNo || '')}"></label>
      <label>Teknik resim revizyonu<input data-master-field="drawingRevision" value="${escapeHtml(master.drawingRevision || master.revision)}"></label>
      <label>Malzeme ailesi<input data-master-field="materialFamily" list="materialFamilyOptions" value="${escapeHtml(master.materialFamily || '')}"></label>
      <label>Malzeme kalite / sınıf<input data-master-field="materialGrade" list="materialGradeOptions" value="${escapeHtml(master.materialGrade || '')}"></label>
      <label>Malzeme standardı<input data-master-field="materialStandard" list="materialStandardOptions" value="${escapeHtml(master.materialStandard || '')}"></label>
      <label>Hammadde / giriş formu<input data-master-field="rawMaterialForm" value="${escapeHtml(master.rawMaterialForm || '')}"></label>
      <label>Prosese giriş durumu<select data-master-field="inputState">${engineeringOptionMarkup(componentInputStateOptions, master.inputState)}</select><small>Örn. dövme taslak, boru / profil veya alt montaj.</small></label>
      <label>Önceki / kaynak yöntem<select data-master-field="upstreamMethod">${engineeringOptionMarkup(manufacturingMethodOptions, master.upstreamMethod)}</select><small>Bu kartın girişini oluşturan tedarikçi veya iç proses.</small></label>
      <label>Ana üretim yöntemi<select data-master-field="primaryManufacturingMethod">${engineeringOptionMarkup(manufacturingMethodOptions, master.primaryManufacturingMethod)}</select><small>Kartı asıl dönüştüren üretim yöntemi.</small></label>
      <label>Proses çıkış durumu<select data-master-field="outputState">${engineeringOptionMarkup(componentOutputStateOptions, master.outputState)}</select><small>Bir sonraki operasyonun veya montajın teslim aldığı durum.</small></label>
      <label class="span-2">Üretim rota omurgası / ara adımlar<input data-master-field="manufacturingRouteNotes" value="${escapeHtml(master.manufacturingRouteNotes || '')}" placeholder="Dövme taslak kabulü → CNC işleme → yıkama → son kontrol"></label>
      <div class="manufacturing-state-example"><span>GİRDİ</span><b>${escapeHtml(master.inputState)}</b><i>→</i><span>ANA YÖNTEM</span><b>${escapeHtml(master.primaryManufacturingMethod)}</b><i>→</i><span>ÇIKTI</span><b>${escapeHtml(master.outputState)}</b></div>
      <label>Tedarikçi<input data-master-field="supplier" list="supplierOptions" value="${escapeHtml(master.supplier || '')}"></label>
      <label>Sertifika şartı<input data-master-field="certificate" list="certificateOptions" value="${escapeHtml(master.certificate || '')}"></label>
      <label>Isıl işlem<input data-master-field="heatTreatment" value="${escapeHtml(master.heatTreatment || '')}"></label>
      <label>Sertlik / mekanik şart<input data-master-field="hardnessSpec" value="${escapeHtml(master.hardnessSpec || '')}"></label>
      <label>Kaplama sistemi<input data-master-field="coatingType" value="${escapeHtml(master.coatingType || '')}"></label>
      <label>Kaplama şartı<input data-master-field="coatingSpec" value="${escapeHtml(master.coatingSpec || '')}"></label>
      <label>İzlenebilirlik<input data-master-field="traceability" list="traceabilityOptions" value="${escapeHtml(master.traceability || '')}"></label>
      <label class="span-2">Açıklama / teknik not<input data-master-field="description" value="${escapeHtml(master.description || '')}"></label>
      <label>Değişiklik gerekçesi<input data-master-field="changeReason" value="${escapeHtml(master.changeReason || '')}"></label>
      </div></details>
      <div class="item-master-work-plan-link span-2"><span>03</span><div><b>İş planı ayrı adımda hazırlanır</b><small>${(master.routingSteps || []).length} operasyon tanımlı • operasyon sırası ve makineler “İş Planları” sayfasında düzenlenir.</small></div><button type="button" data-open-item-work-plan="${escapeHtml(master.id)}">İş Planına Git →</button></div>
      <div class="item-master-lock-note">${root ? 'Ana mamul kimliği Ürün & Antet aşamasındaki kuruluş kodu, OEM no, ad ve teknik resim alanlarından yönetilir.' : 'Kart bir BOM satırında kullanıldıktan sonra kuruluş içi kod kilitlenir; kontrollü değişiklikler revizyonla yönetilir.'}</div>
    </div>
  </article>`;
  const technicalDetails = container.querySelector('.item-master-advanced');
  technicalDetails?.addEventListener('toggle', () => {
    if (technicalDetails.open) openItemMasterTechnicalDetails.add(master.id);
    else openItemMasterTechnicalDetails.delete(master.id);
  });
  container.querySelectorAll('[data-master-field]').forEach(field => field.addEventListener('change', () => updateItemMasterField(master.id, field)));
  container.querySelector('[data-item-master-edit-action="save"]')?.addEventListener('click', () => { renderItemMasterUi(); markDraftDirty(); toast('Malzeme kartı kaydedildi', `${master.internalCode || master.id} ana veri doğrulamasına alındı.`); });
  container.querySelector('[data-item-master-edit-action="approve"]')?.addEventListener('click', () => approveItemMaster(master.id));
  container.querySelector('[data-item-master-edit-action="copy"]')?.addEventListener('click', () => copyItemMaster(master.id));
  container.querySelector('[data-item-master-edit-action="delete"]')?.addEventListener('click', () => deleteItemMaster(master.id));
  container.querySelector('[data-open-item-work-plan]')?.addEventListener('click', () => {
    goToWizardStep(3);
    globalThis.TyanaProductDefinition?.selectWorkPlanMaster(master.id);
  });
}

function updateItemMasterField(masterId, field) {
  const index = engineeringUniverse.itemMasters.findIndex(master => master.id === masterId); if (index < 0) return;
  const previous = engineeringUniverse.itemMasters[index]; const key = field.dataset.masterField;
  if (key === 'validationStatus' && field.value === 'APPROVED') { field.value = previous.validationStatus; toast('Doğrudan onay engellendi', 'Kartı kontrollü “Doğrula / Onayla” kalite kapısından geçirin.'); return; }
  const next = normalizeEngineeringItemMaster({ ...previous, [key]: field.value, ...(key === 'itemType' ? { componentType: engineeringItemTypeLegacy[field.value] || field.value } : {}), ...(key === 'procurementType' ? { makeBuy: engineeringProcurementLabels[field.value] || field.value } : {}), ...(key === 'validationStatus' ? { status: engineeringValidationLabels[field.value] || field.value } : {}) });
  const changeIssues = globalThis.TyanaBom.validateItemMasterChange(previous, next, { allowInternalCodeChange: previous.validationStatus === 'DRAFT' && !masterIsUsed(masterId) });
  if (changeIssues.some(issue => issue.severity === 'error')) { field.value = previous[key] || ''; toast('Kart değişikliği reddedildi', changeIssues[0].message); return; }
  engineeringUniverse.itemMasters[index] = next;
  if (masterId === engineeringUniverse.rootItemMasterId) {
    if (key === 'oemNo') partNumber.value = next.oemNo;
    if (key === 'name') partName.value = next.name;
    if (key === 'revision') drawingRevision.value = next.revision;
    if (key === 'drawingNo') document.getElementById('drawingNumber').value = next.drawingNo;
    if (key === 'drawingRevision') drawingRevision.value = next.drawingRevision;
  }
  projectEngineeringUniverseToComponents(); markDraftDirty(); renderComponents(); updateSummary();
}

function createItemMaster(itemType = 'MANUFACTURED_PART') {
  ensureEngineeringUniverseFromLegacy();
  const requestedType = typeof itemType === 'string' ? itemType : 'MANUFACTURED_PART';
  const selectedType = Object.hasOwn(engineeringItemTypeLabels, requestedType) ? requestedType : 'MANUFACTURED_PART';
  const procurementType = ['PURCHASED_PART', 'ASSEMBLY_MATERIAL', 'EXTERNAL_PURCHASED', 'RAW_MATERIAL', 'FASTENER', 'CONSUMABLE', 'PACKAGING'].includes(selectedType) ? 'BUY' : 'MAKE';
  const typeLabel = engineeringItemTypeLabels[selectedType] || 'Malzeme / ürün';
  const master = normalizeEngineeringItemMaster({
    id: `MAT-${crypto.randomUUID().slice(0, 12).toUpperCase()}`, internalCode: '', oemNo: '', name: `Yeni ${typeLabel.toLocaleLowerCase('tr-TR')} kartı`,
    description: `Yeni ${typeLabel.toLocaleLowerCase('tr-TR')} kartı`, itemType: selectedType, componentType: engineeringItemTypeLegacy[selectedType] || selectedType, revision: 'A', uom: selectedType === 'RAW_MATERIAL' ? 'kg' : 'adet', procurementType, validationStatus: 'DRAFT', sourceOrganization: tenantOrganizationName()
  });
  engineeringUniverse.itemMasters.push(master); selectedItemMasterId = master.id; openItemMasterTechnicalDetails.add(master.id); setEngineeringBomStage('masters'); renderItemMasterUi(); markDraftDirty();
  document.querySelector('#itemMasterEditor [data-master-field="internalCode"]')?.focus();
  return master;
}

const bulkItemTypeAliases = Object.freeze({
  'ana mamul': 'FINISHED_GOOD', 'alt montaj': 'SUBASSEMBLY', 'yarı mamul': 'SEMI_FINISHED',
  'yari mamul': 'SEMI_FINISHED', 'iç üretim parçası': 'MANUFACTURED_PART',
  'ic uretim parcasi': 'MANUFACTURED_PART', 'satın alınan parça': 'PURCHASED_PART',
  'satin alinan parca': 'PURCHASED_PART', 'montaj malzemesi': 'ASSEMBLY_MATERIAL',
  'dış tedarik ürünü': 'EXTERNAL_PURCHASED', 'dis tedarik urunu': 'EXTERNAL_PURCHASED',
  'dış tedarik ürünü (xd)': 'EXTERNAL_PURCHASED', 'dis tedarik urunu (xd)': 'EXTERNAL_PURCHASED',
  'xd': 'EXTERNAL_PURCHASED', 'hammadde': 'RAW_MATERIAL',
  'bağlantı elemanı': 'FASTENER', 'baglanti elemani': 'FASTENER',
  'sarf': 'CONSUMABLE', 'ambalaj': 'PACKAGING'
});

function normalizeBulkItemType(value) {
  const raw = String(value || '').trim();
  if (Object.hasOwn(engineeringItemTypeLabels, raw)) return raw;
  const key = raw.toLocaleLowerCase('tr-TR');
  return bulkItemTypeAliases[key] || '';
}

function parseBulkItemMasters() {
  ensureEngineeringUniverseFromLegacy();
  const source = document.getElementById('bulkItemMasterInput')?.value || '';
  const existingCodes = new Set((engineeringUniverse?.itemMasters || []).map(master => String(master.internalCode || '').trim().toLocaleUpperCase('tr-TR')).filter(Boolean));
  const incomingCodes = new Set();
  const records = [];
  const errors = [];
  source.split(/\r?\n/).map(line => line.trim()).filter(Boolean).forEach((line, index) => {
    const fields = line.includes('\t') ? line.split('\t') : line.split(';');
    const [typeText, internalCodeText, nameText, oemNoText = '', uomText = 'adet', procurementText = ''] = fields.map(field => String(field || '').trim());
    const itemType = normalizeBulkItemType(typeText);
    const internalCode = internalCodeText.toLocaleUpperCase('tr-TR');
    const name = nameText;
    const procurementType = /sat|buy|tedarik/i.test(procurementText) || ['PURCHASED_PART', 'ASSEMBLY_MATERIAL', 'EXTERNAL_PURCHASED', 'RAW_MATERIAL', 'FASTENER', 'CONSUMABLE', 'PACKAGING'].includes(itemType) ? 'BUY' : 'MAKE';
    if (!itemType) errors.push(`Satır ${index + 1}: kart tipi tanınmadı.`);
    if (!internalCode || !/^[\p{L}\p{N}._/-]{1,80}$/u.test(internalCode)) errors.push(`Satır ${index + 1}: kuruluş kodu geçersiz.`);
    if (!name) errors.push(`Satır ${index + 1}: kart adı zorunlu.`);
    if (existingCodes.has(internalCode) || incomingCodes.has(internalCode)) errors.push(`Satır ${index + 1}: ${internalCode || 'boş kod'} zaten kullanılıyor.`);
    if (!['adet', 'kg', 'g', 'm', 'mm', 'l', 'ml', 'set'].includes(uomText || 'adet')) errors.push(`Satır ${index + 1}: birim geçersiz.`);
    incomingCodes.add(internalCode);
    records.push({ itemType, internalCode, name, oemNo: oemNoText, uom: uomText || 'adet', procurementType });
  });
  if (!records.length) errors.push('En az bir kart satırı girin.');
  return { records, errors };
}

function renderBulkItemValidation(result) {
  const container = document.getElementById('bulkItemMasterValidation'); if (!container) return;
  const neutral = !result.records.length && !result.errors.length;
  container.classList.toggle('error', result.errors.length > 0);
  container.classList.toggle('success', !neutral && result.errors.length === 0);
  container.querySelector('span').textContent = neutral ? 'i' : result.errors.length ? '!' : '✓';
  container.querySelector('p').textContent = neutral
    ? 'Satırlar henüz doğrulanmadı.'
    : result.errors.length
    ? `${result.errors.length} hata: ${result.errors.slice(0, 4).join(' • ')}`
    : `${result.records.length} kart satırı doğrulandı; oluşturulmaya hazır.`;
}

function applyBulkItemMasters() {
  const result = parseBulkItemMasters();
  renderBulkItemValidation(result);
  if (result.errors.length) return;
  const created = result.records.map(record => normalizeEngineeringItemMaster({
    id: `MAT-${crypto.randomUUID().slice(0, 12).toUpperCase()}`,
    internalCode: record.internalCode, oemNo: record.oemNo, name: record.name, description: record.name,
    itemType: record.itemType, componentType: engineeringItemTypeLegacy[record.itemType] || record.itemType,
    revision: 'A', uom: record.uom, procurementType: record.procurementType,
    validationStatus: 'DRAFT', sourceOrganization: tenantOrganizationName()
  }));
  engineeringUniverse.itemMasters.push(...created);
  selectedItemMasterId = created[0].id;
  document.getElementById('bulkItemMasterDialog')?.close();
  setEngineeringBomStage('masters'); renderItemMasterUi(); markDraftDirty(); updateSummary();
  toast('Toplu malzeme kartları oluşturuldu', `${created.length} kart ana veri siciline taslak olarak eklendi.`);
}

function copyItemMaster(masterId) {
  const source = engineeringUniverse.itemMasters.find(master => master.id === masterId); if (!source) return;
  const copy = normalizeEngineeringItemMaster({ ...source, id: `MAT-${crypto.randomUUID().slice(0, 12).toUpperCase()}`, itemMasterId: '', internalCode: '', internalStockCode: '', itemNo: '', oemNo: source.oemNo, name: `${source.name} — Kontrollü Kopya`, description: `${source.description || source.name} — Kontrollü Kopya`, revision: 'A', itemRevision: 'A', validationStatus: 'DRAFT', status: 'Taslak', changeReason: `Kart ${source.internalCode || source.id} üzerinden kontrollü kopyalandı` });
  engineeringUniverse.itemMasters.push(copy); selectedItemMasterId = copy.id; renderItemMasterUi(); markDraftDirty(); document.querySelector('#itemMasterEditor [data-master-field="internalCode"]')?.focus();
}

function deleteItemMaster(masterId) {
  if (masterId === engineeringUniverse.rootItemMasterId) return;
  if (masterIsUsed(masterId) || engineeringUniverse.bomDefinitions.some(definition => definition.headerItemMasterId === masterId)) { toast('Kart silinemedi', 'Kart bir ürün ağacında kullanılıyor veya kendi alt BOM tanımı var. Önce kullanım bağlantılarını kaldırın.'); return; }
  const master = engineeringUniverse.itemMasters.find(item => item.id === masterId); if (!master || !window.confirm(`${master.internalCode || master.name} kartı silinsin mi?`)) return;
  engineeringUniverse.itemMasters = engineeringUniverse.itemMasters.filter(item => item.id !== masterId); selectedItemMasterId = engineeringUniverse.rootItemMasterId; renderItemMasterUi(); markDraftDirty();
}

function renderItemMasterUi() {
  if (!engineeringUniverse) return;
  const issues = globalThis.TyanaBom.validateItemMasters(engineeringUniverse.itemMasters);
  const summary = engineeringIssueSummary(issues); const validation = document.getElementById('itemMasterValidation');
  if (validation) { validation.classList.toggle('has-errors', summary.errors.length > 0); validation.classList.toggle('has-warnings', !summary.errors.length && summary.warnings.length > 0); validation.querySelector('span').textContent = summary.errors.length ? '×' : summary.warnings.length ? '!' : '✓'; validation.querySelector('p').textContent = `${engineeringUniverse.itemMasters.length} kart • ${summary.text}${summary.errors[0] ? ` • ${summary.errors[0].message}` : ''}`; }
  const count = document.getElementById('itemMasterStageCount'); if (count) count.textContent = `${engineeringUniverse.itemMasters.length} kart`;
  renderItemMasterList(); renderItemMasterEditor();
}

function bomDefinitionsForHeader(headerItemMasterId = selectedBomHeaderItemMasterId) {
  return (engineeringUniverse?.bomDefinitions || []).filter(definition => definition.headerItemMasterId === headerItemMasterId);
}

function currentEngineeringBomDefinition() {
  return engineeringUniverse?.bomDefinitions.find(definition => definition.id === selectedBomDefinitionId) || null;
}

function createEngineeringBomDefinition(headerItemMasterId = selectedBomHeaderItemMasterId) {
  ensureEngineeringUniverseFromLegacy();
  const header = engineeringUniverse.itemMasters.find(master => master.id === headerItemMasterId) || engineeringUniverse.itemMasters.find(master => master.id === engineeringUniverse.rootItemMasterId);
  if (!header) { toast('BOM açılamadı', 'Önce üst malzeme / ürün kartını tanımlayın.'); return; }
  const existing = bomDefinitionsForHeader(header.id);
  const alternative = String(existing.length + 1).padStart(2, '0');
  const definition = globalThis.TyanaBom.normalizeBomDefinition({
    id: `BOM-${crypto.randomUUID().slice(0, 12).toUpperCase()}`, bomNo: `BOM-${header.internalCode || header.id}`,
    headerItemMasterId: header.id, revision: header.revision || 'A', alternative, status: 'DRAFT',
    baseQuantity: 1, uom: header.uom || 'adet', effectiveFrom: '', effectiveTo: '', lines: [], sourceOrganization: tenantOrganizationName()
  });
  engineeringUniverse.bomDefinitions.push(definition); setSelectedBomDefinition(header.id, definition.id);
  setEngineeringBomStage('structure'); projectEngineeringUniverseToComponents(); renderComponents(); markDraftDirty();
  toast('Yeni BOM tanımı açıldı', `${header.internalCode || header.name} • alternatif ${alternative}`);
  return definition;
}

function copyEngineeringBomRevision(definitionId) {
  const source = engineeringUniverse.bomDefinitions.find(definition => definition.id === definitionId); if (!source) return;
  const copy = globalThis.TyanaBom.normalizeBomDefinition({
    ...jsonClone(source), id: `BOM-${crypto.randomUUID().slice(0, 12).toUpperCase()}`,
    bomNo: source.bomNo, revision: nextRevision(source.revision), bomRevision: '', status: 'DRAFT',
    lines: source.lines.map(line => ({ ...line, id: `BOMLINE-${crypto.randomUUID().slice(0, 12).toUpperCase()}`, lineId: '', legacyComponentId: '' })),
    changeReason: `BOM Rev. ${source.revision} üzerinden yeni revizyon açıldı`
  });
  engineeringUniverse.bomDefinitions.push(copy); setSelectedBomDefinition(copy.headerItemMasterId, copy.id); projectEngineeringUniverseToComponents(); renderComponents(); markDraftDirty();
}

function deleteEngineeringBomDefinition(definitionId) {
  const definition = engineeringUniverse.bomDefinitions.find(item => item.id === definitionId); if (!definition || !window.confirm(`${definition.bomNo} Rev. ${definition.revision} BOM tanımı silinsin mi?`)) return;
  engineeringUniverse.bomDefinitions = engineeringUniverse.bomDefinitions.filter(item => item.id !== definitionId);
  setSelectedBomDefinition(definition.headerItemMasterId, bomDefinitionsForHeader(definition.headerItemMasterId)[0]?.id || '');
  projectEngineeringUniverseToComponents(); renderComponents(); markDraftDirty();
}

function addEngineeringBomLine(definitionId, itemMasterId, { render = true } = {}) {
  const definitionIndex = engineeringUniverse.bomDefinitions.findIndex(definition => definition.id === definitionId);
  const master = engineeringUniverse.itemMasters.find(item => item.id === itemMasterId);
  if (definitionIndex < 0 || !master) { toast('BOM satırı eklenemedi', 'Yalnız önce tanımlanmış bir malzeme kartı seçilebilir.'); return; }
  const definition = engineeringUniverse.bomDefinitions[definitionIndex];
  if (master.id === definition.headerItemMasterId) { toast('BOM satırı eklenemedi', 'Üst kart kendi BOM satırında kullanılamaz.'); return; }
  const line = globalThis.TyanaBom.normalizeBomLine({
    id: `BOMLINE-${crypto.randomUUID().slice(0, 12).toUpperCase()}`,
    position: String((definition.lines.reduce((max, row) => Math.max(max, Number(row.position) || 0), 0) || 0) + 10),
    itemMasterId: master.id, quantity: 1, usageQuantity: 1, uom: master.uom || 'adet', referencedRevision: master.revision,
    effectiveFrom: '', effectiveTo: '', alternativeGroupId: '', alternativeSelected: true, assemblyOperationCode: '', notes: ''
  });
  const candidate = globalThis.TyanaBom.normalizeBomDefinition({ ...definition, lines: [...definition.lines, line] });
  const issues = globalThis.TyanaBom.validateBomDefinitions(
    [...engineeringUniverse.bomDefinitions.slice(0, definitionIndex), candidate, ...engineeringUniverse.bomDefinitions.slice(definitionIndex + 1)],
    engineeringUniverse.itemMasters,
    { operationCodes: operationCodeEntries() }
  );
  const blocked = issues.find(issue => ['BOM_SELF_REFERENCE', 'MATERIAL_BOM_CYCLE'].includes(issue.code));
  if (blocked) { toast('BOM bağlantısı reddedildi', blocked.message); return; }
  engineeringUniverse.bomDefinitions[definitionIndex] = candidate;
  projectEngineeringUniverseToComponents(); renderComponents(); markDraftDirty();
  if (render) renderEngineeringBomStructure();
  return line;
}

function addItemMasterToHeaderBom(headerItemMasterId, childItemMasterId) {
  const header = engineeringUniverse?.itemMasters.find(master => master.id === headerItemMasterId);
  const child = engineeringUniverse?.itemMasters.find(master => master.id === childItemMasterId);
  if (!header || !child) { toast('Sürükle-bırak tamamlanamadı', 'Üst veya alt malzeme kartı bulunamadı.'); return; }
  const bomCapableTypes = new Set(['FINISHED_GOOD', 'SUBASSEMBLY', 'SEMI_FINISHED', 'MANUFACTURED_PART']);
  if (!bomCapableTypes.has(header.itemType)) {
    toast('Bu karta alt BOM açılamaz', `${header.internalCode || header.name} doğrudan kullanım kartıdır; mamul, yarı mamul veya iç üretim kartına bırakın.`);
    return;
  }
  let definition = bomDefinitionsForHeader(header.id)[0];
  if (!definition) definition = createEngineeringBomDefinition(header.id);
  if (!definition) return;
  setSelectedBomDefinition(header.id, definition.id);
  const line = addEngineeringBomLine(definition.id, child.id, { render: false });
  if (!line) return;
  renderEngineeringBomStructure();
  toast('Kart hedef BOM’a bırakıldı', `${child.internalCode || child.name} → ${header.internalCode || header.name}`);
}

function removeEngineeringBomLine(definitionId, lineId) {
  const index = engineeringUniverse.bomDefinitions.findIndex(definition => definition.id === definitionId); if (index < 0) return;
  const definition = engineeringUniverse.bomDefinitions[index];
  engineeringUniverse.bomDefinitions[index] = globalThis.TyanaBom.normalizeBomDefinition({ ...definition, lines: definition.lines.filter(line => line.id !== lineId) });
  projectEngineeringUniverseToComponents(); renderComponents(); markDraftDirty(); renderEngineeringBomStructure();
}

function openEngineeringSubBom(itemMasterId) {
  const master = engineeringUniverse.itemMasters.find(item => item.id === itemMasterId); if (!master) return;
  const definitions = bomDefinitionsForHeader(master.id);
  setSelectedBomDefinition(master.id, selectedBomDefinitionIdsByHeader[master.id] || definitions[0]?.id || '');
  if (!definitions.length) createEngineeringBomDefinition(master.id); else { setEngineeringBomStage('structure'); renderEngineeringBomStructure(); }
}

function updateEngineeringBomDefinitionField(definitionId, field) {
  const index = engineeringUniverse.bomDefinitions.findIndex(definition => definition.id === definitionId); if (index < 0) return;
  const definition = engineeringUniverse.bomDefinitions[index]; const key = field.dataset.bomDefinitionField;
  if (key === 'status' && field.value === 'APPROVED') { field.value = definition.status; toast('Doğrudan onay engellendi', 'BOM’u kontrollü “Doğrula / Onayla” kalite kapısından geçirin.'); return; }
  const value = key === 'baseQuantity' ? parseLocaleNumber(field.value) : field.value;
  engineeringUniverse.bomDefinitions[index] = globalThis.TyanaBom.normalizeBomDefinition({ ...definition, [key]: value });
  projectEngineeringUniverseToComponents(); renderComponents(); markDraftDirty();
}

function updateEngineeringBomLineField(definitionId, lineId, field) {
  const definitionIndex = engineeringUniverse.bomDefinitions.findIndex(definition => definition.id === definitionId); if (definitionIndex < 0) return;
  const definition = engineeringUniverse.bomDefinitions[definitionIndex]; const lineIndex = definition.lines.findIndex(line => line.id === lineId); if (lineIndex < 0) return;
  const key = field.dataset.bomLineField; const previous = definition.lines[lineIndex];
  let value = ['quantity', 'usageQuantity'].includes(key) ? parseLocaleNumber(field.value) : key === 'alternativeSelected' ? field.value === 'true' : field.value;
  const master = key === 'itemMasterId' ? engineeringUniverse.itemMasters.find(item => item.id === value) : null;
  const nextLine = globalThis.TyanaBom.normalizeBomLine({ ...previous, [key]: value, ...(master ? { referencedRevision: master.revision, uom: master.uom } : {}) });
  const candidate = globalThis.TyanaBom.normalizeBomDefinition({ ...definition, lines: definition.lines.map((line, index) => index === lineIndex ? nextLine : line) });
  const candidateDefinitions = engineeringUniverse.bomDefinitions.map((entry, index) => index === definitionIndex ? candidate : entry);
  const issues = globalThis.TyanaBom.validateBomDefinitions(candidateDefinitions, engineeringUniverse.itemMasters, { operationCodes: operationCodeEntries() });
  const blocking = issues.find(issue => ['BOM_SELF_REFERENCE', 'MATERIAL_BOM_CYCLE', 'UNKNOWN_BOM_LINE_MASTER', 'ALTERNATIVE_GROUP_NO_ACTIVE_CHOICE', 'ALTERNATIVE_GROUP_MULTIPLE_ACTIVE_CHOICES'].includes(issue.code));
  if (blocking) { field.value = previous[key] ?? ''; toast('BOM satırı değiştirilemedi', blocking.message); return; }
  engineeringUniverse.bomDefinitions[definitionIndex] = candidate;
  projectEngineeringUniverseToComponents(); renderComponents(); markDraftDirty();
}

function renderEngineeringBomTree() {
  const container = document.getElementById('engineeringBomTree'); if (!container || !engineeringUniverse) return;
  const asOfDate = document.getElementById('bomExplosionDate')?.value || '';
  const rows = activeEngineeringBomRows(asOfDate);
  const headerIds = new Set(engineeringUniverse.bomDefinitions.map(definition => definition.headerItemMasterId));
  const bomCapableTypes = new Set(['FINISHED_GOOD', 'SUBASSEMBLY', 'SEMI_FINISHED', 'MANUFACTURED_PART']);
  container.innerHTML = rows.length ? rows.map(row => `<button type="button" class="engineering-bom-node ${bomCapableTypes.has(row.itemType) ? 'accepts-drop' : ''}" style="--bom-depth:${Math.max(0, row.level - 1)}" data-engineering-tree-master="${escapeHtml(row.itemMasterId)}"><span>${escapeHtml((engineeringItemTypeLabels[row.itemType] || row.itemType || 'MK').split(/\s+/).map(word => word[0]).join('').slice(0, 2))}</span><div><b>${escapeHtml(row.position)} • ${escapeHtml(row.internalCode || 'KOD BEKLİYOR')} • ${escapeHtml(row.name)}</b><small>L${row.level} • ${formatValue(row.cumulativeQuantity)} ${escapeHtml(row.uom)} • Rev. ${escapeHtml(row.referencedRevision || '—')}${row.assemblyOperationCode ? ` • OP ${escapeHtml(row.assemblyOperationCode)}` : ''}</small></div><mark class="${headerIds.has(row.itemMasterId) ? 'sub-bom' : ''}">${headerIds.has(row.itemMasterId) ? 'ALT BOM' : bomCapableTypes.has(row.itemType) ? 'BIRAK → ALT BOM' : 'KART'}</mark></button>`).join('') : '<div class="bom-definition-empty"><b>Henüz kullanım satırı yok</b><p>Parça kütüphanesinden kartı sağdaki aktif BOM’a sürükleyin.</p></div>';
  container.querySelectorAll('[data-engineering-tree-master]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.engineeringTreeMaster;
      if (headerIds.has(id)) openEngineeringSubBom(id); else { selectedItemMasterId = id; setEngineeringBomStage('masters'); renderItemMasterUi(); }
    });
    button.addEventListener('dragover', event => {
      if (!button.classList.contains('accepts-drop') || !hasEngineeringItemMasterDrag(event)) return;
      event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; button.classList.add('drop-target');
    });
    button.addEventListener('dragleave', () => button.classList.remove('drop-target'));
    button.addEventListener('drop', event => {
      event.preventDefault(); button.classList.remove('drop-target');
      const childId = engineeringItemMasterDropId(event);
      addItemMasterToHeaderBom(button.dataset.engineeringTreeMaster, childId);
      clearEngineeringItemMasterDrag();
    });
  });
  const root = engineeringUniverse.itemMasters.find(master => master.id === engineeringUniverse.rootItemMasterId) || {};
  const rootName = document.getElementById('bomRootName'); if (rootName) rootName.textContent = root.name || 'Ana mamul';
  const rootCode = document.getElementById('bomRootCode'); if (rootCode) rootCode.textContent = root.internalCode || 'Kuruluş kodu bekleniyor';
  const rootOem = document.getElementById('bomRootOem'); if (rootOem) rootOem.textContent = `OEM: ${root.oemNo || '—'}`;
  const treeCount = document.getElementById('bomTreeCount'); if (treeCount) treeCount.textContent = `${rows.length} kullanım`;
  const rootDrop = document.querySelector('.engineering-bom-root');
  if (rootDrop && !rootDrop.dataset.bomDropBound) {
    rootDrop.dataset.bomDropBound = 'true';
    rootDrop.addEventListener('dragover', event => {
      if (!hasEngineeringItemMasterDrag(event)) return;
      event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; rootDrop.classList.add('drop-target');
    });
    rootDrop.addEventListener('dragleave', () => rootDrop.classList.remove('drop-target'));
    rootDrop.addEventListener('drop', event => {
      event.preventDefault(); rootDrop.classList.remove('drop-target');
      const childId = engineeringItemMasterDropId(event);
      addItemMasterToHeaderBom(engineeringUniverse.rootItemMasterId, childId);
      clearEngineeringItemMasterDrag();
    });
  }
}

function renderEngineeringBomDragLibrary() {
  const container = document.getElementById('bomDragMasterLibrary'); if (!container || !engineeringUniverse) return;
  const query = (document.getElementById('bomDragMasterSearch')?.value || '').trim().toLocaleLowerCase('tr-TR');
  const masters = engineeringUniverse.itemMasters.filter(master => master.id !== selectedBomHeaderItemMasterId && master.validationStatus !== 'OBSOLETE' && (!query || `${master.internalCode} ${master.oemNo} ${master.name}`.toLocaleLowerCase('tr-TR').includes(query)));
  container.innerHTML = masters.length ? masters.map(master => `<label class="bom-drag-choice">
    <input type="checkbox" data-bom-master-select value="${escapeHtml(master.id)}" aria-label="${escapeHtml(master.internalCode || master.name)} kartını seç">
    <button type="button" draggable="true" data-bom-drag-master="${escapeHtml(master.id)}"><span>${escapeHtml((engineeringItemTypeLabels[master.itemType] || 'MK').slice(0, 2))}</span><div><b>${escapeHtml(master.internalCode || 'KOD BEKLİYOR')} • ${escapeHtml(master.name)}</b><small>${escapeHtml(engineeringItemTypeLabels[master.itemType] || master.itemType)} • ${(master.routingSteps || []).length} operasyon</small></div></button>
    <button type="button" class="bom-quick-add" data-bom-quick-add="${escapeHtml(master.id)}" title="Doğrudan seçili BOM'a ekle" aria-label="${escapeHtml(master.name)} kartını BOM'a ekle">＋</button>
  </label>`).join('') : '<p>Aramaya uygun kart yok.</p>';
  container.querySelectorAll('[data-bom-drag-master]').forEach(button => {
    button.addEventListener('dragstart', event => {
      draggedEngineeringItemMasterId = button.dataset.bomDragMaster;
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/x-tyana-item-master', draggedEngineeringItemMasterId);
      event.dataTransfer.setData('text/plain', draggedEngineeringItemMasterId);
      document.getElementById('product')?.classList.add('item-master-drag-active');
    });
    button.addEventListener('dragend', () => {
      clearEngineeringItemMasterDrag();
    });
    button.addEventListener('click', () => {
      const checkbox = button.closest('.bom-drag-choice')?.querySelector('[data-bom-master-select]');
      if (!checkbox) return;
      checkbox.checked = !checkbox.checked;
      updateEngineeringBomBulkAction();
    });
    button.addEventListener('dblclick', () => addEngineeringBomLine(selectedBomDefinitionId, button.dataset.bomDragMaster));
  });
  container.querySelectorAll('[data-bom-quick-add]').forEach(button => button.addEventListener('click', () => addEngineeringBomLine(selectedBomDefinitionId, button.dataset.bomQuickAdd)));
  container.querySelectorAll('[data-bom-master-select]').forEach(checkbox => checkbox.addEventListener('change', updateEngineeringBomBulkAction));
  updateEngineeringBomBulkAction();
}

function updateEngineeringBomBulkAction() {
  const selectedCount = document.querySelectorAll('#bomDragMasterLibrary [data-bom-master-select]:checked').length;
  const button = document.querySelector('[data-action="add-selected-bom-masters"]');
  const count = document.getElementById('bomBulkSelectionCount');
  if (button) button.disabled = selectedCount === 0 || !selectedBomDefinitionId;
  if (count) count.textContent = selectedCount ? `${selectedCount} kart seçili` : selectedBomDefinitionId ? 'Kartları işaretleyin' : 'Önce BOM açın';
}

function addSelectedEngineeringBomLines() {
  const selectedMasterIds = [...document.querySelectorAll('#bomDragMasterLibrary [data-bom-master-select]:checked')].map(input => input.value);
  if (!selectedBomDefinitionId) {
    toast('Aktif BOM seçilmedi', 'Önce incelenecek üst kart için bir BOM tanımı açın.');
    return;
  }
  if (!selectedMasterIds.length) {
    toast('Kart seçimi gerekli', 'Parça kütüphanesinden bir veya daha fazla kartı işaretleyin.');
    return;
  }
  selectedMasterIds.forEach(itemMasterId => addEngineeringBomLine(selectedBomDefinitionId, itemMasterId, { render: false }));
  renderEngineeringBomStructure();
  toast('BOM toplu güncellendi', `${selectedMasterIds.length} malzeme kartı seçili ürün ağacına eklendi.`);
}

function bindEngineeringBomDropZone() {
  const zone = document.getElementById('bomDefinitionDropZone');
  if (!zone || zone.dataset.bomDropBound) return;
  zone.dataset.bomDropBound = 'true';
  zone.addEventListener('dragover', event => {
    if (!hasEngineeringItemMasterDrag(event)) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; zone.classList.add('drop-target');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drop-target'));
  zone.addEventListener('drop', event => {
    event.preventDefault(); zone.classList.remove('drop-target');
    const childId = engineeringItemMasterDropId(event);
    if (!selectedBomDefinitionId) {
      toast('Önce BOM açın', 'Seçili üst kart için “Bu Kart İçin BOM Aç” düğmesini kullanın.');
      clearEngineeringItemMasterDrag(); return;
    }
    const line = addEngineeringBomLine(selectedBomDefinitionId, childId);
    if (line) toast('Kart BOM’a eklendi', 'Miktar, revizyon ve montaj operasyonu kullanım satırından düzenlenebilir.');
    clearEngineeringItemMasterDrag();
  });
  zone.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    document.getElementById('bomDragMasterSearch')?.focus();
    toast('Parça kütüphanesi aktif', 'Kartı arayın; + ile doğrudan ekleyin veya birden fazla kartı işaretleyip “Seçerek Ekle”yi kullanın.');
  });
}

function renderEngineeringBomDefinitionEditor() {
  const container = document.getElementById('bomDefinitionEditor'); if (!container || !engineeringUniverse) return;
  const definition = currentEngineeringBomDefinition();
  const header = engineeringUniverse.itemMasters.find(master => master.id === selectedBomHeaderItemMasterId);
  if (!definition) { container.innerHTML = `<div class="empty-bom bom-definition-empty"><span>BOM</span><h3>${escapeHtml(header?.internalCode || 'Seçili üst kart')} için BOM tanımı yok</h3><p>Yalnız tanımlı malzeme kartlarını kullanmaya başlamak için “Bu Kart İçin BOM Aç” düğmesini kullanın.</p></div>`; return; }
  const candidateMasters = engineeringUniverse.itemMasters.filter(master => master.id !== definition.headerItemMasterId && master.validationStatus !== 'OBSOLETE');
  container.innerHTML = `<article class="bom-definition-card" data-bom-definition-id="${escapeHtml(definition.id)}">
    <header class="bom-definition-head"><div><b>${escapeHtml(definition.bomNo)} • ${escapeHtml(header?.internalCode || header?.name || '')}</b><small>Kalıcı BOM ID: ${escapeHtml(definition.id)} • Rev. ${escapeHtml(definition.revision)} • alternatif ${escapeHtml(definition.alternative)}</small></div><div class="item-master-actions"><button type="button" data-bom-definition-action="copy">Yeni Revizyon</button><button type="button" data-bom-definition-action="approve" ${definition.status === 'APPROVED' ? 'disabled' : ''}>Doğrula / Onayla</button><button type="button" class="danger" data-bom-definition-action="delete">BOM'u Sil</button></div></header>
    <div class="bom-definition-form">
      <label>BOM numarası<input data-bom-definition-field="bomNo" value="${escapeHtml(definition.bomNo)}"></label>
      <label>BOM revizyonu<input data-bom-definition-field="revision" value="${escapeHtml(definition.revision)}"></label>
      <label>Alternatif<select data-bom-definition-field="alternative">${engineeringOptionMarkup(['01','02','03','04','05'], definition.alternative)}</select></label>
      <label>Durum<select data-bom-definition-field="status" ${definition.status === 'APPROVED' ? 'disabled' : ''}>${engineeringControlledStatusMarkup(definition.status)}</select><small>Onay kalite kapısıyla verilir.</small></label>
      <label>Temel miktar<input data-bom-definition-field="baseQuantity" inputmode="decimal" value="${escapeHtml(formatValue(definition.baseQuantity))}"></label>
      <label>Birim<select data-bom-definition-field="uom">${engineeringOptionMarkup(['adet','kg','g','m','mm','l','ml','set'], definition.uom)}</select></label>
      <label>Geçerlilik başlangıcı<input data-bom-definition-field="effectiveFrom" type="date" value="${escapeHtml(definition.effectiveFrom)}"></label>
      <label>Geçerlilik bitişi<input data-bom-definition-field="effectiveTo" type="date" value="${escapeHtml(definition.effectiveTo)}"></label>
    </div>
    <div class="bom-line-picker"><label>Tanımlı karttan yeni kullanım satırı<select data-bom-line-master-picker><option value="">Malzeme / ürün kartı seçin…</option>${candidateMasters.map(master => `<option value="${escapeHtml(master.id)}">${escapeHtml(master.internalCode || 'KOD BEKLİYOR')} • ${escapeHtml(master.name)} • ${escapeHtml(engineeringItemTypeLabels[master.itemType] || master.itemType)}</option>`).join('')}</select></label><button type="button" class="primary-button" data-bom-line-add>＋ BOM Satırı Ekle</button></div>
    <div class="bom-line-list">${definition.lines.length ? definition.lines.map(line => {
      const master = engineeringUniverse.itemMasters.find(item => item.id === line.itemMasterId) || {};
      const hasSubBom = engineeringUniverse.bomDefinitions.some(item => item.headerItemMasterId === line.itemMasterId);
      const occurrenceIds = components.filter(component => component.legacyBomLineId === line.id).map(component => component.id);
      const linkedRoute = occurrenceIds.length ? selectedProcessEntries().find(entry => String(entry.detail.operationCode || '') === String(line.assemblyOperationCode || '') && occurrenceIds.every(id => entry.detail.inputComponentIds.includes(id))) : null;
      return `<article class="bom-line-card" data-bom-line-id="${escapeHtml(line.id)}"><header class="bom-line-head"><span>${escapeHtml(line.position)}</span><div><b>${escapeHtml(master.internalCode || 'KART SEÇİLMEDİ')} • ${escapeHtml(master.name || 'Tanımsız kart')}</b><small>OEM ${escapeHtml(master.oemNo || '—')} • Kart Rev. ${escapeHtml(master.revision || '—')} • ${escapeHtml(engineeringItemTypeLabels[master.itemType] || master.itemType || '—')}</small></div><mark>${hasSubBom ? 'ALT BOM BAĞLI' : 'DOĞRUDAN KULLANIM'}</mark><button type="button" data-bom-line-remove aria-label="Satırı kaldır">×</button></header><div class="bom-line-form">
        <label>Pozisyon<input data-bom-line-field="position" value="${escapeHtml(line.position)}"></label>
        <label class="line-master-field">Malzeme kartı<select data-bom-line-field="itemMasterId">${candidateMasters.map(candidate => `<option value="${escapeHtml(candidate.id)}" ${candidate.id === line.itemMasterId ? 'selected' : ''}>${escapeHtml(candidate.internalCode || 'KOD BEKLİYOR')} • ${escapeHtml(candidate.name)}</option>`).join('')}</select></label>
        <label>Miktar<input data-bom-line-field="quantity" inputmode="decimal" value="${escapeHtml(formatValue(line.quantity))}"></label>
        <label>Birim<select data-bom-line-field="uom">${engineeringOptionMarkup(['adet','kg','g','m','mm','l','ml','set'], line.uom)}</select></label>
        <label>Referans revizyon<input data-bom-line-field="referencedRevision" value="${escapeHtml(line.referencedRevision)}"></label>
        <label>Geçerlilik başlangıcı<input data-bom-line-field="effectiveFrom" type="date" value="${escapeHtml(line.effectiveFrom)}"></label>
        <label>Geçerlilik bitişi<input data-bom-line-field="effectiveTo" type="date" value="${escapeHtml(line.effectiveTo)}"></label>
        <label>Alternatif grup<input data-bom-line-field="alternativeGroupId" value="${escapeHtml(line.alternativeGroupId)}" placeholder="Örn. RULMAN-A"></label>
        <label>Alternatif seçimi<select data-bom-line-field="alternativeSelected">${engineeringOptionMarkup(['true','false'], String(line.alternativeSelected), { true: 'Aktif seçim', false: 'Pasif alternatif' })}</select></label>
        <label class="line-master-field">Montaj operasyon kodu<input data-bom-line-field="assemblyOperationCode" list="operationCodeLibraryOptions" value="${escapeHtml(line.assemblyOperationCode || '')}" placeholder="380 TR/EN koddan seçin"></label>
        <label class="line-master-field">Rota bağlantısı<button type="button" class="secondary-button" data-bom-operation-route="${escapeHtml(line.id)}" ${line.assemblyOperationCode ? '' : 'disabled'}>${linkedRoute ? `✓ OP ${escapeHtml(linkedRoute.detail.operationNo)} Bağlı` : '＋ Operasyonu Rotaya Bağla'}</button><small>${line.assemblyOperationCode ? `${escapeHtml(line.assemblyOperationCode)} kodu ve bu BOM kullanımı rota girdisine bağlanır.` : 'Önce montaj operasyon kodunu seçin.'}</small></label>
        <label class="line-master-field">Kullanım / montaj notu<input data-bom-line-field="notes" value="${escapeHtml(line.notes || '')}"></label>
        <label>${hasSubBom ? 'Alt BOM' : 'Alt montaj'}<button type="button" class="secondary-button" data-open-engineering-sub-bom="${escapeHtml(line.itemMasterId)}">${hasSubBom ? 'Alt BOM’u Aç' : 'Bu Kart İçin Alt BOM Aç'}</button></label>
      </div></article>`;
    }).join('') : '<div class="bom-definition-empty"><b>BOM satırı yok</b><p>Yukarıdaki seçiciden daha önce tanımladığınız bir kartı ekleyin.</p></div>'}</div>
  </article>`;
  container.querySelectorAll('[data-bom-definition-field]').forEach(field => field.addEventListener('change', () => updateEngineeringBomDefinitionField(definition.id, field)));
  container.querySelectorAll('[data-bom-line-field]').forEach(field => field.addEventListener('change', () => updateEngineeringBomLineField(definition.id, field.closest('[data-bom-line-id]').dataset.bomLineId, field)));
  container.querySelector('[data-bom-line-add]')?.addEventListener('click', () => addEngineeringBomLine(definition.id, container.querySelector('[data-bom-line-master-picker]')?.value));
  container.querySelectorAll('[data-bom-line-remove]').forEach(button => button.addEventListener('click', () => removeEngineeringBomLine(definition.id, button.closest('[data-bom-line-id]').dataset.bomLineId)));
  const dropTarget = container.querySelector('.bom-definition-card');
  dropTarget?.addEventListener('dragover', event => { if (hasEngineeringItemMasterDrag(event)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; dropTarget.classList.add('drag-target'); } });
  dropTarget?.addEventListener('dragleave', () => dropTarget.classList.remove('drag-target'));
  dropTarget?.addEventListener('drop', event => { event.preventDefault(); dropTarget.classList.remove('drag-target'); const itemMasterId = engineeringItemMasterDropId(event); addEngineeringBomLine(definition.id, itemMasterId); clearEngineeringItemMasterDrag(); });
  container.querySelectorAll('[data-open-engineering-sub-bom]').forEach(button => button.addEventListener('click', () => openEngineeringSubBom(button.dataset.openEngineeringSubBom)));
  container.querySelectorAll('[data-bom-operation-route]').forEach(button => button.addEventListener('click', () => attachBomAssemblyOperationToRoute(definition.id, button.dataset.bomOperationRoute)));
  container.querySelector('[data-bom-definition-action="copy"]')?.addEventListener('click', () => copyEngineeringBomRevision(definition.id));
  container.querySelector('[data-bom-definition-action="approve"]')?.addEventListener('click', () => approveEngineeringBomDefinition(definition.id));
  container.querySelector('[data-bom-definition-action="delete"]')?.addEventListener('click', () => deleteEngineeringBomDefinition(definition.id));
}

function renderEngineeringBomStructure() {
  if (!engineeringUniverse) return;
  const headerSelect = document.getElementById('bomHeaderMasterSelect');
  if (headerSelect) {
    headerSelect.innerHTML = engineeringUniverse.itemMasters.map(master => `<option value="${escapeHtml(master.id)}" ${master.id === selectedBomHeaderItemMasterId ? 'selected' : ''}>${escapeHtml(master.internalCode || 'KOD BEKLİYOR')} • ${escapeHtml(master.name)} • ${escapeHtml(engineeringItemTypeLabels[master.itemType] || master.itemType)}</option>`).join('');
  }
  const definitions = bomDefinitionsForHeader();
  if (!definitions.some(definition => definition.id === selectedBomDefinitionId)) setSelectedBomDefinition(selectedBomHeaderItemMasterId, selectedBomDefinitionIdsByHeader[selectedBomHeaderItemMasterId] || definitions[0]?.id || '');
  const definitionSelect = document.getElementById('bomDefinitionSelect');
  if (definitionSelect) definitionSelect.innerHTML = definitions.length ? definitions.map(definition => `<option value="${escapeHtml(definition.id)}" ${definition.id === selectedBomDefinitionId ? 'selected' : ''}>${escapeHtml(definition.bomNo)} • Rev. ${escapeHtml(definition.revision)} • Alt. ${escapeHtml(definition.alternative)} • ${escapeHtml(engineeringValidationLabels[definition.status] || definition.status)}</option>`).join('') : '<option value="">BOM tanımı yok</option>';
  const issues = globalThis.TyanaBom.validateBomDefinitions(engineeringUniverse.bomDefinitions, engineeringUniverse.itemMasters, engineeringBomSelectionOptions({ operationCodes: operationCodeEntries(), asOfDate: document.getElementById('bomExplosionDate')?.value || '' }));
  const summary = engineeringIssueSummary(issues); const validation = document.getElementById('engineeringBomValidation');
  if (validation) { validation.classList.toggle('has-errors', summary.errors.length > 0); validation.classList.toggle('has-warnings', !summary.errors.length && summary.warnings.length > 0); validation.querySelector('span').textContent = summary.errors.length ? '×' : summary.warnings.length ? '!' : '✓'; validation.querySelector('p').textContent = `${engineeringUniverse.bomDefinitions.length} bağımsız BOM • ${summary.text}${summary.errors[0] ? ` • ${summary.errors[0].message}` : ''}`; }
  const count = document.getElementById('bomDefinitionStageCount'); if (count) count.textContent = `${engineeringUniverse.bomDefinitions.length} BOM`;
  renderEngineeringBomDragLibrary(); renderEngineeringBomTree(); renderEngineeringBomDefinitionEditor(); bindEngineeringBomDropZone();
}

function bindEngineeringBomControls() {
  document.querySelectorAll('[data-engineering-bom-stage]').forEach(button => {
    if (button.dataset.engineeringBound) return; button.dataset.engineeringBound = 'true';
    button.addEventListener('click', () => showView(button.dataset.engineeringBomStage === 'structure' ? 'bom' : 'product'));
  });
  document.querySelectorAll('[data-item-master-action="new"]').forEach(button => {
    if (button.dataset.engineeringBound) return; button.dataset.engineeringBound = 'true'; button.addEventListener('click', createItemMaster);
  });
  document.querySelectorAll('[data-item-quick-create]').forEach(button => {
    if (button.dataset.engineeringBound) return;
    button.dataset.engineeringBound = 'true';
    button.addEventListener('click', () => createItemMaster(button.dataset.itemQuickCreate));
  });
  const search = document.getElementById('itemMasterSearch'); if (search && !search.dataset.engineeringBound) { search.dataset.engineeringBound = 'true'; search.addEventListener('input', renderItemMasterList); }
  const typeFilter = document.getElementById('itemMasterTypeFilter'); if (typeFilter && !typeFilter.dataset.engineeringBound) { typeFilter.dataset.engineeringBound = 'true'; typeFilter.addEventListener('change', renderItemMasterList); }
  const header = document.getElementById('bomHeaderMasterSelect'); if (header && !header.dataset.engineeringBound) { header.dataset.engineeringBound = 'true'; header.addEventListener('change', () => { const definitions = bomDefinitionsForHeader(header.value); setSelectedBomDefinition(header.value, selectedBomDefinitionIdsByHeader[header.value] || definitions[0]?.id || ''); renderEngineeringBomStructure(); }); }
  const date = document.getElementById('bomExplosionDate'); if (date && !date.dataset.engineeringBound) { date.dataset.engineeringBound = 'true'; date.addEventListener('change', renderEngineeringBomStructure); }
  const dragSearch = document.getElementById('bomDragMasterSearch'); if (dragSearch && !dragSearch.dataset.engineeringBound) { dragSearch.dataset.engineeringBound = 'true'; dragSearch.addEventListener('input', renderEngineeringBomDragLibrary); }
  const bulkBomAdd = document.querySelector('[data-action="add-selected-bom-masters"]'); if (bulkBomAdd && !bulkBomAdd.dataset.engineeringBound) { bulkBomAdd.dataset.engineeringBound = 'true'; bulkBomAdd.addEventListener('click', addSelectedEngineeringBomLines); }
  const definition = document.getElementById('bomDefinitionSelect'); if (definition && !definition.dataset.engineeringBound) { definition.dataset.engineeringBound = 'true'; definition.addEventListener('change', () => { setSelectedBomDefinition(selectedBomHeaderItemMasterId, definition.value); projectEngineeringUniverseToComponents(); renderComponents(); renderEngineeringBomStructure(); markDraftDirty(); }); }
  document.querySelectorAll('[data-engineering-bom-action="create-definition"]').forEach(button => {
    if (button.dataset.engineeringBound) return; button.dataset.engineeringBound = 'true'; button.addEventListener('click', () => createEngineeringBomDefinition(selectedBomHeaderItemMasterId));
  });
  document.querySelectorAll('[data-action="bulk-item-masters"]').forEach(button => {
    if (button.dataset.engineeringBound) return;
    button.dataset.engineeringBound = 'true';
    button.addEventListener('click', () => {
      const dialog = document.getElementById('bulkItemMasterDialog');
      const input = document.getElementById('bulkItemMasterInput');
      renderBulkItemValidation({ records: [], errors: [] });
      if (input) input.value = '';
      dialog?.showModal();
      setTimeout(() => input?.focus(), 40);
    });
  });
  const bulkPreview = document.querySelector('[data-action="preview-bulk-item-masters"]'); if (bulkPreview && !bulkPreview.dataset.engineeringBound) { bulkPreview.dataset.engineeringBound = 'true'; bulkPreview.addEventListener('click', () => renderBulkItemValidation(parseBulkItemMasters())); }
  const bulkApply = document.querySelector('[data-action="apply-bulk-item-masters"]'); if (bulkApply && !bulkApply.dataset.engineeringBound) { bulkApply.dataset.engineeringBound = 'true'; bulkApply.addEventListener('click', applyBulkItemMasters); }
}

function renderEngineeringBomUi() {
  if (!document.getElementById('itemMasterStage') || !engineeringUniverse) return;
  bindEngineeringBomControls(); syncFinishedGoodMasterIdentity(); renderItemMasterUi(); renderEngineeringBomStructure(); setEngineeringBomStage(engineeringBomStage);
}

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
  syncCustomProductTypeField();
  document.getElementById('customProductGroupField')?.classList.toggle('hidden', productGroup.value !== '__custom__');
  updateSummary();
  if (productEngineeringLibrary) renderEngineeringQuestions();
}

function componentParentOptions(item) {
  const root = `<option value="FINISHED_GOOD" ${item.parentId === 'FINISHED_GOOD' ? 'selected' : ''}>Ana mamul: ${escapeHtml(partName.value || 'Yeni mamul')}</option>`;
  const blocked = new Set([item.id, ...(globalThis.TyanaBom?.descendants(components, item.id) || []).map(candidate => candidate.id)]);
  return root + components.filter(candidate => !blocked.has(candidate.id) && globalThis.TyanaBom?.isContainerType(candidate.componentType)).map(candidate => `<option value="${escapeHtml(candidate.id)}" ${item.parentId === candidate.id ? 'selected' : ''}>${escapeHtml(candidate.position)} • ${escapeHtml(candidate.name)}</option>`).join('');
}

function cloneBomState() {
  return { components: components.map(item => ({ ...item })), bomCatalog: JSON.parse(JSON.stringify(bomCatalog)), selectedId: bomSelectedId };
}

function checkpointBom(label, componentId = bomSelectedId) {
  bomUndoStack.push({ label, state: cloneBomState() });
  if (bomUndoStack.length > 30) bomUndoStack.shift();
  const button = document.querySelector('[data-action="undo-bom"]'); if (button) button.disabled = false;
  return componentId;
}

function logBomChange(action, componentId, field = '', previousValue = '', nextValue = '') {
  const component = components.find(item => item.id === componentId);
  bomHistory.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), actor: 'Eren', action, componentId, componentName: component?.name || componentId || 'Ana mamul', field, previousValue, nextValue });
  if (bomHistory.length > 200) bomHistory.length = 200;
  renderBomHistory();
}

function renderBomHistory() {
  const count = document.getElementById('bomHistoryCount'); if (count) count.textContent = bomHistory.length;
  const container = document.getElementById('bomHistoryRows'); if (!container) return;
  container.innerHTML = bomHistory.length ? bomHistory.slice(0, 50).map(item => `<div class="bom-history-row"><small>${escapeHtml(new Date(item.at).toLocaleString('tr-TR'))}<br>${escapeHtml(item.actor)}</small><span><b>${escapeHtml(item.componentName)}</b><br>${escapeHtml(item.action)}${item.field ? ` • ${escapeHtml(item.field)}` : ''}</span><small>${escapeHtml(String(item.previousValue ?? ''))}${item.field ? ' → ' : ''}${escapeHtml(String(item.nextValue ?? ''))}</small></div>`).join('') : '<p>Henüz BOM değişikliği kaydı yok.</p>';
}

function undoBomChange() {
  const entry = bomUndoStack.pop(); if (!entry) return;
  components = entry.state.components.map(item => componentRecord(item)); bomCatalog = entry.state.bomCatalog; bomSelectedId = entry.state.selectedId;
  logBomChange(`Geri alındı: ${entry.label}`, bomSelectedId); renderComponents(); markDraftDirty();
  const button = document.querySelector('[data-action="undo-bom"]'); if (button) button.disabled = bomUndoStack.length === 0;
}

function bomTypeCode(type) {
  return ({ 'Hammadde': 'HM', 'Satın alınan parça': 'SP', 'Satın alınan bileşen': 'SP', 'İç üretim parçası': 'İÜ', 'Üretilen bileşen': 'İÜ', 'Yarı mamul': 'YM', 'Alt montaj': 'AM', 'Mamul': 'MM', 'Sarf malzeme': 'SR', 'Ambalaj malzemesi': 'PK', 'Ambalaj': 'PK', 'Dış proses girdisi': 'DP', 'Bağlantı elemanı': 'BE' })[type] || 'BL';
}

function selectBomNode(id) {
  bomSelectedId = id === 'FINISHED_GOOD' || components.some(item => item.id === id) ? id : 'FINISHED_GOOD';
  if (bomSelectedId !== 'FINISHED_GOOD') bomExpandedIds.add(components.find(item => item.id === bomSelectedId)?.parentId || 'FINISHED_GOOD');
  renderComponents();
}

function renderBomBreadcrumb() {
  const container = document.getElementById('bomBreadcrumb'); if (!container) return;
  const ids = []; let current = components.find(item => item.id === bomSelectedId); const visited = new Set();
  while (current && !visited.has(current.id)) { visited.add(current.id); ids.unshift(current.id); current = components.find(item => item.id === current.parentId); }
  container.innerHTML = `<button type="button" data-bom-crumb="FINISHED_GOOD">${escapeHtml(partName.value || 'Ana mamul')}</button>` + ids.map(id => `<button type="button" data-bom-crumb="${escapeHtml(id)}">${escapeHtml(components.find(item => item.id === id)?.name || id)}</button>`).join('');
  container.querySelectorAll('[data-bom-crumb]').forEach(button => button.addEventListener('click', () => selectBomNode(button.dataset.bomCrumb)));
  const selection = document.getElementById('bomSelectionPath'); if (selection) selection.textContent = globalThis.TyanaBom?.path(components, bomSelectedId, partName.value || 'Ana mamul').join(' > ') || partName.value;
}

function renderBomNavigator() {
  const treeContainer = document.getElementById('bomTree'); const listContainer = document.getElementById('bomList'); if (!treeContainer || !listContainer) return;
  const query = (document.getElementById('bomSearch')?.value || '').trim().toLocaleLowerCase('tr-TR');
  const flat = globalThis.TyanaBom.flatten(components, partName.value || 'Ana mamul');
  const matching = new Set(flat.filter(row => !query || `${row.itemNo} ${row.name} ${row.path}`.toLocaleLowerCase('tr-TR').includes(query)).map(row => row.id));
  if (query) flat.filter(row => matching.has(row.id)).forEach(row => globalThis.TyanaBom.path(components, row.id).slice(1, -1).forEach(name => { const parent = components.find(item => item.name === name); if (parent) { matching.add(parent.id); bomExpandedIds.add(parent.id); } }));
  const renderNodes = nodes => nodes.map(node => {
    const expanded = bomExpandedIds.has(node.id) || Boolean(query); const visible = !query || matching.has(node.id); const leaf = !node.children.length;
    return `<div class="bom-tree-group ${visible ? '' : 'filtered-out'}"><div class="bom-tree-node ${leaf ? 'leaf' : ''} ${bomSelectedId === node.id ? 'selected' : ''}" draggable="true" data-bom-id="${escapeHtml(node.id)}" data-type="${escapeHtml(node.componentType)}"><button class="bom-tree-toggle" type="button" data-bom-toggle="${escapeHtml(node.id)}">${expanded ? '⌄' : '›'}</button><span class="bom-node-icon">${escapeHtml(bomTypeCode(node.componentType))}</span><span class="bom-node-copy"><b>${escapeHtml(node.position)} • ${escapeHtml(node.name)}</b><small>${escapeHtml(node.itemNo || 'Kod bekliyor')} • Rev. ${escapeHtml(node.itemRevision || node.revision || '—')}</small></span><mark class="bom-node-status ${['Doğrulandı', 'Teknik resimle doğrulandı'].includes(node.verificationStatus) ? 'verified' : ''}">${escapeHtml(node.operationLinkStatus || 'Bekliyor')}</mark></div>${!leaf && expanded ? renderNodes(node.children) : ''}</div>`;
  }).join('');
  treeContainer.innerHTML = components.length ? renderNodes(globalThis.TyanaBom.tree(components)) : '<div class="empty-bom"><p>Boş BOM. Ana mamulün altına ilk bileşeni ekleyin.</p></div>';
  listContainer.innerHTML = `<div class="bom-list-head"><span>SEVİYE</span><span>POZ.</span><span>PARÇA / BİLEŞEN</span><span>ÜST KALEM</span><span>DURUM</span></div>` + flat.filter(row => !query || matching.has(row.id)).map(row => `<div class="bom-list-row ${bomSelectedId === row.id ? 'selected' : ''}" data-bom-id="${escapeHtml(row.id)}"><span>L${row.level}</span><span>${escapeHtml(row.position)}</span><b>${'↳ '.repeat(Math.max(0, row.level - 1))}${escapeHtml(row.itemNo)}<br><small>${escapeHtml(row.name)}</small></b><span>${escapeHtml(components.find(item => item.id === row.parentId)?.name || partName.value || 'Ana mamul')}</span><span>${escapeHtml(row.status)}</span></div>`).join('');
  treeContainer.classList.toggle('hidden', bomViewMode !== 'tree'); listContainer.classList.toggle('hidden', bomViewMode !== 'list');
  document.querySelectorAll('[data-bom-view]').forEach(button => button.classList.toggle('active', button.dataset.bomView === bomViewMode));
  document.getElementById('bomRootName').textContent = partName.value || 'Yeni mamul'; document.getElementById('bomRootCode').textContent = internalProductCode.value || 'Kuruluş kodu bekliyor'; document.getElementById('bomTreeCount').textContent = `${components.length} kalem`;
  document.querySelectorAll('[data-bom-root]').forEach(element => { element.onclick = event => { if (!event.target.closest('button[data-action]')) selectBomNode('FINISHED_GOOD'); }; });
  treeContainer.querySelectorAll('[data-bom-toggle]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); const id = button.dataset.bomToggle; bomExpandedIds.has(id) ? bomExpandedIds.delete(id) : bomExpandedIds.add(id); renderBomNavigator(); }));
  document.querySelectorAll('#bomTree [data-bom-id],#bomList [data-bom-id]').forEach(node => node.addEventListener('click', event => { if (!event.target.closest('[data-bom-toggle]')) selectBomNode(node.dataset.bomId); }));
  treeContainer.querySelectorAll('.bom-tree-node').forEach(node => {
    node.addEventListener('dragstart', event => { bomDraggedId = node.dataset.bomId; event.dataTransfer.effectAllowed = 'move'; });
    node.addEventListener('dragover', event => { if (!bomDraggedId || bomDraggedId === node.dataset.bomId) return; event.preventDefault(); node.classList.add('drag-over'); });
    node.addEventListener('dragleave', () => node.classList.remove('drag-over'));
    node.addEventListener('drop', event => { event.preventDefault(); node.classList.remove('drag-over'); if (!bomDraggedId) return; checkpointBom('BOM düğümü taşındı', bomDraggedId); try { components = globalThis.TyanaBom.reorder(components, bomDraggedId, node.dataset.bomId, globalThis.TyanaBom.isContainerType(components.find(item => item.id === node.dataset.bomId)?.componentType) ? 'inside' : 'after'); logBomChange('BOM içinde taşındı', bomDraggedId); } catch (error) { bomUndoStack.pop(); toast('BOM taşıması reddedildi', error.message); } bomDraggedId = null; renderComponents(); markDraftDirty(); });
    node.addEventListener('dragend', () => { bomDraggedId = null; treeContainer.querySelectorAll('.drag-over').forEach(item => item.classList.remove('drag-over')); });
  });
  renderBomBreadcrumb();
}

function routeLinkOptions(value = '') {
  const entries = selectedProcessEntries();
  return `<option value="">${entries.length ? 'Henüz atanmadı' : 'Önce proses akışı oluşturun'}</option>` + entries.map(entry => `<option value="${escapeHtml(entry.routeKey)}" ${value === entry.routeKey || value === entry.process.id ? 'selected' : ''}>OP ${escapeHtml(entry.detail.operationNo)} • ${escapeHtml(entry.process.name)}</option>`).join('');
}

function resolveRouteKey(value = '') {
  if (!value) return '';
  const exact = selectedProcessEntries().find(entry => entry.routeKey === value);
  return exact?.routeKey || selectedProcessEntries().find(entry => entry.process.id === value || routeBaseId(entry.routeKey) === routeBaseId(value))?.routeKey || value;
}

function syncComponentRouteLink(item, field, previousValue, nextValue) {
  const previousKey = resolveRouteKey(previousValue); const nextKey = resolveRouteKey(nextValue);
  const removeInput = routeKey => { if (routeDetails[routeKey]) routeDetails[routeKey].inputComponentIds = (routeDetails[routeKey].inputComponentIds || []).filter(id => id !== item.id); };
  if (['firstUseProcessId', 'mountedAtProcessId', 'inspectedAtProcessId'].includes(field)) { removeInput(previousKey); if (routeDetails[nextKey] && !routeDetails[nextKey].inputComponentIds.includes(item.id)) routeDetails[nextKey].inputComponentIds.push(item.id); }
  if (field === 'producedAtProcessId') { if (routeDetails[previousKey]?.outputItemId === item.id) routeDetails[previousKey].outputItemId = 'FINISHED_GOOD'; if (routeDetails[nextKey]) routeDetails[nextKey].outputItemId = item.id; }
  item.operationLinkStatus = [item.producedAtProcessId, item.firstUseProcessId, item.mountedAtProcessId, item.inspectedAtProcessId].some(Boolean) ? 'Atandı' : 'Henüz atanmadı';
}

function bomStatusIsStrict() {
  return ['Onay Bekliyor', 'Onaylandı', 'Yayında'].includes(document.getElementById('documentStatus')?.value || 'Taslak');
}

function bomWhereUsed(item) {
  if (!item?.catalogItemId) return [];
  const catalogEntry = bomCatalog.find(entry => entry.id === item.catalogItemId);
  const recorded = Array.isArray(catalogEntry?.usedBy) ? catalogEntry.usedBy : [];
  const current = components.filter(candidate => candidate.catalogItemId === item.catalogItemId).map(() => internalProductCode.value || 'Kaydedilmemiş mamul');
  return [...new Set([...recorded, ...current])];
}

function bomImpactText(item) {
  const children = globalThis.TyanaBom.descendants(components, item.id);
  const routeLinks = Object.values(routeDetails).filter(detail => (detail.inputComponentIds || []).includes(item.id) || detail.outputItemId === item.id).length;
  const controls = characteristics?.filter(characteristic => characteristic.componentId === item.id).length || 0;
  const risks = pfmeaRows.filter(row => row.componentId === item.id).length;
  return `${children.length} alt kalem • ${routeLinks} proses bağlantısı • ${risks} PFMEA riski • ${controls} kontrol satırı`;
}

function componentEditorHtml(item) {
  const isReference = item.reuseMode === 'reference';
  const lock = isReference ? 'disabled' : '';
  const usedBy = bomWhereUsed(item);
  const routeOptions = value => routeLinkOptions(value);
  return `<article class="component-editor selected-component-editor ${isReference ? 'reference-mode' : ''}" data-component-id="${escapeHtml(item.id)}">
    ${isReference ? `<div class="bom-reference-banner"><span>↗</span><div><b>Kontrollü kütüphane referansı</b><small>${escapeHtml(item.catalogItemId)} • Rev. ${escapeHtml(item.catalogRevision || item.itemRevision || 'A')} • Ana teknik alanlar kilitli</small></div><button type="button" data-action="break-bom-reference">Kontrollü Kopyaya Dönüştür</button><button type="button" data-action="new-bom-revision">Yeni Revizyon Aç</button></div>` : ''}
    <div class="component-editor-top"><span class="component-position">${escapeHtml(item.position)}</span><div><small>KALICI BİLEŞEN ID</small><b>${escapeHtml(item.id)}</b></div><label class="component-name">Bileşen / alt montaj adı<input data-component-field="name" ${lock} value="${escapeHtml(item.name)}"></label><mark class="verification-mark ${['Doğrulandı', 'Teknik resimle doğrulandı', 'Müşteri şartıyla doğrulandı'].includes(item.verificationStatus) ? 'verified-status' : ''}">${escapeHtml(item.verificationStatus)}</mark><button class="icon-action" type="button" data-duplicate-component aria-label="Kontrollü kopya oluştur">⧉</button><button class="remove-characteristic" type="button" data-remove-component aria-label="Bileşeni kaldır">×</button></div>
    <div class="bom-impact-card"><span><b>Etki ve izlenebilirlik</b><small>${escapeHtml(bomImpactText(item))}</small></span><span><b>Yeniden kullanım</b><small>${usedBy.length ? `${usedBy.length} kullanım: ${usedBy.join(', ')}` : 'Yalnız bu mamulde kullanılıyor'}</small></span><button type="button" class="ghost-button" data-action="publish-bom-catalog" ${item.reusable && item.catalogItemId ? 'disabled' : ''}>${item.catalogItemId ? 'Kütüphanede Kayıtlı' : 'Kütüphaneye Kaydet'}</button></div>
    <div class="component-section"><b>Kimlik, seviye ve geçerlilik</b><div class="form-grid form-grid-4">
      <label>Pozisyon no *<input data-component-field="position" value="${escapeHtml(item.position)}" inputmode="numeric"></label>
      <label>Parça / stok kodu *<input data-component-field="itemNo" ${lock} value="${escapeHtml(item.itemNo)}"></label>
      <label>Kalem tipi *<select data-component-field="componentType" ${lock}>${selectOptions(componentTypeOptions, item.componentType)}</select></label>
      <label>Bağlı olduğu üst kalem *<select data-component-field="parentId">${componentParentOptions(item)}</select></label>
      <label>BOM miktarı *<input data-component-field="quantity" value="${escapeHtml(formatValue(item.quantity))}" inputmode="decimal"></label>
      <label>Kullanıldığı miktar<input data-component-field="usageQuantity" value="${escapeHtml(formatValue(item.usageQuantity))}" inputmode="decimal"></label>
      <label>Birim<select data-component-field="uom">${selectOptions(['adet', 'kg', 'g', 'm', 'ml', 'set'], item.uom)}</select></label>
      <label>Üret / satın al<select data-component-field="makeBuy" ${lock}>${selectOptions(makeBuyOptions, item.makeBuy)}</select></label>
      <label>Kalem revizyonu<input data-component-field="itemRevision" ${lock} value="${escapeHtml(item.itemRevision || item.revision)}" maxlength="12"></label>
      <label>Durum<select data-component-field="status">${selectOptions(['Taslak', 'İncelemede', 'Düzeltme Gerekli', 'Onay Bekliyor', 'Onaylandı', 'Yayında', 'Eski Revizyon', 'İptal Edildi', 'Uygulanamaz'], item.status)}</select></label>
      <label>Geçerlilik başlangıcı<input data-component-field="effectiveFrom" type="date" value="${escapeHtml(item.effectiveFrom)}"></label>
      <label>Geçerlilik bitişi<input data-component-field="effectiveTo" type="date" value="${escapeHtml(item.effectiveTo)}"></label>
      <label>Alternatif parça kodu<input data-component-field="alternativePartNo" value="${escapeHtml(item.alternativePartNo)}"></label>
      <label>Alternatif grup ID<input data-component-field="alternativeGroupId" value="${escapeHtml(item.alternativeGroupId)}" placeholder="Örn. BEARING-OPTION"></label>
      <label class="checkbox-field"><input data-component-field="alternativeSelected" type="checkbox" ${item.alternativeSelected ? 'checked' : ''}><span><b>Aktif alternatif</b><small>Grupta yalnız bir seçim</small></span></label>
      <label class="checkbox-field"><input data-component-field="reusable" type="checkbox" ${item.reusable ? 'checked' : ''}><span><b>Yeniden kullanılabilir</b><small>Alt montaj master adayı</small></span></label>
    </div></div>
    <div class="component-section"><b>Malzeme, tedarik ve teknik resim</b><div class="form-grid form-grid-4">
      <label>Malzeme ailesi<input data-component-field="materialFamily" ${lock} list="materialFamilyOptions" value="${escapeHtml(item.materialFamily)}"></label>
      <label>Malzeme kalite / sınıf<input data-component-field="materialGrade" ${lock} list="materialGradeOptions" value="${escapeHtml(item.materialGrade)}"></label>
      <label>Malzeme standardı / rev.<input data-component-field="materialStandard" ${lock} list="materialStandardOptions" value="${escapeHtml(item.materialStandard)}"></label>
      <label>Hammadde / tedarik formu<select data-component-field="rawMaterialForm" ${lock}>${selectOptions(rawFormOptions, item.rawMaterialForm)}</select></label>
      <label>Teknik resim / şartname no<input data-component-field="drawingNo" ${lock} value="${escapeHtml(item.drawingNo)}"></label>
      <label>Teknik resim revizyonu<input data-component-field="drawingRevision" ${lock} value="${escapeHtml(item.drawingRevision)}" maxlength="12"></label>
      <label>Kaynak / tedarikçi<input data-component-field="supplier" ${lock} list="supplierOptions" value="${escapeHtml(item.supplier)}"></label>
      <label>Sertifika şartı<input data-component-field="certificate" ${lock} list="certificateOptions" value="${escapeHtml(item.certificate)}"></label>
      <label class="span-2">İzlenebilirlik<input data-component-field="traceability" ${lock} list="traceabilityOptions" value="${escapeHtml(item.traceability)}"></label>
      <label class="span-2">Bileşen açıklaması<input data-component-field="description" value="${escapeHtml(item.description)}"></label>
    </div></div>
    <div class="component-section manufacturing-state-section"><b>Üretim durumu ve dönüşüm yöntemi</b><div class="form-grid form-grid-4">
      <label>Prosese giriş durumu<select data-component-field="inputState">${selectOptions(componentInputStateOptions, item.inputState)}</select><small>Örn. gövde: Dövme taslak.</small></label>
      <label>Önceki / kaynak yöntem<select data-component-field="upstreamMethod">${selectOptions(manufacturingMethodOptions, item.upstreamMethod)}</select><small>Tedarikçi veya önceki iç proses.</small></label>
      <label>Ana dönüşüm yöntemi<select data-component-field="primaryManufacturingMethod">${selectOptions(manufacturingMethodOptions, item.primaryManufacturingMethod)}</select><small>Örn. Talaşlı imalat.</small></label>
      <label>Proses çıkış durumu<select data-component-field="outputState">${selectOptions(componentOutputStateOptions, item.outputState)}</select><small>Örn. İşlenmiş parça.</small></label>
      <label class="span-2">Bileşen proses omurgası / ara adımlar<input data-component-field="manufacturingRouteNotes" value="${escapeHtml(item.manufacturingRouteNotes || '')}" placeholder="Dövme kabul → CNC → delik/diş → yıkama"></label>
      <div class="manufacturing-state-example"><span>GİRİŞ</span><b>${escapeHtml(item.inputState)}</b><i>→</i><span>YÖNTEM</span><b>${escapeHtml(item.primaryManufacturingMethod)}</b><i>→</i><span>ÇIKIŞ</span><b>${escapeHtml(item.outputState)}</b></div>
    </div></div>
    <div class="component-section bom-process-links"><b>BOM ↔ proses akışı bağlantısı</b><p>BOM ürünü neyin oluşturduğunu; bu alanlar bileşenin nerede ve ne zaman işlendiğini tanımlar.</p><div class="form-grid form-grid-4">
      <label>Üretildiği operasyon<select data-component-field="producedAtProcessId">${routeOptions(item.producedAtProcessId)}</select></label>
      <label>İlk kullanıldığı operasyon<select data-component-field="firstUseProcessId">${routeOptions(item.firstUseProcessId)}</select></label>
      <label>Monte edildiği operasyon<select data-component-field="mountedAtProcessId">${routeOptions(item.mountedAtProcessId)}</select></label>
      <label>Kontrol edildiği operasyon<select data-component-field="inspectedAtProcessId">${routeOptions(item.inspectedAtProcessId)}</select></label>
      <label>Montaj aşaması<select data-component-field="installationStage">${selectOptions(['Proses akışına göre', 'Boya öncesi montaj', 'Boya sonrası montaj', 'Final montaj', 'Paketleme aşaması', 'Uygulanamaz'], item.installationStage)}</select></label>
      <label>Ön koşul operasyon<select data-component-field="prerequisiteProcessId">${routeOptions(item.prerequisiteProcessId)}</select></label>
      <label>Sonraki operasyon<select data-component-field="nextProcessId">${routeOptions(item.nextProcessId)}</select></label>
      <label>Montaj sırası<input data-component-field="assemblySequence" inputmode="numeric" value="${escapeHtml(item.assemblySequence)}"></label>
      <label>Bağlantı durumu<select data-component-field="operationLinkStatus">${selectOptions(['Henüz atanmadı', 'Atandı', 'Doğrulandı'], item.operationLinkStatus)}</select></label>
      <label class="checkbox-field"><input data-component-field="paintSensitive" type="checkbox" ${item.paintSensitive ? 'checked' : ''}><span><b>Boya sıcaklığına hassas</b><small>Boya sonrası montaj kapısı</small></span></label>
    </div></div>
    <div class="component-section"><b>Isıl işlem, kaplama ve kalite sınıflandırması</b><div class="form-grid form-grid-4">
      <label>Isıl işlem<select data-component-field="heatTreatment">${selectOptions(heatTreatmentOptions, item.heatTreatment)}</select></label>
      <label>Sertlik / mekanik şart<input data-component-field="hardnessSpec" value="${escapeHtml(item.hardnessSpec)}"></label>
      <label>Kaplama / yüzey<select data-component-field="coatingType">${selectOptions(coatingOptions, item.coatingType)}</select></label>
      <label>Kaplama sayısal şartı<input data-component-field="coatingSpec" value="${escapeHtml(item.coatingSpec)}" placeholder="Örn. min. 12 µm"></label>
      <label>Doğrulama durumu<select data-component-field="verificationStatus">${selectOptions(['Doğrulama bekliyor', 'Teknik resimle doğrulandı', 'Müşteri şartıyla doğrulandı', 'Doğrulandı', 'Uygulanamaz — gerekçe gerekli'], item.verificationStatus)}</select></label>
      <label>Özel karakteristik<select data-component-field="specialCharacteristic">${selectOptions(['NONE', 'SC', 'CC', 'KC', 'Emniyet'], item.specialCharacteristic)}</select></label>
      <label class="checkbox-field"><input data-component-field="critical" type="checkbox" ${item.critical ? 'checked' : ''}><span><b>Emniyet / özel önem</b><small>PFMEA ve CP bağlantısı zorunlu</small></span></label>
      <label class="span-2">Not / U/A gerekçesi<input data-component-field="notes" value="${escapeHtml(item.notes || '')}" placeholder="Serbest açıklama veya uygulanamaz gerekçesi"></label>
      <label class="span-2">Değişiklik gerekçesi<input data-component-field="changeReason" value="${escapeHtml(item.changeReason || '')}" placeholder="Revizyon ve etki analizi kaydı"></label>
    </div></div>
  </article>`;
}

function renderComponents() {
  const container = document.getElementById('componentRows');
  if (!container || !globalThis.TyanaBom) return;
  components = globalThis.TyanaBom.normalizeComponents(components);
  ensureEngineeringUniverseFromLegacy();
  if (bomSelectedId !== 'FINISHED_GOOD' && !components.some(item => item.id === bomSelectedId)) bomSelectedId = 'FINISHED_GOOD';
  renderBomNavigator(); renderBomHistory();
  const item = components.find(candidate => candidate.id === bomSelectedId);
  const empty = document.getElementById('bomEditorEmpty');
  if (!item) {
    if (empty) { empty.classList.remove('hidden'); empty.querySelector('h3').textContent = components.length ? 'Mamul ağacından bir kalem seçin' : 'Boş mamul ağacı'; empty.querySelector('p').textContent = components.length ? 'Seçilen bileşenin teknik şartları, revizyonu ve operasyon bağlantıları burada düzenlenir.' : 'Ana mamulün altına ilk bileşeni veya alt montajı ekleyerek başlayın.'; }
    container.innerHTML = components.length ? '' : '<button class="primary-button" type="button" data-action="add-component">＋ İlk Bileşeni Ekle</button>';
  } else {
    empty?.classList.add('hidden'); container.innerHTML = componentEditorHtml(item);
  }

  container.querySelectorAll('[data-component-field]').forEach(field => field.addEventListener('change', event => {
    const current = components.find(candidate => candidate.id === bomSelectedId); if (!current) return;
    const key = event.target.dataset.componentField; const previous = current[key];
    let next = ['quantity', 'usageQuantity'].includes(key) ? parseLocaleNumber(event.target.value) : ['critical', 'alternativeSelected', 'reusable', 'paintSensitive'].includes(key) ? event.target.checked : event.target.value;
    if (key === 'parentId' && globalThis.TyanaBom.wouldCreateCycle(components, current.id, next)) { event.target.value = previous; toast('Üst bileşen değiştirilemedi', 'Bu seçim döngüsel BOM oluşturur.'); return; }
    checkpointBom(`${current.name} • ${key}`, current.id); current[key] = next;
    if (key === 'drawingRevision') current.revision = next;
    if (key === 'itemRevision' && !current.revision) current.revision = next;
    if (key === 'installationStage') { current.paintSensitive = /boya sonrası/i.test(next) || current.paintSensitive; current.installationConstraint = /boya sonrası/i.test(next) ? 'AFTER_PAINT' : ''; }
    if (['producedAtProcessId', 'firstUseProcessId', 'mountedAtProcessId', 'inspectedAtProcessId'].includes(key)) syncComponentRouteLink(current, key, previous, next);
    logBomChange('Alan güncellendi', current.id, key, previous, next); markDraftDirty(); updateSummary();
    const rerender = ['name', 'itemNo', 'componentType', 'parentId', 'position', 'itemRevision', 'status', 'verificationStatus', 'operationLinkStatus', 'alternativeSelected', 'reuseMode', 'installationStage'].includes(key);
    if (rerender) renderComponents(); else { validateComponents(); renderBomNavigator(); }
    if (typeof renderEngineeringQuestions === 'function') renderEngineeringQuestions();
  }));
  container.querySelector('[data-remove-component]')?.addEventListener('click', removeSelectedBomComponent);
  container.querySelector('[data-duplicate-component]')?.addEventListener('click', duplicateSelectedBomSubtree);
  container.querySelector('[data-action="break-bom-reference"]')?.addEventListener('click', () => breakBomReference(false));
  container.querySelector('[data-action="new-bom-revision"]')?.addEventListener('click', () => breakBomReference(true));
  container.querySelector('[data-action="publish-bom-catalog"]')?.addEventListener('click', publishSelectedBomToCatalog);
  container.querySelectorAll('[data-action="add-component"]').forEach(button => button.addEventListener('click', openBomComponentDialog));
  validateComponents(); renderEngineeringScopeOptions();
  if (productEngineeringLibrary) renderEngineeringQuestions();
  renderEngineeringBomUi();
}

function openBomComponentDialog() {
  const selectedItem = components.find(item => item.id === bomSelectedId);
  const parent = selectedItem && globalThis.TyanaBom.isContainerType(selectedItem.componentType) ? selectedItem : components.find(item => item.id === selectedItem?.parentId);
  const context = document.getElementById('bomDialogContext'); if (context) context.textContent = `${parent?.name || partName.value || 'Ana mamul'} seviyesine yeni kalem eklenecek.`;
  renderBomLibraryPickers(); document.getElementById('bomComponentDialog')?.showModal();
}

function selectedBomParentId() {
  const selectedItem = components.find(item => item.id === bomSelectedId);
  if (!selectedItem) return 'FINISHED_GOOD';
  return globalThis.TyanaBom.isContainerType(selectedItem.componentType) ? selectedItem.id : selectedItem.parentId;
}

function addComponent(type = 'İç üretim parçası', parentOverride = '') {
  const selectedType = typeof type === 'string' ? type : 'İç üretim parçası'; const parentId = parentOverride || selectedBomParentId();
  checkpointBom('Bileşen eklendi', parentId);
  const purchased = ['Satın alınan parça', 'Satın alınan bileşen', 'Bağlantı elemanı', 'Ambalaj malzemesi', 'Ambalaj'].includes(selectedType);
  const item = componentRecord({ position: globalThis.TyanaBom.nextPosition(components, parentId), parentId, componentType: selectedType, name: selectedType === 'Alt montaj' ? 'Yeni alt montaj' : `Yeni ${selectedType.toLocaleLowerCase('tr-TR')}`, makeBuy: purchased ? 'Satın al' : 'Üret', supplier: purchased ? 'Onaylı tedarikçi seçilecek' : tenantOrganizationName(), reusable: selectedType === 'Alt montaj' });
  components.push(item); bomSelectedId = item.id; bomExpandedIds.add(parentId); logBomChange('Bileşen eklendi', item.id); renderComponents(); markDraftDirty();
  document.getElementById('bomComponentDialog')?.close(); document.querySelector('#componentRows .component-name input')?.focus();
}

function removeSelectedBomComponent() {
  const item = components.find(candidate => candidate.id === bomSelectedId); if (!item) return;
  const subtree = globalThis.TyanaBom.subtree(components, item.id); const usedBy = bomWhereUsed(item);
  const message = `${item.name} ve ${Math.max(0, subtree.length - 1)} alt kalem kaldırılacak.\n${bomImpactText(item)}${usedBy.length ? `\nKütüphane kaydı ${usedBy.length} kullanımda; yalnız bu mamuldeki referans kaldırılır.` : ''}\n\nBu işlem için devam edilsin mi?`;
  if (!window.confirm(message)) return;
  checkpointBom('BOM alt ağacı kaldırıldı', item.id); const ids = new Set(subtree.map(candidate => candidate.id));
  components = components.filter(candidate => !ids.has(candidate.id));
  characteristics = characteristics.map(characteristic => ids.has(characteristic.componentId) ? { ...characteristic, componentId: 'FINISHED_GOOD' } : characteristic);
  pfmeaRows = pfmeaRows.map(row => ids.has(row.componentId) ? { ...row, componentId: 'FINISHED_GOOD', controlPlanCharacteristicId: '', controlPlanRowId: '' } : row);
  Object.values(routeDetails).forEach(detail => { detail.inputComponentIds = (detail.inputComponentIds || []).filter(id => !ids.has(id)); if (ids.has(detail.outputItemId)) detail.outputItemId = 'FINISHED_GOOD'; });
  const parentId = item.parentId; bomSelectedId = parentId === 'FINISHED_GOOD' ? 'FINISHED_GOOD' : parentId; logBomChange('Alt ağaç kaldırıldı', item.id); renderComponents(); renderCharacteristics(); markDraftDirty();
}

function cloneBomSubtree(rootId, parentId, overrides = {}) {
  const source = globalThis.TyanaBom.subtree(components, rootId); const idMap = new Map(source.map(item => [item.id, `ITEM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`]));
  return source.map((item, index) => componentRecord({ ...item, id: idMap.get(item.id), parentId: index === 0 ? parentId : idMap.get(item.parentId), position: index === 0 ? globalThis.TyanaBom.nextPosition(components, parentId) : item.position, itemNo: index === 0 ? `${item.itemNo || 'ITEM'}-KOPYA` : item.itemNo, name: index === 0 ? `${item.name} — Kontrollü Kopya` : item.name, catalogItemId: '', catalogRevision: '', reuseMode: 'copy', itemRevision: 'A', revision: item.drawingRevision || item.revision || 'A', verificationStatus: 'Doğrulama bekliyor', status: 'Taslak', changeReason: 'Kontrollü kopya oluşturuldu', ...(index === 0 ? overrides : {}) }));
}

function duplicateSelectedBomSubtree() {
  const item = components.find(candidate => candidate.id === bomSelectedId); if (!item) return;
  checkpointBom('Kontrollü BOM kopyası', item.id); const clones = cloneBomSubtree(item.id, item.parentId); components.push(...clones); bomSelectedId = clones[0].id; logBomChange('Kontrollü kopya oluşturuldu', bomSelectedId); renderComponents(); markDraftDirty();
}

function breakBomReference(newRevision = false) {
  const item = components.find(candidate => candidate.id === bomSelectedId); if (!item || item.reuseMode !== 'reference') return;
  checkpointBom(newRevision ? 'Yeni alt montaj revizyonu' : 'Referanstan kontrollü kopya', item.id); const previous = item.catalogRevision || item.itemRevision || 'A';
  item.reuseMode = newRevision ? 'revision' : 'copy'; item.catalogItemId = newRevision ? item.catalogItemId : ''; item.itemRevision = newRevision ? nextRevision(previous) : 'A'; item.catalogRevision = newRevision ? item.itemRevision : ''; item.status = 'Taslak'; item.changeReason = newRevision ? `Rev. ${previous} üzerinden yeni revizyon açıldı` : 'Kütüphane referansından kontrollü kopya';
  logBomChange(newRevision ? 'Yeni revizyon açıldı' : 'Referans kontrollü kopyaya dönüştürüldü', item.id, 'itemRevision', previous, item.itemRevision); renderComponents(); markDraftDirty();
}

function nextRevision(value) {
  const text = String(value || 'A').toUpperCase();
  if (/^\d+$/.test(text)) return String(Number(text) + 1);
  if (/^[A-Z]$/.test(text) && text !== 'Z') return String.fromCharCode(text.charCodeAt(0) + 1);
  return `${text}.1`;
}

function publishSelectedBomToCatalog() {
  const item = components.find(candidate => candidate.id === bomSelectedId); if (!item) return;
  const catalogId = item.catalogItemId || `CAT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`; const records = globalThis.TyanaBom.subtree(components, item.id).map(record => ({ ...record }));
  bomCatalog = bomCatalog.filter(entry => entry.id !== catalogId); bomCatalog.push({ id: catalogId, itemNo: item.itemNo, name: item.name, revision: item.itemRevision || 'A', componentType: item.componentType, usedBy: [internalProductCode.value || 'Kaydedilmemiş mamul'], components: records, updatedAt: new Date().toISOString() });
  item.catalogItemId = catalogId; item.catalogRevision = item.itemRevision || 'A'; item.reusable = true; logBomChange('Kütüphane master kaydı oluşturuldu', item.id, 'catalogItemId', '', catalogId); renderBomLibraryPickers(); renderComponents(); markDraftDirty(); toast('Alt montaj kütüphaneye kaydedildi', `${item.name} • ${catalogId} • Rev. ${item.catalogRevision}`);
}

function mergedBomCatalog() {
  const libraryItems = Array.isArray(bomEngineeringLibrary?.catalog) ? bomEngineeringLibrary.catalog : [];
  return [...new Map([...libraryItems, ...bomCatalog].map(entry => [entry.id, entry])).values()];
}

function renderBomLibraryPickers() {
  const select = document.getElementById('bomLibrarySelect');
  if (select) {
    const entries = mergedBomCatalog();
    select.innerHTML = entries.length ? '<option value="">Kütüphaneden seçin…</option>' + entries.map(entry => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.itemNo || entry.root?.itemNo || entry.id)} • ${escapeHtml(entry.name || entry.root?.name)} • Rev. ${escapeHtml(entry.revision || entry.root?.itemRevision || 'A')}</option>`).join('') : '<option value="">Henüz kütüphane kaydı yok</option>';
  }
}

function uniqueBomRecords(sourceRecords, targetParentId = 'FINISHED_GOOD', mode = 'copy', catalogEntry = null) {
  const normalized = globalThis.TyanaBom.normalizeComponents(sourceRecords); const sourceIds = new Set(normalized.map(item => item.id));
  const roots = normalized.filter(item => item.parentId === 'FINISHED_GOOD' || !sourceIds.has(item.parentId)); const rootId = roots[0]?.id; const rootIds = new Set(roots.map(item => item.id));
  const idMap = new Map(normalized.map(item => [item.id, `ITEM-${crypto.randomUUID().slice(0, 8).toUpperCase()}`]));
  return normalized.map(item => {
    const preserveReference = mode === 'reference' || (mode === 'template' && item.reuseMode === 'reference');
    return componentRecord({ ...item, id: idMap.get(item.id), parentId: rootIds.has(item.id) ? targetParentId : (idMap.get(item.parentId) || targetParentId), position: mode === 'template' ? item.position : item.id === rootId ? globalThis.TyanaBom.nextPosition(components, targetParentId) : item.position, catalogItemId: preserveReference ? (catalogEntry?.id || item.catalogItemId) : '', catalogRevision: preserveReference ? (catalogEntry?.revision || item.catalogRevision || item.itemRevision || 'A') : '', reuseMode: preserveReference ? 'reference' : mode, reusable: item.id === rootId ? Boolean(catalogEntry?.reusable ?? item.reusable) : item.reusable, status: preserveReference ? item.status : 'Taslak', verificationStatus: preserveReference || mode === 'template' ? item.verificationStatus : 'Doğrulama bekliyor', changeReason: preserveReference ? `Kütüphane referansı: ${catalogEntry?.id || item.catalogItemId}` : mode === 'template' ? 'Başlangıç şablonundan oluşturuldu' : 'Kütüphane kaydından kontrollü kopya' });
  });
}

function catalogEntryRecords(entry) {
  if (!entry) return [];
  if (entry.root) return [{ ...entry.root }, ...(entry.components || []).map(item => ({ ...item }))];
  return (entry.components || []).map(item => ({ ...item }));
}

function insertSelectedBomLibraryItem(mode = 'reference') {
  const id = document.getElementById('bomLibrarySelect')?.value; const entry = mergedBomCatalog().find(item => item.id === id);
  if (!entry) { toast('Kütüphane kaydı seçilmedi', 'Önce bileşen veya alt montaj seçin.'); return; }
  const source = catalogEntryRecords(entry); if (!source.length) { toast('Kütüphane kaydı açılamadı', 'Alt montaj bileşen verisi bulunamadı.'); return; }
  const parentId = selectedBomParentId(); checkpointBom(mode === 'reference' ? 'Kütüphane referansı eklendi' : 'Kontrollü kopya eklendi', parentId);
  const records = uniqueBomRecords(source, parentId, mode, entry); components.push(...records); bomSelectedId = records[0].id; bomExpandedIds.add(parentId); logBomChange(mode === 'reference' ? 'Kütüphane referansı eklendi' : 'Kontrollü kopya eklendi', bomSelectedId); document.getElementById('bomComponentDialog')?.close(); renderComponents(); markDraftDirty();
  toast(mode === 'reference' ? 'Alt montaj referansla bağlandı' : 'Kontrollü kopya oluşturuldu', `${entry.name || entry.root?.name} • ${records.length} kalem`);
}

function validateComponents(options = {}) {
  ensureEngineeringUniverseFromLegacy();
  const structure = document.getElementById('productStructureType')?.value || 'assembly';
  const bomRequired = ['assembly', 'subassembly', 'service_kit'].includes(structure);
  const structureLabel = ({ assembly: 'Komple mamul', subassembly: 'Yarı mamul / alt montaj', service_kit: 'Servis kiti' })[structure] || 'Mamul';
  const route = typeof selectedProcessEntries === 'function' ? selectedProcessEntries().map(({ routeKey, process, detail }) => ({ routeKey, processId: process.id, name: process.name, operationNo: detail.operationNo, inputComponentIds: [...detail.inputComponentIds], outputItemId: detail.outputItemId })) : [];
  const strict = options.strict ?? bomStatusIsStrict(); const issues = globalThis.TyanaBom.validate(components, { route, characteristics: characteristics || [], pfmea: pfmeaRows || [], strict });
  const canonical = globalThis.TyanaBom.validateEngineeringUniverse(engineeringUniverse, { operationCodes: operationCodeEntries(), strictRevision: strict });
  issues.push(...canonical.errors, ...canonical.warnings);
  if (bomRequired && !components.length) issues.unshift({ code: 'EMPTY_ASSEMBLY_BOM', message: `${structureLabel} için en az bir BOM kalemi gerekli.`, componentId: '', severity: 'error' });
  const summary = globalThis.TyanaBom.summarizeValidation(issues); const errorIds = new Set(summary.errors.map(issue => issue.componentId).filter(Boolean));
  document.querySelectorAll('#componentRows .component-editor').forEach(card => card.classList.toggle('invalid-card', errorIds.has(card.dataset.componentId)));
  const validCount = components.filter(item => !errorIds.has(item.id)).length; const validation = document.getElementById('componentValidation');
  if (validation) { validation.classList.toggle('has-errors', summary.errors.length > 0); validation.classList.toggle('has-warnings', !summary.errors.length && summary.warnings.length > 0); validation.querySelector('p').textContent = `${validCount}/${components.length} kalem • ${summary.errors.length} kritik hata • ${summary.warnings.length} uyarı`; }
  const title = document.getElementById('bomTitle'); if (title) title.textContent = `${partName.value || 'Yeni Mamul'} — ${components.length} alt kalem / ${globalThis.TyanaBom.flatten(components).reduce((max, row) => Math.max(max, row.level), 0)} seviye`;
  if (options.show) showBomValidationFindings(issues);
  return summary.valid;
}

function showBomValidationFindings(issues = globalThis.TyanaBom.validate(components, { route: selectedProcessEntries().map(({ routeKey, process, detail }) => ({ routeKey, processId: process.id, name: process.name, operationNo: detail.operationNo, inputComponentIds: detail.inputComponentIds, outputItemId: detail.outputItemId })), characteristics, pfmea: pfmeaRows, strict: bomStatusIsStrict() })) {
  let container = document.getElementById('bomValidationFindings');
  if (!container) { container = document.createElement('div'); container.id = 'bomValidationFindings'; container.className = 'bom-validation-findings'; document.getElementById('componentValidation')?.insertAdjacentElement('afterend', container); }
  container.innerHTML = issues.length ? `<div class="bom-validation-head"><b>BOM doğrulama bulguları</b><button type="button" data-close-bom-findings>×</button></div>${issues.map(issue => { const item = components.find(candidate => candidate.id === issue.componentId); return `<button type="button" class="${issue.severity === 'warning' ? 'warning' : 'error'}" data-validation-component="${escapeHtml(issue.componentId || 'FINISHED_GOOD')}"><span>${issue.severity === 'warning' ? '!' : '×'}</span><p><b>${escapeHtml(issue.code)}</b><small>${escapeHtml(item ? `${item.position} • ${item.name} — ${issue.message}` : issue.message)}</small></p></button>`; }).join('')}` : '<div class="bom-validation-head"><b>✓ BOM yapısal doğrulamadan geçti</b><button type="button" data-close-bom-findings>×</button></div>';
  container.classList.remove('hidden'); container.querySelector('[data-close-bom-findings]')?.addEventListener('click', () => container.classList.add('hidden')); container.querySelectorAll('[data-validation-component]').forEach(button => button.addEventListener('click', () => selectBomNode(button.dataset.validationComponent)));
}

function componentOptionsForCharacteristic(selectedId) {
  const root = `<option value="FINISHED_GOOD" ${selectedId === 'FINISHED_GOOD' ? 'selected' : ''}>Ana mamul • ${escapeHtml(partName.value || 'Yeni Mamul')}</option>`;
  return root + components.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === selectedId ? 'selected' : ''}>${escapeHtml(item.position)} • ${escapeHtml(item.name)}</option>`).join('');
}

function resetBlankProductContext() {
  const blankValues = {
    customer: '', customerPartNumber: '', productionPhase: 'Prototip', annualVolume: '', supplierName: tenantOrganizationName(), supplierSite: tenantPlantName(), supplierCode: activeTenantProfile.supplierCode || '',
    keyContact: 'Eren', keyContactPhone: '', coreTeam: '', originalDate: new Date().toISOString().slice(0, 10), revisionDate: new Date().toISOString().slice(0, 10), documentStatus: 'Taslak',
    materialFamily: 'BOM ve bileşen kartlarından türetilir', materialGrade: '', materialStandard: '', rawMaterialForm: 'Komple mamul / montaj', partWeight: '', materialCertificate: '',
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

const productLevelProfiles = Object.freeze({
  assembly: { badge: 'MM', title: 'Komple mamul akışı', description: 'Alt bileşen/BOM → üretim ve montaj → son kontrol → markalama → paketleme', commonProduction: 'Komple mamul / montaj' },
  subassembly: { badge: 'YM', title: 'Yarı mamul / alt montaj akışı', description: 'Girdi kartları → yarı mamul operasyonları → ara kontrol → markalama → kontrollü stok/sonraki üst mamul', commonProduction: 'Yarı mamul / alt montaj' },
  single_part: { badge: 'TP', title: 'Tek parça mamul akışı', description: 'Hammadde → parça üretim operasyonları → ölçüm/son kontrol → markalama → paketleme', commonProduction: 'Tek parça üretim' },
  service_kit: { badge: 'SK', title: 'Servis kiti / paket akışı', description: 'Girdi kabul → kit doğrulama → son kontrol → etiketleme → paketleme', commonProduction: 'Servis kiti / paket' }
});

function activeProductLevelProfile() {
  return productLevelProfiles[document.getElementById('productStructureType')?.value] || productLevelProfiles.assembly;
}

function syncProductLevelContext() {
  const profile = activeProductLevelProfile();
  const hint = document.getElementById('productFlowScopeHint');
  if (hint) hint.innerHTML = `<span>${escapeHtml(profile.badge)}</span><div><b>${escapeHtml(profile.title)}</b><small>${escapeHtml(profile.description)}</small></div>`;
  const commonProduction = document.getElementById('rawMaterialForm');
  const managedValues = Object.values(productLevelProfiles).map(item => item.commonProduction);
  if (commonProduction && (!commonProduction.value || managedValues.includes(commonProduction.value))) commonProduction.value = profile.commonProduction;
  if (productEngineeringLibrary) renderEngineeringQuestions();
  return profile;
}

function defaultRouteForProductContext() {
  const structure = document.getElementById('productStructureType')?.value || 'assembly';
  const base = [...(activeBackbone().processes || [])];
  let route = base;
  if (structure === 'subassembly') route = base.filter(id => !['packing'].includes(id));
  if (structure === 'single_part') route = base.filter(id => !['press-assembly', 'assembly', 'integrated-assembly', 'post-paint-assembly', 'torque'].includes(id));
  if (structure === 'service_kit') route = ['incoming', 'storage', 'final', 'marking', 'packing'];
  const terminal = structure === 'subassembly' ? ['final', 'marking', 'storage'] : ['final', 'marking', 'packing'];
  return [...new Set([...route, ...terminal])];
}

function applyProductTemplate(templateId = 'blank') {
  const selector = document.getElementById('productTemplate');
  const bomModeBadge = document.getElementById('bomModeBadge'); const bomContextNote = document.getElementById('bomContextNote');
  if (String(templateId || 'blank') !== 'blank') { toast('Gömülü hazır ürün kaldırıldı', 'Yeni ürünler sıfırdan açılır veya kuruluşunuzun onaylı ürün grubu ana şablonundan oluşturulur.'); return false; }
  productGroup.value = '__custom__'; document.getElementById('customProductGroupName').value = '';
  document.getElementById('productStructureType').value = 'assembly';
  partNumber.value = ''; internalProductCode.value = ''; partName.value = ''; controlPlanNumber.value = ''; projectCode.value = `TY-${new Date().getFullYear()}-YENİ`; document.getElementById('drawingNumber').value = ''; drawingRevision.value = 'A'; customProductTypeName.value = '';
  resetBlankProductContext();
  components = []; selected = []; routeDetails = {}; pfmeaRows = []; engineeringAnswers = {}; engineeringCustomQuestions = []; ppapRecords = {}; generatedDocumentRecords = []; characteristics = [newCharacteristic({ id: 'CHAR-001', balloon: '1', name: 'Yeni karakteristik', componentId: 'FINISHED_GOOD' })]; globalThis.TyanaApqp?.reset?.(); globalThis.TyanaFmea?.reset?.(); resetEngineeringUniverseFromComponents();
  if (bomModeBadge) bomModeBadge.textContent = 'SIFIRDAN MAMUL';
  if (bomContextNote) bomContextNote.textContent = 'Mamul ağacı boştur; önce malzeme/ürün kartlarını oluşturun, ardından kartları BOM ve operasyon kodlarıyla bağlayın.';
  if (selector) selector.value = 'blank';
  syncProductTypes(); syncProductLevelContext(); renderComponents(); renderCharacteristics(); renderOptions(); renderSequence(); updateSummary(); markDraftDirty();
  toast('Boş ürün ana verisi açıldı', 'Önce ürün grubu, seviye, tip, OEM numarası ve kuruluş içi stok kodunu tanımlayın; ardından ürün ağacına geçin.');
  return true;
}

productGroup.addEventListener('change', syncProductTypes);
productType.addEventListener('change', () => { syncCustomProductTypeField({ focus: isCustomProductType() }); updateSummary(); markDraftDirty(); });
[customProductTypeName, partNumber, internalProductCode, partName, drawingRevision, projectCode, controlPlanNumber, document.getElementById('annualVolume')].forEach(input => {
  input.addEventListener('input', updateSummary);
  input.addEventListener('change', updateSummary);
});

// Guided wizard
let currentWizardStep = 1;
function prepareIndependentProductModules() {
  const identityPane = document.querySelector('#product .wizard-pane[data-pane="1"]');
  const itemMasterStage = document.getElementById('itemMasterStage');
  if (identityPane && itemMasterStage && itemMasterStage.parentElement !== identityPane) {
    const divider = document.createElement('div');
    divider.className = 'independent-module-divider';
    divider.innerHTML = '<span>01B</span><div><b>Alt ürün ve malzeme kartları</b><small>Ana mamul, yarı mamul, alt montaj, iç üretim parçası, satın alınan parça ve hammadde ana verileri</small></div>';
    identityPane.append(divider, itemMasterStage);
  }
  document.getElementById('product')?.classList.add('independent-product-modules');
}
prepareIndependentProductModules();

function validateProductDefinitionBasics() {
  ensureEngineeringUniverseFromLegacy();
  const activeMasters = (engineeringUniverse?.itemMasters || []).filter(master => master.validationStatus !== 'OBSOLETE');
  const incomplete = activeMasters.filter(master => !String(master.internalCode || '').trim() || !String(master.name || '').trim() || !String(master.itemType || '').trim());
  if (incomplete.length) {
    const first = incomplete[0];
    selectedItemMasterId = first.id;
    setEngineeringBomStage('masters');
    renderItemMasterUi();
    toast('Ürün kartı tamamlanmalı', `${first.name || 'Adsız kart'} için kuruluş kodu, kart adı ve kart tipi gereklidir.`);
    return false;
  }
  const structureRequiresBom = ['assembly', 'subassembly', 'service_kit'].includes(document.getElementById('productStructureType')?.value || 'assembly');
  const rootBom = engineeringUniverse?.bomDefinitions.find(definition => definition.headerItemMasterId === engineeringUniverse.rootItemMasterId && definition.status !== 'OBSOLETE');
  if (structureRequiresBom && !(rootBom?.lines || []).length) {
    setEngineeringBomStage('structure');
    renderEngineeringBomStructure();
    toast('Ürün ağacı boş', 'Komple mamul veya alt montaj için tanımlı kartları ana mamulün BOM alanına sürükleyin.');
    return false;
  }
  return true;
}
function goToWizardStep(step) {
  const target = Number(step);
  if (target === 2 && (!partNumber.value.trim() || !internalProductCode.value.trim() || !partName.value.trim() || (isCustomProductType() && !customProductTypeName.value.trim()))) {
    toast('Zorunlu mamul ana verisi eksik', 'OEM No, kuruluş içi ürün/stok kodu, mamul adı ve seçildiyse özel ürün tipi adını tamamlayın.');
    return;
  }
  if (target >= 3 && !validateProductDefinitionBasics()) {
    return;
  }
  if (target >= 4) {
    const readiness = globalThis.TyanaProductDefinition?.workPlanReadiness();
    if (readiness?.required && readiness.missing.length) {
      goToWizardStep(3);
      globalThis.TyanaProductDefinition?.selectWorkPlanMaster(readiness.missing[0].id);
      toast('İş planı eksik', `${readiness.missing[0].name} için en az bir operasyon ve her operasyonda makine seçimi gereklidir.`);
      return;
    }
  }
  if (target === 5 && !validateCharacteristics()) {
    toast('Teknik değer kontrolü gerekli', 'Boş veya geçersiz sayısal değerleri düzeltin.');
    return;
  }
  if (target <= 3) {
    showView(target === 1 ? 'product' : target === 2 ? 'bom' : 'workplan');
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
  if (target === 3) globalThis.TyanaProductDefinition?.renderWorkPlanStudio();
  document.querySelector('.wizard-steps').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.querySelectorAll('[data-next-step]').forEach(btn => btn.addEventListener('click', () => goToWizardStep(btn.dataset.nextStep)));
document.querySelectorAll('[data-prev-step]').forEach(btn => btn.addEventListener('click', () => goToWizardStep(btn.dataset.prevStep)));
document.querySelectorAll('.wizard-step').forEach(btn => btn.addEventListener('click', () => goToWizardStep(btn.dataset.wizardStep)));
document.querySelectorAll('[data-product-jump]').forEach(button => button.addEventListener('click', () => {
  goToWizardStep(button.dataset.productJump);
  if (Number(button.dataset.productJump) === 2 && currentWizardStep === 2 && button.dataset.productStage) setEngineeringBomStage(button.dataset.productStage);
}));
document.querySelector('[data-product-upgrade-action="auto-codes"]')?.addEventListener('click', completeProductDocumentCodes);
document.querySelector('[data-product-upgrade-action="audit"]')?.addEventListener('click', () => renderProductUpgradeCockpit({ announce: true }));

document.querySelectorAll('.choice-card').forEach(card => card.addEventListener('click', () => {
  document.querySelectorAll(`input[name="${card.querySelector('input').name}"]`).forEach(input => input.closest('.choice-card')?.classList.remove('selected'));
  card.classList.add('selected');
}));

document.querySelectorAll('.segmented label').forEach(label => label.addEventListener('click', () => {
  label.closest('.segmented').querySelectorAll('label').forEach(item => item.classList.remove('active'));
  label.classList.add('active');
  setTimeout(updateSummary, 0);
}));

// Product-group and component-aware engineering question engine.
function engineeringLabel(item, fallback = 'Tanımlanacak') {
  return item?.labels?.['tr-TR'] || item?.titleTR || item?.nameTR || fallback;
}

function engineeringValueSet(id) {
  return productEngineeringLibrary?.valueSets?.find(item => item.id === id) || null;
}

function engineeringOptionId(valueSetId, value) {
  const normalized = String(value || '').trim().toLocaleLowerCase('tr-TR');
  if (!normalized) return '';
  const options = engineeringValueSet(valueSetId)?.options || [];
  const exact = options.find(option => option.id === value || engineeringLabel(option, '').toLocaleLowerCase('tr-TR') === normalized);
  if (exact) return exact.id;
  const partial = options.find(option => {
    const label = engineeringLabel(option, '').toLocaleLowerCase('tr-TR');
    return label.includes(normalized) || normalized.includes(label.split(' / ')[0]) || normalized.includes(label.split(' — ')[0]);
  });
  return partial?.id || '';
}

function componentMethodId(component) {
  const text = `${component?.primaryManufacturingMethod || ''} ${component?.upstreamMethod || ''}`.toLocaleLowerCase('tr-TR');
  if (text.includes('talaşlı')) return 'machining';
  if (text.includes('sıcak dövme')) return 'hot-forging';
  if (text.includes('soğuk dövme')) return 'cold-forging';
  if (text.includes('döküm')) return 'casting';
  if (text.includes('boru') || text.includes('profil')) return 'tube-forming';
  if (text.includes('pres') || text.includes('bükme')) return 'sheet-forming';
  if (text.includes('kaynak') || text.includes('lehim')) return 'welding';
  if (text.includes('plastik')) return 'plastic-injection';
  if (text.includes('elastomer')) return 'rubber-molding';
  if (text.includes('elektrik')) return 'electrical-assembly';
  if (text.includes('montaj')) return 'mechanical-assembly';
  if (text.includes('paket')) return 'packaging';
  if (text.includes('kesme')) return 'cutting';
  if (text.includes('satın')) return 'purchased-as-is';
  return engineeringOptionId('vs.manufacturing-method', component?.primaryManufacturingMethod) || 'custom';
}

function componentStageId(component, field = 'output') {
  const text = String(field === 'input' ? component?.inputState : component?.outputState || '').toLocaleLowerCase('tr-TR');
  if (text.includes('hammadde')) return 'raw-material';
  if (text.includes('dövme') || text.includes('döküm') || text.includes('taslak') || text.includes('şekillendirilmiş')) return 'blank';
  if (text.includes('kaba')) return 'rough-machined';
  if (text.includes('işlenmiş')) return 'finished-machined';
  if (text.includes('ısıl')) return 'heat-treated';
  if (text.includes('kaplanmış')) return 'surface-treated';
  if (text.includes('montaj')) return 'assembled';
  if (text.includes('nihai')) return 'finished-good';
  if (text.includes('satın')) return 'purchased';
  return engineeringOptionId('vs.manufacturing-stage', field === 'input' ? component?.inputState : component?.outputState);
}

function componentRawFormId(component) {
  return engineeringOptionId('vs.raw-form', component?.rawMaterialForm)
    || ({ 'Dövme taslağı': 'forged-blank', Döküm: 'cast-blank', Boru: 'tube', Çubuk: 'bar', Sac: 'sheet', Profil: 'profile', 'Kalıplanmış parça': 'molded-part', 'Standart parça': 'standard-part' }[component?.rawMaterialForm] || 'custom');
}

function currentEngineeringGroup() {
  const current = productGroup.value;
  return productEngineeringLibrary?.productGroups?.find(group => group.id === current || (group.legacyAliases || []).includes(current))
    || productEngineeringLibrary?.productGroups?.find(group => group.id === 'custom-product');
}

function engineeringAnswerBucket(scopeId) {
  if (!engineeringAnswers[scopeId]) engineeringAnswers[scopeId] = {};
  return engineeringAnswers[scopeId];
}

function bomQuestionRows() {
  return globalThis.TyanaBom.flatten(components, partName.value || 'Ana mamul').map(row => ({ componentId: row.id, level: row.level, position: row.position, itemNo: row.itemNo, name: row.name, parentId: row.parentId, quantity: row.quantity, uom: row.uom, path: row.path }));
}

function mappedEngineeringValue(scopeId, question) {
  if (scopeId === 'FINISHED_GOOD') {
    const map = {
      'q.product.group': productGroup.value, 'q.product.type': productType.value, 'q.product.structure': document.getElementById('productStructureType').value,
      'q.product.part-number': partNumber.value, 'q.product.part-name': partName.value, 'q.product.project-code': projectCode.value,
      'q.product.production-phase': engineeringOptionId('vs.production-phase', document.getElementById('productionPhase').value), 'q.product.annual-volume': document.getElementById('annualVolume').value,
      'q.product.drawing-number': document.getElementById('drawingNumber').value, 'q.product.drawing-revision': drawingRevision.value,
      'q.product.drawing-source': drawingSource.name, 'q.product.drawing-unit': 'mm', 'q.product.customer-specific-requirements': document.getElementById('customerSpecificRequirements').value,
      'q.product.product-safety': document.querySelector('input[name="safety"]:checked')?.value === 'yes' ? 'yes' : document.querySelector('input[name="safety"]:checked')?.value === 'no' ? 'no' : 'unknown',
      'q.bom.items': bomQuestionRows()
    };
    return map[question.id] ?? '';
  }
  const component = components.find(item => item.id === scopeId);
  if (!component) return '';
  const map = {
    'q.component.stage': componentStageId(component), 'q.component.primary-method': componentMethodId(component), 'q.component.input-stage': componentStageId(component, 'input'),
    'q.component.raw-form': componentRawFormId(component), 'q.component.outsourced': component.makeBuy === 'Fason proses' ? 'yes' : 'no',
    'q.component.special-process': ['Uygulanmıyor', 'Teknik resme göre'].includes(component.heatTreatment) ? 'unknown' : 'yes',
    'q.material.family': engineeringOptionId('vs.material-family', component.materialFamily), 'q.material.grade': component.materialGrade, 'q.material.standard': component.materialStandard,
    'q.material.certificate': component.certificate, 'q.material.source-lot': component.traceability,
    'q.heat.type': engineeringOptionId('vs.heat-treatment', component.heatTreatment), 'q.coating.type': engineeringOptionId('vs.coating-type', component.coatingType),
    'q.coating.standard': component.coatingSpec
  };
  return map[question.id] ?? '';
}

function engineeringAnswer(scopeId, question) {
  const bucket = engineeringAnswerBucket(scopeId);
  if (scopeId === 'FINISHED_GOOD' && question.id === 'q.bom.items') {
    bucket[question.id] = { questionId: question.id, value: bomQuestionRows(), source: 'bom-master', verificationStatus: validateComponents({ strict: false }) ? 'derived-valid' : 'derived-with-findings', unit: '' };
    return bucket[question.id];
  }
  if (!bucket[question.id]) bucket[question.id] = {
    questionId: question.id, value: mappedEngineeringValue(scopeId, question), source: 'user-entry', verificationStatus: 'pending', unit: question.numeric?.unit || question.tolerance?.unit || ''
  };
  return bucket[question.id];
}

function engineeringQuestionCategory(setId) {
  if (/identity|drawing/.test(setId)) return 'identity';
  if (/material/.test(setId)) return 'material';
  if (/classification|manufacturing|assembly/.test(setId)) return 'manufacturing';
  if (/heat|coating|group/.test(setId)) return 'special';
  return 'control';
}

function engineeringQuestionSets(scopeId) {
  if (!productEngineeringLibrary) return [];
  const ids = [];
  if (scopeId === 'FINISHED_GOOD') {
    ids.push(...(currentEngineeringGroup()?.fixedQuestionSetIds || ['qs.product.identity', 'qs.product.traceability']));
    if (['assembly', 'subassembly', 'service_kit'].includes(document.getElementById('productStructureType').value)) ids.push('qs.product.assembly');
  } else {
    const component = components.find(item => item.id === scopeId);
    ids.push('qs.component.classification', 'qs.component.material', 'qs.drawing.characteristics');
    const method = componentMethodId(component);
    if (['hot-forging', 'cold-forging'].includes(method) || componentRawFormId(component) === 'forged-blank') ids.push('qs.manufacturing.forging');
    if (method === 'machining' || component?.primaryManufacturingMethod?.includes('Talaşlı')) ids.push('qs.manufacturing.machining');
    if (method === 'casting' || componentRawFormId(component) === 'cast-blank') ids.push('qs.manufacturing.casting');
    if (['sheet-forming', 'tube-forming', 'welding', 'cold-forming'].includes(method)) ids.push('qs.manufacturing.sheet-weld');
    if (['plastic-injection', 'rubber-molding', 'extrusion'].includes(method)) ids.push('qs.manufacturing.polymer');
    if (component && component.heatTreatment && component.heatTreatment !== 'Uygulanmıyor') ids.push('qs.component.heat-treatment');
    if (component && component.coatingType && !['Uygulanmıyor', 'Kaplama yok'].includes(component.coatingType)) ids.push('qs.component.coating');
  }
  const unique = [...new Set(ids)];
  return unique.map(id => productEngineeringLibrary.questionSets.find(set => set.id === id)).filter(Boolean);
}

function engineeringSelectOptions(question, selectedValue = '') {
  const options = question.inlineOptions?.map(value => ({ id: value, labels: { 'tr-TR': value } })) || engineeringValueSet(question.valueSet)?.options || [];
  return `<option value="">Seçiniz…</option>` + options.map(option => `<option value="${escapeHtml(option.id)}" ${String(selectedValue) === String(option.id) ? 'selected' : ''}>${escapeHtml(engineeringLabel(option, option.id))}</option>`).join('') + (question.allowCreate ? '<option value="__custom__">＋ Kullanıcı tanımlı değer</option>' : '');
}

function engineeringUnitOptions(question, selected = '') {
  const units = question.numeric?.unitSelectable || (question.numeric?.unit ? [question.numeric.unit] : question.tolerance?.unitSelectable || (question.tolerance?.unit ? [question.tolerance.unit] : []));
  const values = [...new Set([selected, ...units].filter(Boolean))];
  return values.length > 1 ? `<select class="unit-select" data-engineering-unit>${values.map(unit => `<option ${unit === selected ? 'selected' : ''}>${escapeHtml(unit)}</option>`).join('')}</select>` : values.length ? `<span class="engineering-unit">${escapeHtml(values[0])}</span>` : '';
}

function engineeringRepeatField(field, value, index) {
  const common = `data-engineering-repeat-index="${index}" data-engineering-repeat-field="${escapeHtml(field.id)}"`;
  if (field.type === 'select') return `<label>${escapeHtml(engineeringLabel(field, field.id))}<select ${common}>${engineeringSelectOptions(field, value)}</select></label>`;
  if (field.type === 'textarea') return `<label>${escapeHtml(engineeringLabel(field, field.id))}<textarea ${common} rows="2">${escapeHtml(value || '')}</textarea></label>`;
  return `<label>${escapeHtml(engineeringLabel(field, field.id))}<input ${common} type="${field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}" value="${escapeHtml(value || '')}"></label>`;
}

function engineeringInput(question, answer) {
  const value = answer.value;
  if (question.id === 'q.bom.items') {
    const rows = Array.isArray(value) ? value : [];
    return `<div class="bom-derived-answer"><div><b>Tek veri kaynağı: Mamul ağacı</b><small>Bu liste burada düzenlenmez; Aşama 2'deki BOM değiştikçe otomatik güncellenir.</small></div>${rows.length ? rows.map(row => `<span><mark>L${escapeHtml(row.level)}</mark><b>${escapeHtml(row.position)} • ${escapeHtml(row.itemNo)} • ${escapeHtml(row.name)}</b><small>${escapeHtml(row.path)} • ${escapeHtml(formatValue(row.quantity))} ${escapeHtml(row.uom)}</small></span>`).join('') : '<p>Henüz BOM kalemi yok.</p>'}</div>`;
  }
  if (question.type === 'select' || question.type === 'boolean') return `<select data-engineering-value>${engineeringSelectOptions(question, value)}</select>`;
  if (question.type === 'multi_select') {
    const selectedValues = Array.isArray(value) ? value : [];
    const options = engineeringValueSet(question.valueSet)?.options || [];
    return `<div class="multi-answer">${options.map(option => `<label><input type="checkbox" data-engineering-multi value="${escapeHtml(option.id)}" ${selectedValues.includes(option.id) ? 'checked' : ''}><span>${escapeHtml(engineeringLabel(option, option.id))}</span></label>`).join('')}</div>`;
  }
  if (question.type === 'number_range') {
    const range = value && typeof value === 'object' ? value : {};
    return `<div class="answer-control range-control"><input data-engineering-range="min" type="number" step="any" placeholder="Alt / min." value="${escapeHtml(range.min ?? '')}"><input data-engineering-range="max" type="number" step="any" placeholder="Üst / max." value="${escapeHtml(range.max ?? '')}">${engineeringUnitOptions(question, answer.unit)}</div>`;
  }
  if (question.type === 'tolerance') {
    const tolerance = value && typeof value === 'object' ? value : {};
    return `<div class="answer-control tolerance-control"><input data-engineering-range="nominal" type="number" step="any" placeholder="Nominal" value="${escapeHtml(tolerance.nominal ?? '')}"><input data-engineering-range="lower" type="number" step="any" placeholder="- tolerans" value="${escapeHtml(tolerance.lower ?? '')}"><input data-engineering-range="upper" type="number" step="any" placeholder="+ tolerans" value="${escapeHtml(tolerance.upper ?? '')}">${engineeringUnitOptions(question, answer.unit)}</div>`;
  }
  if (question.type === 'repeating_group') {
    const rows = Array.isArray(value) ? value : [];
    const fields = question.fields?.length ? question.fields : [{ id: 'value', labels: { 'tr-TR': 'Teknik kayıt' }, type: 'text' }];
    return `<div class="engineering-repeat">${rows.map((row, index) => `<div class="engineering-repeat-row">${fields.map(field => engineeringRepeatField(field, row?.[field.id], index)).join('')}<button type="button" data-engineering-repeat-remove="${index}" aria-label="Satırı kaldır">×</button></div>`).join('')}<button type="button" class="repeat-add" data-engineering-repeat-add>＋ Teknik Satır Ekle</button></div>`;
  }
  if (question.type === 'file_reference') return `<div class="answer-control"><input data-engineering-value value="${escapeHtml(value || drawingSource.name || '')}" readonly><span class="file-answer-state">SHA-256 kaynak kaydı</span></div>`;
  if (question.type === 'entity_reference' && question.entity === 'component') {
    return `<select data-engineering-value><option value="">Seçiniz…</option>${components.map(component => `<option value="${escapeHtml(component.id)}" ${component.id === value ? 'selected' : ''}>${escapeHtml(component.position)} • ${escapeHtml(component.name)}</option>`).join('')}</select>`;
  }
  if (question.type === 'textarea') return `<textarea data-engineering-value rows="3">${escapeHtml(value || '')}</textarea>`;
  return `<div class="answer-control"><input data-engineering-value type="${question.type === 'number' ? 'number' : question.type === 'date' ? 'date' : 'text'}" ${question.type === 'number' ? 'step="any"' : ''} value="${escapeHtml(value ?? '')}">${question.type === 'number' ? engineeringUnitOptions(question, answer.unit) : ''}</div>`;
}

function engineeringAnswerFilled(answer) {
  const value = answer?.value;
  if (Array.isArray(value)) return value.length > 0 && value.some(item => typeof item === 'object' ? Object.values(item).some(Boolean) : Boolean(item));
  if (value && typeof value === 'object') return Object.values(value).some(item => item !== '' && item !== null && item !== undefined);
  return value !== '' && value !== null && value !== undefined;
}

function renderEngineeringScopeOptions() {
  const select = document.getElementById('engineeringScope'); if (!select) return;
  const current = select.value || 'FINISHED_GOOD';
  select.innerHTML = `<option value="FINISHED_GOOD">Ana mamul • ${escapeHtml(partName.value || 'Yeni mamul')}</option>` + components.map(component => `<option value="${escapeHtml(component.id)}">${escapeHtml(component.position)} • ${escapeHtml(component.name)} • ${escapeHtml(component.outputState)}</option>`).join('');
  select.value = current === 'FINISHED_GOOD' || components.some(component => component.id === current) ? current : 'FINISHED_GOOD';
}

function renderEngineeringQuestions() {
  const container = document.getElementById('engineeringQuestionRows'); if (!container) return;
  renderEngineeringScopeOptions();
  if (!productEngineeringLibrary) { container.innerHTML = '<div class="question-engine-loading">Mühendislik kütüphanesi yükleniyor…</div>'; return; }
  const scopeId = document.getElementById('engineeringScope').value || 'FINISHED_GOOD';
  const filter = document.getElementById('engineeringQuestionFilter').value || 'all';
  const sets = engineeringQuestionSets(scopeId).filter(set => filter === 'all' || engineeringQuestionCategory(set.id) === filter);
  const standardQuestions = sets.flatMap(set => set.questions.map(question => ({ ...question, setId: set.id, setTitle: engineeringLabel(set, set.id) })));
  const deduplicated = [...new Map(standardQuestions.map(question => [question.id, question])).values()];
  const customQuestions = engineeringCustomQuestions.filter(question => question.scopeId === scopeId).map(question => ({ ...question, setId: 'custom', setTitle: 'Kullanıcı Tanımlı Sorular', custom: true, labels: { 'tr-TR': question.label } }));
  const questions = [...deduplicated, ...customQuestions];
  const sourceOptions = (productEngineeringLibrary.contracts?.sourceHierarchy || ['user-entry']).map(source => `<option value="${escapeHtml(source)}">${escapeHtml(source.replaceAll('-', ' '))}</option>`).join('');
  container.innerHTML = questions.length ? questions.map(question => {
    const answer = engineeringAnswer(scopeId, question); const invalid = question.required && !engineeringAnswerFilled(answer);
    const label = engineeringLabel(question, question.id); const help = question.help?.['tr-TR'] || `${question.setTitle} • ${question.type.replaceAll('_', ' ')}`;
    return `<article class="engineering-question-card ${question.required ? 'required' : ''} ${invalid ? 'invalid' : ''}" data-engineering-question="${escapeHtml(question.id)}" data-engineering-scope="${escapeHtml(scopeId)}"><div class="question-copy"><span class="question-code">${escapeHtml(question.id)}${question.required ? ' • ZORUNLU' : ''}</span>${question.custom ? `<input class="custom-question-label" data-custom-question-label value="${escapeHtml(label)}">` : `<b>${escapeHtml(label)}</b>`}<small>${escapeHtml(help)}</small></div><div>${engineeringInput(question, answer)}</div><div class="question-actions"><select data-engineering-meta="source" title="Kaynak">${sourceOptions}</select><select data-engineering-meta="verificationStatus" title="Doğrulama"><option value="pending">Doğrulama bekliyor</option><option value="drawing-verified">Teknik resimle doğrulandı</option><option value="engineering-approved">Mühendislik onaylı</option><option value="not-applicable">Uygulanamaz</option></select>${question.custom ? `<select data-custom-question-type title="Yanıt tipi"><option value="text" ${question.type === 'text' ? 'selected' : ''}>Metin</option><option value="textarea" ${question.type === 'textarea' ? 'selected' : ''}>Uzun metin</option><option value="number" ${question.type === 'number' ? 'selected' : ''}>Sayısal</option><option value="date" ${question.type === 'date' ? 'selected' : ''}>Tarih</option></select><button type="button" class="danger" data-remove-engineering-question>Özel soruyu kaldır</button>` : ''}</div></article>`;
  }).join('') : '<div class="question-engine-loading">Bu kapsam ve filtre için soru bulunamadı. Özel soru ekleyebilirsiniz.</div>';
  container.querySelectorAll('[data-engineering-question]').forEach(card => {
    const questionId = card.dataset.engineeringQuestion; const question = questions.find(item => item.id === questionId); const answer = engineeringAnswer(scopeId, question);
    card.querySelector('[data-engineering-meta="source"]')?.setAttribute('data-selected', answer.source || 'user-entry');
    const source = card.querySelector('[data-engineering-meta="source"]'); if (source) source.value = answer.source || 'user-entry';
    const verification = card.querySelector('[data-engineering-meta="verificationStatus"]'); if (verification) verification.value = answer.verificationStatus || 'pending';
  });
  bindEngineeringQuestionEvents(questions, scopeId);
  const required = questions.filter(question => question.required); const answered = questions.filter(question => engineeringAnswerFilled(engineeringAnswer(scopeId, question)));
  document.getElementById('engineeringAnsweredCount').textContent = answered.length;
  document.getElementById('engineeringRequiredCount').textContent = `${required.filter(question => engineeringAnswerFilled(engineeringAnswer(scopeId, question))).length}/${required.length}`;
  document.getElementById('engineeringRouteCount').textContent = engineeringRecommendedRoute().length;
}

function bindEngineeringQuestionEvents(questions, scopeId) {
  const container = document.getElementById('engineeringQuestionRows');
  const locate = target => {
    const card = target.closest('[data-engineering-question]');
    const question = questions.find(item => item.id === card?.dataset.engineeringQuestion);
    return { card, question, answer: question ? engineeringAnswer(scopeId, question) : null };
  };
  const changed = (card, question, answer) => {
    card?.classList.toggle('invalid', Boolean(question?.required && !engineeringAnswerFilled(answer)));
    markDraftDirty(); updateSummary();
  };
  container.querySelectorAll('[data-engineering-value]').forEach(input => {
    const update = event => { const { card, question, answer } = locate(event.target); answer.value = event.target.value; changed(card, question, answer); };
    input.addEventListener('input', update); input.addEventListener('change', event => { update(event); renderEngineeringQuestions(); });
  });
  container.querySelectorAll('[data-engineering-multi]').forEach(input => input.addEventListener('change', event => {
    const { card, question, answer } = locate(event.target); answer.value = [...card.querySelectorAll('[data-engineering-multi]:checked')].map(item => item.value); changed(card, question, answer); renderEngineeringQuestions();
  }));
  container.querySelectorAll('[data-engineering-range]').forEach(input => {
    const update = event => { const { card, question, answer } = locate(event.target); if (!answer.value || typeof answer.value !== 'object' || Array.isArray(answer.value)) answer.value = {}; answer.value[event.target.dataset.engineeringRange] = event.target.value; changed(card, question, answer); };
    input.addEventListener('input', update); input.addEventListener('change', update);
  });
  container.querySelectorAll('[data-engineering-unit]').forEach(select => select.addEventListener('change', event => { const { card, question, answer } = locate(event.target); answer.unit = event.target.value; changed(card, question, answer); }));
  container.querySelectorAll('[data-engineering-meta]').forEach(select => select.addEventListener('change', event => { const { card, question, answer } = locate(event.target); answer[event.target.dataset.engineeringMeta] = event.target.value; changed(card, question, answer); }));
  container.querySelectorAll('[data-engineering-repeat-add]').forEach(button => button.addEventListener('click', event => {
    const { question, answer } = locate(event.target); if (!Array.isArray(answer.value)) answer.value = []; answer.value.push(Object.fromEntries((question.fields || [{ id: 'value' }]).map(field => [field.id, '']))); markDraftDirty(); renderEngineeringQuestions();
  }));
  container.querySelectorAll('[data-engineering-repeat-remove]').forEach(button => button.addEventListener('click', event => {
    const { answer } = locate(event.target); if (Array.isArray(answer.value)) answer.value.splice(Number(event.target.dataset.engineeringRepeatRemove), 1); markDraftDirty(); renderEngineeringQuestions();
  }));
  container.querySelectorAll('[data-engineering-repeat-field]').forEach(input => {
    const update = event => { const { card, question, answer } = locate(event.target); if (!Array.isArray(answer.value)) answer.value = []; const index = Number(event.target.dataset.engineeringRepeatIndex); if (!answer.value[index]) answer.value[index] = {}; answer.value[index][event.target.dataset.engineeringRepeatField] = event.target.value; changed(card, question, answer); };
    input.addEventListener('input', update); input.addEventListener('change', update);
  });
  container.querySelectorAll('[data-custom-question-label]').forEach(input => input.addEventListener('change', event => {
    const card = event.target.closest('[data-engineering-question]'); const item = engineeringCustomQuestions.find(question => question.id === card.dataset.engineeringQuestion); if (item) item.label = event.target.value.trim() || 'Özel teknik soru'; markDraftDirty(); renderEngineeringQuestions();
  }));
  container.querySelectorAll('[data-custom-question-type]').forEach(select => select.addEventListener('change', event => {
    const card = event.target.closest('[data-engineering-question]'); const item = engineeringCustomQuestions.find(question => question.id === card.dataset.engineeringQuestion); if (item) item.type = event.target.value; const answer = engineeringAnswerBucket(scopeId)[card.dataset.engineeringQuestion]; if (answer) answer.value = ''; markDraftDirty(); renderEngineeringQuestions();
  }));
  container.querySelectorAll('[data-remove-engineering-question]').forEach(button => button.addEventListener('click', event => {
    const card = event.target.closest('[data-engineering-question]'); engineeringCustomQuestions = engineeringCustomQuestions.filter(question => question.id !== card.dataset.engineeringQuestion); delete engineeringAnswerBucket(scopeId)[card.dataset.engineeringQuestion]; markDraftDirty(); renderEngineeringQuestions();
  }));
}

const engineeringMethodRouteMap = {
  'purchased-as-is': ['incoming', 'storage'], cutting: ['incoming', 'storage', 'cutting'], 'hot-forging': ['cutting', 'billet-heating', 'forging', 'shotblast', 'ndt'], 'cold-forging': ['cutting', 'forging', 'ndt'], 'cold-forming': ['cutting', 'stamping'],
  casting: ['incoming', 'casting', 'shotblast', 'ndt'], machining: ['incoming', 'cnc', 'milling', 'drilling', 'thread', 'deburring', 'grinding', 'washing'], 'sheet-forming': ['incoming', 'cutting', 'stamping'], 'tube-forming': ['incoming', 'cutting', 'tube-forming'],
  welding: ['incoming', 'cutting', 'stamping', 'welding', 'washing'], 'plastic-injection': ['incoming', 'plastic-injection'], 'rubber-molding': ['incoming', 'rubber-molding'], 'electrical-assembly': ['incoming', 'adhesive', 'assembly'],
  'mechanical-assembly': ['incoming', 'assembly', 'integrated-assembly', 'torque'], packaging: ['packing'], custom: []
};

function engineeringRecommendedRoute() {
  const requested = ['incoming'];
  components.forEach(component => {
    const answerMethod = engineeringAnswers[component.id]?.['q.component.primary-method']?.value || componentMethodId(component);
    const upstream = componentMethodId({ primaryManufacturingMethod: component.upstreamMethod });
    requested.push(...(engineeringMethodRouteMap[upstream] || []), ...(engineeringMethodRouteMap[answerMethod] || []));
    if (component.heatTreatment && component.heatTreatment !== 'Uygulanmıyor') requested.push(component.heatTreatment.includes('İndüksiyon') ? 'induction' : 'furnace-heat');
    if (component.coatingType && !['Uygulanmıyor', 'Kaplama yok'].includes(component.coatingType)) requested.push(/boya|kataforez/i.test(component.coatingType) ? 'painting' : 'coating');
  });
  const structure = document.getElementById('productStructureType').value;
  if (structure === 'assembly') requested.push('assembly', 'integrated-assembly', 'post-paint-assembly', 'torque');
  if (structure === 'subassembly') requested.push('final', 'marking', 'storage');
  else if (structure === 'service_kit') requested.push('storage', 'final', 'marking', 'packing');
  else requested.push('final', 'marking', 'packing');
  const available = new Set(processes.filter(process => process.status !== 'archived').map(process => process.id));
  const unique = [...new Set(requested)].filter(id => available.has(id));
  const order = [...new Set([...defaultRouteForProductContext(), ...processes.map(process => process.id)])];
  return unique.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

Object.defineProperty(globalThis, 'TyanaProductRoutingContext', {
  configurable: false,
  enumerable: true,
  writable: false,
  value: Object.freeze({
    recommendedProcessIds: () => [...engineeringRecommendedRoute()],
    defaultProcessIds: () => [...defaultRouteForProductContext()]
  })
});

async function loadEngineeringLibraries() {
  try {
    const [productLibrary, pfmeaLibrary, bomLibrary, qualityLibrary, operationLibrary] = await Promise.all([
      globalThis.TyanaPlatform.loadJsonAsset('product-engineering'),
      globalThis.TyanaPlatform.loadJsonAsset('pfmea-engineering'),
      globalThis.TyanaPlatform.loadJsonAsset('bom-engineering'),
      globalThis.TyanaPlatform.loadJsonAsset('quality-document'),
      globalThis.TyanaPlatform.loadJsonAsset('operation-code')
    ]);
    if (!Array.isArray(productLibrary.questionSets) || !Array.isArray(productLibrary.productGroups) || !Array.isArray(pfmeaLibrary.riskTemplates) || !Array.isArray(bomLibrary.catalog) || !Array.isArray(bomLibrary.templates) || !Array.isArray(qualityLibrary.sourceControlPlans) || !Array.isArray(qualityLibrary.instructionPresets) || !Array.isArray(qualityLibrary.operationPresets) || !Array.isArray(qualityLibrary.validationRules) || !Array.isArray(operationLibrary.operations) || operationLibrary.operations.length < 1) throw new Error('Mühendislik kütüphanesi şeması geçersiz.');
    if (qualityLibrary.productName !== 'TYANA Q-FLOW' || !qualityLibrary.organization?.shortName) throw new Error('Kurumsal profil kimliği geçersiz.');
    productEngineeringLibrary = productLibrary; pfmeaEngineeringLibrary = pfmeaLibrary; bomEngineeringLibrary = bomLibrary; qualityDocumentLibrary = qualityLibrary; operationCodeLibrary = operationLibrary;
    Object.values(routeDetails).forEach(detail => { if (detail.operationCode) bindOperationCodeMetadata(detail, detail.operationCode); });
    ensureOperationCodeOptions(); ensureOperationMachineOptions(); globalThis.TyanaProductDefinition?.loadMachineLibrary(); renderOperationCodeCatalog(); renderSequence();
    applyTenantProfile(); renderEngineeringQuestions(); renderPfmeaLibrarySelectors(); renderBomLibraryPickers(); renderSourceIntegrationStudio();
  } catch (error) {
    const container = document.getElementById('engineeringQuestionRows'); if (container) container.innerHTML = `<div class="question-engine-loading">Kütüphane açılamadı: ${escapeHtml(error.message)}</div>`;
    const tenantState = document.getElementById('tenantLibraryState'); if (tenantState) tenantState.textContent = `Kurumsal kütüphane açılamadı: ${error.message}`;
    toast('Mühendislik kütüphanesi yüklenemedi', error.message);
  }
}

document.getElementById('engineeringScope')?.addEventListener('change', renderEngineeringQuestions);
document.getElementById('engineeringQuestionFilter')?.addEventListener('change', renderEngineeringQuestions);
document.querySelector('[data-action="add-engineering-question"]')?.addEventListener('click', () => {
  const scopeId = document.getElementById('engineeringScope').value || 'FINISHED_GOOD';
  engineeringCustomQuestions.push({ id: `q.custom.${crypto.randomUUID()}`, scopeId, label: 'Yeni özel teknik soru', type: 'text', required: false });
  renderEngineeringQuestions(); markDraftDirty();
});
document.querySelector('[data-action="apply-engineering-route"]')?.addEventListener('click', () => {
  const recommendation = engineeringRecommendedRoute();
  if (!recommendation.length) { toast('Rota önerisi oluşturulamadı', 'Bileşen üretim yöntemlerini ve aktif proses kütüphanesini kontrol edin.'); return; }
  selected = [...recommendation]; routeDetails = Object.fromEntries(Object.entries(routeDetails).filter(([key]) => selected.includes(key)));
  renderOptions(document.querySelector('.library-search input')?.value || ''); renderSequence();
  toast('Bileşen bazlı rota uygulandı', `${recommendation.length} operasyon; taslak, dönüşüm, özel proses, montaj ve final kontrol bağlamı birleştirildi.`); markDraftDirty();
});

// Technical drawing characteristics — stable IDs feed PFD → PFMEA → CP → work instruction.
const characteristicProcessMap = [
  ['incoming', 'Girdi Kontrol'], ['cutting', 'Çubuk Kesme'], ['forging', 'Sıcak Dövme'],
  ['shotblast', 'Kumlama'], ['cnc', 'CNC Tornalama'], ['thread', 'Diş Açma'],
  ['induction', 'İndüksiyon'], ['washing', 'Endüstriyel Yıkama'], ['coating', 'Yüzey Kaplama'], ['assembly', 'Montaj'], ['integrated-assembly', 'Entegre Tesis Montaj Prosesi'], ['post-paint-assembly', 'Boya Sonrası Montaj'],
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
  const id = overrides.id || `CHAR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  return {
    id, libraryCode: 'CUSTOM', componentId: 'FINISHED_GOOD', balloon: '1', name: 'Yeni karakteristik', definition: 'Karakteristiğin fonksiyonel tanımını girin',
    sourceDrawing: document.getElementById('drawingNumber')?.value || 'Teknik resim', sourceZone: 'Sayfa / bölge girin', sourceStatus: 'Kullanıcı doğrulaması gerekli', sourceValidationStatus: 'pending', sourceVerificationStatus: 'user-entry', sourceWarningCodes: [], sourceValidationNote: '',
    kind: 'Ürün', specMode: 'numeric', nominal: 0, minus: 0, plus: 0, specText: '', unit: 'mm', precision: '0,01', classification: 'Normal', processId: 'final', routeKey: '',
    method: 'Değişken ölçüm', equipmentClass: 'Ölçüm cihazı sınıfı seçin', equipment: 'Cihaz / asset ID girin', resolution: 'Tanımlanacak', calibrationDue: '', msaReference: 'MSA çalışması gerekli', msaStatus: 'Doğrulama bekliyor', msaRationale: '',
    sampleSize: '1', frequency: 'Vardiyada', trigger: 'İlk parça + tanımlı periyot', pokaYoke: '—', alternateControl: 'Uygulanmıyor', reference: 'Kayıt formu tanımlayın', reaction: 'RP-01', controlPlanIncluded: true, controlPlanRowId: id, ...overrides, id
  };
}

let drawingSource = { name: '', size: 0, type: '', lastModified: null, sha256: '' };
let characteristics = [
  newCharacteristic({ id: 'CHAR-001', balloon: '1', name: 'Yeni karakteristik', definition: 'Teknik resimden ölçü, tolerans, sınıf, yöntem ve kontrol sıklığı girilecek', componentId: 'FINISHED_GOOD', processId: 'final', sourceDrawing: '', sourceZone: '', sourceStatus: 'Teknik resim kaynağı bekleniyor' })
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
      <label>Teknik karar<select data-field="sourceValidationStatus"><option value="pending" ${item.sourceValidationStatus === 'pending' ? 'selected' : ''}>Doğrulama bekliyor</option><option value="drawing-verified" ${item.sourceValidationStatus === 'drawing-verified' ? 'selected' : ''}>Teknik resimle doğrulandı</option><option value="engineering-approved" ${item.sourceValidationStatus === 'engineering-approved' ? 'selected' : ''}>Mühendislik onaylı</option><option value="rejected" ${item.sourceValidationStatus === 'rejected' ? 'selected' : ''}>Reddedildi / revizyon gerekli</option></select></label>
      <label class="span-2">Karakteristik tanımı<input data-field="definition" value="${escapeHtml(item.definition || '')}"></label>
    </div>${characteristicSourceWarnings(item).length ? `<div class="characteristic-source-warnings">${characteristicSourceWarnings(item).map(({ code, rule }) => `<span class="${blockingValidationRule(rule) ? 'blocking' : 'warning'}"><b>${escapeHtml(code)}</b>${escapeHtml(recordLabel(rule, 'Kaynak doğrulaması gerekli'))}</span>`).join('')}</div>` : ''}</div>
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

function markGeneratedDocumentsStale(reason = 'Kaynak ürün, BOM, proses veya kalite verisi çıktıdan sonra değiştirildi.') {
  const staleAt = new Date().toISOString();
  generatedDocumentRecords.forEach(file => { if (!file.staleAt) { file.staleAt = staleAt; file.staleReason = reason; } });
  Object.values(ppapRecords).forEach(record => (record?.files || []).forEach(file => { if (file.source === 'generated' && !file.staleAt) { file.staleAt = staleAt; file.staleReason = reason; } }));
}

function markDraftDirty(options = {}) {
  if (options.affectsDocuments !== false) markGeneratedDocumentsStale();
  const status = document.getElementById('draftStatus');
  if (status) {
    status.textContent = '● Kaydedilmemiş değişiklik';
    status.classList.remove('saved');
    status.classList.add('warning');
  }
  window.dispatchEvent(new CustomEvent('tyana:data-changed'));
}

function characteristicIsEngineeringReady(item) {
  const numericValid = item.specMode !== 'numeric' || (Number.isFinite(item.nominal) && Number.isFinite(item.minus) && Number.isFinite(item.plus) && item.minus >= 0 && item.plus >= 0 && item.minus + item.plus > 0);
  const textValid = item.specMode === 'numeric' || Boolean(String(item.specText || '').trim());
  const ownerValid = item.componentId === 'FINISHED_GOOD' || components.some(component => component.id === item.componentId);
  const sourceValid = ['sourceDrawing', 'sourceZone', 'sourceStatus'].every(field => !unresolvedPlaceholder(item[field])) && item.sourceValidationStatus !== 'pending';
  const routeValid = Boolean(item.routeKey && selected.includes(item.routeKey));
  const measurementValid = ['method', 'equipmentClass', 'equipment', 'resolution', 'sampleSize', 'frequency', 'trigger', 'reference', 'reaction'].every(field => !unresolvedPlaceholder(item[field]));
  const msaValid = item.msaStatus === 'Uygun' || (item.msaStatus === 'Uygulanamaz — gerekçeli' && !unresolvedPlaceholder(item.msaRationale));
  const calibrationValid = item.msaStatus === 'Uygulanamaz — gerekçeli' || Boolean(item.calibrationDue && item.calibrationDue >= new Date().toISOString().slice(0, 10));
  return Boolean(!unresolvedPlaceholder(item.name) && !unresolvedPlaceholder(item.definition) && !unresolvedPlaceholder(item.balloon) && ownerValid && routeValid && sourceValid && measurementValid && msaValid && calibrationValid && numericValid && textValid);
}

function productUpgradeState() {
  const identityFields = [partNumber, internalProductCode, partName, projectCode, controlPlanNumber];
  const identityReady = identityFields.filter(field => field?.value?.trim()).length;
  const masters = engineeringUniverse?.itemMasters || [];
  const masterErrors = globalThis.TyanaBom && masters.length ? globalThis.TyanaBom.validateItemMasters(masters).filter(issue => issue.severity !== 'warning') : [];
  let bomRows = [];
  let bomError = '';
  try { bomRows = activeEngineeringBomRows(document.getElementById('bomExplosionDate')?.value || ''); } catch (error) { bomError = error.message; }
  const bomRequired = ['assembly', 'subassembly', 'service_kit'].includes(document.getElementById('productStructureType')?.value || 'assembly');
  const bomReady = !bomRequired || bomRows.length > 0;
  const readiness = globalThis.TyanaProductDefinition?.workPlanReadiness?.() || { required: 0, completed: 0, missing: [] };
  const routeSteps = masters.flatMap(master => master.routingSteps || []);
  const missingMachines = routeSteps.filter(step => !(step.selectedMachines || []).length).length;
  const validCharacteristics = characteristics.filter(characteristicIsEngineeringReady).length;
  const issues = [];
  if (identityReady < identityFields.length) issues.push(`${identityFields.length - identityReady} ürün/doküman kimliği alanı eksik.`);
  if (!masters.length) issues.push('Malzeme ve ürün kartı sicili henüz oluşturulmadı.');
  else if (masterErrors.length) issues.push(`${masterErrors.length} malzeme kartı doğrulama hatası var.`);
  if (!bomReady) issues.push(bomError || 'Aktif ürün ağacında kullanım satırı yok.');
  if (readiness.missing.length) issues.push(`${readiness.missing.length} zorunlu iş planı operasyon veya makine bekliyor.`);
  else if (missingMachines) issues.push(`${missingMachines} isteğe bağlı rota adımında makine seçilmedi.`);
  if (validCharacteristics < characteristics.length) issues.push(`${characteristics.length - validCharacteristics} teknik karakteristik doğrulama bekliyor.`);
  return { identityReady, identityTotal: identityFields.length, masters, masterErrors, bomRows, bomRequired, bomReady, readiness, routeSteps, missingMachines, validCharacteristics, issues };
}

function setUpgradeMetric(stateId, metricId, stateText, metricText, ready) {
  const state = document.getElementById(stateId);
  const metric = document.getElementById(metricId);
  if (state) state.textContent = stateText;
  if (metric) metric.textContent = metricText;
  const card = state?.closest('button');
  card?.classList.toggle('ready', Boolean(ready));
  card?.classList.toggle('warning', !ready);
}

function renderProductUpgradeCockpit(options = {}) {
  if (!document.getElementById('productUpgradeCockpit') || !engineeringUniverse) return null;
  const state = productUpgradeState();
  setUpgradeMetric('upgradeIdentityState', 'upgradeIdentityMetric', state.identityReady === state.identityTotal ? 'Kimlik hazır' : 'Bilgi bekliyor', `${state.identityReady}/${state.identityTotal}`, state.identityReady === state.identityTotal);
  setUpgradeMetric('upgradeMasterState', 'upgradeMasterMetric', state.masters.length && !state.masterErrors.length ? 'Kart sicili hazır' : state.masterErrors.length ? 'Kart hatası var' : 'Kart bekliyor', String(state.masters.length), state.masters.length > 0 && !state.masterErrors.length);
  setUpgradeMetric('upgradeBomState', 'upgradeBomMetric', state.bomRows.length ? 'Ürün ağacı kuruldu' : state.bomRequired ? 'BOM bekliyor' : 'Tek parça kapsamı', String(state.bomRows.length), state.bomReady);
  setUpgradeMetric('upgradeRouteState', 'upgradeRouteMetric', state.readiness.required && state.readiness.completed === state.readiness.required && !state.missingMachines ? 'İş planları hazır' : 'Rota tamamlanmalı', `${state.readiness.completed}/${state.readiness.required}`, state.readiness.required > 0 && state.readiness.completed === state.readiness.required && !state.missingMachines);
  setUpgradeMetric('upgradeCharacteristicState', 'upgradeCharacteristicMetric', state.validCharacteristics === characteristics.length && characteristics.length ? 'Ölçüler hazır' : 'Ölçü bekliyor', `${state.validCharacteristics}/${characteristics.length}`, characteristics.length > 0 && state.validCharacteristics === characteristics.length);
  const issueBox = document.getElementById('productUpgradeIssues');
  if (issueBox) {
    issueBox.classList.toggle('success', !state.issues.length);
    issueBox.classList.toggle('warning', state.issues.length > 0);
    issueBox.querySelector('span').textContent = state.issues.length ? '!' : '✓';
    issueBox.querySelector('p').textContent = state.issues.length ? state.issues.slice(0, 3).join(' • ') : 'Ürün kimliği → kart sicili → BOM → iş planı → karakteristik zinciri mühendislik kontrolünden geçti.';
  }
  if (options.announce) toast(state.issues.length ? 'Mühendislik taraması tamamlandı' : 'Ürün omurgası hazır', state.issues[0] || 'Tüm ana ürün tanımlama kapıları tamamlandı.');
  return state;
}

function completeProductDocumentCodes() {
  const source = internalProductCode.value.trim() || partNumber.value.trim();
  if (!source) {
    goToWizardStep(1);
    toast('Ürün kodu gerekli', 'Önce kuruluş içi ürün/stok kodunu veya OEM numarasını girin.');
    return;
  }
  const normalized = source.toLocaleUpperCase('tr-TR').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  if (!controlPlanNumber.value.trim()) controlPlanNumber.value = `CP-${normalized}`;
  if (!document.getElementById('drawingNumber').value.trim()) document.getElementById('drawingNumber').value = partNumber.value.trim() || normalized;
  if (!projectCode.value.trim() || /^TY-\d{4}-YENİ$/i.test(projectCode.value.trim())) projectCode.value = `TY-${new Date().getFullYear()}-${normalized}`;
  updateSummary();
  markDraftDirty();
  toast('Doküman kimlikleri tamamlandı', 'Boş kontrol planı, proje ve teknik resim numaraları ana ürün kodundan üretildi; mevcut değerler korunmuştur.');
}

function updateSummary() {
  if (!productGroup) return;
  if (engineeringUniverse) {
    syncFinishedGoodMasterIdentity();
  }
  const backbone = activeBackbone();
  document.getElementById('summaryGroup').textContent = backbone.label;
  const summaryProductType = document.getElementById('summaryProductType'); if (summaryProductType) summaryProductType.textContent = effectiveProductTypeLabel() || 'Özel ürün tipi bekleniyor';
  document.getElementById('summaryPartName').textContent = (partName.value || 'PARÇA ADI').toLocaleUpperCase('tr-TR');
  document.getElementById('summaryPartNo').textContent = `OEM: ${partNumber.value || '—'} • Rev. ${drawingRevision.value || '—'}`;
  const summaryInternalCode = document.getElementById('summaryInternalCode'); if (summaryInternalCode) summaryInternalCode.textContent = `Kuruluş kodu: ${internalProductCode.value || '—'}`;
  document.getElementById('summaryProject').textContent = projectCode.value || 'YENİ PROJE';
  document.getElementById('summaryComponentCount').textContent = components.length;
  document.getElementById('summaryCharacteristicCount').textContent = characteristics.length;
  document.getElementById('summarySpecialCount').textContent = characteristics.filter(item => item.classification !== 'Normal').length;
  document.getElementById('summaryProcessCount').textContent = selected.length;
  const recommendation = document.getElementById('processRecommendationText');
  if (recommendation) recommendation.textContent = `${activeProductLevelProfile().title} için ${defaultRouteForProductContext().length} aday operasyon gösterilebilir. Rota yalnız sizin 380 standart proses kartından yaptığınız seçimle oluşur; adımlar eklenebilir, çıkarılabilir, tekrarlanabilir ve sürüklenebilir.`;
  const gateProcess = document.getElementById('gateProcessText');
  if (gateProcess) gateProcess.textContent = selected.length ? `${selected.length} operasyon ve operasyon bazlı BOM girdileri eşleştirildi` : 'Rota sıfırdan oluşturulacak; zorunlu operasyon henüz seçilmedi';
  const identity = `${projectCode.value || 'YENİ PROJE'} • ${(partName.value || 'YENİ MAMUL').toLocaleUpperCase('tr-TR')}`;
  const requiredProductFieldsReady = Boolean(partNumber.value.trim() && internalProductCode.value.trim() && partName.value.trim() && projectCode.value.trim() && controlPlanNumber.value.trim() && (productGroup.value !== '__custom__' || document.getElementById('customProductGroupName').value.trim()) && (!isCustomProductType() || customProductTypeName.value.trim()));
  const requiredStatus = document.getElementById('productRequiredStatus'); if (requiredStatus) requiredStatus.textContent = requiredProductFieldsReady ? 'OEM ve kuruluş içi mamul kimliği tamam' : 'Ürün sınıfı, OEM No, kuruluş kodu ve doküman kimliği tamamlanmalı';
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
  renderProductUpgradeCockpit();
}

document.querySelectorAll('#product input, #product select, #product textarea').forEach(field => {
  if (field.closest('#characteristicRows')) return;
  field.addEventListener('input', () => { updateSummary(); markDraftDirty(); });
  field.addEventListener('change', () => { updateSummary(); markDraftDirty(); });
});

syncProductTypes();
syncProductLevelContext();
renderComponents();
renderCharacteristics();

document.getElementById('productTemplate')?.addEventListener('change', event => applyProductTemplate(event.target.value));
document.getElementById('customProductGroupName')?.addEventListener('input', () => { syncProductTypes(); markDraftDirty(); });
document.getElementById('productStructureType')?.addEventListener('change', () => { syncProductLevelContext(); validateComponents(); markDraftDirty(); });
document.querySelectorAll('[data-action="add-component"]').forEach(button => button.addEventListener('click', openBomComponentDialog));
document.querySelectorAll('[data-action="add-subassembly"]').forEach(button => button.addEventListener('click', () => addComponent('Alt montaj')));
document.querySelectorAll('[data-action="reset-bom-blank"]').forEach(button => button.addEventListener('click', () => {
  if (components.length && !window.confirm(`${components.length} BOM kalemi ve bağlı alt seviyeler kaldırılacak. Boş BOM ile devam edilsin mi?`)) return;
  checkpointBom('BOM boşaltıldı'); components = []; bomSelectedId = 'FINISHED_GOOD'; bomExpandedIds.clear(); resetEngineeringUniverseFromComponents(); renderComponents(); renderCharacteristics(); markDraftDirty(); toast('Mamul ağacı boşaltıldı', 'Yeni bileşenleri sıfırdan oluşturulan malzeme kartlarından ekleyebilirsiniz.');
}));
document.getElementById('bomTypeChoices')?.querySelectorAll('[data-bom-type]').forEach(button => button.addEventListener('click', () => addComponent(button.dataset.bomType)));
document.querySelector('[data-action="insert-bom-reference"]')?.addEventListener('click', () => insertSelectedBomLibraryItem('reference'));
document.querySelector('[data-action="insert-bom-copy"]')?.addEventListener('click', () => insertSelectedBomLibraryItem('copy'));
document.querySelector('[data-action="undo-bom"]')?.addEventListener('click', undoBomChange);
document.querySelector('[data-action="show-bom-validation"]')?.addEventListener('click', () => validateComponents({ show: true }));
document.querySelector('[data-action="expand-bom"]')?.addEventListener('click', () => { components.filter(item => globalThis.TyanaBom.isContainerType(item.componentType)).forEach(item => bomExpandedIds.add(item.id)); renderBomNavigator(); });
document.querySelector('[data-action="collapse-bom"]')?.addEventListener('click', () => { bomExpandedIds.clear(); renderBomNavigator(); });
document.querySelectorAll('[data-bom-view]').forEach(button => button.addEventListener('click', () => { bomViewMode = button.dataset.bomView; renderBomNavigator(); }));
document.getElementById('bomSearch')?.addEventListener('input', renderBomNavigator);

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
  { id: 'post-paint-assembly', name: 'Boya Sonrası Montaj', desc: 'Isıya hassas bileşenlerin boya küründen sonra kontrollü montajı', icon: '⚙' },
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
function componentRouteMatches(value, routeKey, processId) { return Boolean(value && (value === routeKey || value === processId || routeBaseId(value) === processId)); }
function routeDetailFor(routeKey, process, index = 0) {
  const mappedInputs = components.filter(item => [item.firstUseProcessId, item.mountedAtProcessId, item.inspectedAtProcessId].some(value => componentRouteMatches(value, routeKey, process.id))).map(item => item.id);
  const mappedOutput = components.find(item => componentRouteMatches(item.producedAtProcessId, routeKey, process.id))?.id || 'FINISHED_GOOD';
  if (!routeDetails[routeKey]) routeDetails[routeKey] = {
    operationNo: String((index + 1) * 10).padStart(2, '0'),
    operationCode: '', presetId: '', variantId: '', sourceDocumentId: '', sourceRef: '', sourceValidationStatus: 'not-applicable', sourceValidationNote: '',
    inputComponentIds: mappedInputs,
    outputItemId: mappedOutput,
    workcenter: process.owner || process.family || (process.id === 'integrated-assembly' ? 'Entegre montaj hattı' : 'Tanımlanacak'),
    machineId: process.equipment || '', selectedMachines: [],
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

function routeOperationIdentity(process = {}, detail = {}) {
  const code = String(detail.operationCode || '').trim();
  const labelTR = detail.operationLabelTR || process.name || 'Operasyon';
  const labelEN = detail.operationLabelEN || '';
  return { code, labelTR, labelEN, title: [code ? `KOD ${code}` : '', labelTR, labelEN ? `/ ${labelEN}` : ''].filter(Boolean).join(' ') };
}

function libraryArray(name) { return Array.isArray(qualityDocumentLibrary?.[name]) ? qualityDocumentLibrary[name] : []; }
function sourceControlPlans() { return libraryArray('sourceControlPlans'); }
function sourceOperationPresets() { return libraryArray('operationPresets'); }
function sourceInstructionPresets() { return libraryArray('instructionPresets'); }
function sourceValidationRules() { return libraryArray('validationRules'); }
function validationRuleForCode(code) { return sourceValidationRules().find(rule => String(rule.code || rule.id) === String(code || '')); }
function blockingValidationRule(rule) { return ['block', 'blocking', 'critical', 'error'].includes(String(rule?.severity || '').toLocaleLowerCase('tr-TR')); }
function sourceValidationApproved(record) { return ['drawing-verified', 'engineering-approved'].includes(String(record?.sourceValidationStatus || '')); }
function validationRuleText(code) { const rule = validationRuleForCode(code); return rule ? `${rule.code || rule.id}: ${recordLabel(rule, 'Teknik doğrulama gerekli')}` : String(code || 'Teknik doğrulama gerekli'); }
function recordId(record, fallback = '') { return String(record?.id || record?.libraryId || record?.documentId || record?.documentNo || fallback); }
function recordLabel(record, fallback = 'Tanımsız') { return record?.nameTR || record?.titleTR || record?.title || record?.name || record?.productName || record?.documentNo || record?.messageTR || fallback; }
function operationCodeOf(record) { return String(record?.operationCode || record?.code || record?.operationNo || '').trim(); }
function sourcePlanId(plan) { return recordId(plan, plan?.controlPlanNumber || plan?.partNumber || 'source-plan'); }
function sourcePlanNumber(plan) { return plan?.controlPlanNumber || plan?.documentNo || plan?.planNumber || sourcePlanId(plan); }
function productApplicabilityForPlan(plan) { return libraryArray('productApplicability').find(product => (plan?.applicableProductIds || []).includes(product.id) || product.controlPlanId === sourcePlanId(plan)); }
function sourcePlanPartNumber(plan) { const product = productApplicabilityForPlan(plan); return plan?.partNumber || plan?.productPartNumber || plan?.drawingNumber || plan?.drawingNo || product?.drawingRefs?.[0]?.number || sourcePlanNumber(plan); }
function sourcePlanDrawingNumber(plan) { const product = productApplicabilityForPlan(plan); return plan?.drawingNumber || plan?.drawingNo || (product?.drawingRefs || []).map(ref => ref.number || ref).filter(Boolean).join(' / ') || sourcePlanPartNumber(plan); }
function sourcePlanRevision(plan) { return plan?.revision || plan?.drawingRevision || 'Kaynak revizyonu doğrulanacak'; }
function sourcePlanDrawingRevision(plan) {
  const product = productApplicabilityForPlan(plan); const refs = product?.drawingRefs?.length ? product.drawingRefs : plan?.drawingRefs || [];
  return [...new Set(refs.map(ref => typeof ref === 'string' ? '' : ref?.revision).filter(Boolean))].join(' / ') || plan?.drawingRevision || sourcePlanRevision(plan);
}
function sourceReferenceText(sourceRefs) {
  return (Array.isArray(sourceRefs) ? sourceRefs : []).map(ref => typeof ref === 'string' ? ref : [ref?.documentNo || ref?.documentId || ref?.fileName, ref?.page ? `s.${ref.page}` : '', ref?.section || ''].filter(Boolean).join(' • ')).filter(Boolean).join(' | ');
}
function entityMentionsPlan(entity, plan) {
  const needles = [sourcePlanId(plan), sourcePlanNumber(plan), plan?.productId, sourcePlanPartNumber(plan), ...(plan?.applicableProductIds || [])].filter(Boolean).map(value => String(value).toLocaleLowerCase('tr-TR'));
  const haystack = JSON.stringify({ sourceControlPlanIds: entity?.sourceControlPlanIds, sourcePlanIds: entity?.sourcePlanIds, productIds: entity?.productIds, sourceRefs: entity?.sourceRefs, appliesTo: entity?.appliesTo }).toLocaleLowerCase('tr-TR');
  return needles.some(needle => haystack.includes(needle));
}
function operationPresetForCode(code) { return sourceOperationPresets().find(item => operationCodeOf(item) === String(code)); }
function instructionPresetForCode(code) { return sourceInstructionPresets().find(item => operationCodeOf(item) === String(code)); }
function sourceInstructionForPreset(preset) { return libraryArray('sourceOperatorInstructions').find(item => recordId(item) === String(preset?.sourceInstructionId || '')); }
function instructionTitleForPreset(preset, fallback = 'Operatör talimatı') {
  const operation = operationPresetForCode(operationCodeOf(preset));
  return `${recordLabel(operation, fallback)} • Sistem Taslağı`;
}
function applicationProfileFor(operation, plan) {
  const profiles = Array.isArray(operation?.applicationProfiles) ? operation.applicationProfiles : [];
  return profiles.find(profile => entityMentionsPlan(profile, plan)) || profiles.find(profile => !profile.productIds?.length && !profile.sourceControlPlanIds?.length) || profiles[0] || {};
}
function sourcePlanOperationCodes(plan) {
  const explicit = plan?.operationCodes || plan?.operations || plan?.route || plan?.processes || [];
  const codes = explicit.map(item => operationCodeOf(typeof item === 'string' || typeof item === 'number' ? { operationCode: item } : item)).filter(Boolean);
  const inferred = sourceOperationPresets().filter(operation => entityMentionsPlan(operation, plan) || (operation.applicationProfiles || []).some(profile => entityMentionsPlan(profile, plan))).map(operationCodeOf).filter(Boolean);
  return [...new Set(codes.length ? codes : inferred)].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b, 'tr'));
}
function canonicalProcessIdForOperation(operation) {
  const override = operationProcessOverride(operation); if (override?.id && processes.some(process => process.id === override.id)) return override.id;
  const card = operationProcessCard(operation);
  const explicit = card?.canonicalProcessId || operation?.canonicalProcessId || operation?.processId || operation?.canonicalId;
  if (explicit && processes.some(process => process.id === explicit)) return explicit;
  const map = { '202': 'induction', '301': 'cnc', '303': 'cnc', '304': 'cnc', '321': 'grinding', '322': 'thread', '355': 'cnc', '356': 'cnc', '435': 'coating', '519': 'ndt' };
  const mapped = map[operationCodeOf(operation)]; if (mapped && processes.some(process => process.id === mapped)) return mapped;
  const label = `${operation?.labels?.tr || ''} ${operation?.labels?.en || ''} ${recordLabel(operation, '')}`.toLocaleUpperCase('tr-TR');
  const inference = [
    ['incoming', /GİRDİ|GİRİŞ|KABUL|INCOMING|RECEIVING/], ['storage', /DEPO|STOK|WAREHOUSE|STORAGE|FIFO/],
    ['packing', /PAKET|AMBALAJ|SEVK|PACK|SHIP/], ['marking', /MARKA|MARKAL|LAZER|ETCH|STAMP|MARKING/],
    ['washing', /YIKA|TEMİZ|KURUT|WASH|CLEAN|DRYING/], ['painting', /BOYA|PAINT/], ['coating', /KAPLA|FOSFAT|KATAFOREZ|COAT|PLATING|PHOSPHAT/],
    ['welding', /KAYNAK|WELD|LEHİM|BRAZ/], ['induction', /İNDÜKSİYON|YÜZEY SERTLEŞ|INDUCTION|SURFACE HARDEN/], ['furnace-heat', /ISIL|TAVLA|MENEVİŞ|TEMPER|ANNEAL|HEAT TREAT/],
    ['grinding', /TAŞLA|BİLEME|GRIND|HONLAMA|HONING|LAPPING/], ['thread', /DİŞ AÇ|DİŞ OVALA|THREAD|TAP(PING)?/], ['drilling', /DELİK|DELME|RAYBA|DRILL|REAM|BORING/],
    ['milling', /FREZE|KANAL AÇ|BROŞ|MILL|SLOT|BROACH/], ['cnc', /TORNA|TORNALAMA|TURNING|MACHINING/], ['forging', /DÖVME|ŞİŞİRME|SICAK ŞEKİL|FORG|HEADING|HOT FORM/],
    ['cutting', /KESME|KIRMA|CUTTING|SAW|SHEAR/], ['assembly', /MONTAJ|PRESLE|ÇAKMA|TAKMA|ASSEMB|PRESS|INSERT/], ['final', /KONTROL|TEST|ÖLÇ|INSPECT|CHECK|MEASUR|TESTING/]
  ];
  const inferred = inference.find(([, pattern]) => pattern.test(label))?.[0];
  if (inferred && processes.some(process => process.id === inferred)) return inferred;
  return processes.some(process => process.id === 'cnc') ? 'cnc' : processes.find(process => process.status !== 'archived')?.id || '';
}
function lookupLibraryItem(name, id) { return libraryArray(name).find(item => recordId(item) === String(id || '')); }
function sourceWarningCodesForRoute(detail = {}, presetOverride = null) {
  const preset = presetOverride || sourceInstructionPresets().find(item => recordId(item) === detail.presetId) || instructionPresetForCode(detail.operationCode);
  const ppeProfile = lookupLibraryItem('ppeProfiles', preset?.ppeProfileId) || {};
  const samplingRule = lookupLibraryItem('samplingRules', preset?.generalSamplingRuleId) || {};
  const entityIds = [recordId(preset), preset?.sourceInstructionId, recordId(operationPresetForCode(detail.operationCode)), `operation.${detail.operationCode}`].filter(Boolean);
  const related = sourceValidationRules().filter(rule => (rule.affectedEntityIds || []).some(id => entityIds.includes(id))).map(rule => rule.code || rule.id);
  return [...new Set([...(preset?.warningCodes || []), ...(ppeProfile.warningCodes || []), ...(samplingRule.conflictPolicy === 'block-until-resolved' ? ['SAMPLING_CONTRADICTION'] : []), ...related].filter(Boolean))];
}
function samplingTriggerText(rule) {
  const labels = { setup: 'Ayar sonrası', 'after-setup': 'Ayar sonrası', interval: 'Periyodik', shift: 'Vardiyada', 'run-start': 'Seri başlangıcında', 'after-breakdown': 'Arıza sonrası', 'run-end': 'Seri bitişinde', calendar: 'Takvim periyodunda', lot: 'Her lotta', 'lot-start': 'Lot başlangıcında', 'lot-end': 'Lot bitişinde', 'after-fixture-change': 'Fikstür değişiminde', continuous: '%100 sürekli' };
  return (rule?.triggers || []).map(trigger => `${labels[trigger.type] || trigger.type}${trigger.minutes ? ` / ${trigger.minutes} dk` : ''}${trigger.days ? ` / ${trigger.days} gün` : ''}${trigger.quantity ? ` / ${trigger.quantity} parça` : ''}`).join(' + ');
}
function characteristicSourceWarnings(item) { return (item?.sourceWarningCodes || []).map(code => ({ code, rule: validationRuleForCode(code) })).filter(entry => entry.code); }
function operationCodeEntries() { return Array.isArray(operationCodeLibrary?.operations) ? operationCodeLibrary.operations : []; }
function ensureOperationCodeOptions() {
  let datalist = document.getElementById('operationCodeLibraryOptions');
  if (!datalist) { datalist = document.createElement('datalist'); datalist.id = 'operationCodeLibraryOptions'; document.body.append(datalist); }
  datalist.innerHTML = operationCodeEntries().map(item => `<option value="${escapeHtml(item.code)}">${escapeHtml(`${item.labels?.tr || '—'} • ${item.labels?.en || '—'}${item.requiresReview ? ' • İNCELEME' : ''}`)}</option>`).join('');
}
function operationCodeRecord(code) { const key = String(code || '').trim().toLocaleUpperCase('tr-TR'); return operationCodeEntries().find(item => String(item.code).toLocaleUpperCase('tr-TR') === key); }
function operationProcessOverride(recordOrCode, includeArchived = false) {
  const code = typeof recordOrCode === 'object' ? operationCodeOf(recordOrCode) : String(recordOrCode || '').trim();
  if (!code) return null;
  return processes.find(process => (includeArchived || process.status !== 'archived') && String(process.sourceOperationCode || '') === code) || null;
}
function operationProcessCard(recordOrCode) {
  const record = typeof recordOrCode === 'object' ? recordOrCode : operationCodeRecord(recordOrCode);
  if (!record?.standardProcessCard) return null;
  const card = record.standardProcessCard; const override = operationProcessOverride(record);
  if (!override) return card;
  return {
    ...card,
    ...override,
    cardId: card.cardId,
    operationCode: record.code,
    canonicalProcessId: card.canonicalProcessId,
    machineClassId: override.machineClassId || card.machineClassId,
    allowedMachineClasses: override.allowedMachineClasses || card.allowedMachineClasses,
    equipmentRequirements: override.equipmentRequirements || card.equipmentRequirements,
    qualityLinks: override.qualityLinks || card.qualityLinks,
    standardRefs: override.standardRefs || card.standardRefs,
    characteristics: Array.isArray(override.characteristics) ? override.characteristics : card.characteristics,
    riskTemplate: Array.isArray(override.riskTemplate) ? override.riskTemplate : card.riskTemplate,
    overrideProcessId: override.id,
    overrideVersion: override.version || 1
  };
}
function ensureOperationMachineOptions() {
  let datalist = document.getElementById('operationMachineLibraryOptions');
  if (!datalist) { datalist = document.createElement('datalist'); datalist.id = 'operationMachineLibraryOptions'; document.body.append(datalist); }
  const machineIndex = new Map();
  operationCodeEntries().forEach(record => {
    const card = operationProcessCard(record); const requirements = card?.equipmentRequirements || {};
    (requirements.productSpecificMachineIds || []).forEach(machineId => {
      const usage = machineIndex.get(machineId) || [];
      usage.push(`${record.code} • ${record.labels?.tr || ''}`); machineIndex.set(machineId, usage);
    });
  });
  (operationCodeLibrary?.machineRegisterSeeds || []).forEach(seed => {
    const usage = machineIndex.get(seed.machineId) || [];
    if (!usage.length) usage.push(`Sicil - ${(seed.supportedOperationCodes || []).join(', ')}`);
    machineIndex.set(seed.machineId, usage);
  });
  datalist.innerHTML = [...machineIndex.entries()].sort(([a], [b]) => a.localeCompare(b, 'tr', { numeric: true }))
    .map(([machineId, usage]) => `<option value="${escapeHtml(machineId)}">${escapeHtml(usage.join(' / '))}</option>`).join('');
}
function bindOperationCodeMetadata(detail, code) {
  const record = operationCodeRecord(code);
  const card = operationProcessCard(record);
  if (record) detail.operationCode = record.code;
  detail.operationCodeId = record?.id || '';
  detail.operationLabelTR = record?.labels?.tr || '';
  detail.operationLabelEN = record?.labels?.en || '';
  detail.operationCodeRequiresReview = Boolean(record?.requiresReview);
  detail.operationCodeReviewFlags = Array.isArray(record?.reviewFlags) ? [...record.reviewFlags] : [];
  detail.operationCodeSourceRef = record?.sourceRef ? { ...record.sourceRef, cells: { ...(record.sourceRef.cells || {}) } } : null;
  detail.standardProcessCardId = card?.cardId || '';
  detail.machineClassId = card?.machineClassId || '';
  detail.allowedMachineClasses = Array.isArray(card?.allowedMachineClasses) ? [...card.allowedMachineClasses] : [];
  detail.equipmentRequirements = card?.equipmentRequirements ? JSON.parse(JSON.stringify(card.equipmentRequirements)) : null;
  if (record?.requiresReview && !sourceValidationApproved(detail)) {
    detail.sourceValidationStatus = 'pending';
    if (!detail.sourceValidationNote) detail.sourceValidationNote = 'Operasyon kodu anlam / çeviri incelemesi bekliyor.';
  }
  return record;
}
function sourcePlanCharacteristicRecords(plan) {
  const direct = Array.isArray(plan?.characteristics) ? plan.characteristics.map(characteristic => ({ characteristic, operation: operationPresetForCode(characteristic.operationCode), profile: plan })) : [];
  if (direct.length) return direct;
  return sourcePlanOperationCodes(plan).flatMap(code => {
    const operation = operationPresetForCode(code) || { operationCode: code };
    const profile = applicationProfileFor(operation, plan);
    return (Array.isArray(profile.characteristics) ? profile.characteristics : []).map(characteristic => ({ characteristic, operation, profile }));
  });
}
function normalizeSourceCharacteristic(record, index, plan, routeKeyByCode) {
  const characteristic = record.characteristic || {}; const operation = record.operation || {};
  const spec = characteristic.spec || {}; const normalized = spec.normalized || characteristic.normalizedSpec || {};
  const sourceVerificationStatus = normalized.verificationStatus || characteristic.verificationStatus || 'source-normalized-draft';
  const sourceWarningCodes = Array.isArray(characteristic.warningCodes) ? [...characteristic.warningCodes] : [];
  const numeric = value => { const parsed = parseLocaleNumber(value); return Number.isFinite(parsed) ? parsed : NaN; };
  let nominal = numeric(normalized.nominal ?? characteristic.nominal); let minimum = numeric(normalized.minimum ?? normalized.min ?? normalized.lower ?? characteristic.minimum); let maximum = numeric(normalized.maximum ?? normalized.max ?? normalized.upper ?? characteristic.maximum);
  let minus = numeric(normalized.minus ?? normalized.lowerDeviation ?? characteristic.minus); let plus = numeric(normalized.plus ?? normalized.upperDeviation ?? characteristic.plus);
  if (!Number.isFinite(nominal) && Number.isFinite(minimum) && Number.isFinite(maximum)) nominal = (minimum + maximum) / 2;
  if (!Number.isFinite(minus) && Number.isFinite(nominal) && Number.isFinite(minimum)) minus = Math.abs(nominal - minimum);
  if (!Number.isFinite(plus) && Number.isFinite(nominal) && Number.isFinite(maximum)) plus = Math.abs(maximum - nominal);
  const unsafeNumericSource = sourceVerificationStatus === 'blocked' || normalized.type === 'unresolved' || sourceWarningCodes.includes('UV_UNIT_INCONSISTENCY');
  const numericReady = [nominal, minus, plus].every(Number.isFinite) && !unsafeNumericSource;
  const sampling = characteristic.sampling || {}; const methodId = characteristic.measurementMethodIds?.[0] || characteristic.measurementMethodId; const measurement = lookupLibraryItem('measurementMethods', methodId) || {};
  const samplingRule = lookupLibraryItem('samplingRules', sampling.ruleId) || {}; const recordForm = lookupLibraryItem('recordForms', characteristic.recordFormId) || {}; const reaction = lookupLibraryItem('reactionPlans', characteristic.reactionPlanId) || {};
  const code = operationCodeOf(operation) || operationCodeOf(characteristic); const rawSpec = spec.raw || characteristic.specification || characteristic.tolerance || characteristic.specText || 'Teknik resim / şartname doğrulaması gerekli';
  const sourceRefs = [...(Array.isArray(characteristic.sourceRefs) ? characteristic.sourceRefs : []), ...(Array.isArray(record.profile?.sourceRefs) ? record.profile.sourceRefs : [])];
  return newCharacteristic({
    id: `SOURCE-${code || 'CHAR'}-${String(index + 1).padStart(3, '0')}`, libraryCode: characteristic.code || characteristic.id || `SOURCE-${code}-${index + 1}`, componentId: 'FINISHED_GOOD',
    balloon: String(characteristic.balloon || characteristic.characteristicNo || characteristic.number || index + 1), name: recordLabel(characteristic, 'Kaynak karakteristik'), definition: characteristic.definitionTR || characteristic.definition || characteristic.description || 'Kontrollü kaynak örneğinden aktarılan düzenlenebilir karakteristik',
    sourceDrawing: sourcePlanDrawingNumber(plan), sourceZone: sourceReferenceText(sourceRefs) || `${sourcePlanNumber(plan)} • operasyon ${code}`, sourceStatus: `Kontrollü kaynak taslağı • ${sourceVerificationStatus} • ürün revizyonunda doğrulanmalı`, sourceValidationStatus: 'pending', sourceVerificationStatus, sourceSpecType: normalized.type || spec.type || 'source-text',
    kind: characteristic.kind || characteristic.characteristicType || 'Ürün', specMode: numericReady ? 'numeric' : 'text', nominal: numericReady ? nominal : 0, minus: numericReady ? Math.abs(minus) : 0, plus: numericReady ? Math.abs(plus) : 0, specText: numericReady ? '' : rawSpec,
    unit: normalized.unit || characteristic.unit || spec.unit || '—', precision: measurement.resolution || characteristic.resolution || 'Kaynak cihaz çözünürlüğü doğrulanacak', classification: characteristic.classification || characteristic.specialCharacteristic || 'Normal', sourceSpecialClassRaw: characteristic.specialClassRaw || '',
    processId: canonicalProcessIdForOperation(operation), routeKey: routeKeyByCode.get(code) || '', method: recordLabel(measurement, characteristic.measurementMethod || 'Kontrol yöntemi doğrulanacak'), equipmentClass: measurement.equipmentClass || characteristic.equipmentClass || recordLabel(measurement, 'Ölçüm cihazı sınıfı doğrulanacak'), equipment: characteristic.equipment || measurement.equipment || 'Cihaz / asset ID kullanıcı tarafından seçilecek', resolution: characteristic.resolution || measurement.resolution || 'Doğrulanacak',
    msaReference: characteristic.msaReference || 'MSA / uygunluk kaydı bağlanmalı', msaStatus: 'Doğrulama bekliyor', sampleSize: String(sampling.sampleSize || sampling.quantity || characteristic.sampleSize || 'Kullanıcı doğrulaması'), frequency: sampling.frequency || sampling.raw || characteristic.frequency || 'Kullanıcı doğrulaması', trigger: sampling.trigger || samplingTriggerText(samplingRule) || characteristic.trigger || 'İlk parça + değişiklik sonrası', sourceSamplingRuleId: sampling.ruleId || '', sourceSamplingConflictPolicy: samplingRule.conflictPolicy || '', pokaYoke: characteristic.pokaYoke || 'Uygulanabilirlik seçilecek', reference: recordForm.code || recordForm.formNo || recordForm.documentNo || recordLabel(recordForm, characteristic.recordFormId || 'Kayıt formu bağlanmalı'), reaction: reaction.code || reaction.id || characteristic.reactionPlanId || 'RP-SOURCE', sourceReactionText: reaction.actions?.length ? `${reaction.nameTR || 'Reaksiyon'}: ${reaction.actions.join(' → ')}` : reaction.nameTR || '',
    sourceDocumentId: sourcePlanId(plan), sourceRefs, sourceWarningCodes
  });
}

function renderSourceControlPreview(plan) {
  const meta = document.getElementById('sourceControlPlanMeta'); const operationBox = document.getElementById('sourceOperationChips'); const characteristicBox = document.getElementById('sourceCharacteristicPreview'); const validationBox = document.getElementById('sourceValidationPreview');
  if (!plan) { if (meta) meta.innerHTML = '<span>Kaynak planı seçilmedi.</span>'; return; }
  const codes = sourcePlanOperationCodes(plan); const characteristicRecords = sourcePlanCharacteristicRecords(plan);
  if (meta) meta.innerHTML = [`Plan ${sourcePlanNumber(plan)} • Rev. ${sourcePlanRevision(plan)}`, `${sourcePlanDrawingNumber(plan)} • Resim Rev. ${sourcePlanDrawingRevision(plan)}`, `${codes.length} operasyon • ${characteristicRecords.length} kontrol noktası`].map(text => `<span>${escapeHtml(text)}</span>`).join('');
  if (operationBox) operationBox.innerHTML = codes.length ? codes.map(code => { const operation = operationPresetForCode(code) || { operationCode: code }; const profile = applicationProfileFor(operation, plan); const preset = sourceInstructionPresets().find(item => recordId(item) === profile.instructionPresetId) || instructionPresetForCode(code); const sourceInstruction = libraryArray('sourceOperatorInstructions').find(item => item.id === preset?.sourceInstructionId); return `<div class="source-operation-chip"><b>${escapeHtml(code)}</b><span>${escapeHtml(recordLabel(operation, 'Operasyon'))}</span><small>${escapeHtml(sourceInstruction?.instructionNo || preset?.documentNo || preset?.instructionNo || 'Talimat preseti bekliyor')}</small></div>`; }).join('') : '<span class="studio-placeholder">Bu kaynak planında kodlu operasyon bulunamadı.</span>';
  if (characteristicBox) characteristicBox.innerHTML = characteristicRecords.length ? characteristicRecords.slice(0, 8).map((record, index) => { const item = record.characteristic; const spec = item.spec?.raw || item.specification || item.tolerance || 'Doğrulanacak'; return `<div class="source-characteristic-mini"><span>${escapeHtml(item.balloon || item.characteristicNo || index + 1)}</span><div><b>${escapeHtml(recordLabel(item, 'Karakteristik'))}</b><small>${escapeHtml(spec)}</small></div><mark>${escapeHtml(operationCodeOf(record.operation) || operationCodeOf(item))}</mark></div>`; }).join('') : '<span class="studio-placeholder">Karakteristik paketi bulunamadı.</span>';
  const warnings = [...new Set(characteristicRecords.flatMap(record => record.characteristic.warningCodes || []))]; const rules = (warnings.length ? sourceValidationRules().filter(rule => warnings.includes(rule.code) || warnings.includes(rule.id)) : sourceValidationRules()).slice(0, 5);
  if (validationBox) validationBox.innerHTML = rules.length ? rules.map((rule, index) => `<div class="validation-preview-item ${index > 2 ? 'info' : ''}"><span>${index > 2 ? 'i' : '!'}</span><div><b>${escapeHtml(rule.code || rule.id || 'KURAL')}</b><small>${escapeHtml(recordLabel(rule, rule.description || rule.message || rule.messageTR || 'Yayın öncesi doğrulama gerekir'))}</small></div></div>`).join('') : '<span class="studio-placeholder">Aktif doğrulama kuralı bulunamadı.</span>';
  const health = document.getElementById('sourceControlHealth'); if (health) health.textContent = `${codes.length} operasyon • ${characteristicRecords.length} karakteristik • ${warnings.length} teknik uyarı`;
}

function visibleSourceInstructionPresets() {
  const query = sourceInstructionUiState.query.toLocaleLowerCase('tr-TR'); const routeCodes = new Set(selectedProcessEntries().map(entry => String(entry.detail.operationCode || '')).filter(Boolean));
  return sourceInstructionPresets().filter(preset => {
    const routeMatch = sourceInstructionUiState.profile !== 'route' || !routeCodes.size || routeCodes.has(operationCodeOf(preset));
    const searchMatch = !query || `${recordLabel(preset)} ${preset.documentNo || ''} ${preset.instructionNo || ''} ${operationCodeOf(preset)}`.toLocaleLowerCase('tr-TR').includes(query);
    return routeMatch && searchMatch;
  });
}
function renderSourceInstructionGallery() {
  const gallery = document.getElementById('sourceInstructionGallery'); if (!gallery) return; const presets = visibleSourceInstructionPresets();
  gallery.innerHTML = presets.length ? presets.map(preset => { const id = recordId(preset); const source = sourceInstructionForPreset(preset); const selectedPreset = sourceInstructionUiState.pickedIds.has(id); const stepCount = (preset.steps || preset.workSteps || []).length; return `<article class="instruction-preset-card ${selectedPreset ? 'selected' : ''}" data-source-instruction-id="${escapeHtml(id)}" tabindex="0"><span class="instruction-preset-code">${escapeHtml(operationCodeOf(preset) || 'OP')}</span><div><h3>${escapeHtml(instructionTitleForPreset(preset))}</h3><p>${escapeHtml(source?.instructionNo || 'Kaynak TTI yok')} • ${stepCount ? `${stepCount} kaynak adım` : 'üretilmiş taslak adımlar'} • ${(preset.characteristicPresetIds || []).length} kontrol bağı</p><small>${escapeHtml(`${source?.drawingRefs?.join(' / ') || (preset.productIds || []).join(' • ') || 'Ürün revizyonunda uygulanabilirlik seçilecek'} • Rev. ${source?.revision || 'doğrulanacak'}`)}</small></div><span class="instruction-preset-check">✓</span></article>`; }).join('') : '<span class="studio-placeholder">Arama/rota filtresine uygun talimat preseti bulunamadı.</span>';
  gallery.querySelectorAll('[data-source-instruction-id]').forEach(card => { const toggle = () => { const id = card.dataset.sourceInstructionId; sourceInstructionUiState.pickedIds.has(id) ? sourceInstructionUiState.pickedIds.delete(id) : sourceInstructionUiState.pickedIds.add(id); renderSourceInstructionGallery(); }; card.addEventListener('click', toggle); card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } }); });
  const count = document.getElementById('sourceInstructionPickedCount'); if (count) count.textContent = sourceInstructionUiState.pickedIds.size;
  const readiness = document.getElementById('sourceInstructionReadiness'); if (readiness) readiness.innerHTML = `<div class="instruction-readiness-list"><span><b>Preset seçimi</b><i class="${sourceInstructionUiState.pickedIds.size ? 'ok' : ''}"></i></span><span><b>Rota eşleşmesi</b><i class="${selected.length ? 'ok' : ''}"></i></span><span><b>Kontrol bağı</b><i class="${characteristics.length ? 'ok' : ''}"></i></span><span><b>Teknik onay</b><i></i></span></div>`;
}

function renderSourceIntegrationStudio() {
  if (!qualityDocumentLibrary) return;
  ensureOperationCodeOptions(); applyTenantProfile();
  const counts = { tenantSourcePlanCount: sourceControlPlans().length, tenantOperationCount: operationCodeEntries().length || sourceOperationPresets().length, tenantInstructionCount: sourceInstructionPresets().length, tenantValidationCount: sourceValidationRules().length };
  Object.entries(counts).forEach(([id, value]) => { const element = document.getElementById(id); if (element) element.textContent = value; });
  const state = document.getElementById('tenantLibraryState'); if (state) state.textContent = `${qualityDocumentLibrary.libraryId} • v${qualityDocumentLibrary.libraryVersion} • kontrollü kaynak taslağı • mühendislik doğrulaması zorunlu`;
  const selector = document.getElementById('sourceControlPlanSelect');
  if (selector) { const current = selector.value; selector.innerHTML = sourceControlPlans().map(plan => `<option value="${escapeHtml(sourcePlanId(plan))}">${escapeHtml(sourcePlanNumber(plan))} • ${escapeHtml(recordLabel(productApplicabilityForPlan(plan), sourcePlanPartNumber(plan)))}</option>`).join(''); if ([...selector.options].some(option => option.value === current)) selector.value = current; renderSourceControlPreview(sourceControlPlans().find(plan => sourcePlanId(plan) === selector.value) || sourceControlPlans()[0]); }
  renderSourceInstructionGallery();
}

function applySourceTemplate(planId, options = {}) {
  const plan = sourceControlPlans().find(item => sourcePlanId(item) === String(planId)); if (!plan) { toast('Kaynak planı bulunamadı', 'Kalite dokümanı örnek kütüphanesini yeniden yükleyin.'); return; }
  const group = productBackbones[plan.productGroupId] ? plan.productGroupId : 'machined'; productGroup.value = group; syncProductTypes(); document.getElementById('productStructureType').value = plan.structureType || 'single_part'; syncProductLevelContext();
  const productTypeValue = plan.productType || (group === 'steering' ? 'Direksiyon Mafsalı' : 'Kullanıcı Tanımlı Mamul'); if ([...productType.options].some(option => option.value === productTypeValue)) productType.value = productTypeValue; else { productType.value = 'Kullanıcı Tanımlı Mamul'; customProductTypeName.value = productTypeValue; } syncCustomProductTypeField();
  const applicableProduct = productApplicabilityForPlan(plan); const sourceProductCode = sourcePlanPartNumber(plan); partNumber.value = plan.oemNumber || plan.customerPartNumber || sourceProductCode; internalProductCode.value = plan.internalProductCode || sourceProductCode; partName.value = recordLabel(applicableProduct, `${sourceProductCode} mamulü`); controlPlanNumber.value = sourcePlanNumber(plan); projectCode.value = plan.projectCode || `TY-${new Date().getFullYear()}-${sourceProductCode.replace(/[^A-Za-z0-9]+/g, '-').slice(0, 18)}`; document.getElementById('drawingNumber').value = sourcePlanDrawingNumber(plan); drawingRevision.value = sourcePlanDrawingRevision(plan);
  document.getElementById('supplierName').value = tenantOrganizationName(); document.getElementById('supplierSite').value = tenantPlantName(); document.getElementById('supplierCode').value = activeTenantProfile.supplierCode || '';
  const material = plan.material || plan.productDefinition?.material || {}; components = [componentRecord({ id: `SOURCE-RAW-${sourcePlanPartNumber(plan).replace(/[^A-Za-z0-9]+/g, '-').toUpperCase()}`, position: '10', parentId: 'FINISHED_GOOD', itemNo: `${sourcePlanPartNumber(plan)}-HM`, name: material.name || 'Hammadde / üretim taslağı', componentType: 'Hammadde', quantity: 1, makeBuy: 'Satın al', materialFamily: material.family || 'Teknik resimden seçilecek', materialGrade: material.grade || plan.materialGrade || 'Teknik resimden seçilecek', materialStandard: material.standard || 'Teknik resim / malzeme şartı', rawMaterialForm: material.rawForm || plan.rawMaterialForm || 'Özel', inputState: material.inputState || 'Hammadde', primaryManufacturingMethod: 'Talaşlı imalat', outputState: 'İşlenmiş parça', drawingNo: sourcePlanDrawingNumber(plan), revision: sourcePlanDrawingRevision(plan), supplier: 'Onaylı tedarikçi seçilecek', verificationStatus: 'Doğrulama bekliyor' })]; resetEngineeringUniverseFromComponents();
  selected = []; routeDetails = {}; const routeKeyByCode = new Map();
  sourcePlanOperationCodes(plan).forEach((code, index) => { const operation = operationPresetForCode(code) || { operationCode: code, nameTR: `Operasyon ${code}` }; const processId = canonicalProcessIdForOperation(operation); if (!processes.some(process => process.id === processId)) return; const routeKey = `${processId}::source-${code}-${index + 1}`; const profile = applicationProfileFor(operation, plan); const instructionPreset = sourceInstructionPresets().find(item => recordId(item) === profile.instructionPresetId) || instructionPresetForCode(code); selected.push(routeKey); routeKeyByCode.set(code, routeKey); routeDetails[routeKey] = { operationNo: code, operationCode: code, presetId: recordId(instructionPreset), variantId: recordId(profile), sourceDocumentId: sourcePlanId(plan), sourceRef: sourceReferenceText(profile.sourceRefs || operation.sourceRefs), sourceValidationStatus: 'pending', sourceValidationNote: '', inputComponentIds: index === 0 ? [components[0].id] : [], outputItemId: 'FINISHED_GOOD', workcenter: profile.workcenter || operation.workcenter || recordLabel(operation), machineId: (profile.machines || []).join(' / ') || profile.equipment || operation.equipment || 'Makine / hat ID kullanıcı tarafından seçilecek', tooling: profile.tooling || operation.tooling || 'Takım / fikstür kullanıcı tarafından seçilecek', programNo: profile.programNo || 'Program / reçete no-rev kullanıcı girişi', responsible: profile.responsible || operation.owner || 'Üretim', externalControlRef: profile.externalControlRef || 'Uygulanmıyor' }; });
  const sourceRecords = sourcePlanCharacteristicRecords(plan); characteristics = sourceRecords.length ? sourceRecords.map((record, index) => normalizeSourceCharacteristic(record, index, plan, routeKeyByCode)) : [newCharacteristic({ id: 'SOURCE-CHAR-001', name: 'Yeni teknik resim karakteristiği', sourceDrawing: sourcePlanDrawingNumber(plan), sourceStatus: 'Kaynak plan karakteristiği bulunamadı — kullanıcı girişi gerekli', specMode: 'text', specText: 'Teknik resimden girilecek' })];
  pfmeaRows = []; engineeringAnswers = {}; engineeringCustomQuestions = []; ppapRecords = {}; generatedDocumentRecords = []; drawingSource = { name: `${sourcePlanDrawingNumber(plan)}_REV-${sourcePlanDrawingRevision(plan)}.pdf`, size: 0, type: 'application/pdf', lastModified: null, sha256: '' };
  const drawingName = document.getElementById('drawingFileName'); if (drawingName) { drawingName.textContent = drawingSource.name; drawingName.nextElementSibling.textContent = `${sourcePlanNumber(plan)} kaynak omurgası bağlı • teknik resim dosyası ve SHA-256 doğrulaması bekleniyor`; }
  const selector = document.getElementById('productTemplate'); if (selector) selector.value = 'blank';
  bomSelectedId = 'FINISHED_GOOD'; renderComponents(); renderCharacteristics(); renderOptions(); renderSequence(); renderSourceIntegrationStudio(); updateSummary(); markDraftDirty();
  if (!options.stayOnProduct) showView('control'); toast('Kontrol planı omurgası uygulandı', `${sourcePlanNumber(plan)} • ${selected.length} operasyon • ${characteristics.length} düzenlenebilir kontrol noktası. Teknik doğrulama zorunludur.`);
}

function applySourceInstructionSelection() {
  const presets = sourceInstructionPresets().filter(preset => sourceInstructionUiState.pickedIds.has(recordId(preset))); if (!presets.length) { toast('Talimat preseti seçilmedi', 'Galeriden en az bir operasyon talimatı seçin.'); return; }
  presets.forEach((preset, index) => { const code = operationCodeOf(preset); let entry = selectedProcessEntries().find(candidate => String(candidate.detail.operationCode || '') === code); if (!entry) { const operation = operationPresetForCode(code) || preset; const processId = canonicalProcessIdForOperation(operation); if (!processes.some(process => process.id === processId)) return; const routeKey = `${processId}::source-${code}-${Date.now()}-${index}`; selected.push(routeKey); routeDetails[routeKey] = { operationNo: code, operationCode: code, presetId: recordId(preset), variantId: '', sourceDocumentId: preset.sourceControlPlanId || '', sourceRef: sourceReferenceText(preset.sourceRefs), sourceValidationStatus: 'pending', sourceValidationNote: '', inputComponentIds: [], outputItemId: 'FINISHED_GOOD', workcenter: recordLabel(operation), machineId: operation.equipment || 'Makine / hat ID kullanıcı tarafından seçilecek', tooling: operation.tooling || 'Takım / fikstür kullanıcı tarafından seçilecek', programNo: 'Program / reçete no-rev kullanıcı girişi', responsible: operation.owner || 'Üretim', externalControlRef: 'Uygulanmıyor' }; entry = selectedProcessEntries().find(candidate => candidate.routeKey === routeKey); }
    if (entry) { entry.detail.operationCode = code; entry.detail.presetId = recordId(preset); entry.detail.sourceRef = sourceReferenceText(preset.sourceRefs); entry.detail.sourceValidationStatus = 'pending'; }
  });
  renderOptions(); renderSequence(); buildInstructionModels(); renderInstructions(); document.getElementById('instructionEmpty')?.classList.add('hidden'); document.getElementById('instructionResult')?.classList.remove('hidden'); showView('instruction'); markDraftDirty(); toast('Talimat presetleri bağlandı', `${presets.length} preset • rota, PPE, iş adımı ve kalite kontrol matrisi birlikte oluşturuldu.`);
}

document.querySelector('[data-action="open-source-control"]')?.addEventListener('click', () => showView('control'));
document.querySelector('[data-action="open-source-instructions"]')?.addEventListener('click', () => showView('instruction'));
document.getElementById('sourceControlPlanSelect')?.addEventListener('change', event => renderSourceControlPreview(sourceControlPlans().find(plan => sourcePlanId(plan) === event.target.value)));
document.querySelector('[data-action="apply-source-control-template"]')?.addEventListener('click', () => applySourceTemplate(document.getElementById('sourceControlPlanSelect')?.value));
document.getElementById('sourceInstructionSearch')?.addEventListener('input', event => { sourceInstructionUiState.query = event.target.value; renderSourceInstructionGallery(); });
document.querySelectorAll('input[name="instructionProfile"]').forEach(input => input.addEventListener('change', event => { if (event.target.checked) { sourceInstructionUiState.profile = event.target.value; renderSourceInstructionGallery(); } }));
document.querySelector('[data-action="apply-source-instruction-presets"]')?.addEventListener('click', applySourceInstructionSelection);

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
  if (isProcessSelected(id)) {
    const removedKeys = selected.filter(item => routeBaseId(item) === id); removedKeys.forEach(key => delete routeDetails[key]); selected = selected.filter(item => routeBaseId(item) !== id);
    components.forEach(component => ['producedAtProcessId', 'firstUseProcessId', 'mountedAtProcessId', 'inspectedAtProcessId', 'prerequisiteProcessId', 'nextProcessId'].forEach(field => { if (removedKeys.includes(component[field]) || component[field] === id) component[field] = ''; }));
    characteristics.forEach(characteristic => { if (removedKeys.includes(characteristic.routeKey) || characteristic.processId === id) { characteristic.routeKey = ''; characteristic.processId = ''; } });
  }
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
  sequenceEl.innerHTML = entries.length ? entries.map(({ routeKey, process, detail, index }) => `<div class="sequence-item" draggable="true" data-sequence-index="${index}" data-route-key="${escapeHtml(routeKey)}"><span class="drag" title="Sürükleyerek sırala">⠿</span><span class="op-number">OP ${escapeHtml(detail.operationNo)}</span><span><strong>${escapeHtml(detail.operationLabelTR || process.name)}</strong><small>${escapeHtml(detail.operationLabelEN || process.desc)} • ${escapeHtml(detail.workcenter)}</small></span><span class="sequence-tags">${detail.operationCode ? `<mark class="source-route-tag">OP KODU ${escapeHtml(detail.operationCode)}</mark>` : ''}${detail.operationCodeRequiresReview ? '<mark class="operation-review-tag">KOD İNCELEMESİ</mark>' : ''}${detail.presetId ? '<mark class="preset-route-tag">Talimat bağlı</mark>' : ''}${sourceValidationApproved(detail) ? '<mark class="bom-route-tag">Kaynak onaylı</mark>' : (detail.presetId || detail.sourceDocumentId || detail.operationCodeRequiresReview ? '<mark>Kaynak doğrulaması açık</mark>' : '')}${process.special ? '<mark>Özel Proses</mark>' : ''}${process.outsource ? '<mark>Dış Kaynak</mark>' : ''}${detail.inputComponentIds.length ? `<mark class="bom-route-tag">${detail.inputComponentIds.length} BOM girdisi</mark>` : ''}</span><span class="sequence-order"><button data-edit-route="${index}" aria-label="Operasyon detayını düzenle">⚙</button><button data-duplicate="${index}" aria-label="Bu prosesi tekrarla">⧉</button><button data-move-up="${index}" aria-label="Yukarı taşı">↑</button><button data-move-down="${index}" aria-label="Aşağı taşı">↓</button></span><button data-remove-index="${index}" aria-label="Kaldır">×</button><div class="route-instance-panel"><div class="route-instance-grid">
      <label>Operasyon no<input data-route-field="operationNo" value="${escapeHtml(detail.operationNo)}"></label>
      <label>Kurumsal operasyon kodu<input data-route-field="operationCode" list="operationCodeLibraryOptions" value="${escapeHtml(detail.operationCode || '')}" placeholder="380 TR/EN koddan seçin"></label>
      <label>Talimat preset ID<input data-route-field="presetId" value="${escapeHtml(detail.presetId || '')}" placeholder="Kütüphaneden seçilebilir"></label>
      <label>Kaynak / risk teknik kararı<select data-route-field="sourceValidationStatus"><option value="pending" ${detail.sourceValidationStatus === 'pending' ? 'selected' : ''}>Doğrulama bekliyor</option><option value="drawing-verified" ${detail.sourceValidationStatus === 'drawing-verified' ? 'selected' : ''}>Teknik resimle doğrulandı</option><option value="engineering-approved" ${detail.sourceValidationStatus === 'engineering-approved' ? 'selected' : ''}>Mühendislik onaylı</option><option value="rejected" ${detail.sourceValidationStatus === 'rejected' ? 'selected' : ''}>Reddedildi / revizyon gerekli</option><option value="not-applicable" ${detail.sourceValidationStatus === 'not-applicable' ? 'selected' : ''}>Uygulanamaz</option></select></label>
      <label>Teknik karar / kanıt notu<input data-route-field="sourceValidationNote" value="${escapeHtml(detail.sourceValidationNote || '')}" placeholder="Onay, rapor veya düzeltme referansı"></label>
      <label>Sorumlu fonksiyon<input data-route-field="responsible" value="${escapeHtml(detail.responsible)}"></label>
      <label>İş merkezi / hat<input data-route-field="workcenter" value="${escapeHtml(detail.workcenter)}"></label>
      <label>Makine / ekipman ID<div class="route-machine-picker"><input value="${escapeHtml((detail.selectedMachines || []).join(' / ') || detail.machineId || '')}" placeholder="77 kayıtlı makineden seçin" readonly><button type="button" data-route-machine-select="${escapeHtml(routeKey)}">Makine Seç</button></div><small>${escapeHtml(detail.machineClassId ? `İzinli sınıf: ${detail.machineClassId}` : 'Operasyon uygunluğuna göre çoklu seçim')}</small></label>
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
  sequenceEl.querySelectorAll('[data-route-machine-select]').forEach(button => button.addEventListener('click', () => globalThis.TyanaProductDefinition?.openDocumentRouteMachineDialog(button.dataset.routeMachineSelect)));
  sequenceEl.querySelectorAll('[data-route-field]').forEach(field => {
    const update = event => {
      const routeItem = event.target.closest('.sequence-item'); const routeKey = routeItem.dataset.routeKey; const detail = routeDetails[routeKey]; const key = event.target.dataset.routeField; const previous = key === 'inputComponentIds' ? [...(detail[key] || [])] : detail[key];
      detail[key] = key === 'inputComponentIds' ? [...event.target.selectedOptions].map(option => option.value) : event.target.value;
      if (key === 'operationCode') {
        bindOperationCodeMetadata(detail, detail.operationCode);
        detail.selectedMachines = [];
        detail.machineId = '';
      }
      if (key === 'inputComponentIds') {
        components.forEach(component => {
          const wasLinked = previous.includes(component.id); const linked = detail.inputComponentIds.includes(component.id);
          if (wasLinked && !linked) ['firstUseProcessId', 'mountedAtProcessId', 'inspectedAtProcessId'].forEach(field => { if (component[field] === routeKey) component[field] = ''; });
          if (!wasLinked && linked && !component.firstUseProcessId) component.firstUseProcessId = routeKey;
          if (linked && ['assembly', 'integrated-assembly', 'post-paint-assembly', 'press-assembly', 'torque'].includes(routeBaseId(routeKey)) && !component.mountedAtProcessId) component.mountedAtProcessId = routeKey;
          component.operationLinkStatus = [component.producedAtProcessId, component.firstUseProcessId, component.mountedAtProcessId, component.inspectedAtProcessId].some(Boolean) ? 'Atandı' : 'Henüz atanmadı';
        });
      }
      if (key === 'outputItemId') {
        components.forEach(component => { if (component.producedAtProcessId === routeKey && component.id !== detail.outputItemId) component.producedAtProcessId = ''; });
        const output = components.find(component => component.id === detail.outputItemId); if (output) { output.producedAtProcessId = routeKey; output.operationLinkStatus = 'Atandı'; }
      }
      markDraftDirty(); if (key === 'operationNo' || key === 'workcenter' || key === 'inputComponentIds') { routeItem.querySelector('.op-number').textContent = `OP ${detail.operationNo}`; routeItem.querySelector(':scope > span:nth-of-type(3) small').textContent = `${processes.find(process => process.id === routeBaseId(routeKey))?.desc || ''} • ${detail.workcenter}`; }
    };
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
  renderPfmeaLibrarySelectors();
  syncPfmeaFromRoute();
  if (document.getElementById('characteristicRows')) renderCharacteristics();
}

function renderFlowDiagram() {
  syncPfmeaFromRoute();
  const entries = selectedProcessEntries();
  document.getElementById('flowCanvas').innerHTML = entries.map(({ process, detail }) => { const inputs = detail.inputComponentIds.map(id => components.find(item => item.id === id)?.name).filter(Boolean); const output = detail.outputItemId === 'FINISHED_GOOD' ? partName.value : components.find(item => item.id === detail.outputItemId)?.name; const identity = routeOperationIdentity(process, detail); return `<div class="flow-node ${process.control ? 'control' : ''} ${process.outsource ? 'outsource' : ''}"><span class="node-op">OP ${escapeHtml(detail.operationNo)}${identity.code ? ` • KOD ${escapeHtml(identity.code)}` : ''}</span><b>${escapeHtml(identity.labelTR)}</b><small>${escapeHtml(identity.labelEN || process.desc)}</small><em>${inputs.length ? `Girdi: ${escapeHtml(inputs.join(', '))}` : 'Girdi BOM eşlemesi bekliyor'} → ${escapeHtml(output || 'çıktı seçin')}</em></div>`; }).join('');
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
  renderOperationCodeCatalog();
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
  const masterCount = document.getElementById('processMasterTabCount'); if (masterCount) masterCount.textContent = processes.filter(process => process.status !== 'archived').length;
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

let activeLibraryMode = 'process';
function setLibraryMode(mode = 'process') {
  activeLibraryMode = ['process', 'operation', 'machine'].includes(mode) ? mode : 'process';
  document.querySelectorAll('[data-library-mode-button]').forEach(button => {
    const active = button.dataset.libraryModeButton === activeLibraryMode;
    button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('[data-library-mode-panel]').forEach(panel => panel.classList.toggle('hidden', panel.dataset.libraryModePanel !== activeLibraryMode));
  ['export-library', 'new-process'].forEach(action => document.querySelector(`#library [data-action="${action}"]`)?.classList.toggle('hidden', activeLibraryMode !== 'process'));
  if (activeLibraryMode === 'operation') renderOperationCodeCatalog();
  else if (activeLibraryMode === 'machine') globalThis.TyanaProductDefinition?.renderMachineLibrary();
  else renderProcessLibrary();
}

function operationCodeUsage(code) { return selectedProcessEntries().filter(entry => String(entry.detail.operationCode || '') === String(code)); }
function ensureOperationFamilyFilterOptions() {
  const select = document.getElementById('operationCatalogFamilyFilter'); if (!select) return;
  const current = select.value || 'all';
  const families = [...new Set(operationCodeEntries().map(record => operationProcessCard(record)?.family).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  select.innerHTML = '<option value="all">Tüm proses aileleri</option>' + families.map(family => `<option value="${escapeHtml(family)}">${escapeHtml(family)}</option>`).join('');
  select.value = families.includes(current) ? current : 'all';
}
function filteredOperationCodeEntries() {
  const search = (document.getElementById('operationCatalogSearch')?.value || '').trim().toLocaleLowerCase('tr-TR');
  const filter = document.getElementById('operationCatalogReviewFilter')?.value || 'all';
  const family = document.getElementById('operationCatalogFamilyFilter')?.value || 'all';
  return operationCodeEntries().filter(record => {
    const card = operationProcessCard(record);
    const used = operationCodeUsage(record.code).length > 0;
    const haystack = `${record.code} ${record.labels?.tr || ''} ${record.labels?.en || ''} ${card?.family || ''} ${card?.category || ''} ${card?.equipment || ''} ${card?.machineClassId || ''} ${(card?.equipmentRequirements?.productSpecificMachineIds || []).join(' ')}`.toLocaleLowerCase('tr-TR');
    return (!search || haystack.includes(search)) && (family === 'all' || card?.family === family) && (filter === 'all' || (filter === 'review' && (record.requiresReview || card?.mapping?.requiresReview)) || (filter === 'ready' && !record.requiresReview && !card?.mapping?.requiresReview) || (filter === 'used' && used));
  });
}

function addOperationCodeToRoute(code, options = {}) {
  const record = operationCodeRecord(code); if (!record) { toast('Operasyon kodu bulunamadı', `${code} katalogda yer almıyor.`); return; }
  const card = operationProcessCard(record);
  const processId = canonicalProcessIdForOperation(record);
  const process = processes.find(item => item.id === processId && item.status !== 'archived') || processes.find(item => item.status !== 'archived');
  if (!process) { toast('Aktif proses kartı yok', 'Önce en az bir standart proses kartı oluşturun.'); return; }
  const routeKey = `${process.id}::operation-${record.code}-${crypto.randomUUID()}`;
  selected.push(routeKey);
  const detail = routeDetailFor(routeKey, process, selected.length - 1);
  detail.operationNo = String(selected.length * 10).padStart(2, '0');
  detail.operationCode = record.code;
  detail.sourceDocumentId = operationCodeLibrary?.libraryId || 'tyana.qflow.operation-codes.tr-en';
  detail.sourceRef = `${record.sourceRef?.worksheet || 'Operasyon kodları'} • satır ${record.sourceRef?.row || '—'}`;
  detail.sourceValidationStatus = 'pending';
  detail.sourceValidationNote = card?.equipmentRequirements?.machineCapabilityApprovalRequired
    ? 'Makine sınıfı eşleşmesi tesis proses mühendisi tarafından doğrulanacak.'
    : 'Belgeli makine adaylarından ürün uygulanabilirliği doğrulanarak seçim yapılacak.';
  detail.workcenter = card?.family || record.labels?.tr || process.name;
  const documentedMachines = card?.equipmentRequirements?.productSpecificMachineIds || [];
  detail.machineId = documentedMachines.length ? `Makine seçin • ${documentedMachines.join(' / ')}` : `Makine sicilinden seçin • ${card?.machineClassId || 'sınıf bekliyor'}`;
  detail.tooling = card?.tooling || 'Takım / fikstür seçin';
  detail.programNo = 'Program / reçete no-rev girin';
  detail.responsible = card?.owner || process.owner || 'Üretim Mühendisliği';
  detail.inputComponentIds = [...new Set([...(detail.inputComponentIds || []), ...(options.inputComponentIds || [])])];
  detail.inputComponentIds.forEach(componentId => {
    const component = components.find(item => item.id === componentId); if (!component) return;
    if (!component.firstUseProcessId) component.firstUseProcessId = routeKey;
    component.mountedAtProcessId = routeKey; component.operationLinkStatus = 'Atandı';
  });
  bindOperationCodeMetadata(detail, record.code);
  renderOptions(document.querySelector('.library-search input')?.value || ''); renderSequence(); renderOperationCodeCatalog(); markDraftDirty();
  toast(record.requiresReview ? 'Kod rotaya eklendi — inceleme açık' : 'Operasyon rotaya eklendi', `${record.code} • ${record.labels?.tr || ''} • OP ${detail.operationNo}`);
  return routeKey;
}

function attachBomAssemblyOperationToRoute(definitionId, lineId) {
  const definition = engineeringUniverse?.bomDefinitions.find(item => item.id === definitionId);
  const line = definition?.lines.find(item => item.id === lineId);
  if (!line?.assemblyOperationCode) { toast('Rota bağlantısı açılamadı', 'Önce BOM satırında 380 kodluk montaj operasyon kodunu seçin.'); return; }
  const inputComponentIds = components.filter(component => component.legacyBomLineId === line.id).map(component => component.id);
  if (!inputComponentIds.length) { projectEngineeringUniverseToComponents(); inputComponentIds.push(...components.filter(component => component.legacyBomLineId === line.id).map(component => component.id)); }
  const existing = selectedProcessEntries().find(entry => String(entry.detail.operationCode || '') === String(line.assemblyOperationCode));
  if (existing) {
    existing.detail.inputComponentIds = [...new Set([...(existing.detail.inputComponentIds || []), ...inputComponentIds])];
    inputComponentIds.forEach(componentId => { const component = components.find(item => item.id === componentId); if (component) { if (!component.firstUseProcessId) component.firstUseProcessId = existing.routeKey; component.mountedAtProcessId = existing.routeKey; component.operationLinkStatus = 'Atandı'; } });
    bindOperationCodeMetadata(existing.detail, line.assemblyOperationCode); renderSequence(); renderEngineeringBomDefinitionEditor(); markDraftDirty();
    toast('BOM satırı rotaya bağlandı', `${line.assemblyOperationCode} • ${inputComponentIds.length} kullanım girdisi • OP ${existing.detail.operationNo}`); return existing.routeKey;
  }
  const routeKey = addOperationCodeToRoute(line.assemblyOperationCode, { inputComponentIds });
  if (routeKey) { renderEngineeringBomDefinitionEditor(); toast('BOM operasyonu rotaya bağlandı', `${line.assemblyOperationCode} • ${inputComponentIds.length} kullanım girdisi bağlandı.`); }
  return routeKey;
}

function renderOperationCodeCatalog() {
  const body = document.getElementById('operationCodeRows'); if (!body) return;
  ensureOperationFamilyFilterOptions();
  const records = operationCodeEntries(); const filtered = filteredOperationCodeEntries();
  const reviews = records.filter(record => record.requiresReview).length;
  const countTargets = { operationCatalogCount: records.length, operationReviewCount: reviews, operationAmbiguityCount: operationCodeLibrary?.qualityReview?.mappingAmbiguities?.length || 0, operationCatalogTabCount: records.length };
  Object.entries(countTargets).forEach(([id, value]) => { const element = document.getElementById(id); if (element) element.textContent = value; });
  const result = document.getElementById('operationCatalogResultCount'); if (result) result.textContent = `${filtered.length} / ${records.length} standart proses kartı`;
  if (!filtered.length) { body.innerHTML = '<div class="library-empty"><b>Kriterlere uygun operasyon kodu bulunamadı.</b><br>Arama veya inceleme filtresini temizleyin.</div>'; return; }
  body.innerHTML = filtered.map(record => {
    const usage = operationCodeUsage(record.code);
    const card = operationProcessCard(record); const override = operationProcessOverride(record);
    const requirements = card?.equipmentRequirements || {}; const documentedMachines = requirements.productSpecificMachineIds || [];
    const reviewRequired = record.requiresReview || card?.mapping?.requiresReview;
    const mappedProcess = processes.find(process => process.id === canonicalProcessIdForOperation(record));
    return `<div class="operation-code-row ${usage.length ? 'used' : ''}">
      <span><b class="operation-code-value">${escapeHtml(record.code)}</b></span>
      <span class="operation-label"><b>${escapeHtml(record.labels?.tr || '—')}</b><small>${escapeHtml(card?.family || 'Aile bekliyor')} • ${escapeHtml(mappedProcess?.name || card?.canonicalProcessName || 'Eşleme gerekli')}</small></span>
      <span class="operation-label"><b>${escapeHtml(record.labels?.en || '—')}</b><small>${escapeHtml(card?.machineClassId || 'Makine sınıfı bekliyor')}</small></span>
      <span class="operation-code-status"><mark class="${reviewRequired ? 'review' : ''}">${reviewRequired ? 'İNCELEME GEREKLİ' : 'SEÇİLEBİLİR KART'}</mark>${override ? '<mark class="used">TESİS OVERRIDE</mark>' : ''}${usage.length ? `<mark class="used">ROTADA ${usage.length}×</mark>` : ''}<small>${documentedMachines.length ? `${documentedMachines.length} belgeli makine adayı` : 'Tesis makine onayı gerekli'}</small></span>
      <span class="operation-code-actions"><button type="button" data-toggle-operation-card="${escapeHtml(record.code)}">Kartı Aç</button><button type="button" data-edit-operation-card="${escapeHtml(record.code)}">Düzenle</button><button type="button" data-add-operation-code="${escapeHtml(record.code)}">＋ Rota</button></span>
      <div class="operation-card-details">
        <article><b>Aile / kategori</b><span>${escapeHtml(`${card?.family || '—'} • ${card?.category || '—'}`)}</span><small>${escapeHtml(card?.desc || '')}</small></article>
        <article><b>Makine / ekipman</b><span>${escapeHtml(card?.equipment || '—')}</span><small>${escapeHtml(`${card?.machineClassId || 'Sınıf bekliyor'}${documentedMachines.length ? ` • Belgeli ID: ${documentedMachines.join(', ')}` : ' • Makine sicilinden seçim ve yetenek onayı'}`)}</small></article>
        <article><b>Takım / girdi → çıktı</b><span>${escapeHtml(card?.tooling || '—')}</span><small>${escapeHtml(`${card?.inputMaterial || '—'} → ${card?.outputMaterial || '—'}`)}</small></article>
        <article><b>Kontrol planı bağı</b><span>${escapeHtml(card?.controlMethod || '—')}</span><small>${escapeHtml((card?.characteristics || []).join(' • '))}</small></article>
        <article><b>PFMEA / reaksiyon</b><span>${escapeHtml(card?.pfmeaFunction || '—')}</span><small>${escapeHtml(`${(card?.riskTemplate || []).join(' • ')} | ${card?.reactionPlan || ''}`)}</small></article>
        <article><b>Yönetim / standart</b><span>${escapeHtml(`${card?.owner || '—'} • Rev. ${card?.revision || 'A'} • ${card?.approvalStatus || 'draft'}`)}</span><small>${escapeHtml(`${(card?.standardRefs || []).join(' • ')} • Eşleme: ${card?.mapping?.confidence || '—'}`)}</small></article>
        <article class="operation-card-source"><b>Değişmez kaynak kimliği ve doküman bağları</b><span>${escapeHtml(`${record.id} • ${record.sourceRef?.worksheet || '—'} satır ${record.sourceRef?.row || '—'} • ${card?.workInstruction || '—'}`)}</span><small>${escapeHtml((requirements.bindingSourceRefs || []).join(' • ') || 'Ürüne özel belgeli makine bağı yok; tesis makine sicili onayı bekleniyor.')}</small></article>
      </div>
    </div>`;
  }).join('');
  body.querySelectorAll('[data-toggle-operation-card]').forEach(button => button.addEventListener('click', () => {
    button.closest('.operation-code-row')?.classList.toggle('card-expanded');
    button.textContent = button.closest('.operation-code-row')?.classList.contains('card-expanded') ? 'Kartı Kapat' : 'Kartı Aç';
  }));
  body.querySelectorAll('[data-edit-operation-card]').forEach(button => button.addEventListener('click', () => openOperationProcessCardEditor(button.dataset.editOperationCard)));
  body.querySelectorAll('[data-add-operation-code]').forEach(button => button.addEventListener('click', () => addOperationCodeToRoute(button.dataset.addOperationCode)));
}

async function exportOperationCodeLibrary() {
  if (!globalThis.ExcelJS) throw new Error('Excel motoru yüklenemedi.');
  const records = operationCodeEntries(); if (!records.length) throw new Error('Operasyon kodu kütüphanesi boş.');
  const workbook = new ExcelJS.Workbook(); workbook.creator = 'TYANA Q-FLOW • Eren'; workbook.created = new Date();
  const sheet = workbook.addWorksheet('Standart Proses Kartları', { views: [{ state: 'frozen', xSplit: 3, ySplit: 3 }] });
  const headers = ['Kod', 'Türkçe Operasyon', 'English Operation', 'Aile', 'Kategori', 'Canonical Proses', 'Kart ID', 'Makine Sınıfı', 'Belgeli Makine ID', 'Makine Bağı Kaynağı', 'Ekipman', 'Takım / Fikstür', 'Girdi', 'Çıktı', 'Kontrol Metodu', 'Kontrol Karakteristikleri', 'PFMEA Fonksiyonu', 'PFMEA Risk Taslakları', 'Reaksiyon Planı', 'Sorumlu', 'Özel Proses', 'Dış Kaynak', 'Operatör Talimatı', 'Standart Referansları', 'Revizyon / Durum / Onay', 'Eşleme / İnceleme', 'Kaynak Satır', 'Rotada Kullanım', 'Tesis Override'];
  sheet.columns = [10, 30, 30, 20, 16, 24, 28, 25, 28, 34, 30, 28, 25, 25, 36, 42, 38, 42, 48, 22, 13, 13, 18, 42, 24, 34, 13, 14, 18].map(width => ({ width }));
  sheet.mergeCells('A1:AC1'); sheet.getCell('A1').value = 'TYANA Q-FLOW • 380 STANDART PROSES KARTI / MAKİNE–OPERASYON KÜTÜPHANESİ';
  sheet.getCell('A1').font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FFFFFFFF' } }; sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10213F' } }; sheet.getCell('A1').alignment = { horizontal: 'center' }; sheet.getRow(1).height = 28;
  sheet.getRow(3).values = headers;
  records.forEach(record => {
    const card = operationProcessCard(record); const requirements = card?.equipmentRequirements || {}; const override = operationProcessOverride(record);
    sheet.addRow([
      record.code, record.labels?.tr, record.labels?.en, card?.family, card?.category, `${card?.canonicalProcessCode || ''} • ${card?.canonicalProcessName || ''}`, card?.cardId,
      card?.machineClassId, (requirements.productSpecificMachineIds || []).join(' • '), (requirements.bindingSourceRefs || []).join(' • '), card?.equipment, card?.tooling,
      card?.inputMaterial, card?.outputMaterial, card?.controlMethod, (card?.characteristics || []).join(' • '), card?.pfmeaFunction, (card?.riskTemplate || []).join(' • '), card?.reactionPlan,
      card?.owner, card?.special ? 'Evet' : 'Hayır', card?.outsource ? 'Evet' : 'Hayır', card?.workInstruction, (card?.standardRefs || []).join(' • '),
      `Rev. ${card?.revision || 'A'} • ${card?.status || 'active'} • ${card?.approvalStatus || 'draft'}`,
      `${card?.mapping?.confidence || '—'} • ${card?.mapping?.ruleId || '—'}${card?.mapping?.requiresReview ? ` • ${(card.mapping.reviewReasons || []).join(', ')}` : ''}`,
      record.sourceRef?.row || '', operationCodeUsage(record.code).length, override ? `${override.code} • v${override.version || 1}` : '—'
    ].map(safeExcelValue));
  });
  const border = { top: { style: 'thin', color: { argb: 'FFD3DBE8' } }, left: { style: 'thin', color: { argb: 'FFD3DBE8' } }, bottom: { style: 'thin', color: { argb: 'FFD3DBE8' } }, right: { style: 'thin', color: { argb: 'FFD3DBE8' } } };
  sheet.getRow(3).eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF245CC7' } }; cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
  sheet.eachRow((row, rowNumber) => { if (rowNumber >= 3) row.eachCell(cell => { cell.border = border; if (rowNumber > 3) { cell.font = { name: 'Arial', size: 9 }; cell.alignment = { vertical: 'middle', wrapText: true }; } }); });
  sheet.autoFilter = { from: 'A3', to: 'AC3' }; sheet.pageSetup = { paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printArea: `A1:AC${records.length + 3}` };

  const machines = operationCodeLibrary?.machineRegisterSeeds || [];
  const machineSheet = workbook.addWorksheet('Makine-Operasyon Matrisi', { views: [{ state: 'frozen', ySplit: 3 }] });
  machineSheet.columns = [18, 28, 30, 44, 38, 36, 22, 22, 18].map(width => ({ width }));
  machineSheet.mergeCells('A1:I1'); machineSheet.getCell('A1').value = 'BELGELİ MAKİNE ID ↔ OPERASYON KODU MATRİSİ';
  machineSheet.getCell('A1').font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }; machineSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F6B64' } }; machineSheet.getCell('A1').alignment = { horizontal: 'center' };
  machineSheet.getRow(3).values = ['Makine ID', 'Makine Sınıfları', 'Operasyon Kodları', 'Operasyonlar', 'Yetenek / Ekipman', 'Kaynak Referansları', 'Kalibrasyon', 'Kalifikasyon', 'Durum'];
  machines.forEach(machine => machineSheet.addRow([machine.machineId, (machine.machineClassIds || []).join(' • '), (machine.supportedOperationCodes || []).join(' • '), (machine.supportedOperationLabels || []).join(' • '), (machine.capabilities || []).join(' • '), (machine.sourceRefs || []).join(' • '), machine.calibrationStatus, machine.qualificationStatus, machine.status].map(safeExcelValue)));
  machineSheet.getRow(3).eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17877F' } }; cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
  machineSheet.eachRow((row, rowNumber) => { if (rowNumber >= 3) row.eachCell(cell => { cell.border = border; cell.alignment = { vertical: 'middle', wrapText: true }; }); });
  machineSheet.autoFilter = { from: 'A3', to: 'I3' }; machineSheet.pageSetup = { paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printArea: `A1:I${Math.max(3, machines.length + 3)}` };

  const classSheet = workbook.addWorksheet('Makine Sınıfları', { views: [{ state: 'frozen', ySplit: 3 }] });
  classSheet.columns = [28, 24, 24, 34, 48, 40, 36].map(width => ({ width }));
  classSheet.mergeCells('A1:G1'); classSheet.getCell('A1').value = 'MAKİNE SINIFI ↔ STANDART PROSES KARTI MATRİSİ';
  classSheet.getCell('A1').font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }; classSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B3A91' } }; classSheet.getCell('A1').alignment = { horizontal: 'center' };
  classSheet.getRow(3).values = ['Makine Sınıfı', 'Proses Ailesi', 'Kategori', 'Varsayılan Ekipman', 'Operasyon Kodları', 'Belgeli Makine ID', 'Yetenek Gereksinimleri'];
  (operationCodeLibrary?.machineClasses || []).forEach(machineClass => classSheet.addRow([machineClass.id, machineClass.family, machineClass.category, machineClass.name, (machineClass.operationCodes || []).join(' • '), (machineClass.documentedMachineIds || []).join(' • '), (machineClass.requiredCapabilities || []).join(' • ')].map(safeExcelValue)));
  classSheet.getRow(3).eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7652AE' } }; cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
  classSheet.eachRow((row, rowNumber) => { if (rowNumber >= 3) row.eachCell(cell => { cell.border = border; cell.alignment = { vertical: 'middle', wrapText: true }; }); });
  classSheet.autoFilter = { from: 'A3', to: 'G3' }; classSheet.pageSetup = { paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printArea: `A1:G${Math.max(3, (operationCodeLibrary?.machineClasses || []).length + 3)}` };

  const buffer = await workbook.xlsx.writeBuffer(); const verification = new ExcelJS.Workbook(); await verification.xlsx.load(buffer);
  if (verification.getWorksheet('Standart Proses Kartları')?.rowCount !== records.length + 3 || verification.getWorksheet('Makine-Operasyon Matrisi')?.rowCount !== Math.max(3, machines.length + 3) || verification.getWorksheet('Makine Sınıfları')?.rowCount !== Math.max(3, (operationCodeLibrary?.machineClasses || []).length + 3)) throw new Error('Standart proses kartı Excel doğrulaması başarısız.');
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const result = await saveBlob(blob, `TYANA_Q-FLOW_Standart_Proses_Kartlari_${new Date().toISOString().slice(0, 10)}.xlsx`, exportFileTypes.xlsx, { track: false });
  if (result.saved) toast('Standart proses kartları dışa aktarıldı', `${records.length} kart • ${machines.length} belgeli makine • ${(operationCodeLibrary?.machineClasses || []).length} makine sınıfı kaydedildi.`);
  return result;
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

let editingOperationCardContext = null;
function openOperationProcessCardEditor(code) {
  const record = operationCodeRecord(code); if (!record) { toast('Standart proses kartı bulunamadı', `${code} katalogda yok.`); return; }
  const existing = operationProcessOverride(record, true); const card = record.standardProcessCard;
  const seed = existing || {
    ...card,
    id: '', version: 0, code: `OP-${record.code}`, name: `${String(record.labels?.tr || '').trim()} • ${record.code}`,
    sourceOperationCode: record.code, standardProcessCardId: card.cardId, status: 'active', approvalStatus: 'draft'
  };
  openProcessDrawer(seed, record);
}

function openProcessDrawer(process = null, operationRecord = null) {
  const drawer = document.getElementById('processDrawer');
  const sourceRecord = operationRecord || operationCodeRecord(process?.sourceOperationCode);
  editingOperationCardContext = sourceRecord ? { record: sourceRecord, card: sourceRecord.standardProcessCard } : null;
  const editing = Boolean(process?.id);
  document.getElementById('processDrawerTitle').textContent = editingOperationCardContext ? 'Standart Operasyon Kartını Düzenle' : (editing ? 'Standart Prosesi Düzenle' : 'Yeni Proses Tanımla');
  document.getElementById('processDrawerSubtitle').textContent = editingOperationCardContext
    ? `${sourceRecord.code} • ${String(sourceRecord.labels?.tr || '').trim()} • kaynak satır ${sourceRecord.sourceRef?.row || '—'} değişmez; bu form tesis override revizyonudur.`
    : (editing ? `${process.code} • Son kayıt revizyonu ${process.revision}` : 'Kalite dokümanlarının kullanacağı ana proses kaydı');
  Object.entries(processFormFields).forEach(([key, elementId]) => {
    const element = document.getElementById(elementId);
    let value = process?.[key] ?? '';
    if (key === 'owner' && !value) value = 'Kalite Mühendisliği';
    if (key === 'revision' && !value) value = 'A';
    if (key === 'approvalStatus') value = 'draft';
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
  document.getElementById('processCode').disabled = Boolean(editingOperationCardContext);
  drawer.classList.remove('hidden');
  drawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('drawer-open');
  setTimeout(() => document.getElementById(editingOperationCardContext ? 'processName' : 'processCode').focus(), 80);
}

function closeProcessDrawer() {
  const drawer = document.getElementById('processDrawer');
  drawer.classList.add('hidden');
  drawer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('drawer-open');
  document.getElementById('processCode').disabled = false;
  editingOperationCardContext = null;
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
  payload.approvalStatus = 'draft';
  if (editingOperationCardContext) {
    const { record, card } = editingOperationCardContext;
    Object.assign(payload, {
      sourceOperationCode: record.code,
      sourceOperationLabels: { tr: record.labels?.tr || '', en: record.labels?.en || '' },
      sourceOperationRef: record.sourceRef ? JSON.parse(JSON.stringify(record.sourceRef)) : null,
      sourceOperationLibraryId: operationCodeLibrary?.libraryId || 'tyana.qflow.operation-codes.tr-en',
      standardProcessCardId: card.cardId,
      canonicalProcessId: card.canonicalProcessId,
      machineClassId: card.machineClassId,
      allowedMachineClasses: [...(card.allowedMachineClasses || [])],
      equipmentRequirements: JSON.parse(JSON.stringify(card.equipmentRequirements || {})),
      qualityLinks: JSON.parse(JSON.stringify(card.qualityLinks || {})),
      standardRefs: [...(card.standardRefs || [])],
      immutableSourceIdentity: JSON.parse(JSON.stringify(card.immutableSourceIdentity || {})),
      cardOverride: true
    });
  }
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
    ensureOperationMachineOptions(); renderOperationCodeCatalog();
    toast(saved.sourceOperationCode ? 'Standart operasyon kartı override kaydedildi' : (id ? 'Proses revizyonu kaydedildi' : 'Yeni proses oluşturuldu'), `${saved.code} • ${saved.name} kütüphaneye işlendi.`);
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
    renderProcessLibrary(); renderOptions(); renderSequence(); renderOperationCodeCatalog();
    toast(restore ? 'Proses aktifleştirildi' : 'Proses arşivlendi', `${process.code} kayıt durumu güncellendi.`);
  } catch (error) {
    document.getElementById('processFormStatus').textContent = error.message;
  }
}

async function exportProcessLibrary() {
  if (!globalThis.ExcelJS) { toast('Excel motoru yüklenemedi', 'Uygulama paketini yeniden kurun.'); return; }
  const headers = ['Kod', 'Proses', 'Aile', 'Kategori', 'Ekipman', 'Kontrol Metodu', 'Özel Proses', 'Dış Kaynak', 'Çevrim sn', 'Revizyon', 'Onay'];
  const rows = processes.map(process => [process.code, process.name, process.family, process.category, process.equipment, process.controlMethod, process.special ? 'Evet' : 'Hayır', process.outsource ? 'Evet' : 'Hayır', process.cycleTimeSec, process.revision, process.approvalStatus]);
  const workbook = new ExcelJS.Workbook(); workbook.creator = `${tenantProductName()} • ${tenantShortName()} • Eren`; workbook.created = new Date();
  const sheet = workbook.addWorksheet('Proses Kütüphanesi', { views: [{ state: 'frozen', ySplit: 3 }] });
  sheet.columns = [16, 28, 22, 18, 30, 42, 14, 14, 14, 12, 14].map(width => ({ width }));
  sheet.mergeCells('A1:K1'); sheet.getCell('A1').value = `${tenantBrandLine()} • PROSES KÜTÜPHANESİ`; sheet.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }; sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10213F' } }; sheet.getCell('A1').alignment = { horizontal: 'center' }; sheet.getRow(1).height = 28;
  sheet.getRow(3).values = headers; sheet.getRow(3).height = 28;
  rows.forEach(row => sheet.addRow(row.map(safeExcelValue)));
  const border = { top: { style: 'thin', color: { argb: 'FF8792A5' } }, left: { style: 'thin', color: { argb: 'FF8792A5' } }, bottom: { style: 'thin', color: { argb: 'FF8792A5' } }, right: { style: 'thin', color: { argb: 'FF8792A5' } } };
  sheet.getRow(3).eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF245CC7' } }; cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
  sheet.eachRow((row, rowNumber) => { if (rowNumber >= 3) row.eachCell(cell => { cell.border = border; if (rowNumber > 3) { cell.font = { name: 'Arial', size: 9 }; cell.alignment = { vertical: 'middle', wrapText: true }; } }); });
  sheet.autoFilter = { from: 'A3', to: 'K3' }; sheet.pageSetup = { paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printArea: `A1:K${Math.max(3, rows.length + 3)}` };
  const buffer = await workbook.xlsx.writeBuffer(); const verification = new ExcelJS.Workbook(); await verification.xlsx.load(buffer);
  if (verification.getWorksheet('Proses Kütüphanesi').rowCount !== rows.length + 3) throw new Error('Proses kütüphanesi Excel doğrulaması başarısız.');
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const fileName = `TYANA_Q-FLOW_${safeFileName(tenantShortName())}_Proses_Kutuphanesi_${new Date().toISOString().slice(0, 10)}.xlsx`; const result = await saveBlob(blob, fileName, exportFileTypes.xlsx, { track: false });
  if (result.saved) toast('Kütüphane dışa aktarıldı', `${processes.length} proses doğrulanmış Excel çalışma kitabına kaydedildi.`);
  return result;
}

document.querySelector('[data-action="new-process"]').addEventListener('click', () => openProcessDrawer());
document.querySelectorAll('[data-action="close-process-drawer"]').forEach(button => button.addEventListener('click', closeProcessDrawer));
document.getElementById('processForm').addEventListener('submit', saveProcess);
document.querySelector('[data-action="archive-process"]').addEventListener('click', archiveOrRestoreProcess);
document.querySelector('[data-action="export-library"]').addEventListener('click', () => exportProcessLibrary().catch(error => toast('Proses kütüphanesi Excel üretilemedi', error.message)));
document.querySelectorAll('[data-library-mode-button]').forEach(button => button.addEventListener('click', () => setLibraryMode(button.dataset.libraryModeButton)));
document.getElementById('operationCatalogSearch')?.addEventListener('input', renderOperationCodeCatalog);
document.getElementById('operationCatalogFamilyFilter')?.addEventListener('change', renderOperationCodeCatalog);
document.getElementById('operationCatalogReviewFilter')?.addEventListener('change', renderOperationCodeCatalog);
document.querySelector('[data-action="export-operation-codes"]')?.addEventListener('click', () => exportOperationCodeLibrary().catch(error => toast('Operasyon kodu Excel üretilemedi', error.message)));
document.querySelector('[data-action="open-process-flow"]')?.addEventListener('click', () => showView('flow'));
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
  container.innerHTML = filtered.length ? filtered.map(user => `<div class="user-register-row ${user.status !== 'active' ? 'inactive-user' : ''}" data-user-id="${escapeHtml(user.id)}"><span class="user-identity"><i>${escapeHtml(user.displayName.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toLocaleUpperCase('tr-TR'))}</i><span><b>${escapeHtml(user.displayName)}</b><small>${escapeHtml(user.email)} • v${escapeHtml(user.version)}</small></span></span><span><b>${escapeHtml(userRoleLabels[user.role] || user.role)}</b><small>${escapeHtml(user.department)}</small></span><span><b>${escapeHtml(user.plant)}</b><small>${escapeHtml(tenantProductName())} çalışma alanı</small></span><span><b>${escapeHtml(userRoleScopes[user.role] || 'Rol profili')}</b><small>${globalThis.TyanaPlatform.isDesktop ? 'İş akışı etiketi • RBAC değil' : 'Sunucu tarafı yetkilendirme'}</small></span><span><mark class="user-status ${escapeHtml(user.status)}">${user.status === 'active' ? 'AKTİF' : user.status === 'invited' ? 'DAVET' : 'PASİF'}</mark></span><span class="user-row-actions"><button data-edit-user="${escapeHtml(user.id)}">Düzenle</button><button data-toggle-user="${escapeHtml(user.id)}">${user.status === 'active' ? 'Pasife al' : 'Aktifleştir'}</button></span></div>`).join('') : '<div class="empty-user-state">Filtreye uygun kullanıcı bulunamadı.</div>';
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
    users = [{ id: 'user-eren', email: 'eren@tyana.local', displayName: 'Eren', role: 'admin', status: 'active', plant: tenantShortName(), department: 'Kalite', version: 1 }];
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
  document.getElementById('userDepartment').value = user?.department || 'Kalite'; document.getElementById('userPlant').value = user?.plant || tenantShortName();
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
initializeTrialGate().then(active => {
  if (!active) return;
  startTrialMonitor();
  loadUsers();
  return Promise.all([loadProcessLibrary(), loadEngineeringLibraries()]).then(async () => {
    await restoreLatestProject();
    applyTenantProfile();
    renderEngineeringQuestions();
    renderPfmeaLibrarySelectors();
    renderSourceIntegrationStudio();
  });
}).catch(error => toast('Uygulama omurgası yüklenemedi', error.message));

// PPAP checklist
// PPAP_LEVEL_PROFILE_BEGIN
const PPAP_DISPOSITION = Object.freeze({
  SUBMIT: 'Gönder', RETAIN: 'Tesiste Sakla', CUSTOMER_DEFINED: 'Müşteri Belirler', NOT_APPLICABLE: 'Uygulanmaz'
});
const ppapElementKeys = Object.freeze([
  'design-records', 'engineering-change', 'customer-approval', 'dfmea', 'process-flow', 'pfmea', 'control-plan', 'msa', 'dimensional-results', 'material-tests', 'initial-studies', 'laboratory', 'appearance', 'sample-parts', 'master-sample', 'checking-aids', 'csr', 'psw'
]);
const ppapLevelSubmissionMatrix = Object.freeze({
  '1': Object.freeze({
    'design-records': PPAP_DISPOSITION.RETAIN, 'engineering-change': PPAP_DISPOSITION.RETAIN, 'customer-approval': PPAP_DISPOSITION.RETAIN, dfmea: PPAP_DISPOSITION.RETAIN,
    'process-flow': PPAP_DISPOSITION.RETAIN, pfmea: PPAP_DISPOSITION.RETAIN, 'control-plan': PPAP_DISPOSITION.RETAIN, msa: PPAP_DISPOSITION.RETAIN,
    'dimensional-results': PPAP_DISPOSITION.RETAIN, 'material-tests': PPAP_DISPOSITION.RETAIN, 'initial-studies': PPAP_DISPOSITION.RETAIN, laboratory: PPAP_DISPOSITION.RETAIN,
    appearance: PPAP_DISPOSITION.SUBMIT, 'sample-parts': PPAP_DISPOSITION.SUBMIT, 'master-sample': PPAP_DISPOSITION.RETAIN, 'checking-aids': PPAP_DISPOSITION.RETAIN,
    csr: PPAP_DISPOSITION.RETAIN, psw: PPAP_DISPOSITION.SUBMIT
  }),
  '2': Object.freeze({
    'design-records': PPAP_DISPOSITION.SUBMIT, 'engineering-change': PPAP_DISPOSITION.SUBMIT, 'customer-approval': PPAP_DISPOSITION.RETAIN, dfmea: PPAP_DISPOSITION.RETAIN,
    'process-flow': PPAP_DISPOSITION.RETAIN, pfmea: PPAP_DISPOSITION.RETAIN, 'control-plan': PPAP_DISPOSITION.RETAIN, msa: PPAP_DISPOSITION.RETAIN,
    'dimensional-results': PPAP_DISPOSITION.SUBMIT, 'material-tests': PPAP_DISPOSITION.SUBMIT, 'initial-studies': PPAP_DISPOSITION.RETAIN, laboratory: PPAP_DISPOSITION.SUBMIT,
    appearance: PPAP_DISPOSITION.SUBMIT, 'sample-parts': PPAP_DISPOSITION.SUBMIT, 'master-sample': PPAP_DISPOSITION.RETAIN, 'checking-aids': PPAP_DISPOSITION.RETAIN,
    csr: PPAP_DISPOSITION.RETAIN, psw: PPAP_DISPOSITION.SUBMIT
  }),
  '3': Object.freeze({
    'design-records': PPAP_DISPOSITION.SUBMIT, 'engineering-change': PPAP_DISPOSITION.SUBMIT, 'customer-approval': PPAP_DISPOSITION.SUBMIT, dfmea: PPAP_DISPOSITION.SUBMIT,
    'process-flow': PPAP_DISPOSITION.SUBMIT, pfmea: PPAP_DISPOSITION.SUBMIT, 'control-plan': PPAP_DISPOSITION.SUBMIT, msa: PPAP_DISPOSITION.SUBMIT,
    'dimensional-results': PPAP_DISPOSITION.SUBMIT, 'material-tests': PPAP_DISPOSITION.SUBMIT, 'initial-studies': PPAP_DISPOSITION.SUBMIT, laboratory: PPAP_DISPOSITION.SUBMIT,
    appearance: PPAP_DISPOSITION.SUBMIT, 'sample-parts': PPAP_DISPOSITION.SUBMIT, 'master-sample': PPAP_DISPOSITION.RETAIN, 'checking-aids': PPAP_DISPOSITION.RETAIN,
    csr: PPAP_DISPOSITION.SUBMIT, psw: PPAP_DISPOSITION.SUBMIT
  }),
  '4': Object.freeze(Object.fromEntries(ppapElementKeys.map(key => [key, key === 'psw' ? PPAP_DISPOSITION.SUBMIT : PPAP_DISPOSITION.CUSTOMER_DEFINED]))),
  '5': Object.freeze(Object.fromEntries(ppapElementKeys.map(key => [key, key === 'sample-parts' ? PPAP_DISPOSITION.SUBMIT : PPAP_DISPOSITION.RETAIN])))
});

function normalizedPpapLevel(value) {
  const level = String(value || '3');
  return ppapLevelSubmissionMatrix[level] ? level : '3';
}

function ppapLevelDisposition(level, key) {
  return ppapLevelSubmissionMatrix[normalizedPpapLevel(level)][key] || PPAP_DISPOSITION.RETAIN;
}

function ppapDispositionInReadinessScope(_level, disposition) {
  if (disposition === PPAP_DISPOSITION.NOT_APPLICABLE) return false;
  return [PPAP_DISPOSITION.SUBMIT, PPAP_DISPOSITION.RETAIN, PPAP_DISPOSITION.CUSTOMER_DEFINED].includes(disposition);
}

function ppapScopedStatusSummary(statuses) {
  const ready = statuses.filter(status => status === 'ready').length;
  const progress = statuses.filter(status => status === 'progress').length;
  const blocked = statuses.filter(status => status === 'blocked').length;
  return { required: statuses.length, ready, progress, blocked, readiness: statuses.length ? Math.round((ready / statuses.length) * 100) : 0 };
}
// PPAP_LEVEL_PROFILE_END

function selectedPpapLevel() {
  return normalizedPpapLevel(document.querySelector('input[name="ppap"]:checked')?.value || '3');
}

function currentPpapItems() {
  const today = new Date().toISOString().slice(0, 10);
  const effectiveBom = components.filter(item => (!item.alternativeGroupId || item.alternativeSelected) && (!item.effectiveFrom || item.effectiveFrom <= today) && (!item.effectiveTo || item.effectiveTo >= today));
  const verifiedBom = effectiveBom.filter(item => ['Doğrulandı', 'Teknik resimle doğrulandı', 'Müşteri şartıyla doğrulandı'].includes(item.verificationStatus)).length;
  const suitableMsa = characteristics.filter(item => item.msaStatus === 'Uygun' || (item.msaStatus === 'Uygulanamaz — gerekçeli' && item.msaRationale)).length;
  const assessedRisks = pfmeaRows.filter(row => row.severity && row.occurrence && row.detection && row.ap).length;
  const dfmeaIssues = dfmeaReleaseIssues();
  const pfmeaIssues = [...fmeaGovernanceReleaseIssues('pfmea'), ...pfmeaReleaseIssues()];
  const drawingReady = /^[a-f0-9]{64}$/i.test(String(drawingSource.sha256 || '')) && Boolean(drawingSource.name && drawingNumber.value.trim() && drawingRevision.value.trim());
  const controlRows = controlPlanRows();
  const items = [
    ['Tasarım kayıtları', drawingReady ? `${drawingSource.name} • SHA-256 kayıtlı` : 'Teknik resim dosyası/no/revizyon doğrulaması bekliyor', drawingReady ? 'ready' : 'blocked', 'design-records', false, 'derived'],
    ['Yetkili mühendislik değişikliği', 'Değişiklik kaydı ve uygulanabilirlik kullanıcı tarafından seçilmeli', 'progress', 'engineering-change', true, 'manual'],
    ['Müşteri mühendislik onayı', 'Gerekliyse müşteri onay kanıtı bağlanmalı', 'progress', 'customer-approval', true, 'manual'],
    ['DFMEA', dfmeaIssues.length ? dfmeaIssues[0] : `${globalThis.TyanaFmea?.snapshot?.().dfmeaRows?.length || 0} analiz satırı • 7-adım kanıtı tamam`, dfmeaIssues.length ? 'progress' : 'ready', 'dfmea', true, 'derived'],
    ['Proses akış diyagramı', selected.length ? `${selected.length} operasyon • Rev. ${drawingRevision.value}` : 'Rota henüz oluşturulmadı', selected.length ? 'ready' : 'blocked', 'process-flow', false, 'derived'],
    ['PFMEA', pfmeaIssues.length ? pfmeaIssues[0] : `${assessedRisks}/${pfmeaRows.length} risk satırı ve 7-adım kanıtı tamam`, pfmeaIssues.length ? 'progress' : 'ready', 'pfmea', false, 'derived'],
    ['Kontrol planı', `${controlRows.length} numaralı kontrol satırı`, controlRows.length && !characteristicReleaseIssues().length ? 'ready' : 'progress', 'control-plan', false, 'derived'],
    ['MSA çalışmaları', `${suitableMsa}/${characteristics.length} ölçüm sistemi uygun/waiver gerekçeli`, characteristics.length && suitableMsa === characteristics.length ? 'ready' : 'blocked', 'msa', false, 'derived'],
    ['Boyutsal / fonksiyonel sonuçlar', 'Sonuç dosyası ve uygunluk kararı müşteri sunumu öncesi bağlanmalı', 'progress', 'dimensional-results', false, 'manual'],
    ['Malzeme / performans testleri', `${verifiedBom}/${effectiveBom.length} etkin BOM kalemi teknik kaynakla doğrulandı`, effectiveBom.length && verifiedBom === effectiveBom.length ? 'ready' : 'progress', 'material-tests', false, 'derived'],
    ['İlk proses etütleri', 'Karakteristik bazlı Ppk/Cpk hedefi ve çalışma referansı girilmeli', 'progress', 'initial-studies', true, 'manual'],
    ['Nitelikli laboratuvar dokümanı', 'İç/dış laboratuvar kapsamı ve rapor referansı seçilmeli', 'progress', 'laboratory', true, 'manual'],
    ['Görünüş onay raporu', 'Uygulanabilirlik seçimi + U/A ise gerekçe/onay gerekli', 'progress', 'appearance', true, 'manual'],
    ['Numune üretim parçaları', 'Miktar, lot ve saklama/sevk kaydı kullanıcı girişi bekliyor', 'progress', 'sample-parts', false, 'manual'],
    ['Master numune', 'Uygulanabilirlik, kimlik ve saklama lokasyonu seçilmeli', 'progress', 'master-sample', true, 'manual'],
    ['Kontrol fikstürleri', 'Fikstür listesi, kalibrasyon ve MSA bağlantısı doğrulanmalı', 'progress', 'checking-aids', true, 'manual'],
    ['Müşteri özel istekleri', document.getElementById('customerSpecificRequirements').value.trim() ? 'CSR metni kayıtlı; yetkili incelemesi bekliyor' : 'Hedef müşteri/ülke CSR kontrolü tanımlanmalı', 'progress', 'csr', false, 'manual']
  ];
  const level = selectedPpapLevel();
  items.forEach(item => { item[6] = ppapLevelDisposition(level, item[3]); });
  const prerequisiteScope = items.filter(item => ppapItemInReadinessScope(item, level));
  const prerequisiteReadyCount = prerequisiteScope.filter(item => ppapEffectiveStatus(item) === 'ready').length;
  const prerequisitesReady = prerequisiteScope.length > 0 && prerequisiteReadyCount === prerequisiteScope.length;
  const psw = ['PSW', prerequisitesReady ? `${prerequisiteReadyCount}/${prerequisiteScope.length} Seviye ${level} ön koşulu hazır; PSW onay ve kanıt kaydı bekliyor` : `${prerequisiteReadyCount}/${prerequisiteScope.length} Seviye ${level} ön koşulu hazır; ilgili sunum/tesis inceleme kapsamı tamamlanınca yetkili onaya açılır`, prerequisitesReady ? 'progress' : 'blocked', 'psw', false, 'manual'];
  psw[6] = ppapLevelDisposition(level, 'psw');
  items.push(psw);
  return items;
}

function ppapRecord(key) {
  const defaults = { owner: '', dueDate: '', approvalStatus: 'Taslak', revision: drawingRevision.value || 'A', applicability: 'Uygulanır', submissionDisposition: PPAP_DISPOSITION.CUSTOMER_DEFINED, rationale: '', files: [], updatedAt: '' };
  const current = ppapRecords[key] && typeof ppapRecords[key] === 'object' ? ppapRecords[key] : {};
  ppapRecords[key] = { ...defaults, ...current, files: Array.isArray(current.files) ? current.files : [] };
  return ppapRecords[key];
}

function ppapApprovedNotApplicable(item) {
  const record = ppapRecord(item[3]);
  const assigned = Boolean(record.owner.trim() && record.dueDate && record.revision.trim());
  return Boolean(item[4] && record.applicability === 'Uygulanamaz' && assigned && record.rationale.trim() && record.approvalStatus === 'Onaylandı');
}

function ppapEffectiveDisposition(item, level = selectedPpapLevel()) {
  const record = ppapRecord(item[3]);
  if (record.applicability === 'Uygulanamaz' && ppapApprovedNotApplicable(item)) return PPAP_DISPOSITION.NOT_APPLICABLE;
  const matrixDisposition = item[6] || ppapLevelDisposition(level, item[3]);
  if (matrixDisposition !== PPAP_DISPOSITION.CUSTOMER_DEFINED) return matrixDisposition;
  return [PPAP_DISPOSITION.SUBMIT, PPAP_DISPOSITION.RETAIN].includes(record.submissionDisposition) ? record.submissionDisposition : PPAP_DISPOSITION.CUSTOMER_DEFINED;
}

function ppapItemInReadinessScope(item, level = selectedPpapLevel()) {
  const record = ppapRecord(item[3]);
  if (record.applicability === 'Uygulanamaz') return !ppapApprovedNotApplicable(item);
  return ppapDispositionInReadinessScope(level, ppapEffectiveDisposition(item, level));
}

function ppapEffectiveStatus(item) {
  const record = ppapRecord(item[3]);
  const assigned = Boolean(record.owner.trim() && record.dueDate && record.revision.trim());
  const verifiedEvidence = record.files.some(file => !file.staleAt && /^[a-f0-9]{64}$/i.test(String(file.sha256 || '')));
  if (record.applicability === 'Uygulanamaz') {
    if (!item[4]) return 'blocked';
    return assigned && record.rationale.trim() && record.approvalStatus === 'Onaylandı' ? 'ready' : item[2] === 'blocked' ? 'blocked' : 'progress';
  }
  if (ppapEffectiveDisposition(item) === PPAP_DISPOSITION.CUSTOMER_DEFINED) return 'blocked';
  if (item[2] === 'blocked') return 'blocked';
  if (item[2] === 'progress' && item[5] === 'derived') return 'progress';
  if (assigned && record.approvalStatus === 'Onaylandı' && verifiedEvidence) return 'ready';
  return 'progress';
}

function ppapGapReason(item) {
  const record = ppapRecord(item[3]);
  if (record.applicability !== 'Uygulanamaz' && ppapEffectiveDisposition(item) === PPAP_DISPOSITION.CUSTOMER_DEFINED) return 'Seviye 4 için müşteri kararı “Gönder” veya “Tesiste Sakla” olarak seçilmemiş.';
  if (item[2] === 'blocked') return item[1];
  if (item[2] === 'progress' && item[5] === 'derived') return item[1];
  if (!record.owner.trim()) return 'Sorumlu atanmamış.';
  if (!record.dueDate) return 'Hedef tarih girilmemiş.';
  if (!record.revision.trim()) return 'Doküman revizyonu girilmemiş.';
  if (record.applicability === 'Uygulanamaz' && !record.rationale.trim()) return 'Uygulanamazlık gerekçesi girilmemiş.';
  if (record.approvalStatus !== 'Onaylandı') return `Onay durumu: ${record.approvalStatus}.`;
  if (record.applicability !== 'Uygulanamaz' && !record.files.some(file => !file.staleAt && /^[a-f0-9]{64}$/i.test(String(file.sha256 || '')))) return 'Güncel SHA-256 doğrulanmış kanıt dosyası bağlı değil.';
  return item[1];
}

function ppapReadinessState(items = currentPpapItems(), level = selectedPpapLevel()) {
  const scopeItems = items.filter(item => ppapItemInReadinessScope(item, level));
  const summary = ppapScopedStatusSummary(scopeItems.map(ppapEffectiveStatus));
  const submit = items.filter(item => ppapEffectiveDisposition(item, level) === PPAP_DISPOSITION.SUBMIT).length;
  const retained = items.filter(item => ppapEffectiveDisposition(item, level) === PPAP_DISPOSITION.RETAIN && !ppapApprovedNotApplicable(item)).length;
  const notApplicable = items.filter(ppapApprovedNotApplicable).length;
  const customerDecision = items.filter(item => ppapEffectiveDisposition(item, level) === PPAP_DISPOSITION.CUSTOMER_DEFINED).length;
  return { level, scopeItems, submit, retained, notApplicable, customerDecision, ...summary };
}

function renderPpap(filter = 'all') {
  const labels = { ready: 'HAZIR', progress: 'İŞLEMDE', blocked: 'BLOKE' };
  const level = selectedPpapLevel();
  const ppapItems = currentPpapItems();
  const checklist = document.getElementById('ppapChecklist'); if (!checklist) return;
  const headingEyebrow = document.querySelector('#documents .page-heading .eyebrow');
  if (headingEyebrow) headingEyebrow.textContent = `PPAP SEVİYE ${level} • ${level === '5' ? 'TEDARİKÇİ TESİSİNDE İNCELEME' : 'KONTROLLÜ MÜŞTERİ SUNUMU'}`;
  const headingCopy = document.querySelector('#documents .page-heading h1 + p');
  if (headingCopy) headingCopy.textContent = `18 PPAP unsurunu Seviye ${level} gönderim, tesiste saklama ve gerekçeli uygulanmaz kararlarıyla yönetin.`;
  const panelCopy = document.querySelector('#documents .ppap-panel .panel-header p');
  if (panelCopy) panelCopy.textContent = 'AIAG PPAP 4. baskı S/R/* iş akışı destek profili; lisanslı güncel yayın, müşteri özel şartları ve müşteri talebi ayrıca doğrulanmalıdır.';
  checklist.innerHTML = ppapItems.map((item, index) => {
    const record = ppapRecord(item[3]); if (!item[4] && record.applicability === 'Uygulanamaz') record.applicability = 'Uygulanır';
    const status = ppapEffectiveStatus(item); const inScope = ppapItemInReadinessScope(item, level); const hidden = (filter === 'open' && (!inScope || status === 'ready')) || (filter === 'unassigned' && (!inScope || record.owner.trim()));
    const files = record.files.length ? `<span class="ppap-files">${record.files.map((file, fileIndex) => `<small class="ppap-file ${file.staleAt ? 'stale' : ''}"><span>${file.staleAt ? '⚠' : '✓'} ${escapeHtml(file.name)} • ${(Number(file.size || 0) / 1024).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} KB${file.source === 'generated' ? ' • sistem çıktısı' : ''}${file.staleAt ? ' • veri değişti, yeniden üretin' : /^[a-f0-9]{64}$/i.test(String(file.sha256 || '')) ? ' • SHA-256' : ' • bütünlük bekliyor'}</span><button type="button" data-ppap-remove-file="${fileIndex}" title="Kanıt kaydını kaldır" aria-label="${escapeHtml(item[0])} kanıtını kaldır">×</button></small>`).join('')}</span>` : '<small class="ppap-file empty">Kanıt dosyası bağlı değil</small>';
    const applicabilityOptions = item[4] ? ['Uygulanır', 'Uygulanamaz'] : ['Uygulanır'];
    const matrixDisposition = item[6] || ppapLevelDisposition(level, item[3]); const effectiveDisposition = ppapEffectiveDisposition(item, level);
    const dispositionOptions = matrixDisposition === PPAP_DISPOSITION.CUSTOMER_DEFINED ? [PPAP_DISPOSITION.CUSTOMER_DEFINED, PPAP_DISPOSITION.SUBMIT, PPAP_DISPOSITION.RETAIN] : [matrixDisposition];
    const dispositionValue = matrixDisposition === PPAP_DISPOSITION.CUSTOMER_DEFINED ? record.submissionDisposition : matrixDisposition;
    const dispositionDisabled = matrixDisposition === PPAP_DISPOSITION.CUSTOMER_DEFINED ? '' : ' disabled';
    return `<div class="ppap-item ${hidden ? 'hidden-filter' : ''}" data-ppap-key="${escapeHtml(item[3])}" data-ppap-scope="${inScope}" data-ppap-disposition="${escapeHtml(effectiveDisposition)}"><span class="ppap-item-number">${String(index + 1).padStart(2, '0')}</span><span class="ppap-item-copy"><b>${escapeHtml(item[0])}</b><small>${escapeHtml(item[1])}</small><small><strong>Seviye ${level}: ${escapeHtml(effectiveDisposition.toLocaleUpperCase('tr-TR'))}</strong>${inScope ? ' • hazırlık kapsamı' : ' • bilgi/saklama kaydı'}</small>${files}</span><div class="ppap-record-fields"><input data-ppap-field="owner" value="${escapeHtml(record.owner)}" placeholder="Sorumlu" aria-label="${escapeHtml(item[0])} sorumlusu"><input data-ppap-field="dueDate" type="date" value="${escapeHtml(record.dueDate)}" title="Hedef tarih" aria-label="${escapeHtml(item[0])} hedef tarihi"><input data-ppap-field="revision" value="${escapeHtml(record.revision)}" placeholder="Revizyon" aria-label="${escapeHtml(item[0])} revizyonu"><select data-ppap-field="approvalStatus" aria-label="${escapeHtml(item[0])} onay durumu">${selectOptions(['Taslak', 'İncelemede', 'Onaylandı', 'Revizyon Gerekli'], record.approvalStatus)}</select><select data-ppap-field="submissionDisposition" aria-label="${escapeHtml(item[0])} Seviye ${level} gönderim kararı" title="${matrixDisposition === PPAP_DISPOSITION.CUSTOMER_DEFINED ? 'Müşteri talebine göre Gönder veya Tesiste Sakla seçin' : `Seviye ${level} matrisi`}"${dispositionDisabled}>${selectOptions(dispositionOptions, dispositionValue)}</select><select data-ppap-field="applicability" aria-label="${escapeHtml(item[0])} uygulanabilirliği" title="${item[4] ? 'Uygulanabilirlik kararı' : 'Bu PPAP unsuru zorunludur'}">${selectOptions(applicabilityOptions, record.applicability)}</select><input data-ppap-field="rationale" value="${escapeHtml(record.rationale)}" placeholder="U/A gerekçesi / not" aria-label="${escapeHtml(item[0])} gerekçe ve notu"><label class="ppap-attach">＋ Kanıt Ekle<input data-ppap-file type="file" multiple aria-label="${escapeHtml(item[0])} kanıt dosyaları"></label></div><mark class="ppap-status ${status}">${labels[status]}</mark></div>`;
  }).join('');
  checklist.querySelectorAll('[data-ppap-field]').forEach(field => field.addEventListener('change', event => { const key = event.target.closest('[data-ppap-key]').dataset.ppapKey; const record = ppapRecord(key); record[event.target.dataset.ppapField] = event.target.value; record.updatedAt = new Date().toISOString(); markDraftDirty({ affectsDocuments: false }); renderPpap(filter); }));
  checklist.querySelectorAll('[data-ppap-file]').forEach(input => input.addEventListener('change', async event => { const key = event.target.closest('[data-ppap-key]').dataset.ppapKey; const record = ppapRecord(key); const incoming = await Promise.all([...event.target.files].map(async file => ({ id: crypto.randomUUID(), name: file.name, size: file.size, type: file.type, lastModified: file.lastModified, sha256: await sha256Blob(file), addedAt: new Date().toISOString(), source: 'user-upload' }))); incoming.forEach(file => { const duplicateIndex = record.files.findIndex(existing => existing.name === file.name && Number(existing.size) === Number(file.size)); if (duplicateIndex >= 0) record.files.splice(duplicateIndex, 1, file); else record.files.push(file); }); record.updatedAt = new Date().toISOString(); markDraftDirty({ affectsDocuments: false }); renderPpap(filter); }));
  checklist.querySelectorAll('[data-ppap-remove-file]').forEach(button => button.addEventListener('click', () => { const key = button.closest('[data-ppap-key]').dataset.ppapKey; const record = ppapRecord(key); record.files.splice(Number(button.dataset.ppapRemoveFile), 1); record.updatedAt = new Date().toISOString(); markDraftDirty({ affectsDocuments: false }); renderPpap(filter); }));
  const readinessState = ppapReadinessState(ppapItems, level); const { ready, progress, blocked, readiness } = readinessState;
  const summary = document.querySelector('#documents .ppap-summary'); if (summary) { const ring = summary.querySelector('.readiness-ring'); ring.querySelector('span').textContent = `${readiness}%`; ring.style.background = `radial-gradient(circle,#fff 56%,transparent 58%),conic-gradient(#2f6fed ${readiness}%,#e5eaf2 0)`; const cards = summary.querySelectorAll('.ppap-kpi'); if (cards[0]) cards[0].querySelector('span').textContent = ready; if (cards[1]) cards[1].querySelector('span').textContent = progress; if (cards[2]) cards[2].querySelector('span').textContent = blocked; const heading = summary.querySelector('.ppap-readiness h2'); if (heading) heading.textContent = readiness === 100 ? (level === '5' ? 'Tesis inceleme kapsamı hazır' : 'PPAP dosyası doğrulamaya hazır') : blocked ? 'Kalite kapısında bloke kayıtlar var' : 'PPAP dosyası doğrulama sürecinde'; const copy = summary.querySelector('.ppap-readiness p:last-child'); if (copy) copy.textContent = `Seviye ${level}: ${ready}/${readinessState.required} uygulanabilir unsur hazır • ${readinessState.submit} müşteriye gönder • ${readinessState.retained} tesiste sakla • ${readinessState.notApplicable} uygulanmaz${readinessState.customerDecision ? ` • ${readinessState.customerDecision} müşteri kararı bekliyor` : ''}.`; }
  const allCount = document.querySelector('[data-ppap-filter="all"] span'); if (allCount) allCount.textContent = ppapItems.length;
  const openCount = document.querySelector('[data-ppap-filter="open"] span'); if (openCount) openCount.textContent = progress + blocked;
  const unassignedCount = document.querySelector('[data-ppap-filter="unassigned"] span'); if (unassignedCount) unassignedCount.textContent = readinessState.scopeItems.filter(item => !ppapRecord(item[3]).owner.trim()).length;
  const badge = document.querySelector('.ppap-badge'); if (badge) badge.textContent = `${readiness}%`;
}
renderPpap();

document.querySelectorAll('[data-ppap-filter]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-ppap-filter]').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  renderPpap(button.dataset.ppapFilter);
}));
document.querySelectorAll('input[name="ppap"]').forEach(input => input.addEventListener('change', () => {
  renderPpap(document.querySelector('[data-ppap-filter].active')?.dataset.ppapFilter || 'all');
}));

// Canonical documentation snapshot and persistent project draft.
const productFieldIds = ['productTemplate', 'productGroup', 'customProductGroupName', 'productStructureType', 'productType', 'customProductTypeName', 'productFamily', 'partNumber', 'internalProductCode', 'partName', 'customer', 'customerPartNumber', 'productionPhase', 'annualVolume', 'controlPlanNumber', 'projectCode', 'drawingNumber', 'drawingRevision', 'supplierName', 'supplierSite', 'supplierCode', 'keyContact', 'keyContactPhone', 'coreTeam', 'originalDate', 'revisionDate', 'documentStatus'];
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

async function sha256Blob(blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function getDocumentationSnapshot() {
  ensureEngineeringUniverseFromLegacy(); syncFinishedGoodMasterIdentity(); projectEngineeringUniverseToComponents();
  const snapshot = {
    schemaVersion: '4.3.0', templateVersion: 'TYANA-QF-2026.7-AUDIT-EVIDENCE', snapshotId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(), projectId: currentProjectId,
    tenant: tenantSnapshotProfile(),
    product: { ...collectFields(productFieldIds), productGroupLabel: activeBackbone().label, productTypeLabel: effectiveProductTypeLabel() }, technical: collectFields(technicalFieldIds),
    components: components.map(item => ({ ...item })),
    engineeringUniverse: {
      schemaVersion: globalThis.TyanaBom.ENGINEERING_SCHEMA_VERSION, architecture: 'ITEM_MASTER_THEN_BOM',
      rootItemMasterId: engineeringUniverse.rootItemMasterId,
      itemMasters: jsonClone(engineeringUniverse.itemMasters), bomDefinitions: jsonClone(engineeringUniverse.bomDefinitions),
      bomSelections: jsonClone(selectedBomDefinitionIdsByHeader), activeBomRows: jsonClone(activeEngineeringBomRows())
    },
    bom: { schemaVersion: '2.0.0', architecture: 'ITEM_MASTER_THEN_BOM', rootId: 'FINISHED_GOOD', rootItemMasterId: engineeringUniverse.rootItemMasterId, catalog: JSON.parse(JSON.stringify(bomCatalog)), history: bomHistory.map(item => ({ ...item })), ui: { stage: engineeringBomStage, selectedItemMasterId, selectedBomHeaderItemMasterId, selectedBomDefinitionId, selectedBomDefinitionIdsByHeader: jsonClone(selectedBomDefinitionIdsByHeader) } },
    drawingSource: { ...drawingSource },
    routingAnswers: {
      forming: document.querySelector('input[name="forming"]:checked')?.value || '',
      safety: document.querySelector('input[name="safety"]:checked')?.value || '',
      specialProcesses: [...document.querySelectorAll('.check-grid input:checked')].map(input => input.value),
      ppapLevel: document.querySelector('input[name="ppap"]:checked')?.value || '3'
    },
    route: selectedProcessEntries().map(({ routeKey, process, detail }) => ({
      routeKey, processId: process.id, processRevision: process.revision || 'A', operationNo: detail.operationNo,
      name: detail.operationLabelTR || process.name, description: detail.operationLabelEN || process.desc, canonicalProcessName: process.name, canonicalProcessDescription: process.desc, operationDisplayName: [detail.operationCode, detail.operationLabelTR || process.name, detail.operationLabelEN ? `/ ${detail.operationLabelEN}` : ''].filter(Boolean).join(' '), family: process.family || '', category: process.category || 'Üretim',
      inputMaterial: process.inputMaterial || '', outputMaterial: process.outputMaterial || '',
      equipment: process.equipment || '', tooling: process.tooling || '', controlMethod: process.controlMethod || '', documentRef: process.documentRef || '', processStandard: process.processStandard || '',
      reactionPlan: process.reactionPlan || '', workInstruction: process.workInstruction || '', special: Boolean(process.special), outsource: Boolean(process.outsource),
      inputComponentIds: [...detail.inputComponentIds], outputItemId: detail.outputItemId, workcenter: detail.workcenter, machineId: detail.machineId, instanceTooling: detail.tooling, programNo: detail.programNo, responsible: detail.responsible, externalControlRef: detail.externalControlRef,
      operationCode: detail.operationCode || '', operationCodeId: detail.operationCodeId || '', operationLabelTR: detail.operationLabelTR || '', operationLabelEN: detail.operationLabelEN || '', operationCodeRequiresReview: Boolean(detail.operationCodeRequiresReview), operationCodeReviewFlags: [...(detail.operationCodeReviewFlags || [])], operationCodeSourceRef: detail.operationCodeSourceRef ? JSON.parse(JSON.stringify(detail.operationCodeSourceRef)) : null,
      standardProcessCardId: detail.standardProcessCardId || '', machineClassId: detail.machineClassId || '', allowedMachineClasses: [...(detail.allowedMachineClasses || [])], equipmentRequirements: detail.equipmentRequirements ? JSON.parse(JSON.stringify(detail.equipmentRequirements)) : null,
      presetId: detail.presetId || '', variantId: detail.variantId || '', sourceDocumentId: detail.sourceDocumentId || '', sourceRef: detail.sourceRef || '', sourceValidationStatus: detail.sourceValidationStatus || 'not-applicable', sourceValidationNote: detail.sourceValidationNote || '',
      itemMasterRouting: Boolean(detail.itemMasterRouting), itemMasterId: detail.itemMasterId || '', itemRoutingStepId: detail.itemRoutingStepId || '', selectedMachines: [...(detail.selectedMachines || [])], controlMarks: [...(detail.controlMarks || [])],
      routeGroupName: detail.routeGroupName || '', routeGroupCode: detail.routeGroupCode || '', routeGroupOrder: Number(detail.routeGroupOrder || 0), bomPath: detail.bomPath || ''
    })),
    characteristics: characteristics.map(item => ({ ...item })),
    pfmea: pfmeaRows.map(row => ({ ...row })),
    ppap: {
      submissionLevel: document.querySelector('input[name="ppap"]:checked')?.value || '3',
      records: JSON.parse(JSON.stringify(ppapRecords)),
      generatedDocuments: JSON.parse(JSON.stringify(generatedDocumentRecords))
    },
    apqpTraceability: globalThis.TyanaApqp?.snapshot?.() || { schemaVersion: '2.0.0', fmeaProfile: 'family', priorityMethod: 'AP', activeAnalysisTab: 'boundary', boundary: {}, pDiagram: {}, rows: [] },
    fmeaGovernance: globalThis.TyanaFmea?.snapshot?.() || { schemaVersion: '1.2.0', profiles: {}, answers: {}, questionCatalog: {}, readiness: {}, dfmeaRows: [] },
    engineering: {
      productLibraryVersion: productEngineeringLibrary?.libraryVersion || 'unavailable', pfmeaLibraryVersion: pfmeaEngineeringLibrary?.library?.version || pfmeaEngineeringLibrary?.schemaVersion || 'unavailable', qualityDocumentLibraryVersion: qualityDocumentLibrary?.libraryVersion || 'unavailable',
      operationCodeLibraryVersion: operationCodeLibrary?.libraryVersion || 'unavailable', answers: JSON.parse(JSON.stringify(engineeringAnswers)), customQuestions: engineeringCustomQuestions.map(question => ({ ...question }))
    },
    standardsProfile: { iatf: 'IATF 16949:2016 + kuruluşun güncel SI/FAQ doğrulama profili', apqp: 'AIAG APQP destek profili — lisanslı güncel baskıyla doğrulanmalı', qfd: 'VOC → QFD-1/2 → tasarım doğrulama → QFD-3/4 izlenebilirlik profili', controlPlan: 'AIAG Control Plan destek profili — lisanslı güncel baskıyla doğrulanmalı', ppap: 'AIAG PPAP 4. Baskı temel unsur omurgası', complianceMode: 'Destek profili — sertifika veya otomatik uygunluk beyanı değildir' },
    approval: { preparedBy: document.getElementById('keyContact').value, preparedAt: new Date().toISOString(), status: document.getElementById('documentStatus').value }
  };
  snapshot.sha256 = await sha256Hex(stableStringify(snapshot));
  return snapshot;
}

function applySnapshot(snapshot) {
  if (!snapshot) return;
  const hasInternalProductCode = Object.prototype.hasOwnProperty.call(snapshot.product || {}, 'internalProductCode');
  const snapshotGroup = snapshot.product?.productGroup;
  if (snapshotGroup && !productBackbones[snapshotGroup] && snapshot.product?.productGroupLabel) registerCustomProductGroup(snapshot.product.productGroupLabel, snapshotGroup);
  for (const [id, value] of Object.entries({ ...(snapshot.product || {}), ...(snapshot.technical || {}) })) {
    const field = document.getElementById(id); if (field && value !== undefined && value !== null) field.value = value;
  }
  if (!hasInternalProductCode && internalProductCode) internalProductCode.value = snapshot.product?.partNumber || '';
  if (Array.isArray(snapshot.components)) components = snapshot.components.map(item => componentRecord(item));
  else {
    const legacyBom = snapshot.engineering?.answers?.FINISHED_GOOD?.['q.bom.items']?.value;
    if (Array.isArray(legacyBom)) components = legacyBom.map((item, index) => componentRecord({ ...item, id: item.id || item.componentId, itemNo: item.itemNo || item.partNumber || item.code, name: item.name || item.componentName, parentId: item.parentId || 'FINISHED_GOOD', position: item.position || String((index + 1) * 10) }));
  }
  if (snapshot.engineeringUniverse && Array.isArray(snapshot.engineeringUniverse.itemMasters) && Array.isArray(snapshot.engineeringUniverse.bomDefinitions)) {
    const stored = snapshot.engineeringUniverse;
    engineeringUniverse = {
      schemaVersion: globalThis.TyanaBom.ENGINEERING_SCHEMA_VERSION, architecture: 'ITEM_MASTER_THEN_BOM',
      rootItemMasterId: stored.rootItemMasterId || snapshot.bom?.rootItemMasterId || 'MASTER-FINISHED-GOOD',
      itemMasters: normalizeEngineeringItemMasters(stored.itemMasters),
      bomDefinitions: globalThis.TyanaBom.normalizeBomDefinitions(stored.bomDefinitions)
    };
    const storedSelections = stored.bomSelections || snapshot.bom?.ui?.selectedBomDefinitionIdsByHeader || {};
    const knownDefinitionIds = new Set(engineeringUniverse.bomDefinitions.map(definition => definition.id));
    selectedBomDefinitionIdsByHeader = Object.fromEntries(Object.entries(storedSelections).filter(([, definitionId]) => knownDefinitionIds.has(definitionId)));
    engineeringUniverse.bomDefinitions.forEach(definition => { if (!selectedBomDefinitionIdsByHeader[definition.headerItemMasterId]) selectedBomDefinitionIdsByHeader[definition.headerItemMasterId] = definition.id; });
    selectedItemMasterId = snapshot.bom?.ui?.selectedItemMasterId || engineeringUniverse.rootItemMasterId;
    selectedBomHeaderItemMasterId = snapshot.bom?.ui?.selectedBomHeaderItemMasterId || engineeringUniverse.rootItemMasterId;
    if (!engineeringUniverse.itemMasters.some(master => master.id === selectedItemMasterId)) selectedItemMasterId = engineeringUniverse.rootItemMasterId;
    if (!engineeringUniverse.itemMasters.some(master => master.id === selectedBomHeaderItemMasterId)) selectedBomHeaderItemMasterId = engineeringUniverse.rootItemMasterId;
    selectedBomDefinitionId = selectedBomDefinitionIdsByHeader[selectedBomHeaderItemMasterId] || snapshot.bom?.ui?.selectedBomDefinitionId || bomDefinitionsForHeader(selectedBomHeaderItemMasterId)[0]?.id || '';
    if (!bomDefinitionsForHeader(selectedBomHeaderItemMasterId).some(definition => definition.id === selectedBomDefinitionId)) selectedBomDefinitionId = '';
    if (selectedBomDefinitionId) selectedBomDefinitionIdsByHeader[selectedBomHeaderItemMasterId] = selectedBomDefinitionId;
    engineeringBomStage = snapshot.bom?.ui?.stage === 'structure' ? 'structure' : 'masters';
    syncFinishedGoodMasterIdentity(); projectEngineeringUniverseToComponents();
  } else {
    resetEngineeringUniverseFromComponents();
  }
  bomCatalog = Array.isArray(snapshot.bom?.catalog) ? JSON.parse(JSON.stringify(snapshot.bom.catalog)) : [];
  bomHistory = Array.isArray(snapshot.bom?.history) ? snapshot.bom.history.map(item => ({ ...item })) : [];
  bomSelectedId = 'FINISHED_GOOD'; bomUndoStack = [];
  if (Array.isArray(snapshot.characteristics) && snapshot.characteristics.length) characteristics = snapshot.characteristics.map(item => newCharacteristic(item));
  pfmeaRows = Array.isArray(snapshot.pfmea) ? snapshot.pfmea.map(row => ({ ...row })) : [];
  ppapRecords = snapshot.ppap?.records && typeof snapshot.ppap.records === 'object' && !Array.isArray(snapshot.ppap.records) ? JSON.parse(JSON.stringify(snapshot.ppap.records)) : {};
  generatedDocumentRecords = Array.isArray(snapshot.ppap?.generatedDocuments) ? JSON.parse(JSON.stringify(snapshot.ppap.generatedDocuments)) : [];
  globalThis.TyanaApqp?.hydrate?.(snapshot.apqpTraceability);
  globalThis.TyanaFmea?.hydrate?.(snapshot.fmeaGovernance);
  engineeringAnswers = snapshot.engineering?.answers && typeof snapshot.engineering.answers === 'object' ? JSON.parse(JSON.stringify(snapshot.engineering.answers)) : {};
  if (engineeringAnswers.FINISHED_GOOD) delete engineeringAnswers.FINISHED_GOOD['q.bom.items'];
  engineeringCustomQuestions = Array.isArray(snapshot.engineering?.customQuestions) ? snapshot.engineering.customQuestions.map(question => ({ ...question })) : [];
  selected = []; routeDetails = {};
  if (Array.isArray(snapshot.route)) {
    selected = snapshot.route.map(step => step.routeKey || step.processId); routeDetails = Object.fromEntries(snapshot.route.map(step => [step.routeKey || step.processId, { operationNo: step.operationNo, operationCode: step.operationCode || '', operationCodeId: step.operationCodeId || '', operationLabelTR: step.operationLabelTR || '', operationLabelEN: step.operationLabelEN || '', operationCodeRequiresReview: Boolean(step.operationCodeRequiresReview), operationCodeReviewFlags: Array.isArray(step.operationCodeReviewFlags) ? [...step.operationCodeReviewFlags] : [], operationCodeSourceRef: step.operationCodeSourceRef ? JSON.parse(JSON.stringify(step.operationCodeSourceRef)) : null, presetId: step.presetId || '', variantId: step.variantId || '', sourceDocumentId: step.sourceDocumentId || '', sourceRef: step.sourceRef || '', sourceValidationStatus: step.sourceValidationStatus || (step.presetId || step.sourceDocumentId ? 'pending' : 'not-applicable'), sourceValidationNote: step.sourceValidationNote || '', inputComponentIds: Array.isArray(step.inputComponentIds) ? step.inputComponentIds : [], outputItemId: step.outputItemId || 'FINISHED_GOOD', workcenter: step.workcenter || step.responsible || 'Tanımlanacak', machineId: step.machineId || step.equipment || '', selectedMachines: Array.isArray(step.selectedMachines) ? [...step.selectedMachines] : [], tooling: step.instanceTooling || step.tooling || '', programNo: step.programNo || 'Tanımlanacak', responsible: step.responsible || '', externalControlRef: step.externalControlRef || 'Uygulanmıyor', itemMasterRouting: Boolean(step.itemMasterRouting), itemMasterId: step.itemMasterId || '', itemRoutingStepId: step.itemRoutingStepId || '', controlMarks: Array.isArray(step.controlMarks) ? [...step.controlMarks] : [], routeGroupName: step.routeGroupName || '', routeGroupCode: step.routeGroupCode || '', routeGroupOrder: Number(step.routeGroupOrder || 0), bomPath: step.bomPath || '' }]));
    Object.values(routeDetails).forEach(detail => { if (detail.operationCode) bindOperationCodeMetadata(detail, detail.operationCode); });
  }
  components.forEach(component => ['producedAtProcessId', 'firstUseProcessId', 'mountedAtProcessId', 'inspectedAtProcessId', 'prerequisiteProcessId', 'nextProcessId'].forEach(field => { if (component[field]) component[field] = resolveRouteKey(component[field]); }));
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
  syncProductLevelContext();
  if (snapshot.product?.productType) {
    const knownType = [...productType.options].some(option => option.value === snapshot.product.productType);
    productType.value = knownType ? snapshot.product.productType : 'Kullanıcı Tanımlı Mamul';
    if (!knownType) customProductTypeName.value = snapshot.product.productTypeLabel || snapshot.product.productType;
  }
  if (snapshot.product?.customProductTypeName !== undefined) customProductTypeName.value = snapshot.product.customProductTypeName;
  syncCustomProductTypeField();
  document.querySelector('.product-family-advanced')?.toggleAttribute('open', Boolean(snapshot.product?.productFamily));
  renderComponents(); renderCharacteristics(); renderOptions(); renderSequence(); renderEngineeringQuestions(); renderPfmeaLibrarySelectors(); globalThis.TyanaApqp?.render?.(); globalThis.TyanaFmea?.render?.(); updateSummary(); renderPpap(document.querySelector('[data-ppap-filter].active')?.dataset.ppapFilter || 'all');
}

async function saveProjectSnapshot() {
  const snapshot = await getDocumentationSnapshot();
  const payload = { projectCode: projectCode.value.trim(), partNumber: partNumber.value.trim(), partName: partName.value.trim(), productGroup: productGroup.value, revision: drawingRevision.value.trim(), phase: document.getElementById('productionPhase').value, status: document.getElementById('documentStatus').value, version: currentProjectVersion, payload: snapshot };
  const data = await globalThis.TyanaPlatform.data.saveProject(payload, currentProjectId);
  currentProjectId = data.project.id; currentProjectVersion = data.project.version;
  if (globalThis.TyanaPlatform.isDesktop) {
    localStorage.removeItem('qflow-last-project');
    localStorage.setItem('qflow-last-project-id', currentProjectId);
  } else {
    localStorage.setItem('qflow-last-project', JSON.stringify(data.project.payload));
  }
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
  } catch (error) {
    if (globalThis.TyanaPlatform.isDesktop) {
      localStorage.removeItem('qflow-last-project');
      toast('Yerel veritabanı açılamadı', `Doğrulanmamış tarayıcı kopyası güvenlik nedeniyle yüklenmedi. ${error?.message || ''}`.trim());
      return;
    }
    const local = localStorage.getItem('qflow-last-project');
    if (local) { try { applySnapshot(JSON.parse(local)); toast('Tarayıcı kurtarma kopyası yüklendi', 'Sunucuya erişilemedi; bu doğrulanmamış kopya yalnız taslak kurtarma amacıyla açıldı.'); document.getElementById('documentStatus').value = 'Taslak'; } catch {} }
  }
}

// Main workflow actions
function requireSelectedProcessRoute(actionLabel = 'Doküman') {
  if (selected.length) return true;
  showView('product'); goToWizardStep(3);
  toast(`${actionLabel} için proses seçimi gerekli`, 'Ürün seviyesine göre önerilen rotayı inceleyin veya 380 standart proses kartından operasyonları seçip sıralayın. Sistem rotayı kendiliğinden doldurmaz.');
  return false;
}

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
  if (!requireSelectedProcessRoute('Ürün omurgasını kaydetme')) return;
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
  if (!requireSelectedProcessRoute('Proses akışı')) return;
  renderFlowDiagram();
  toast('Proses akış diyagramı oluşturuldu', `${selected.length} operasyon PFMEA yapısına aktarıldı.`);
  document.querySelector('[data-view="pfmea"] .status-dot')?.classList.add('done');
  setTimeout(() => document.getElementById('flowPreview').scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
}));

const pfmeaProcessTemplateAliases = {
  incoming: ['incoming-material', 'incoming-component'], storage: ['storage-traceability'], cutting: ['material-cutting'], 'billet-heating': ['billet-heating'], forging: ['hot-forging'], shotblast: ['trim-shotblast'], cnc: ['cnc-turning'], milling: ['cnc-milling'], drilling: ['drilling-reaming'],
  thread: ['threading'], grinding: ['grinding'], 'furnace-heat': ['furnace-heat-treatment'], induction: ['induction-hardening'], washing: ['industrial-washing'], coating: ['surface-coating'], painting: ['painting'], welding: ['robotic-welding'], 'rubber-molding': ['rubber-molding'], 'plastic-injection': ['plastic-injection'], 'press-assembly': ['press-assembly'], assembly: ['press-assembly'],
  'integrated-assembly': ['integrated-plant-assembly'], 'post-paint-assembly': ['post-paint-assembly'], torque: ['torque-tightening'], leaktest: ['leak-functional-test'], final: ['final-inspection'], marking: ['marking'], packing: ['packaging-shipping']
};

function pfmeaTemplatesForProcess(processId) {
  const ids = pfmeaProcessTemplateAliases[processId] || [];
  return (pfmeaEngineeringLibrary?.processTemplates || []).filter(template => ids.includes(template.id));
}

function pfmeaRisksForProcess(processId) {
  const templateIds = new Set(pfmeaTemplatesForProcess(processId).map(template => template.id));
  return (pfmeaEngineeringLibrary?.riskTemplates || []).filter(risk => templateIds.has(risk.processTemplateId));
}

function pfmeaLibraryText(value) {
  return value?.tr || value?.nameTR || value?.titleTR || '';
}

function pfmeaOwnerName(roleId) {
  return pfmeaEngineeringLibrary?.ownerRoles?.find(role => role.id === roleId)?.nameTR || roleId || '';
}

function pfmeaEvidenceName(evidenceId) {
  return pfmeaEngineeringLibrary?.evidenceTypes?.find(item => item.id === evidenceId)?.nameTR || evidenceId || '';
}

function pfmeaValueReady(value) {
  const text = String(value || '').trim();
  return Boolean(text) && !/(tanımlayın|tanımlanacak|gerekli$|seçin|bekliyor)/i.test(text);
}

const PFMEA_WORK_ELEMENT_TYPES = Object.freeze([
  ['MAN', 'İnsan'],
  ['MACHINE', 'Makine'],
  ['METHOD', 'Metot'],
  ['MATERIAL', 'Malzeme']
]);

const PFMEA_ACTION_STATUSES = Object.freeze([
  'Açık',
  'Karar Bekleniyor',
  'Uygulama Bekleniyor',
  'Tamamlandı',
  'Uygulanmadı'
]);

function pfmeaStatusClosed(row) {
  return ['Kapalı', 'Kapatıldı', 'Tamamlandı', 'Etkinlik Doğrulandı', 'Uygulanmadı'].includes(String(row?.status || ''));
}

function pfmeaEffectText(row) {
  const layers = [
    ['Kuruluş sahası', row.effectOwnPlant],
    ['Sevk edilen saha', row.effectShipToPlant],
    ['Son kullanıcı', row.effectEndUser]
  ].filter(([, value]) => pfmeaValueReady(value));
  return layers.length ? layers.map(([label, value]) => `${label}: ${value}`).join(' • ') : String(row.effect || '');
}

function pfmeaActionText(row) {
  return [
    row.preventionAction ? `Önleme: ${row.preventionAction}` : '',
    row.detectionAction ? `Tespit: ${row.detectionAction}` : ''
  ].filter(Boolean).join(' • ') || String(row.recommendedAction || '');
}

function pfmeaResultComplete(row) {
  if (!pfmeaStatusClosed(row)) return false;
  if (row.status === 'Uygulanmadı') return pfmeaValueReady(row.resultRationale) && pfmeaValueReady(row.riskAcceptanceRef);
  return Boolean(row.actionCompletionDate)
    && pfmeaValueReady(row.actionEvidence || row.evidence)
    && ['resultSeverity', 'resultOccurrence', 'resultDetection', 'resultAp', 'resultRationale'].every(field => pfmeaValueReady(row[field]));
}

function pfmeaWorkElementTypeFor(risk, workElement) {
  const text = [
    risk?.category,
    pfmeaLibraryText(risk?.failureMode),
    ...(risk?.causes || []).map(pfmeaLibraryText),
    workElement?.nameTR
  ].join(' ').toLocaleLowerCase('tr-TR');
  if (/(operatör|personel|insan|eğitim|yetkinlik)/.test(text)) return 'MAN';
  if (/(makine|pres|tezgâh|kalıp|fikstür|takım|sensör|ekipman)/.test(text)) return 'MACHINE';
  if (/(malzeme|hammadde|komponent|kimyasal|lot|sertifika)/.test(text)) return 'MATERIAL';
  return 'METHOD';
}

function pfmeaCompleteness(row) {
  const requiredValues = [
    row.processItem,
    row.processStep,
    row.workElementType,
    row.workElement,
    row.processItemFunction,
    row.functionText,
    row.workElementFunction,
    row.failureMode,
    pfmeaEffectText(row),
    row.cause,
    row.preventionControl,
    row.detectionControl,
    row.severity,
    row.occurrence,
    row.detection,
    row.ap,
    row.ratingsRationale,
    row.ratingTableRef,
    row.reactionPlan
  ];
  const ready = requiredValues.filter(pfmeaValueReady).length;
  return Math.round((ready / requiredValues.length) * 100);
}

function pfmeaRpn(row) {
  const values = [row.severity, row.occurrence, row.detection].map(Number);
  return values.every(value => Number.isInteger(value) && value >= 1 && value <= 10) ? values.reduce((total, value) => total * value, 1) : 0;
}

function pfmeaApRank(row) {
  return ({ H: 3, M: 2, L: 1 })[row.ap] || 0;
}

function pfmeaRowsForDisplay() {
  const query = pfmeaUiState.query.trim().toLocaleLowerCase('tr-TR');
  const filterMatch = row => {
    if (pfmeaUiState.filter === 'high') return row.ap === 'H' && !pfmeaStatusClosed(row);
    if (pfmeaUiState.filter === 'incomplete') return pfmeaCompleteness(row) < 100;
    if (pfmeaUiState.filter === 'actions') return !pfmeaStatusClosed(row) && Boolean(pfmeaActionText(row) || ['H', 'M'].includes(row.ap));
    return true;
  };
  const items = pfmeaRows.map((row, index) => ({ row, index })).filter(({ row }) => {
    if (!filterMatch(row)) return false;
    if (!query) return true;
    const entry = selectedProcessEntries().find(item => item.routeKey === row.routeKey);
    return [entry?.process.name, row.operationNo, row.failureMode, row.effect, row.cause, row.preventionControl, row.detectionControl, row.owner, row.libraryRiskId]
      .some(value => String(value || '').toLocaleLowerCase('tr-TR').includes(query));
  });
  if (pfmeaUiState.sort === 'ap') items.sort((a, b) => pfmeaApRank(b.row) - pfmeaApRank(a.row) || a.index - b.index);
  if (pfmeaUiState.sort === 'rpn') items.sort((a, b) => pfmeaRpn(b.row) - pfmeaRpn(a.row) || a.index - b.index);
  if (pfmeaUiState.sort === 'completion') items.sort((a, b) => pfmeaCompleteness(a.row) - pfmeaCompleteness(b.row) || a.index - b.index);
  return items;
}

function pfmeaProfileRisks(processId, profile) {
  const risks = pfmeaRisksForProcess(processId);
  if (profile === 'core') return risks.slice(0, 1);
  if (profile === 'balanced') return risks.filter((risk, index) => index < 2 || Number(risk.defaultRatings?.severity || 0) >= 9);
  return risks;
}

function likelyComponentForRoute(routeKey) {
  const entry = selectedProcessEntries().find(item => item.routeKey === routeKey); if (!entry) return 'FINISHED_GOOD';
  const inputs = (entry.detail.inputComponentIds || []).map(id => components.find(item => item.id === id)).filter(item => item && (item.alternativeSelected !== false || !item.alternativeGroupId));
  return inputs.find(item => item.critical)?.id || (entry.detail.outputItemId !== 'FINISHED_GOOD' ? entry.detail.outputItemId : inputs[0]?.id) || 'FINISHED_GOOD';
}

function linkedControlCharacteristic(routeKey, componentId) {
  return characteristics.find(item => item.controlPlanIncluded !== false && item.routeKey === routeKey && item.componentId === componentId)
    || characteristics.find(item => item.controlPlanIncluded !== false && item.routeKey === routeKey)
    || characteristics.find(item => item.controlPlanIncluded !== false && item.componentId === componentId);
}

function pfmeaRowFromLibrary(routeKey, risk, duplicate = false) {
  const entry = selectedProcessEntries().find(item => item.routeKey === routeKey);
  const componentId = likelyComponentForRoute(routeKey); const control = linkedControlCharacteristic(routeKey, componentId);
  const linkedClassification = control?.classification && control.classification !== 'Normal' ? control.classification : 'NONE';
  const template = pfmeaEngineeringLibrary?.processTemplates?.find(item => item.id === risk.processTemplateId);
  const workElement = template?.workElements?.find(item => item.id === risk.workElementId);
  const componentName = componentId === 'FINISHED_GOOD' ? (partName.value || 'Ana mamul') : (components.find(item => item.id === componentId)?.name || 'Bileşen');
  const functionText = pfmeaLibraryText(risk.function) || workElement?.functionTR || template?.nameTR || '';
  const effectText = pfmeaLibraryText(risk.effects?.[0]);
  const profile = globalThis.TyanaFmea?.snapshot?.().profiles?.pfmea || {};
  const unique = duplicate ? `::${crypto.randomUUID()}` : '';
  return newPfmeaRow({
    sourceKey: `library::${routeKey}::${risk.id}${unique}`, routeKey, processId: entry?.process.id || '', operationNo: entry?.detail.operationNo, componentId, controlPlanCharacteristicId: control?.id || '', controlPlanRowId: control?.controlPlanRowId || control?.id || '',
    contentOrigin: 'generated-draft', sourceRouteDocumentId: entry?.detail.sourceDocumentId || '', sourceRouteRef: entry?.detail.sourceRef || '', sourcePfmeaDocumentId: '', sourcePfmeaRef: '',
    libraryRiskId: risk.id, libraryProcessTemplateId: risk.processTemplateId, workElementId: risk.workElementId, workElement: workElement?.nameTR || '',
    processItem: componentName, processStep: entry?.detail.operationLabelTR || entry?.process.name || template?.nameTR || '', workElementType: pfmeaWorkElementTypeFor(risk, workElement),
    processItemFunction: `${componentName} üzerinde tanımlı ürün ve proses şartlarını korumak`, functionText, workElementFunction: workElement?.functionTR || functionText,
    failureMode: pfmeaLibraryText(risk.failureMode), effect: effectText, effectOwnPlant: '', effectShipToPlant: '', effectEndUser: effectText,
    severity: String(risk.defaultRatings?.severity || ''), cause: pfmeaLibraryText(risk.causes?.[0]), preventionControl: pfmeaLibraryText(risk.preventionControls?.[0]), occurrence: String(risk.defaultRatings?.occurrence || ''),
    detectionControl: pfmeaLibraryText(risk.detectionControls?.[0]), detection: String(risk.defaultRatings?.detection || ''), ap: '', specialCharacteristic: linkedClassification,
    recommendedAction: pfmeaLibraryText(risk.recommendedActions?.[0]), preventionAction: pfmeaLibraryText(risk.recommendedActions?.[0]), detectionAction: '',
    owner: pfmeaOwnerName(risk.ownerRoles?.[0]), ownerRoleId: risk.ownerRoles?.[0] || '', evidenceType: risk.evidenceTypeIds?.[0] || '',
    reactionPlan: pfmeaLibraryText(risk.reactionPlan), ratingsRationale: pfmeaLibraryText(risk.defaultRatings?.rationale), ratingTableRef: profile.ratingTableRef || '',
    status: 'Açık', evidence: '', manual: true
  });
}

function renderPfmeaLibrarySelectors() {
  const operationSelect = document.getElementById('pfmeaLibraryOperation'); const riskSelect = document.getElementById('pfmeaLibraryRisk');
  if (!operationSelect || !riskSelect) return;
  const entries = selectedProcessEntries();
  if (!entries.some(entry => entry.routeKey === pfmeaUiState.routeKey)) pfmeaUiState.routeKey = entries[0]?.routeKey || '';
  operationSelect.innerHTML = entries.length ? entries.map(entry => `<option value="${escapeHtml(entry.routeKey)}">OP ${escapeHtml(entry.detail.operationNo)} • ${escapeHtml(entry.process.name)}</option>`).join('') : '<option value="">Önce proses rotası oluşturun</option>';
  operationSelect.value = pfmeaUiState.routeKey;
  const selectedEntry = entries.find(entry => entry.routeKey === operationSelect.value) || entries[0];
  const risks = selectedEntry ? pfmeaRisksForProcess(selectedEntry.process.id) : [];
  riskSelect.innerHTML = risks.length ? risks.map(risk => `<option value="${escapeHtml(risk.id)}">${escapeHtml(risk.id)} • ${escapeHtml(pfmeaLibraryText(risk.failureMode))}</option>`).join('') : '<option value="">Bu operasyon için kütüphane riski yok — manuel eklenebilir</option>';
  const hint = document.getElementById('pfmeaLibraryHint'); if (hint && selectedEntry) hint.textContent = `${selectedEntry.process.name}: ${risks.length} seçilebilir risk • S/O/D değerleri taslak başlangıçtır; AP kullanıcı seçimi zorunludur.`;
  renderPfmeaQuickStudio(entries);
}

function renderPfmeaQuickStudio(entries = selectedProcessEntries()) {
  const operationRail = document.getElementById('pfmeaOperationRail'); const riskGallery = document.getElementById('pfmeaRiskGallery');
  if (!operationRail || !riskGallery) return;
  const routeKey = entries.some(entry => entry.routeKey === pfmeaUiState.routeKey) ? pfmeaUiState.routeKey : entries[0]?.routeKey || '';
  pfmeaUiState.routeKey = routeKey;
  const routeWithRisk = entries.filter(entry => pfmeaRows.some(row => row.routeKey === entry.routeKey)).length;
  operationRail.innerHTML = entries.length ? entries.map(entry => {
    const existing = pfmeaRows.filter(row => row.routeKey === entry.routeKey); const available = pfmeaRisksForProcess(entry.process.id).length;
    const assessed = existing.filter(row => pfmeaCompleteness(row) === 100).length; const active = entry.routeKey === routeKey;
    return `<button type="button" class="pfmea-operation-card ${active ? 'active' : ''} ${existing.length ? 'has-risk' : ''}" data-pfmea-operation="${escapeHtml(entry.routeKey)}" aria-pressed="${active}"><span>OP ${escapeHtml(entry.detail.operationNo)}</span><div><b>${escapeHtml(entry.process.name)}</b><small>${existing.length} mevcut • ${available} kütüphane riski</small></div><mark>${assessed}/${existing.length || '—'}</mark></button>`;
  }).join('') : '<div class="pfmea-loading-card">Önce proses akışından rota oluşturun.</div>';
  const operationProgress = document.getElementById('pfmeaOperationProgress'); if (operationProgress) operationProgress.textContent = `${routeWithRisk} / ${entries.length}`;
  const selectedEntry = entries.find(entry => entry.routeKey === routeKey);
  const riskQuery = pfmeaUiState.riskQuery.trim().toLocaleLowerCase('tr-TR');
  const risks = selectedEntry ? pfmeaRisksForProcess(selectedEntry.process.id).filter(risk => !riskQuery || [risk.id, pfmeaLibraryText(risk.failureMode), pfmeaLibraryText(risk.function), ...(risk.causes || []).map(pfmeaLibraryText), ...(risk.detectionControls || []).map(pfmeaLibraryText)].some(value => String(value || '').toLocaleLowerCase('tr-TR').includes(riskQuery))) : [];
  const existingIds = new Set(pfmeaRows.filter(row => row.routeKey === routeKey).map(row => row.libraryRiskId).filter(Boolean));
  pfmeaUiState.pickedRiskIds = new Set([...pfmeaUiState.pickedRiskIds].filter(id => risks.some(risk => risk.id === id) && !existingIds.has(id)));
  riskGallery.innerHTML = risks.length ? risks.map(risk => {
    const ratings = risk.defaultRatings || {}; const selectedRisk = pfmeaUiState.pickedRiskIds.has(risk.id); const existing = existingIds.has(risk.id);
    const effect = pfmeaLibraryText(risk.effects?.[0]); const suggestedSpecial = risk.specialCharacteristic?.defaultType || 'NONE';
    return `<button type="button" class="pfmea-template-card ${selectedRisk ? 'selected' : ''} ${existing ? 'existing' : ''}" data-pfmea-pick-risk="${escapeHtml(risk.id)}" aria-pressed="${selectedRisk}" ${existing ? 'disabled' : ''}><span class="pfmea-template-check">${existing ? '✓' : selectedRisk ? '✓' : ''}</span><div class="pfmea-template-title"><small>${escapeHtml(risk.id)} • ${escapeHtml(risk.category || 'Proses riski')}</small><b>${escapeHtml(pfmeaLibraryText(risk.failureMode))}</b></div><p>${escapeHtml(effect || pfmeaLibraryText(risk.function))}</p><div class="pfmea-template-scores"><span>S <b>${escapeHtml(ratings.severity || '—')}</b></span><span>O <b>${escapeHtml(ratings.occurrence || '—')}</b></span><span>T <b>${escapeHtml(ratings.detection || '—')}</b></span><mark>${escapeHtml(suggestedSpecial)}</mark></div><small class="pfmea-template-state">${existing ? 'PFMEA içinde mevcut' : 'Seçmek için tıklayın'}</small></button>`;
  }).join('') : `<div class="pfmea-loading-card">${selectedEntry ? 'Aramayla eşleşen kütüphane riski yok.' : 'Önce bir operasyon seçin.'}</div>`;
  const pickedCount = pfmeaUiState.pickedRiskIds.size;
  const pickedCountNode = document.getElementById('pfmeaPickedCount'); if (pickedCountNode) pickedCountNode.textContent = pickedCount;
  const pickedOperation = document.getElementById('pfmeaPickedOperation'); if (pickedOperation) pickedOperation.textContent = selectedEntry ? `OP ${selectedEntry.detail.operationNo} • ${selectedEntry.process.name}` : '—';
  const availableCount = document.getElementById('pfmeaAvailableRiskCount'); if (availableCount) availableCount.textContent = `${risks.length} risk`;
  const existingCount = document.getElementById('pfmeaExistingRiskCount'); if (existingCount) existingCount.textContent = `${pfmeaRows.filter(row => row.routeKey === routeKey).length} satır`;
  const addPicked = document.querySelector('[data-action="pfmea-add-picked"]'); if (addPicked) addPicked.disabled = !pickedCount;
}

document.getElementById('pfmeaLibraryOperation')?.addEventListener('change', event => { pfmeaUiState.routeKey = event.target.value; pfmeaUiState.pickedRiskIds.clear(); renderPfmeaLibrarySelectors(); });
document.querySelector('[data-action="add-pfmea-library-risk"]')?.addEventListener('click', () => {
  const routeKey = document.getElementById('pfmeaLibraryOperation').value; const riskId = document.getElementById('pfmeaLibraryRisk').value;
  const risk = pfmeaEngineeringLibrary?.riskTemplates?.find(item => item.id === riskId); if (!routeKey || !risk) { toast('PFMEA riski seçilmedi', 'Operasyon ve risk şablonunu seçin.'); return; }
  pfmeaRows.push(pfmeaRowFromLibrary(routeKey, risk, true)); renderPfmea(); markDraftDirty(); toast('Kütüphane riski eklendi', `${risk.id} • tüm alanlar düzenlenebilir; AP ekip tarafından seçilmelidir.`);
});
document.querySelector('[data-action="add-pfmea-process-risks"]')?.addEventListener('click', () => {
  const routeKey = document.getElementById('pfmeaLibraryOperation').value; const entry = selectedProcessEntries().find(item => item.routeKey === routeKey); if (!entry) return;
  const existing = new Set(pfmeaRows.filter(row => row.routeKey === routeKey).map(row => row.libraryRiskId)); const risks = pfmeaRisksForProcess(entry.process.id).filter(risk => !existing.has(risk.id));
  pfmeaRows.push(...risks.map(risk => pfmeaRowFromLibrary(routeKey, risk))); renderPfmea(); markDraftDirty(); toast('Proses risk seti eklendi', `${entry.process.name} için ${risks.length} yeni seçilebilir risk satırı eklendi.`);
});

const pfmeaView = document.getElementById('pfmea');
pfmeaView?.addEventListener('click', event => {
  const operationButton = event.target.closest('[data-pfmea-operation]');
  if (operationButton) {
    pfmeaUiState.routeKey = operationButton.dataset.pfmeaOperation; pfmeaUiState.pickedRiskIds.clear();
    const operationSelect = document.getElementById('pfmeaLibraryOperation'); if (operationSelect) operationSelect.value = pfmeaUiState.routeKey;
    renderPfmeaLibrarySelectors(); return;
  }
  const riskButton = event.target.closest('[data-pfmea-pick-risk]');
  if (riskButton && !riskButton.disabled) {
    const riskId = riskButton.dataset.pfmeaPickRisk;
    if (pfmeaUiState.pickedRiskIds.has(riskId)) pfmeaUiState.pickedRiskIds.delete(riskId); else pfmeaUiState.pickedRiskIds.add(riskId);
    renderPfmeaQuickStudio(); return;
  }
  const filterButton = event.target.closest('[data-pfmea-filter]');
  if (filterButton) {
    pfmeaUiState.filter = filterButton.dataset.pfmeaFilter;
    document.querySelectorAll('[data-pfmea-filter]').forEach(button => button.classList.toggle('active', button === filterButton));
    renderPfmea(); return;
  }
  const apButton = event.target.closest('[data-pfmea-ap]');
  if (apButton) {
    const row = pfmeaRows.find(item => item.id === apButton.dataset.pfmeaRowId); if (!row) return;
    row.ap = apButton.dataset.pfmeaAp; pfmeaUiState.expandedRowIds.add(row.id); renderPfmea(); markDraftDirty(); return;
  }
  const suggestion = event.target.closest('[data-pfmea-suggestion-field]');
  if (suggestion) {
    const row = pfmeaRows.find(item => item.id === suggestion.dataset.pfmeaRowId); if (!row) return;
    const field = suggestion.dataset.pfmeaSuggestionField;
    row[field] = suggestion.dataset.pfmeaSuggestionValue || '';
    if (['effectOwnPlant', 'effectShipToPlant', 'effectEndUser'].includes(field)) row.effect = pfmeaEffectText(row);
    if (['preventionAction', 'detectionAction'].includes(field)) row.recommendedAction = pfmeaActionText(row);
    pfmeaUiState.expandedRowIds.add(row.id); renderPfmea(); markDraftDirty(); return;
  }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'pfmea-clear-picked') { pfmeaUiState.pickedRiskIds.clear(); renderPfmeaQuickStudio(); return; }
  if (action === 'pfmea-add-picked') {
    const routeKey = pfmeaUiState.routeKey; const existing = new Set(pfmeaRows.filter(row => row.routeKey === routeKey).map(row => row.libraryRiskId));
    const risks = (pfmeaEngineeringLibrary?.riskTemplates || []).filter(risk => pfmeaUiState.pickedRiskIds.has(risk.id) && !existing.has(risk.id));
    pfmeaRows.push(...risks.map(risk => pfmeaRowFromLibrary(routeKey, risk))); pfmeaUiState.pickedRiskIds.clear();
    if (risks.length) { markDraftDirty(); toast('Seçili PFMEA riskleri eklendi', `${risks.length} risk satırı S-O-D taslaklarıyla oluşturuldu; AP ekip tarafından seçilecek.`); }
    renderPfmea(); return;
  }
  if (action === 'pfmea-quick-generate') {
    const profile = document.getElementById('pfmeaQuickProfile')?.value || 'balanced'; const entries = selectedProcessEntries();
    const existing = new Set(pfmeaRows.filter(row => row.libraryRiskId).map(row => `${row.routeKey}::${row.libraryRiskId}`)); const additions = [];
    entries.forEach(entry => pfmeaProfileRisks(entry.process.id, profile).forEach(risk => {
      const key = `${entry.routeKey}::${risk.id}`; if (!existing.has(key)) { existing.add(key); additions.push(pfmeaRowFromLibrary(entry.routeKey, risk)); }
    }));
    pfmeaRows.push(...additions); if (additions.length) markDraftDirty(); renderPfmea();
    toast(additions.length ? 'PFMEA hızlı hazırlama tamamlandı' : 'PFMEA zaten güncel', additions.length ? `${entries.length} operasyon için ${additions.length} eksik risk eklendi; mevcut kullanıcı satırları korundu.` : 'Seçilen profile göre eklenecek yeni kütüphane riski bulunmadı.'); return;
  }
  if (action === 'pfmea-expand-all') {
    pfmeaUiState.expandAll = !pfmeaUiState.expandAll; if (!pfmeaUiState.expandAll) pfmeaUiState.expandedRowIds.clear();
    event.target.closest('button').textContent = pfmeaUiState.expandAll ? 'Tüm Detayları Kapat' : 'Tüm Detayları Aç'; renderPfmea(); return;
  }
  if (action === 'pfmea-bulk-clear') { pfmeaUiState.selectedRowIds.clear(); renderPfmea(); return; }
  if (action === 'pfmea-bulk-apply') {
    const owner = document.getElementById('pfmeaBulkOwner')?.value.trim(); const dueDate = document.getElementById('pfmeaBulkDue')?.value; const status = document.getElementById('pfmeaBulkStatus')?.value;
    if (!owner && !dueDate && !status) { toast('Toplu işlem alanı boş', 'Sorumlu, termin veya durum alanlarından en az birini girin.'); return; }
    let changed = 0; pfmeaRows.forEach(row => { if (!pfmeaUiState.selectedRowIds.has(row.id)) return; if (owner) row.owner = owner; if (dueDate) row.dueDate = dueDate; if (status) row.status = status; changed += 1; });
    if (changed) { markDraftDirty(); toast('Toplu aksiyon bilgisi uygulandı', `${changed} PFMEA risk satırı güncellendi.`); }
    renderPfmea(); return;
  }
});

pfmeaView?.addEventListener('change', event => {
  if (event.target.matches('[data-pfmea-select-row]')) {
    const rowId = event.target.dataset.pfmeaSelectRow;
    if (event.target.checked) pfmeaUiState.selectedRowIds.add(rowId); else pfmeaUiState.selectedRowIds.delete(rowId);
    event.target.closest('.pfmea-risk-card')?.classList.toggle('selected', event.target.checked);
    updatePfmeaBulkBar();
  }
});

document.getElementById('pfmeaRiskSearch')?.addEventListener('input', event => { pfmeaUiState.riskQuery = event.target.value; renderPfmeaQuickStudio(); });
document.getElementById('pfmeaWorkbenchSearch')?.addEventListener('input', event => { pfmeaUiState.query = event.target.value; renderPfmea(); });
document.getElementById('pfmeaSort')?.addEventListener('change', event => { pfmeaUiState.sort = event.target.value; renderPfmea(); });

function pfmeaSourceKey(routeKey, riskIndex) { return `${routeKey}::risk-${riskIndex}`; }

function newPfmeaRow(overrides = {}) {
  const entry = selectedProcessEntries().find(item => item.routeKey === (overrides.routeKey || selected[0]));
  const profile = globalThis.TyanaFmea?.snapshot?.().profiles?.pfmea || {};
  return {
    id: `FMEA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, sourceKey: `manual::${crypto.randomUUID()}`, routeKey: selected[0] || '', processId: selected[0] ? routeBaseId(selected[0]) : '', componentId: 'FINISHED_GOOD',
    processItem: partName.value || 'Ana mamul', processStep: entry?.process.name || '', workElementType: '', workElement: '',
    processItemFunction: '', functionText: 'Proses fonksiyonunu tanımlayın', workElementFunction: '',
    failureMode: 'Hata türünü tanımlayın', effect: 'Müşteri / sonraki operasyon etkisini tanımlayın', effectOwnPlant: '', effectShipToPlant: '', effectEndUser: '', severity: '',
    cause: 'Hata nedenini tanımlayın', preventionControl: 'Önleme kontrolünü tanımlayın', occurrence: '', detectionControl: 'Tespit kontrolünü tanımlayın', detection: '', ap: '',
    recommendedAction: '', preventionAction: '', detectionAction: '', owner: '', ownerRoleId: '', dueDate: '', status: 'Açık',
    actionCompletionDate: '', actionEvidence: '', evidence: '', evidenceType: '', resultSeverity: '', resultOccurrence: '', resultDetection: '', resultAp: '', resultRationale: '',
    riskAcceptanceRef: '', filterCode: '', notes: '', specialCharacteristic: 'NONE',
    reactionPlan: 'Prosesi durdur; şüpheli ürünü son iyi parçadan itibaren bloke et; kalite onayı olmadan yeniden başlatma.',
    ratingsRationale: '', severityRationale: '', occurrenceRationale: '', detectionRationale: '', ratingTableRef: profile.ratingTableRef || '',
    libraryRiskId: '', libraryProcessTemplateId: '', workElementId: '', controlPlanCharacteristicId: '', controlPlanRowId: '', routeOrphaned: false, manual: true,
    contentOrigin: 'user-created-draft', sourceRouteDocumentId: '', sourceRouteRef: '', sourcePfmeaDocumentId: '', sourcePfmeaRef: '', ...overrides
  };
}

function syncPfmeaFromRoute(shouldRender = true) {
  const existing = new Map(pfmeaRows.map(row => [row.sourceKey, row]));
  const generated = selectedProcessEntries().flatMap(({ routeKey, process, detail }) => {
    const componentId = likelyComponentForRoute(routeKey); const control = linkedControlCharacteristic(routeKey, componentId);
    const libraryRisk = pfmeaRisksForProcess(process.id)[0];
    if (libraryRisk) {
      const sourceKey = pfmeaSourceKey(routeKey, 0);
      const row = existing.get(sourceKey) || { ...pfmeaRowFromLibrary(routeKey, libraryRisk), sourceKey, manual: false };
      Object.assign(row, { routeKey, processId: process.id, operationNo: detail.operationNo, componentId: row.componentId && row.componentId !== 'FINISHED_GOOD' && components.some(item => item.id === row.componentId) ? row.componentId : componentId, routeOrphaned: false, contentOrigin: 'generated-draft', sourceRouteDocumentId: detail.sourceDocumentId || '', sourceRouteRef: detail.sourceRef || '', sourcePfmeaDocumentId: '', sourcePfmeaRef: '' });
      if (!row.controlPlanCharacteristicId && control) { row.controlPlanCharacteristicId = control.id; row.controlPlanRowId = control.controlPlanRowId || control.id; }
      return [row];
    }
    const risks = Array.isArray(process.riskTemplate) && process.riskTemplate.length ? process.riskTemplate : ['Proses hata türü kullanıcı tarafından tanımlanacak'];
    return risks.slice(0, 1).map((risk, riskIndex) => {
      const sourceKey = pfmeaSourceKey(routeKey, riskIndex);
      const row = existing.get(sourceKey) || newPfmeaRow({
        sourceKey, routeKey, processId: process.id, functionText: process.pfmeaFunction || process.desc || process.name, failureMode: risk,
        cause: 'Onaylı proses ekibi analizi gerekli', preventionControl: process.controlMethod || 'Önleme kontrolü tanımlanacak', detectionControl: process.controlMethod || 'Tespit kontrolü tanımlanacak', recommendedAction: '', manual: false,
        operationNo: detail.operationNo, componentId, controlPlanCharacteristicId: control?.id || '', controlPlanRowId: control?.controlPlanRowId || control?.id || '',
        contentOrigin: 'generated-draft', sourceRouteDocumentId: detail.sourceDocumentId || '', sourceRouteRef: detail.sourceRef || '', sourcePfmeaDocumentId: '', sourcePfmeaRef: ''
      });
      Object.assign(row, { routeKey, processId: process.id, operationNo: detail.operationNo, routeOrphaned: false, contentOrigin: 'generated-draft', sourceRouteDocumentId: detail.sourceDocumentId || '', sourceRouteRef: detail.sourceRef || '', sourcePfmeaDocumentId: '', sourcePfmeaRef: '' }); return row;
    });
  });
  const manualRows = pfmeaRows.filter(row => row.manual).map(row => ({ ...row, routeOrphaned: Boolean(row.routeKey && !selected.includes(row.routeKey)) }));
  pfmeaRows = [...generated, ...manualRows];
  if (shouldRender) renderPfmea();
}

function pfmeaNumberOptions(value) {
  return '<option value="">—</option>' + Array.from({ length: 10 }, (_, index) => index + 1).map(number => `<option value="${number}" ${String(value) === String(number) ? 'selected' : ''}>${number}</option>`).join('');
}

function renderPfmeaLegacy() {
  const grid = document.querySelector('#pfmea .fmea-grid'); if (!grid) return;
  const entries = selectedProcessEntries();
  grid.innerHTML = `<div class="fmea-row fmea-head"><span>OP.</span><span>PROSES FONKSİYONU</span><span>HATA TÜRÜ / ETKİSİ</span><span>Ş</span><span>NEDEN / ÖNLEME</span><span>O</span><span>TESPİT / AKSİYON</span><span>T</span><span>AP</span></div>` + (pfmeaRows.length ? pfmeaRows.map((row, index) => {
    const entry = entries.find(item => item.routeKey === row.routeKey); const operationNo = entry?.detail.operationNo || row.operationNo || '—'; const process = entry?.process || processes.find(candidate => candidate.id === row.processId); const processName = entry ? routeOperationIdentity(entry.process, entry.detail).title : process?.name || 'Manuel risk';
    const riskSuggestions = Array.isArray(process?.riskTemplate) ? process.riskTemplate : [];
    const apClass = row.ap === 'H' && row.status !== 'Kapalı' ? 'high-ap' : row.ap === 'M' ? 'medium-ap' : row.ap === 'L' ? 'low-ap' : 'unrated-ap';
    const routeSelector = row.manual ? `<select data-pfmea-field="routeKey"><option value="">Operasyon seçin</option>${row.routeOrphaned ? `<option value="${escapeHtml(row.routeKey)}" selected>⚠ Eski operasyon — yeniden atayın</option>` : ''}${entries.map(candidate => `<option value="${escapeHtml(candidate.routeKey)}" ${candidate.routeKey === row.routeKey ? 'selected' : ''}>OP ${escapeHtml(candidate.detail.operationNo)} • ${escapeHtml(candidate.process.name)}</option>`).join('')}</select>` : '';
    const componentSelector = `<select data-pfmea-field="componentId"><option value="FINISHED_GOOD" ${row.componentId === 'FINISHED_GOOD' ? 'selected' : ''}>FG • ${escapeHtml(partName.value)}</option>${components.map(component => `<option value="${escapeHtml(component.id)}" ${component.id === row.componentId ? 'selected' : ''}>${escapeHtml(component.position)} • ${escapeHtml(component.name)}</option>`).join('')}</select>`;
    const controlSelector = `<select data-pfmea-field="controlPlanCharacteristicId"><option value="">Kontrol planı bağlantısı seçin</option>${characteristics.filter(item => item.controlPlanIncluded !== false).map(item => `<option value="${escapeHtml(item.id)}" ${item.id === row.controlPlanCharacteristicId || item.controlPlanRowId === row.controlPlanRowId ? 'selected' : ''}>${escapeHtml(item.balloon)} • ${escapeHtml(item.name)} • ${escapeHtml(characteristicOwner(item).name)}</option>`).join('')}</select>`;
    return `<div class="fmea-row pfmea-edit-row" data-pfmea-index="${index}"><span><b>OP ${escapeHtml(operationNo)}</b>${routeSelector}<small>${escapeHtml(row.componentId === 'FINISHED_GOOD' ? partName.value : components.find(item => item.id === row.componentId)?.name || 'Bileşen seçin')}</small></span><span><b>${escapeHtml(processName)}</b><textarea data-pfmea-field="functionText" rows="3">${escapeHtml(row.functionText)}</textarea></span><span><input data-pfmea-field="failureMode" list="pfmea-risk-${index}" value="${escapeHtml(row.failureMode)}"><datalist id="pfmea-risk-${index}">${riskSuggestions.map(risk => `<option>${escapeHtml(risk)}</option>`).join('')}</datalist><textarea data-pfmea-field="effect" rows="2">${escapeHtml(row.effect)}</textarea></span><span><select data-pfmea-field="severity">${pfmeaNumberOptions(row.severity)}</select></span><span><textarea data-pfmea-field="cause" rows="2">${escapeHtml(row.cause)}</textarea><textarea data-pfmea-field="preventionControl" rows="2">${escapeHtml(row.preventionControl)}</textarea></span><span><select data-pfmea-field="occurrence">${pfmeaNumberOptions(row.occurrence)}</select></span><span><textarea data-pfmea-field="detectionControl" rows="2">${escapeHtml(row.detectionControl)}</textarea><input data-pfmea-field="recommendedAction" value="${escapeHtml(row.recommendedAction)}" placeholder="Önerilen aksiyon"><div class="pfmea-action-meta"><input data-pfmea-field="owner" value="${escapeHtml(row.owner)}" placeholder="Sorumlu"><input data-pfmea-field="dueDate" type="date" value="${escapeHtml(row.dueDate)}"></div><input data-pfmea-field="evidence" value="${escapeHtml(row.evidence)}" placeholder="Kanıt / kayıt / doğrulama no"></span><span><select data-pfmea-field="detection">${pfmeaNumberOptions(row.detection)}</select></span><span><select class="ap ${apClass}" data-pfmea-field="ap"><option value="">Açık</option><option value="H" ${row.ap === 'H' ? 'selected' : ''}>H</option><option value="M" ${row.ap === 'M' ? 'selected' : ''}>M</option><option value="L" ${row.ap === 'L' ? 'selected' : ''}>L</option></select><select data-pfmea-field="status"><option ${row.status === 'Açık' ? 'selected' : ''}>Açık</option><option ${row.status === 'Devam Ediyor' ? 'selected' : ''}>Devam Ediyor</option><option ${row.status === 'Kapalı' ? 'selected' : ''}>Kapalı</option></select>${row.manual ? `<button class="remove-characteristic" data-remove-pfmea="${index}" aria-label="Riski kaldır">×</button>` : ''}</span></div>`;
  }).join('') : '<div class="pfmea-empty"><span>△</span><h3>Rota kaynaklı risk satırı yok</h3><p>Önce proses rotasını oluşturun veya manuel hata türü ekleyin.</p></div>');
  grid.querySelectorAll('[data-pfmea-field]').forEach(field => {
    const update = event => { const row = pfmeaRows[Number(event.target.closest('[data-pfmea-index]').dataset.pfmeaIndex)]; row[event.target.dataset.pfmeaField] = event.target.value; if (event.target.dataset.pfmeaField === 'routeKey') { const entry = selectedProcessEntries().find(item => item.routeKey === event.target.value); if (entry) { row.processId = entry.process.id; row.operationNo = entry.detail.operationNo; row.functionText = entry.process.pfmeaFunction || entry.process.desc || entry.process.name; } } updatePfmeaSummary(); markDraftDirty(); };
    field.addEventListener('input', update); field.addEventListener('change', event => { update(event); renderPfmea(); });
  });
  grid.querySelectorAll('[data-remove-pfmea]').forEach(button => button.addEventListener('click', () => { pfmeaRows.splice(Number(button.dataset.removePfmea), 1); renderPfmea(); markDraftDirty(); }));
  updatePfmeaSummary();
}

function renderPfmeaTableLegacy() {
  const grid = document.querySelector('#pfmea .fmea-grid'); if (!grid) return;
  const entries = selectedProcessEntries();
  const header = `<div class="fmea-row fmea-head"><span>OP.</span><span>PROSES FONKSİYONU</span><span>HATA TÜRÜ / ETKİSİ</span><span>Ş</span><span>NEDEN / ÖNLEME</span><span>O</span><span>TESPİT / AKSİYON</span><span>T</span><span>AP</span></div>`;
  const rows = pfmeaRows.map((row, index) => {
    const entry = entries.find(item => item.routeKey === row.routeKey); const operationNo = entry?.detail.operationNo || row.operationNo || '—';
    const process = entry?.process || processes.find(candidate => candidate.id === row.processId); const processName = entry ? routeOperationIdentity(entry.process, entry.detail).title : process?.name || 'Manuel risk';
    const libraryRisk = pfmeaEngineeringLibrary?.riskTemplates?.find(risk => risk.id === row.libraryRiskId);
    const libraryRisks = pfmeaRisksForProcess(process?.id || row.processId);
    const riskSuggestions = [...new Set([...(process?.riskTemplate || []), ...libraryRisks.map(risk => pfmeaLibraryText(risk.failureMode))])];
    const effectSuggestions = libraryRisk?.effects || libraryRisks.flatMap(risk => risk.effects || []); const causeSuggestions = libraryRisk?.causes || libraryRisks.flatMap(risk => risk.causes || []);
    const preventionSuggestions = libraryRisk?.preventionControls || libraryRisks.flatMap(risk => risk.preventionControls || []); const detectionSuggestions = libraryRisk?.detectionControls || libraryRisks.flatMap(risk => risk.detectionControls || []);
    const actionSuggestions = libraryRisk?.recommendedActions || libraryRisks.flatMap(risk => risk.recommendedActions || []);
    const apClass = row.ap === 'H' && row.status !== 'Kapalı' ? 'high-ap' : row.ap === 'M' ? 'medium-ap' : row.ap === 'L' ? 'low-ap' : 'unrated-ap';
    const routeSelector = row.manual ? `<select data-pfmea-field="routeKey">${entries.map(candidate => `<option value="${escapeHtml(candidate.routeKey)}" ${candidate.routeKey === row.routeKey ? 'selected' : ''}>OP ${escapeHtml(candidate.detail.operationNo)} • ${escapeHtml(candidate.process.name)}</option>`).join('')}</select>` : '';
    const datalist = (id, values) => `<datalist id="${id}">${values.map(value => `<option>${escapeHtml(pfmeaLibraryText(value) || value)}</option>`).join('')}</datalist>`;
    const evidenceOptions = (pfmeaEngineeringLibrary?.evidenceTypes || []).map(item => `<option value="${escapeHtml(item.id)}" ${item.id === row.evidenceType ? 'selected' : ''}>${escapeHtml(item.nameTR)}</option>`).join('');
    const specialOptions = (pfmeaEngineeringLibrary?.specialCharacteristicTypes || []).map(item => `<option value="${escapeHtml(item.id)}" ${item.id === row.specialCharacteristic ? 'selected' : ''}>${escapeHtml(item.nameTR || item.id)}</option>`).join('');
    const componentSelector = `<select data-pfmea-field="componentId"><option value="FINISHED_GOOD" ${row.componentId === 'FINISHED_GOOD' ? 'selected' : ''}>FG • ${escapeHtml(partName.value)}</option>${components.map(component => `<option value="${escapeHtml(component.id)}" ${component.id === row.componentId ? 'selected' : ''}>${escapeHtml(component.position)} • ${escapeHtml(component.name)}</option>`).join('')}</select>`;
    const controlSelector = `<select data-pfmea-field="controlPlanCharacteristicId"><option value="">Kontrol planı bağlantısı seçin</option>${characteristics.filter(item => item.controlPlanIncluded !== false).map(item => { const selectedControl = item.id === row.controlPlanCharacteristicId || Boolean(row.controlPlanRowId && item.controlPlanRowId === row.controlPlanRowId); return `<option value="${escapeHtml(item.id)}" ${selectedControl ? 'selected' : ''}>${escapeHtml(item.balloon)} • ${escapeHtml(item.name)} • ${escapeHtml(characteristicOwner(item).name)}</option>`; }).join('')}</select>`;
    return `<div class="fmea-row pfmea-edit-row" data-pfmea-index="${index}">
      <span><b>OP ${escapeHtml(operationNo)}</b>${routeSelector}<small>${escapeHtml(row.componentId === 'FINISHED_GOOD' ? partName.value : components.find(item => item.id === row.componentId)?.name || 'Bileşen seçin')}</small><small>${escapeHtml(row.libraryRiskId || 'Kullanıcı kaydı')}</small></span>
      <span><b>${escapeHtml(processName)}</b><textarea data-pfmea-field="functionText" rows="3">${escapeHtml(row.functionText)}</textarea><small>${escapeHtml(row.workElement || '')}</small></span>
      <span><input data-pfmea-field="failureMode" list="pfmea-risk-${index}" value="${escapeHtml(row.failureMode)}">${datalist(`pfmea-risk-${index}`, riskSuggestions)}<textarea data-pfmea-field="effect" list="pfmea-effect-${index}" rows="2">${escapeHtml(row.effect)}</textarea>${datalist(`pfmea-effect-${index}`, effectSuggestions)}</span>
      <span><select data-pfmea-field="severity">${pfmeaNumberOptions(row.severity)}</select></span>
      <span><textarea data-pfmea-field="cause" list="pfmea-cause-${index}" rows="2">${escapeHtml(row.cause)}</textarea>${datalist(`pfmea-cause-${index}`, causeSuggestions)}<textarea data-pfmea-field="preventionControl" list="pfmea-prevention-${index}" rows="2">${escapeHtml(row.preventionControl)}</textarea>${datalist(`pfmea-prevention-${index}`, preventionSuggestions)}</span>
      <span><select data-pfmea-field="occurrence">${pfmeaNumberOptions(row.occurrence)}</select></span>
      <span><textarea data-pfmea-field="detectionControl" list="pfmea-detection-${index}" rows="2">${escapeHtml(row.detectionControl)}</textarea>${datalist(`pfmea-detection-${index}`, detectionSuggestions)}<input data-pfmea-field="recommendedAction" list="pfmea-action-${index}" value="${escapeHtml(row.recommendedAction)}" placeholder="Önerilen aksiyon">${datalist(`pfmea-action-${index}`, actionSuggestions)}<div class="pfmea-action-meta"><input data-pfmea-field="owner" value="${escapeHtml(row.owner)}" placeholder="Sorumlu"><input data-pfmea-field="dueDate" type="date" value="${escapeHtml(row.dueDate)}"></div><input data-pfmea-field="evidence" value="${escapeHtml(row.evidence)}" placeholder="Kanıt / kayıt / doğrulama no"></span>
      <span><select data-pfmea-field="detection">${pfmeaNumberOptions(row.detection)}</select></span>
      <span><select class="ap ${apClass}" data-pfmea-field="ap"><option value="">AP seçin</option><option value="H" ${row.ap === 'H' ? 'selected' : ''}>H</option><option value="M" ${row.ap === 'M' ? 'selected' : ''}>M</option><option value="L" ${row.ap === 'L' ? 'selected' : ''}>L</option></select><select data-pfmea-field="status"><option ${row.status === 'Açık' ? 'selected' : ''}>Açık</option><option ${row.status === 'Devam Ediyor' ? 'selected' : ''}>Devam Ediyor</option><option ${row.status === 'Kapalı' ? 'selected' : ''}>Kapalı</option></select><div class="pfmea-row-actions"><button data-duplicate-pfmea="${index}" title="Çoğalt">⧉</button><button data-move-pfmea-up="${index}" title="Yukarı">↑</button><button data-move-pfmea-down="${index}" title="Aşağı">↓</button>${row.manual ? `<button data-remove-pfmea="${index}" title="Kaldır">×</button>` : ''}</div></span>
      <div class="pfmea-detail-strip"><label>Riskin bağlı olduğu BOM kalemi${componentSelector}</label><label>Kontrol planı satırı${controlSelector}</label><label>Özel karakteristik<select data-pfmea-field="specialCharacteristic"><option value="NONE">Yok</option>${specialOptions}</select></label><label>Kanıt türü<select data-pfmea-field="evidenceType"><option value="">Seçiniz</option>${evidenceOptions}</select></label><label>Puan gerekçesi<input data-pfmea-field="ratingsRationale" value="${escapeHtml(row.ratingsRationale || '')}"></label><label>Reaksiyon planı<input data-pfmea-field="reactionPlan" value="${escapeHtml(row.reactionPlan || '')}"></label></div>
    </div>`;
  }).join('');
  grid.innerHTML = header + (rows || '<div class="pfmea-empty"><span>△</span><h3>Rota kaynaklı risk satırı yok</h3><p>Önce proses rotasını oluşturun veya kütüphaneden hata türü ekleyin.</p></div>');
  grid.querySelectorAll('[data-pfmea-field]').forEach(field => {
    const update = event => { const row = pfmeaRows[Number(event.target.closest('[data-pfmea-index]').dataset.pfmeaIndex)]; const key = event.target.dataset.pfmeaField; row[key] = event.target.value; if (key === 'routeKey') { const selectedEntry = selectedProcessEntries().find(item => item.routeKey === event.target.value); if (selectedEntry) { row.processId = selectedEntry.process.id; row.operationNo = selectedEntry.detail.operationNo; row.routeOrphaned = false; if (!row.componentId || row.componentId === 'FINISHED_GOOD') row.componentId = likelyComponentForRoute(row.routeKey); } } if (key === 'componentId') { const linked = linkedControlCharacteristic(row.routeKey, row.componentId); row.controlPlanCharacteristicId = linked?.id || ''; row.controlPlanRowId = linked?.controlPlanRowId || linked?.id || ''; } if (key === 'controlPlanCharacteristicId') { const linked = characteristics.find(item => item.id === event.target.value); row.controlPlanRowId = linked?.controlPlanRowId || linked?.id || ''; } updatePfmeaSummary(); markDraftDirty(); };
    field.addEventListener('input', update); field.addEventListener('change', event => { update(event); if (['routeKey', 'componentId', 'controlPlanCharacteristicId', 'severity', 'occurrence', 'detection', 'ap', 'status', 'resultSeverity', 'resultOccurrence', 'resultDetection', 'resultAp'].includes(event.target.dataset.pfmeaField)) renderPfmea(); });
  });
  grid.querySelectorAll('[data-remove-pfmea]').forEach(button => button.addEventListener('click', () => { pfmeaRows.splice(Number(button.dataset.removePfmea), 1); renderPfmea(); markDraftDirty(); }));
  grid.querySelectorAll('[data-duplicate-pfmea]').forEach(button => button.addEventListener('click', () => { const index = Number(button.dataset.duplicatePfmea); pfmeaRows.splice(index + 1, 0, { ...pfmeaRows[index], id: `FMEA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, sourceKey: `${pfmeaRows[index].sourceKey}::${crypto.randomUUID()}`, manual: true }); renderPfmea(); markDraftDirty(); }));
  const move = (index, direction) => { const target = index + direction; if (target < 0 || target >= pfmeaRows.length) return; [pfmeaRows[index], pfmeaRows[target]] = [pfmeaRows[target], pfmeaRows[index]]; renderPfmea(); markDraftDirty(); };
  grid.querySelectorAll('[data-move-pfmea-up]').forEach(button => button.addEventListener('click', () => move(Number(button.dataset.movePfmeaUp), -1)));
  grid.querySelectorAll('[data-move-pfmea-down]').forEach(button => button.addEventListener('click', () => move(Number(button.dataset.movePfmeaDown), 1)));
  updatePfmeaSummary(); renderPfmeaLibrarySelectors();
}

function pfmeaScoreTone(value) {
  const score = Number(value);
  return !score ? 'unrated' : score >= 8 ? 'critical' : score >= 5 ? 'watch' : 'controlled';
}

function pfmeaRatingMeta(field) {
  const result = String(field || '').startsWith('result');
  const baseField = result ? `${String(field).slice(6, 7).toLocaleLowerCase('tr-TR')}${String(field).slice(7)}` : field;
  const meta = {
    severity: { title: 'Şiddet (S)', short: 'S', guide: 'severity', rationale: result ? 'resultRationale' : 'severityRationale', question: 'Kuruluş, sevk edilen saha ve son kullanıcı etkilerinin en yükseği hangisi?' },
    occurrence: { title: 'Oluşma Olasılığı (O)', short: 'O', guide: 'occurrence', rationale: result ? 'resultRationale' : 'occurrenceRationale', question: 'Hata nedeninin oluşmasını hangi gerçek proses verisi ve önleme kontrolü destekliyor?' },
    detection: { title: 'Tespit Edilebilirlik (T)', short: 'T', guide: 'detection', rationale: result ? 'resultRationale' : 'detectionRationale', question: 'Mevcut tespit kontrolü hatayı nerede, ne zaman ve hangi güvenle yakalıyor?' }
  }[baseField];
  return meta ? { ...meta, field, baseField, result, apField: result ? 'resultAp' : 'ap' } : null;
}

function pfmeaSuggestedActionPriority(severity, occurrence, detection) {
  const s = Number(severity); const o = Number(occurrence); const d = Number(detection);
  if (![s, o, d].every(value => Number.isInteger(value) && value >= 1 && value <= 10)) return '';
  const bands = pfmeaEngineeringLibrary?.ratingGuides?.actionPriorityBands || [];
  const severityBand = bands.find(band => s >= Number(band.sMin) && s <= Number(band.sMax));
  const occurrenceBand = severityBand?.rows?.find(row => o >= Number(row.oMin) && o <= Number(row.oMax));
  const detectionBand = occurrenceBand?.d?.find(([min, max]) => d >= Number(min) && d <= Number(max));
  return detectionBand?.[2] || '';
}

function pfmeaRatingGuideCandidate(row, field, score) {
  const meta = pfmeaRatingMeta(field); if (!meta) return { severity: 0, occurrence: 0, detection: 0 };
  const prefix = meta.result ? 'result' : '';
  const values = {
    severity: Number(row[`${prefix}${prefix ? 'Severity' : 'severity'}`]) || 0,
    occurrence: Number(row[`${prefix}${prefix ? 'Occurrence' : 'occurrence'}`]) || 0,
    detection: Number(row[`${prefix}${prefix ? 'Detection' : 'detection'}`]) || 0
  };
  values[meta.baseField] = Number(score) || 0;
  return values;
}

function renderPfmeaRatingGuideDialog() {
  const row = pfmeaRows.find(item => item.id === pfmeaRatingGuideState.rowId);
  const meta = pfmeaRatingMeta(pfmeaRatingGuideState.field);
  const guides = meta ? pfmeaEngineeringLibrary?.ratingGuides?.[meta.guide] || [] : [];
  const dialog = document.getElementById('pfmeaRatingGuideDialog');
  if (!row || !meta || !dialog) return;
  const stateKey = `${row.id}::${meta.field}`; const stateChanged = dialog.dataset.guideKey !== stateKey; dialog.dataset.guideKey = stateKey;
  const selectedScore = Number(pfmeaRatingGuideState.selectedScore) || Number(row[meta.field]) || 0;
  pfmeaRatingGuideState.selectedScore = selectedScore;
  const title = document.getElementById('pfmeaRatingGuideTitle'); if (title) title.textContent = `${meta.title} kriterini seçin`;
  const context = document.getElementById('pfmeaRatingGuideContext'); if (context) context.textContent = meta.question;
  const list = document.getElementById('pfmeaRatingGuideList');
  if (list) list.innerHTML = guides.map(guide => `<button type="button" class="${Number(guide.score) === selectedScore ? 'selected' : ''} ${pfmeaScoreTone(guide.score)}" data-pfmea-rating-score="${guide.score}"><span>${guide.score}</span><div><b>${escapeHtml(guide.labelTR)}</b><p>${escapeHtml(guide.criterionTR)}</p><small>Kanıt sorusu: ${escapeHtml(guide.evidencePromptTR)}</small></div><mark>${meta.short}</mark></button>`).join('');
  const rationale = document.getElementById('pfmeaRatingGuideRationale');
  if (rationale && stateChanged) rationale.value = row[meta.rationale] || '';
  const source = document.getElementById('pfmeaRatingGuideSource');
  if (source && stateChanged) source.value = row.ratingTableRef || pfmeaEngineeringLibrary?.ratingGuides?.revision || '';
  const selection = document.getElementById('pfmeaRatingGuideSelection');
  const selectedGuide = guides.find(guide => Number(guide.score) === selectedScore);
  if (selection) selection.textContent = selectedGuide ? `${meta.short} = ${selectedScore} • ${selectedGuide.labelTR}` : 'Henüz kriter seçilmedi';
  const apply = document.getElementById('pfmeaRatingGuideApply'); if (apply) apply.disabled = !selectedGuide;
  const candidate = pfmeaRatingGuideCandidate(row, meta.field, selectedScore);
  const suggestedAp = pfmeaSuggestedActionPriority(candidate.severity, candidate.occurrence, candidate.detection);
  const apConfirm = document.getElementById('pfmeaRatingGuideApConfirm');
  if (apConfirm) apConfirm.classList.toggle('hidden', !suggestedAp);
  const apValue = document.getElementById('pfmeaRatingGuideApValue');
  if (apValue) apValue.textContent = suggestedAp ? `Kaynak matrisi AP önerisi: ${suggestedAp}` : 'AP için üç puanı tamamlayın';
}

function openPfmeaRatingGuide(rowId, field) {
  const row = pfmeaRows.find(item => item.id === rowId); const meta = pfmeaRatingMeta(field);
  if (!row || !meta) return;
  pfmeaRatingGuideState.rowId = rowId; pfmeaRatingGuideState.field = field; pfmeaRatingGuideState.selectedScore = Number(row[field]) || 0;
  const checkbox = document.getElementById('pfmeaRatingGuideApplyAp'); if (checkbox) checkbox.checked = false;
  renderPfmeaRatingGuideDialog();
  document.getElementById('pfmeaRatingGuideDialog')?.showModal();
}

function applyPfmeaRatingGuideSelection() {
  const row = pfmeaRows.find(item => item.id === pfmeaRatingGuideState.rowId);
  const meta = pfmeaRatingMeta(pfmeaRatingGuideState.field);
  const score = Number(pfmeaRatingGuideState.selectedScore);
  const guide = pfmeaEngineeringLibrary?.ratingGuides?.[meta?.guide]?.find(item => Number(item.score) === score);
  const rationale = document.getElementById('pfmeaRatingGuideRationale')?.value.trim() || '';
  const source = document.getElementById('pfmeaRatingGuideSource')?.value.trim() || '';
  if (!row || !meta || !guide) return;
  if (!rationale || !source) {
    toast('Puan gerekçesi eksik', 'Nesnel veri/gerekçe ile kontrollü tablo referansı yazılmadan puan uygulanamaz.');
    return;
  }
  row[meta.field] = String(score);
  row[meta.rationale] = rationale;
  row.ratingTableRef = source;
  const summary = `${meta.short}=${score} (${guide.labelTR})`;
  row.ratingsRationale = [row.ratingsRationale, summary].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).join(' • ');
  const candidate = pfmeaRatingGuideCandidate(row, meta.field, score);
  const suggestedAp = pfmeaSuggestedActionPriority(candidate.severity, candidate.occurrence, candidate.detection);
  if (suggestedAp && document.getElementById('pfmeaRatingGuideApplyAp')?.checked) row[meta.apField] = suggestedAp;
  document.getElementById('pfmeaRatingGuideDialog')?.close();
  renderPfmea(); markDraftDirty();
  toast(`${meta.title} kaydedildi`, `${meta.short}=${score}${suggestedAp ? ` • kaynak matrisi AP önerisi ${suggestedAp}` : ''}.`);
}

function pfmeaRatingTile(row, field, label, shortLabel, help) {
  const value = Number(row[field]) || 0;
  return `<article class="pfmea-rating-tile ${pfmeaScoreTone(value)}"><span>${escapeHtml(label)}</span><div><b>${value || '—'}</b><select data-pfmea-field="${escapeHtml(field)}" aria-label="${escapeHtml(label)}">${pfmeaNumberOptions(row[field])}</select></div><i><em style="width:${value * 10}%"></em></i><small>${escapeHtml(shortLabel)} • ${escapeHtml(help)}</small><button type="button" data-open-pfmea-rating="${escapeHtml(field)}">Kriterden seç</button></article>`;
}

function pfmeaSuggestionChips(rowId, field, values = [], current = '') {
  const suggestions = [...new Set(values.map(value => pfmeaLibraryText(value) || String(value || '')).filter(Boolean))].filter(value => value !== current).slice(0, 5);
  if (!suggestions.length) return '';
  return `<div class="pfmea-suggestion-chips"><span>Öneriler</span>${suggestions.map(value => `<button type="button" data-pfmea-row-id="${escapeHtml(rowId)}" data-pfmea-suggestion-field="${escapeHtml(field)}" data-pfmea-suggestion-value="${escapeHtml(value)}">＋ ${escapeHtml(value)}</button>`).join('')}</div>`;
}

function updatePfmeaBulkBar() {
  const validIds = new Set(pfmeaRows.map(row => row.id));
  pfmeaUiState.selectedRowIds = new Set([...pfmeaUiState.selectedRowIds].filter(id => validIds.has(id)));
  const bar = document.getElementById('pfmeaBulkBar'); if (!bar) return;
  bar.classList.toggle('hidden', !pfmeaUiState.selectedRowIds.size);
  const count = document.getElementById('pfmeaBulkCount'); if (count) count.textContent = pfmeaUiState.selectedRowIds.size;
}

function renderPfmea() {
  const grid = document.querySelector('#pfmea .fmea-grid'); if (!grid) return;
  const entries = selectedProcessEntries(); const visibleRows = pfmeaRowsForDisplay();
  const visibleCount = document.getElementById('pfmeaVisibleCount'); if (visibleCount) visibleCount.textContent = `${visibleRows.length} / ${pfmeaRows.length} risk gösteriliyor`;
  const highCount = document.querySelector('[data-pfmea-filter-count="high"]'); if (highCount) highCount.textContent = pfmeaRows.filter(row => row.ap === 'H' && !pfmeaStatusClosed(row)).length;
  document.querySelectorAll('[data-pfmea-filter]').forEach(button => button.classList.toggle('active', button.dataset.pfmeaFilter === pfmeaUiState.filter));
  const sortControl = document.getElementById('pfmeaSort'); if (sortControl) sortControl.value = pfmeaUiState.sort;
  if (!visibleRows.length) {
    grid.innerHTML = `<div class="pfmea-empty"><span>△</span><h3>${pfmeaRows.length ? 'Filtreyle eşleşen risk yok' : 'PFMEA risk satırı henüz yok'}</h3><p>${pfmeaRows.length ? 'Aramayı veya filtreyi değiştirin.' : 'Ultra hızlı hazırlamayı kullanın ya da manuel hata türü ekleyin.'}</p></div>`;
    updatePfmeaSummary(); updatePfmeaBulkBar(); renderPfmeaLibrarySelectors(); return;
  }
  grid.innerHTML = visibleRows.map(({ row, index }) => {
    const entry = entries.find(item => item.routeKey === row.routeKey); const process = entry?.process || processes.find(candidate => candidate.id === row.processId);
    const operationNo = entry?.detail.operationNo || row.operationNo || '—'; const processName = entry ? routeOperationIdentity(entry.process, entry.detail).title : process?.name || 'Manuel risk';
    const component = row.componentId === 'FINISHED_GOOD' ? { name: partName.value || 'Ana mamul', position: 'FG' } : components.find(item => item.id === row.componentId);
    const libraryRisk = pfmeaEngineeringLibrary?.riskTemplates?.find(risk => risk.id === row.libraryRiskId); const libraryRisks = pfmeaRisksForProcess(process?.id || row.processId);
    const effectSuggestions = libraryRisk?.effects || libraryRisks.flatMap(risk => risk.effects || []); const causeSuggestions = libraryRisk?.causes || libraryRisks.flatMap(risk => risk.causes || []);
    const preventionSuggestions = libraryRisk?.preventionControls || libraryRisks.flatMap(risk => risk.preventionControls || []); const detectionSuggestions = libraryRisk?.detectionControls || libraryRisks.flatMap(risk => risk.detectionControls || []);
    const actionSuggestions = libraryRisk?.recommendedActions || libraryRisks.flatMap(risk => risk.recommendedActions || []); const riskSuggestions = [...new Set([...(process?.riskTemplate || []), ...libraryRisks.map(risk => pfmeaLibraryText(risk.failureMode))])];
    const completion = pfmeaCompleteness(row); const rpn = pfmeaRpn(row); const suggestedAp = pfmeaSuggestedActionPriority(row.severity, row.occurrence, row.detection); const selectedRow = pfmeaUiState.selectedRowIds.has(row.id); const open = pfmeaUiState.expandAll || pfmeaUiState.expandedRowIds.has(row.id);
    const apTone = row.ap === 'H' ? 'high' : row.ap === 'M' ? 'medium' : row.ap === 'L' ? 'low' : 'unrated';
    const routeSelector = row.manual ? `<select data-pfmea-field="routeKey"><option value="">Operasyon seçin</option>${row.routeOrphaned ? `<option value="${escapeHtml(row.routeKey)}" selected>⚠ Eski operasyon — yeniden atayın</option>` : ''}${entries.map(candidate => `<option value="${escapeHtml(candidate.routeKey)}" ${candidate.routeKey === row.routeKey ? 'selected' : ''}>OP ${escapeHtml(candidate.detail.operationNo)} • ${escapeHtml(candidate.process.name)}</option>`).join('')}</select>` : `<div class="pfmea-context-lock">OP ${escapeHtml(operationNo)} • ${escapeHtml(processName)}</div>`;
    const componentSelector = `<select data-pfmea-field="componentId"><option value="FINISHED_GOOD" ${row.componentId === 'FINISHED_GOOD' ? 'selected' : ''}>FG • ${escapeHtml(partName.value)}</option>${components.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === row.componentId ? 'selected' : ''}>${escapeHtml(item.position)} • ${escapeHtml(item.name)}</option>`).join('')}</select>`;
    const controlSelector = `<select data-pfmea-field="controlPlanCharacteristicId"><option value="">Kontrol planı bağlantısı seçin</option>${characteristics.filter(item => item.controlPlanIncluded !== false).map(item => { const selectedControl = item.id === row.controlPlanCharacteristicId || Boolean(row.controlPlanRowId && item.controlPlanRowId === row.controlPlanRowId); return `<option value="${escapeHtml(item.id)}" ${selectedControl ? 'selected' : ''}>${escapeHtml(item.balloon)} • ${escapeHtml(item.name)} • ${escapeHtml(characteristicOwner(item).name)}</option>`; }).join('')}</select>`;
    const evidenceOptions = (pfmeaEngineeringLibrary?.evidenceTypes || []).map(item => `<option value="${escapeHtml(item.id)}" ${item.id === row.evidenceType ? 'selected' : ''}>${escapeHtml(item.nameTR)}</option>`).join('');
    const specialOptions = (pfmeaEngineeringLibrary?.specialCharacteristicTypes || []).map(item => `<option value="${escapeHtml(item.id)}" ${item.id === row.specialCharacteristic ? 'selected' : ''}>${escapeHtml(item.nameTR || item.id)}</option>`).join('');
    const roleOptions = (pfmeaEngineeringLibrary?.ownerRoles || []).map(item => `<option value="${escapeHtml(item.id)}" ${item.id === row.ownerRoleId ? 'selected' : ''}>${escapeHtml(item.nameTR)}</option>`).join('');
    const workElementTypeOptions = PFMEA_WORK_ELEMENT_TYPES.map(([value, label]) => `<option value="${value}" ${row.workElementType === value ? 'selected' : ''}>${label}</option>`).join('');
    const statusOptions = PFMEA_ACTION_STATUSES.map(value => `<option ${row.status === value || (value === 'Uygulama Bekleniyor' && row.status === 'Devam Ediyor') || (value === 'Tamamlandı' && ['Kapalı', 'Kapatıldı', 'Etkinlik Doğrulandı'].includes(row.status)) ? 'selected' : ''}>${value}</option>`).join('');
    const effectSummary = pfmeaEffectText(row);
    return `<article class="pfmea-risk-card pfmea-edit-row ap-${apTone} ${completion < 100 ? 'incomplete' : 'complete'} ${selectedRow ? 'selected' : ''}" data-pfmea-index="${index}" data-risk-id="${escapeHtml(row.id)}" style="--pfmea-progress:${completion}%">
      <header class="pfmea-card-header"><label class="pfmea-row-check"><input type="checkbox" data-pfmea-select-row="${escapeHtml(row.id)}" ${selectedRow ? 'checked' : ''}><span></span></label><span class="pfmea-op-badge">OP ${escapeHtml(operationNo)}</span><div class="pfmea-card-title"><small>${escapeHtml(processName)} • ${escapeHtml(component?.position || '—')} ${escapeHtml(component?.name || 'Bileşen seçilmedi')} • ${escapeHtml(PFMEA_WORK_ELEMENT_TYPES.find(([value]) => value === row.workElementType)?.[1] || '4M seçilmedi')}</small><h3>${escapeHtml(row.failureMode || 'Hata türü tanımlanmadı')}</h3><div><mark>${escapeHtml(row.libraryRiskId || 'MANUEL')}</mark>${row.specialCharacteristic && row.specialCharacteristic !== 'NONE' ? `<mark class="special">${escapeHtml(row.specialCharacteristic)}</mark>` : ''}${row.controlPlanCharacteristicId ? '<mark class="linked">CP bağlı</mark>' : '<mark class="unlinked">CP bağlantısı yok</mark>'}${pfmeaResultComplete(row) ? '<mark class="linked">Etkinlik doğrulandı</mark>' : ''}</div></div><div class="pfmea-completion-ring"><b>${completion}</b><span>%</span></div><div class="pfmea-ap-picker" aria-label="Action Priority"><span>AP${suggestedAp ? ` • öneri ${escapeHtml(suggestedAp)}` : ''}</span>${['H', 'M', 'L'].map(ap => `<button type="button" class="${ap.toLowerCase()} ${row.ap === ap ? 'active' : ''} ${suggestedAp === ap && row.ap !== ap ? 'suggested' : ''}" data-pfmea-row-id="${escapeHtml(row.id)}" data-pfmea-ap="${ap}">${ap}</button>`).join('')}<button type="button" class="clear ${!row.ap ? 'active' : ''}" data-pfmea-row-id="${escapeHtml(row.id)}" data-pfmea-ap="">—</button></div><select class="pfmea-status-select status-${escapeHtml(row.status || 'Açık').toLocaleLowerCase('tr-TR').replaceAll(' ', '-')}" data-pfmea-field="status">${statusOptions}</select><div class="pfmea-row-actions"><button type="button" data-duplicate-pfmea="${index}" title="Çoğalt">⧉</button><button type="button" data-move-pfmea-up="${index}" title="Yukarı">↑</button><button type="button" data-move-pfmea-down="${index}" title="Aşağı">↓</button>${row.manual ? `<button type="button" data-remove-pfmea="${index}" title="Kaldır">×</button>` : ''}</div></header>
      <div class="pfmea-card-summary"><div class="pfmea-failure-chain"><section class="effect"><span>ETKİ</span><p>${escapeHtml(effectSummary || 'Etki tanımlanmadı')}</p></section><i>←</i><section class="failure"><span>HATA TÜRÜ</span><p>${escapeHtml(row.failureMode || 'Hata türü tanımlanmadı')}</p></section><i>←</i><section class="cause"><span>NEDEN</span><p>${escapeHtml(row.cause || 'Neden tanımlanmadı')}</p></section></div><div class="pfmea-rating-cockpit">${pfmeaRatingTile(row, 'severity', 'Şiddet', 'S', 'müşteri / fonksiyon etkisi')}${pfmeaRatingTile(row, 'occurrence', 'Oluşma', 'O', 'nedenin oluşma olasılığı')}${pfmeaRatingTile(row, 'detection', 'Tespit', 'T', 'mevcut tespit yeterliliği')}<div class="pfmea-rpn-card"><span>S×O×T</span><b>${rpn || '—'}</b><small>${suggestedAp ? `Kaynak AP önerisi: ${escapeHtml(suggestedAp)}<br>` : ''}RPN yalnız göstergedir<br>AP yerine geçmez</small></div></div></div>
      <details class="pfmea-card-details" ${open ? 'open' : ''}><summary><span>Risk analizini ve aksiyon alanlarını düzenle</span><small>${completion === 100 ? 'Zorunlu alanlar tamam' : `%${completion} tamam • eksik alanları aç`}</small></summary><div class="pfmea-card-editor">
        <section class="pfmea-editor-block context"><header><span>1</span><div><b>Üç seviyeli yapı analizi</b><small>Proses parçası → proses adımı → 4M çalışma öğesi</small></div></header><div class="pfmea-editor-fields"><label>Operasyon${routeSelector}</label><label>BOM kalemi${componentSelector}</label><label>Kontrol planı${controlSelector}</label><label>Proses parçası / sistem<input data-pfmea-field="processItem" value="${escapeHtml(row.processItem || '')}" placeholder="Ürün, hat veya proses sistemi"></label><label>Proses adımı<input data-pfmea-field="processStep" value="${escapeHtml(row.processStep || '')}" placeholder="İstasyon / operasyon adı"></label><label>4M tipi<select data-pfmea-field="workElementType"><option value="">Seçin</option>${workElementTypeOptions}</select></label><label>Proses çalışma öğesi<input data-pfmea-field="workElement" value="${escapeHtml(row.workElement || '')}" placeholder="Operatör, makine, metot veya malzeme"></label><label>Özel karakteristik<select data-pfmea-field="specialCharacteristic"><option value="NONE">Yok / doğrulanmadı</option>${specialOptions}</select></label></div></section>
        <section class="pfmea-editor-block analysis"><header><span>2</span><div><b>Fonksiyon ve hata zinciri</b><small>Üç seviye fonksiyon, üç etki katmanı ve doğrulanabilir neden</small></div></header><label>Proses parçası fonksiyonu<textarea data-pfmea-field="processItemFunction" rows="2">${escapeHtml(row.processItemFunction || '')}</textarea></label><label>Proses adımı / ürün karakteristiği fonksiyonu<textarea data-pfmea-field="functionText" rows="2">${escapeHtml(row.functionText)}</textarea></label><label>Çalışma öğesi / proses karakteristiği fonksiyonu<textarea data-pfmea-field="workElementFunction" rows="2">${escapeHtml(row.workElementFunction || '')}</textarea></label><label>Hata türü<input data-pfmea-field="failureMode" value="${escapeHtml(row.failureMode)}"></label>${pfmeaSuggestionChips(row.id, 'failureMode', riskSuggestions, row.failureMode)}<div class="pfmea-effect-layers"><label>Kuruluş sahasındaki etki<textarea data-pfmea-field="effectOwnPlant" rows="2">${escapeHtml(row.effectOwnPlant || '')}</textarea></label><label>Sevk edilen sahadaki etki<textarea data-pfmea-field="effectShipToPlant" rows="2">${escapeHtml(row.effectShipToPlant || '')}</textarea></label><label>Son kullanıcı / araç etkisi<textarea data-pfmea-field="effectEndUser" rows="2">${escapeHtml(row.effectEndUser || '')}</textarea></label></div>${pfmeaSuggestionChips(row.id, 'effectEndUser', effectSuggestions, row.effectEndUser || row.effect)}<label>Hata nedeni<textarea data-pfmea-field="cause" rows="2">${escapeHtml(row.cause)}</textarea></label>${pfmeaSuggestionChips(row.id, 'cause', causeSuggestions, row.cause)}</section>
        <section class="pfmea-editor-block controls"><header><span>3</span><div><b>Mevcut kontroller ve puan dayanağı</b><small>Önleme ile tespit ayrıdır; her puan nesnel veriye dayanır</small></div></header><label>Mevcut önleme kontrolü<textarea data-pfmea-field="preventionControl" rows="2">${escapeHtml(row.preventionControl)}</textarea></label>${pfmeaSuggestionChips(row.id, 'preventionControl', preventionSuggestions, row.preventionControl)}<label>Mevcut tespit kontrolü<textarea data-pfmea-field="detectionControl" rows="2">${escapeHtml(row.detectionControl)}</textarea></label>${pfmeaSuggestionChips(row.id, 'detectionControl', detectionSuggestions, row.detectionControl)}<label>Şiddet gerekçesi<input data-pfmea-field="severityRationale" value="${escapeHtml(row.severityRationale || '')}" placeholder="Etki seviyesi / müşteri / yasal şart"></label><label>Oluşma gerekçesi<input data-pfmea-field="occurrenceRationale" value="${escapeHtml(row.occurrenceRationale || '')}" placeholder="PPM, hurda, Cpk, benzer proses verisi"></label><label>Tespit gerekçesi<input data-pfmea-field="detectionRationale" value="${escapeHtml(row.detectionRationale || '')}" placeholder="Kontrol yeri, sıklık, MSA, kaçış riski"></label><label>Toplu S/O/D/AP gerekçesi<textarea data-pfmea-field="ratingsRationale" rows="2">${escapeHtml(row.ratingsRationale || '')}</textarea></label><label>Kontrollü puanlama tablosu ref.<input data-pfmea-field="ratingTableRef" value="${escapeHtml(row.ratingTableRef || '')}" placeholder="Doküman no / revizyon"></label></section>
        <section class="pfmea-editor-block action"><header><span>4</span><div><b>Optimizasyon ve nesnel kanıt</b><small>Önleme ve tespit aksiyonu ayrı; sorumlu, termin ve fiili tarih kontrollü</small></div></header><label>Önlemeye yönelik aksiyon<textarea data-pfmea-field="preventionAction" rows="2">${escapeHtml(row.preventionAction || row.recommendedAction || '')}</textarea></label>${pfmeaSuggestionChips(row.id, 'preventionAction', actionSuggestions, row.preventionAction || row.recommendedAction)}<label>Tespit etmeye yönelik aksiyon<textarea data-pfmea-field="detectionAction" rows="2">${escapeHtml(row.detectionAction || '')}</textarea></label>${pfmeaSuggestionChips(row.id, 'detectionAction', actionSuggestions, row.detectionAction)}<div class="pfmea-action-grid"><label>Rol<select data-pfmea-field="ownerRoleId"><option value="">Rol seçin</option>${roleOptions}</select></label><label>Sorumlu<input data-pfmea-field="owner" value="${escapeHtml(row.owner || '')}" placeholder="Ad / ekip"></label><label>Hedef tarih<input data-pfmea-field="dueDate" type="date" value="${escapeHtml(row.dueDate || '')}"></label><label>Fiili tamamlanma<input data-pfmea-field="actionCompletionDate" type="date" value="${escapeHtml(row.actionCompletionDate || '')}"></label><label>Kanıt türü<select data-pfmea-field="evidenceType"><option value="">Kanıt türü seçin</option>${evidenceOptions}</select></label><label>Filtre kodu<input data-pfmea-field="filterCode" value="${escapeHtml(row.filterCode || '')}" placeholder="Opsiyonel"></label></div><label>Kanıtları ile alınan aksiyonlar<textarea data-pfmea-field="actionEvidence" rows="2">${escapeHtml(row.actionEvidence || row.evidence || '')}</textarea></label><label>Reaksiyon planı<textarea data-pfmea-field="reactionPlan" rows="2">${escapeHtml(row.reactionPlan || '')}</textarea></label></section>
        <section class="pfmea-editor-block result"><header><span>5</span><div><b>Aksiyon sonrası risk ve etkinlik doğrulaması</b><small>Durum ancak fiili tarih, kanıt ve yeniden değerlendirme tamamlandığında kapatılır</small></div></header><div class="pfmea-result-inputs"><label>Yeni S<div class="pfmea-result-rating-field"><select data-pfmea-field="resultSeverity">${pfmeaNumberOptions(row.resultSeverity)}</select><button type="button" data-open-pfmea-rating="resultSeverity">Kriter</button></div></label><label>Yeni O<div class="pfmea-result-rating-field"><select data-pfmea-field="resultOccurrence">${pfmeaNumberOptions(row.resultOccurrence)}</select><button type="button" data-open-pfmea-rating="resultOccurrence">Kriter</button></div></label><label>Yeni D<div class="pfmea-result-rating-field"><select data-pfmea-field="resultDetection">${pfmeaNumberOptions(row.resultDetection)}</select><button type="button" data-open-pfmea-rating="resultDetection">Kriter</button></div></label><label>Yeni AP<select data-pfmea-field="resultAp"><option value="">Ekip seçimi</option><option value="H" ${row.resultAp === 'H' ? 'selected' : ''}>H / Yüksek</option><option value="M" ${row.resultAp === 'M' ? 'selected' : ''}>M / Orta</option><option value="L" ${row.resultAp === 'L' ? 'selected' : ''}>L / Düşük</option></select></label><label class="wide">Yeniden değerlendirme ve etkinlik gerekçesi<textarea data-pfmea-field="resultRationale" rows="2">${escapeHtml(row.resultRationale || '')}</textarea></label><label class="wide">Uygulanmadı / kalan risk kabul ref.<input data-pfmea-field="riskAcceptanceRef" value="${escapeHtml(row.riskAcceptanceRef || '')}" placeholder="Yetkili yönetim kararı / tutanak / teknik gerekçe"></label><label class="wide">Notlar<input data-pfmea-field="notes" value="${escapeHtml(row.notes || '')}"></label></div></section>
      </div></details></article>`;
  }).join('');
  grid.querySelectorAll('[data-pfmea-field]').forEach(field => {
    const update = event => {
      const card = event.target.closest('[data-pfmea-index]'); const row = pfmeaRows[Number(card?.dataset.pfmeaIndex)]; if (!row) return;
      const key = event.target.dataset.pfmeaField; row[key] = event.target.value;
      if (key === 'routeKey') { const selectedEntry = selectedProcessEntries().find(item => item.routeKey === event.target.value); if (selectedEntry) { row.processId = selectedEntry.process.id; row.operationNo = selectedEntry.detail.operationNo; row.processStep = selectedEntry.detail.operationLabelTR || selectedEntry.process.name; row.routeOrphaned = false; if (!row.componentId || row.componentId === 'FINISHED_GOOD') row.componentId = likelyComponentForRoute(row.routeKey); } }
      if (key === 'componentId') { const linked = linkedControlCharacteristic(row.routeKey, row.componentId); row.controlPlanCharacteristicId = linked?.id || ''; row.controlPlanRowId = linked?.controlPlanRowId || linked?.id || ''; row.processItem = row.componentId === 'FINISHED_GOOD' ? (partName.value || 'Ana mamul') : (components.find(item => item.id === row.componentId)?.name || row.processItem); }
      if (key === 'controlPlanCharacteristicId') { const linked = characteristics.find(item => item.id === event.target.value); row.controlPlanRowId = linked?.controlPlanRowId || linked?.id || ''; if (linked?.classification && linked.classification !== 'Normal' && row.specialCharacteristic === 'NONE') row.specialCharacteristic = linked.classification; }
      if (key === 'ownerRoleId' && !row.owner) row.owner = pfmeaOwnerName(event.target.value);
      if (['effectOwnPlant', 'effectShipToPlant', 'effectEndUser'].includes(key)) row.effect = pfmeaEffectText(row);
      if (['preventionAction', 'detectionAction'].includes(key)) row.recommendedAction = pfmeaActionText(row);
      if (key === 'actionEvidence') row.evidence = event.target.value;
      updatePfmeaSummary(); markDraftDirty();
    };
    if (field.matches('select')) field.addEventListener('change', event => { update(event); renderPfmea(); }); else field.addEventListener('input', update);
  });
  grid.querySelectorAll('.pfmea-card-details').forEach(details => details.addEventListener('toggle', () => { const rowId = details.closest('[data-risk-id]')?.dataset.riskId; if (!rowId) return; if (details.open) pfmeaUiState.expandedRowIds.add(rowId); else pfmeaUiState.expandedRowIds.delete(rowId); }));
  grid.querySelectorAll('[data-open-pfmea-rating]').forEach(button => button.addEventListener('click', () => openPfmeaRatingGuide(button.closest('[data-risk-id]')?.dataset.riskId, button.dataset.openPfmeaRating)));
  grid.querySelectorAll('[data-remove-pfmea]').forEach(button => button.addEventListener('click', () => { const removed = pfmeaRows[Number(button.dataset.removePfmea)]; pfmeaRows.splice(Number(button.dataset.removePfmea), 1); if (removed) { pfmeaUiState.selectedRowIds.delete(removed.id); pfmeaUiState.expandedRowIds.delete(removed.id); } renderPfmea(); markDraftDirty(); }));
  grid.querySelectorAll('[data-duplicate-pfmea]').forEach(button => button.addEventListener('click', () => { const index = Number(button.dataset.duplicatePfmea); const copy = { ...pfmeaRows[index], id: `FMEA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, sourceKey: `${pfmeaRows[index].sourceKey}::${crypto.randomUUID()}`, manual: true }; pfmeaRows.splice(index + 1, 0, copy); pfmeaUiState.expandedRowIds.add(copy.id); renderPfmea(); markDraftDirty(); }));
  const move = (index, direction) => { const target = index + direction; if (target < 0 || target >= pfmeaRows.length) return; [pfmeaRows[index], pfmeaRows[target]] = [pfmeaRows[target], pfmeaRows[index]]; renderPfmea(); markDraftDirty(); };
  grid.querySelectorAll('[data-move-pfmea-up]').forEach(button => button.addEventListener('click', () => move(Number(button.dataset.movePfmeaUp), -1)));
  grid.querySelectorAll('[data-move-pfmea-down]').forEach(button => button.addEventListener('click', () => move(Number(button.dataset.movePfmeaDown), 1)));
  updatePfmeaSummary(); updatePfmeaBulkBar(); renderPfmeaLibrarySelectors();
}

function updatePfmeaSummary() {
  const assessed = pfmeaRows.filter(row => row.severity && row.occurrence && row.detection && row.ap).length;
  const highOpen = pfmeaRows.filter(row => row.ap === 'H' && !pfmeaStatusClosed(row)).length;
  const medium = pfmeaRows.filter(row => row.ap === 'M').length; const low = pfmeaRows.filter(row => row.ap === 'L').length;
  const metricValues = { total: pfmeaRows.length, high: highOpen, medium, low };
  Object.entries(metricValues).forEach(([key, value]) => { const node = document.querySelector(`[data-pfmea-metric="${key}"]`); if (node) node.textContent = value; });
  const completion = pfmeaRows.length ? Math.round((assessed / pfmeaRows.length) * 100) : 0;
  const progress = document.querySelector('#pfmea .risk-progress'); if (progress) { progress.querySelector('strong').textContent = `${completion}%`; progress.querySelector('i b').style.width = `${completion}%`; }
  const status = document.querySelector('#pfmea .page-status'); if (status) { status.textContent = !pfmeaRows.length ? '● Risk analizi bekliyor' : pfmeaRows.length > assessed ? `● ${pfmeaRows.length - assessed} AP değerlendirmesi açık` : highOpen ? `● ${highOpen} yüksek öncelik açık` : '✓ AP değerlendirmesi tamam'; status.classList.toggle('saved', Boolean(pfmeaRows.length && pfmeaRows.length === assessed && !highOpen)); status.classList.toggle('warning', !pfmeaRows.length || pfmeaRows.length > assessed || Boolean(highOpen)); }
}

const addPfmeaButton = document.querySelector('[data-action="add-pfmea-manual"]');
if (addPfmeaButton) addPfmeaButton.addEventListener('click', () => { const routeKey = pfmeaUiState.routeKey || selected[0] || ''; const entry = selectedProcessEntries().find(item => item.routeKey === routeKey); const row = newPfmeaRow({ routeKey, processId: entry?.process.id || '', operationNo: entry?.detail.operationNo || '' }); pfmeaRows.push(row); pfmeaUiState.expandedRowIds.add(row.id); renderPfmea(); markDraftDirty(); });

document.getElementById('pfmeaRatingGuideList')?.addEventListener('click', event => {
  const button = event.target.closest('[data-pfmea-rating-score]'); if (!button) return;
  pfmeaRatingGuideState.selectedScore = Number(button.dataset.pfmeaRatingScore) || 0;
  const row = pfmeaRows.find(item => item.id === pfmeaRatingGuideState.rowId);
  const meta = pfmeaRatingMeta(pfmeaRatingGuideState.field);
  const guide = pfmeaEngineeringLibrary?.ratingGuides?.[meta?.guide]?.find(item => Number(item.score) === pfmeaRatingGuideState.selectedScore);
  const rationale = document.getElementById('pfmeaRatingGuideRationale');
  if (rationale && row && meta && !rationale.value.trim()) rationale.value = `${guide?.labelTR || meta.title}: ${guide?.evidencePromptTR || meta.question}`;
  renderPfmeaRatingGuideDialog();
});
document.getElementById('pfmeaRatingGuideApply')?.addEventListener('click', applyPfmeaRatingGuideSelection);

document.querySelectorAll('[data-action="complete-pfmea"]').forEach(btn => btn.addEventListener('click', () => {
  const issues = pfmeaReleaseIssues();
  if (issues.length) {
    toast('PFMEA kalite kapısı bloke', `${issues[0]}${issues.length > 1 ? ` • +${issues.length - 1} bulgu` : ''}. AP, kuruluşça kontrollü/lisanslı değerlendirme tablosuna göre ekip tarafından seçilmelidir.`);
    return;
  }
  toast('PFMEA kalite kapısı tamamlandı', `${pfmeaRows.length} risk satırı üç seviyeli proses yapısı, 4M, kontrol planı ve etkinlik kanıtıyla doğrulandı.`);
  setTimeout(() => showView('control'), 650);
}));

function controlContext(characteristic) {
  const entries = selectedProcessEntries();
  const entry = entries.find(item => characteristic.routeKey && item.routeKey === characteristic.routeKey) || entries.find(item => item.process.id === characteristic.processId);
  const process = entry?.process || processes.find(item => item.id === characteristic.processId) || { name: 'Proses eşleşmesi gerekli', equipment: '', controlMethod: '', reactionPlan: '' };
  return {
    op: entry ? entry.detail.operationNo : '—', process, detail: entry?.detail || null, identity: routeOperationIdentity(process, entry?.detail || {}),
    reaction: process.reactionPlan || 'Prosesi durdur; son iyi parçadan itibaren şüpheli ürünü bloke et; kaliteyi bilgilendir; %100 doğrulama ve yetkili yeniden başlatma onayı uygula.'
  };
}

function characteristicOwner(item) {
  if (item.componentId === 'FINISHED_GOOD') return { id: 'FINISHED_GOOD', position: 'FG', name: partName.value || 'Ana mamul', itemNo: internalProductCode.value || '—', oemNo: partNumber.value || '' };
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
  ensureEngineeringUniverseFromLegacy();
  const issues = [];
  const structure = document.getElementById('productStructureType').value;
  const structureLabel = ({ assembly: 'Komple mamul', subassembly: 'Yarı mamul / alt montaj', service_kit: 'Servis kiti' })[structure] || 'Mamul';
  if (['assembly', 'subassembly', 'service_kit'].includes(structure) && !components.length) issues.push(`${structureLabel} için BOM kalemi yok`);
  const duplicateItems = components.filter((item, index) => item.itemNo && components.findIndex(other => String(other.itemNo).trim().toLocaleLowerCase('tr-TR') === String(item.itemNo).trim().toLocaleLowerCase('tr-TR')) !== index);
  if (duplicateItems.length) issues.push(`${new Set(duplicateItems.map(item => item.itemNo)).size} yinelenen stok/parça kodu`);
  const route = selectedProcessEntries().map(({ routeKey, process, detail }) => ({ routeKey, processId: process.id, name: process.name, operationNo: detail.operationNo, inputComponentIds: detail.inputComponentIds, outputItemId: detail.outputItemId }));
  const domainIssues = globalThis.TyanaBom.validate(components, { route, characteristics, pfmea: pfmeaRows, strict: true });
  const grouped = new Map(); domainIssues.forEach(issue => grouped.set(issue.code, (grouped.get(issue.code) || 0) + 1));
  grouped.forEach((count, code) => { const example = domainIssues.find(issue => issue.code === code); issues.push(`${count} BOM bulgusu [${code}]: ${example.message}`); });
  const canonical = globalThis.TyanaBom.validateEngineeringUniverse(engineeringUniverse, { requireApproved: true, strictRevision: true, operationCodes: operationCodeEntries() });
  const canonicalIssues = [...canonical.errors, ...canonical.warnings]; const canonicalGrouped = new Map(); canonicalIssues.forEach(issue => canonicalGrouped.set(issue.code, (canonicalGrouped.get(issue.code) || 0) + 1));
  canonicalGrouped.forEach((count, code) => { const example = canonicalIssues.find(issue => issue.code === code); issues.push(`${count} ana veri/BOM bulgusu [${code}]: ${example.message}`); });
  const childlessAssemblies = components.filter(item => item.componentType === 'Alt montaj' && !components.some(child => child.parentId === item.id)); if (childlessAssemblies.length) issues.push(`${childlessAssemblies.length} alt montajın alt bileşeni yok`);
  const unresolved = components.filter(item => ['name', 'itemNo', 'drawingNo', 'revision', 'materialGrade', 'materialStandard', 'traceability', 'inputState', 'primaryManufacturingMethod', 'outputState'].some(field => unresolvedPlaceholder(item[field]))); if (unresolved.length) issues.push(`${unresolved.length} BOM kaleminde teknik alan/üretim durumu açık`);
  const unverified = components.filter(item => !['Doğrulandı', 'Teknik resimle doğrulandı', 'Müşteri şartıyla doğrulandı'].includes(item.verificationStatus)); if (unverified.length) issues.push(`${unverified.length} BOM kalemi teknik kaynakla doğrulanmadı`);
  return issues;
}

function routeReleaseIssues() {
  const issues = []; const entries = selectedProcessEntries();
  if (!entries.length) issues.push('Proses rotası boş');
  const operationNos = entries.map(entry => String(entry.detail.operationNo || '').trim());
  if (operationNos.some(value => !value)) issues.push('Operasyon numarası boş');
  if (new Set(operationNos).size !== operationNos.length) issues.push('Operasyon numaraları benzersiz değil');
  const missingOperationCodes = entries.filter(({ detail }) => !String(detail.operationCode || '').trim()); if (missingOperationCodes.length) issues.push(`${missingOperationCodes.length} rota adımında 380 kodluk operasyon sözlüğü bağlantısı yok`);
  const unknownOperationCodes = entries.filter(({ detail }) => detail.operationCode && !operationCodeRecord(detail.operationCode)); if (unknownOperationCodes.length) issues.push(`${unknownOperationCodes.length} rota adımında katalog dışı operasyon kodu var`);
  const activeBomOperationRows = activeEngineeringBomRows().filter(row => String(row.assemblyOperationCode || '').trim());
  const missingBomOperationCodes = [...new Set(activeBomOperationRows.map(row => String(row.assemblyOperationCode)).filter(code => !entries.some(entry => String(entry.detail.operationCode || '') === code)))];
  if (missingBomOperationCodes.length) issues.push(`${missingBomOperationCodes.length} aktif BOM montaj operasyon kodu rotada yok: ${missingBomOperationCodes.join(', ')}`);
  const unlinkedBomOperationRows = activeBomOperationRows.filter(row => !entries.some(entry => String(entry.detail.operationCode || '') === String(row.assemblyOperationCode) && entry.detail.inputComponentIds.includes(row.occurrenceId)));
  if (unlinkedBomOperationRows.length) issues.push(`${unlinkedBomOperationRows.length} aktif BOM kullanımı kendi montaj operasyonuna rota girdisi olarak bağlı değil`);
  const operationCodeReviews = entries.filter(({ detail }) => operationCodeRecord(detail.operationCode)?.requiresReview && !(sourceValidationApproved(detail) && !unresolvedPlaceholder(detail.sourceValidationNote))); if (operationCodeReviews.length) issues.push(`${operationCodeReviews.length} operasyon kodunda anlam/çeviri mühendislik incelemesi açık`);
  const invalidDetails = entries.filter(({ detail }) => ['workcenter', 'machineId', 'tooling', 'responsible'].some(field => unresolvedPlaceholder(detail[field]))); if (invalidDetails.length) issues.push(`${invalidDetails.length} operasyonda iş merkezi/makine/takım/sorumlu açık`);
  const invalidLinks = entries.filter(({ detail }) => detail.inputComponentIds.some(id => !components.some(item => item.id === id)) || (detail.outputItemId !== 'FINISHED_GOOD' && !components.some(item => item.id === detail.outputItemId))); if (invalidLinks.length) issues.push(`${invalidLinks.length} operasyonda geçersiz BOM girdi/çıktı bağlantısı`);
  const assemblyWithoutInputs = entries.filter(({ process, detail }) => ['assembly', 'integrated-assembly', 'press-assembly', 'post-paint-assembly'].includes(process.id) && components.length && !detail.inputComponentIds.length); if (assemblyWithoutInputs.length) issues.push(`${assemblyWithoutInputs.length} montaj operasyonunda tüketilen BOM kalemi seçilmedi`);
  const outsourcedWithoutReference = entries.filter(({ process, detail }) => process.outsource && (detail.externalControlRef === 'Uygulanmıyor' || unresolvedPlaceholder(detail.externalControlRef))); if (outsourcedWithoutReference.length) issues.push(`${outsourcedWithoutReference.length} dış kaynak proseste kontrol sistemi referansı yok`);
  const unapproved = entries.filter(({ process }) => process.approvalStatus && process.approvalStatus !== 'approved'); if (unapproved.length) issues.push(`${unapproved.length} rota prosesi onaylı kütüphane revizyonunda değil`);
  entries.forEach(({ detail }) => {
    const codes = sourceWarningCodesForRoute(detail); const blockingCodes = codes.filter(code => blockingValidationRule(validationRuleForCode(code)));
    const sourceDecisionReady = sourceValidationApproved(detail) && !unresolvedPlaceholder(detail.sourceValidationNote);
    if (!sourceDecisionReady) blockingCodes.forEach(code => issues.push(`[${code}] ${recordLabel(validationRuleForCode(code), 'Kaynak proses riski mühendislik kararı bekliyor')}`));
    const preset = sourceInstructionPresets().find(item => recordId(item) === detail.presetId) || instructionPresetForCode(detail.operationCode);
    if (preset && !structuredInstructionSteps(preset).length && !sourceDecisionReady) issues.push(`[GENERATED_INSTRUCTION_DRAFT] OP ${detail.operationNo} iş adımları kaynak TTI içeriği değildir; sistem taslağı mühendislik onayı ve kanıt notu bekliyor`);
  });
  return issues;
}

function characteristicReleaseIssues() {
  const issues = []; const routeKeys = new Set(selected);
  if (!characteristics.length) return ['Numaralı karakteristik yok'];
  const invalidRoute = characteristics.filter(item => !item.routeKey || !routeKeys.has(item.routeKey)); if (invalidRoute.length) issues.push(`${invalidRoute.length} karakteristik operasyon örneğine bağlı değil`);
  const invalidSource = characteristics.filter(item => unresolvedPlaceholder(item.sourceDrawing) || unresolvedPlaceholder(item.sourceZone) || unresolvedPlaceholder(item.sourceStatus)); if (invalidSource.length) issues.push(`${invalidSource.length} karakteristikte teknik kaynak doğrulaması açık`);
  const invalidNumeric = characteristics.filter(item => item.specMode === 'numeric' && (!Number.isFinite(item.nominal) || !Number.isFinite(item.minus) || !Number.isFinite(item.plus) || item.minus < 0 || item.plus < 0 || item.minus + item.plus <= 0)); if (invalidNumeric.length) issues.push(`${invalidNumeric.length} sayısal karakteristiğin limit/toleransı geçersiz`);
  const invalidEquipment = characteristics.filter(item => ['method', 'equipmentClass', 'equipment', 'resolution', 'sampleSize', 'frequency', 'trigger', 'reference', 'reaction'].some(field => unresolvedPlaceholder(item[field]))); if (invalidEquipment.length) issues.push(`${invalidEquipment.length} kontrolde metot/cihaz/sıklık/kayıt/reaksiyon alanı açık`);
  const sourceDrafts = characteristics.filter(item => item.sourceDocumentId && !sourceValidationApproved(item)); if (sourceDrafts.length) issues.push(`${sourceDrafts.length} kaynak karakteristik teknik resim/mühendislik kararı bekliyor`);
  const blockingCodes = new Set(); characteristics.filter(item => !sourceValidationApproved(item)).forEach(item => (item.sourceWarningCodes || []).forEach(code => { if (blockingValidationRule(validationRuleForCode(code))) blockingCodes.add(code); }));
  blockingCodes.forEach(code => issues.push(`[${code}] ${recordLabel(validationRuleForCode(code), 'Kaynak karakteristik doğrulaması tamamlanmalı')}`));
  const samplingConflicts = characteristics.filter(item => item.sourceSamplingConflictPolicy === 'block-until-resolved' && !sourceValidationApproved(item)); if (samplingConflicts.length && !blockingCodes.has('SAMPLING_CONTRADICTION')) issues.push(`[SAMPLING_CONTRADICTION] ${samplingConflicts.length} karakteristiğin event/periyodik numune planı ayrı onaylanmalı`);
  const msaOpen = characteristics.filter(item => item.msaStatus !== 'Uygun' && !(item.msaStatus === 'Uygulanamaz — gerekçeli' && String(item.msaRationale || '').trim())); if (msaOpen.length) issues.push(`${msaOpen.length} kontrol için MSA/cihaz uygunluğu kapanmadı`);
  const calibrationOpen = characteristics.filter(item => item.msaStatus !== 'Uygulanamaz — gerekçeli' && (!item.calibrationDue || item.calibrationDue < new Date().toISOString().slice(0, 10))); if (calibrationOpen.length) issues.push(`${calibrationOpen.length} ölçüm cihazının kalibrasyon vadesi yok veya geçmiş`);
  return issues;
}

function pfmeaReleaseIssues() {
  const issues = [];
  if (!pfmeaRows.length) return ['PFMEA risk satırı yok'];
  const unassessed = pfmeaRows.filter(row => !row.severity || !row.occurrence || !row.detection || !row.ap); if (unassessed.length) issues.push(`${unassessed.length} PFMEA satırında S/O/D/AP değerlendirmesi eksik`);
  const highOpen = pfmeaRows.filter(row => row.ap === 'H' && !pfmeaStatusClosed(row)); if (highOpen.length) issues.push(`${highOpen.length} yüksek PFMEA Action Priority açık`);
  const invalidStructure = pfmeaRows.filter(row => ['processItem', 'processStep', 'workElementType', 'workElement'].some(field => unresolvedPlaceholder(row[field]))); if (invalidStructure.length) issues.push(`${invalidStructure.length} PFMEA satırında proses parçası/adımı/4M çalışma öğesi yapısı eksik`);
  const invalidFunctions = pfmeaRows.filter(row => ['processItemFunction', 'functionText', 'workElementFunction'].some(field => unresolvedPlaceholder(row[field]))); if (invalidFunctions.length) issues.push(`${invalidFunctions.length} PFMEA satırında üç seviyeli fonksiyon analizi eksik`);
  const incompleteEffects = pfmeaRows.filter(row => ['effectOwnPlant', 'effectShipToPlant', 'effectEndUser'].some(field => unresolvedPlaceholder(row[field]))); if (incompleteEffects.length) issues.push(`${incompleteEffects.length} PFMEA satırında kuruluş/sevk edilen saha/son kullanıcı etki katmanı eksik veya U/A gerekçesi yok`);
  const incompleteAnalysis = pfmeaRows.filter(row => ['failureMode', 'cause', 'preventionControl', 'detectionControl', 'reactionPlan'].some(field => unresolvedPlaceholder(row[field]))); if (incompleteAnalysis.length) issues.push(`${incompleteAnalysis.length} PFMEA satırında hata/kontrol/reaksiyon analizi eksik`);
  const ratingBasisMissing = pfmeaRows.filter(row => unresolvedPlaceholder(row.ratingsRationale) || unresolvedPlaceholder(row.ratingTableRef)); if (ratingBasisMissing.length) issues.push(`${ratingBasisMissing.length} PFMEA satırında puan gerekçesi veya kontrollü S-O-D/AP tablo referansı eksik`);
  const actionRequired = pfmeaRows.filter(row => ['H', 'M'].includes(row.ap));
  const actionMissing = actionRequired.filter(row => !pfmeaValueReady(row.preventionAction || row.recommendedAction) && !pfmeaValueReady(row.detectionAction) && !(pfmeaValueReady(row.notes) && pfmeaValueReady(row.riskAcceptanceRef))); if (actionMissing.length) issues.push(`${actionMissing.length} yüksek/orta AP satırında önleme/tespit aksiyonu veya gerekçeli risk kabulü yok`);
  const actionOwnershipMissing = actionRequired.filter(row => !pfmeaValueReady(row.owner) || !row.dueDate); if (actionOwnershipMissing.length) issues.push(`${actionOwnershipMissing.length} yüksek/orta AP satırında sorumlu veya hedef tarih eksik`);
  const closedWithoutEffectiveness = pfmeaRows.filter(row => pfmeaStatusClosed(row) && !pfmeaResultComplete(row)); if (closedWithoutEffectiveness.length) issues.push(`${closedWithoutEffectiveness.length} tamamlandı/uygulanmadı PFMEA satırında fiili tarih, etkinlik kanıtı, yeniden S-O-D/AP veya risk kabul kaydı eksik`);
  const invalidStatus = pfmeaRows.filter(row => !PFMEA_ACTION_STATUSES.includes(row.status) && !['Kapalı', 'Kapatıldı', 'Etkinlik Doğrulandı', 'Devam Ediyor'].includes(row.status)); if (invalidStatus.length) issues.push(`${invalidStatus.length} PFMEA satırında kontrolsüz aksiyon durumu var`);
  const invalidComponent = pfmeaRows.filter(row => row.componentId !== 'FINISHED_GOOD' && !components.some(component => component.id === row.componentId)); if (invalidComponent.length) issues.push(`${invalidComponent.length} PFMEA satırında geçersiz BOM bağlantısı var`);
  const orphanedRoute = pfmeaRows.filter(row => row.routeOrphaned || (row.routeKey && !selected.includes(row.routeKey))); if (orphanedRoute.length) issues.push(`${orphanedRoute.length} PFMEA satırı kaldırılmış operasyona bağlı`);
  const missingControl = pfmeaRows.filter(row => !row.controlPlanCharacteristicId || !characteristics.some(item => item.controlPlanIncluded !== false && (item.id === row.controlPlanCharacteristicId || item.controlPlanRowId === row.controlPlanRowId))); if (missingControl.length) issues.push(`${missingControl.length} PFMEA riskinin kontrol planı karşılığı yok`);
  const specialUnlinked = pfmeaRows.filter(row => row.specialCharacteristic && row.specialCharacteristic !== 'NONE' && !row.controlPlanCharacteristicId); if (specialUnlinked.length) issues.push(`${specialUnlinked.length} özel karakteristik PFMEA satırı kontrol planı/karakteristik kimliğine bağlı değil`);
  return issues;
}

function fmeaGovernanceReleaseIssues(kind) {
  const readiness = globalThis.TyanaFmea?.readiness?.(kind);
  if (!readiness) return [`${kind.toUpperCase()} 7-adım denetim omurgası yüklenmedi`];
  const issues = [];
  if (readiness.profileIssues?.length) issues.push(`${kind.toUpperCase()} profilinde ${readiness.profileIssues.length} kapsam/ekip/kaynak alanı açık`);
  if (readiness.findings?.length) issues.push(`${kind.toUpperCase()} 7-adım kontrolünde ${readiness.findings.length} zorunlu kanıt açık`);
  return issues;
}

function dfmeaReleaseIssues() {
  const fmea = globalThis.TyanaFmea?.snapshot?.();
  if (!fmea) return ['DFMEA kayıt omurgası yüklenmedi'];
  const profile = fmea.profiles?.dfmea || {};
  const issues = [...fmeaGovernanceReleaseIssues('dfmea')];
  if (profile.applicability === 'not-applicable') {
    if (!String(profile.applicabilityRationale || '').trim()) issues.push('DFMEA U/A kararı için tasarım sorumluluğu ve tedarikçi/müşteri kanıtı yok');
    return issues;
  }
  const rows = Array.isArray(fmea.dfmeaRows) ? fmea.dfmeaRows : [];
  const meaningfulRows = rows.filter(row => ['function', 'requirement', 'failureEffect', 'failureMode', 'failureCause'].some(field => String(row[field] || '').trim()));
  if (!meaningfulRows.length) {
    issues.push('DFMEA analiz satırı yok');
    return issues;
  }
  const incomplete = meaningfulRows.filter(row => ['upperLevel', 'focusElement', 'lowerLevel', 'function', 'requirement', 'failureEffect', 'failureMode', 'failureCause', 'preventionControl', 'detectionControl'].some(field => unresolvedPlaceholder(row[field])));
  if (incomplete.length) issues.push(`${incomplete.length} DFMEA satırında yapı/fonksiyon/hata/kontrol zinciri eksik`);
  const unrated = meaningfulRows.filter(row => !row.ap || !String(row.riskRationale || '').trim());
  if (unrated.length) issues.push(`${unrated.length} DFMEA satırında AP veya S/O/D/AP gerekçesi eksik`);
  const specialUnlinked = meaningfulRows.filter(row => row.specialClass && row.specialClass !== 'NONE' && (!String(row.characteristicId || '').trim() || !String(row.dvprRef || '').trim()));
  if (specialUnlinked.length) issues.push(`${specialUnlinked.length} özel DFMEA karakteristiğinde karakteristik ID veya DVP&R bağlantısı eksik`);
  const actionRequired = meaningfulRows.filter(row => ['H', 'M'].includes(row.ap));
  const actionOpen = actionRequired.filter(row => !String(row.preventionAction || row.detectionAction || row.action || '').trim() || !String(row.owner || '').trim() || !row.dueDate);
  if (actionOpen.length) issues.push(`${actionOpen.length} yüksek/orta DFMEA AP satırında aksiyon, sorumlu veya termin eksik`);
  const closed = meaningfulRows.filter(row => ['Etkinlik Doğrulandı', 'Kapatıldı', 'Tamamlandı', 'Uygulanmadı'].includes(row.status));
  const closedWithoutEvidence = closed.filter(row => !row.actionCompletionDate || !String(row.actionEvidence || '').trim() || !row.resultSeverity || !row.resultOccurrence || !row.resultDetection || !row.resultAp || !String(row.resultRationale || '').trim());
  if (closedWithoutEvidence.length) issues.push(`${closedWithoutEvidence.length} kapalı DFMEA satırında etkinlik kanıtı veya aksiyon sonrası risk değerlendirmesi eksik`);
  return issues;
}

function instructionTraceabilityIssues() {
  const issues = [];
  if (!selected.length) return ['Operatör talimatına kaynak olacak iş planı yok'];
  if (!instructionModels.length) return ['Operatör talimat seti henüz oluşturulmadı'];
  const missingModels = selectedProcessEntries().filter(entry => !instructionModels.some(model => model.routeKey === entry.routeKey || (model.operationNo === entry.detail.operationNo && model.processId === entry.process.id)));
  if (missingModels.length) issues.push(`${missingModels.length} iş planı adımı için operatör talimatı yok`);
  const invalid = instructionModels.filter(model => model.validationFlags?.length || !String(model.safety || '').trim() || !String(model.stepsText || '').trim() || !String(model.reaction || '').trim());
  if (invalid.length) issues.push(`${invalid.length} talimatta İSG, iş adımı, sayısal şart veya reaksiyon doğrulaması açık`);
  const controlUnlinked = instructionModels.filter(model => !Array.isArray(model.linked) || !model.linked.length);
  if (controlUnlinked.length) issues.push(`${controlUnlinked.length} talimatta Kontrol Planı karakteristik bağlantısı yok`);
  return issues;
}

function documentationAuditCategories() {
  const identityIssues = [];
  if (!partNumber.value.trim() || !internalProductCode.value.trim() || !partName.value.trim() || !projectCode.value.trim() || !controlPlanNumber.value.trim()) identityIssues.push('OEM No, iç stok kodu, mamul adı, proje veya doküman numarası eksik');
  if (productGroup.value === '__custom__' && !document.getElementById('customProductGroupName').value.trim()) identityIssues.push('Kullanıcı tanımlı ürün grubu adı boş');
  const drawingIssues = /^[a-f0-9]{64}$/i.test(String(drawingSource.sha256 || '')) && drawingSource.name && drawingNumber.value.trim() && drawingRevision.value.trim()
    ? []
    : ['Teknik resim dosyası, numarası, revizyonu veya SHA-256 kaynağı doğrulanmadı'];
  const ppapState = ppapReadinessState();
  const ppapIssues = ppapState.readiness === 100 ? [] : [`PPAP Seviye ${ppapState.level}: ${ppapState.ready}/${ppapState.required} unsur hazır; ${ppapState.blocked} bloke`];
  return [
    { id: 'QG-01', title: 'Ürün ve doküman kimliği', evidence: `${partNumber.value || 'OEM?'} / ${internalProductCode.value || 'STOK?'} / Rev. ${drawingRevision.value || '?'}`, issues: identityIssues },
    { id: 'QG-02', title: 'Teknik resim ve revizyon kaynağı', evidence: drawingSource.sha256 ? `SHA-256 ${String(drawingSource.sha256).slice(0, 16)}…` : 'Kaynak bekleniyor', issues: drawingIssues },
    { id: 'QG-03', title: 'Çok seviyeli BOM ve geçerlilik', evidence: `${engineeringUniverse?.itemMasters?.length || components.length} kart • ${engineeringUniverse?.bomDefinitions?.length || 0} BOM`, issues: bomReleaseIssues() },
    { id: 'QG-04', title: 'Ürün/bileşen teknik şartları', evidence: `${Object.keys(engineeringAnswers || {}).length} kapsam`, issues: engineeringReleaseIssues() },
    { id: 'QG-05', title: 'İş planı, makine ve dış proses', evidence: `${selected.length} operasyon • ${selectedProcessEntries().filter(entry => entry.process.outsource).length} dış proses`, issues: routeReleaseIssues() },
    { id: 'QG-06', title: 'DFMEA ve tasarım risk kanıtı', evidence: `${globalThis.TyanaFmea?.snapshot?.().dfmeaRows?.length || 0} satır • ${globalThis.TyanaFmea?.coverage?.('dfmea')?.percent || 0}% kanıt`, issues: dfmeaReleaseIssues() },
    { id: 'QG-07', title: 'PFMEA ve proses risk kanıtı', evidence: `${pfmeaRows.length} risk • ${globalThis.TyanaFmea?.coverage?.('pfmea')?.percent || 0}% kanıt`, issues: [...fmeaGovernanceReleaseIssues('pfmea'), ...pfmeaReleaseIssues()] },
    { id: 'QG-08', title: 'Kontrol Planı, ölçüm ve MSA', evidence: `${controlPlanRows().length} kontrol • ${characteristics.filter(item => item.classification !== 'Normal').length} özel`, issues: characteristicReleaseIssues() },
    { id: 'QG-09', title: 'Operatör talimatı ve reaksiyon', evidence: `${instructionModels.length}/${selected.length} talimat`, issues: instructionTraceabilityIssues() },
    { id: 'QG-10', title: 'PPAP dosyası ve kanıt ekleri', evidence: `Seviye ${ppapState.level} • ${ppapState.readiness}% hazır`, issues: ppapIssues }
  ].map(category => ({ ...category, status: category.issues.length ? 'blocked' : 'pass' }));
}

function documentationAuditSnapshot() {
  const categories = documentationAuditCategories();
  const pass = categories.filter(item => item.status === 'pass').length;
  const blocked = categories.length - pass;
  const fmeaEvidence = ['dfmea', 'pfmea'].reduce((total, kind) => total + (globalThis.TyanaFmea?.evidenceRows?.(kind) || []).filter(row => ['PASS', 'NA'].includes(row.disposition) && String(row.evidence || '').trim()).length, 0);
  return { generatedAt: new Date().toISOString(), categories, total: categories.length, pass, blocked, score: categories.length ? Math.round((pass / categories.length) * 100) : 0, fmeaEvidence };
}

function documentationAuditIssueSummary(item) {
  if (!item.issues.length) return item.evidence;
  const normalized = [...new Set(item.issues.map(issue => String(issue || '').trim()).filter(Boolean))];
  const visible = normalized.slice(0, 3);
  const remaining = normalized.length - visible.length;
  return `${visible.join(' • ')}${remaining > 0 ? ` • +${remaining} diğer bulgu` : ''}`;
}

function renderDocumentationAudit() {
  const host = document.getElementById('documentationAuditList');
  if (!host) return null;
  const audit = documentationAuditSnapshot();
  document.getElementById('documentationAuditScore').textContent = `${audit.score}%`;
  document.getElementById('documentationAuditPass').textContent = audit.pass;
  document.getElementById('documentationAuditBlock').textContent = audit.blocked;
  document.getElementById('documentationAuditEvidence').textContent = audit.fmeaEvidence;
  const state = document.getElementById('documentationAuditState');
  state.textContent = audit.blocked ? 'KONTROLLÜ YAYIN BLOKE' : 'KANIT ZİNCİRİ HAZIR';
  state.classList.toggle('blocked', Boolean(audit.blocked));
  state.classList.toggle('ready', !audit.blocked);
  host.innerHTML = audit.categories.map(item => `<article class="documentation-audit-item ${item.status}" title="${escapeHtml(item.issues.join('\n'))}"><span>${item.status === 'pass' ? '✓' : '!'}</span><div><b>${escapeHtml(item.id)} • ${escapeHtml(item.title)}</b><small>${escapeHtml(documentationAuditIssueSummary(item))}</small></div><mark>${item.status === 'pass' ? 'UYGUN' : `${item.issues.length} BULGU`}</mark></article>`).join('');
  return audit;
}

function engineeringReleaseIssues() {
  if (!productEngineeringLibrary) return ['Ürün mühendisliği soru kütüphanesi yüklenmedi'];
  const issues = [];
  const scopes = ['FINISHED_GOOD', ...components.map(component => component.id)];
  let missing = 0;
  scopes.forEach(scopeId => engineeringQuestionSets(scopeId).forEach(set => set.questions.filter(question => question.required).forEach(question => {
    if (!engineeringAnswerFilled(engineeringAnswer(scopeId, question))) missing += 1;
  })));
  if (missing) issues.push(`${missing} zorunlu ürün/bileşen mühendislik sorusu yanıtlanmadı`);
  return issues;
}

function releaseGateIssues({ includeApproval = true } = {}) {
  const issues = [];
  if (!partNumber.value.trim() || !internalProductCode.value.trim() || !partName.value.trim() || !projectCode.value.trim() || !controlPlanNumber.value.trim()) issues.push('OEM No, kuruluş içi ürün/stok kodu veya doküman kimliği eksik');
  if (productGroup.value === '__custom__' && !document.getElementById('customProductGroupName').value.trim()) issues.push('Yeni ürün grubu adı boş');
  if (isCustomProductType() && !customProductTypeName.value.trim()) issues.push('Kullanıcı tanımlı ürün tipi adı boş');
  if (!drawingSource.sha256 || drawingSource.sha256.includes('BEKLİYOR')) issues.push('Teknik resim dosyası ve SHA-256 kaynağı doğrulanmadı');
  issues.push(...bomReleaseIssues(), ...routeReleaseIssues(), ...characteristicReleaseIssues(), ...dfmeaReleaseIssues(), ...fmeaGovernanceReleaseIssues('pfmea'), ...pfmeaReleaseIssues(), ...engineeringReleaseIssues());
  if (includeApproval && ['Onaylandı', 'Yayında'].includes(document.getElementById('documentStatus').value)) issues.push('Kontrollü yayın için sunucu tarafı iki aşamalı elektronik onay kaydı gerekli');
  return issues;
}

function refreshQualityGate() {
  const sections = [
    !partNumber.value.trim() || !internalProductCode.value.trim() || !partName.value.trim() || (productGroup.value === '__custom__' && !document.getElementById('customProductGroupName').value.trim()) || (isCustomProductType() && !customProductTypeName.value.trim()) ? ['OEM No, kuruluş içi stok kodu veya ürün sınıflandırması eksik'] : [],
    !drawingSource.sha256 || drawingSource.sha256.includes('BEKLİYOR') ? ['Teknik resim kaynağı eksik'] : [],
    bomReleaseIssues(), engineeringReleaseIssues(), routeReleaseIssues(), characteristicReleaseIssues(), pfmeaReleaseIssues()
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
  if (['Onaylandı', 'Yayında'].includes(status) && issues.length) {
    toast('Kontrollü çıktı bloke edildi', `${issues[0]}${issues.length > 1 ? ` • +${issues.length - 1} bulgu` : ''}. Taslak çıktı alabilir veya bulguları kapatabilirsiniz.`);
    return false;
  }
  return true;
}

function documentCopyLabel(status = document.getElementById('documentStatus').value) {
  return ['Onaylandı', 'Yayında'].includes(status) ? 'KONTROLLÜ KOPYA' : 'TASLAK / TANITIM';
}

function surfacePerformanceText(technical = null) {
  const coatingType = technical?.coatingType ?? document.getElementById('coatingType').value;
  const coatingThickness = technical?.coatingThickness ?? document.getElementById('coatingThickness').value;
  const corrosionHours = technical?.corrosionHours ?? document.getElementById('corrosionHours').value;
  return [coatingType || 'Kaplama tanımlanmadı', coatingThickness ? `${coatingThickness} µm` : '', corrosionHours ? `${corrosionHours} saat korozyon şartı` : ''].filter(Boolean).join(' • ');
}

function compactTraceValues(values, limit, overflowLabel) {
  const unique = [...new Set((values || []).map(value => String(value || '').trim()).filter(Boolean))];
  const visible = unique.slice(0, limit);
  const remaining = unique.length - visible.length;
  return `${visible.join(' / ')}${remaining > 0 ? ` • +${remaining} ${overflowLabel}` : ''}`;
}

function controlPlanRows() {
  return characteristics.filter(item => item.controlPlanIncluded !== false).map(item => {
    const context = controlContext(item); const owner = characteristicOwner(item);
    const linkedRisks = pfmeaRows.filter(row => row.controlPlanCharacteristicId === item.id || (row.controlPlanRowId && row.controlPlanRowId === item.controlPlanRowId));
    const pfmeaControls = [...new Set(linkedRisks.flatMap(row => [row.preventionControl, row.detectionControl]).filter(Boolean))];
    const pfmeaReactions = [...new Set(linkedRisks.map(row => row.reactionPlan).filter(Boolean))];
    return {
      item, owner, context, operation: context.op, operationCode: context.identity.code, operationLabelTR: context.identity.labelTR, operationLabelEN: context.identity.labelEN, processName: context.identity.title || context.process.name, responsible: context.detail?.responsible || context.process.owner || 'Sorumlu fonksiyon tanımlanacak',
      equipment: [context.detail?.machineId || context.process.equipment, context.detail?.tooling || context.process.tooling, context.detail?.programNo && context.detail.programNo !== 'Program / reçete no-rev girin' ? context.detail.programNo : ''].filter(Boolean).join(' / ') || '—', specification: specificationFor(item),
      control: [item.method, item.pokaYoke && item.pokaYoke !== '—' ? `P/Y: ${item.pokaYoke}` : '', item.alternateControl && item.alternateControl !== 'Uygulanmıyor' ? `Yedek: ${item.alternateControl}` : '', pfmeaControls.length ? `PFMEA: ${compactTraceValues(pfmeaControls, 2, 'ek kontrol — PFMEA kaydında')}` : ''].filter(Boolean).join(' • '),
      measurement: [item.equipmentClass, item.equipment, item.resolution ? `Çöz.: ${item.resolution}` : '', item.calibrationDue ? `Kal.: ${item.calibrationDue}` : '', item.msaReference ? `MSA: ${item.msaReference} / ${item.msaStatus}` : ''].filter(Boolean).join(' • '),
      sampling: `${item.sampleSize} / ${item.frequency}${item.trigger ? ` • ${item.trigger}` : ''}`,
      reference: [item.sourceDrawing, item.sourceZone, item.reference, item.reaction, linkedRisks.length ? `PFMEA ${compactTraceValues(linkedRisks.map(row => row.id), 3, 'ek risk — snapshotta')}` : ''].filter(Boolean).join(' / '), reaction: item.sourceReactionText || compactTraceValues(pfmeaReactions, 1, 'ek reaksiyon — PFMEA kaydında') || context.reaction
    };
  });
}

function renderControlPlan() {
  const header = document.getElementById('controlPlanHeader');
  const fields = [
    ['Kontrol Planı No', controlPlanNumber.value], ['OEM No / Revizyon', `${partNumber.value} / ${drawingRevision.value}`], ['Kuruluş İçi Ürün / Stok Kodu', internalProductCode.value], ['Mamul Adı', partName.value],
    ['Müşteri / Ek Referans', `${document.getElementById('customer').value} / ${document.getElementById('customerPartNumber').value}`], ['Kuruluş / Üretim Sahası', `${document.getElementById('supplierName').value} / ${document.getElementById('supplierSite').value}`], ['Tedarikçi Kodu', document.getElementById('supplierCode').value],
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
  if (!requireSelectedProcessRoute('Kontrol planı')) return;
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

function inferredDocumentMetadata(fileName, metadata = {}) {
  const normalized = String(fileName || '').toLocaleLowerCase('tr-TR');
  const inferredKey = normalized.includes('pfmea') ? 'pfmea' : normalized.includes('proses_akisi') ? 'process-flow' : '';
  const extension = normalized.split('.').pop()?.toUpperCase() || 'DOSYA';
  return { ppapKey: metadata.ppapKey || inferredKey, documentType: metadata.documentType || `${extension} kontrollü çıktı`, snapshotId: metadata.snapshotId || '', revision: metadata.revision || drawingRevision.value || 'A', track: metadata.track !== false };
}

async function recordRecentExport(blob, fileName, method, metadata = {}) {
  const documentMetadata = inferredDocumentMetadata(fileName, metadata);
  if (documentMetadata.track) {
    const generatedAt = new Date().toISOString(); const digest = await sha256Blob(blob);
    const generatedRecord = { id: crypto.randomUUID(), name: fileName, size: blob.size, type: blob.type || '', method, generatedAt, addedAt: generatedAt, sha256: digest, source: 'generated', ...documentMetadata };
    const existingIndex = generatedDocumentRecords.findIndex(item => item.name === fileName);
    if (existingIndex >= 0) generatedDocumentRecords.splice(existingIndex, 1, generatedRecord); else generatedDocumentRecords.unshift(generatedRecord);
    if (documentMetadata.ppapKey) {
      const record = ppapRecord(documentMetadata.ppapKey); const fileIndex = record.files.findIndex(file => file.name === fileName && file.source === 'generated');
      if (fileIndex >= 0) record.files.splice(fileIndex, 1, generatedRecord); else record.files.push(generatedRecord);
      record.revision = record.revision || documentMetadata.revision; record.updatedAt = generatedAt;
    }
    markDraftDirty({ affectsDocuments: false });
  }
  const container = document.getElementById('recentExports'); if (!container) return;
  const url = URL.createObjectURL(blob); recentExportUrls.push(url);
  while (recentExportUrls.length > 12) URL.revokeObjectURL(recentExportUrls.shift());
  if (!container.querySelector('.recent-export-list')) container.innerHTML = '<b>Bu oturumdaki çıktılar</b><div class="recent-export-list"></div>';
  const list = container.querySelector('.recent-export-list');
  const item = document.createElement('a'); item.href = url; item.download = fileName; item.className = 'recent-export-item';
  item.innerHTML = `<span>✓</span><p><b>${escapeHtml(fileName)}</b><small>${escapeHtml(method)} • ${(blob.size / 1024).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} KB • tekrar kaydetmek için tıklayın</small></p>`;
  list.prepend(item); while (list.children.length > 6) list.lastElementChild.remove();
  if (document.getElementById('documents')?.classList.contains('active')) renderPpap(document.querySelector('[data-ppap-filter].active')?.dataset.ppapFilter || 'all');
}

async function saveBlob(blob, fileName, fileType = {}, documentMetadata = {}) {
  if (globalThis.TyanaPlatform?.saveArtifact) {
    try {
      const result = await globalThis.TyanaPlatform.saveArtifact({ data: blob, fileName });
      if (result.cancelled) { toast('Kayıt iptal edildi', 'Dosyada değişiklik yapılmadı.'); return { saved: false, cancelled: true, method: 'cancelled', fileName: result.fileName || fileName }; }
      const method = result.mode === 'tauri' ? 'TYANA güvenli masaüstü kaydı' : result.mode === 'file-picker' ? 'Windows kayıt konumu' : 'Tarayıcı indirme yedeği';
      await recordRecentExport(blob, result.fileName || fileName, method, documentMetadata);
      return { saved: true, cancelled: false, method: result.mode || 'platform', fileName: result.fileName || fileName, type: result.exportType || result.type || '', bytesWritten: result.bytesWritten || blob.size };
    } catch (error) {
      toast('Dosya kaydı doğrulanamadı', error.message);
      return { saved: false, cancelled: false, method: 'error', fileName, error };
    }
  }
  const pickerAvailable = typeof window.showSaveFilePicker === 'function' && window.isSecureContext && !navigator.webdriver;
  if (pickerAvailable) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: fileName, types: fileType.types || [] });
      const writable = await handle.createWritable(); await writable.write(blob); await writable.close();
      await recordRecentExport(blob, fileName, 'Windows kayıt konumu', documentMetadata); return { saved: true, cancelled: false, method: 'picker', fileName, bytesWritten: blob.size };
    } catch (error) {
      if (error?.name === 'AbortError') { toast('Kayıt iptal edildi', 'Dosyada değişiklik yapılmadı.'); return { saved: false, cancelled: true, method: 'cancelled', fileName }; }
    }
  }
  downloadBlob(blob, fileName); await recordRecentExport(blob, fileName, 'Tarayıcı indirme yedeği', documentMetadata); return { saved: true, cancelled: false, method: 'download', fileName, bytesWritten: blob.size };
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
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') return value;
  const text = value.replaceAll('\u0000', '');
  return /^[\u0001-\u0020]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function safeExcelHeaderFooter(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').replaceAll('&', '&&').slice(0, 240);
}

function excelColumnName(columnNumber) {
  let value = Number(columnNumber); let result = '';
  while (value > 0) { value -= 1; result = String.fromCharCode(65 + (value % 26)) + result; value = Math.floor(value / 26); }
  return result || 'A';
}

async function exportControlPlanXlsx() {
  if (!globalThis.ExcelJS) { toast('Excel motoru yüklenemedi', 'Uygulama paketini yeniden yükleyin.'); return; }
  if (!ensureDocumentExportReady()) return;
  renderControlPlan();
  const snapshot = await getDocumentationSnapshot();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = `${tenantProductName()} • ${tenantShortName()} • Eren`; workbook.created = new Date(); workbook.modified = new Date();
  const sheet = workbook.addWorksheet('Kontrol Planı', { pageSetup: { paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.2, right: 0.2, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 } }, views: [{ state: 'frozen', ySplit: 8 }] });
  sheet.columns = [7, 23, 25, 10, 25, 19, 12, 24, 25, 16, 17, 31].map(width => ({ width }));
  const mergeValue = (range, label, value) => { sheet.mergeCells(range); const cell = sheet.getCell(range.split(':')[0]); cell.value = `${label}\n${safeExcelValue(value || '—')}`; cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }; };
  sheet.mergeCells('A1:L1'); sheet.getCell('A1').value = 'KONTROL PLANI / CONTROL PLAN'; sheet.getCell('A1').font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FF10213F' } }; sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }; sheet.getRow(1).height = 30;
  mergeValue('A2:D2', 'FAZ', `${phaseCheck('prototype')}   ${phaseCheck('prelaunch')}   ${phaseCheck('production')}`); mergeValue('E2:H2', 'KONTROL PLANI NO', controlPlanNumber.value); mergeValue('I2:L2', 'DOKÜMAN DURUMU', document.getElementById('documentStatus').value);
  mergeValue('A3:D3', 'KURULUŞ / SAHA', `${document.getElementById('supplierName').value} / ${document.getElementById('supplierSite').value}`); mergeValue('E3:H3', 'MÜŞTERİ / EK REFERANS', `${document.getElementById('customer').value} / ${document.getElementById('customerPartNumber').value}`); mergeValue('I3:L3', 'TEDARİKÇİ KODU', document.getElementById('supplierCode').value);
  mergeValue('A4:D4', 'OEM NO / REVİZYON', `${partNumber.value} / ${drawingRevision.value}`); mergeValue('E4:H4', 'KURULUŞ KODU / MAMUL ADI', `${internalProductCode.value} / ${partName.value}`); mergeValue('I4:L4', 'TEKNİK RESİM', `${document.getElementById('drawingNumber').value} / Rev. ${drawingRevision.value}`);
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
  sheet.pageSetup.printArea = `A1:L${8 + rows.length}`; sheet.pageSetup.printTitlesRow = '8:8'; sheet.headerFooter.oddFooter = `&L${safeExcelHeaderFooter(controlPlanNumber.value)} • Rev. ${safeExcelHeaderFooter(drawingRevision.value)}&C ${documentCopyLabel()} &R Sayfa &P / &N`;
  const bomSheet = workbook.addWorksheet('Mamul Ağacı', { views: [{ state: 'frozen', ySplit: 4 }] });
  const bomHeaders = ['Poz.', 'Parça Kodu', 'OEM No', 'Bileşen / Alt Montaj', 'Kalem Tipi', 'Miktar', 'Birim', 'Üret/Satın Al', 'Malzeme Kalite', 'Malzeme Standardı', 'Teknik Resim / Rev.', 'Giriş Durumu', 'Önceki / Kaynak Yöntem', 'Ana Dönüşüm Yöntemi', 'Çıkış Durumu', 'Bileşen Proses Omurgası', 'Isıl İşlem', 'Sertlik Şartı', 'Kaplama', 'İzlenebilirlik', 'Doğrulama', 'Seviye', 'Üst Parça Kodu', 'Tam BOM Yolu', 'Kullanım Miktarı', 'Kalem Revizyonu', 'Teknik Resim Revizyonu', 'Alternatif Grup', 'Aktif Alternatif', 'Geçerlilik', 'Kaynak BOM No', 'BOM Revizyonu', 'BOM Alternatifi', 'Montaj Operasyon Kodu', 'Yeniden Kullanım / Katalog', 'Üretildiği Operasyon', 'İlk Kullanım', 'Monte Edildiği Operasyon', 'Kontrol Operasyonu', 'Montaj Aşaması', 'Operasyon Bağlantı Durumu'];
  const bomWidths = [10, 20, 20, 26, 20, 10, 10, 16, 22, 24, 24, 19, 21, 21, 19, 30, 19, 18, 18, 22, 18, 9, 20, 42, 13, 15, 17, 18, 14, 22, 22, 14, 14, 18, 26, 22, 22, 22, 22, 20, 20];
  bomSheet.columns = bomWidths.map(width => ({ width })); const bomLastColumn = excelColumnName(bomHeaders.length); const bomMidColumn = excelColumnName(Math.floor(bomHeaders.length / 2)); const bomRightStart = excelColumnName(Math.floor(bomHeaders.length / 2) + 1);
  bomSheet.mergeCells(`A1:${bomLastColumn}1`); bomSheet.getCell('A1').value = `${tenantBrandLine()} • MAMUL AĞACI / BILL OF MATERIALS`; bomSheet.getCell('A1').font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }; bomSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10213F' } }; bomSheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }; bomSheet.getRow(1).height = 28;
  bomSheet.mergeCells(`A2:${bomMidColumn}2`); bomSheet.getCell('A2').value = `ANA MAMUL: ${safeExcelValue(internalProductCode.value)} • OEM ${safeExcelValue(partNumber.value)} • ${safeExcelValue(partName.value)} • Rev. ${safeExcelValue(drawingRevision.value)}`; bomSheet.mergeCells(`${bomRightStart}2:${bomLastColumn}2`); bomSheet.getCell(`${bomRightStart}2`).value = `PROJE: ${safeExcelValue(projectCode.value)} • ${components.length} ALT KALEM • ${globalThis.TyanaBom.flatten(components).reduce((max, row) => Math.max(max, row.level), 0)} SEVİYE`;
  bomSheet.getRow(4).values = bomHeaders;
  const bomRows = globalThis.TyanaBom.flatten(components, partName.value || 'Ana mamul'); const componentById = new Map(components.map(item => [item.id, item]));
  bomRows.forEach(item => bomSheet.addRow([item.position, item.itemNo, item.oemNo, item.name, item.componentType, item.quantity, item.uom, item.makeBuy, item.materialGrade, item.materialStandard, `${item.drawingNo} / ${item.revision}`, item.inputState, item.upstreamMethod, item.primaryManufacturingMethod, item.outputState, item.manufacturingRouteNotes, item.heatTreatment, item.hardnessSpec, `${item.coatingType} • ${item.coatingSpec}`, item.traceability, item.verificationStatus, item.level, item.parentId === 'FINISHED_GOOD' ? internalProductCode.value : componentById.get(item.parentId)?.itemNo || item.parentId, item.path, item.usageQuantity, item.itemRevision, item.drawingRevision, item.alternativeGroupId, item.alternativeGroupId ? (item.alternativeSelected ? 'SEÇİLİ' : 'PASİF ALTERNATİF') : '—', [item.effectiveFrom, item.effectiveTo].filter(Boolean).join(' → '), item.sourceBomNo, item.sourceBomRevision, item.sourceBomAlternative, item.assemblyOperationCode || item.operationCode, item.catalogItemId ? `${item.reuseMode} • ${item.catalogItemId} • Rev. ${item.catalogRevision}` : item.reuseMode, item.producedAtProcessId, item.firstUseProcessId, item.mountedAtProcessId, item.inspectedAtProcessId, item.installationStage, item.operationLinkStatus].map(safeExcelValue)));
  [bomSheet.getRow(4)].forEach(row => row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10213F' } }; cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; }));
  bomSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => { if (rowNumber > 4) { row.height = 36; row.eachCell(cell => { cell.font = { name: 'Arial', size: 8 }; cell.alignment = { vertical: 'middle', wrapText: true }; }); } row.eachCell(cell => { if (rowNumber >= 4) cell.border = border; }); });
  bomSheet.autoFilter = { from: 'A4', to: `${bomLastColumn}4` };
  bomSheet.pageSetup = {
    paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 2, fitToHeight: 0,
    horizontalCentered: true, pageOrder: 'overThenDown',
    margins: { left: 0.2, right: 0.2, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 },
    printArea: `A1:${bomLastColumn}${Math.max(4, 4 + bomRows.length)}`
  };
  bomSheet.pageSetup.printTitlesRow = '1:4';
  bomSheet.pageSetup.printTitlesColumn = 'A:D';
  bomSheet.headerFooter.oddFooter = `&L${safeExcelHeaderFooter(internalProductCode.value)} • BOM Rev. ${safeExcelHeaderFooter(drawingRevision.value)}&C ${documentCopyLabel()} &R Sayfa &P / &N`;

  const characteristicSheet = workbook.addWorksheet('Karakteristik Kütüğü', { views: [{ state: 'frozen', ySplit: 3 }] });
  characteristicSheet.columns = [14, 14, 18, 20, 24, 34, 22, 14, 20, 19, 18, 24, 20, 16, 24, 28, 20].map(width => ({ width }));
  characteristicSheet.mergeCells('A1:Q1'); characteristicSheet.getCell('A1').value = `${tenantBrandLine()} • NUMARALI KARAKTERİSTİK KÜTÜĞÜ`; characteristicSheet.getCell('A1').font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FFFFFFFF' } }; characteristicSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF245CC7' } }; characteristicSheet.getCell('A1').alignment = { horizontal: 'center' };
  characteristicSheet.getRow(3).values = ['Kalıcı ID', 'Kütüphane Kodu', 'Balon', 'Bileşen', 'Ad', 'Tanım', 'Kaynak Resim / Bölge', 'Tip / Sınıf', 'Spesifikasyon', 'Proses', 'Kontrol Yöntemi', 'Ekipman / ID', 'Kalibrasyon', 'MSA', 'Numune / Sıklık', 'Tetikleyici', 'Kayıt / Reaksiyon'];
  controlPlanRows().forEach(row => characteristicSheet.addRow([row.item.id, row.item.libraryCode, row.item.balloon, `${row.owner.position} • ${row.owner.name}`, row.item.name, row.item.definition, `${row.item.sourceDrawing} / ${row.item.sourceZone}`, `${row.item.kind} / ${row.item.classification}`, row.specification, row.processName, row.item.method, `${row.item.equipmentClass} / ${row.item.equipment}`, row.item.calibrationDue || '—', `${row.item.msaReference} / ${row.item.msaStatus}`, `${row.item.sampleSize} / ${row.item.frequency}`, row.item.trigger, `${row.item.reference} / ${row.item.reaction}`].map(safeExcelValue)));
  characteristicSheet.getRow(3).eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10213F' } }; cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
  characteristicSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => { if (rowNumber > 3) { row.height = 45; row.eachCell(cell => { cell.font = { name: 'Arial', size: 8 }; cell.alignment = { vertical: 'middle', wrapText: true }; }); } row.eachCell(cell => { if (rowNumber >= 3) cell.border = border; }); });
  characteristicSheet.autoFilter = { from: 'A3', to: 'Q3' }; characteristicSheet.pageSetup = { paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printArea: `A1:Q${Math.max(3, 3 + characteristics.length)}` };

  const engineeringSheet = workbook.addWorksheet('Mühendislik Soruları', { views: [{ state: 'frozen', ySplit: 3 }] });
  engineeringSheet.columns = [24, 28, 25, 48, 16, 48, 13, 20, 22, 22].map(width => ({ width }));
  engineeringSheet.mergeCells('A1:J1'); engineeringSheet.getCell('A1').value = `${tenantBrandLine()} • ÜRÜN / BİLEŞEN MÜHENDİSLİK SORULARI VE DOĞRULAMA KAYDI`; engineeringSheet.getCell('A1').font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }; engineeringSheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF245CC7' } }; engineeringSheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }; engineeringSheet.getRow(1).height = 27;
  engineeringSheet.getRow(3).values = ['Kapsam', 'Soru ID', 'Soru Seti', 'Teknik Soru', 'Tip', 'Yanıt / Sayısal Değer', 'Birim', 'Kaynak', 'Doğrulama', 'Kanıt / Gerekçe'];
  const questionIndex = new Map((productEngineeringLibrary?.questionSets || []).flatMap(set => set.questions.map(question => [question.id, { ...question, setId: set.id }])));
  engineeringCustomQuestions.forEach(question => questionIndex.set(question.id, { ...question, setId: 'custom', labels: { 'tr-TR': question.label } }));
  const displayAnswer = value => Array.isArray(value) ? value.map(item => typeof item === 'object' ? Object.entries(item).map(([key, entry]) => `${key}: ${entry}`).join(' | ') : item).join('\n') : value && typeof value === 'object' ? Object.entries(value).map(([key, entry]) => `${key}: ${entry}`).join(' | ') : String(value ?? '');
  Object.entries(engineeringAnswers).forEach(([scopeId, records]) => Object.values(records || {}).forEach(answer => {
    const question = questionIndex.get(answer.questionId) || { id: answer.questionId, setId: 'custom', labels: { 'tr-TR': answer.questionId }, type: 'text' };
    const scope = scopeId === 'FINISHED_GOOD' ? `ANA MAMUL • ${partName.value}` : components.find(component => component.id === scopeId) ? `${components.find(component => component.id === scopeId).position} • ${components.find(component => component.id === scopeId).name}` : scopeId;
    engineeringSheet.addRow([scope, answer.questionId, question.setId, engineeringLabel(question, answer.questionId), question.type, displayAnswer(answer.value), answer.unit || '', answer.source || '', answer.verificationStatus || '', answer.evidenceRef || answer.notApplicableReason || ''].map(safeExcelValue));
  }));
  engineeringSheet.getRow(3).eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10213F' } }; cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
  engineeringSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => { if (rowNumber > 3) { row.height = 39; row.eachCell(cell => { cell.font = { name: 'Arial', size: 8 }; cell.alignment = { vertical: 'middle', wrapText: true }; }); } row.eachCell(cell => { if (rowNumber >= 3) cell.border = border; }); });
  engineeringSheet.autoFilter = { from: 'A3', to: 'J3' }; engineeringSheet.pageSetup = { paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printArea: `A1:J${Math.max(3, engineeringSheet.rowCount)}` };

  const metadata = workbook.addWorksheet('_TYANA_METADATA'); metadata.state = 'veryHidden';
  [['Schema', snapshot.schemaVersion], ['Template', snapshot.templateVersion], ['Tenant', snapshot.tenant?.shortName], ['Tenant Profile', snapshot.tenant?.profileVersion], ['Quality Library', snapshot.engineering?.qualityDocumentLibraryVersion], ['Project ID', currentProjectId || 'unsaved'], ['Snapshot ID', snapshot.snapshotId], ['SHA-256', snapshot.sha256], ['Generated At', snapshot.generatedAt], ['Drawing SHA-256', snapshot.drawingSource.sha256]].forEach(row => metadata.addRow(row.map(safeExcelValue)));
  const buffer = await workbook.xlsx.writeBuffer();
  const verification = new ExcelJS.Workbook(); await verification.xlsx.load(buffer);
  if (!verification.getWorksheet('Kontrol Planı') || !verification.getWorksheet('Mamul Ağacı') || !verification.getWorksheet('Karakteristik Kütüğü') || !verification.getWorksheet('Mühendislik Soruları') || verification.getWorksheet('Kontrol Planı').rowCount < 8 + rows.length) throw new Error('XLSX doğrulaması başarısız.');
  const fileName = `${safeFileName(controlPlanNumber.value)}_Rev-${safeFileName(drawingRevision.value)}.xlsx`; const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const result = await saveBlob(blob, fileName, exportFileTypes.xlsx, { ppapKey: 'control-plan', documentType: 'Kontrol Planı Excel', snapshotId: snapshot.snapshotId, revision: snapshot.product.drawingRevision }); if (result.saved) toast('Excel kontrol planı doğrulandı ve kaydedildi', `${rows.length} kontrol satırı • ${components.length} BOM kalemi • 4 görünür çalışma sayfası.`);
  return result;
}

function pdfControlDefinition(snapshot) {
  const rows = controlPlanRows();
  const engineeringAnswerCount = Object.values(snapshot.engineering?.answers || {}).reduce((total, bucket) => total + Object.keys(bucket || {}).length, 0);
  const controlHeaders = ['Op.', 'Operasyon', 'Makine / Aparat', 'Kar. No', 'Karakteristik', 'Spesifikasyon', 'Sınıf', 'Kontrol / Poka-Yoke', 'Ölçüm / Cihaz', 'Numune / Sıklık', 'Referans', 'Reaksiyon Planı'].map(text => ({ text, bold: true, color: 'white', fillColor: '#10213f', alignment: 'center', fontSize: 6, margin: 2 }));
  const controlBody = rows.map(row => [row.operation, `${row.processName}\n${row.responsible}`, row.equipment, `${row.item.balloon}\n${row.item.id}`, `${row.item.name}\n${row.owner.position} • ${row.owner.name}\n${row.item.definition}`, row.specification, row.item.classification, row.control, row.measurement, row.sampling, row.reference, row.reaction].map(text => ({ text: String(text || '—'), fontSize: 5.5, margin: 2 })));
  const meta = value => ({ text: value || '—', fontSize: 7, bold: true, margin: [2, 2, 2, 2] });
  const metaLabel = value => ({ text: value, fontSize: 5.5, color: '#68758b', margin: [2, 2, 2, 0] });
  const metaCell = (label, value) => ({ stack: [metaLabel(label), meta(value)], margin: 1 });
  const repeatedHeader = () => ({ margin: [18, 12, 18, 0], table: { widths: [100, '*', 100], body: [[{ text: `${snapshot.tenant?.shortName || tenantShortName()}\n${snapshot.tenant?.productName || tenantProductName()}`, bold: true, color: '#2f6fed', alignment: 'center', fontSize: 8, margin: [0, 5] }, { text: 'KONTROL PLANI / CONTROL PLAN', bold: true, fontSize: 17, alignment: 'center', margin: [0, 4] }, { text: String(snapshot.approval.status || 'Taslak').toLocaleUpperCase('tr-TR'), bold: true, alignment: 'center', margin: [0, 7] }]] }, layout: { hLineWidth: () => .8, vLineWidth: () => .8, hLineColor: () => '#52627a', vLineColor: () => '#52627a' } });
  return {
    pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [18, 58, 18, 24], header: repeatedHeader, background: (_page, pageSize) => ({ canvas: [{ type: 'rect', x: 10, y: 10, w: pageSize.width - 20, h: pageSize.height - 20, lineWidth: .8, lineColor: '#52627a' }] }), watermark: { text: ['Onaylandı', 'Yayında'].includes(snapshot.approval.status) ? 'KONTROLLÜ KOPYA' : 'TASLAK / TANITIM', color: '#b8c3d4', opacity: 0.18, bold: true },
    footer: (currentPage, pageCount) => ({ margin: [18, 5, 18, 0], columns: [{ text: `${snapshot.product.controlPlanNumber} • Rev. ${snapshot.product.drawingRevision} • SHA ${snapshot.sha256.slice(0, 16)}`, fontSize: 6, color: '#69758a' }, { text: `${documentCopyLabel(snapshot.approval.status)} • Sayfa ${currentPage} / ${pageCount}`, alignment: 'right', fontSize: 6, color: '#69758a' }] }),
    content: [
      { table: { widths: [90, 150, 150, '*'], body: [[metaCell('FAZ', snapshot.product.productionPhase), metaCell('KONTROL PLANI NO', snapshot.product.controlPlanNumber), metaCell('OEM NO / REV.', `${snapshot.product.partNumber} / ${snapshot.product.drawingRevision}`), metaCell('KURULUŞ KODU / MAMUL', `${snapshot.product.internalProductCode} / ${snapshot.product.partName}`)], [metaCell('KURULUŞ / SAHA', `${snapshot.product.supplierName} / ${snapshot.product.supplierSite}`), metaCell('MÜŞTERİ / EK REFERANS', `${snapshot.product.customer} / ${snapshot.product.customerPartNumber}`), metaCell('ANAHTAR PERSONEL', `${snapshot.product.keyContact} / ${snapshot.product.keyContactPhone}`), metaCell('İLK YAYIN / REVİZYON', `${snapshot.product.originalDate} / ${snapshot.product.revisionDate}`)], [metaCell('TEKNİK RESİM', `${snapshot.product.drawingNumber} / Rev. ${snapshot.product.drawingRevision}`), metaCell('MAMUL AĞACI / SORU KAYDI', `${snapshot.components.length} alt kalem • ${engineeringAnswerCount} mühendislik yanıtı • ${snapshot.components.slice(0, 2).map(item => item.materialGrade).filter(Boolean).join(' • ')}`), metaCell('ORTAK ÜRÜN ŞARTI', `${snapshot.technical.materialGrade} • ${snapshot.technical.materialStandard}`), metaCell('YÜZEY / FONKSİYON', surfacePerformanceText(snapshot.technical))]] }, layout: { hLineWidth: () => 0.7, vLineWidth: () => 0.7, hLineColor: () => '#6e7787', vLineColor: () => '#6e7787' }, margin: [0, 0, 0, 4] },
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
  const result = await saveBlob(blob, fileName, exportFileTypes.pdf, { ppapKey: 'control-plan', documentType: 'Kontrol Planı PDF', snapshotId: snapshot.snapshotId, revision: snapshot.product.drawingRevision }); if (result.saved) toast('Antetli PDF kaydedildi', `A3 yatay • ${characteristics.length} kontrol satırı • ${components.length} BOM kalemi • Türkçe gömülü font`);
  return result;
}

function dfmeaPdfDefinition(snapshot) {
  const fmea = snapshot.fmeaGovernance || {};
  const profile = fmea.profiles?.dfmea || {};
  const rows = (fmea.dfmeaRows || []).filter(row => ['function', 'requirement', 'failureEffect', 'failureMode', 'failureCause'].some(field => String(row[field] || '').trim()));
  const evidenceRows = fmea.questionCatalog?.dfmea || [];
  const documentNo = `${snapshot.product.projectCode || 'PROJE'}-DFMEA`;
  const normalCell = (value, options = {}) => ({ text: String(value || '—'), fontSize: 5.25, margin: [1.5, 1.5, 1.5, 1.5], ...options });
  const headerCell = value => ({ text: value, bold: true, color: '#ffffff', fillColor: '#10213f', alignment: 'center', fontSize: 5.2, margin: [1, 2, 1, 2] });
  const metaCell = (label, value) => ({ stack: [{ text: label, fontSize: 5.2, color: '#617187' }, { text: String(value || '—'), bold: true, fontSize: 6.5, margin: [0, 2, 0, 0] }], margin: [3, 3, 3, 3] });
  const layout = { hLineWidth: () => 0.55, vLineWidth: () => 0.55, hLineColor: () => '#69768a', vLineColor: () => '#69768a', paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 };
  const riskRows = rows.map((row, index) => {
    const fillColor = index % 2 ? '#f5f8fb' : '#ffffff';
    const cell = (value, options = {}) => normalCell(value, { fillColor, ...options });
    const apFill = row.ap === 'H' ? '#f8d7da' : row.ap === 'M' ? '#fff1c7' : row.ap === 'L' ? '#dff3e8' : '#eef1f5';
    const result = [row.resultSeverity, row.resultOccurrence, row.resultDetection].some(Boolean)
      ? `${row.resultSeverity || '—'} / ${row.resultOccurrence || '—'} / ${row.resultDetection || '—'} / ${row.resultAp || '—'}`
      : 'Yeniden değerlendirme bekliyor';
    return [
      cell(index + 1, { alignment: 'center', bold: true }),
      cell(`${row.upperLevel || '—'}\nODAK: ${row.focusElement || '—'}\nALT: ${row.lowerLevel || '—'}`, { bold: true }),
      cell(`${row.function || '—'}\nGEREKSİNİM: ${row.requirement || '—'}`),
      cell(row.failureEffect),
      cell(row.severity, { alignment: 'center', bold: true }),
      cell(row.failureMode),
      cell(row.failureCause),
      cell(row.occurrence, { alignment: 'center', bold: true }),
      cell(`ÖNLEME: ${row.preventionControl || '—'}\nTESPİT: ${row.detectionControl || '—'}\nDVP&R: ${row.dvprRef || '—'}\nKAR.: ${row.characteristicId || '—'} / ${row.specialClass || 'NONE'}`),
      cell(row.detection, { alignment: 'center', bold: true }),
      cell(row.ap || '—', { alignment: 'center', bold: true, fillColor: apFill }),
      cell(`ÖNLEME: ${row.preventionAction || row.action || '—'}\nTESPİT: ${row.detectionAction || '—'}\nSORUMLU: ${row.owner || '—'}\nTERMİN: ${row.dueDate || '—'}\nTAMAMLAMA: ${row.actionCompletionDate || '—'}`),
      cell(`${result}\n${row.resultRationale || '—'}`),
      cell(`${row.status || 'Açık'}\nKANIT: ${row.actionEvidence || '—'}\nRİSK GEREKÇESİ: ${row.riskRationale || '—'}\nFİLTRE: ${row.filterCode || '—'}\nNOT: ${row.notes || '—'}`)
    ];
  });
  const auditRows = evidenceRows.map(row => {
    const dispositionFill = row.disposition === 'PASS' ? '#dff3e8' : row.disposition === 'NA' ? '#e8edf2' : row.disposition === 'FINDING' ? '#f8d7da' : '#fff1c7';
    return [
      normalCell(row.id, { alignment: 'center', bold: true }),
      normalCell(`ADIM ${row.step}`),
      normalCell(row.text),
      normalCell(row.required ? 'ZORUNLU' : 'İYİ UYGULAMA', { alignment: 'center' }),
      normalCell(row.disposition || 'OPEN', { alignment: 'center', bold: true, fillColor: dispositionFill }),
      normalCell(row.evidence),
      normalCell(row.owner),
      normalCell(row.dueDate, { alignment: 'center' })
    ];
  });
  const repeatedHeader = () => ({ margin: [18, 12, 18, 0], table: { widths: [110, '*', 145], body: [[
    { text: `${snapshot.tenant?.shortName || tenantShortName()}\n${snapshot.tenant?.productName || tenantProductName()}`, bold: true, color: '#2f6fed', alignment: 'center', fontSize: 8, margin: [0, 6, 0, 4] },
    { text: 'TASARIM FMEA / DESIGN FAILURE MODE AND EFFECTS ANALYSIS', bold: true, alignment: 'center', fontSize: 14, margin: [0, 7, 0, 5] },
    { text: `${documentNo}\nRev. ${profile.revision || snapshot.product.drawingRevision || '—'} • ${snapshot.approval.status}`, bold: true, alignment: 'center', fontSize: 7, margin: [0, 5, 0, 3] }
  ]] }, layout });
  return {
    pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [18, 58, 18, 28], header: repeatedHeader,
    background: (_page, pageSize) => ({ canvas: [{ type: 'rect', x: 10, y: 10, w: pageSize.width - 20, h: pageSize.height - 20, lineWidth: 1, lineColor: '#24344f' }] }),
    watermark: { text: documentCopyLabel(snapshot.approval.status), color: '#aeb9ca', opacity: 0.14, bold: true },
    footer: (page, pages) => ({ margin: [20, 4, 20, 0], columns: [
      { text: `${documentNo} • Rev. ${profile.revision || '—'} • SHA-256 ${snapshot.sha256.slice(0, 16)}`, fontSize: 5.8, color: '#68758b' },
      { text: `${documentCopyLabel(snapshot.approval.status)} • Sayfa ${page} / ${pages}`, alignment: 'right', bold: true, fontSize: 5.8, color: '#68758b' }
    ] }),
    content: [
      { table: { widths: ['*', '*', '*', '*'], body: [
        [metaCell('PROJE / OEM', `${snapshot.product.projectCode} / ${snapshot.product.partNumber}`), metaCell('MAMUL / KURULUŞ KODU', `${snapshot.product.partName} / ${snapshot.product.internalProductCode}`), metaCell('TEKNİK RESİM / REV.', `${snapshot.product.drawingNumber} / ${snapshot.product.drawingRevision}`), metaCell('FMEA TÜRÜ / KAYNAK', `${profile.basis || '—'} / ${profile.sourceId || '—'}`)],
        [metaCell('UYGULANABİLİRLİK', `${profile.applicability || 'applicable'} / ${profile.applicabilityRationale || '—'}`), metaCell('KAPSAM / AİLE', `${profile.scope || '—'} / ${profile.family || '—'}`), metaCell('EKİP / MODERATÖR', `${profile.team || '—'} / ${profile.coordinator || '—'}`), metaCell('CSR / ÖĞRENİLMİŞ DERS', `${profile.customerRequirements || '—'} / ${profile.lessonsLearned || '—'}`)],
        [metaCell('5T AMAÇ / ZAMANLAMA', `${profile.intent || '—'} / ${profile.timing || '—'}`), metaCell('5T GÖREV / ARAÇ', `${profile.task || '—'} / ${profile.tool || '—'}`), metaCell('YAPI / FONKSİYON REF.', `${profile.structureAnalysisRef || '—'} / ${profile.functionAnalysisRef || '—'}`), metaCell('PUAN TABLOSU / SONUÇ RAPORU', `${profile.ratingTableRef || '—'} / ${profile.resultReportRef || '—'}`)]
      ] }, layout, margin: [0, 0, 0, 4] },
      { table: { headerRows: 1, dontBreakRows: false, widths: [22, 82, 105, 93, 22, 78, 83, 22, 135, 22, 28, 118, 100, '*'], body: [[
        'NO', 'YAPI ANALİZİ', 'FONKSİYON / GEREKSİNİM', 'HATA ETKİSİ', 'S', 'HATA MODU', 'HATA NEDENİ', 'O', 'MEVCUT KONTROLLER / DVP&R', 'D', 'AP', 'OPTİMİZASYON / SORUMLU', 'AKSİYON SONRASI S/O/D/AP', 'DURUM / KANIT'
      ].map(headerCell), ...riskRows] }, layout },
      { text: '7-ADIM DENETİM KANITI / AUDIT EVIDENCE APPENDIX', pageBreak: 'before', bold: true, fontSize: 13, color: '#10213f', margin: [0, 0, 0, 6] },
      { table: { headerRows: 1, widths: [42, 42, 250, 75, 68, '*', 95, 70], body: [[
        'SORU', 'ADIM', 'DENETİM SORUSU', 'TÜR', 'KARAR', 'NESNEL KANIT / REFERANS', 'SORUMLU', 'TERMİN'
      ].map(headerCell), ...auditRows] }, layout },
      { text: 'Not: S-O-D ve Action Priority (AP) değerleri yetkili disiplinler arası ekip tarafından kuruluşun lisanslı FMEA referansına göre doğrulanır. S×O×D yalnız tanısal göstergedir ve AP kararının yerine geçmez.', fontSize: 5.8, color: '#4e5c72', margin: [2, 5, 2, 0] }
    ], defaultStyle: { font: 'Roboto' }
  };
}

async function exportDfmeaPdf() {
  if (!globalThis.pdfMake) { toast('PDF motoru yüklenemedi', 'Uygulama paketini yeniden yükleyin.'); return; }
  if (!ensureDocumentExportReady()) return;
  const snapshot = await getDocumentationSnapshot();
  const meaningfulRows = snapshot.fmeaGovernance?.dfmeaRows?.filter(row => ['function', 'failureEffect', 'failureMode', 'failureCause'].some(field => String(row[field] || '').trim())) || [];
  if (!meaningfulRows.length && snapshot.fmeaGovernance?.profiles?.dfmea?.applicability !== 'not-applicable') {
    toast('DFMEA PDF oluşturulamadı', 'En az bir tasarım risk satırı oluşturun veya gerekçeli uygulanamazlık kararı kaydedin.');
    return;
  }
  const fileName = `${safeFileName(snapshot.product.projectCode)}_DFMEA_${safeFileName(snapshot.product.partNumber)}_Rev-${safeFileName(snapshot.fmeaGovernance?.profiles?.dfmea?.revision || snapshot.product.drawingRevision)}.pdf`;
  const blob = await pdfBlob(dfmeaPdfDefinition(snapshot));
  if (blob.size < 1024) throw new Error('DFMEA PDF byte doğrulaması başarısız.');
  const result = await saveBlob(blob, fileName, exportFileTypes.pdf, { ppapKey: 'dfmea', documentType: 'DFMEA PDF', snapshotId: snapshot.snapshotId, revision: snapshot.fmeaGovernance?.profiles?.dfmea?.revision || snapshot.product.drawingRevision });
  if (result.saved) toast('Kontrollü DFMEA PDF kaydedildi', `A3 yatay • ${meaningfulRows.length} tasarım risk satırı • 7-adım denetim kanıt eki`);
  return result;
}

document.querySelectorAll('[data-action="export-dfmea-pdf"]').forEach(button => button.addEventListener('click', () => exportDfmeaPdf().catch(error => toast('DFMEA PDF üretilemedi', error.message))));

function pfmeaPdfDefinition(snapshot) {
  const routeEntries = new Map(selectedProcessEntries().map(entry => [entry.routeKey, entry]));
  const profile = snapshot.fmeaGovernance?.profiles?.pfmea || {};
  const auditRows = (snapshot.fmeaGovernance?.questionCatalog?.pfmea || []).map(row => [
    { text: row.id, bold: true, alignment: 'center', fontSize: 5.7, margin: [1, 2, 1, 2] },
    { text: `ADIM ${row.step}`, alignment: 'center', fontSize: 5.7, margin: [1, 2, 1, 2] },
    { text: row.text, fontSize: 5.7, margin: [1, 2, 1, 2] },
    { text: row.disposition || 'OPEN', bold: true, alignment: 'center', fillColor: ['PASS', 'NA'].includes(row.disposition) ? '#dff3e8' : row.disposition === 'FINDING' ? '#f8d7da' : '#fff1c7', fontSize: 5.7, margin: [1, 2, 1, 2] },
    { text: row.evidence || '—', fontSize: 5.7, margin: [1, 2, 1, 2] },
    { text: `${row.owner || '—'}\n${row.dueDate || '—'}`, fontSize: 5.7, margin: [1, 2, 1, 2] }
  ]);
  const riskRows = (snapshot.pfmea || pfmeaRows).map((row, index) => {
    const entry = routeEntries.get(row.routeKey);
    const process = entry?.process || processes.find(candidate => candidate.id === row.processId);
    const operationIdentity = entry ? { title: [entry.detail.operationCode ? `KOD ${entry.detail.operationCode}` : '', entry.detail.operationLabelTR || entry.process.name, entry.detail.operationLabelEN ? `/ ${entry.detail.operationLabelEN}` : ''].filter(Boolean).join(' ') } : { title: process?.name || 'Manuel risk' };
    const component = row.componentId === 'FINISHED_GOOD'
      ? snapshot.product.partName
      : snapshot.components.find(candidate => candidate.id === row.componentId)?.name;
    const fillColor = index % 2 ? '#f5f7fb' : '#ffffff';
    const normalCell = (text, options = {}) => ({ text: String(text || '—'), fontSize: 5.35, margin: [1.5, 1.4, 1.5, 1.4], fillColor, ...options });
    const scoreCell = value => normalCell(value, { bold: true, alignment: 'center', fontSize: 6.1 });
    const apFill = row.ap === 'H' ? '#f8d7da' : row.ap === 'M' ? '#fff1c7' : row.ap === 'L' ? '#dff3e8' : '#eef1f5';
    const statusFill = pfmeaResultComplete(row) ? '#dff3e8' : ['Karar Bekleniyor', 'Uygulama Bekleniyor', 'Devam Ediyor'].includes(row.status) ? '#fff1c7' : '#f8d7da';
    const effects = [
      `KURULUŞ: ${row.effectOwnPlant || '—'}`,
      `SEVK SAHASI: ${row.effectShipToPlant || '—'}`,
      `SON KULLANICI: ${row.effectEndUser || row.effect || '—'}`
    ].join('\n');
    const result = [row.resultSeverity, row.resultOccurrence, row.resultDetection, row.resultAp].some(Boolean)
      ? `${row.resultSeverity || '—'} / ${row.resultOccurrence || '—'} / ${row.resultDetection || '—'} / ${row.resultAp || '—'}`
      : '— / — / — / —';
    return [
      normalCell(entry?.detail.operationNo || row.operationNo || '—', { bold: true, alignment: 'center' }),
      normalCell(`${row.processItem || component || '—'}\n→ ${row.processStep || operationIdentity.title}\n→ ${PFMEA_WORK_ELEMENT_TYPES.find(([value]) => value === row.workElementType)?.[1] || row.workElementType || '4M?'}: ${row.workElement || '—'}\n\nF1: ${row.processItemFunction || '—'}\nF2: ${row.functionText || '—'}\nF3: ${row.workElementFunction || '—'}`, { bold: true }),
      normalCell(`${effects}\n\nS: ${row.severity || '—'}`),
      normalCell(`HATA TÜRÜ: ${row.failureMode || '—'}\nNEDEN: ${row.cause || '—'}`),
      normalCell(`${row.preventionControl || '—'}\n\nO: ${row.occurrence || '—'}`),
      normalCell(`${row.detectionControl || '—'}\n\nD: ${row.detection || '—'}`),
      normalCell(`AP: ${row.ap || '—'}\nÖZEL: ${row.specialCharacteristic || 'NONE'}\nTABLO: ${row.ratingTableRef || '—'}\nGEREKÇE: ${row.ratingsRationale || '—'}`, { bold: true, fillColor: apFill }),
      normalCell(`ÖNLEME: ${row.preventionAction || row.recommendedAction || '—'}\nTESPİT: ${row.detectionAction || '—'}\nREAKSİYON: ${row.reactionPlan || '—'}`),
      normalCell(`${row.owner || '—'}\nHEDEF: ${row.dueDate || '—'}\nFİİLİ: ${row.actionCompletionDate || '—'}\nDURUM: ${row.status || 'Açık'}`, { bold: true, alignment: 'center', fillColor: statusFill }),
      normalCell(`YENİ S/O/D/AP: ${result}\nETKİNLİK: ${row.resultRationale || '—'}\nKANIT: ${row.actionEvidence || row.evidence || '—'}\nRİSK KABUL: ${row.riskAcceptanceRef || '—'}\nCP: ${row.controlPlanRowId || row.controlPlanCharacteristicId || '—'}`)
    ];
  });
  const headerCell = text => ({ text, bold: true, color: '#ffffff', fillColor: '#10213f', alignment: 'center', fontSize: 5.35, margin: [1, 2, 1, 2] });
  const metaCell = (label, value) => ({ stack: [{ text: label, fontSize: 5.2, color: '#637087' }, { text: String(value || '—'), bold: true, fontSize: 6.5, margin: [0, 2, 0, 0] }], margin: [3, 3, 3, 3] });
  const tableLayout = { hLineWidth: () => 0.55, vLineWidth: () => 0.55, hLineColor: () => '#657188', vLineColor: () => '#657188', paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 };
  const pfmeaNumber = `${snapshot.product.projectCode || 'PROJE'}-PFMEA`;
  const generatedAt = new Date(snapshot.generatedAt).toLocaleString('tr-TR');
  const repeatedHeader = () => ({ margin: [18, 12, 18, 0], table: { widths: [110, '*', 145], body: [[
    { text: `${snapshot.tenant?.shortName || tenantShortName()}\n${snapshot.tenant?.productName || tenantProductName()}`, bold: true, color: '#2f6fed', alignment: 'center', fontSize: 8, margin: [0, 6, 0, 4] },
    { text: 'PROSES FMEA / PROCESS FAILURE MODE AND EFFECTS ANALYSIS', bold: true, alignment: 'center', fontSize: 15, margin: [0, 7, 0, 5] },
    { text: `${pfmeaNumber}\nRev. ${snapshot.product.drawingRevision || '—'} • ${snapshot.approval.status}`, bold: true, alignment: 'center', fontSize: 7, margin: [0, 5, 0, 3] }
  ]] }, layout: tableLayout });
  return {
    pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [18, 58, 18, 28], header: repeatedHeader,
    background: (_page, pageSize) => ({ canvas: [{ type: 'rect', x: 10, y: 10, w: pageSize.width - 20, h: pageSize.height - 20, lineWidth: 1, lineColor: '#24344f' }] }),
    watermark: { text: documentCopyLabel(snapshot.approval.status), color: '#aeb9ca', opacity: 0.14, bold: true },
    footer: (page, pages) => ({ margin: [20, 4, 20, 0], columns: [
      { text: `${pfmeaNumber} • Rev. ${snapshot.product.drawingRevision || '—'} • SHA-256 ${snapshot.sha256.slice(0, 16)}`, fontSize: 5.8, color: '#68758b' },
      { text: `${documentCopyLabel(snapshot.approval.status)} • Sayfa ${page} / ${pages}`, alignment: 'right', bold: true, fontSize: 5.8, color: '#68758b' }
    ] }),
    content: [
      { table: { widths: ['*', '*', '*', '*'], body: [
        [metaCell('PROJE / APQP', snapshot.product.projectCode), metaCell('OEM NO / KURULUŞ KODU', `${snapshot.product.partNumber} / ${snapshot.product.internalProductCode}`), metaCell('MAMUL / ÜRÜN GRUBU', `${snapshot.product.partName} / ${snapshot.product.productGroupLabel}`), metaCell('TEKNİK RESİM / REVİZYON', `${snapshot.product.drawingNumber} / ${snapshot.product.drawingRevision}`)],
        [metaCell('PFMEA KİMLİK / REVİZYON', `${profile.fmeaId || pfmeaNumber} / ${profile.revision || snapshot.product.drawingRevision}`), metaCell('5T AMAÇ / ZAMANLAMA', `${profile.intent || '—'} / ${profile.timing || '—'}`), metaCell('5T EKİP / MODERATÖR', `${profile.team || snapshot.product.coreTeam} / ${profile.coordinator || '—'}`), metaCell('5T GÖREV / ARAÇ', `${profile.task || '—'} / ${profile.tool || '—'}`)],
        [metaCell('YAPI / FONKSİYON REF.', `${profile.structureAnalysisRef || '—'} / ${profile.functionAnalysisRef || '—'}`), metaCell('S-O-D/AP TABLO REF.', profile.ratingTableRef || '—'), metaCell('SONUÇ RAPORU / YÖNETİM', `${profile.resultReportRef || '—'} / ${profile.managementReview || '—'}`), metaCell('ÜRETİM / SNAPSHOT', `${generatedAt} / ${snapshot.sha256.slice(0, 24)}`)]
      ] }, layout: tableLayout, margin: [0, 0, 0, 4] },
      { table: { headerRows: 1, dontBreakRows: false, widths: [30, 145, 125, 112, 105, 105, 100, 135, 88, '*'], body: [[
        'OP.', 'YAPI / 3 SEVİYE FONKSİYON', '3 KATMANLI ETKİ / S', 'HATA TÜRÜ / NEDEN', 'ÖNLEME / O', 'TESPİT / D', 'AP / ÖZEL / GEREKÇE', 'OPTİMİZASYON / REAKSİYON', 'SORUMLU / TARİH / DURUM', 'AKSİYON SONRASI RİSK / KANIT / CP'
      ].map(headerCell), ...riskRows] }, layout: tableLayout },
      { text: 'PFMEA 7-ADIM NESNEL KANIT KÜTÜĞÜ', pageBreak: 'before', bold: true, fontSize: 13, color: '#10213f', margin: [0, 0, 0, 6] },
      { table: { headerRows: 1, widths: [42, 46, 320, 62, '*', 110], body: [[
        'SORU', 'ADIM', 'DENETİM SORUSU', 'KARAR', 'NESNEL KANIT / REFERANS', 'SORUMLU / TERMİN'
      ].map(headerCell), ...auditRows] }, layout: tableLayout },
      { text: 'Not: S-O-D ve Action Priority (AP) değerleri yetkili disiplinler arası ekip tarafından, kuruluşun kontrollü/lisanslı FMEA referansına göre doğrulanır. “generated-draft” satırlar kaynak PFMEA değildir; proses rotası ve mühendislik risk kütüphanesinden üretilmiş taslaktır. Tamamlandı durumu; fiili tarih, etkinlik kanıtı ve aksiyon sonrası yeniden değerlendirme olmadan uygun kabul edilmez.', fontSize: 5.8, color: '#4e5c72', margin: [2, 5, 2, 0] }
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
  const result = await saveBlob(blob, fileName, exportFileTypes.pdf, { ppapKey: 'pfmea', documentType: 'PFMEA PDF', snapshotId: snapshot.snapshotId, revision: snapshot.product.drawingRevision });
  if (result.saved) toast('Kontrollü PFMEA PDF kaydedildi', `A3 yatay • ${snapshot.pfmea.length} risk satırı • S-O-D-AP ve aksiyon kanıt zinciri • ${documentCopyLabel(snapshot.approval.status)}`);
  return result;
}

async function exportPfmeaXlsx() {
  if (!pfmeaRows.length) { toast('PFMEA Excel oluşturulamadı', 'En az bir PFMEA risk satırı ekleyin.'); return; }
  if (!globalThis.ExcelJS) { toast('Excel motoru yüklenemedi', 'Uygulama paketini yeniden yükleyin.'); return; }
  if (!ensureDocumentExportReady()) return;
  const snapshot = await getDocumentationSnapshot();
  const profile = snapshot.fmeaGovernance?.profiles?.pfmea || {};
  const workbook = new ExcelJS.Workbook();
  workbook.creator = `${tenantProductName()} • Eren`;
  workbook.created = new Date(snapshot.generatedAt);
  workbook.modified = new Date();
  workbook.properties.date1904 = false;
  workbook.calcProperties.fullCalcOnLoad = true;

  const thin = {
    top: { style: 'thin', color: { argb: 'FF8090A5' } },
    left: { style: 'thin', color: { argb: 'FF8090A5' } },
    bottom: { style: 'thin', color: { argb: 'FF8090A5' } },
    right: { style: 'thin', color: { argb: 'FF8090A5' } }
  };
  const fill = (cell, color) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }; };
  const styleHeader = (cell, color = 'FF10213F') => {
    fill(cell, color); cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cell.border = thin;
  };
  const styleData = (cell, rowIndex, center = false) => {
    fill(cell, rowIndex % 2 ? 'FFF7F9FC' : 'FFFFFFFF');
    cell.font = { name: 'Arial', size: 8, color: { argb: 'FF203750' } };
    cell.alignment = { horizontal: center ? 'center' : 'left', vertical: 'top', wrapText: true };
    cell.border = thin;
  };
  const safe = value => safeExcelValue(value ?? '');
  const sheet = workbook.addWorksheet('PFMEA Formu', { views: [{ state: 'frozen', ySplit: 8, xSplit: 4 }] });
  const headers = [
    'Proses Parçası / Sistem', 'Proses Adımı / İstasyon', '4M Tipi', 'Proses Çalışma Öğesi',
    'Proses Parçası Fonksiyonu', 'Proses Adımı / Ürün Karakteristiği Fonksiyonu', 'Çalışma Öğesi / Proses Karakteristiği Fonksiyonu',
    'Kuruluş Sahasındaki Etki', 'Sevk Edilen Sahadaki Etki', 'Son Kullanıcı / Araç Etkisi', 'S',
    'Proses Adımının Hata Türü', 'Çalışma Öğesinin Hata Nedeni',
    'Mevcut Önleme Kontrolü', 'O', 'Mevcut Tespit Kontrolü', 'D', 'AP', 'Özel Karakteristik', 'Filtre Kodu',
    'Önlemeye Yönelik Aksiyon', 'Tespit Etmeye Yönelik Aksiyon', 'Sorumlu', 'Hedef Tarih', 'Durum',
    'Kanıtları ile Alınan Aksiyonlar', 'Tamamlanma Tarihi', 'Yeni S', 'Yeni O', 'Yeni D', 'Yeni AP', 'Notlar',
    'Operasyon No', 'BOM / Bileşen ID', 'Kontrol Planı / Karakteristik ID', 'S-O-D/AP Tablo Ref.',
    'Puan Gerekçesi', 'Risk Kabul / Uygulanmadı Ref.', 'FMEA Kimlik No', 'Kütüphane Risk ID', 'İçerik Kökeni'
  ];
  const columnWidths = [24, 25, 12, 24, 28, 30, 30, 28, 28, 28, 6, 28, 30, 30, 6, 30, 6, 7, 12, 12, 30, 30, 20, 13, 18, 30, 13, 7, 7, 7, 8, 24, 11, 20, 22, 22, 30, 24, 18, 18, 18];
  sheet.columns = columnWidths.map(width => ({ width }));
  sheet.mergeCells(1, 1, 1, headers.length);
  const title = sheet.getCell(1, 1);
  title.value = 'PROSES FMEA / PROCESS FAILURE MODE AND EFFECTS ANALYSIS';
  fill(title, 'FF0A2B55'); title.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  title.alignment = { horizontal: 'center', vertical: 'middle' }; title.border = thin; sheet.getRow(1).height = 34;

  const meta = [
    ['Kuruluş / Saha', `${snapshot.product.supplierName} / ${snapshot.product.supplierSite}`, 'Müşteri / Program', `${snapshot.product.customer} / ${snapshot.product.projectCode}`, 'PFMEA Kimlik No', profile.fmeaId || `${snapshot.product.projectCode}-PFMEA`],
    ['Konu / Ürün', `${profile.subject || snapshot.product.partName} / OEM ${snapshot.product.partNumber}`, 'Başlangıç / Anahtar Tarih', `${profile.startDate || snapshot.product.originalDate} / ${profile.keyDate || '—'}`, 'Revizyon / Tarih', `${profile.revision || snapshot.product.drawingRevision} / ${profile.revisionDate || snapshot.product.revisionDate}`],
    ['5T Amaç', profile.intent || '—', '5T Zamanlama / Görev', `${profile.timing || '—'} / ${profile.task || '—'}`, 'Araç / Gizlilik', `${profile.tool || '—'} / ${profile.confidentiality || '—'}`],
    ['Ekip / Moderatör', `${profile.team || '—'} / ${profile.coordinator || '—'}`, 'Yapı / Fonksiyon Ref.', `${profile.structureAnalysisRef || '—'} / ${profile.functionAnalysisRef || '—'}`, 'Puan Tablosu / Sonuç Raporu', `${profile.ratingTableRef || '—'} / ${profile.resultReportRef || '—'}`]
  ];
  meta.forEach((items, metaIndex) => {
    const row = 2 + metaIndex;
    const spans = [[1, 3], [4, 11], [12, 14], [15, 24], [25, 28], [29, headers.length]];
    spans.forEach(([from, to], index) => {
      sheet.mergeCells(row, from, row, to);
      const cell = sheet.getCell(row, from); cell.value = safe(items[index]);
      cell.border = thin; cell.alignment = { vertical: 'middle', wrapText: true };
      if (index % 2 === 0) { fill(cell, 'FFDCE8F5'); cell.font = { name: 'Arial', size: 7.5, bold: true, color: { argb: 'FF1D466D' } }; }
      else { fill(cell, 'FFFFFFFF'); cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF162F4A' } }; }
    });
    sheet.getRow(row).height = 25;
  });
  sheet.mergeCells('A6:AO6'); sheet.getCell('A6').value = 'S-O-D ve Action Priority değerleri yetkili çok disiplinli ekip tarafından kuruluşça kontrollü/lisanslı tablolarla seçilir. Bu dosya otomatik uygunluk veya sertifika beyanı değildir.';
  fill(sheet.getCell('A6'), 'FFFFF4D6'); sheet.getCell('A6').font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF7B5714' } }; sheet.getCell('A6').alignment = { wrapText: true, vertical: 'middle' }; sheet.getCell('A6').border = thin; sheet.getRow(6).height = 25;
  const groups = [
    [1, 4, 'YAPI ANALİZİ • ADIM 2', 'FF1D5A91'],
    [5, 7, 'FONKSİYON ANALİZİ • ADIM 3', 'FF287A72'],
    [8, 13, 'HATA ANALİZİ • ADIM 4', 'FF9A5A1B'],
    [14, 20, 'RİSK ANALİZİ • ADIM 5', 'FF8A3F4D'],
    [21, 32, 'OPTİMİZASYON • ADIM 6', 'FF5C4B9D'],
    [33, 41, 'İZLENEBİLİRLİK / KANIT', 'FF36566F']
  ];
  groups.forEach(([from, to, label, color]) => { sheet.mergeCells(7, from, 7, to); const cell = sheet.getCell(7, from); cell.value = label; styleHeader(cell, color); });
  sheet.getRow(7).height = 24;
  headers.forEach((header, index) => { const cell = sheet.getCell(8, index + 1); cell.value = header; styleHeader(cell); });
  sheet.getRow(8).height = 66;

  const componentName = row => row.componentId === 'FINISHED_GOOD'
    ? snapshot.product.partName
    : snapshot.components.find(item => item.id === row.componentId)?.name || row.componentId || '—';
  (snapshot.pfmea || pfmeaRows).forEach((row, rowOffset) => {
    const excelRow = 9 + rowOffset;
    const values = [
      row.processItem || componentName(row), row.processStep, PFMEA_WORK_ELEMENT_TYPES.find(([value]) => value === row.workElementType)?.[1] || row.workElementType,
      row.workElement, row.processItemFunction, row.functionText, row.workElementFunction,
      row.effectOwnPlant, row.effectShipToPlant, row.effectEndUser || row.effect, row.severity,
      row.failureMode, row.cause, row.preventionControl, row.occurrence, row.detectionControl, row.detection, row.ap,
      row.specialCharacteristic, row.filterCode, row.preventionAction || row.recommendedAction, row.detectionAction, row.owner, row.dueDate, row.status,
      row.actionEvidence || row.evidence, row.actionCompletionDate, row.resultSeverity, row.resultOccurrence, row.resultDetection, row.resultAp, row.notes,
      row.operationNo, `${row.componentId || '—'} / ${componentName(row)}`, row.controlPlanRowId || row.controlPlanCharacteristicId,
      row.ratingTableRef, [row.severityRationale, row.occurrenceRationale, row.detectionRationale, row.ratingsRationale].filter(Boolean).join(' • '),
      row.riskAcceptanceRef, profile.fmeaId || `${snapshot.product.projectCode}-PFMEA`, row.libraryRiskId, row.contentOrigin
    ];
    values.forEach((value, index) => {
      const cell = sheet.getCell(excelRow, index + 1); cell.value = safe(value);
      styleData(cell, excelRow, [3, 11, 15, 17, 18, 19, 24, 25, 27, 28, 29, 30, 31, 33].includes(index + 1));
    });
    const apCell = sheet.getCell(excelRow, 18); fill(apCell, row.ap === 'H' ? 'FFF8D7DA' : row.ap === 'M' ? 'FFFFF1C7' : row.ap === 'L' ? 'FFDFF3E8' : 'FFEEF1F5'); apCell.font = { name: 'Arial', size: 9, bold: true };
    const resultApCell = sheet.getCell(excelRow, 31); fill(resultApCell, row.resultAp === 'H' ? 'FFF8D7DA' : row.resultAp === 'M' ? 'FFFFF1C7' : row.resultAp === 'L' ? 'FFDFF3E8' : 'FFEEF1F5');
    const statusCell = sheet.getCell(excelRow, 25); fill(statusCell, pfmeaResultComplete(row) ? 'FFDFF3E8' : row.status === 'Uygulama Bekleniyor' ? 'FFFFF1C7' : 'FFF8E8E8');
    sheet.getRow(excelRow).height = 82;
  });
  const lastDataRow = Math.max(9, 8 + (snapshot.pfmea || pfmeaRows).length);
  sheet.autoFilter = { from: { row: 8, column: 1 }, to: { row: lastDataRow, column: headers.length } };
  sheet.dataValidations.add(`C9:C${lastDataRow}`, { type: 'list', allowBlank: false, formulae: ['"İnsan,Makine,Metot,Malzeme"'] });
  for (const column of ['K', 'O', 'Q', 'AB', 'AC', 'AD']) sheet.dataValidations.add(`${column}9:${column}${lastDataRow}`, { type: 'whole', operator: 'between', allowBlank: true, formulae: [1, 10] });
  for (const column of ['R', 'AE']) sheet.dataValidations.add(`${column}9:${column}${lastDataRow}`, { type: 'list', allowBlank: true, formulae: ['"H,M,L"'] });
  sheet.dataValidations.add(`Y9:Y${lastDataRow}`, { type: 'list', allowBlank: false, formulae: ['"Açık,Karar Bekleniyor,Uygulama Bekleniyor,Tamamlandı,Uygulanmadı"'] });
  sheet.pageSetup = { paperSize: 8, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.2, right: 0.2, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
  sheet.pageSetup.printArea = `A1:AO${lastDataRow}`;
  sheet.headerFooter.oddHeader = `&C&B${safeExcelHeaderFooter(tenantProductName())} • PFMEA`;
  sheet.headerFooter.oddFooter = `&L${safeExcelHeaderFooter(snapshot.product.projectCode)} / ${safeExcelHeaderFooter(profile.revision || snapshot.product.drawingRevision)}&R&P / &N`;
  sheet.printTitlesRow = '1:8'; sheet.properties.defaultRowHeight = 22;

  const evidenceSheet = workbook.addWorksheet('7 Adım Kanıtı', { views: [{ state: 'frozen', ySplit: 2 }] });
  evidenceSheet.columns = [12, 10, 58, 14, 22, 45, 20, 14].map(width => ({ width }));
  evidenceSheet.mergeCells('A1:H1'); evidenceSheet.getCell('A1').value = 'PFMEA 7 ADIM NESNEL KANIT KÜTÜĞÜ'; styleHeader(evidenceSheet.getCell('A1'), 'FF0A2B55'); evidenceSheet.getCell('A1').font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FFFFFFFF' } }; evidenceSheet.getRow(1).height = 30;
  ['Soru', 'Adım', 'Denetim Sorusu', 'Zorunluluk', 'Karar', 'Nesnel Kanıt / Referans', 'Sorumlu', 'Termin'].forEach((value, index) => { const cell = evidenceSheet.getCell(2, index + 1); cell.value = value; styleHeader(cell); });
  const evidenceRows = snapshot.fmeaGovernance?.questionCatalog?.pfmea || [];
  evidenceRows.forEach((row, index) => {
    const values = [row.id, row.step, row.text, row.required ? 'Zorunlu' : 'İyi uygulama', row.disposition, row.evidence, row.owner, row.dueDate];
    values.forEach((value, column) => { const cell = evidenceSheet.getCell(index + 3, column + 1); cell.value = safe(value); styleData(cell, index + 3, [1, 2, 4, 5, 8].includes(column + 1)); });
    evidenceSheet.getRow(index + 3).height = 38;
  });
  const lastEvidenceRow = Math.max(3, evidenceRows.length + 2);
  evidenceSheet.autoFilter = `A2:H${lastEvidenceRow}`; evidenceSheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printArea: `A1:H${lastEvidenceRow}` };
  evidenceSheet.printTitlesRow = '1:2';

  const profileSheet = workbook.addWorksheet('FMEA Profili');
  profileSheet.columns = [{ width: 34 }, { width: 95 }];
  profileSheet.mergeCells('A1:B1'); profileSheet.getCell('A1').value = 'PFMEA PLANLAMA, 5T VE KAYNAK PROFİLİ'; styleHeader(profileSheet.getCell('A1'), 'FF0A2B55'); profileSheet.getCell('A1').font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  const profileRows = [
    ['FMEA türü / kaynak', `${profile.basis || '—'} / ${profile.sourceId || '—'}`], ['Amaç / Intent', profile.intent], ['Zamanlama / Timing', profile.timing],
    ['Ekip / Team', profile.team], ['Görev / Task', profile.task], ['Araç / Tool', profile.tool], ['Analiz sınırı', profile.scope], ['Müşteri özel şartı', profile.customerRequirements],
    ['Öğrenilmiş dersler', profile.lessonsLearned], ['Yapı analizi ref.', profile.structureAnalysisRef], ['Fonksiyon analizi ref.', profile.functionAnalysisRef],
    ['S-O-D/AP tablo ref.', profile.ratingTableRef], ['Sonuç raporu ref.', profile.resultReportRef], ['Yönetim gözden geçirme', profile.managementReview],
    ['Snapshot SHA-256', snapshot.sha256], ['Üretim tarihi', snapshot.generatedAt], ['Kopya durumu', documentCopyLabel(snapshot.approval.status)]
  ];
  profileRows.forEach(([label, value], index) => {
    const row = index + 2; profileSheet.getCell(row, 1).value = safe(label); profileSheet.getCell(row, 2).value = safe(value || '—');
    styleData(profileSheet.getCell(row, 1), row); styleData(profileSheet.getCell(row, 2), row); fill(profileSheet.getCell(row, 1), 'FFDCE8F5'); profileSheet.getCell(row, 1).font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF1D466D' } }; profileSheet.getRow(row).height = 30;
  });
  profileSheet.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printArea: `A1:B${profileRows.length + 1}` };

  const traceSheet = workbook.addWorksheet('İzlenebilirlik');
  traceSheet.columns = [18, 16, 22, 28, 26, 28, 22].map(width => ({ width }));
  traceSheet.mergeCells('A1:G1'); traceSheet.getCell('A1').value = 'PFMEA → PROSES AKIŞI → BOM → KONTROL PLANI İZLENEBİLİRLİK MATRİSİ'; styleHeader(traceSheet.getCell('A1'), 'FF0A2B55'); traceSheet.getCell('A1').font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  ['Risk ID', 'OP', 'Proses Adımı', 'BOM / Bileşen', 'Kontrol Planı ID', 'Özel Karakteristik', 'Durum'].forEach((value, index) => { const cell = traceSheet.getCell(2, index + 1); cell.value = value; styleHeader(cell); });
  (snapshot.pfmea || pfmeaRows).forEach((row, index) => {
    const values = [row.id, row.operationNo, row.processStep, `${row.componentId || '—'} / ${componentName(row)}`, row.controlPlanRowId || row.controlPlanCharacteristicId, row.specialCharacteristic, row.status];
    values.forEach((value, column) => { const cell = traceSheet.getCell(index + 3, column + 1); cell.value = safe(value); styleData(cell, index + 3, [2, 7].includes(column + 1)); }); traceSheet.getRow(index + 3).height = 30;
  });
  const lastTraceRow = Math.max(3, (snapshot.pfmea || pfmeaRows).length + 2);
  traceSheet.autoFilter = `A2:G${lastTraceRow}`;
  traceSheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printArea: `A1:G${lastTraceRow}` };
  traceSheet.printTitlesRow = '1:2';

  const metadataSheet = workbook.addWorksheet('_TYANA_METADATA', { state: 'veryHidden' });
  metadataSheet.columns = [{ width: 30 }, { width: 90 }];
  [
    ['Schema', 'tyana.qflow.pfmea-workbook/v1'],
    ['Ürün', tenantProductName()],
    ['Kuruluş', snapshot.product.supplierName],
    ['Saha', snapshot.product.supplierSite],
    ['Proje / APQP', snapshot.product.projectCode],
    ['PFMEA kimlik no', profile.fmeaId || `${snapshot.product.projectCode}-PFMEA`],
    ['PFMEA revizyonu', profile.revision || snapshot.product.drawingRevision],
    ['Snapshot ID', snapshot.snapshotId],
    ['Snapshot SHA-256', snapshot.sha256],
    ['Üretim zamanı', snapshot.generatedAt],
    ['Kopya durumu', documentCopyLabel(snapshot.approval.status)],
    ['Puan tablosu ref.', profile.ratingTableRef || '—'],
    ['Sonuç raporu ref.', profile.resultReportRef || '—']
  ].forEach(([key, value], index) => {
    metadataSheet.getCell(index + 1, 1).value = safe(key);
    metadataSheet.getCell(index + 1, 2).value = safe(value);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const verification = new ExcelJS.Workbook(); await verification.xlsx.load(buffer);
  const verifiedPfmea = verification.getWorksheet('PFMEA Formu');
  const verifiedEvidence = verification.getWorksheet('7 Adım Kanıtı');
  const verifiedMetadata = verification.getWorksheet('_TYANA_METADATA');
  if (!verifiedPfmea || !verifiedEvidence || !verifiedMetadata || verifiedMetadata.state !== 'veryHidden' || verifiedPfmea.rowCount < 8 + pfmeaRows.length || verifiedPfmea.getCell('A1').value !== 'PROSES FMEA / PROCESS FAILURE MODE AND EFFECTS ANALYSIS') throw new Error('PFMEA Excel yapısal doğrulaması başarısız.');
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  if (blob.size < 10_000) throw new Error('PFMEA Excel byte doğrulaması başarısız.');
  const fileName = `${safeFileName(snapshot.product.projectCode)}_PFMEA_${safeFileName(snapshot.product.partNumber)}_Rev-${safeFileName(profile.revision || snapshot.product.drawingRevision)}.xlsx`;
  const result = await saveBlob(blob, fileName, exportFileTypes.xlsx, { ppapKey: 'pfmea', documentType: 'PFMEA Excel', snapshotId: snapshot.snapshotId, revision: profile.revision || snapshot.product.drawingRevision });
  if (result.saved) toast('Kontrollü PFMEA Excel kaydedildi', `${pfmeaRows.length} risk satırı • 4 görünür çalışma sayfası • kontrollü metadata • veri doğrulama ve denetim kanıtı`);
  return result;
}

document.querySelectorAll('[data-action="export-pfmea-pdf"]').forEach(button => button.addEventListener('click', () => exportPfmeaPdf().catch(error => toast('PFMEA PDF üretilemedi', error.message))));
document.querySelectorAll('[data-action="export-pfmea-xlsx"]').forEach(button => button.addEventListener('click', () => exportPfmeaXlsx().catch(error => toast('PFMEA Excel üretilemedi', error.message))));

function documentationAuditPdfDefinition(snapshot, audit) {
  const headerCell = value => ({ text: value, bold: true, color: '#ffffff', fillColor: '#10213f', alignment: 'center', fontSize: 6.2, margin: [2, 3, 2, 3] });
  const normalCell = (value, options = {}) => ({ text: String(value || '—'), fontSize: 6.2, margin: [2, 2.5, 2, 2.5], ...options });
  const layout = { hLineWidth: () => 0.55, vLineWidth: () => 0.55, hLineColor: () => '#6d7b8e', vLineColor: () => '#6d7b8e' };
  const categoryRows = audit.categories.map((item, index) => {
    const pass = item.status === 'pass';
    return [
      normalCell(item.id, { bold: true, alignment: 'center', fillColor: pass ? '#dff3e8' : '#f8d7da' }),
      normalCell(item.title, { bold: true, fillColor: index % 2 ? '#f7f9fb' : '#ffffff' }),
      normalCell(pass ? 'UYGUN' : 'BLOKE', { bold: true, alignment: 'center', color: pass ? '#176d50' : '#a33131', fillColor: pass ? '#dff3e8' : '#f8d7da' }),
      normalCell(item.evidence),
      normalCell(item.issues.length ? item.issues.join('\n') : 'Nesnel kanıt zinciri mevcut')
    ];
  });
  const evidence = ['dfmea', 'pfmea'].flatMap(kind => (snapshot.fmeaGovernance?.questionCatalog?.[kind] || []).map(row => ({ kind: kind.toUpperCase(), ...row })));
  const evidenceRows = evidence.map(row => {
    const pass = ['PASS', 'NA'].includes(row.disposition) && String(row.evidence || '').trim();
    return [
      normalCell(row.kind, { alignment: 'center', bold: true }),
      normalCell(row.id, { alignment: 'center', bold: true }),
      normalCell(`ADIM ${row.step}`, { alignment: 'center' }),
      normalCell(row.text),
      normalCell(row.disposition || 'OPEN', { alignment: 'center', bold: true, fillColor: pass ? '#dff3e8' : row.disposition === 'FINDING' ? '#f8d7da' : '#fff1c7' }),
      normalCell(row.evidence),
      normalCell(`${row.owner || '—'}\n${row.dueDate || '—'}`)
    ];
  });
  return {
    pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [22, 58, 22, 28],
    header: () => ({ margin: [22, 13, 22, 0], table: { widths: [105, '*', 135], body: [[
      { text: `${snapshot.tenant?.shortName || tenantShortName()}\n${snapshot.tenant?.productName || tenantProductName()}`, bold: true, color: '#2f6fed', alignment: 'center', fontSize: 8, margin: [0, 6] },
      { text: 'DOKÜMANTASYON TUTARLILIK VE DENETİM KANIT RAPORU', bold: true, alignment: 'center', fontSize: 13, margin: [0, 8, 0, 5] },
      { text: `${snapshot.product.projectCode}\nRev. ${snapshot.product.drawingRevision} • ${audit.score}%`, bold: true, alignment: 'center', fontSize: 7, margin: [0, 6] }
    ]] }, layout }),
    background: (_page, pageSize) => ({ canvas: [{ type: 'rect', x: 12, y: 12, w: pageSize.width - 24, h: pageSize.height - 24, lineWidth: 0.9, lineColor: '#30435d' }] }),
    watermark: { text: audit.blocked ? 'BULGULU DENETİM RAPORU' : 'KANIT ZİNCİRİ HAZIR', color: '#aeb9ca', opacity: 0.12, bold: true },
    footer: (page, pages) => ({ margin: [22, 4, 22, 0], columns: [
      { text: `${snapshot.product.projectCode} • ${snapshot.product.partNumber} • SHA ${snapshot.sha256.slice(0, 16)}`, fontSize: 5.8, color: '#68758b' },
      { text: `Denetim: ${new Date(audit.generatedAt).toLocaleString('tr-TR')} • Sayfa ${page}/${pages}`, alignment: 'right', fontSize: 5.8, color: '#68758b' }
    ] }),
    content: [
      { columns: [
        { width: '*', stack: [{ text: 'ÜRÜN / DOKÜMAN KAPSAMI', bold: true, color: '#10213f', fontSize: 8 }, { text: `${snapshot.product.partName} • OEM ${snapshot.product.partNumber} • İç kod ${snapshot.product.internalProductCode}\nTeknik resim ${snapshot.product.drawingNumber} / Rev. ${snapshot.product.drawingRevision} • Kontrol Planı ${snapshot.product.controlPlanNumber}`, fontSize: 7, color: '#465870', margin: [0, 4, 0, 0] }] },
        { width: 170, table: { widths: ['*', '*', '*'], body: [[
          { stack: [{ text: `${audit.score}%`, bold: true, color: '#14796f', fontSize: 16 }, { text: 'UYGUNLUK', fontSize: 5.5 }] },
          { stack: [{ text: audit.pass, bold: true, color: '#176d50', fontSize: 16 }, { text: 'UYGUN KAPI', fontSize: 5.5 }] },
          { stack: [{ text: audit.blocked, bold: true, color: '#a33131', fontSize: 16 }, { text: 'BLOKE KAPI', fontSize: 5.5 }] }
        ]] }, layout }
      ], margin: [0, 0, 0, 7] },
      { table: { headerRows: 1, widths: [45, 135, 55, 150, '*'], body: [[
        'KAPI', 'DENETLENEN BAĞLANTI', 'SONUÇ', 'KANIT ÖZETİ', 'BULGU / YAYIN ENGELİ'
      ].map(headerCell), ...categoryRows] }, layout },
      { text: 'FMEA 7-ADIM NESNEL KANIT KÜTÜĞÜ', pageBreak: 'before', bold: true, color: '#10213f', fontSize: 12, margin: [0, 0, 0, 6] },
      { table: { headerRows: 1, widths: [48, 40, 42, 255, 62, '*', 95], body: [[
        'FMEA', 'SORU', 'ADIM', 'DENETİM SORUSU', 'KARAR', 'KANIT / REFERANS', 'SORUMLU / TERMİN'
      ].map(headerCell), ...evidenceRows] }, layout },
      { text: 'Bu rapor yazılımın otomatik sertifika veya uygunluk beyanı değildir. Bulgular yetkili çok disiplinli ekip tarafından güncel lisanslı standartlar, müşteri özel şartları, teknik resim ve kuruluş prosedürleriyle kapatılmalıdır.', fontSize: 6, color: '#4e5c72', margin: [2, 6, 2, 0] }
    ], defaultStyle: { font: 'Roboto' }
  };
}

async function exportDocumentationAuditPdf() {
  if (!globalThis.pdfMake) { toast('PDF motoru yüklenemedi', 'Uygulama paketini yeniden yükleyin.'); return; }
  const audit = renderDocumentationAudit() || documentationAuditSnapshot();
  const snapshot = await getDocumentationSnapshot();
  const fileName = `${safeFileName(snapshot.product.projectCode)}_Dokumantasyon_Denetim_Kaniti_Rev-${safeFileName(snapshot.product.drawingRevision)}.pdf`;
  const blob = await pdfBlob(documentationAuditPdfDefinition(snapshot, audit));
  if (blob.size < 1024) throw new Error('Denetim kanıt PDF byte doğrulaması başarısız.');
  const result = await saveBlob(blob, fileName, exportFileTypes.pdf, { documentType: 'Dokümantasyon Tutarlılık ve Denetim Kanıt Raporu', snapshotId: snapshot.snapshotId, revision: snapshot.product.drawingRevision });
  if (result.saved) toast('Denetim kanıt raporu kaydedildi', `${audit.score}% zincir uygunluğu • ${audit.blocked} bloke kapı • ${audit.fmeaEvidence} FMEA kanıtı`);
  return result;
}

document.querySelectorAll('[data-action="refresh-document-audit"]').forEach(button => button.addEventListener('click', () => {
  const audit = renderDocumentationAudit();
  toast('Doküman zinciri yeniden denetlendi', audit.blocked ? `${audit.blocked} bloke kalite kapısı bulundu.` : 'Tüm çapraz doküman kapıları uygun.');
}));
document.querySelectorAll('[data-action="export-audit-pdf"]').forEach(button => button.addEventListener('click', () => exportDocumentationAuditPdf().catch(error => toast('Denetim kanıt PDF üretilemedi', error.message))));

function flowPdfDefinition(snapshot) {
  const palette = {
    navy: '#10213F', deepBlue: '#153A73', blue: '#245CC7', brightBlue: '#2F6FED',
    paleBlue: '#F2F6FF', teal: '#187F78', paleTeal: '#EEF9F4', amber: '#B87916',
    paleAmber: '#FFF6E8', slate: '#526781', paleSlate: '#F1F4F8', ink: '#17243A',
    muted: '#68758B', line: '#718097', white: '#FFFFFF'
  };
  const product = snapshot.product || {};
  const approval = snapshot.approval || {};
  const technical = snapshot.technical || {};
  const standards = snapshot.standardsProfile || {};
  const route = Array.isArray(snapshot.route) ? snapshot.route : [];
  const components = Array.isArray(snapshot.components) ? snapshot.components : [];
  const componentById = new Map(components.map(component => [component.id, component]));
  const snapshotMaterialSummary = (limit = 2) => {
    if (!components.length) return 'Tek parça mamul • üst seviye şartlar';
    const items = components.slice(0, limit).map(item => `${item.position || '—'} ${item.name || 'Bileşen'}: ${item.materialGrade || 'Malzeme tanımlanacak'}`);
    if (components.length > limit) items.push(`+${components.length - limit} kalem`);
    return items.join(' • ');
  };
  const compact = (value, limit = 110, fallback = '—') => {
    const text = String(value || fallback).replace(/\s+/g, ' ').trim();
    return text.length > limit ? `${text.slice(0, Math.max(1, limit - 1)).trimEnd()}…` : text;
  };
  const boundedText = (value, limit = 600, fallback = '—') => {
    const text = String(value || fallback).replaceAll('\u0000', '').replace(/\r\n?/g, '\n').trim();
    return text.length > limit ? `${text.slice(0, Math.max(1, limit - 1)).trimEnd()}…` : text;
  };
  const normalize = value => String(value || '').toLocaleLowerCase('tr-TR');
  const documentNo = `${compact(product.projectCode, 40, 'TYANA-QFLOW')}-PFD-001`;
  const revision = compact(product.drawingRevision, 12);
  const issueDate = compact(product.revisionDate || product.originalDate || String(snapshot.generatedAt || '').slice(0, 10), 20);
  const copyLabel = documentCopyLabel(approval.status);
  const isControlled = copyLabel === 'KONTROLLÜ KOPYA';
  const cardWidth = 580;
  const cardHeight = 66;
  const flowPageSize = 9;
  const chunkedRoute = [];
  for (let index = 0; index < route.length; index += flowPageSize) chunkedRoute.push(route.slice(index, index + flowPageSize));
  if (!chunkedRoute.length) chunkedRoute.push([]);

  const kindFor = step => {
    const haystack = normalize(`${step.processId} ${step.name} ${step.family} ${step.category}`);
    if (haystack.includes('depo') || haystack.includes('warehouse') || haystack.includes('stok') || step.processId === 'storage') return 'warehouse';
    if (normalize(step.category).includes('kontrol') || ['incoming', 'final', 'eol', 'ndt', 'leaktest'].includes(step.processId)) return 'quality';
    if (step.special || normalize(step.category).includes('özel')) return 'special';
    if (normalize(step.category).includes('lojistik')) return 'logistics';
    return 'operation';
  };
  const kindStyle = kind => ({
    quality: { stroke: palette.teal, fill: palette.paleTeal, title: palette.teal, label: 'KALİTE / KONTROL' },
    warehouse: { stroke: palette.slate, fill: palette.paleSlate, title: palette.deepBlue, label: 'DEPO / STOK' },
    special: { stroke: palette.amber, fill: palette.paleAmber, title: palette.deepBlue, label: 'ÖZEL PROSES' },
    logistics: { stroke: palette.slate, fill: palette.paleSlate, title: palette.deepBlue, label: 'LOJİSTİK' },
    operation: { stroke: palette.blue, fill: palette.paleBlue, title: palette.deepBlue, label: 'OPERASYON' }
  }[kind] || { stroke: palette.blue, fill: palette.paleBlue, title: palette.deepBlue, label: 'OPERASYON' });

  const iconKeyFor = step => {
    const haystack = normalize(`${step.processId} ${step.name} ${step.family}`);
    if (haystack.includes('girdi') || haystack.includes('incoming')) return 'clipboard';
    if (haystack.includes('depo') || haystack.includes('stok') || haystack.includes('warehouse')) return 'warehouse';
    if (haystack.includes('kesme') || haystack.includes('cutting')) return 'saw';
    if (haystack.includes('dövme') || haystack.includes('forging') || haystack.includes('presleme') || haystack.includes('stamping')) return 'hammer';
    if (haystack.includes('delik') || haystack.includes('drilling') || haystack.includes('rayba')) return 'drill';
    if (haystack.includes('torn') || haystack.includes('cnc')) return 'lathe';
    if (haystack.includes('freze') || haystack.includes('diş aç') || haystack.includes('thread') || haystack.includes('taşlama') || haystack.includes('grinding')) return 'gear';
    if (haystack.includes('çapak') || haystack.includes('deburr') || haystack.includes('kumlama') || haystack.includes('shotblast')) return 'brush';
    if (haystack.includes('ısıl') || haystack.includes('sertleşt') || haystack.includes('heat') || haystack.includes('induction') || haystack.includes('ısıtma')) return 'flame';
    if (haystack.includes('kaplama') || haystack.includes('coating') || haystack.includes('boya') || haystack.includes('painting')) return 'spray';
    if (haystack.includes('yıkama') || haystack.includes('washing') || haystack.includes('sızdır') || haystack.includes('leak')) return 'drop';
    if (haystack.includes('kaynak') || haystack.includes('welding')) return 'weld';
    if (haystack.includes('montaj') || haystack.includes('assembly') || haystack.includes('tork') || haystack.includes('yapıştır')) return 'assembly';
    if (haystack.includes('markalama') || haystack.includes('marking') || haystack.includes('lazer')) return 'laser';
    if (haystack.includes('paket') || haystack.includes('packing')) return 'box';
    if (haystack.includes('sevk') || haystack.includes('lojistik')) return 'truck';
    if (kindFor(step) === 'quality') return 'quality';
    return 'gear';
  };

  const iconSvg = (step, color) => {
    const bodies = {
      clipboard: '<rect x="12" y="10" width="24" height="30" rx="3"/><path d="M19 10v-2h10v2M17 19l3 3 6-7M17 29l3 3 6-7M28 20h5M28 30h5"/>',
      warehouse: '<path d="M7 20L24 8l17 12v21H7zM12 20h24M14 27h8v14h-8zM26 27h8v6h-8zM26 36h8v5h-8z"/>',
      saw: '<circle cx="24" cy="24" r="12"/><circle cx="24" cy="24" r="3"/><path d="M12 16l-4-2 2 5-4 2 5 2-3 4 5-1M11 37h27M15 33h20"/>',
      hammer: '<path d="M9 37h30M14 31h20l4 6H10zM17 17l12 12M13 18l8-8 7 7-8 8zM27 12l5-5 9 9-5 5"/>',
      drill: '<path d="M19 6h10l-2 6h-6zM22 12h4v14l-2 4-2-4zM17 32h14M13 38h22M20 27l-5 6M28 27l5 6"/>',
      lathe: '<path d="M6 35h36M9 31h30M10 15h9v14h-9zM19 20h12M31 16v13M35 18h6v9h-6M13 10h4M14 14v15"/><circle cx="15" cy="22" r="4"/>',
      gear: '<circle cx="24" cy="24" r="9"/><circle cx="24" cy="24" r="3"/><path d="M24 7v5M24 36v5M7 24h5M36 24h5M12 12l4 4M32 32l4 4M36 12l-4 4M16 32l-4 4M20 7h8M20 41h8"/>',
      brush: '<path d="M10 34h18l7-8-9-9-8 7zM28 17l6-6 6 6-6 6M8 38h22M36 30l2 3M40 27l3 1M34 35l1 4"/>',
      flame: '<path d="M25 5c3 9-5 10 1 17 3-2 5-6 5-9 7 6 10 13 7 21-3 8-12 10-19 7-9-4-11-15-5-23 0 7 4 8 6 10 2-7-2-12 5-23z"/><path d="M24 27c4 4 4 9 0 13-5-2-7-8 0-13z"/>',
      spray: '<path d="M8 16h17v10H8zM13 12h8v4M25 18h8l5 5-5 4h-8M17 26l-3 14h9l-2-14M39 15l4-2M39 23h5M39 31l4 2"/>',
      drop: '<path d="M24 6S12 20 12 29a12 12 0 0024 0C36 20 24 6 24 6z"/><path d="M19 31c1 4 4 6 8 6"/>',
      weld: '<path d="M8 37h17M12 33l13-13 7 7-10 10M27 18l7-7 4 4-7 7M36 25l5 2M34 30l3 4M39 19l4-2"/>',
      assembly: '<circle cx="18" cy="25" r="8"/><circle cx="18" cy="25" r="3"/><circle cx="33" cy="18" r="6"/><circle cx="33" cy="18" r="2"/><path d="M18 12v5M18 33v5M5 25h5M26 25h5M33 7v5M33 24v5M24 18h3M39 18h4"/>',
      laser: '<path d="M8 35h24M12 31h16v4M30 10l8 8-8 8-8-8zM34 26v5M38 28l3 3M25 28l-3 3M8 13h11M8 18h11M8 23h11"/>',
      box: '<path d="M8 16l16-8 16 8-16 8zM8 16v20l16 8 16-8V16M24 24v20M15 12l17 8"/>',
      truck: '<path d="M6 15h23v20H6zM29 22h8l5 7v6H29zM34 25v5h7M11 35a4 4 0 108 0M31 35a4 4 0 108 0"/>',
      quality: '<circle cx="22" cy="22" r="13"/><path d="M14 22l5 5 11-12M31 32l10 10"/>'
    };
    const body = bodies[iconKeyFor(step)] || bodies.gear;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><g fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
  };

  const shapeSvg = (kind, width = cardWidth, height = cardHeight) => {
    const style = kindStyle(kind);
    const w = width - 2; const h = height - 2;
    let shape = `<rect x="1" y="1" width="${w}" height="${h}" rx="10" fill="${style.fill}" stroke="${style.stroke}" stroke-width="1.7"/>`;
    if (kind === 'quality') shape = `<polygon points="16,1 ${width - 16},1 ${width - 1},${height / 2} ${width - 16},${height - 1} 16,${height - 1} 1,${height / 2}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="1.7"/>`;
    if (kind === 'warehouse') shape = `<polygon points="1,16 26,1 ${width - 26},1 ${width - 1},16 ${width - 1},${height - 1} 1,${height - 1}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="1.7"/>`;
    if (kind === 'special') shape = `<rect x="1" y="1" width="${w}" height="${h}" rx="10" fill="${style.fill}" stroke="${style.stroke}" stroke-width="1.8" stroke-dasharray="7 3"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${shape}</svg>`;
  };

  const arrowNode = () => ({
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cardWidth} 13"><line x1="${cardWidth / 2}" y1="0" x2="${cardWidth / 2}" y2="8" stroke="${palette.deepBlue}" stroke-width="2"/><polygon points="${cardWidth / 2 - 6},7 ${cardWidth / 2 + 6},7 ${cardWidth / 2},13" fill="${palette.deepBlue}"/></svg>`,
    width: cardWidth, height: 13
  });

  const terminalNode = (label, mode = 'start') => {
    const width = 260; const height = 38; const icon = mode === 'finish'
      ? `<circle cx="27" cy="19" r="11" fill="none" stroke="${palette.deepBlue}" stroke-width="1.6"/><path d="M21 19l4 4 8-9" fill="none" stroke="${palette.deepBlue}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<circle cx="27" cy="19" r="11" fill="none" stroke="${palette.deepBlue}" stroke-width="1.6"/><polygon points="24,13 24,25 33,19" fill="${palette.deepBlue}"/>`;
    return { columns: [{ width: '*', text: '' }, { width, stack: [
      { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="18" fill="#FFFFFF" stroke="${palette.deepBlue}" stroke-width="1.8"/>${icon}</svg>`, width, height, margin: [0, 0, 0, -height] },
      { table: { widths: ['*'], heights: [height], body: [[{ text: label, bold: true, color: palette.deepBlue, fontSize: 11.5, alignment: 'center', noWrap: true, margin: [34, 10, 8, 0] }]] }, layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 } }
    ] }, { width: '*', text: '' }], columnGap: 0, unbreakable: true };
  };

  const stepCard = (step, sequenceNo) => {
    const kind = kindFor(step); const style = kindStyle(kind);
    const processSummary = compact(step.operationLabelEN || step.description || step.controlMethod || step.equipment, 104);
    const technicalLine = [step.workcenter || step.machineId || step.equipment, step.controlMethod].filter(Boolean).join(' • ');
    const qualifiers = [step.special && kind !== 'special' ? 'ÖZEL' : '', step.outsource ? 'DIŞ KAYNAK' : ''].filter(Boolean).join(' / ');
    const qualifierText = qualifiers || (kind === 'special' ? 'ONAYLI REÇETE' : kind === 'quality' ? 'DOĞRULAMA' : kind === 'warehouse' ? 'FIFO / STATÜ' : compact(step.family, 24, 'STANDART'));
    return { stack: [
      { svg: shapeSvg(kind), width: cardWidth, height: cardHeight, margin: [0, 0, 0, -cardHeight] },
      { table: { widths: [62, '*', 88], heights: [cardHeight], body: [[
        { svg: iconSvg(step, style.stroke), width: 38, height: 38, alignment: 'center', margin: [11, 14, 0, 0] },
        { stack: [
          { text: `${sequenceNo}. OP ${compact(step.operationNo, 8)}${step.operationCode ? ` • KOD ${compact(step.operationCode, 12)}` : ''} — ${compact(step.operationLabelTR || step.name, 42)}`, bold: true, color: style.title, fontSize: 9.3, noWrap: true },
          { text: processSummary, color: palette.ink, fontSize: 7.25, margin: [0, 3, 0, 0], noWrap: true },
          { text: compact(technicalLine, 116, 'Makine / kontrol yöntemi matriste tanımlıdır.'), color: palette.muted, fontSize: 6.15, margin: [0, 3, 0, 0], noWrap: true }
        ], margin: [2, 8, 4, 0] },
        { stack: [
          { text: style.label, bold: true, color: style.stroke, fontSize: 5.8, alignment: 'center' },
          { text: qualifierText, bold: Boolean(qualifiers), color: qualifiers ? palette.amber : palette.muted, fontSize: 5.2, alignment: 'center', margin: [0, 7, 0, 0] },
          { text: compact(step.responsible || step.owner, 24, 'Sorumlu: rota kaydı'), color: palette.muted, fontSize: 4.9, alignment: 'center', margin: [0, 6, 0, 0] }
        ], margin: [0, 12, 10, 0] }
      ]] }, layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 } }
    ], unbreakable: true };
  };

  const legendShape = kind => ({ svg: shapeSvg(kind, 46, 24), width: 46, height: 24 });
  const legendPanel = (pageIndex, pageCount, firstSequence, lastSequence) => {
    const qualityCount = route.filter(step => kindFor(step) === 'quality').length;
    const specialCount = route.filter(step => kindFor(step) === 'special').length;
    const outsourceCount = route.filter(step => step.outsource).length;
    const legendRows = [
      ['operation', 'Operasyon'], ['quality', 'Kalite / kontrol'], ['special', 'Özel proses'], ['warehouse', 'Depo / stok'], ['logistics', 'Lojistik / sevkiyat']
    ].map(([kind, label]) => ({ columns: [{ width: 54, ...legendShape(kind) }, { text: label, width: '*', fontSize: 7.1, color: palette.ink, margin: [0, 7, 0, 0] }], margin: [0, 0, 0, 8] }));
    legendRows.push({ columns: [{ width: 54, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 46 18"><line x1="4" y1="9" x2="35" y2="9" stroke="${palette.deepBlue}" stroke-width="2"/><polygon points="34,4 44,9 34,14" fill="${palette.deepBlue}"/></svg>`, width: 46, height: 18 }, { text: 'Akış yönü', width: '*', fontSize: 7.1, color: palette.ink, margin: [0, 5, 0, 0] }] });
    const boxLayout = { hLineWidth: index => index === 0 ? 0 : 0.6, vLineWidth: () => 0.6, hLineColor: () => palette.deepBlue, vLineColor: () => palette.deepBlue, paddingLeft: () => 7, paddingRight: () => 7, paddingTop: () => 6, paddingBottom: () => 6 };
    const kpiCell = (value, label, color = palette.deepBlue) => ({ stack: [{ text: String(value), bold: true, fontSize: 13, color, alignment: 'center' }, { text: label, fontSize: 5.2, color: palette.muted, alignment: 'center', margin: [0, 2, 0, 0] }], fillColor: '#F8FAFD', margin: [2, 5, 2, 5] });
    const infoRow = (label, value) => ({ columns: [{ text: label, width: 62, fontSize: 5.4, color: palette.muted }, { text: compact(value, 44), width: '*', bold: true, fontSize: 6.1, color: palette.ink, alignment: 'right' }], margin: [0, 0, 0, 5] });
    return { stack: [
      { table: { widths: ['*'], body: [[{ text: 'LEJANT', bold: true, color: palette.white, fillColor: palette.navy, fontSize: 10.5, alignment: 'center', margin: [0, 5, 0, 5] }], [{ stack: legendRows, fillColor: '#FFFFFF', margin: [5, 4, 5, 2] }]] }, layout: boxLayout },
      { table: { widths: ['*'], body: [[{ text: 'AKIŞ ÖZETİ', bold: true, color: palette.white, fillColor: palette.deepBlue, fontSize: 8.3, alignment: 'center', margin: [0, 4, 0, 4] }], [{ table: { widths: ['*', '*'], body: [[kpiCell(route.length, 'TOPLAM'), kpiCell(qualityCount, 'KONTROL', palette.teal)], [kpiCell(specialCount, 'ÖZEL', palette.amber), kpiCell(outsourceCount, 'DIŞ KAYNAK', palette.amber)]] }, layout: { hLineWidth: () => 0.4, vLineWidth: () => 0.4, hLineColor: () => '#D6DEEA', vLineColor: () => '#D6DEEA', paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 } }]] }, layout: boxLayout, margin: [0, 12, 0, 0] },
      { table: { widths: ['*'], body: [[{ text: 'DOKÜMAN KONTROLÜ', bold: true, color: palette.white, fillColor: palette.navy, fontSize: 8.3, alignment: 'center', margin: [0, 4, 0, 4] }], [{ stack: [
        infoRow('Doküman No', documentNo), infoRow('Revizyon', revision), infoRow('Tarih', issueDate), infoRow('Durum', approval.status), infoRow('Akış sayfası', `${pageIndex + 1} / ${pageCount}`), infoRow('Kapsam', route.length ? `${firstSequence}–${lastSequence} / ${route.length}` : 'Proses yok'), infoRow('Snapshot', String(snapshot.sha256 || '—').slice(0, 16))
      ], fillColor: '#FFFFFF', margin: [2, 2, 2, 0] }]] }, layout: boxLayout, margin: [0, 12, 0, 0] },
      { table: { widths: ['*'], body: [[{ text: 'STANDART PROFİLİ', bold: true, color: palette.white, fillColor: palette.slate, fontSize: 7.7, alignment: 'center', margin: [0, 4, 0, 4] }], [{ text: `${compact(standards.iatf, 34, 'IATF 16949:2016')}\n${compact(standards.apqp, 38, 'AIAG APQP / Control Plan')}\nMüşteri özel şartları proje bazında doğrulanır.`, fontSize: 6.1, color: palette.ink, lineHeight: 1.25, margin: [3, 3, 3, 3] }]] }, layout: boxLayout, margin: [0, 12, 0, 0] },
      { text: 'Görsel akış hızlı proses okuması içindir. Eksiksiz girdi, çıktı, ekipman, fikstür ve kontrol bilgileri bu PDF’nin izlenebilirlik matrisi ekinde korunur.', fontSize: 5.6, color: palette.muted, lineHeight: 1.25, margin: [5, 10, 5, 0] }
    ] };
  };

  const metaCell = (label, value, accent = false) => ({ stack: [
    { text: label, fontSize: 5.2, bold: true, color: palette.muted },
    { text: compact(value, 62), fontSize: 6.6, bold: true, color: accent ? palette.blue : palette.ink, margin: [0, 2, 0, 0] }
  ], fillColor: '#F8FAFD', margin: [5, 4, 5, 4] });
  const metadataTable = () => ({ table: { widths: ['*', '*', '*', '*'], body: [
    [metaCell('PROJE / APQP', product.projectCode, true), metaCell('OEM NO / KURULUŞ KODU', `${product.partNumber} / ${product.internalProductCode}`, true), metaCell('MAMUL / TEKNİK RESİM', `${product.partName} / ${product.drawingNumber} Rev. ${revision}`), metaCell('DOKÜMAN DURUMU', `${approval.status} / ${copyLabel}`)],
    [metaCell('KURULUŞ / SAHA', `${product.supplierName} / ${product.supplierSite}`), metaCell('ÜRÜN GRUBU / FAZ', `${product.productGroupLabel} / ${product.productionPhase}`), metaCell('MAMUL AĞACI', `${components.length} alt kalem • ${snapshotMaterialSummary(2)}`), metaCell('ORTAK ŞART / YÜZEY', `${technical.materialGrade} • ${surfacePerformanceText(technical)}`)]
  ] }, layout: { hLineWidth: () => 0.45, vLineWidth: () => 0.45, hLineColor: () => '#A8B4C5', vLineColor: () => '#A8B4C5', paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 }, margin: [0, 0, 0, 10] });

  const pageTitle = (pageIndex, pageCount) => ({ stack: [
    { columns: [
      { text: `${snapshot.tenant?.shortName || tenantShortName()}  •  ${snapshot.tenant?.productName || tenantProductName()}  •  EREN`, width: '*', bold: true, color: palette.blue, fontSize: 6.6, characterSpacing: 1.1, margin: [0, 1, 0, 0] },
      { text: `AKIŞ ${pageIndex + 1} / ${pageCount}`, width: 88, bold: true, color: palette.white, fillColor: palette.deepBlue, fontSize: 6.4, alignment: 'center', margin: [0, 3, 0, 3] }
    ] },
    { text: 'PARÇA ÜRETİM PROSES AKIŞ ŞEMASI', bold: true, color: palette.navy, fontSize: 22, alignment: 'center', margin: [0, 4, 0, 1] },
    { text: 'PROSES AKIŞ DİYAGRAMI / PROCESS FLOW', bold: true, color: palette.muted, fontSize: 7.4, alignment: 'center', characterSpacing: 0.8 },
    { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 789, y2: 5, lineWidth: 1.2, lineColor: palette.blue }], margin: [0, 2, 0, 6] }
  ] });

  const content = [];
  chunkedRoute.forEach((chunk, pageIndex) => {
    const firstSequence = pageIndex * flowPageSize + 1;
    const lastSequence = firstSequence + Math.max(0, chunk.length - 1);
    const flowStack = [terminalNode(pageIndex === 0 ? 'BAŞLA' : 'ÖNCEKİ SAYFADAN', 'start'), arrowNode()];
    if (!chunk.length) {
      flowStack.push({ table: { widths: ['*'], heights: [70], body: [[{ text: 'Proses rotası henüz tanımlanmadı.', alignment: 'center', bold: true, color: palette.muted, fontSize: 10, margin: [0, 25, 0, 0], fillColor: '#F8FAFD' }]] }, layout: { hLineWidth: () => 0.8, vLineWidth: () => 0.8, hLineColor: () => palette.line, vLineColor: () => palette.line } });
    }
    chunk.forEach((step, localIndex) => {
      flowStack.push(stepCard(step, firstSequence + localIndex));
      flowStack.push(arrowNode());
    });
    flowStack.push(terminalNode(pageIndex === chunkedRoute.length - 1 ? 'BİTİR' : 'SONRAKİ SAYFAYA', pageIndex === chunkedRoute.length - 1 ? 'finish' : 'start'));
    content.push({
      pageBreak: pageIndex ? 'before' : undefined,
      stack: [
        pageTitle(pageIndex, chunkedRoute.length),
        metadataTable(),
        { columns: [
          { width: cardWidth, stack: flowStack },
          { width: '*', stack: [legendPanel(pageIndex, chunkedRoute.length, firstSequence, lastSequence)] }
        ], columnGap: 18 }
      ]
    });
  });

  const detailHeader = ['OP.', 'PROSES / İŞ ELEMANI', 'GİRDİ / BOM BAĞLANTISI', 'ÇIKTI', 'MAKİNE / HAT', 'TAKIM / FİKSTÜR', 'KONTROL / KAYIT', 'TÜR'].map(text => ({ text, bold: true, color: palette.white, fillColor: palette.navy, alignment: 'center', fontSize: 6, margin: [2, 4, 2, 4] }));
  const detailContinuationHeader = [
    { text: `EK A • PROSES İZLENEBİLİRLİK MATRİSİ • ${documentNo} • Rev. ${revision} • ${copyLabel}`, colSpan: 8, bold: true, color: palette.deepBlue, fillColor: '#EAF0FA', fontSize: 6.1, margin: [4, 3, 4, 3] }, {}, {}, {}, {}, {}, {}, {}
  ];
  const detailRows = route.map((step, index) => {
    const inputNames = (step.inputComponentIds || []).map(id => componentById.get(id)?.name || id).join(', ') || step.inputMaterial || 'BOM bağlantısı tanımlanacak';
    const output = step.outputItemId === 'FINISHED_GOOD' ? step.outputMaterial || product.partName : componentById.get(step.outputItemId)?.name || step.outputMaterial || step.outputItemId || 'Çıktı tanımlanacak';
    const fillColor = index % 2 ? '#F5F7FB' : palette.white;
    const cell = (text, bold = false, color = palette.ink) => ({ text: boundedText(text), fontSize: 5.8, bold, color, fillColor, margin: [2.5, 2.8, 2.5, 2.8] });
    return [
      cell(step.operationNo, true, palette.deepBlue),
      cell(`${step.operationCode ? `KOD ${step.operationCode} • ` : ''}${step.operationLabelTR || step.name}\n${step.operationLabelEN || step.description || ''}\nSorumlu: ${step.responsible || step.owner || 'rota kaydı'}`, true),
      cell(inputNames), cell(output),
      cell([step.workcenter, step.machineId || step.equipment, step.programNo].filter(Boolean).join('\n')),
      cell([step.instanceTooling || step.tooling, step.externalControlRef].filter(Boolean).join('\n')),
      cell([step.controlMethod, step.documentRef, step.workInstruction].filter(Boolean).join('\n')),
      cell(`${kindStyle(kindFor(step)).label}${step.outsource ? '\nDIŞ KAYNAK' : ''}`, true, step.outsource ? palette.amber : kindStyle(kindFor(step)).stroke)
    ];
  });
  content.push({
    pageBreak: 'before', pageOrientation: 'landscape',
    stack: [
      { columns: [
        { stack: [{ text: `${snapshot.tenant?.shortName || tenantShortName()}  •  ${snapshot.tenant?.productName || tenantProductName()}  •  EREN`, bold: true, color: palette.blue, fontSize: 6.6, characterSpacing: 1 }, { text: 'OPERASYON GİRDİ / ÇIKTI VE KONTROL MATRİSİ', bold: true, color: palette.navy, fontSize: 18, margin: [0, 4, 0, 0] }, { text: 'EK A — PROSES İZLENEBİLİRLİK DETAYI / PROCESS TRACEABILITY APPENDIX', bold: true, color: palette.muted, fontSize: 6.8, margin: [0, 2, 0, 0] }] },
        { width: 190, table: { widths: ['*'], body: [[{ text: `${documentNo}\nRev. ${revision} • ${approval.status}\n${copyLabel}`, bold: true, color: palette.white, fillColor: palette.deepBlue, fontSize: 7, alignment: 'center', margin: [5, 5, 5, 5] }]] }, layout: 'noBorders' }
      ] },
      { canvas: [{ type: 'line', x1: 0, y1: 6, x2: 1138, y2: 6, lineWidth: 1.2, lineColor: palette.blue }], margin: [0, 2, 0, 8] },
      { table: { widths: ['*', '*', '*', '*'], body: [[metaCell('PROJE / OEM NO', `${product.projectCode} / ${product.partNumber}`, true), metaCell('KURULUŞ KODU / MAMUL', `${product.internalProductCode} / ${product.partName}`), metaCell('RESİM / REVİZYON', `${product.drawingNumber} / ${revision}`), metaCell('PROSES / BOM', `${route.length} operasyon / ${components.length} alt kalem`)]] }, layout: { hLineWidth: () => 0.45, vLineWidth: () => 0.45, hLineColor: () => '#A8B4C5', vLineColor: () => '#A8B4C5', paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 }, margin: [0, 0, 0, 8] },
      { table: { headerRows: 2, keepWithHeaderRows: 1, dontBreakRows: true, widths: [30, 150, 145, 120, 130, 125, '*', 72], body: [detailContinuationHeader, detailHeader, ...detailRows] }, layout: { hLineWidth: () => 0.48, vLineWidth: () => 0.48, hLineColor: () => palette.line, vLineColor: () => palette.line, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 } },
      { columns: [
        { text: `Kaynak snapshot SHA-256: ${snapshot.sha256 || '—'}\nTeknik resim kaynağı SHA-256: ${snapshot.drawingSource?.sha256 || '—'}`, fontSize: 5.6, color: palette.muted, margin: [1, 7, 0, 0] },
        { width: 360, text: 'Not: Görsel akış özeti ile bu matris birlikte kontrollü proses akış dokümanını oluşturur. Değişiklikler revizyon ve onay iş akışından geçirilmelidir.', fontSize: 5.6, color: palette.muted, alignment: 'right', margin: [0, 7, 1, 0] }
      ] }
    ]
  });

  return {
    pageSize: 'A3', pageOrientation: 'portrait', pageMargins: [26, 24, 26, 42],
    background: (_page, pageSize) => ({ canvas: [
      { type: 'rect', x: 10, y: 10, w: pageSize.width - 20, h: pageSize.height - 20, lineWidth: 0.9, lineColor: palette.deepBlue },
      { type: 'line', x1: 18, y1: 17, x2: pageSize.width - 18, y2: 17, lineWidth: 2.2, lineColor: palette.blue }
    ] }),
    watermark: { text: isControlled ? 'KONTROLLÜ KOPYA' : 'TASLAK / TANITIM', color: '#B8C3D4', opacity: 0.09, bold: true },
    content,
    footer: (page, pages) => ({ margin: [26, 5, 26, 0], table: { widths: ['*', 115, 125, 92], body: [[
      { text: `Doküman No: ${documentNo}\nSHA-256: ${String(snapshot.sha256 || '—').slice(0, 20)}`, fontSize: 5.7, color: palette.muted, margin: [3, 3, 3, 1] },
      { text: `Revizyon\n${revision}`, fontSize: 5.7, bold: true, color: palette.ink, alignment: 'center', margin: [3, 3, 3, 1] },
      { text: `Tarih\n${issueDate}`, fontSize: 5.7, bold: true, color: palette.ink, alignment: 'center', margin: [3, 3, 3, 1] },
      { text: `Sayfa\n${page} / ${pages}`, fontSize: 5.7, bold: true, color: palette.ink, alignment: 'center', margin: [3, 3, 3, 1] }
    ]] }, layout: { hLineWidth: index => index === 0 ? 0.8 : 0, vLineWidth: index => index > 0 ? 0.55 : 0, hLineColor: () => palette.deepBlue, vLineColor: () => '#7E8CA2', paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 } }),
    defaultStyle: { font: 'Roboto' }
  };
}

async function exportProcessFlowPdf() {
  if (!ensureDocumentExportReady()) return;
  if (!selected.length) { toast('Proses akış PDF’i oluşturulamadı', 'Rota boş. Ürün omurgasından veya proses kütüphanesinden en az bir operasyon seçin.'); return { saved: false, cancelled: false, method: 'validation', reason: 'empty-route' }; }
  const snapshot = await getDocumentationSnapshot(); const fileName = `${safeFileName(projectCode.value)}_Proses_Akisi_Rev-${safeFileName(drawingRevision.value)}.pdf`; const blob = await pdfBlob(flowPdfDefinition(snapshot));
  const result = await saveBlob(blob, fileName, exportFileTypes.pdf, { ppapKey: 'process-flow', documentType: 'Proses Akış Diyagramı PDF', snapshotId: snapshot.snapshotId, revision: snapshot.product.drawingRevision }); if (result.saved) toast('Ultra proses akış PDF’i kaydedildi', `${snapshot.route.length} operasyon • A3 portre akış + yatay izlenebilirlik matrisi • vektörel ve kontrollü snapshot`);
  return result;
}

document.querySelectorAll('[data-action="export-flow-pdf"]').forEach(button => button.addEventListener('click', () => exportProcessFlowPdf().catch(error => toast('Proses akış PDF üretilemedi', error.message))));

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
  const tenant = snapshot.tenant || tenantSnapshotProfile();
  rect(5, 5, 410, 287, 'FRAME'); text(150, 282, 6, 'PROSES AKIS DIYAGRAMI', 'TITLEBLOCK'); text(8, 283, 3.2, `${tenant.productName || tenantProductName()} / ${tenant.shortName || tenantShortName()}`, 'TITLEBLOCK');
  const route = snapshot.route; const cols = 4; const nodeW = 78; const nodeH = 25; const gapX = 20; const gapY = 18;
  route.forEach((step, index) => {
    const col = index % cols; const row = Math.floor(index / cols); const x = 15 + col * (nodeW + gapX); const y = 245 - row * (nodeH + gapY); const layer = step.category === 'Kontrol' ? 'CONTROL' : 'PROCESS';
    rect(x, y, nodeW, nodeH, layer); text(x + 3, y + 17, 3.2, `OP ${step.operationNo}  ${step.name}`, 'TEXT'); text(x + 3, y + 9, 2.4, step.equipment || step.description, 'TEXT');
    if (col < cols - 1 && index < route.length - 1) { line(x + nodeW, y + nodeH / 2, x + nodeW + gapX - 3, y + nodeH / 2, 'PROCESS'); line(x + nodeW + gapX - 6, y + nodeH / 2 + 2, x + nodeW + gapX - 3, y + nodeH / 2, 'PROCESS'); line(x + nodeW + gapX - 6, y + nodeH / 2 - 2, x + nodeW + gapX - 3, y + nodeH / 2, 'PROCESS'); }
  });
  rect(5, 5, 410, 32, 'TITLEBLOCK'); line(105, 5, 105, 37, 'TITLEBLOCK'); line(245, 5, 245, 37, 'TITLEBLOCK'); line(335, 5, 335, 37, 'TITLEBLOCK'); line(5, 21, 415, 21, 'TITLEBLOCK');
  text(8, 29, 2.5, 'PROJE / APQP'); text(8, 24, 3.5, snapshot.product.projectCode); text(108, 29, 2.5, 'OEM NO / REVIZYON'); text(108, 24, 3.5, `${snapshot.product.partNumber} / ${snapshot.product.drawingRevision}`); text(248, 29, 2.5, 'KURULUS KODU / URUN'); text(248, 24, 3.2, `${snapshot.product.internalProductCode} / ${snapshot.product.partName}`); text(338, 29, 2.5, 'SAYFA'); text(338, 24, 3.5, '1 / 1');
  text(8, 13, 2.5, 'KURULUS / SAHA'); text(8, 8, 3.2, `${snapshot.product.supplierName} / ${snapshot.product.supplierSite}`); text(108, 13, 2.5, 'KONTROL PLANI'); text(108, 8, 3.2, snapshot.product.controlPlanNumber); text(248, 13, 2.5, 'SNAPSHOT SHA-256'); text(248, 8, 2.7, snapshot.sha256.slice(0, 32));
  p(0, 'ENDSEC'); p(0, 'EOF'); return pairs.join('\r\n');
}

async function exportControlPlanDxf() {
  if (!ensureDocumentExportReady()) return;
  if (!requireSelectedProcessRoute('DXF proses akışı')) return;
  const snapshot = await getDocumentationSnapshot(); const dxf = createProcessFlowDxf(snapshot);
  const fileName = `${safeFileName(projectCode.value)}_Proses_Akisi_Rev-${safeFileName(drawingRevision.value)}.dxf`; const blob = new Blob([dxf], { type: 'application/dxf;charset=us-ascii' });
  const result = await saveBlob(blob, fileName, exportFileTypes.dxf, { ppapKey: 'process-flow', documentType: 'Proses Akış Diyagramı DXF', snapshotId: snapshot.snapshotId, revision: snapshot.product.drawingRevision }); if (result.saved) toast('CAD değişim dosyası kaydedildi', `${snapshot.route.length} operasyon • A3 antet • mm • FRAME/PROCESS/CONTROL/TEXT katmanları`);
  return result;
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
  if (family.includes('montaj') || ['assembly', 'integrated-assembly', 'post-paint-assembly', 'torque'].includes(process.id)) return general + assembly;
  return general + (process.special ? special : ' Sızıntı, koruyucu arızası veya uygunsuz ekipmanda proses durdurulur ve sorumluya bildirilir.');
}

function numericParametersForProcess(process, linked, detail) {
  const lines = [];
  lines.push(`Operasyon: OP ${detail.operationNo} | İş merkezi: ${detail.workcenter} | Makine/hat: ${detail.machineId}`);
  lines.push(`Takım/fikstür: ${detail.tooling} | Program/reçete: ${detail.programNo}`);
  if (Number(process.cycleTimeSec) > 0) lines.push(`Planlı çevrim süresi: ${formatValue(process.cycleTimeSec)} sn (kütüphane Rev. ${process.revision || 'A'})`);
  if (Number(process.setupTimeMin) > 0) lines.push(`Planlı hazırlık / kurulum süresi: ${formatValue(process.setupTimeMin)} dk`);
  (detail.inputComponentIds || []).map(id => components.find(component => component.id === id)).filter(Boolean).forEach(component => lines.push(`BOM ${component.position} / ${component.name}: ${component.inputState} → ${component.primaryManufacturingMethod} → ${component.outputState} | ${component.materialGrade} | Resim ${component.drawingNo} Rev. ${component.revision}`));
  linked.forEach(item => lines.push(`${item.id} / Balon ${item.balloon} — ${item.name}: ${specificationFor(item)} | ${item.equipmentClass} / ${item.equipment} | ${item.sampleSize} / ${item.frequency} | ${item.trigger}`));
  pfmeaRows.filter(row => row.routeKey && selectedProcessEntries().find(entry => entry.detail === detail)?.routeKey === row.routeKey).slice(0, 3).forEach(row => lines.push(`PFMEA ${row.libraryRiskId || row.id}: ${row.failureMode} | Önleme: ${row.preventionControl} | Tespit: ${row.detectionControl} | Reaksiyon: ${row.reactionPlan}`));
  if (!linked.length) lines.push('Sayısal teknik set değeri: Kontrol planı karakteristiği bağlanmadan yürürlükte yayınlanamaz.');
  if (['cnc', 'milling', 'drilling', 'thread'].includes(process.id)) lines.push('CNC program no/rev., takım ömrü (parça) ve izin verilen ofset sınırı (mm): kullanıcı sayısal girişi ve proses mühendisliği onayı gerekli.');
  return lines.join('\n');
}

function structuredInstructionSteps(preset) {
  const source = preset?.steps || preset?.workSteps || preset?.instructionSteps || [];
  return (Array.isArray(source) ? source : []).map((step, index) => typeof step === 'string' ? { sequence: index + 1, text: step, qualityPoint: '', safetyPoint: '' } : { sequence: step.sequence || step.seq || index + 1, text: step.textTR || step.instructionTR || step.action || step.text || recordLabel(step, `Adım ${index + 1}`), qualityPoint: step.qualityPointTR || step.qualityPoint || step.controlPoint || '', safetyPoint: step.safetyPointTR || step.safetyPoint || step.warning || '' });
}
function structuredInstructionParameters(preset) {
  const source = preset?.processParameters || preset?.parameters || preset?.numericParameters || [];
  return (Array.isArray(source) ? source : []).map(parameter => { const range = [parameter.minimum ?? parameter.min, parameter.maximum ?? parameter.max].filter(value => value !== undefined && value !== null).join(' – '); const value = parameter.value ?? parameter.nominal ?? (range || 'Doğrulanacak'); return { name: parameter.nameTR || parameter.name || parameter.parameter || 'Proses parametresi', value: String(value ?? 'Doğrulanacak'), unit: parameter.unit || '', sourceRef: sourceReferenceText(parameter.sourceRefs) || parameter.sourceRef || '' }; });
}
function ppeItemsForPreset(preset, process) {
  const profile = lookupLibraryItem('ppeProfiles', preset?.ppeProfileId) || {}; const items = profile.selected || profile.items || profile.requiredItems || profile.ppe || preset?.ppeItems || [];
  const labels = { 'safety-shoes': 'İş güvenliği ayakkabısı', 'work-clothing': 'İş kıyafeti', gloves: 'Prosese uygun eldiven', 'hearing-protection': 'Kulak koruyucu', 'eye-protection': 'Koruyucu gözlük', 'hard-hat': 'Baret', 'dust-mask': 'Toz maskesi', 'welding-mask': 'Kaynak maskesi' };
  const normalized = (Array.isArray(items) ? items : String(items || '').split(',')).map(item => typeof item === 'string' ? (labels[item.trim()] || item.trim()) : item.nameTR || item.name || item.label).filter(Boolean);
  if (normalized.length) return normalized;
  return process.special ? ['Koruyucu gözlük', 'İş ayakkabısı', 'Prosese uygun eldiven', 'Yüz siperi / EHS matrisindeki ek PPE'] : ['Koruyucu gözlük', 'İş ayakkabısı', 'Tesis risk matrisinde tanımlı PPE'];
}
function safetyTextForPreset(preset, process) {
  const profile = lookupLibraryItem('safetyProfiles', preset?.safetyProfileId) || {}; const rules = profile.mandatoryRules || profile.rules || profile.instructions || profile.items || preset?.safetyRules || [];
  const text = (Array.isArray(rules) ? rules : [rules]).map(item => typeof item === 'string' ? item : item.textTR || item.text || item.rule).filter(Boolean).join(' ');
  return text || safetyForProcess(process);
}

function buildInstructionModels() {
  instructionModels = selectedProcessEntries().map(({ routeKey, process, detail }) => {
    const linked = characteristics.filter(item => item.routeKey ? item.routeKey === routeKey : item.processId === process.id);
    const routeRisks = pfmeaRows.filter(row => row.routeKey === routeKey && row.reactionPlan).map(row => row.reactionPlan);
    const preset = sourceInstructionPresets().find(item => recordId(item) === detail.presetId) || instructionPresetForCode(detail.operationCode);
    const presetSteps = structuredInstructionSteps(preset); const librarySteps = String(process.workInstruction || '').split(/\r?\n|;/).map(step => step.trim()).filter(Boolean);
    const contentOrigin = presetSteps.length ? 'source-structured' : 'generated-draft';
    const operationTitleTR = detail.operationLabelTR || process.name; const operationTitleEN = detail.operationLabelEN || '';
    const fallbackSteps = [`İş emri, OEM No, kuruluş içi stok kodu ve Rev. ${drawingRevision.value} teknik resmini doğrula.`, `${process.equipment || 'Ekipman'} ile ${operationTitleTR} operasyonu için güvenli başlangıç kontrolünü yap.`, `${process.desc || operationTitleTR} işlem parametrelerini onaylı reçeteye göre uygula.`, linked.length ? `${linked.map(item => `${item.balloon} ${item.name}`).join(', ')} kontrolünü belirtilen sıklıkta gerçekleştir.` : 'Proses çıktısını görsel ve fonksiyonel olarak kontrol et.', 'Sonucu kayıt formuna işle; lot, vardiya ve operatör izlenebilirliğini tamamla.'];
    const steps = presetSteps.length ? presetSteps : (librarySteps.length >= 3 ? librarySteps : fallbackSteps).map((text, index) => ({ sequence: index + 1, text, qualityPoint: index === 3 ? 'Kontrol planındaki sıklık ve cihaz uygulanır.' : '', safetyPoint: index === 1 ? 'Makine koruyucuları ve acil durdurma doğrulanır.' : '' }));
    const presetParameters = structuredInstructionParameters(preset); const parametersText = [
      ...presetParameters.map(parameter => `${parameter.name}: ${parameter.value}${parameter.unit ? ` ${parameter.unit}` : ''}${parameter.sourceRef ? ` | Kaynak: ${parameter.sourceRef}` : ''}`),
      numericParametersForProcess(process, linked, detail)
    ].filter(Boolean).join('\n');
    const ppeItems = ppeItemsForPreset(preset, process); const reactionProfile = lookupLibraryItem('reactionPlans', preset?.reactionPlanId) || {}; const recordForm = lookupLibraryItem('recordForms', preset?.recordFormId) || {}; const sourceInstruction = sourceInstructionForPreset(preset);
    const warningCodes = [...new Set([...sourceWarningCodesForRoute(detail, preset), ...linked.flatMap(item => item.sourceWarningCodes || [])])]; const validationFlags = warningCodes.map(validationRuleText); if (contentOrigin === 'generated-draft') validationFlags.unshift('GENERATED_INSTRUCTION_DRAFT: İş adımları kaynak TTI’dan aktarılmadı; TYANA Q-FLOW tarafından taslak üretildi ve mühendislik onayı gerekir.');
    const context = { tenant: tenantSnapshotProfile(), product: { partNumber: partNumber.value, internalProductCode: internalProductCode.value, partName: partName.value, productTypeLabel: effectiveProductTypeLabel(), projectCode: projectCode.value, drawingNumber: document.getElementById('drawingNumber').value, drawingRevision: drawingRevision.value, controlPlanNumber: controlPlanNumber.value, supplierName: document.getElementById('supplierName').value, supplierSite: document.getElementById('supplierSite').value, keyContact: document.getElementById('keyContact').value } };
    const reactionText = reactionProfile.actions?.length ? `${reactionProfile.nameTR || 'Reaksiyon'}: ${reactionProfile.actions.join(' → ')}` : reactionProfile.nameTR || reactionProfile.textTR || reactionProfile.actionTR || reactionProfile.description;
    return { routeKey, operationNo: detail.operationNo, operationCode: detail.operationCode || operationCodeOf(preset), operationLabelTR: operationTitleTR, operationLabelEN: operationTitleEN, processId: process.id, presetId: recordId(preset), contentOrigin, title: preset ? instructionTitleForPreset(preset, `${operationTitleTR} Operatör Talimatı`) : `${operationTitleTR}${operationTitleEN ? ` / ${operationTitleEN}` : ''} Operatör Talimatı`, equipment: [detail.machineId, detail.tooling, detail.programNo].filter(value => value && !value.includes(' girin')).join(' / ') || sourceInstruction?.machines?.join(' / ') || [process.equipment, process.tooling].filter(Boolean).join(' / ') || 'Tanımlanacak', ppeItems, ppe: ppeItems.join(', '), safety: safetyTextForPreset(preset, process), parameters: presetParameters, parametersText, steps, stepsText: steps.map(step => step.text).join('\n'), linked, reaction: [...new Set(routeRisks)].join(' | ') || reactionText || process.reactionPlan || 'Prosesi durdur; ürünü kırmızı alanda bloke et; son iyi parçadan itibaren ayır; kalite sorumlusuna bildir; yeniden başlatma onayı al.', record: recordForm.code || recordForm.formNo || recordForm.documentNo || sourceInstruction?.formNo || recordLabel(recordForm, preset?.recordFormId || process.documentRef || `FR-${process.code || process.id}`), sourceDocumentNo: sourceInstruction?.instructionNo || preset?.documentNo || preset?.instructionNo || '', sourceRevision: sourceInstruction?.revision || preset?.revision || '', sourceFormNo: sourceInstruction?.formNo || '', sourceSha256: sourceInstruction?.sha256 || '', sourceRef: sourceReferenceText(preset?.sourceRefs) || detail.sourceRef || '', validationFlags, context };
  });
}

function renderInstructions() {
  const container = document.getElementById('instructionResult');
  container.innerHTML = instructionModels.map((model, index) => {
    const steps = (model.steps || []).filter(step => String(step.text || '').trim()).slice(0, 6);
    const stepPreview = steps.length ? `<div class="instruction-step-preview" aria-label="Görsel iş adımları">${steps.map((step, stepIndex) => `<div class="instruction-step-card"><span class="step-no">${String(stepIndex + 1).padStart(2, '0')}</span><div class="step-body"><b>${escapeHtml(step.text)}</b>${step.qualityPoint ? `<small>✓ ${escapeHtml(step.qualityPoint)}</small>` : ''}${step.safetyPoint ? `<small class="safety">⚠ ${escapeHtml(step.safetyPoint)}</small>` : ''}</div></div>`).join('')}</div>` : '<div class="instruction-step-preview"><div class="instruction-step-card"><span class="step-no">—</span><div class="step-body"><b>İş adımı teknik kaynaktan doğrulanacak</b><small class="safety">Yayın öncesi mühendislik onayı gerekir.</small></div></div></div>';
    const parameters = model.parametersText.split('\n').map(line => line.trim()).filter(Boolean).slice(0, 3);
    const parameterPreview = parameters.length ? `<div class="instruction-parameter-ribbon"><b>SAYISAL ŞARTLAR / KONTROL LİMİTLERİ</b>${escapeHtml(parameters.join(' • '))}</div>` : '';
    const reactionPreview = `<div class="instruction-reaction-callout"><b>REAKSİYON PLANI</b>${escapeHtml(model.reaction)}</div>`;
    return `<article class="instruction-card professional-instruction ${model.presetId ? 'has-source' : ''}" data-instruction="${index}"><div class="instruction-top"><span>OP ${escapeHtml(model.operationNo)}${model.operationCode ? ` • KOD ${escapeHtml(model.operationCode)}` : ''}</span><mark>${model.contentOrigin === 'generated-draft' ? 'ÜRETİLMİŞ TASLAK' : 'KAYNAK YAPILANDIRILDI'}</mark></div>${model.presetId ? `<div class="instruction-source-ribbon"><span>Kaynak referansı: ${escapeHtml(model.sourceDocumentNo || model.presetId)}</span><span>Rev. ${escapeHtml(model.sourceRevision || 'doğrulanacak')}</span><span>${model.contentOrigin === 'generated-draft' ? 'İş adımları kaynak dokümandan alınmadı' : 'Yapılandırılmış kaynak adımları'}</span><span>Kütüphane v${escapeHtml(qualityDocumentLibrary?.libraryVersion || '—')}</span></div>` : ''}<div class="instruction-hero"><div class="instruction-visual">${escapeHtml(processIcon(processes.find(item => item.id === model.processId) || {}))}<small>${escapeHtml(model.processId.toLocaleUpperCase('tr-TR'))}</small></div><div><h3>${escapeHtml(model.title)}</h3><p>${escapeHtml(model.equipment)}</p></div></div><div class="ppe-chip-row">${model.ppeItems.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>${model.validationFlags.length ? `<div class="instruction-validation-flags">${model.validationFlags.map(flag => `<span>⚠ ${escapeHtml(flag)}</span>`).join('')}</div>` : ''}${stepPreview}${parameterPreview}${reactionPreview}<div class="instruction-meta"><span>${model.stepsText.split('\n').filter(Boolean).length} adım</span><span>${model.linked.length} kontrol noktası</span><span>${model.parametersText.split('\n').filter(Boolean).length} teknik satır</span><span>${escapeHtml(model.record)}</span></div><div class="instruction-controls"><button class="secondary-button" data-toggle-instruction="${index}">Düzenle</button><button class="primary-small" data-export-instruction="${index}">PDF Kaydet</button></div><div class="instruction-editor"><label>PPE<input data-instruction-field="ppe" value="${escapeHtml(model.ppe)}"></label><label>İSG / makine güvenliği uyarıları<textarea data-instruction-field="safety" rows="5">${escapeHtml(model.safety)}</textarea></label><label>Sayısal proses parametreleri ve CP limitleri<textarea data-instruction-field="parametersText" rows="7">${escapeHtml(model.parametersText)}</textarea><small>Çizim/şartname dışı değer tahmin edilmez; eksik değer yürürlükte yayını bloke eder.</small></label><label>Sıralı işlem adımları<textarea data-instruction-field="stepsText" rows="7">${escapeHtml(model.stepsText)}</textarea></label><label>Reaksiyon planı<textarea data-instruction-field="reaction" rows="3">${escapeHtml(model.reaction)}</textarea></label><div class="linked-controls"><b>Bağlı kontrol noktaları</b>${model.linked.length ? model.linked.map(item => `<span><strong>${escapeHtml(item.id)} • Balon ${escapeHtml(item.balloon)} • ${escapeHtml(item.name)}</strong><small>${escapeHtml(specificationFor(item))} • ${escapeHtml(item.equipmentClass)} / ${escapeHtml(item.equipment)} • ${escapeHtml(item.sampleSize)} / ${escapeHtml(item.frequency)} • ${escapeHtml(item.trigger)}</small></span>`).join('') : '<span><small>Bu operasyona atanmış ürün/proses karakteristiği yok; yürürlükte yayın için kontrol bağlantısı gerekir.</small></span>'}</div></div></article>`;
  }).join('');
  container.querySelectorAll('[data-toggle-instruction]').forEach(button => button.addEventListener('click', () => button.closest('.instruction-card').classList.toggle('expanded')));
  container.querySelectorAll('[data-export-instruction]').forEach(button => button.addEventListener('click', () => exportInstructionPdf(Number(button.dataset.exportInstruction)).catch(error => toast('Operatör talimatı PDF üretilemedi', error.message))));
  container.querySelectorAll('[data-instruction-field]').forEach(field => field.addEventListener('input', event => { const card = event.target.closest('.instruction-card'); const model = instructionModels[Number(card.dataset.instruction)]; model[event.target.dataset.instructionField] = event.target.value; if (event.target.dataset.instructionField === 'ppe') model.ppeItems = event.target.value.split(',').map(item => item.trim()).filter(Boolean); if (event.target.dataset.instructionField === 'stepsText' && model.contentOrigin === 'generated-draft') model.contentOrigin = 'user-edited-draft'; markDraftDirty(); }));
}

function instructionPdfBlock(model, index, pageBreak = false) {
  const steps = model.stepsText.split('\n').map((text, stepIndex) => ({ text: text.trim(), qualityPoint: model.steps?.[stepIndex]?.qualityPoint || 'Standart iş ve kontrol planı uygulanır.', safetyPoint: model.steps?.[stepIndex]?.safetyPoint || 'Risk değerlendirmesindeki tedbir uygulanır.' })).filter(step => step.text);
  const parameters = model.parametersText.split('\n').map(line => line.trim()).filter(Boolean); const context = model.context || {}; const product = context.product || {}; const tenant = context.tenant || tenantSnapshotProfile();
  const cell = (text, options = {}) => ({ text: String(text || '—'), fontSize: 6.2, lineHeight: 1.08, margin: [3, 2, 3, 2], ...options });
  const meta = (label, value) => ({ stack: [{ text: label, fontSize: 4.8, color: '#6d7890' }, { text: String(value || '—'), bold: true, fontSize: 6.1, margin: [0, 1, 0, 0] }], margin: [3, 2, 3, 2] });
  const originWarning = model.contentOrigin === 'generated-draft' ? 'İŞ ADIMLARI: TYANA Q-FLOW ÜRETİLMİŞ TASLAK — KAYNAK TTI İÇERİĞİ DEĞİLDİR.' : model.contentOrigin === 'user-edited-draft' ? 'İŞ ADIMLARI: KULLANICI DÜZENLEMELİ TASLAK — MÜHENDİSLİK ONAYI GEREKİR.' : '';
  const warningSummary = [originWarning, ...(model.validationFlags || [])].filter(Boolean).join(' | ') || 'Kaynak preset değerleri ürün revizyonu, proses parametresi ve saha onayıyla doğrulanacaktır.';
  return { stack: [
    { table: { widths: [115, '*', 120], body: [[{ stack: [{ text: tenant.shortName || tenantShortName(), bold: true, color: '#b3152b', fontSize: 11.5 }, { text: tenant.productName || tenantProductName(), bold: true, color: '#173f7b', fontSize: 6.2, margin: [0, 1, 0, 0] }], alignment: 'center', margin: [0, 4] }, { stack: [{ text: 'OPERATÖR İŞ VE KALİTE KONTROL TALİMATI', bold: true, color: '#10213f', fontSize: 14, alignment: 'center' }, { text: model.contentOrigin === 'source-structured' ? 'KAYNAK YAPILANDIRILDI' : 'ÜRETİLMİŞ TASLAK • MÜHENDİSLİK ONAYI GEREKİR', bold: true, color: model.contentOrigin === 'source-structured' ? '#28775e' : '#b3152b', fontSize: 5.8, alignment: 'center', margin: [0, 2, 0, 0] }], margin: [0, 4] }, { stack: [{ text: `OP ${model.operationNo}`, bold: true, fontSize: 9.5 }, { text: `Kaynak: ${model.sourceDocumentNo || model.presetId || 'Kullanıcı tanımı'}`, fontSize: 5.8, margin: [0, 1, 0, 0] }, { text: `Rev. ${model.sourceRevision || product.drawingRevision || '—'}`, fontSize: 5.8 }], alignment: 'center', margin: [0, 3] }]] }, layout: { hLineWidth: () => .8, vLineWidth: () => .8, hLineColor: () => '#506079', vLineColor: () => '#506079' } },
    { table: { widths: ['*', '*', '*', '*'], body: [[meta('OEM NO / KURULUŞ KODU', `${product.partNumber} / ${product.internalProductCode}`), meta('TEKNİK RESİM / REV.', `${product.drawingNumber} / ${product.drawingRevision}`), meta('MAMUL / PROJE / KONTROL PLANI', `${product.partName} / ${product.projectCode} / ${product.controlPlanNumber}`), meta('KURULUŞ / SAHA', `${product.supplierName} / ${product.supplierSite}`)], [meta('OPERASYON / KOD', `${model.title} / ${model.operationCode || model.operationNo}`), meta('MAKİNE • TAKIM • PROGRAM', model.equipment), meta('KAYIT FORMU', model.record), meta('KAYNAK REFERANSI / KÜTÜPHANE', `${model.sourceDocumentNo || '—'} • ${model.sourceRef || 'Referans kullanıcı tarafından doğrulanacak'} / v${qualityDocumentLibrary?.libraryVersion || '—'}`)]] }, layout: 'lightHorizontalLines', margin: [0, 3, 0, 4] },
    { columns: [{ width: 125, stack: [{ text: 'ZORUNLU PPE', bold: true, color: '#ffffff', fillColor: '#173f7b', fontSize: 6.7, alignment: 'center', margin: [0, 3] }, { text: model.ppeItems.join(' • ') || model.ppe, fontSize: 6.1, fillColor: '#edf3fb', margin: [4, 3, 4, 3] }] }, { width: 6, text: '' }, { width: '*', stack: [{ text: 'İŞ SAĞLIĞI VE MAKİNE GÜVENLİĞİ', bold: true, color: '#ffffff', fillColor: '#b3152b', fontSize: 6.7, alignment: 'center', margin: [0, 3] }, { text: model.safety, fontSize: 6.1, fillColor: '#fff2f3', margin: [4, 3, 4, 3] }] }], margin: [0, 0, 0, 4] },
    { text: 'SAYISAL PROSES PARAMETRELERİ VE KONTROL LİMİTLERİ', bold: true, fontSize: 7.1, color: '#10213f', margin: [0, 0, 0, 2] },
    { table: { widths: [24, '*'], body: (parameters.length ? parameters : ['Kontrol planı karakteristiği ve sayısal proses parametresi bağlanmalıdır.']).map((line, parameterIndex) => [cell(parameterIndex + 1, { alignment: 'center', bold: true, fillColor: '#e9f1ff' }), cell(line)]) }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 4] },
    { text: 'GÖRSEL İŞ ADIMLARI VE NOKTA KONTROLLERİ', bold: true, fontSize: 7.1, color: '#10213f', margin: [0, 0, 0, 2] },
    { table: { headerRows: 1, widths: [25, 220, 190, '*'], body: [[{ text: 'NO', style: 'wiHead' }, { text: 'UYGULAMA ADIMI', style: 'wiHead' }, { text: 'KALİTE KONTROLÜ', style: 'wiHead' }, { text: 'GÜVENLİK NOKTASI', style: 'wiHead' }], ...steps.map((step, stepIndex) => [cell(stepIndex + 1, { alignment: 'center', bold: true }), cell(step.text), cell(step.qualityPoint), cell(step.safetyPoint)])] }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 4] },
    { text: 'KONTROL PLANI BAĞLANTISI', bold: true, fontSize: 7.1, color: '#10213f', margin: [0, 0, 0, 2] },
    { table: { headerRows: 1, widths: [31, 80, 95, 120, 105, 76, '*'], body: [[{ text: 'NO', style: 'wiHead' }, { text: 'KARAKTERİSTİK', style: 'wiHead' }, { text: 'SPESİFİKASYON', style: 'wiHead' }, { text: 'YÖNTEM / CİHAZ', style: 'wiHead' }, { text: 'NUMUNE / SIKLIK', style: 'wiHead' }, { text: 'KAYIT', style: 'wiHead' }, { text: 'REAKSİYON', style: 'wiHead' }], ...(model.linked.length ? model.linked.map(item => [item.balloon, item.name, specificationFor(item), `${item.method} / ${item.equipment}`, `${item.sampleSize} / ${item.frequency}`, item.reference, model.reaction].map(value => cell(value))) : [[{ text: 'Kontrol noktası bağlanmadan kontrollü yayın yapılamaz.', colSpan: 7, alignment: 'center', color: '#a23a45', bold: true, fontSize: 6.2, margin: 3 }, {}, {}, {}, {}, {}, {}]])] }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 4] },
    { table: { widths: [95, '*'], body: [[cell('REAKSİYON PLANI', { bold: true, color: '#9b1c2e', fillColor: '#fff0f2', alignment: 'center' }), cell(model.reaction, { fillColor: '#fff7f8' })], [cell('DOĞRULAMA NOTU', { bold: true, color: '#936313', fillColor: '#fff6e5', alignment: 'center' }), cell(warningSummary, { fillColor: '#fffbf2' })]] }, layout: 'lightHorizontalLines' },
    { table: { widths: ['*', '*', '*'], body: [[meta('HAZIRLAYAN', product.keyContact || 'Eren'), meta('KONTROL EDEN', 'Kalite / Proses Mühendisliği'), meta('ONAYLAYAN', 'Yetkili elektronik onay kaydı')]] }, layout: 'lightHorizontalLines', margin: [0, 3, 0, 0] }
  ], pageBreak: (pageBreak || index > 0) ? 'before' : undefined };
}

async function exportInstructionPdf(index) {
  if (!ensureDocumentExportReady()) return;
  if (!instructionModels.length) { buildInstructionModels(); renderInstructions(); }
  const model = instructionModels[index]; if (!model) return; const snapshot = await getDocumentationSnapshot(); const exportModel = { ...model, context: { tenant: snapshot.tenant, product: snapshot.product } };
  const definition = { pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [16, 14, 16, 22], background: (_page, pageSize) => ({ canvas: [{ type: 'rect', x: 10, y: 10, w: pageSize.width - 20, h: pageSize.height - 20, lineWidth: .8, lineColor: '#40506a' }] }), watermark: { text: documentCopyLabel(snapshot.approval.status), color: '#b8c3d4', opacity: 0.12, bold: true }, content: [instructionPdfBlock(exportModel, 0)], styles: { wiHead: { bold: true, color: 'white', fillColor: '#10213f', fontSize: 5.8, alignment: 'center', margin: 2.4 } }, footer: (page, pages) => ({ text: `${snapshot.product.controlPlanNumber} • OP ${model.operationNo} • SHA ${snapshot.sha256.slice(0, 16)} • ${documentCopyLabel(snapshot.approval.status)} • Sayfa ${page}/${pages}`, fontSize: 5.5, alignment: 'center', color: '#68758b', margin: [0, 3, 0, 0] }), defaultStyle: { font: 'Roboto' } };
  const fileName = `${safeFileName(snapshot.product.partNumber)}_OP-${model.operationNo}_${safeFileName(model.processId)}.pdf`; const blob = await pdfBlob(definition); const result = await saveBlob(blob, fileName, exportFileTypes.pdf, { documentType: `Operatör Talimatı OP ${model.operationNo}`, revision: snapshot.product.drawingRevision, snapshotId: snapshot.snapshotId }); if (result.saved) toast('Operatör talimatı kaydedildi', `A4 yatay • OP ${model.operationNo} • ${model.linked.length} kontrol noktası • TYANA Q-FLOW antetli.`);
  return result;
}

async function exportAllInstructionsPdf() {
  if (!ensureDocumentExportReady()) return;
  if (!instructionModels.length) buildInstructionModels(); const snapshot = await getDocumentationSnapshot(); const exportModels = instructionModels.map(model => ({ ...model, context: { tenant: snapshot.tenant, product: snapshot.product } }));
  const definition = { pageSize: 'A4', pageOrientation: 'landscape', pageMargins: [16, 14, 16, 22], background: (_page, pageSize) => ({ canvas: [{ type: 'rect', x: 10, y: 10, w: pageSize.width - 20, h: pageSize.height - 20, lineWidth: .8, lineColor: '#40506a' }] }), watermark: { text: documentCopyLabel(snapshot.approval.status), color: '#b8c3d4', opacity: 0.12, bold: true }, content: exportModels.map((model, index) => instructionPdfBlock(model, index, index > 0)), styles: { wiHead: { bold: true, color: 'white', fillColor: '#10213f', fontSize: 5.8, alignment: 'center', margin: 2.4 } }, footer: (page, pages) => ({ text: `${snapshot.product.controlPlanNumber} • OPERATÖR TALİMATLARI • SHA ${snapshot.sha256.slice(0, 16)} • ${documentCopyLabel(snapshot.approval.status)} • Sayfa ${page}/${pages}`, fontSize: 5.5, alignment: 'center', color: '#68758b', margin: [0, 3, 0, 0] }), defaultStyle: { font: 'Roboto' } };
  const fileName = `${safeFileName(snapshot.product.partNumber)}_Tum_Operator_Talimatlari.pdf`; const blob = await pdfBlob(definition); const result = await saveBlob(blob, fileName, exportFileTypes.pdf, { documentType: 'Toplu Operatör Talimatları', revision: snapshot.product.drawingRevision, snapshotId: snapshot.snapshotId }); if (result.saved) toast('Talimat paketi kaydedildi', `${instructionModels.length} operasyon • TYANA Q-FLOW antetli A4 yatay talimat paketi.`);
  return result;
}

document.querySelectorAll('[data-action="export-all-instructions"]').forEach(button => button.addEventListener('click', () => exportAllInstructionsPdf().catch(error => toast('Toplu operatör talimatları PDF üretilemedi', error.message))));

document.querySelectorAll('[data-action="generate-instruction"]').forEach(btn => btn.addEventListener('click', () => {
  if (!requireSelectedProcessRoute('Operatör talimatı')) return;
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
  const definition = { pageSize: 'A4', pageMargins: 36, content: [{ text: tenantShortName(), bold: true, fontSize: 18, color: '#b3152b' }, { text: `${tenantProductName()} PDF Kayıt Testi`, bold: true, fontSize: 14, color: '#173f7b', margin: [0, 8, 0, 8] }, { text: `Kurulum profili: ${tenantOrganizationName()} • ${tenantPlantName()}`, fontSize: 10 }, { text: `Oluşturma zamanı: ${new Date().toLocaleString('tr-TR')}`, fontSize: 10, margin: [0, 4, 0, 0] }, { text: 'Bu dosyayı görebiliyorsanız PDF üretme ve kayıt akışı çalışıyor.', margin: [0, 14, 0, 0] }], defaultStyle: { font: 'Roboto' } };
  try { const blob = await pdfBlob(definition); const result = await saveBlob(blob, `TYANA_Q-FLOW_${safeFileName(tenantShortName())}_PDF_Kayit_Testi.pdf`, exportFileTypes.pdf, { track: false }); if (result.saved) toast('PDF kayıt testi başarılı', `${(blob.size / 1024).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} KB dosya kaydedildi; çıktı merkezinden tekrar erişebilirsiniz.`); } catch (error) { toast('PDF kayıt testi başarısız', error.message); }
}));

document.querySelector('[data-action="ppap-package"]').addEventListener('click', () => {
  const items = currentPpapItems(); const state = ppapReadinessState(items); const open = state.scopeItems.filter(item => ppapEffectiveStatus(item) !== 'ready'); const blocked = open.filter(item => ppapEffectiveStatus(item) === 'blocked');
  if (open.length) {
    document.querySelectorAll('[data-ppap-filter]').forEach(button => button.classList.toggle('active', button.dataset.ppapFilter === 'open'));
    renderPpap('open');
    const first = open[0]; toast(`PPAP Seviye ${state.level} kalite kapısında durduruldu`, `${blocked.length} bloke, ${open.length - blocked.length} işlemde • ${state.ready}/${state.required} kapsam unsuru hazır • İlk açık unsur: ${first[0]} — ${ppapGapReason(first)}`);
    return;
  }
  toast(`PPAP Seviye ${state.level} kapsamı doğrulandı`, `${state.ready}/${state.required} uygulanabilir unsur hazır • ${state.submit} müşteriye gönder • ${state.retained} tesiste sakla • ${state.notApplicable} gerekçeli uygulanmaz • ${generatedDocumentRecords.length} kontrollü sistem çıktısı kayıtlı.`);
});

document.querySelectorAll('.projects-panel .chip').forEach(chip => chip.addEventListener('click', () => {
  document.querySelectorAll('.projects-panel .chip').forEach(item => item.classList.remove('active'));
  chip.classList.add('active');
}));

// Narrow, controlled bridge used by the separately versioned product-group
// master-template module. Internal mutable collections are never exposed.
globalThis.TyanaProjectRuntime = Object.freeze({
  captureSnapshot: () => getDocumentationSnapshot(),
  notify: (title, detail) => toast(title, detail),
  applyMasterTemplate: snapshot => {
    if (!snapshot || typeof snapshot !== 'object') throw new TypeError('Ana şablon snapshot verisi geçersiz.');
    currentProjectId = null; currentProjectVersion = 0;
    applyProductTemplate('blank');
    applySnapshot(snapshot);
    currentProjectId = null; currentProjectVersion = 0;
    localStorage.removeItem('qflow-last-project-id');
    localStorage.removeItem('qflow-last-project');
    const status = document.getElementById('draftStatus');
    if (status) { status.textContent = '● Ana şablondan yeni taslak • henüz kaydedilmedi'; status.classList.remove('saved'); status.classList.add('warning'); }
    markDraftDirty(); showView('product'); goToWizardStep(1);
    window.dispatchEvent(new CustomEvent('tyana:product-group-changed', { detail: { productGroup: snapshot.product?.productGroup || '' } }));
  }
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js').catch(() => {}));
}
