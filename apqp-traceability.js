(function initializeApqpTraceability(global) {
  'use strict';

  const chainDefinitions = Object.freeze([
    ['voc', 'VOC', 'Müşteri sesi'],
    ['qfd', 'QFD-1/2', 'Ürün ve parça karakteristiği'],
    ['boundary', 'BOUNDARY', 'Sistem sınırı'],
    ['pDiagram', 'P-DİYAGRAMI', 'Girdi, gürültü ve kontrol'],
    ['dfmea', 'DFMEA', 'Tasarım riski'],
    ['dvpr', 'DVP&R', 'Tasarım doğrulaması'],
    ['matrix', 'KARAKTERİSTİK', 'Parça–operasyon matrisi'],
    ['flow', 'PROSES AKIŞI', 'İş planı ve makine'],
    ['pfmea', 'PFMEA', 'Proses riski'],
    ['control', 'KONTROL PLANI', 'Ölçüm ve reaksiyon'],
    ['instruction', 'İŞ TALİMATI', 'Operatör uygulaması']
  ]);

  const text = value => String(value ?? '').trim();
  const clone = value => JSON.parse(JSON.stringify(value));
  const safe = value => typeof escapeHtml === 'function' ? escapeHtml(value) : text(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

  const interfaceTypes = Object.freeze([
    ['physical', 'Fiziksel bağlantı'],
    ['material', 'Malzeme akışı'],
    ['energy', 'Enerji transferi'],
    ['signal', 'Sinyal / bilgi'],
    ['clearance', 'Fiziksel boşluk'],
    ['human', 'İnsan / servis etkileşimi'],
    ['environment', 'Çevresel etkileşim']
  ]);
  const noiseDefinitions = Object.freeze([
    ['pieceVariation', 'N1', 'Parçadan parçaya değişkenlik'],
    ['timeVariation', 'N2', 'Zamanla değişim'],
    ['customerUsage', 'N3', 'Müşteri kullanımı'],
    ['environment', 'N4', 'Harici ortam'],
    ['systemInteraction', 'N5', 'Sistem etkileşimleri']
  ]);

  function analysisDocumentNumber(prefix) {
    const project = text(document.getElementById('projectCode')?.value) || 'YENİ';
    return `${prefix}-${project.replace(/[^A-Za-z0-9ÇĞİÖŞÜçğıöşü_-]+/g, '-').replace(/^-+|-+$/g, '').toUpperCase()}`;
  }

  function emptyBoundary(overrides = {}) {
    return {
      documentNo: analysisDocumentNumber('BD'),
      revision: text(document.getElementById('drawingRevision')?.value) || 'A',
      systemName: text(document.getElementById('partName')?.value),
      scope: '',
      owner: '',
      status: 'Taslak',
      focusItemMasterId: '',
      internalElements: [],
      externalElements: [],
      interfaces: [],
      ...overrides
    };
  }

  function emptyPDiagram(overrides = {}) {
    return {
      documentNo: analysisDocumentNumber('PD'),
      revision: text(document.getElementById('drawingRevision')?.value) || 'A',
      system: '',
      subsystem: '',
      component: text(document.getElementById('partName')?.value),
      functionId: '',
      functionText: '',
      owner: '',
      status: 'Taslak',
      inputSignals: [],
      controlFactors: [],
      noiseFactors: Object.fromEntries(noiseDefinitions.map(([key]) => [key, []])),
      intendedOutputs: [],
      errorStates: [],
      functionalRequirements: [],
      constraints: [],
      verificationMethods: [],
      ...overrides
    };
  }

  let state = {
    schemaVersion: '2.0.0',
    fmeaProfile: 'family',
    priorityMethod: 'AP',
    activeAnalysisTab: 'boundary',
    boundary: emptyBoundary(),
    pDiagram: emptyPDiagram(),
    boundaryConnectSourceId: '',
    rows: []
  };
  let draggedRowId = null;

  function routeEntries() {
    try { return typeof selectedProcessEntries === 'function' ? selectedProcessEntries() : []; }
    catch { return []; }
  }

  function itemMasters() {
    try { return Array.isArray(engineeringUniverse?.itemMasters) ? engineeringUniverse.itemMasters : []; }
    catch { return []; }
  }

  function characteristicRows() {
    try { return Array.isArray(characteristics) ? characteristics : []; }
    catch { return []; }
  }

  function pfmeaRecords() {
    try { return Array.isArray(pfmeaRows) ? pfmeaRows : []; }
    catch { return []; }
  }

  function uid(prefix) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  }

  function normalizeTextList(values) {
    return Array.isArray(values)
      ? values.map(value => typeof value === 'string' ? { id: uid('VAL'), text: text(value) } : {
        id: value.id || uid('VAL'),
        text: text(value.text ?? value.name ?? value.label)
      }).filter(value => value.text)
      : [];
  }

  function normalizeBoundary(source = {}) {
    const boundary = emptyBoundary(source);
    boundary.internalElements = Array.isArray(source.internalElements) ? source.internalElements.map(element => ({
      id: element.id || uid('INT'),
      itemMasterId: text(element.itemMasterId),
      name: text(element.name),
      functionText: text(element.functionText),
      type: 'internal'
    })).filter(element => element.name) : [];
    boundary.externalElements = Array.isArray(source.externalElements) ? source.externalElements.map(element => ({
      id: element.id || uid('EXT'),
      itemMasterId: '',
      name: text(element.name),
      functionText: text(element.functionText),
      type: 'external'
    })).filter(element => element.name) : [];
    boundary.interfaces = Array.isArray(source.interfaces) ? source.interfaces.map(connection => ({
      id: connection.id || uid('IF'),
      fromId: text(connection.fromId),
      toId: text(connection.toId),
      interfaceType: interfaceTypes.some(([key]) => key === connection.interfaceType) ? connection.interfaceType : 'physical',
      description: text(connection.description),
      requirement: text(connection.requirement),
      characteristicId: text(connection.characteristicId)
    })) : [];
    return boundary;
  }

  function normalizePDiagram(source = {}) {
    const diagram = emptyPDiagram(source);
    for (const field of ['inputSignals', 'controlFactors', 'intendedOutputs', 'errorStates', 'functionalRequirements', 'constraints', 'verificationMethods']) {
      diagram[field] = normalizeTextList(source[field]);
    }
    diagram.noiseFactors = Object.fromEntries(noiseDefinitions.map(([key]) => [key, normalizeTextList(source.noiseFactors?.[key])]));
    return diagram;
  }

  function boundaryReadiness(boundary = state.boundary) {
    const checks = [
      text(boundary.documentNo),
      text(boundary.systemName),
      boundary.internalElements.length,
      boundary.externalElements.length,
      boundary.interfaces.some(connection => connection.fromId && connection.toId && connection.description)
    ];
    return Math.round(checks.filter(Boolean).length / checks.length * 100);
  }

  function pDiagramReadiness(diagram = state.pDiagram) {
    const noiseCount = noiseDefinitions.reduce((sum, [key]) => sum + diagram.noiseFactors[key].length, 0);
    const checks = [
      text(diagram.documentNo),
      text(diagram.functionText),
      diagram.inputSignals.length,
      noiseCount,
      diagram.controlFactors.length,
      diagram.intendedOutputs.length,
      diagram.errorStates.length,
      diagram.functionalRequirements.length
    ];
    return Math.round(checks.filter(Boolean).length / checks.length * 100);
  }

  function analysisNodeOptions(selectedId = '') {
    const nodes = [...state.boundary.internalElements, ...state.boundary.externalElements];
    return `<option value="">Öğe seçin</option>${nodes.map(node => `<option value="${safe(node.id)}" ${node.id === selectedId ? 'selected' : ''}>${node.type === 'internal' ? 'İÇ' : 'DIŞ'} • ${safe(node.name)}</option>`).join('')}`;
  }

  function analysisStatusOptions(selected) {
    return ['Taslak', 'İncelemede', 'Doğrulandı'].map(value => `<option ${value === selected ? 'selected' : ''}>${value}</option>`).join('');
  }

  function documentMetaMarkup(kind, record) {
    return `<div class="apqp-analysis-meta">
      <label>Doküman no<input data-analysis-meta="${kind}.documentNo" value="${safe(record.documentNo)}"></label>
      <label>Revizyon<input data-analysis-meta="${kind}.revision" value="${safe(record.revision)}" maxlength="8"></label>
      <label>Sorumlu<input data-analysis-meta="${kind}.owner" value="${safe(record.owner)}" placeholder="Tasarım / Ürün ekibi"></label>
      <label>Durum<select data-analysis-meta="${kind}.status">${analysisStatusOptions(record.status)}</select></label>
    </div>`;
  }

  function boundaryMarkup() {
    const boundary = state.boundary;
    const rootMaster = itemMasters().find(master => master.id === boundary.focusItemMasterId);
    const centralName = boundary.systemName || rootMaster?.name || 'Odak sistem / ürün';
    const internal = boundary.internalElements.length
      ? boundary.internalElements.map(node => `<article draggable="true" data-boundary-node="${safe(node.id)}"><span>İÇ</span><b>${safe(node.name)}</b><small>${safe(node.functionText || 'Fonksiyon tanımı bekleniyor')}</small><button type="button" data-boundary-remove-node="${safe(node.id)}" aria-label="Öğeyi kaldır">×</button></article>`).join('')
      : '<p class="analysis-empty-note">Ürün ağacından iç bileşen ekleyin.</p>';
    const external = boundary.externalElements.length
      ? boundary.externalElements.map(node => `<article draggable="true" data-boundary-node="${safe(node.id)}"><span>DIŞ</span><b>${safe(node.name)}</b><small>${safe(node.functionText || 'Arayüz rolü bekleniyor')}</small><button type="button" data-boundary-remove-node="${safe(node.id)}" aria-label="Öğeyi kaldır">×</button></article>`).join('')
      : '<p class="analysis-empty-note">Araç, müşteri, yol, servis veya komşu sistem ekleyin.</p>';
    const connections = boundary.interfaces.length
      ? boundary.interfaces.map((connection, index) => {
        const from = [...boundary.internalElements, ...boundary.externalElements].find(node => node.id === connection.fromId);
        const to = [...boundary.internalElements, ...boundary.externalElements].find(node => node.id === connection.toId);
        const type = interfaceTypes.find(([key]) => key === connection.interfaceType)?.[1] || connection.interfaceType;
        return `<article class="boundary-interface-row">
          <b>${String(index + 1).padStart(2, '0')}</b>
          <span>${safe(from?.name || 'Kaynak?')}</span><i>→</i><span>${safe(to?.name || 'Hedef?')}</span>
          <mark>${safe(type)}</mark><p>${safe(connection.description || 'Açıklama bekleniyor')}</p>
          <button type="button" data-boundary-remove-interface="${safe(connection.id)}">×</button>
        </article>`;
      }).join('')
      : '<p class="analysis-empty-note">En az bir fiziksel, enerji, malzeme veya sinyal arayüzü tanımlayın.</p>';
    return `<div class="apqp-analysis-pane boundary-editor" data-analysis-pane="boundary">
      ${documentMetaMarkup('boundary', boundary)}
      <div class="boundary-definition-grid">
        <label>Sistem / ürün adı *<input data-analysis-meta="boundary.systemName" value="${safe(boundary.systemName)}" placeholder="Sınırı çizilecek sistem"></label>
        <label>Odak ürün kartı<select data-analysis-meta="boundary.focusItemMasterId">${itemOptions(boundary.focusItemMasterId)}</select></label>
        <label class="span-2">Kapsam ve sınır kararı<textarea data-analysis-meta="boundary.scope" rows="2" placeholder="Analize dahil olan ve olmayan öğeler, varsayımlar">${safe(boundary.scope)}</textarea></label>
      </div>
      <div class="boundary-canvas" aria-label="Boundary Diyagramı görsel ön izlemesi">
        <section class="boundary-external-zone"><header><span>DIŞ</span><div><b>Komşu / harici sistemler</b><small>Sınır dışı ancak ürünle etkileşen öğeler</small></div></header><div>${external}</div></section>
        <section class="boundary-system-zone"><header><span>SİSTEM SINIRI</span><b>${safe(centralName)}</b><small>${safe(boundary.documentNo)} • Rev. ${safe(boundary.revision)}</small></header><div>${internal}</div></section>
        <div class="boundary-flow-label"><span>⇄</span><b>${boundary.interfaces.length} tanımlı arayüz</b><small>Sürükleyin veya iki öğeye tıklayın; ok yönü kaynak → hedef olarak kaydedilir.</small></div>
      </div>
      <div class="boundary-builder-grid">
        <section><header><b>İç sistem öğesi ekle</b><small>BOM / ürün kartlarından seçilir</small></header>
          <div class="analysis-add-row"><select id="boundaryInternalMaster">${itemOptions('')}</select><input id="boundaryInternalFunction" placeholder="Bileşenin sistemdeki fonksiyonu"><button type="button" data-apqp-action="add-boundary-internal">Ekle</button></div>
        </section>
        <section><header><b>Dış sistem / aktör ekle</b><small>Sınır dışındaki etkileşim kaynağı</small></header>
          <div class="analysis-add-row"><input id="boundaryExternalName" placeholder="Örn. direksiyon kutusu, yol, servis"><input id="boundaryExternalFunction" placeholder="Etkileşim rolü"><button type="button" data-apqp-action="add-boundary-external">Ekle</button></div>
        </section>
      </div>
      <section class="boundary-interface-builder">
        <header><div><b>Arayüz bağlantıları</b><small>Öğeyi diğer öğeye sürükleyin veya sırayla iki öğeye tıklayın; bağlantı oku otomatik oluşur.</small></div><mark>${boundary.interfaces.length} BAĞLANTI</mark></header>
        <div class="analysis-add-row interface-add-row">
          <select id="boundaryInterfaceFrom">${analysisNodeOptions()}</select>
          <span>→</span>
          <select id="boundaryInterfaceTo">${analysisNodeOptions()}</select>
          <select id="boundaryInterfaceType">${interfaceTypes.map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select>
          <input id="boundaryInterfaceDescription" placeholder="Ne aktarılır / nasıl temas eder?">
          <button type="button" data-apqp-action="add-boundary-interface">Bağla</button>
        </div>
        <div class="boundary-interface-list">${connections}</div>
      </section>
    </div>`;
  }

  function pListMarkup(field, title, hint, tone) {
    const values = state.pDiagram[field];
    return `<section class="p-diagram-card ${tone}">
      <header><div><b>${safe(title)}</b><small>${safe(hint)}</small></div><mark>${values.length}</mark></header>
      <div class="p-diagram-values">${values.length ? values.map(value => `<span>${safe(value.text)}<button type="button" data-p-remove="${field}:${safe(value.id)}">×</button></span>`).join('') : '<i>Henüz kayıt yok</i>'}</div>
      <div class="p-diagram-add"><input data-p-input="${field}" placeholder="Yeni madde yazın"><button type="button" data-p-add="${field}">＋</button></div>
    </section>`;
  }

  function pNoiseMarkup() {
    return noiseDefinitions.map(([key, code, label]) => {
      const values = state.pDiagram.noiseFactors[key];
      return `<section class="p-noise-card"><header><span>${code}</span><div><b>${safe(label)}</b><small>${values.length} etken</small></div></header>
        <div>${values.map(value => `<mark>${safe(value.text)}<button type="button" data-p-noise-remove="${key}:${safe(value.id)}">×</button></mark>`).join('') || '<i>Tanım bekleniyor</i>'}</div>
        <footer><input data-p-noise-input="${key}" placeholder="Gürültü etkeni"><button type="button" data-p-noise-add="${key}">＋</button></footer>
      </section>`;
    }).join('');
  }

  function pDiagramMarkup() {
    const diagram = state.pDiagram;
    return `<div class="apqp-analysis-pane p-diagram-editor" data-analysis-pane="pDiagram">
      ${documentMetaMarkup('pDiagram', diagram)}
      <div class="p-diagram-definition-grid">
        <label>Sistem<input data-analysis-meta="pDiagram.system" value="${safe(diagram.system)}" placeholder="Örn. direksiyon sistemi"></label>
        <label>Alt sistem<input data-analysis-meta="pDiagram.subsystem" value="${safe(diagram.subsystem)}" placeholder="Örn. bağlantı / yönlendirme"></label>
        <label>Bileşen / mamul<input data-analysis-meta="pDiagram.component" value="${safe(diagram.component)}"></label>
        <label>Fonksiyon ID<input data-analysis-meta="pDiagram.functionId" value="${safe(diagram.functionId)}" placeholder="FUN-001"></label>
        <label class="span-4">İdeal fonksiyon *<textarea data-analysis-meta="pDiagram.functionText" rows="2" placeholder="Ürün neyi, hangi koşulda ve ölçülebilir biçimde yapmalıdır?">${safe(diagram.functionText)}</textarea></label>
      </div>
      <div class="p-noise-band"><header><span>GÜRÜLTÜ FAKTÖRLERİ</span><small>Kontrol edilemeyen veya normal kullanımda değişen etkenler</small></header><div>${pNoiseMarkup()}</div></div>
      <div class="p-diagram-flow">
        ${pListMarkup('inputSignals', 'Girdi sinyalleri', 'Enerji, bilgi, malzeme veya kullanıcı komutu', 'input')}
        <i class="p-flow-arrow">→</i>
        <section class="p-function-block"><span>ODAK FONKSİYON</span><b>${safe(diagram.functionText || 'İdeal fonksiyon tanımı bekleniyor')}</b><small>${safe(diagram.functionId || 'Fonksiyon ID bekleniyor')} • ${safe(diagram.component || 'Ürün')}</small></section>
        <i class="p-flow-arrow">→</i>
        <div class="p-output-stack">${pListMarkup('intendedOutputs', 'İstenen çıktılar', 'Ölçülebilir performans ve davranış', 'output')}${pListMarkup('errorStates', 'İstenmeyen çıktılar', 'Potansiyel hata durumları / sapmalar', 'failure')}</div>
      </div>
      <div class="p-control-band">${pListMarkup('controlFactors', 'Kontrol faktörleri', 'Tasarımcının belirlediği parametreler', 'control')}</div>
      <div class="p-evidence-grid">
        ${pListMarkup('functionalRequirements', 'Fonksiyonel gereklilikler', 'DFMEA gereksinim girdisi', 'requirement')}
        ${pListMarkup('constraints', 'Fonksiyonel olmayan kısıtlar', 'Paketleme, ağırlık, tolerans veya mevzuat', 'constraint')}
        ${pListMarkup('verificationMethods', 'DVP&R doğrulama yöntemleri', 'Test, analiz ve ölçüm kanıtı', 'verification')}
      </div>
    </div>`;
  }

  function newRow(overrides = {}) {
    const generatedId = overrides.id || `TRACE-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
    return {
      vocId: '', vocText: '', importance: '3',
      productCharacteristic: '', productCharacteristicId: '',
      partCharacteristic: '', characteristicId: '', itemMasterId: '',
      specialClass: '', boundaryRef: state.boundary?.documentNo || '', pDiagramRef: state.pDiagram?.documentNo || '',
      functionId: '', dfmeaRef: '', dvprRef: '',
      operationCode: '', processParameter: '',
      pfmeaRef: '', controlMethod: '', controlPlanRef: '', workInstructionRef: '',
      owner: '', status: 'Taslak', ...overrides,
      id: generatedId,
      sequence: Number(overrides.sequence || state.rows.length + 1)
    };
  }

  function resequence() {
    state.rows.forEach((row, index) => { row.sequence = index + 1; });
  }

  function itemOptions(selectedId) {
    const options = itemMasters().map(master => `<option value="${safe(master.id)}" ${master.id === selectedId ? 'selected' : ''}>${safe(master.internalCode || 'KOD BEKLİYOR')} • ${safe(master.name || master.id)}</option>`).join('');
    return `<option value="">Bileşen / mamul seçin</option>${options}`;
  }

  function characteristicOptions(selectedId) {
    return `<option value="">Teknik karakteristik seçin</option>${characteristicRows().map(item => `<option value="${safe(item.id)}" ${item.id === selectedId ? 'selected' : ''}>${safe(item.balloon || '—')} • ${safe(item.name)} • ${safe(typeof specificationFor === 'function' ? specificationFor(item) : item.specText || '')}</option>`).join('')}`;
  }

  function operationOptions(selectedCode) {
    let entries = [];
    try { entries = typeof operationCodeEntries === 'function' ? operationCodeEntries() : []; } catch {}
    return `<option value="">380 standart karttan seçin</option>${entries.map(record => `<option value="${safe(record.code)}" ${String(record.code) === String(selectedCode) ? 'selected' : ''}>[${safe(record.code)}] ${safe(record.labels?.tr || '')} / ${safe(record.labels?.en || '')}</option>`).join('')}`;
  }

  function rowCompleteness(row) {
    const required = [
      row.vocText, row.productCharacteristic, row.partCharacteristic,
      row.itemMasterId, row.operationCode, row.processParameter, row.controlMethod
    ];
    return Math.round(required.filter(value => text(value)).length / required.length * 100);
  }

  function stageComplete(row, stage) {
    const tests = {
      voc: () => row.vocId && row.vocText,
      qfd: () => row.productCharacteristic && row.partCharacteristic,
      boundary: () => row.boundaryRef && boundaryReadiness() === 100,
      pDiagram: () => row.pDiagramRef && pDiagramReadiness() === 100,
      dfmea: () => row.dfmeaRef,
      dvpr: () => row.dvprRef,
      matrix: () => row.itemMasterId && row.characteristicId,
      flow: () => row.operationCode,
      pfmea: () => row.pfmeaRef,
      control: () => row.controlMethod && row.controlPlanRef,
      instruction: () => row.workInstructionRef
    };
    return Boolean(tests[stage]?.());
  }

  function renderChain() {
    const host = document.getElementById('apqpEvidenceChain');
    if (!host) return;
    host.innerHTML = chainDefinitions.map(([key, label, description], index) => {
      const complete = state.rows.filter(row => stageComplete(row, key)).length;
      const percent = state.rows.length ? Math.round(complete / state.rows.length * 100) : 0;
      const openable = key === 'boundary' || key === 'pDiagram';
      return `<article class="${percent === 100 && state.rows.length ? 'ready' : percent ? 'progress' : ''} ${openable ? 'openable' : ''}" ${openable ? `data-open-analysis="${key}" tabindex="0" role="button"` : ''}><span>${String(index + 1).padStart(2, '0')}</span><div><b>${safe(label)}</b><small>${safe(description)}</small></div><mark>${complete}/${state.rows.length}</mark>${index < chainDefinitions.length - 1 ? '<i>→</i>' : ''}</article>`;
    }).join('');
    host.querySelectorAll('[data-open-analysis]').forEach(card => {
      const open = () => {
        state.activeAnalysisTab = card.dataset.openAnalysis;
        renderAnalysisStudio();
        document.getElementById('apqpAnalysisStudio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    });
  }

  function refreshStructuredReferences() {
    for (const row of state.rows) {
      if (!row.boundaryRef) row.boundaryRef = state.boundary.documentNo;
      if (!row.pDiagramRef) row.pDiagramRef = state.pDiagram.documentNo;
    }
  }

  function updateAnalysisMeta(path, value) {
    const [section, field] = path.split('.');
    if (!state[section] || !field) return;
    const previous = state[section][field];
    state[section][field] = value;
    if (section === 'boundary' && field === 'documentNo') {
      state.rows.forEach(row => { if (!row.boundaryRef || row.boundaryRef === previous) row.boundaryRef = value; });
    }
    if (section === 'pDiagram' && field === 'documentNo') {
      state.rows.forEach(row => { if (!row.pDiagramRef || row.pDiagramRef === previous) row.pDiagramRef = value; });
    }
    notifyChange();
    render();
  }

  function addBoundaryInternal() {
    const masterId = text(document.getElementById('boundaryInternalMaster')?.value);
    const master = itemMasters().find(item => item.id === masterId);
    if (!master) {
      try { toast('İç öğe seçilmedi', 'Önce ürün / malzeme kartlarından bir bileşen seçin.'); } catch {}
      return;
    }
    if (state.boundary.internalElements.some(node => node.itemMasterId === masterId)) {
      try { toast('Öğe zaten sınır içinde', `${master.internalCode || ''} ${master.name || ''}`); } catch {}
      return;
    }
    state.boundary.internalElements.push({
      id: uid('INT'),
      itemMasterId: masterId,
      name: text(master.name) || text(master.internalCode) || masterId,
      functionText: text(document.getElementById('boundaryInternalFunction')?.value),
      type: 'internal'
    });
    notifyChange(); render();
  }

  function addBoundaryExternal() {
    const input = document.getElementById('boundaryExternalName');
    const name = text(input?.value);
    if (!name) {
      try { toast('Dış sistem adı gerekli', 'Komşu sistem, kullanıcı, çevre veya servis aktörünü yazın.'); } catch {}
      input?.focus(); return;
    }
    state.boundary.externalElements.push({
      id: uid('EXT'),
      itemMasterId: '',
      name,
      functionText: text(document.getElementById('boundaryExternalFunction')?.value),
      type: 'external'
    });
    notifyChange(); render();
  }

  function connectBoundaryNodes(fromId, toId, description = '', interfaceType = 'physical') {
    const nodes = [...state.boundary.internalElements, ...state.boundary.externalElements];
    const from = nodes.find(node => node.id === fromId);
    const to = nodes.find(node => node.id === toId);
    if (!from || !to || fromId === toId) return false;
    const existing = state.boundary.interfaces.find(connection => connection.fromId === fromId && connection.toId === toId);
    if (existing) {
      try { toast('Arayüz zaten bağlı', `${from.name} → ${to.name}`); } catch {}
      return false;
    }
    state.boundary.interfaces.push({
      id: uid('IF'), fromId, toId,
      interfaceType: interfaceTypes.some(([key]) => key === interfaceType) ? interfaceType : 'physical',
      description: text(description) || `${from.name} → ${to.name} aktarımı`,
      requirement: '', characteristicId: ''
    });
    state.boundaryConnectSourceId = '';
    notifyChange(); render();
    return true;
  }

  function addBoundaryInterface() {
    const fromId = text(document.getElementById('boundaryInterfaceFrom')?.value);
    const toId = text(document.getElementById('boundaryInterfaceTo')?.value);
    const description = text(document.getElementById('boundaryInterfaceDescription')?.value);
    if (!fromId || !toId || fromId === toId || !description) {
      try { toast('Arayüz tamamlanmadı', 'Farklı kaynak/hedef öğeleri ile transfer açıklamasını girin.'); } catch {}
      return;
    }
    connectBoundaryNodes(fromId, toId, description, text(document.getElementById('boundaryInterfaceType')?.value) || 'physical');
  }

  function addPValue(field, input) {
    const value = text(input?.value);
    if (!value || !Array.isArray(state.pDiagram[field])) return;
    state.pDiagram[field].push({ id: uid('VAL'), text: value });
    notifyChange(); render();
  }

  function seedAnalysisFromProduct() {
    const masters = itemMasters();
    const root = masters.find(master => master.id === engineeringUniverse?.rootItemMasterId) || masters.find(master => /ana mamul/i.test(master.itemType || '')) || masters[0];
    const previousBoundaryNo = state.boundary.documentNo;
    const previousPDiagramNo = state.pDiagram.documentNo;
    if (!previousBoundaryNo || /YEN[Iİ]|NEW/i.test(previousBoundaryNo)) state.boundary.documentNo = analysisDocumentNumber('BD');
    if (!previousPDiagramNo || /YEN[Iİ]|NEW/i.test(previousPDiagramNo)) state.pDiagram.documentNo = analysisDocumentNumber('PD');
    if (state.boundary.documentNo !== previousBoundaryNo) state.rows.forEach(row => { if (!row.boundaryRef || row.boundaryRef === previousBoundaryNo) row.boundaryRef = state.boundary.documentNo; });
    if (state.pDiagram.documentNo !== previousPDiagramNo) state.rows.forEach(row => { if (!row.pDiagramRef || row.pDiagramRef === previousPDiagramNo) row.pDiagramRef = state.pDiagram.documentNo; });
    state.boundary.revision ||= text(document.getElementById('drawingRevision')?.value) || 'A';
    state.pDiagram.revision ||= text(document.getElementById('drawingRevision')?.value) || 'A';
    state.boundary.systemName ||= text(document.getElementById('partName')?.value) || root?.name || '';
    state.boundary.focusItemMasterId ||= root?.id || '';
    const existing = new Set(state.boundary.internalElements.map(node => node.itemMasterId));
    const componentMasters = masters.filter(master => master.id !== root?.id);
    const seedMasters = componentMasters.length ? componentMasters : root ? [root] : [];
    seedMasters.filter(master => !existing.has(master.id)).forEach(master => {
      state.boundary.internalElements.push({
        id: uid('INT'),
        itemMasterId: master.id,
        name: text(master.name) || text(master.internalCode) || master.id,
        functionText: '',
        type: 'internal'
      });
    });
    state.pDiagram.component ||= state.boundary.systemName;
    const firstTrace = state.rows.find(row => row.productCharacteristic || row.functionId);
    state.pDiagram.functionId ||= firstTrace?.functionId || '';
    state.pDiagram.functionText ||= firstTrace?.productCharacteristic || '';
    refreshStructuredReferences();
    notifyChange(); render();
    try { toast('Analiz omurgası başlatıldı', `${state.boundary.internalElements.length} iç sistem öğesi ürün kartlarından Boundary diyagramına alındı.`); } catch {}
  }

  function bindAnalysisWorkspace(host) {
    host.querySelectorAll('[data-analysis-meta]').forEach(field => {
      field.addEventListener('change', event => updateAnalysisMeta(event.target.dataset.analysisMeta, event.target.value));
    });
    host.querySelector('[data-apqp-action="add-boundary-internal"]')?.addEventListener('click', addBoundaryInternal);
    host.querySelector('[data-apqp-action="add-boundary-external"]')?.addEventListener('click', addBoundaryExternal);
    host.querySelector('[data-apqp-action="add-boundary-interface"]')?.addEventListener('click', addBoundaryInterface);
    host.querySelectorAll('[data-boundary-node]').forEach(node => {
      node.addEventListener('dragstart', event => {
        state.boundaryConnectSourceId = node.dataset.boundaryNode;
        event.dataTransfer?.setData('application/x-tyana-boundary-node', state.boundaryConnectSourceId);
        event.dataTransfer?.setData('text/plain', state.boundaryConnectSourceId);
        node.classList.add('boundary-node-dragging');
      });
      node.addEventListener('dragover', event => {
        const source = state.boundaryConnectSourceId || event.dataTransfer?.getData('application/x-tyana-boundary-node');
        if (!source || source === node.dataset.boundaryNode) return;
        event.preventDefault(); node.classList.add('boundary-node-drop-target');
      });
      node.addEventListener('dragleave', () => node.classList.remove('boundary-node-drop-target'));
      node.addEventListener('drop', event => {
        event.preventDefault();
        const source = state.boundaryConnectSourceId || event.dataTransfer?.getData('application/x-tyana-boundary-node') || event.dataTransfer?.getData('text/plain');
        node.classList.remove('boundary-node-drop-target');
        if (source && source !== node.dataset.boundaryNode) connectBoundaryNodes(source, node.dataset.boundaryNode);
      });
      node.addEventListener('dragend', () => { state.boundaryConnectSourceId = ''; node.classList.remove('boundary-node-dragging', 'boundary-node-drop-target'); });
      node.addEventListener('click', event => {
        if (event.target.closest('button')) return;
        const id = node.dataset.boundaryNode;
        if (!state.boundaryConnectSourceId) {
          state.boundaryConnectSourceId = id; node.classList.add('boundary-node-connect-source');
          try { toast('Bağlantı kaynağı seçildi', 'Şimdi hedef öğeye tıklayın veya sürükleyin.'); } catch {}
          return;
        }
        const source = state.boundaryConnectSourceId;
        if (source === id) { state.boundaryConnectSourceId = ''; node.classList.remove('boundary-node-connect-source'); return; }
        connectBoundaryNodes(source, id);
      });
    });
    host.querySelectorAll('[data-boundary-remove-node]').forEach(button => button.addEventListener('click', () => {
      const id = button.dataset.boundaryRemoveNode;
      state.boundary.internalElements = state.boundary.internalElements.filter(node => node.id !== id);
      state.boundary.externalElements = state.boundary.externalElements.filter(node => node.id !== id);
      state.boundary.interfaces = state.boundary.interfaces.filter(connection => connection.fromId !== id && connection.toId !== id);
      notifyChange(); render();
    }));
    host.querySelectorAll('[data-boundary-remove-interface]').forEach(button => button.addEventListener('click', () => {
      state.boundary.interfaces = state.boundary.interfaces.filter(connection => connection.id !== button.dataset.boundaryRemoveInterface);
      notifyChange(); render();
    }));
    host.querySelectorAll('[data-p-add]').forEach(button => button.addEventListener('click', () => {
      addPValue(button.dataset.pAdd, host.querySelector(`[data-p-input="${button.dataset.pAdd}"]`));
    }));
    host.querySelectorAll('[data-p-input]').forEach(input => input.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); addPValue(input.dataset.pInput, input); }
    }));
    host.querySelectorAll('[data-p-remove]').forEach(button => button.addEventListener('click', () => {
      const [field, id] = button.dataset.pRemove.split(':');
      state.pDiagram[field] = state.pDiagram[field].filter(value => value.id !== id);
      notifyChange(); render();
    }));
    host.querySelectorAll('[data-p-noise-add]').forEach(button => button.addEventListener('click', () => {
      const key = button.dataset.pNoiseAdd;
      const input = host.querySelector(`[data-p-noise-input="${key}"]`);
      const value = text(input?.value);
      if (!value) return;
      state.pDiagram.noiseFactors[key].push({ id: uid('NOISE'), text: value });
      notifyChange(); render();
    }));
    host.querySelectorAll('[data-p-noise-input]').forEach(input => input.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const key = input.dataset.pNoiseInput;
      const value = text(input.value);
      if (!value) return;
      state.pDiagram.noiseFactors[key].push({ id: uid('NOISE'), text: value });
      notifyChange(); render();
    }));
    host.querySelectorAll('[data-p-noise-remove]').forEach(button => button.addEventListener('click', () => {
      const [key, id] = button.dataset.pNoiseRemove.split(':');
      state.pDiagram.noiseFactors[key] = state.pDiagram.noiseFactors[key].filter(value => value.id !== id);
      notifyChange(); render();
    }));
  }

  function renderAnalysisStudio() {
    const host = document.getElementById('apqpAnalysisWorkspace');
    if (!host) return;
    document.querySelectorAll('[data-apqp-analysis-tab]').forEach(button => button.classList.toggle('active', button.dataset.apqpAnalysisTab === state.activeAnalysisTab));
    const boundaryProgress = document.getElementById('apqpBoundaryReadiness');
    const pProgress = document.getElementById('apqpPDiagramReadiness');
    if (boundaryProgress) boundaryProgress.textContent = `${boundaryReadiness()}%`;
    if (pProgress) pProgress.textContent = `${pDiagramReadiness()}%`;
    host.innerHTML = state.activeAnalysisTab === 'pDiagram' ? pDiagramMarkup() : boundaryMarkup();
    bindAnalysisWorkspace(host);
  }

  function renderCoverage() {
    const values = state.rows.map(rowCompleteness);
    const coverage = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
    const value = document.getElementById('apqpCoverageValue');
    const bar = document.getElementById('apqpCoverageBar');
    const note = document.getElementById('apqpCoverageNote');
    if (value) value.textContent = `${coverage}%`;
    if (bar) bar.style.width = `${coverage}%`;
    if (note) {
      const completeRows = values.filter(score => score === 100).length;
      note.textContent = state.rows.length
        ? `${completeRows}/${state.rows.length} satır temel QFD–proses–kontrol bağını tamamladı. Boundary, P-Diyagramı, DFMEA ve DVP&R referansları ayrıca izlenir.`
        : 'İlk VOC veya teknik karakteristik satırını ekleyin.';
    }
    return coverage;
  }

  function rowMarkup(row) {
    const completion = rowCompleteness(row);
    return `<article class="apqp-traceability-row" draggable="true" data-apqp-row="${safe(row.id)}">
      <header><span class="apqp-row-drag" title="Sürükleyerek sırala">⋮⋮</span><span class="apqp-row-number">${String(row.sequence).padStart(2, '0')}</span><div><b>${safe(row.vocId || `TRACE-${row.sequence}`)} • ${safe(row.productCharacteristic || 'Ürün karakteristiği bekleniyor')}</b><small>${safe(row.partCharacteristic || 'Parça karakteristiği')} → ${safe(row.operationCode || 'operasyon bekleniyor')}</small></div><mark style="--completion:${completion}%">${completion}%</mark><select data-apqp-field="status"><option ${row.status === 'Taslak' ? 'selected' : ''}>Taslak</option><option ${row.status === 'İncelemede' ? 'selected' : ''}>İncelemede</option><option ${row.status === 'Doğrulandı' ? 'selected' : ''}>Doğrulandı</option></select><button type="button" data-apqp-duplicate title="Satırı kopyala">⧉</button><button type="button" data-apqp-delete title="Satırı sil">×</button></header>
      <div class="apqp-phase-grid">
        <fieldset class="qfd-phase"><legend><span>QFD-1</span> Müşteri sesi → ürün karakteristiği</legend>
          <label>VOC kimliği<input data-apqp-field="vocId" value="${safe(row.vocId)}" placeholder="VOC-001"></label>
          <label class="span-2">Müşteri isteği<textarea data-apqp-field="vocText" rows="2" placeholder="Müşterinin ölçülebilir ihtiyacı">${safe(row.vocText)}</textarea></label>
          <label>Önem<select data-apqp-field="importance">${['1','2','3','4','5'].map(value => `<option ${value === String(row.importance) ? 'selected' : ''}>${value}</option>`).join('')}</select></label>
          <label class="span-2">Ürün karakteristiği<input data-apqp-field="productCharacteristic" value="${safe(row.productCharacteristic)}" placeholder="Fonksiyonel / performans gereği"></label>
        </fieldset>
        <fieldset class="design-phase"><legend><span>QFD-2</span> Parça ve tasarım doğrulaması</legend>
          <label class="span-2">Teknik karakteristik<select data-apqp-field="characteristicId">${characteristicOptions(row.characteristicId)}</select></label>
          <label class="span-2">Parça karakteristiği<input data-apqp-field="partCharacteristic" value="${safe(row.partCharacteristic)}" placeholder="Ölçü, tolerans, malzeme veya performans"></label>
          <label class="span-2">Bağlı parça / alt montaj<select data-apqp-field="itemMasterId">${itemOptions(row.itemMasterId)}</select></label>
          <label>Özel sınıf<select data-apqp-field="specialClass"><option value="">Normal</option><option value="SC" ${row.specialClass === 'SC' ? 'selected' : ''}>SC • Özel</option><option value="CC" ${row.specialClass === 'CC' ? 'selected' : ''}>CC • Kritik</option><option value="KPC" ${row.specialClass === 'KPC' ? 'selected' : ''}>KPC</option></select></label>
          <label>Fonksiyon ID<input data-apqp-field="functionId" value="${safe(row.functionId)}" placeholder="FUN-001"></label>
        </fieldset>
        <fieldset class="analysis-phase"><legend><span>TASARIM</span> Boundary → P-Diyagramı → DFMEA → DVP&R</legend>
          <label>Boundary ref.<span class="analysis-reference-field"><input data-apqp-field="boundaryRef" value="${safe(row.boundaryRef)}" placeholder="BD-001"><button type="button" data-open-row-analysis="boundary" title="Boundary editörünü aç">Aç</button></span></label>
          <label>P-Diyagramı ref.<span class="analysis-reference-field"><input data-apqp-field="pDiagramRef" value="${safe(row.pDiagramRef)}" placeholder="PD-001"><button type="button" data-open-row-analysis="pDiagram" title="P-Diyagramı editörünü aç">Aç</button></span></label>
          <label>DFMEA satır ref.<input data-apqp-field="dfmeaRef" value="${safe(row.dfmeaRef)}" placeholder="DFMEA-FUN-001"></label>
          <label>DVP&R test ref.<input data-apqp-field="dvprRef" value="${safe(row.dvprRef)}" placeholder="DVP-001"></label>
        </fieldset>
        <fieldset class="process-phase"><legend><span>QFD-3/4</span> Proses → PFMEA → Kontrol Planı → Talimat</legend>
          <label class="span-2">Standart operasyon<select data-apqp-field="operationCode">${operationOptions(row.operationCode)}</select></label>
          <label class="span-2">Proses parametresi<input data-apqp-field="processParameter" value="${safe(row.processParameter)}" placeholder="Kontrol edilecek üretim parametresi"></label>
          <label>PFMEA ref.<input data-apqp-field="pfmeaRef" value="${safe(row.pfmeaRef)}" placeholder="PFMEA satır ID"></label>
          <label>Kontrol planı ref.<input data-apqp-field="controlPlanRef" value="${safe(row.controlPlanRef)}" placeholder="CP satır ID"></label>
          <label class="span-2">Kontrol yöntemi<input data-apqp-field="controlMethod" value="${safe(row.controlMethod)}" placeholder="Cihaz, numune ve sıklık"></label>
          <label>İş talimatı ref.<input data-apqp-field="workInstructionRef" value="${safe(row.workInstructionRef)}" placeholder="WI / TTI no"></label>
          <label>Sorumlu<input data-apqp-field="owner" value="${safe(row.owner)}" placeholder="Kalite / Proses"></label>
        </fieldset>
      </div>
    </article>`;
  }

  function updateRow(rowId, field, value) {
    const row = state.rows.find(item => item.id === rowId);
    if (!row) return;
    row[field] = value;
    if (field === 'characteristicId' && value) {
      const characteristic = characteristicRows().find(item => item.id === value);
      if (characteristic) {
        row.partCharacteristic = `${characteristic.name} • ${typeof specificationFor === 'function' ? specificationFor(characteristic) : characteristic.specText || ''}`;
        row.productCharacteristic ||= characteristic.definition || characteristic.name;
        row.itemMasterId ||= characteristic.componentId === 'FINISHED_GOOD'
          ? itemMasters().find(master => master.id === engineeringUniverse?.rootItemMasterId)?.id || ''
          : characteristic.componentId || '';
        row.specialClass ||= /kritik/i.test(characteristic.classification || '') ? 'CC' : /özel/i.test(characteristic.classification || '') ? 'SC' : '';
        row.controlMethod ||= [characteristic.method, characteristic.equipmentClass, characteristic.sampleSize && `${characteristic.sampleSize} adet`, characteristic.frequency].filter(Boolean).join(' • ');
        row.controlPlanRef ||= characteristic.controlPlanRowId || characteristic.id;
      }
    }
    notifyChange();
    render();
  }

  function bindRows(host) {
    host.querySelectorAll('[data-apqp-row]').forEach(card => {
      const rowId = card.dataset.apqpRow;
      card.querySelectorAll('[data-apqp-field]').forEach(field => {
        field.addEventListener('change', event => updateRow(rowId, event.target.dataset.apqpField, event.target.value));
      });
      card.querySelectorAll('[data-open-row-analysis]').forEach(button => button.addEventListener('click', () => {
        state.activeAnalysisTab = button.dataset.openRowAnalysis;
        renderAnalysisStudio();
        document.getElementById('apqpAnalysisStudio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }));
      card.querySelector('[data-apqp-duplicate]')?.addEventListener('click', () => {
        const source = state.rows.find(row => row.id === rowId);
        if (!source) return;
        const index = state.rows.findIndex(row => row.id === rowId);
        state.rows.splice(index + 1, 0, newRow({ ...clone(source), id: undefined, sequence: index + 2, status: 'Taslak' }));
        resequence(); notifyChange(); render();
      });
      card.querySelector('[data-apqp-delete]')?.addEventListener('click', () => {
        state.rows = state.rows.filter(row => row.id !== rowId);
        resequence(); notifyChange(); render();
      });
      card.addEventListener('dragstart', event => {
        draggedRowId = rowId;
        card.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-tyana-apqp-row', rowId);
      });
      card.addEventListener('dragend', () => { draggedRowId = null; card.classList.remove('dragging'); });
      card.addEventListener('dragover', event => { if (!draggedRowId || draggedRowId === rowId) return; event.preventDefault(); card.classList.add('drop-target'); });
      card.addEventListener('dragleave', () => card.classList.remove('drop-target'));
      card.addEventListener('drop', event => {
        event.preventDefault(); card.classList.remove('drop-target');
        const from = state.rows.findIndex(row => row.id === draggedRowId);
        const to = state.rows.findIndex(row => row.id === rowId);
        if (from < 0 || to < 0 || from === to) return;
        const [moved] = state.rows.splice(from, 1);
        state.rows.splice(to, 0, moved);
        resequence(); draggedRowId = null; notifyChange(); render();
      });
    });
  }

  function render() {
    const studio = document.getElementById('apqpTraceabilityStudio');
    if (!studio) return;
    const profile = document.getElementById('apqpFmeaProfile');
    const priority = document.getElementById('apqpPriorityMethod');
    if (profile) profile.value = state.fmeaProfile;
    if (priority) priority.value = state.priorityMethod;
    renderChain();
    renderAnalysisStudio();
    const host = document.getElementById('apqpTraceabilityRows');
    host.innerHTML = state.rows.length
      ? state.rows.map(rowMarkup).join('')
      : '<div class="apqp-empty"><span>QFD</span><h4>Kanıt zinciri için başlangıç satırı yok</h4><p>Teknik resim karakteristiklerini otomatik eşleyin veya VOC’den başlayarak yeni bir satır açın.</p></div>';
    bindRows(host);
    renderCoverage();
  }

  function notifyChange() {
    try { if (typeof markDraftDirty === 'function') markDraftDirty({ affectsDocuments: true }); } catch {}
    try { if (typeof updateSummary === 'function') updateSummary(); } catch {}
  }

  function addRow(seed = {}) {
    state.rows.push(newRow(seed));
    resequence(); notifyChange(); render();
  }

  function mapCharacteristics() {
    const existing = new Set(state.rows.map(row => row.characteristicId).filter(Boolean));
    const entries = routeEntries();
    const newRows = characteristicRows().filter(item => !existing.has(item.id)).map((item, index) => {
      const route = entries.find(entry => entry.routeKey === item.routeKey)
        || entries.find(entry => entry.process.id === item.processId);
      const pfmea = pfmeaRecords().find(record => record.controlPlanCharacteristicId === item.id || record.processId === item.processId);
      const rootMasterId = itemMasters().find(master => master.id === engineeringUniverse?.rootItemMasterId)?.id || '';
      return newRow({
        sequence: state.rows.length + index + 1,
        vocId: `VOC-${String(state.rows.length + index + 1).padStart(3, '0')}`,
        vocText: text(document.getElementById('customerSpecificRequirements')?.value) || 'Müşteri / ürün fonksiyon şartı doğrulanacak',
        productCharacteristic: item.definition || item.name,
        productCharacteristicId: item.id,
        partCharacteristic: `${item.name} • ${typeof specificationFor === 'function' ? specificationFor(item) : item.specText || ''}`,
        characteristicId: item.id,
        itemMasterId: item.componentId === 'FINISHED_GOOD' ? rootMasterId : item.componentId || '',
        specialClass: /kritik/i.test(item.classification || '') ? 'CC' : /özel/i.test(item.classification || '') ? 'SC' : '',
        functionId: `FUN-${item.balloon || item.id}`,
        operationCode: route?.detail?.operationCode || '',
        processParameter: item.kind === 'Proses' ? item.name : `Üretim parametresi • ${item.name}`,
        pfmeaRef: pfmea?.id || '',
        controlMethod: [item.method, item.equipmentClass, item.sampleSize && `${item.sampleSize} adet`, item.frequency].filter(Boolean).join(' • '),
        controlPlanRef: item.controlPlanRowId || item.id,
        workInstructionRef: route?.process?.workInstruction || '',
        owner: route?.detail?.responsible || 'Kalite / Proses'
      });
    });
    if (!newRows.length) {
      try { toast('Yeni karakteristik bulunamadı', 'Tüm teknik karakteristikler izlenebilirlik matrisinde zaten mevcut.'); } catch {}
      return;
    }
    state.rows.push(...newRows);
    resequence(); notifyChange(); render();
    try { toast('QFD başlangıç matrisi oluşturuldu', `${newRows.length} teknik karakteristik VOC–proses–kontrol zincirine eklendi.`); } catch {}
  }

  function pdfList(items, emptyText = 'Tanım bekleniyor') {
    const values = (items || []).map(item => text(item.text ?? item.name)).filter(Boolean);
    return values.length ? values.map(value => `- ${value}`).join('\n') : `- ${emptyText}`;
  }

  function analysisPdfDefinition() {
    const boundary = state.boundary;
    const diagram = state.pDiagram;
    const allNodes = [...boundary.internalElements, ...boundary.externalElements];
    const interfaceRows = boundary.interfaces.map((connection, index) => {
      const from = allNodes.find(node => node.id === connection.fromId)?.name || 'Tanımsız kaynak';
      const to = allNodes.find(node => node.id === connection.toId)?.name || 'Tanımsız hedef';
      const type = interfaceTypes.find(([key]) => key === connection.interfaceType)?.[1] || connection.interfaceType;
      return [String(index + 1), from, to, type, connection.description || '-'];
    });
    const noiseBody = noiseDefinitions.map(([key, code, label]) => [
      { text: code, bold: true, color: '#8b3a76' },
      { text: label, bold: true },
      pdfList(diagram.noiseFactors[key])
    ]);
    const commonMeta = (record, title) => ({
      table: {
        widths: ['*', 72, 92, 90],
        body: [[
          { text: title, bold: true, color: '#ffffff', fillColor: '#0b3459' },
          { text: `Doküman\n${record.documentNo || '-'}`, color: '#ffffff', fillColor: '#0b3459' },
          { text: `Revizyon\n${record.revision || '-'}`, color: '#ffffff', fillColor: '#0b3459' },
          { text: `Durum\n${record.status || 'Taslak'}`, color: '#ffffff', fillColor: '#0b3459' }
        ]]
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 10]
    });
    const footer = (currentPage, pageCount) => ({
      columns: [
        { text: 'TYANA Q-FLOW - Kontrollü APQP tasarım analizi çıktısı', color: '#587086', fontSize: 7 },
        { text: `Sayfa ${currentPage}/${pageCount}`, alignment: 'right', color: '#587086', fontSize: 7 }
      ],
      margin: [34, 7, 34, 0]
    });
    return {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [34, 30, 34, 28],
      footer,
      content: [
        commonMeta(boundary, 'BOUNDARY DİYAGRAMI / SİSTEM SINIRI'),
        {
          columns: [
            { width: '*', stack: [{ text: 'Sistem / ürün', style: 'label' }, { text: boundary.systemName || 'Tanım bekleniyor', style: 'value' }] },
            { width: '*', stack: [{ text: 'Kapsam ve sınır kararı', style: 'label' }, { text: boundary.scope || 'Tanım bekleniyor', style: 'value' }] },
            { width: 150, stack: [{ text: 'Sorumlu', style: 'label' }, { text: boundary.owner || '-', style: 'value' }] }
          ],
          columnGap: 12,
          margin: [0, 0, 0, 12]
        },
        {
          table: {
            widths: ['*', '*', '*'],
            body: [
              [
                { text: 'SINIR DIŞI / KOMŞU SİSTEMLER', style: 'zoneTitle', fillColor: '#f2e8f5' },
                { text: 'SİSTEM SINIRI', style: 'zoneTitle', fillColor: '#dcecf8' },
                { text: 'İÇ SİSTEM ÖĞELERİ', style: 'zoneTitle', fillColor: '#e3f5f0' }
              ],
              [
                { text: boundary.externalElements.map(node => `- ${node.name}\n   ${node.functionText || 'Rol tanımı bekleniyor'}`).join('\n\n') || '- Dış sistem tanımı yok', style: 'zoneText' },
                { stack: [{ text: boundary.systemName || 'ODAK SİSTEM', bold: true, fontSize: 16, color: '#0b3459', alignment: 'center', margin: [0, 18, 0, 8] }, { text: `${boundary.documentNo || 'BD'} - Rev. ${boundary.revision || 'A'}`, alignment: 'center', color: '#5c7587' }, { text: `\n<-> ${boundary.interfaces.length} kayıtlı arayüz`, alignment: 'center', bold: true, color: '#0b8179' }], fillColor: '#f8fbfd' },
                { text: boundary.internalElements.map(node => `- ${node.name}\n   ${node.functionText || 'Fonksiyon tanımı bekleniyor'}`).join('\n\n') || '- İç sistem öğesi yok', style: 'zoneText' }
              ]
            ]
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 12]
        },
        { text: 'ARAYÜZ BAĞLANTILARI', style: 'sectionTitle' },
        {
          table: {
            headerRows: 1,
            widths: [26, '*', '*', 92, '*'],
            body: [
              ['No', 'Kaynak', 'Hedef', 'Arayüz tipi', 'Transfer / etkileşim açıklaması'].map(value => ({ text: value, style: 'tableHeader' })),
              ...(interfaceRows.length ? interfaceRows : [['-', 'Tanım yok', 'Tanım yok', '-', 'En az bir arayüz bağlantısı girilmelidir.']])
            ]
          },
          layout: 'lightHorizontalLines'
        },
        { text: '', pageBreak: 'after' },
        commonMeta(diagram, 'P-DİYAGRAMI / PARAMETRE DİYAGRAMI'),
        {
          columns: [
            { text: `Sistem\n${diagram.system || '-'}`, style: 'metaBox' },
            { text: `Alt sistem\n${diagram.subsystem || '-'}`, style: 'metaBox' },
            { text: `Bileşen / mamul\n${diagram.component || '-'}`, style: 'metaBox' },
            { text: `Fonksiyon ID\n${diagram.functionId || '-'}`, style: 'metaBox' }
          ],
          columnGap: 8,
          margin: [0, 0, 0, 10]
        },
        { text: 'GÜRÜLTÜ FAKTÖRLERİ', style: 'sectionTitle' },
        { table: { widths: [30, 145, '*'], body: noiseBody }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 12] },
        {
          table: {
            widths: ['*', 28, '*', 28, '*'],
            body: [
              [
                { text: 'GİRDİ SİNYALLERİ', style: 'zoneTitle', fillColor: '#e7f0fb' },
                '',
                { text: 'İDEAL FONKSİYON', style: 'zoneTitle', fillColor: '#dff3ef' },
                '',
                { text: 'İSTENEN / İSTENMEYEN ÇIKTILAR', style: 'zoneTitle', fillColor: '#f8e8e6' }
              ],
              [
                { text: pdfList(diagram.inputSignals), style: 'zoneText' },
                { text: '>>', fontSize: 16, bold: true, color: '#2772b4', alignment: 'center', margin: [0, 26, 0, 0] },
                { stack: [{ text: diagram.functionText || 'İdeal fonksiyon tanımı bekleniyor', bold: true, fontSize: 13, color: '#0a625e', alignment: 'center', margin: [0, 18, 0, 7] }, { text: diagram.functionId || 'Fonksiyon ID bekleniyor', alignment: 'center', color: '#5c7587' }], fillColor: '#f7fbfa' },
                { text: '>>', fontSize: 16, bold: true, color: '#2772b4', alignment: 'center', margin: [0, 26, 0, 0] },
                { stack: [{ text: 'İstenen', bold: true, color: '#157154' }, { text: pdfList(diagram.intendedOutputs), margin: [0, 2, 0, 7] }, { text: 'İstenmeyen', bold: true, color: '#a84141' }, { text: pdfList(diagram.errorStates) }] }
              ]
            ]
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 12]
        },
        { text: 'KONTROL FAKTÖRLERİ', style: 'sectionTitle' },
        { text: pdfList(diagram.controlFactors), style: 'controlBox', margin: [0, 0, 0, 12] },
        {
          columns: [
            { stack: [{ text: 'FONKSİYONEL GEREKLİLİKLER', style: 'miniTitle' }, { text: pdfList(diagram.functionalRequirements), style: 'miniBody' }] },
            { stack: [{ text: 'FONKSİYONEL OLMAYAN KISITLAR', style: 'miniTitle' }, { text: pdfList(diagram.constraints), style: 'miniBody' }] },
            { stack: [{ text: 'DVP&R DOĞRULAMA YÖNTEMLERİ', style: 'miniTitle' }, { text: pdfList(diagram.verificationMethods), style: 'miniBody' }] }
          ],
          columnGap: 10
        }
      ],
      styles: {
        label: { fontSize: 7, bold: true, color: '#678092' },
        value: { fontSize: 10, bold: true, color: '#183d57', margin: [0, 2, 0, 0] },
        zoneTitle: { fontSize: 8, bold: true, color: '#153d59', alignment: 'center' },
        zoneText: { fontSize: 8, color: '#27495f', lineHeight: 1.15 },
        sectionTitle: { fontSize: 9, bold: true, color: '#0b3459', margin: [0, 4, 0, 5] },
        tableHeader: { fontSize: 7, bold: true, color: '#ffffff', fillColor: '#1b5f83' },
        metaBox: { fontSize: 8, color: '#183d57', margin: [6, 6, 6, 6] },
        controlBox: { fontSize: 8, color: '#5b3410', margin: [8, 7, 8, 7] },
        miniTitle: { fontSize: 7, bold: true, color: '#1c5a7d', margin: [7, 6, 7, 6] },
        miniBody: { fontSize: 8, color: '#294a5f', margin: [7, 7, 7, 7] }
      },
      defaultStyle: { font: 'Roboto', fontSize: 8 }
    };
  }

  async function exportAnalysisPdf() {
    if (!globalThis.pdfMake) {
      try { toast('PDF motoru yüklenemedi', 'Uygulama paketini yeniden yükleyin.'); } catch {}
      return;
    }
    const blob = await new Promise((resolve, reject) => {
      try { globalThis.pdfMake.createPdf(analysisPdfDefinition()).getBlob(resolve); }
      catch (error) { reject(error); }
    });
    if (blob.size < 1024) throw new Error('Boundary / P-Diyagramı PDF byte doğrulaması başarısız.');
    const fileName = `${text(document.getElementById('projectCode')?.value) || 'PROJE'}_Boundary_P-Diyagram_Rev-${state.boundary.revision || 'A'}.pdf`.replace(/[<>:"/\\|?*]+/g, '-');
    if (typeof saveBlob === 'function') {
      const result = await saveBlob(blob, fileName, typeof exportFileTypes === 'object' ? exportFileTypes.pdf : undefined, {
        documentType: 'Boundary ve P-Diyagramı PDF',
        revision: state.boundary.revision
      });
      if (result?.saved) {
        try { toast('Boundary ve P-Diyagramı PDF kaydedildi', `${state.boundary.interfaces.length} arayüz • ${noiseDefinitions.reduce((sum, [key]) => sum + state.pDiagram.noiseFactors[key].length, 0)} gürültü etkeni`); } catch {}
      }
      return result;
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
    return { saved: true, method: 'download', fileName };
  }

  function hydrate(snapshot) {
    const incoming = snapshot && typeof snapshot === 'object' ? snapshot : {};
    state = {
      schemaVersion: '2.0.0',
      fmeaProfile: ['foundation', 'family', 'product'].includes(incoming.fmeaProfile) ? incoming.fmeaProfile : 'family',
      priorityMethod: ['AP', 'RPN'].includes(incoming.priorityMethod) ? incoming.priorityMethod : 'AP',
      activeAnalysisTab: ['boundary', 'pDiagram'].includes(incoming.activeAnalysisTab) ? incoming.activeAnalysisTab : 'boundary',
      boundary: normalizeBoundary(incoming.boundary),
      pDiagram: normalizePDiagram(incoming.pDiagram),
      rows: Array.isArray(incoming.rows) ? incoming.rows.map(row => newRow(row)) : []
    };
    refreshStructuredReferences();
    resequence();
    render();
  }

  function reset() {
    state = {
      schemaVersion: '2.0.0',
      fmeaProfile: 'family',
      priorityMethod: 'AP',
      activeAnalysisTab: 'boundary',
      boundary: emptyBoundary(),
      pDiagram: emptyPDiagram(),
      rows: []
    };
    render();
  }

  function bindUi() {
    document.querySelector('[data-apqp-action="add-row"]')?.addEventListener('click', () => addRow());
    document.querySelector('[data-apqp-action="map-characteristics"]')?.addEventListener('click', mapCharacteristics);
    document.querySelector('[data-apqp-action="seed-analysis"]')?.addEventListener('click', seedAnalysisFromProduct);
    document.querySelector('[data-apqp-action="export-analysis-pdf"]')?.addEventListener('click', () => {
      exportAnalysisPdf().catch(error => {
        try { toast('Boundary / P-Diyagramı PDF üretilemedi', error.message); } catch {}
      });
    });
    document.querySelectorAll('[data-apqp-analysis-tab]').forEach(button => button.addEventListener('click', () => {
      state.activeAnalysisTab = button.dataset.apqpAnalysisTab;
      renderAnalysisStudio();
    }));
    document.getElementById('apqpFmeaProfile')?.addEventListener('change', event => { state.fmeaProfile = event.target.value; notifyChange(); render(); });
    document.getElementById('apqpPriorityMethod')?.addEventListener('change', event => { state.priorityMethod = event.target.value; notifyChange(); render(); });
  }

  global.TyanaApqp = Object.freeze({
    render,
    addRow,
    mapCharacteristics,
    seedAnalysisFromProduct,
    exportAnalysisPdf,
    analysisPdfDefinition,
    hydrate,
    reset,
    snapshot: () => clone(state),
    coverage: () => renderCoverage(),
    readiness: () => ({ boundary: boundaryReadiness(), pDiagram: pDiagramReadiness() })
  });

  bindUi();
  render();
})(globalThis);
