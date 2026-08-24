(function initializeProductDefinitionWorkspace(global) {
  'use strict';

  const MACHINE_TYPE_LABELS = Object.freeze({
    cnc_tool: 'CNC / İşlem Tezgâhı',
    die_fixture: 'Kalıp / Fikstür',
    gauge_instrument: 'Ölçüm Aleti / Mastar',
    assembly_station: 'Montaj Makinesi / İstasyonu',
    ndt_gauge: 'Çatlak Kontrol / NDT'
  });
  const ROUTING_DISABLED_TYPES = new Set(['RAW_MATERIAL', 'PURCHASED_PART', 'ASSEMBLY_MATERIAL', 'EXTERNAL_PURCHASED', 'FASTENER', 'CONSUMABLE', 'PACKAGING']);
  const WORK_PLAN_TYPES = new Set(['FINISHED_GOOD', 'SUBASSEMBLY', 'SEMI_FINISHED', 'MANUFACTURED_PART']);
  const REQUIRED_WORK_PLAN_TYPES = new Set(['FINISHED_GOOD', 'SUBASSEMBLY', 'SEMI_FINISHED']);
  const state = {
    machines: [], eligibility: [], loaded: false, loading: null,
    routeMachineContext: null, routeMachineCandidates: [], routeMachineDraft: new Set(),
    selectedWorkPlanMasterId: null, draggedOperationCode: ''
  };

  const text = value => String(value ?? '').trim();
  const clone = value => JSON.parse(JSON.stringify(value));
  const operationCodeFromInput = value => {
    const raw = text(value).toUpperCase();
    const bracket = raw.match(/^\[([^\]]+)\]/)?.[1];
    const first = raw.split(/\s+|•|—/)[0];
    return text(bracket || first);
  };
  const operationRecord = code => operationCodeEntries().find(record => String(record.code) === String(code));
  const hasOperationDrag = event => Boolean(state.draggedOperationCode)
    || [...(event?.dataTransfer?.types || [])].includes('application/x-tyana-operation')
    || [...(event?.dataTransfer?.types || [])].includes('text/plain');
  const droppedOperationCode = event => event?.dataTransfer?.getData('application/x-tyana-operation')
    || event?.dataTransfer?.getData('text/plain')
    || state.draggedOperationCode;
  const clearOperationDrag = () => {
    state.draggedOperationCode = '';
    document.getElementById('workPlanStudio')?.classList.remove('operation-drag-active');
    document.querySelectorAll('.operation-drop-target,.drag-target').forEach(target => target.classList.remove('operation-drop-target', 'drag-target'));
  };
  const operationLabel = code => {
    const record = operationRecord(code);
    return record ? `${record.code} • ${record.labels?.tr || ''}${record.labels?.en ? ` / ${record.labels.en}` : ''}` : code;
  };
  const machineByCode = code => state.machines.find(machine => machine.machineCode === code);
  const activeMachines = () => state.machines.filter(machine => machine.active).sort((left, right) => left.machineCode.localeCompare(right.machineCode, 'tr', { numeric: true }));
  const eligibilityCodes = opCode => state.eligibility.filter(link => link.opCode === String(opCode)).map(link => link.machineCode);
  const eligibleMachines = opCode => {
    const codes = eligibilityCodes(opCode);
    return codes.length ? activeMachines().filter(machine => codes.includes(machine.machineCode)) : activeMachines();
  };

  async function loadMachineLibrary(force = false) {
    if (state.loaded && !force) { updateMachineDatalist(); return state; }
    if (state.loading && !force) return state.loading;
    state.loading = global.TyanaPlatform.data.machineLibrary().then(result => {
      state.machines = Array.isArray(result?.machines) ? result.machines.map(machine => ({ ...machine, machineCode: text(machine.machineCode).toUpperCase(), active: machine.active !== false })) : [];
      state.eligibility = Array.isArray(result?.eligibility) ? result.eligibility.map(link => ({ ...link, opCode: text(link.opCode), machineCode: text(link.machineCode).toUpperCase() })) : [];
      state.loaded = true;
      state.loading = null;
      renderMachineLibrary();
      updateMachineDatalist();
      return state;
    }).catch(error => {
      state.loading = null;
      toast('Makine kütüphanesi yüklenemedi', error.message);
      throw error;
    });
    return state.loading;
  }

  function updateMachineDatalist() {
    let datalist = document.getElementById('operationMachineLibraryOptions');
    if (!datalist) { datalist = document.createElement('datalist'); datalist.id = 'operationMachineLibraryOptions'; document.body.append(datalist); }
    datalist.innerHTML = activeMachines().map(machine => `<option value="${escapeHtml(machine.machineCode)}">${escapeHtml(MACHINE_TYPE_LABELS[machine.machineType] || machine.machineType)}${machine.description ? ` • ${escapeHtml(machine.description)}` : ''}</option>`).join('');
  }

  function machineUsage(machineCode) {
    return [...new Set(state.eligibility.filter(link => link.machineCode === machineCode).map(link => link.opCode))];
  }

  function renderMachineLibrary() {
    const body = document.getElementById('machineLibraryRows');
    if (!body) return;
    if (!state.loaded) { body.innerHTML = '<div class="library-loading">Makine sicili yükleniyor…</div>'; loadMachineLibrary().catch(() => {}); return; }
    const query = text(document.getElementById('machineLibrarySearch')?.value).toLocaleLowerCase('tr-TR');
    const type = document.getElementById('machineTypeFilter')?.value || 'all';
    const status = document.getElementById('machineStatusFilter')?.value || 'active';
    const rows = state.machines.filter(machine => (type === 'all' || machine.machineType === type) && (status === 'all' || (status === 'active') === machine.active) && (!query || `${machine.machineCode} ${machine.description} ${MACHINE_TYPE_LABELS[machine.machineType] || ''}`.toLocaleLowerCase('tr-TR').includes(query)));
    const active = state.machines.filter(machine => machine.active).length;
    document.getElementById('machineCatalogTabCount').textContent = state.machines.length;
    document.getElementById('machineActiveCount').textContent = active;
    document.getElementById('machineInactiveCount').textContent = state.machines.length - active;
    document.getElementById('machineTypeCount').textContent = new Set(state.machines.map(machine => machine.machineType)).size;
    document.getElementById('machineLinkedOperationCount').textContent = new Set(state.eligibility.map(link => link.opCode)).size;
    body.innerHTML = rows.length ? rows.map(machine => {
      const operations = machineUsage(machine.machineCode);
      return `<div class="machine-register-row ${machine.active ? '' : 'inactive'}" data-machine-code="${escapeHtml(machine.machineCode)}">
        <span class="machine-code-cell"><b>${escapeHtml(machine.machineCode)}</b><small>v${Number(machine.version || 1)}</small></span>
        <span><b>${escapeHtml(MACHINE_TYPE_LABELS[machine.machineType] || machine.machineType)}</b><small>${escapeHtml(machine.description || 'Açıklama kullanıcı tarafından tamamlanacak')}</small></span>
        <span class="machine-operation-links">${operations.length ? operations.slice(0, 8).map(code => `<mark>${escapeHtml(code)}</mark>`).join('') : '<small>Henüz uygunluk bağı yok</small>'}${operations.length > 8 ? `<em>+${operations.length - 8}</em>` : ''}</span>
        <span><mark class="${machine.active ? 'approved' : ''}">${machine.active ? 'ETKİN' : 'PASİF'}</mark><small>${escapeHtml(text(machine.updatedAt).slice(0, 10) || '—')}</small></span>
        <span class="register-actions"><button type="button" data-machine-edit="${escapeHtml(machine.machineCode)}">✎</button><button type="button" data-machine-toggle="${escapeHtml(machine.machineCode)}">${machine.active ? 'Pasif' : 'Aktif'}</button></span>
      </div>`;
    }).join('') : '<div class="library-empty"><b>Kriterlere uygun makine kaydı yok.</b></div>';
    body.querySelectorAll('[data-machine-edit]').forEach(button => button.addEventListener('click', () => openMachineDialog(machineByCode(button.dataset.machineEdit))));
    body.querySelectorAll('[data-machine-toggle]').forEach(button => button.addEventListener('click', () => toggleMachine(button.dataset.machineToggle)));
    renderEligibilityChoices();
  }

  function openMachineDialog(machine = null) {
    const dialog = document.getElementById('machineEditorDialog');
    document.getElementById('machineDialogTitle').textContent = machine ? `${machine.machineCode} Kaydını Düzenle` : 'Yeni Makine / Kaynak';
    document.getElementById('machineOriginalCode').value = machine?.machineCode || '';
    document.getElementById('machineCode').value = machine?.machineCode || '';
    document.getElementById('machineType').value = machine?.machineType || 'cnc_tool';
    document.getElementById('machineDescription').value = machine?.description || '';
    document.getElementById('machineActive').checked = machine?.active !== false;
    const deleteButton = document.getElementById('machineDeleteButton');
    deleteButton.classList.toggle('hidden', !machine);
    deleteButton.dataset.machineCode = machine?.machineCode || '';
    dialog.showModal();
    setTimeout(() => document.getElementById('machineCode').focus(), 50);
  }

  async function submitMachine(event) {
    event.preventDefault();
    const originalCode = document.getElementById('machineOriginalCode').value || null;
    const current = originalCode ? machineByCode(originalCode) : null;
    const payload = {
      machineCode: document.getElementById('machineCode').value,
      machineType: document.getElementById('machineType').value,
      description: document.getElementById('machineDescription').value,
      active: document.getElementById('machineActive').checked,
      version: current?.version || 0
    };
    try {
      await global.TyanaPlatform.data.saveMachine(payload, originalCode);
      document.getElementById('machineEditorDialog').close();
      await loadMachineLibrary(true);
      toast('Makine sicili güncellendi', `${text(payload.machineCode).toUpperCase()} • ${MACHINE_TYPE_LABELS[payload.machineType]}`);
    } catch (error) { toast('Makine kaydedilemedi', error.message); }
  }

  async function toggleMachine(machineCode) {
    const machine = machineByCode(machineCode); if (!machine) return;
    if (machine.active && !global.confirm(`${machineCode} pasife alınsın mı? Yeni iş planlarında gösterilmeyecek.`)) return;
    try {
      await global.TyanaPlatform.data.saveMachine({ ...machine, active: !machine.active }, machine.machineCode);
      await loadMachineLibrary(true);
      toast('Makine durumu güncellendi', `${machineCode} • ${machine.active ? 'pasif' : 'etkin'}`);
    } catch (error) { toast('Makine durumu değiştirilemedi', error.message); }
  }

  async function deleteMachine() {
    const machineCode = document.getElementById('machineDeleteButton').dataset.machineCode;
    if (!machineCode || !global.confirm(`${machineCode} makine kaydı ve uygunluk bağları kalıcı olarak silinsin mi?`)) return;
    try {
      await global.TyanaPlatform.data.deleteMachine(machineCode);
      document.getElementById('machineEditorDialog').close();
      await loadMachineLibrary(true);
      toast('Makine kaydı silindi', `${machineCode} sicilden ve uygunluk matrisinden çıkarıldı.`);
    } catch (error) { toast('Makine silinemedi', error.message); }
  }

  function machineChoiceMarkup(machines, selectedCodes) {
    const selected = new Set(selectedCodes || []);
    return Object.keys(MACHINE_TYPE_LABELS).map(machineType => {
      const group = machines.filter(machine => machine.machineType === machineType);
      if (!group.length) return '';
      return `<fieldset><legend>${escapeHtml(MACHINE_TYPE_LABELS[machineType])} <span>${group.length}</span></legend>${group.map(machine => `<label><input type="checkbox" value="${escapeHtml(machine.machineCode)}" ${selected.has(machine.machineCode) ? 'checked' : ''}><span><b>${escapeHtml(machine.machineCode)}</b><small>${escapeHtml(machine.description || 'Etkin tesis kaydı')}</small></span></label>`).join('')}</fieldset>`;
    }).join('');
  }

  function filteredRouteMachineCandidates() {
    const query = text(document.getElementById('routeMachineSearch')?.value).toLocaleLowerCase('tr-TR');
    return state.routeMachineCandidates.filter(machine => !query || `${machine.machineCode} ${machine.description || ''} ${MACHINE_TYPE_LABELS[machine.machineType] || ''}`.toLocaleLowerCase('tr-TR').includes(query));
  }

  function updateRouteMachineSelectionCount() {
    const counter = document.getElementById('routeMachineSelectionCount');
    if (counter) counter.textContent = `${state.routeMachineDraft.size} seçili`;
  }

  function renderRouteMachineChoices() {
    const container = document.getElementById('routeMachineChoices');
    if (!container) return;
    const candidates = filteredRouteMachineCandidates();
    container.innerHTML = candidates.length ? machineChoiceMarkup(candidates, [...state.routeMachineDraft]) : '<div class="work-plan-empty"><b>Makine bulunamadı.</b><small>Arama metnini değiştirin.</small></div>';
    container.querySelectorAll('input[type="checkbox"]').forEach(input => input.addEventListener('change', () => {
      if (input.checked) state.routeMachineDraft.add(input.value); else state.routeMachineDraft.delete(input.value);
      updateRouteMachineSelectionCount();
    }));
    updateRouteMachineSelectionCount();
  }

  function renderEligibilityChoices() {
    const container = document.getElementById('machineEligibilityChoices'); if (!container || !state.loaded) return;
    const input = document.getElementById('machineEligibilityOperation');
    const opCode = operationCodeFromInput(input?.value || '');
    const operation = operationRecord(opCode);
    if (!operation) { container.innerHTML = '<p>380 karttan geçerli bir operasyon kodu seçin.</p>'; return; }
    const selected = eligibilityCodes(opCode);
    container.dataset.opCode = opCode;
    container.innerHTML = `<div class="eligibility-summary"><b>${escapeHtml(operationLabel(opCode))}</b><small>${selected.length ? `${selected.length} uygun makine tanımlı` : 'Eşleme yok; ürün iş planında bütün etkin makineler gösterilir.'}</small></div>${machineChoiceMarkup(activeMachines(), selected)}`;
  }

  async function saveEligibility(opCode, machineCodes, source = 'user-confirmed') {
    const result = await global.TyanaPlatform.data.saveOperationMachineEligibility(opCode, machineCodes, source);
    state.eligibility = state.eligibility.filter(link => link.opCode !== String(opCode));
    state.eligibility.push(...result.machineCodes.map(machineCode => ({ opCode: result.opCode, machineCode, source: result.source, updatedAt: result.updatedAt })));
    renderMachineLibrary();
    return result;
  }

  async function saveEligibilityFromPanel() {
    const container = document.getElementById('machineEligibilityChoices');
    const opCode = container?.dataset.opCode;
    if (!opCode) { toast('Operasyon seçilmedi', 'Önce 380 standart karttan bir operasyon seçin.'); return; }
    const selected = [...container.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value);
    try {
      await saveEligibility(opCode, selected, 'user-confirmed');
      toast('Uygunluk matrisi kaydedildi', `${opCode} • ${selected.length} etkin makine`);
    } catch (error) { toast('Uygunluk kaydedilemedi', error.message); }
  }

  function findMaster(masterId) {
    return engineeringUniverse?.itemMasters.find(master => master.id === masterId);
  }

  function itemBreadcrumb(masterId) {
    const rootId = engineeringUniverse?.rootItemMasterId;
    const byId = new Map((engineeringUniverse?.itemMasters || []).map(master => [master.id, master]));
    const parentByChild = new Map();
    (engineeringUniverse?.bomDefinitions || []).forEach(definition => definition.lines.forEach(line => { if (!parentByChild.has(line.itemMasterId)) parentByChild.set(line.itemMasterId, definition.headerItemMasterId); }));
    const ids = []; const visited = new Set(); let current = masterId;
    while (current && !visited.has(current)) { visited.add(current); ids.unshift(current); if (current === rootId) break; current = parentByChild.get(current); }
    if (ids[0] !== rootId && rootId) ids.unshift(rootId);
    return ids.map(id => byId.get(id)?.name || byId.get(id)?.internalCode || id).join(' › ');
  }

  function workPlanMasters() {
    return (engineeringUniverse?.itemMasters || []).filter(master => WORK_PLAN_TYPES.has(master.itemType) && master.procurementType !== 'BUY' && master.validationStatus !== 'OBSOLETE');
  }

  function requiredWorkPlanMasters() {
    return workPlanMasters().filter(master => REQUIRED_WORK_PLAN_TYPES.has(master.itemType));
  }

  function workPlanReadiness() {
    const required = requiredWorkPlanMasters();
    const missing = required.filter(master => !(master.routingSteps || []).length || master.routingSteps.some(step => !(step.selectedMachines || []).length));
    return { required: required.length, completed: required.length - missing.length, missing: missing.map(master => ({ id: master.id, name: master.name || master.internalCode || master.id })) };
  }

  function workPlanTypeLabel(master) {
    const labels = { FINISHED_GOOD: 'Ana mamul', SUBASSEMBLY: 'Alt montaj', SEMI_FINISHED: 'Yarı mamul', MANUFACTURED_PART: 'İç üretim parçası', ASSEMBLY_MATERIAL: 'Montaj malzemesi', EXTERNAL_PURCHASED: 'Dış tedarik ürünü (XD)', RAW_MATERIAL: 'Hammadde', PACKAGING: 'Ambalaj malzemesi' };
    return labels[master.itemType] || master.itemType;
  }

  function renderWorkPlanProducts() {
    const container = document.getElementById('workPlanProductList');
    if (!container) return;
    const masters = workPlanMasters();
    if (!masters.some(master => master.id === state.selectedWorkPlanMasterId)) state.selectedWorkPlanMasterId = masters[0]?.id || null;
    container.innerHTML = masters.length ? masters.map(master => {
      const steps = master.routingSteps || [];
      const missingMachines = steps.filter(step => !(step.selectedMachines || []).length).length;
      const ready = steps.length > 0 && missingMachines === 0;
      return `<button type="button" class="work-plan-product-card ${master.id === state.selectedWorkPlanMasterId ? 'selected' : ''} ${ready ? 'ready' : ''}" data-work-plan-master="${escapeHtml(master.id)}"><span>${escapeHtml(workPlanTypeLabel(master).split(/\s+/).map(word => word[0]).join('').slice(0, 2))}</span><div><b>${escapeHtml(master.internalCode || 'KOD BEKLİYOR')} • ${escapeHtml(master.name || 'Adsız kart')}</b><small>${escapeHtml(itemBreadcrumb(master.id))}</small><em>${steps.length} operasyon${missingMachines ? ` • ${missingMachines} makine bekliyor` : steps.length ? ' • hazır' : ' • plan bekliyor'}</em></div><mark>${ready ? '✓' : steps.length}</mark></button>`;
    }).join('') : '<div class="work-plan-empty"><b>Üretilecek kart bulunamadı.</b><small>Önce mamul, yarı mamul veya iç üretim parçası tanımlayın.</small></div>';
    container.querySelectorAll('[data-work-plan-master]').forEach(button => button.addEventListener('click', () => selectWorkPlanMaster(button.dataset.workPlanMaster)));
  }

  function ensureWorkPlanFamilyOptions() {
    const select = document.getElementById('workPlanOperationFamily');
    if (!select || select.dataset.loaded === 'true') return;
    const families = [...new Set(operationCodeEntries().map(record => operationProcessCard(record)?.family).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
    select.innerHTML = '<option value="all">Tüm proses aileleri</option>' + families.map(family => `<option value="${escapeHtml(family)}">${escapeHtml(family)}</option>`).join('');
    select.dataset.loaded = 'true';
  }

  function filteredWorkPlanOperations() {
    const query = text(document.getElementById('workPlanOperationSearch')?.value).toLocaleLowerCase('tr-TR');
    const family = document.getElementById('workPlanOperationFamily')?.value || 'all';
    return operationCodeEntries().filter(record => {
      const card = operationProcessCard(record);
      const haystack = `${record.code} ${record.labels?.tr || ''} ${record.labels?.en || ''} ${card?.family || ''} ${card?.category || ''}`.toLocaleLowerCase('tr-TR');
      return (!query || haystack.includes(query)) && (family === 'all' || card?.family === family);
    });
  }

  function workPlanOperationShape(record) {
    const card = operationProcessCard(record);
    const value = `${card?.category || ''} ${card?.family || ''} ${record.labels?.tr || ''}`.toLocaleLowerCase('tr-TR');
    if (/kontrol|test|muayene|ölç/.test(value)) return 'control';
    if (/depo|stok|sevkiyat|paket/.test(value)) return 'warehouse';
    return 'process';
  }

  function renderWorkPlanOperationPalette() {
    const container = document.getElementById('workPlanOperationPalette');
    if (!container) return;
    const records = filteredWorkPlanOperations();
    const visible = records.slice(0, 120);
    container.innerHTML = visible.length ? `${visible.map(record => {
      const card = operationProcessCard(record);
      return `<button type="button" draggable="true" class="work-plan-operation-card ${workPlanOperationShape(record)}" data-work-plan-operation="${escapeHtml(record.code)}"><span>${escapeHtml(record.code)}</span><div><b>${escapeHtml(record.labels?.tr || 'Tanımsız operasyon')}</b><small>${escapeHtml(record.labels?.en || '')}</small><em>${escapeHtml(card?.family || 'Proses ailesi bekliyor')}</em></div><mark>＋</mark></button>`;
    }).join('')}${records.length > visible.length ? `<p class="work-plan-result-note">İlk ${visible.length} / ${records.length} sonuç gösteriliyor; aramayı daraltın.</p>` : ''}` : '<div class="work-plan-empty"><b>Operasyon bulunamadı.</b><small>Arama veya aile filtresini değiştirin.</small></div>';
    container.querySelectorAll('[data-work-plan-operation]').forEach(button => {
      button.addEventListener('click', () => addRoutingStepByCode(state.selectedWorkPlanMasterId, button.dataset.workPlanOperation));
      button.addEventListener('dragstart', event => {
        state.draggedOperationCode = button.dataset.workPlanOperation;
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('application/x-tyana-operation', state.draggedOperationCode);
        event.dataTransfer.setData('text/plain', state.draggedOperationCode);
        document.getElementById('workPlanStudio')?.classList.add('operation-drag-active');
      });
      button.addEventListener('dragend', () => {
        clearOperationDrag();
      });
    });
  }

  function bindWorkPlanDropTarget(host) {
    if (!host || host.dataset.workPlanDropBound === 'true') return;
    host.dataset.workPlanDropBound = 'true';
    host.addEventListener('dragover', event => { if (!hasOperationDrag(event)) return; event.preventDefault(); host.classList.add('drag-target'); event.dataTransfer.dropEffect = 'copy'; });
    host.addEventListener('dragleave', event => { if (!host.contains(event.relatedTarget)) host.classList.remove('drag-target'); });
    host.addEventListener('drop', event => {
      const opCode = droppedOperationCode(event);
      if (!opCode) return;
      event.preventDefault(); host.classList.remove('drag-target');
      addRoutingStepByCode(state.selectedWorkPlanMasterId, opCode, host);
      clearOperationDrag();
    });
  }

  function selectWorkPlanMaster(masterId) {
    const master = workPlanMasters().find(item => item.id === masterId);
    if (!master) return;
    state.selectedWorkPlanMasterId = master.id;
    renderWorkPlanStudio();
  }

  function renderWorkPlanStudio() {
    const studio = document.getElementById('workPlanStudio');
    if (!studio || !engineeringUniverse) return;
    ensureWorkPlanFamilyOptions();
    renderWorkPlanProducts();
    renderWorkPlanOperationPalette();
    const masters = workPlanMasters();
    const selectedMaster = masters.find(master => master.id === state.selectedWorkPlanMasterId);
    const host = document.getElementById('workPlanRoutingHost');
    const steps = masters.flatMap(master => master.routingSteps || []);
    const completedPlans = masters.filter(master => {
      const routingSteps = master.routingSteps || [];
      return routingSteps.length > 0 && routingSteps.every(step => (step.selectedMachines || []).length > 0);
    }).length;
    document.getElementById('workPlanProductCount').textContent = masters.length;
    document.getElementById('workPlanCompletedCount').textContent = completedPlans;
    document.getElementById('workPlanMissingMachineCount').textContent = steps.filter(step => !(step.selectedMachines || []).length).length;
    document.getElementById('workPlanSelectedBadge').textContent = selectedMaster ? `${selectedMaster.internalCode || 'KOD BEKLİYOR'} • ${workPlanTypeLabel(selectedMaster)}` : 'KART SEÇİN';
    if (selectedMaster) renderItemRouting(selectedMaster.id, host);
    else host.innerHTML = '<div class="work-plan-empty"><b>İş planı kartı seçin.</b><small>Soldaki üretilen kartlardan birini açın.</small></div>';
    bindWorkPlanDropTarget(host);
    if (!studio.dataset.bound) {
      studio.dataset.bound = 'true';
      document.getElementById('workPlanOperationSearch')?.addEventListener('input', renderWorkPlanOperationPalette);
      document.getElementById('workPlanOperationFamily')?.addEventListener('change', renderWorkPlanOperationPalette);
    }
    loadMachineLibrary().catch(() => {});
  }

  function renderItemRouting(masterId, host) {
    const master = findMaster(masterId); if (!master || !host) return;
    master.routingSteps = Array.isArray(master.routingSteps) ? master.routingSteps : [];
    const disabled = ROUTING_DISABLED_TYPES.has(master.itemType) || master.procurementType === 'BUY';
    const copySources = workPlanMasters().filter(candidate => candidate.id !== master.id && (candidate.routingSteps || []).length);
    const copyOptions = copySources.map(candidate => `<option value="${escapeHtml(candidate.id)}">${escapeHtml(candidate.internalCode || 'KOD BEKLİYOR')} • ${escapeHtml(candidate.name)} • ${(candidate.routingSteps || []).length} adım</option>`).join('');
    host.innerHTML = `<div class="item-routing-head"><div><span>İŞ PLANI / PROSES AKIŞI</span><b>${escapeHtml(itemBreadcrumb(masterId))}</b><small>${disabled ? 'Bu kart doğrudan BOM girdisidir; iç üretim rotası tanımlanmaz.' : '380 standart proses kartından seçin, sürükleyerek sıralayın ve makine uygunluğunu işaretleyin.'}</small></div><mark>${master.routingSteps.length} ADIM</mark></div>
      ${disabled ? `<div class="item-routing-disabled"><span>↪</span><p><b>İş planı uygulanmaz</b><small>${master.itemType === 'EXTERNAL_PURCHASED' ? 'XD dış tedarik kartı' : workPlanTypeLabel(master)} doğrudan BOM girdisidir; tedarikçi, giriş kalite ve izlenebilirlik bilgileri kart üzerinde yönetilir.</small></p></div>` : `<div class="item-route-accelerator"><button type="button" class="route-recommend-button" data-item-route-recommend><span>✦</span><div><b>Akıllı rota öner</b><small>Ürün grubu, yapı ve üretim yönteminden uygun proses kartlarını getirir.</small></div></button><label><span>Başka kartın iş planını kopyala</span><select data-route-copy-source ${copySources.length ? '' : 'disabled'}><option value="">${copySources.length ? 'Kaynak kart seçin…' : 'Kopyalanabilir iş planı yok'}</option>${copyOptions}</select></label><button type="button" class="secondary-button" data-item-route-copy ${copySources.length ? '' : 'disabled'}>Rotayı Kopyala</button></div><div class="item-route-command"><label>Operasyon ara / seç<input data-item-route-operation list="operationCodeLibraryOptions" placeholder="Kod, Türkçe veya İngilizce operasyon"></label><button type="button" class="primary-button" data-item-route-add>＋ Adım Ekle</button></div><div class="item-route-list" data-item-route-list>${master.routingSteps.length ? master.routingSteps.map((step, index) => routeStepMarkup(step, index)).join('') : '<div class="item-route-empty"><b>Henüz iş planı adımı yok</b><small>Akıllı öneriyi kullanın veya 380 standart proses kartından operasyon seçin.</small></div>'}</div><div class="item-route-footer"><span>Değişiklikler ana proses akışına otomatik bağlanır.</span><button type="button" class="secondary-button" data-item-route-sync>↻ Doküman Rotasını Güncelle</button></div>`}`;
    if (disabled) return;
    host.querySelector('[data-item-route-add]')?.addEventListener('click', () => addRoutingStep(masterId, host));
    host.querySelector('[data-item-route-recommend]')?.addEventListener('click', () => applyRecommendedRouting(masterId, host));
    host.querySelector('[data-item-route-copy]')?.addEventListener('click', () => copyRoutingFromMaster(masterId, host));
    host.querySelector('[data-item-route-sync]')?.addEventListener('click', () => { syncAggregateRoute(); toast('Doküman rotası güncellendi', `${master.routingSteps.length} parça operasyonu ana akışa bağlandı.`); });
    bindRouteRows(masterId, host);
  }

  function recommendedOperationCodes(master) {
    const processIds = global.TyanaProductRoutingContext?.recommendedProcessIds?.()
      || global.TyanaProductRoutingContext?.defaultProcessIds?.()
      || [];
    const entries = operationCodeEntries();
    const chosen = processIds.map(processId => entries.find(record => !record.requiresReview && record.standardProcessCard?.canonicalProcessId === processId)
      || entries.find(record => record.standardProcessCard?.canonicalProcessId === processId)).filter(Boolean);
    const existing = new Set((master.routingSteps || []).map(step => String(step.opCode)));
    return [...new Set(chosen.map(record => String(record.code)))].filter(code => !existing.has(code));
  }

  function applyRecommendedRouting(masterId, host) {
    const master = findMaster(masterId); if (!master) return;
    const codes = recommendedOperationCodes(master);
    if (!codes.length) {
      toast('Yeni rota adımı bulunamadı', 'Önerilen proseslerin tamamı iş planında mevcut veya ürün yöntem bilgisi henüz yeterli değil.');
      return;
    }
    codes.forEach(code => {
      const record = operationRecord(code);
      master.routingSteps.push({ id: `ROUTE-${crypto.randomUUID()}`, sequence: master.routingSteps.length + 1, opCode: record.code, selectedMachines: [], controlMarks: [...(record.standardProcessCard?.defaultControlMarks || [])].filter(mark => ['§', '<C>', '<M>'].includes(mark)), source: 'smart-recommendation' });
    });
    resequence(master);
    renderItemRouting(masterId, host); bindWorkPlanDropTarget(host); renderWorkPlanProducts(); syncAggregateRoute(); markDraftDirty();
    toast('Akıllı rota eklendi', `${codes.length} standart proses kartı iş planına eklendi; makine seçimleri kullanıcı doğrulamasını bekliyor.`);
  }

  function copyRoutingFromMaster(masterId, host) {
    const target = findMaster(masterId);
    const sourceId = host.querySelector('[data-route-copy-source]')?.value;
    const source = findMaster(sourceId);
    if (!target || !source || !(source.routingSteps || []).length) {
      toast('Kaynak iş planı seçilmedi', 'Operasyonları bulunan bir mamul veya yarı mamul kartı seçin.');
      return;
    }
    if (target.routingSteps.length && !global.confirm(`${target.internalCode || target.name} kartındaki ${target.routingSteps.length} mevcut adım, ${source.internalCode || source.name} iş planının kontrollü kopyasıyla değiştirilsin mi?`)) return;
    target.routingSteps = source.routingSteps.map((step, index) => ({
      ...clone(step),
      id: `ROUTE-${crypto.randomUUID()}`,
      sequence: index + 1,
      selectedMachines: [...(step.selectedMachines || [])],
      controlMarks: [...(step.controlMarks || [])],
      source: `copied-from:${source.id}`
    }));
    renderItemRouting(masterId, host); bindWorkPlanDropTarget(host); renderWorkPlanProducts(); syncAggregateRoute(); markDraftDirty();
    toast('İş planı kontrollü kopyalandı', `${source.internalCode || source.name} kartından ${target.routingSteps.length} operasyon ve makine bağlantısı aktarıldı.`);
  }

  function routeStepMarkup(step, index) {
    const record = operationRecord(step.opCode);
    const review = record?.requiresReview ? '<mark class="route-review">İNCELEME</mark>' : '';
    return `<article class="item-route-step" draggable="true" data-route-step-id="${escapeHtml(step.id)}" data-route-index="${index}"><span class="route-drag" title="Sürükleyerek sırala">⋮⋮</span><span class="route-sequence">${String(index + 1).padStart(2, '0')}</span><div class="route-operation"><b>[${escapeHtml(step.opCode)}] ${escapeHtml(record?.labels?.tr || 'Tanımsız operasyon')}</b><small>${escapeHtml(record?.labels?.en || '')}</small></div><div class="route-machines"><b>${step.selectedMachines.length ? escapeHtml(step.selectedMachines.join(', ')) : 'Makine seçilmedi'}</b><small>${eligibilityCodes(step.opCode).length ? 'Uygunluk matrisinden' : 'İlk seçim matrisi öğretecek'}</small></div><div class="route-control-marks">${['§', '<C>', '<M>'].map(mark => `<label title="Kontrol işareti ${escapeHtml(mark)}"><input type="checkbox" data-route-mark="${escapeHtml(mark)}" ${step.controlMarks.includes(mark) ? 'checked' : ''}><span>${escapeHtml(mark)}</span></label>`).join('')}</div>${review}<div class="route-row-actions"><button type="button" data-route-machine>Makine Seç</button><button type="button" data-route-up ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-route-down>↓</button><button type="button" class="danger" data-route-remove>×</button></div></article>`;
  }

  function bindRouteRows(masterId, host) {
    const master = findMaster(masterId); if (!master) return;
    let draggedIndex = null;
    host.querySelectorAll('.item-route-step').forEach(row => {
      const index = () => master.routingSteps.findIndex(step => step.id === row.dataset.routeStepId);
      row.addEventListener('dragstart', event => { draggedIndex = index(); row.classList.add('dragging'); event.dataTransfer.effectAllowed = 'move'; });
      row.addEventListener('dragend', () => { row.classList.remove('dragging'); row.classList.remove('operation-drop-target'); });
      row.addEventListener('dragover', event => {
        event.preventDefault();
        const operationDrop = hasOperationDrag(event);
        event.dataTransfer.dropEffect = operationDrop ? 'copy' : 'move';
        row.classList.toggle('operation-drop-target', operationDrop);
      });
      row.addEventListener('dragleave', event => { if (!row.contains(event.relatedTarget)) row.classList.remove('operation-drop-target'); });
      row.addEventListener('drop', event => {
        event.preventDefault(); event.stopPropagation(); row.classList.remove('operation-drop-target');
        const operationCode = droppedOperationCode(event);
        const target = index();
        if (operationCode) {
          addRoutingStepByCode(masterId, operationCode, host, target);
          clearOperationDrag();
          return;
        }
        if (draggedIndex === null || draggedIndex === target) return;
        const [moved] = master.routingSteps.splice(draggedIndex, 1);
        master.routingSteps.splice(target, 0, moved);
        resequence(master); renderItemRouting(masterId, host); syncAggregateRoute();
      });
      row.querySelector('[data-route-machine]')?.addEventListener('click', () => openRouteMachineDialog(masterId, row.dataset.routeStepId));
      row.querySelector('[data-route-up]')?.addEventListener('click', () => moveRoutingStep(masterId, row.dataset.routeStepId, -1, host));
      row.querySelector('[data-route-down]')?.addEventListener('click', () => moveRoutingStep(masterId, row.dataset.routeStepId, 1, host));
      row.querySelector('[data-route-remove]')?.addEventListener('click', () => removeRoutingStep(masterId, row.dataset.routeStepId, host));
      row.querySelectorAll('[data-route-mark]').forEach(input => input.addEventListener('change', () => { const step = master.routingSteps[index()]; step.controlMarks = [...row.querySelectorAll('[data-route-mark]:checked')].map(item => item.dataset.routeMark); markDraftDirty(); syncAggregateRoute(); }));
    });
  }

  function resequence(master) { master.routingSteps.forEach((step, index) => { step.sequence = index + 1; }); }

  function addRoutingStep(masterId, host) {
    const master = findMaster(masterId); const input = host.querySelector('[data-item-route-operation]');
    const opCode = operationCodeFromInput(input?.value || '');
    if (addRoutingStepByCode(masterId, opCode, host) && input) input.value = '';
  }

  function addRoutingStepByCode(masterId, opCode, host = document.getElementById('workPlanRoutingHost'), insertIndex = null) {
    const master = findMaster(masterId); const record = operationRecord(operationCodeFromInput(opCode));
    if (!master) { toast('İş planı kartı seçilmedi', 'Önce soldan mamul veya yarı mamul kartını seçin.'); return false; }
    if (!record) { toast('Operasyon bulunamadı', '380 standart proses kartından geçerli bir kod seçin.'); return; }
    master.routingSteps = Array.isArray(master.routingSteps) ? master.routingSteps : [];
    const step = { id: `ROUTE-${crypto.randomUUID()}`, sequence: master.routingSteps.length + 1, opCode: record.code, selectedMachines: [], controlMarks: [...(record.standardProcessCard?.defaultControlMarks || [])].filter(mark => ['§', '<C>', '<M>'].includes(mark)), source: 'operation-master' };
    if (Number.isInteger(insertIndex) && insertIndex >= 0 && insertIndex <= master.routingSteps.length) master.routingSteps.splice(insertIndex, 0, step);
    else master.routingSteps.push(step);
    resequence(master);
    renderItemRouting(masterId, host); bindWorkPlanDropTarget(host); renderWorkPlanProducts(); syncAggregateRoute(); markDraftDirty();
    return true;
  }

  function moveRoutingStep(masterId, stepId, direction, host) {
    const master = findMaster(masterId); const index = master.routingSteps.findIndex(step => step.id === stepId); const target = index + direction;
    if (index < 0 || target < 0 || target >= master.routingSteps.length) return;
    [master.routingSteps[index], master.routingSteps[target]] = [master.routingSteps[target], master.routingSteps[index]];
    resequence(master); renderItemRouting(masterId, host); bindWorkPlanDropTarget(host); renderWorkPlanProducts(); syncAggregateRoute(); markDraftDirty();
  }

  function removeRoutingStep(masterId, stepId, host) {
    const master = findMaster(masterId); const step = master?.routingSteps.find(item => item.id === stepId); if (!step) return;
    if (!global.confirm(`[${step.opCode}] ${operationRecord(step.opCode)?.labels?.tr || ''} iş planından çıkarılsın mı?`)) return;
    master.routingSteps = master.routingSteps.filter(item => item.id !== stepId); resequence(master); renderItemRouting(masterId, host); bindWorkPlanDropTarget(host); renderWorkPlanProducts(); syncAggregateRoute(); markDraftDirty();
  }

  async function openRouteMachineDialog(masterId, stepId) {
    await loadMachineLibrary();
    const master = findMaster(masterId); const step = master?.routingSteps.find(item => item.id === stepId); if (!step) return;
    const mapped = eligibilityCodes(step.opCode); const candidates = eligibleMachines(step.opCode);
    state.routeMachineContext = { kind: 'item', masterId, stepId, learned: mapped.length === 0 };
    state.routeMachineCandidates = candidates;
    state.routeMachineDraft = new Set(step.selectedMachines || []);
    document.getElementById('routeMachineDialogTitle').textContent = operationLabel(step.opCode);
    document.getElementById('routeMachineDialogHint').textContent = mapped.length ? `${mapped.length} uygun etkin makine gösteriliyor.` : 'Bu operasyon için eşleme yok; tüm etkin sicil gösteriliyor. Seçiminiz uygunluk matrisine kaydedilecek.';
    document.getElementById('routeMachineSearch').value = '';
    renderRouteMachineChoices();
    document.getElementById('routeMachineDialog').showModal();
  }

  async function openDocumentRouteMachineDialog(routeKey) {
    await loadMachineLibrary();
    const detail = routeDetails?.[routeKey];
    const opCode = text(detail?.operationCode);
    if (!detail || !operationRecord(opCode)) { toast('Operasyon kodu gerekli', 'Makine seçmeden önce 380 karttan kurumsal operasyon kodunu seçin.'); return; }
    const mapped = eligibilityCodes(opCode); const candidates = eligibleMachines(opCode);
    state.routeMachineContext = { kind: 'document', routeKey, opCode, learned: mapped.length === 0 };
    state.routeMachineCandidates = candidates;
    state.routeMachineDraft = new Set(detail.selectedMachines || []);
    document.getElementById('routeMachineDialogTitle').textContent = operationLabel(opCode);
    document.getElementById('routeMachineDialogHint').textContent = mapped.length ? `${mapped.length} uygun etkin makine gösteriliyor.` : 'Bu operasyon için eşleme yok; tüm etkin sicil gösteriliyor. Seçiminiz uygunluk matrisine kaydedilecek.';
    document.getElementById('routeMachineSearch').value = '';
    renderRouteMachineChoices();
    document.getElementById('routeMachineDialog').showModal();
  }

  async function confirmRouteMachines(event) {
    event?.preventDefault();
    const context = state.routeMachineContext; if (!context) return;
    const selectedMachines = [...state.routeMachineDraft];
    try {
      if (context.kind === 'document') {
        const detail = routeDetails?.[context.routeKey];
        if (!detail) return;
        detail.selectedMachines = selectedMachines;
        detail.machineId = selectedMachines.join(' / ');
        if (context.learned && selectedMachines.length) await saveEligibility(context.opCode, selectedMachines, 'learned-from-document-route');
        document.getElementById('routeMachineDialog').close();
        state.routeMachineContext = null;
        renderSequence(); markDraftDirty();
        toast('Makine seçimi uygulandı', `${context.opCode} • ${selectedMachines.length} makine/istasyon`);
        return;
      }
      const master = findMaster(context.masterId); const step = master?.routingSteps.find(item => item.id === context.stepId); if (!step) return;
      step.selectedMachines = selectedMachines;
      if (context.learned && selectedMachines.length) await saveEligibility(step.opCode, selectedMachines, 'learned-from-product-routing');
      document.getElementById('routeMachineDialog').close();
      state.routeMachineContext = null;
      const activeStudioHost = state.selectedWorkPlanMasterId === master.id ? document.getElementById('workPlanRoutingHost') : null;
      const host = activeStudioHost || document.querySelector(`[data-item-routing-host="${CSS.escape(master.id)}"]`);
      renderItemRouting(master.id, host); bindWorkPlanDropTarget(host); renderWorkPlanProducts(); syncAggregateRoute(); markDraftDirty();
      toast('Makine seçimi uygulandı', `${step.opCode} • ${selectedMachines.length} makine/istasyon`);
    } catch (error) { toast('Makine seçimi kaydedilemedi', error.message); }
  }

  function syncAggregateRoute() {
    if (!engineeringUniverse || !operationCodeLibrary || !processes.length) return;
    const existingItemKeys = selected.filter(routeKey => routeDetails[routeKey]?.itemMasterRouting === true || routeKey.includes('::item-'));
    selected = selected.filter(routeKey => !existingItemKeys.includes(routeKey));
    existingItemKeys.forEach(routeKey => delete routeDetails[routeKey]);
    let operationIndex = 0;
    engineeringUniverse.itemMasters.forEach((master, masterIndex) => (master.routingSteps || []).forEach(step => {
      const record = operationRecord(step.opCode); const card = operationProcessCard(record);
      const processId = card?.canonicalProcessId || canonicalProcessIdForOperation(record || { operationCode: step.opCode });
      const process = processes.find(item => item.id === processId && item.status !== 'archived');
      if (!record || !process) return;
      operationIndex += 1;
      const routeKey = `${processId}::item-${master.id}-${step.id}`;
      selected.push(routeKey);
      const componentIds = components.filter(component => component.itemMasterId === master.id || component.partMasterId === master.id).map(component => component.id);
      const detail = {
        operationNo: String(operationIndex * 10), operationCode: record.code, presetId: '', variantId: '', sourceDocumentId: '', sourceRef: '', sourceValidationStatus: record.requiresReview ? 'pending' : 'not-applicable', sourceValidationNote: '',
        inputComponentIds: componentIds, outputItemId: master.id === engineeringUniverse.rootItemMasterId ? 'FINISHED_GOOD' : master.id,
        workcenter: master.name || master.internalCode || 'İş merkezi seçilecek', machineId: step.selectedMachines.join(' / ') || 'Makine seçimi gerekli', selectedMachines: [...step.selectedMachines], tooling: card?.tooling || 'Takım / fikstür seçimi gerekli', programNo: 'Program / reçete kullanıcı girişi', responsible: card?.owner || 'Üretim', externalControlRef: 'Uygulanmıyor',
        itemMasterRouting: true, itemMasterId: master.id, itemRoutingStepId: step.id, controlMarks: [...step.controlMarks],
        routeGroupName: master.name || master.internalCode || master.id, routeGroupCode: master.internalCode || '', routeGroupOrder: masterIndex + 1,
        bomPath: itemBreadcrumb(master.id)
      };
      routeDetails[routeKey] = detail;
      bindOperationCodeMetadata(detail, record.code);
    }));
    renderOptions(); renderSequence();
    if (typeof renderFlowDiagram === 'function') renderFlowDiagram();
    if (typeof global.renderProductUpgradeCockpit === 'function') global.renderProductUpgradeCockpit();
  }

  function bindItemEditor(masterId, container) {
    loadMachineLibrary().catch(() => {});
    const host = container.querySelector(`[data-item-routing-host="${CSS.escape(masterId)}"]`);
    renderItemRouting(masterId, host);
  }

  function bindUi() {
    ['machineLibrarySearch', 'machineTypeFilter', 'machineStatusFilter'].forEach(id => document.getElementById(id)?.addEventListener(id === 'machineLibrarySearch' ? 'input' : 'change', renderMachineLibrary));
    document.querySelectorAll('[data-action="new-machine"]').forEach(button => button.addEventListener('click', () => openMachineDialog()));
    document.getElementById('machineEditorForm')?.addEventListener('submit', submitMachine);
    document.getElementById('machineDeleteButton')?.addEventListener('click', deleteMachine);
    document.getElementById('machineEligibilityOperation')?.addEventListener('input', renderEligibilityChoices);
    document.getElementById('machineEligibilityOperation')?.addEventListener('change', renderEligibilityChoices);
    document.querySelector('[data-action="save-machine-eligibility"]')?.addEventListener('click', saveEligibilityFromPanel);
    document.getElementById('routeMachineConfirm')?.addEventListener('click', confirmRouteMachines);
    document.getElementById('routeMachineSearch')?.addEventListener('input', renderRouteMachineChoices);
    document.getElementById('routeMachineSelectAll')?.addEventListener('click', event => {
      event.preventDefault();
      filteredRouteMachineCandidates().forEach(machine => state.routeMachineDraft.add(machine.machineCode));
      renderRouteMachineChoices();
    });
    document.getElementById('routeMachineClear')?.addEventListener('click', event => {
      event.preventDefault(); state.routeMachineDraft.clear(); renderRouteMachineChoices();
    });
  }

  global.TyanaProductDefinition = Object.freeze({
    loadMachineLibrary,
    renderMachineLibrary,
    bindItemEditor,
    eligibleMachines: opCode => clone(eligibleMachines(opCode)),
    syncAggregateRoute,
    renderWorkPlanStudio,
    selectWorkPlanMaster,
    workPlanReadiness,
    openDocumentRouteMachineDialog
  });

  bindUi();
  loadMachineLibrary().catch(() => {});
})(globalThis);
