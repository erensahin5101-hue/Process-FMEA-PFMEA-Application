(function guidedExperience(global) {
  'use strict';

  const state = {
    drawerOpen: false,
    refreshTimer: null,
    lastSignature: '',
    activeView: 'dashboard',
    keyboardBound: false
  };

  const contextGuides = Object.freeze({
    dashboard: {
      title: 'Başlangıç noktası',
      text: 'Yeni ürün açın veya kaldığınız projenin ilk açık kalite kapısına ilerleyin.',
      tips: ['Önce ana mamul kimliğini tanımlayın.', 'Alt kartları BOM kullanımlarından önce oluşturun.', 'Kontrollü çıktıyı en son PPAP merkezinden yayınlayın.']
    },
    product: {
      title: 'Ürün ana verisi',
      text: 'Müşteri kimliği ile kuruluş içi stok kodunu ayırın; teknik resim kaynağını revizyonuyla doğrulayın.',
      tips: ['OEM No müşteri referansıdır; stok kodunun yerine geçmez.', 'Kartı BOM’da kullanmadan önce malzeme ve üret/satın al kararını tamamlayın.', 'Teknik detay paneli açık kaldığı yerden devam eder.']
    },
    bom: {
      title: 'Çok seviyeli ürün ağacı',
      text: 'Önce kart sicilini tamamlayın; sonra kartları seçili üst mamulün BOM’una bırakın.',
      tips: ['Kart = ne olduğu; BOM satırı = nerede ve ne kadar kullanıldığı.', 'Alt montaj kartına bırakılan parça yeni bir alt BOM oluşturabilir.', 'Sürükle-bırak, çift tıklama ve seçerek toplu ekleme aynı sonucu üretir.']
    },
    workplan: {
      title: 'İş planı ve makine',
      text: 'Her üretilen mamul/yarı mamul için operasyon sırası ve en az bir uygun makine tanımlayın.',
      tips: ['Satın alınan parçaya iş planı açılmaz.', 'Operasyonu sürükleyin veya Ekle düğmesini kullanın.', 'Makine seçimi olmayan adım doküman yayınını bloke eder.']
    },
    flow: {
      title: 'Proses akış doğrulaması',
      text: 'İş planından gelen operasyonların giriş, çıkış, kontrol ve dış kaynak bağlantılarını gözden geçirin.',
      tips: ['Akış sırası iş planıyla aynı olmalıdır.', 'Kontrol ve depo sembollerini gerçek operasyon türüne göre doğrulayın.', 'PDF’den önce antet ve revizyon bilgisini kontrol edin.']
    },
    dfmea: {
      title: 'DFMEA hazırlığı',
      text: 'Boundary ve P-Diyagramı tamamlandıktan sonra yapı–fonksiyon–hata zincirini kurun.',
      tips: ['Fonksiyonları ölçülebilir gerekliliklerle yazın.', 'Üst etki, odak hata modu ve alt neden ilişkisini koruyun.', 'DVP&R ve özel karakteristik referanslarını bağlayın.']
    },
    pfmea: {
      title: 'PFMEA risk çalışması',
      text: 'Rotadaki her operasyon için fonksiyon, hata, etki, neden, kontrol ve aksiyon kanıtını tamamlayın.',
      tips: ['S-O-D taslakları otomatik karar değildir.', 'Kriter düğmesinden kontrollü puanlama gerekçesi girin.', 'Aksiyon ancak fiili tarih ve etkinlik kanıtıyla kapatılır.']
    },
    control: {
      title: 'Kontrol planı',
      text: 'Teknik karakteristik, PFMEA kontrolü, ölçüm cihazı, örnek hacmi, sıklık ve reaksiyonu eşleştirin.',
      tips: ['Özel karakteristik sınıfını kaybetmeyin.', 'Ölçüm sistemi ve MSA durumunu doğrulayın.', 'Excel/PDF çıktısını taslak veya kontrollü yayın durumuna göre alın.']
    },
    instruction: {
      title: 'Operatör talimatı',
      text: 'Her operasyon için İSG, makine, sayısal parametre, iş adımı, kontrol ve reaksiyonu doğrulayın.',
      tips: ['Kaynak talimat yoksa üretilen içerik taslak kalır.', 'Sayısal değer tahmin etmeyin; çizim/şartnameye bağlayın.', 'Her talimatın kontrol planı satırıyla bağlantısı olmalıdır.']
    },
    documents: {
      title: 'PPAP ve kontrollü yayın',
      text: 'On kalite kapısındaki bulguları kapatın, kanıt dosyalarını doğrulayın ve yetkili onaya gönderin.',
      tips: ['PPAP seviyesi müşteri talebine göre seçilir.', 'Eksik veya eski revizyonlu çıktı kontrollü yayınlanmaz.', 'Yazılım uygunluğu destekler; sertifika veya otomatik uygunluk beyanı vermez.']
    },
    library: {
      title: 'Standart proses kütüphanesi',
      text: 'Operasyon kartlarının ekipman, kontrol, PFMEA, reaksiyon ve talimat bağlarını yönetin.',
      tips: ['Kullanıma açılacak kartı revizyonla yönetin.', 'Makine sınıfı ile tesis makinesini birbirine karıştırmayın.', 'Türkçe/İngilizce karşılık ve kaynak referansını koruyun.']
    },
    users: {
      title: 'Kullanıcı ve yetki',
      text: 'Hazırlayan, inceleyen ve onaylayan rollerini görev ayrılığıyla yönetin.',
      tips: ['Kullanıcıya yalnız ihtiyacı olan rolü verin.', 'Aynı kişi hazırlayan ve son onaylayan olmamalıdır.', 'Pilot sürümde kontrollü yayın için sunucu taraflı elektronik onay gerekir.']
    }
  });

  const text = value => String(value ?? '').trim();
  const safe = value => text(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  const fieldValue = id => text(document.getElementById(id)?.value);
  const isHidden = element => !element || element.classList.contains('hidden') || element.getAttribute('aria-hidden') === 'true';

  function auditMap() {
    try {
      const snapshot = typeof documentationAuditSnapshot === 'function' ? documentationAuditSnapshot() : null;
      return new Map((snapshot?.categories || []).map(category => [category.id, category]));
    } catch {
      return new Map();
    }
  }

  function categoryState(categories, id, fallbackIssue) {
    const category = categories.get(id);
    if (!category) return { done: false, issues: [fallbackIssue], evidence: 'Denetim hazırlanıyor' };
    return {
      done: category.status === 'pass' || !(category.issues || []).length,
      issues: (category.issues || []).map(String),
      evidence: category.evidence || ''
    };
  }

  function journeyStages() {
    const categories = auditMap();
    const identityFields = ['partNumber', 'internalProductCode', 'partName', 'projectCode', 'controlPlanNumber'];
    const identityCount = identityFields.filter(id => fieldValue(id)).length;
    const identityDone = identityCount === identityFields.length
      && (fieldValue('productGroup') !== '__custom__' || fieldValue('customProductGroupName'))
      && (!document.getElementById('customProductTypeField') || document.getElementById('customProductTypeField').classList.contains('hidden') || fieldValue('customProductTypeName'));
    const drawingVerified = Boolean(fieldValue('drawingNumber') && fieldValue('drawingRevision') && typeof drawingSource !== 'undefined' && /^[a-f0-9]{64}$/i.test(text(drawingSource?.sha256)));
    const itemMasters = typeof engineeringUniverse !== 'undefined' && Array.isArray(engineeringUniverse?.itemMasters) ? engineeringUniverse.itemMasters : [];
    const bomState = categoryState(categories, 'QG-03', 'Ürün kartları ve BOM doğrulanıyor');
    const workPlan = global.TyanaProductDefinition?.workPlanReadiness?.() || { required: 0, completed: 0, missing: [] };
    const routeCount = typeof selected !== 'undefined' && Array.isArray(selected) ? selected.length : 0;
    const engineeringState = categoryState(categories, 'QG-04', 'Teknik soru kapsamı hazırlanıyor');
    const characteristicList = typeof characteristics !== 'undefined' && Array.isArray(characteristics) ? characteristics : [];
    const readyCharacteristicCount = typeof characteristicIsEngineeringReady === 'function' ? characteristicList.filter(characteristicIsEngineeringReady).length : 0;
    const apqp = global.TyanaApqp?.readiness?.() || { boundary: 0, pDiagram: 0 };
    const dfmeaState = categoryState(categories, 'QG-06', 'DFMEA kanıt yapısı hazırlanıyor');
    const pfmeaState = categoryState(categories, 'QG-07', 'PFMEA kanıt yapısı hazırlanıyor');
    const controlState = categoryState(categories, 'QG-08', 'Kontrol planı girdileri hazırlanıyor');
    const instructionState = categoryState(categories, 'QG-09', 'Operatör talimatları hazırlanıyor');
    const ppapState = categoryState(categories, 'QG-10', 'PPAP kapsamı hazırlanıyor');
    const masterCount = itemMasters.length;
    const masterDone = masterCount > 0 && bomState.done;
    const workPlanDone = workPlan.required > 0 && workPlan.required === workPlan.completed;
    const characteristicsDone = characteristicList.length > 0 && readyCharacteristicCount === characteristicList.length;
    const apqpDone = Number(apqp.boundary) === 100 && Number(apqp.pDiagram) === 100;

    return [
      { id: 'identity', no: '01', group: 'ÜRÜN', title: 'Ürün kimliği ve kontrollü antet', done: identityDone, progress: identityCount / identityFields.length, detail: identityDone ? 'OEM, stok kodu ve doküman kimliği hazır' : `${identityCount}/${identityFields.length} temel alan tamam`, issues: identityDone ? [] : ['OEM No, kuruluş kodu, mamul adı, proje ve kontrol planı numarasını tamamlayın.'], view: 'product', step: 1, target: '#partNumber' },
      { id: 'drawing', no: '02', group: 'ÜRÜN', title: 'Teknik resim ve revizyon kaynağı', done: drawingVerified, progress: [fieldValue('drawingNumber'), fieldValue('drawingRevision'), typeof drawingSource !== 'undefined' && text(drawingSource?.sha256)].filter(Boolean).length / 3, detail: drawingVerified ? 'Kaynak dosya SHA-256 ile doğrulandı' : 'Dosya, numara ve revizyon bekleniyor', issues: drawingVerified ? [] : ['Teknik resmi seçin; resim numarası, revizyon ve kaynak özetini doğrulayın.'], view: 'product', step: 1, target: '.drawing-upload' },
      { id: 'bom', no: '03', group: 'ÜRÜN', title: 'Malzeme kartları ve çok seviyeli BOM', done: masterDone, progress: masterCount ? (bomState.done ? 1 : .5) : 0, detail: `${masterCount} kart • ${bomState.evidence || 'BOM bekleniyor'}`, issues: masterDone ? [] : (bomState.issues.length ? bomState.issues : ['Önce kartları, sonra BOM kullanım ilişkilerini oluşturun.']), view: 'bom', step: 2, target: masterCount > 1 ? '#bomStructureStage' : '#itemMasterStage' },
      { id: 'workplan', no: '04', group: 'PROSES', title: 'İş planları ve makine atamaları', done: workPlanDone, progress: workPlan.required ? workPlan.completed / workPlan.required : 0, detail: `${workPlan.completed}/${workPlan.required} üretilecek kart planlı`, issues: workPlanDone ? [] : [workPlan.missing?.length ? `${workPlan.missing.length} kartta operasyon veya makine seçimi eksik.` : 'Üretilecek kart ve operasyon rotası tanımlayın.'], view: 'workplan', step: 3, target: '#workPlanStudio' },
      { id: 'flow', no: '05', group: 'PROSES', title: 'Proses akış doğrulaması', done: routeCount > 0 && workPlanDone, progress: routeCount ? (workPlanDone ? 1 : .5) : 0, detail: `${routeCount} operasyon akışa bağlı`, issues: routeCount > 0 && workPlanDone ? [] : ['İş planı operasyonlarını ve makine seçimlerini tamamlayın; akışı yeniden üretin.'], view: routeCount ? 'flow' : 'workplan', step: routeCount ? null : 3, target: routeCount ? '#flowPreview' : '#workPlanStudio' },
      { id: 'engineering', no: '06', group: 'TEKNİK', title: 'Ürün/bileşen teknik soruları', done: engineeringState.done, progress: engineeringState.done ? 1 : 0, detail: engineeringState.evidence, issues: engineeringState.issues, view: 'workplan', step: 3, target: '#engineeringQuestionTitle' },
      { id: 'characteristics', no: '07', group: 'TEKNİK', title: 'Numaralı karakteristik ve ölçüm planı', done: characteristicsDone, progress: characteristicList.length ? readyCharacteristicCount / characteristicList.length : 0, detail: `${readyCharacteristicCount}/${characteristicList.length} karakteristik tam`, issues: characteristicsDone ? [] : ['Balon, tolerans, proses, cihaz, numune, sıklık ve reaksiyon alanlarını tamamlayın.'], view: 'product', step: 4, target: '#characteristicRows' },
      { id: 'apqp', no: '08', group: 'TASARIM', title: 'Boundary ve P-Diyagramı', done: apqpDone, progress: (Number(apqp.boundary || 0) + Number(apqp.pDiagram || 0)) / 200, detail: `Boundary %${apqp.boundary || 0} • P-Diyagramı %${apqp.pDiagram || 0}`, issues: apqpDone ? [] : ['Sistem sınırı, arayüzler, fonksiyon, girdi, gürültü, kontrol ve çıktıları tamamlayın.'], view: 'product', step: 5, target: '#apqpAnalysisStudio' },
      { id: 'dfmea', no: '09', group: 'RİSK', title: 'DFMEA ve DVP&R kanıtı', done: dfmeaState.done, progress: dfmeaState.done ? 1 : 0, detail: dfmeaState.evidence, issues: dfmeaState.issues, view: 'dfmea', target: '#dfmeaGovernanceStudio' },
      { id: 'pfmea', no: '10', group: 'RİSK', title: 'PFMEA risk ve aksiyon kanıtı', done: pfmeaState.done, progress: pfmeaState.done ? 1 : 0, detail: pfmeaState.evidence, issues: pfmeaState.issues, view: 'pfmea', target: '#pfmeaGovernanceStudio' },
      { id: 'control', no: '11', group: 'DOKÜMAN', title: 'Kontrol Planı ve MSA bağlantısı', done: controlState.done, progress: controlState.done ? 1 : 0, detail: controlState.evidence, issues: controlState.issues, view: 'control', target: '#controlEmpty' },
      { id: 'instruction', no: '12', group: 'DOKÜMAN', title: 'Operatör talimatları ve İSG', done: instructionState.done, progress: instructionState.done ? 1 : 0, detail: instructionState.evidence, issues: instructionState.issues, view: 'instruction', target: '#instructionEmpty' },
      { id: 'ppap', no: '13', group: 'YAYIN', title: 'PPAP dosyası ve kontrollü yayın', done: ppapState.done, progress: ppapState.done ? 1 : 0, detail: ppapState.evidence, issues: ppapState.issues, view: 'documents', target: '#documentationAuditPanel' }
    ];
  }

  function currentViewId() {
    const active = document.querySelector('.view.active');
    if (!active) return 'dashboard';
    if (active.id === 'product') return active.dataset.productModule || 'product';
    return active.id;
  }

  function statusClass(stage, firstOpenIndex, index) {
    if (stage.done) return 'complete';
    if (index === firstOpenIndex) return 'current';
    if (stage.progress > 0) return 'progress';
    return 'waiting';
  }

  function ensureShell() {
    if (document.getElementById('qflowJourneyBar')) return;
    const topbar = document.querySelector('.topbar');
    const bar = document.createElement('section');
    bar.id = 'qflowJourneyBar';
    bar.className = 'qflow-journey-bar';
    bar.setAttribute('aria-label', 'Sıradaki önerilen çalışma');
    bar.innerHTML = '<button type="button" class="journey-score" data-guide-action="open"><span id="journeyScoreValue">0%</span><small>HAZIRLIK</small></button><div class="journey-next"><span>SIRADAKİ EN DOĞRU İŞ</span><b id="journeyNextTitle">Proje inceleniyor…</b><small id="journeyNextDetail">Veri omurgası kontrol ediliyor.</small></div><div class="journey-mini-progress"><i id="journeyMiniProgress"></i></div><button type="button" class="journey-open-button" data-guide-action="next">Devam Et <span>→</span></button><button type="button" class="journey-map-button" data-guide-action="open">Yol Haritası</button>';
    topbar?.insertAdjacentElement('afterend', bar);

    const backdrop = document.createElement('div');
    backdrop.id = 'qflowGuideBackdrop';
    backdrop.className = 'qflow-guide-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.append(backdrop);

    const drawer = document.createElement('aside');
    drawer.id = 'qflowGuideDrawer';
    drawer.className = 'qflow-guide-drawer';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('aria-labelledby', 'qflowGuideTitle');
    drawer.innerHTML = '<header><div><span>TYANA Q-FLOW • AKILLI REHBER</span><h2 id="qflowGuideTitle">A’dan Z’ye dokümantasyon yol haritası</h2><p>Program mevcut veriyi denetler, eksikleri önceliklendirir ve sizi doğru çalışma alanına götürür.</p></div><button type="button" aria-label="Rehberi kapat" data-guide-action="close">×</button></header><section class="guide-project-summary"><div class="guide-score-ring"><b id="guideScoreValue">0%</b><span>hazır</span></div><div><b id="guideProjectName">Yeni proje</b><small id="guideProjectIdentity">OEM ve stok kodu bekleniyor</small><p id="guideSummaryText">Yol haritası hazırlanıyor…</p></div></section><section id="qflowContextGuide" class="qflow-context-guide"></section><nav id="qflowJourneyStages" class="qflow-journey-stages" aria-label="Dokümantasyon adımları"></nav><footer><span><b>Yeşil:</b> doğrulandı</span><span><b>Mavi:</b> sıradaki iş</span><span><b>Gri:</b> ön koşul bekliyor</span></footer>';
    document.body.append(drawer);

    const command = document.createElement('dialog');
    command.id = 'qflowCommandPalette';
    command.className = 'qflow-command-palette';
    command.innerHTML = '<form method="dialog"><header><span>⌕</span><input id="qflowCommandInput" type="search" autocomplete="off" placeholder="Sayfa, işlem veya doküman ara…"><kbd>ESC</kbd></header><div id="qflowCommandResults"></div><footer><span>↑↓ gezin</span><span>Enter aç</span><span>Ctrl+K ara</span></footer></form>';
    document.body.append(command);
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'qflow-command-close';
    closeButton.dataset.closeCommandPalette = 'true';
    closeButton.setAttribute('aria-label', 'Komut paletini kapat');
    closeButton.textContent = 'ESC / KAPAT';
    const shortcut = command.querySelector('header kbd');
    if (shortcut) shortcut.replaceWith(closeButton); else command.querySelector('header')?.append(closeButton);
    closeButton.addEventListener('click', closeCommandPalette);
    command.addEventListener('cancel', event => { event.preventDefault(); closeCommandPalette(); });
    command.addEventListener('click', event => { if (event.target === command) closeCommandPalette(); });
  }

  function renderContextGuide(viewId = currentViewId()) {
    const host = document.getElementById('qflowContextGuide');
    if (!host) return;
    const guide = contextGuides[viewId] || contextGuides.dashboard;
    host.innerHTML = `<span>BU SAYFADA</span><h3>${safe(guide.title)}</h3><p>${safe(guide.text)}</p><ul>${guide.tips.map(tip => `<li>${safe(tip)}</li>`).join('')}</ul>`;
  }

  function render() {
    ensureShell();
    const stages = journeyStages();
    const completed = stages.filter(stage => stage.done).length;
    const score = Math.round((completed / stages.length) * 100);
    const firstOpenIndex = Math.max(0, stages.findIndex(stage => !stage.done));
    const next = stages[firstOpenIndex] || stages.at(-1);
    const signature = JSON.stringify({ score, next: next?.id, details: stages.map(stage => [stage.id, stage.done, Math.round(stage.progress * 100), stage.detail]) });
    if (signature === state.lastSignature && state.activeView === currentViewId()) return;
    state.lastSignature = signature;
    state.activeView = currentViewId();

    document.getElementById('journeyScoreValue').textContent = `${score}%`;
    document.getElementById('guideScoreValue').textContent = `${score}%`;
    const scoreRing = document.querySelector('.guide-score-ring');
    if (scoreRing) scoreRing.style.background = `radial-gradient(circle,#fff 58%,transparent 60%),conic-gradient(#1a9e87 0 ${score}%,#e6edf5 ${score}% 100%)`;
    document.getElementById('journeyMiniProgress').style.width = `${score}%`;
    document.getElementById('journeyNextTitle').textContent = completed === stages.length ? 'Doküman zinciri doğrulamaya hazır' : `${next.no} • ${next.title}`;
    document.getElementById('journeyNextDetail').textContent = completed === stages.length ? 'PPAP ve kontrollü yayın kararını yetkili ekip tamamlayabilir.' : (next.issues[0] || next.detail);
    document.querySelector('[data-guide-action="next"]').dataset.guideStage = next.id;
    document.getElementById('guideProjectName').textContent = fieldValue('partName') || fieldValue('projectCode') || 'Yeni proje';
    document.getElementById('guideProjectIdentity').textContent = `OEM ${fieldValue('partNumber') || '—'} • Stok ${fieldValue('internalProductCode') || '—'}`;
    document.getElementById('guideSummaryText').textContent = `${completed}/${stages.length} kapı hazır • ${stages.length - completed} adım çalışma bekliyor`;
    const list = document.getElementById('qflowJourneyStages');
    list.innerHTML = stages.map((stage, index) => {
      const status = statusClass(stage, firstOpenIndex, index);
      const percent = Math.max(0, Math.min(100, Math.round(stage.progress * 100)));
      return `<button type="button" class="qflow-journey-stage ${status}" data-guide-stage="${safe(stage.id)}"><span class="journey-stage-no">${stage.done ? '✓' : stage.no}</span><div><small>${safe(stage.group)}</small><b>${safe(stage.title)}</b><p>${safe(stage.done ? stage.detail : (stage.issues[0] || stage.detail))}</p><i><em style="width:${stage.done ? 100 : percent}%"></em></i></div><mark>${stage.done ? 'HAZIR' : status === 'current' ? 'DEVAM' : percent ? `%${percent}` : 'BEKLİYOR'}</mark></button>`;
    }).join('');
    renderContextGuide(state.activeView);
  }

  function scheduleRender() {
    clearTimeout(state.refreshTimer);
    state.refreshTimer = setTimeout(render, 180);
  }

  function setDrawer(open) {
    state.drawerOpen = Boolean(open);
    const drawer = document.getElementById('qflowGuideDrawer');
    const backdrop = document.getElementById('qflowGuideBackdrop');
    drawer?.classList.toggle('open', state.drawerOpen);
    backdrop?.classList.toggle('open', state.drawerOpen);
    drawer?.setAttribute('aria-hidden', String(!state.drawerOpen));
    backdrop?.setAttribute('aria-hidden', String(!state.drawerOpen));
    document.body.classList.toggle('guide-drawer-open', state.drawerOpen);
    if (state.drawerOpen) {
      render();
      drawer?.querySelector('[data-guide-action="close"]')?.focus();
    }
  }

  function focusTarget(stage) {
    const target = document.querySelector(stage.target);
    if (!target || isHidden(target)) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('qflow-guided-focus');
    setTimeout(() => target.classList.remove('qflow-guided-focus'), 2400);
    const focusable = target.matches('input,select,textarea,button,[tabindex]') ? target : target.querySelector('input,select,textarea,button,[tabindex]');
    focusable?.focus({ preventScroll: true });
  }

  function navigate(stageId) {
    const stage = journeyStages().find(item => item.id === stageId);
    if (!stage) return;
    setDrawer(false);
    if (typeof showView === 'function') showView(stage.view);
    if (stage.step && typeof goToWizardStep === 'function') goToWizardStep(stage.step);
    if (stage.id === 'bom' && typeof setEngineeringBomStage === 'function') {
      const masterCount = typeof engineeringUniverse !== 'undefined' && Array.isArray(engineeringUniverse?.itemMasters) ? engineeringUniverse.itemMasters.length : 0;
      setEngineeringBomStage(masterCount > 1 ? 'structure' : 'masters');
    }
    if (stage.id === 'apqp') {
      setTimeout(() => document.querySelector('[data-apqp-analysis-tab="boundary"]')?.click(), 80);
    }
    setTimeout(() => focusTarget(stage), 220);
  }

  function commands() {
    const stages = journeyStages();
    const adminCommand = { id: 'view-admin', title: 'Admin Merkezi', description: 'Lisans, veri sağlığı ve güvenlik kapıları', keywords: 'admin lisans kalıcı aktivasyon', action: () => { if (typeof showView === 'function') showView('admin'); } };
    const modules = [
      ['dashboard', 'Genel Bakış', 'dashboard kpi başlangıç'],
      ['product', 'Ürün Kartları', 'ana veri teknik resim'],
      ['bom', 'Ürün Ağaçları', 'bom malzeme kartı sürükle'],
      ['workplan', 'İş Planları', 'operasyon makine rota'],
      ['flow', 'Proses Akışı', 'akış pdf dxf'],
      ['dfmea', 'DFMEA', 'tasarım risk dvpr'],
      ['pfmea', 'PFMEA', 'risk sod ap aksiyon'],
      ['control', 'Kontrol Planı', 'ölçüm sıklık excel pdf'],
      ['instruction', 'Operatör Talimatları', 'isg ppe parametre'],
      ['documents', 'PPAP Merkezi', 'kanıt yayın denetim'],
      ['library', 'Proses Kütüphanesi', '380 operasyon kartı'],
      ['users', 'Kullanıcı ve Yetki', 'rol onay görev ayrılığı']
    ].map(([view, title, keywords]) => ({ id: `view-${view}`, title, description: 'Modülü aç', keywords, action: () => { if (typeof showView === 'function') showView(view); } }));
    return [
      ...stages.map(stage => ({ id: `stage-${stage.id}`, title: `${stage.no} • ${stage.title}`, description: stage.done ? 'Hazır kapıyı incele' : (stage.issues[0] || stage.detail), keywords: `${stage.group} ${stage.id}`, action: () => navigate(stage.id) })),
      ...modules, adminCommand,
      { id: 'audit', title: 'Dokümantasyon zincirini denetle', description: 'PPAP kalite kapısı bulgularını göster', keywords: 'kalite denetim eksik bulgu', action: () => { if (typeof showView === 'function') showView('documents'); setTimeout(() => document.getElementById('documentationAuditPanel')?.scrollIntoView({ behavior: 'smooth' }), 120); } },
      { id: 'save', title: 'Projeyi kaydet', description: 'Mevcut taslağı yerel veritabanına kaydet', keywords: 'kaydet taslak', action: () => document.querySelector('[data-action="save-product"]')?.click() }
    ];
  }

  function renderCommands(query = '') {
    const host = document.getElementById('qflowCommandResults');
    if (!host) return;
    const normalized = text(query).toLocaleLowerCase('tr-TR');
    const filtered = commands().filter(command => !normalized || `${command.title} ${command.description} ${command.keywords}`.toLocaleLowerCase('tr-TR').includes(normalized)).slice(0, 18);
    host.innerHTML = filtered.length ? filtered.map((command, index) => `<button type="button" data-command-id="${safe(command.id)}" class="${index === 0 ? 'selected' : ''}"><span>${command.id.startsWith('stage-') ? '→' : '◇'}</span><div><b>${safe(command.title)}</b><small>${safe(command.description)}</small></div><kbd>Enter</kbd></button>`).join('') : '<p>Aramanızla eşleşen işlem bulunamadı.</p>';
  }

  function openCommandPalette(initial = '') {
    const dialog = document.getElementById('qflowCommandPalette');
    const input = document.getElementById('qflowCommandInput');
    if (!dialog || !input) return;
    input.value = initial;
    renderCommands(initial);
    if (!dialog.open) dialog.showModal();
    setTimeout(() => input.focus(), 30);
  }

  function closeCommandPalette() {
    const dialog = document.getElementById('qflowCommandPalette');
    if (dialog?.open) dialog.close();
    clearSearchField(document.activeElement);
    clearSearchField(document.querySelector('.topbar .search input'));
  }

  function runCommand(id) {
    const command = commands().find(item => item.id === id);
    if (!command) return;
    closeCommandPalette();
    command.action();
    scheduleRender();
  }

  function clearSearchField(field) {
    if (!field || !field.matches('input[type="search"], .topbar .search input, .library-search input, .studio-search input, [data-search-input]')) return false;
    if (field.value) {
      field.value = '';
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    field.blur();
    return true;
  }

  function isEscapeKey(event) {
    return event?.key === 'Escape' || event?.key === 'Esc' || event?.code === 'Escape' || event?.keyCode === 27 || event?.which === 27;
  }

  function closeOnEscape(event) {
    if (!isEscapeKey(event) || event.isComposing) return;
    const palette = document.getElementById('qflowCommandPalette');
    const topSearch = document.querySelector('.topbar .search input');
    if (palette?.open) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeCommandPalette();
      return;
    }
    const nativeDialog = [...document.querySelectorAll('dialog[open]')].reverse().find(dialog => dialog.id !== 'qflowCommandPalette');
    if (nativeDialog) {
      event.preventDefault();
      event.stopImmediatePropagation();
      nativeDialog.close();
      return;
    }
    if (state.drawerOpen) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setDrawer(false);
      return;
    }
    const drawer = document.querySelector('.drawer-shell:not(.hidden)');
    if (drawer) {
      event.preventDefault();
      event.stopImmediatePropagation();
      drawer.classList.add('hidden');
      drawer.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('drawer-open');
      return;
    }
    const clearedActive = clearSearchField(document.activeElement);
    const clearedTop = clearSearchField(topSearch);
    if (clearedActive || clearedTop) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  function installKeyboardListeners() {
    if (state.keyboardBound) return;
    state.keyboardBound = true;
    window.addEventListener('keydown', closeOnEscape, { capture: true });
    window.addEventListener('keyup', closeOnEscape, { capture: true });
    window.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase('tr-TR') === 'k') {
        event.preventDefault();
        event.stopImmediatePropagation();
        openCommandPalette();
      }
    }, { capture: true });
  }

  function bind() {
    ensureShell();
    document.querySelector('.help-button')?.setAttribute('aria-label', 'Akıllı rehberi aç');
    document.addEventListener('click', event => {
      const guideAction = event.target.closest('[data-guide-action]');
      if (guideAction) {
        const action = guideAction.dataset.guideAction;
        if (action === 'open') setDrawer(true);
        if (action === 'close') setDrawer(false);
        if (action === 'next') navigate(guideAction.dataset.guideStage);
        return;
      }
      const stage = event.target.closest('[data-guide-stage]');
      if (stage) { navigate(stage.dataset.guideStage); return; }
      const command = event.target.closest('[data-command-id]');
      if (command) runCommand(command.dataset.commandId);
    });
    document.querySelector('.help-button')?.addEventListener('click', () => setDrawer(true));
    document.getElementById('qflowGuideBackdrop')?.addEventListener('click', () => setDrawer(false));
    const topSearch = document.querySelector('.topbar .search input');
    topSearch?.addEventListener('focus', () => { openCommandPalette(topSearch.value); topSearch.blur(); });
    topSearch?.addEventListener('click', () => openCommandPalette(topSearch.value));
    document.getElementById('qflowCommandInput')?.addEventListener('input', event => renderCommands(event.target.value));
    document.getElementById('qflowCommandInput')?.addEventListener('keydown', event => {
      const results = [...document.querySelectorAll('#qflowCommandResults [data-command-id]')];
      const current = Math.max(0, results.findIndex(button => button.classList.contains('selected')));
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        results[current]?.classList.remove('selected');
        const next = event.key === 'ArrowDown' ? (current + 1) % results.length : (current - 1 + results.length) % results.length;
        results[next]?.classList.add('selected'); results[next]?.scrollIntoView({ block: 'nearest' });
      }
      if (event.key === 'Enter') { event.preventDefault(); const selectedCommand = results.find(button => button.classList.contains('selected')) || results[0]; if (selectedCommand) runCommand(selectedCommand.dataset.commandId); }
    });
    document.addEventListener('keydown', event => {
      if (isEscapeKey(event)) {
        const palette = document.getElementById('qflowCommandPalette');
        if (palette?.open) { event.preventDefault(); closeCommandPalette(); return; }
        const active = document.activeElement;
        if (active?.matches('input[type="search"], .topbar .search input')) {
          active.value = '';
          active.dispatchEvent(new Event('input', { bubbles: true }));
          active.blur();
        }
      }
      if (isEscapeKey(event) && state.drawerOpen) setDrawer(false);
    });
    global.addEventListener('tyana:data-changed', scheduleRender);
    global.addEventListener('tyana:view-changed', event => { state.activeView = event.detail?.id || currentViewId(); scheduleRender(); });
    document.addEventListener('change', scheduleRender);
    document.addEventListener('input', event => { if (event.target.matches('input,select,textarea')) scheduleRender(); });
    setInterval(() => { if (!document.hidden) scheduleRender(); }, 3000);
    render();
  }

  global.TyanaGuide = Object.freeze({ render, stages: journeyStages, navigate, open: () => setDrawer(true), close: () => setDrawer(false), openCommandPalette });
  installKeyboardListeners();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(bind, 250), { once: true });
  else setTimeout(bind, 250);
})(globalThis);
