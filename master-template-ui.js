(function initializeMasterTemplateUi(global) {
  'use strict';

  const domain = global.TyanaMasterTemplates;
  const platform = global.TyanaPlatform;
  if (!domain || !platform?.data) return;

  const state = { templates: [], selectedId: '', activeRecord: null, saveSnapshot: null, readiness: null, loading: false };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  }

  function activeGroup() {
    const select = document.getElementById('productGroup');
    const customName = document.getElementById('customProductGroupName')?.value.trim() || '';
    const id = select?.value || '';
    const label = id === '__custom__' ? customName : select?.selectedOptions?.[0]?.textContent?.replace(/^＋\s*/, '').trim() || id;
    return { id, label };
  }

  function appRuntime() {
    return global.TyanaProjectRuntime || null;
  }

  function notify(title, detail) {
    if (appRuntime()?.notify) appRuntime().notify(title, detail);
    else console.info(`[TYANA Q-FLOW] ${title}: ${detail}`);
  }

  function slot() {
    return document.getElementById('productGroupMasterTemplateSlot');
  }

  function installDialog() {
    if (document.getElementById('masterTemplateDialog')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <dialog id="masterTemplateDialog" class="master-template-dialog">
        <form id="masterTemplateForm" novalidate>
          <header class="master-template-dialog-head">
            <div><span id="masterTemplateDialogKicker">ÜRÜN GRUBU ANA ŞABLONU</span><h2 id="masterTemplateDialogTitle">Ana şablon</h2><p id="masterTemplateDialogSubtitle"></p></div>
            <button type="button" data-master-template-close aria-label="Kapat">×</button>
          </header>
          <div id="masterTemplateDialogBody" class="master-template-dialog-body"></div>
          <footer class="master-template-dialog-footer"><button type="button" class="secondary-button" data-master-template-close>Vazgeç</button><button id="masterTemplateSubmit" type="submit" class="primary-button">Kaydet</button></footer>
        </form>
      </dialog>`);
    document.querySelectorAll('[data-master-template-close]').forEach(button => button.addEventListener('click', () => document.getElementById('masterTemplateDialog')?.close()));
    document.getElementById('masterTemplateForm')?.addEventListener('submit', submitDialog);
  }

  function renderSlot() {
    const container = slot();
    if (!container) return;
    const group = activeGroup();
    const selected = state.templates.find(item => item.id === state.selectedId);
    const options = state.templates.length
      ? state.templates.map(item => `<option value="${escapeHtml(item.id)}"${item.id === state.selectedId ? ' selected' : ''}>${escapeHtml(item.name)} • v${Number(item.version || 1)}</option>`).join('')
      : '<option value="">Bu grup için kayıtlı ana şablon yok</option>';
    container.innerHTML = `<section class="product-master-template-card${state.loading ? ' loading' : ''}">
      <div class="master-template-icon">MT</div>
      <div class="master-template-copy"><span>ÜRÜN GRUBU ANA ŞABLONU</span><b>${escapeHtml(group.label || 'Önce ürün grubu seçin')}</b><small>BOM, rota, 380 kodlu proses kartı bağlantıları, ölçüler, PFMEA ve kontrol planı eşleştirmelerini tek omurga olarak yeniden kullanın.</small></div>
      <label class="master-template-picker"><span>Kayıtlı omurga</span><select data-master-template-select ${state.templates.length ? '' : 'disabled'}>${options}</select><small>${selected ? `Son güncelleme ${new Date(selected.updatedAt).toLocaleDateString('tr-TR')} • SHA ${escapeHtml(String(selected.contentSha256 || '').slice(0, 10))}…` : 'İlk ürün tamamlandığında ana şablon olarak kaydedin.'}</small></label>
      <div class="master-template-actions">
        <button type="button" class="secondary-button" data-master-template-action="save">Bu Yapıyı Ana Şablon Kaydet</button>
        <button type="button" class="primary-button" data-master-template-action="use" ${selected ? '' : 'disabled'}>Şablondan Yeni Ürün →</button>
      </div>
    </section>`;
    container.querySelector('[data-master-template-select]')?.addEventListener('change', event => { state.selectedId = event.target.value; renderSlot(); });
    container.querySelector('[data-master-template-action="save"]')?.addEventListener('click', () => openSaveDialog());
    container.querySelector('[data-master-template-action="use"]')?.addEventListener('click', () => openUseDialog());
  }

  async function loadTemplates() {
    const group = activeGroup();
    if (!group.id || group.id === '__custom__') {
      state.templates = []; state.selectedId = ''; renderSlot(); return;
    }
    state.loading = true; renderSlot();
    try {
      const result = await platform.data.listMasterTemplates(group.id);
      state.templates = Array.isArray(result?.templates) ? result.templates : [];
      if (!state.templates.some(item => item.id === state.selectedId)) state.selectedId = state.templates[0]?.id || '';
    } catch (error) {
      state.templates = []; state.selectedId = '';
      notify('Ana şablon kütüphanesi açılamadı', error.message || String(error));
    } finally {
      state.loading = false; renderSlot();
    }
  }

  function readinessMarkup(readiness) {
    const issueRows = readiness.issues.length
      ? readiness.issues.map(issue => `<li class="${issue.severity === 'error' ? 'blocking' : 'warning'}"><span>${issue.severity === 'error' ? '×' : '!'}</span>${escapeHtml(issue.message)}</li>`).join('')
      : '<li class="ready"><span>✓</span>BOM, rota, operasyon kodları, ölçüler ve risk bağları ana şablon için hazır.</li>';
    const metrics = readiness.metrics;
    return `<div class="master-template-readiness${readiness.ready ? ' ready' : ' blocked'}">
      <div class="master-template-gate"><span>${readiness.ready ? '✓' : '!'}</span><div><b>${readiness.ready ? 'Ana şablon kalite kapısı hazır' : `${readiness.errors.length} tamamlanması gereken alan var`}</b><small>${readiness.warnings.length} uyarı • kopyalanan her onay yeni üründe tekrar doğrulanır</small></div></div>
      <div class="master-template-metrics"><span><b>${metrics.itemMasters}</b>kart</span><span><b>${metrics.bomDefinitions}</b>BOM</span><span><b>${metrics.routeSteps}</b>operasyon</span><span><b>${metrics.characteristics}</b>ölçü/kontrol</span><span><b>${metrics.pfmeaRows}</b>PFMEA</span></div>
      <ul>${issueRows}</ul>
    </div>`;
  }

  async function openSaveDialog() {
    installDialog();
    const runtime = appRuntime();
    if (!runtime?.captureSnapshot) { notify('Ana şablon kaydı başlatılamadı', 'Ürün snapshot motoru hazır değil.'); return; }
    try {
      state.saveSnapshot = await runtime.captureSnapshot();
      state.readiness = domain.assessReadiness(state.saveSnapshot);
    } catch (error) {
      notify('Ana şablon ön kontrolü yapılamadı', error.message || String(error)); return;
    }
    const group = activeGroup();
    document.getElementById('masterTemplateDialog').dataset.mode = 'save';
    document.getElementById('masterTemplateDialogTitle').textContent = `${group.label} ana omurgasını kaydet`;
    document.getElementById('masterTemplateDialogSubtitle').textContent = 'Kaydedilen omurga yalnız aynı ürün grubunda önerilir; yeni ürün kimliği ve bütün onaylar bilinçli olarak sıfırlanır.';
    document.getElementById('masterTemplateDialogBody').innerHTML = `${readinessMarkup(state.readiness)}
      <div class="master-template-form-grid">
        <label>Şablon adı *<input id="masterTemplateName" maxlength="160" required value="${escapeHtml(`${group.label} • Ana Üretim Omurgası`)}"><small>Aynı grup içinde benzersiz ve anlaşılır bir ad kullanın.</small></label>
        <label>Açıklama<textarea id="masterTemplateDescription" maxlength="500" rows="3" placeholder="Kapsanan mamul tipi, rota veya müşteri özel şartı…"></textarea></label>
      </div>
      <div class="master-template-security-note"><span>⛨</span><p><b>Kimlik ve onay izolasyonu</b><small>OEM No, iç stok kodu, mamul adı, müşteri, proje, kontrol planı ve teknik resim alanları şablonda boş saklanır. Eski PDF/Excel kayıtları, teknik resim dosyası ve elektronik onay durumu kopyalanmaz.</small></p></div>`;
    const submit = document.getElementById('masterTemplateSubmit');
    submit.textContent = state.readiness.ready ? 'Kontrollü Ana Şablonu Kaydet' : 'Eksikleri Tamamlayın';
    submit.disabled = !state.readiness.ready;
    document.getElementById('masterTemplateDialog').showModal();
  }

  function identityFieldMarkup(field) {
    if (field.key === 'productionPhase') return `<label>${escapeHtml(field.label)} *<select data-template-identity="${field.key}" required><option>Seri Üretim</option><option>Safe Launch</option><option>Ön Seri</option><option>Prototip</option></select></label>`;
    const type = field.key === 'annualVolume' ? 'number' : 'text';
    const placeholder = ({ partName: 'Örn. Yeni mamul adı', partNumber: 'Yeni OEM numarası', internalProductCode: 'Yeni ERP / SAP stok kodu', customer: 'Müşteri / OEM', projectCode: 'APQP / proje no', controlPlanNumber: 'Yeni kontrol planı no', drawingNumber: 'Yeni teknik resim no', drawingRevision: 'A' })[field.key] || '';
    return `<label>${escapeHtml(field.label)}${field.required ? ' *' : ''}<input data-template-identity="${field.key}" type="${type}" maxlength="${field.maxLength}" ${field.required ? 'required' : ''} placeholder="${escapeHtml(placeholder)}"></label>`;
  }

  async function openUseDialog() {
    installDialog();
    const metadata = state.templates.find(item => item.id === state.selectedId);
    if (!metadata) return;
    try {
      const result = await platform.data.getMasterTemplate(metadata.id);
      if (!result?.template) throw new Error('Seçili ana şablon bulunamadı.');
      const validation = domain.validateTemplateRecord(result.template);
      if (!validation.valid) throw new Error(validation.issues[0]);
      state.activeRecord = result.template;
    } catch (error) {
      notify('Ana şablon açılamadı', error.message || String(error)); return;
    }
    const payload = state.activeRecord.payload;
    const metrics = payload.metrics || {};
    document.getElementById('masterTemplateDialog').dataset.mode = 'use';
    document.getElementById('masterTemplateDialogTitle').textContent = `${payload.name} üzerinden yeni ürün`;
    document.getElementById('masterTemplateDialogSubtitle').textContent = `${payload.productGroupLabel} • v${state.activeRecord.version} • ${metrics.routeSteps || 0} kodlu operasyon • ${metrics.characteristics || 0} kontrol noktası`;
    document.getElementById('masterTemplateDialogBody').innerHTML = `<div class="master-template-origin-summary">
        <span>ANA ŞABLON</span><div><b>${escapeHtml(payload.name)}</b><small>${escapeHtml(payload.description || 'Ürün grubu kontrollü omurgası')}</small></div><mark>v${Number(state.activeRecord.version || 1)}</mark>
      </div>
      <div class="master-template-identity-intro"><span>01</span><div><b>Yalnız yeni ürün kimliğini girin</b><small>Alt malzeme kartları, çok seviyeli BOM, operasyon sırası, makine/ekipman bağları, PFMEA ve ölçüm planı korunur. Yeni ürün kök kartı ve bütün kontrollü dokümanlar Taslak durumunda açılır.</small></div></div>
      <div class="master-template-identity-grid">${domain.IDENTITY_FIELDS.map(identityFieldMarkup).join('')}</div>
      <div class="master-template-security-note"><span>↻</span><p><b>Yeni kontrollü kopya</b><small>Şablon kaynağı izlenebilirlik amacıyla snapshot'a yazılır. Kaynak ürünün OEM/ERP kimliği, çizim dosyası, çıktı kayıtları ve onayları yeni ürüne taşınmaz.</small></p></div>`;
    const submit = document.getElementById('masterTemplateSubmit'); submit.disabled = false; submit.textContent = 'Yeni Ürün Omurgasını Oluştur →';
    document.getElementById('masterTemplateDialog').showModal();
    document.querySelector('[data-template-identity="partName"]')?.focus();
  }

  async function submitDialog(event) {
    event.preventDefault();
    const dialog = document.getElementById('masterTemplateDialog');
    const submit = document.getElementById('masterTemplateSubmit');
    submit.disabled = true;
    try {
      if (dialog.dataset.mode === 'save') {
        const name = document.getElementById('masterTemplateName').value.trim();
        const description = document.getElementById('masterTemplateDescription').value.trim();
        if (!name) throw new Error('Ana şablon adı zorunludur.');
        const templatePayload = domain.createTemplatePayload(state.saveSnapshot, { name, description });
        const existing = state.templates.find(item => item.name.localeCompare(name, 'tr', { sensitivity: 'base' }) === 0);
        if (existing && !global.confirm(`“${existing.name}” ana şablonu v${existing.version + 1} olarak güncellensin mi?`)) return;
        const request = { name, description, productGroup: templatePayload.productGroup, productGroupLabel: templatePayload.productGroupLabel, schemaVersion: domain.SCHEMA_VERSION, version: existing?.version || 0, templatePayload };
        const result = await platform.data.saveMasterTemplate(request, existing?.id || null);
        dialog.close(); await loadTemplates(); state.selectedId = result.template.id; renderSlot();
        notify('Ürün grubu ana şablonu kaydedildi', `${result.template.name} • v${result.template.version} • BOM, rota, ölçü, PFMEA ve kontrol bağları korundu.`);
      } else if (dialog.dataset.mode === 'use') {
        const identity = Object.fromEntries([...document.querySelectorAll('[data-template-identity]')].map(field => [field.dataset.templateIdentity, field.value.trim()]));
        const snapshot = domain.instantiate(state.activeRecord, identity);
        if (!appRuntime()?.applyMasterTemplate) throw new Error('Yeni ürün uygulama motoru hazır değil.');
        appRuntime().applyMasterTemplate(snapshot);
        dialog.close();
        notify('Yeni ürün omurgası oluşturuldu', `${identity.partName} • ${identity.partNumber} • ${state.activeRecord.payload.metrics.routeSteps} kodlu operasyon ve kalite bağlantıları düzenlemeye hazır.`);
      }
    } catch (error) {
      notify('Ana şablon işlemi tamamlanamadı', error.message || String(error));
    } finally {
      submit.disabled = dialog.open && dialog.dataset.mode === 'save' ? !state.readiness?.ready : false;
    }
  }

  function install() {
    installDialog(); renderSlot(); loadTemplates();
    document.getElementById('productGroup')?.addEventListener('change', () => queueMicrotask(loadTemplates));
    document.getElementById('customProductGroupName')?.addEventListener('change', loadTemplates);
    global.addEventListener('tyana:product-group-changed', loadTemplates);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
  global.TyanaMasterTemplateUi = Object.freeze({ reload: loadTemplates, openSave: openSaveDialog, openUse: openUseDialog });
})(globalThis);
