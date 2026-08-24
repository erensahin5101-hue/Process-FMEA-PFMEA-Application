(() => {
  'use strict';

  const MAX_EXPORT_BYTES = 64 * 1024 * 1024;
  const EXPORT_TYPES = Object.freeze({
    pdf: Object.freeze({ extension: 'pdf', mime: 'application/pdf', label: 'PDF dokümanı' }),
    xlsx: Object.freeze({ extension: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Excel çalışma kitabı' }),
    dxf: Object.freeze({ extension: 'dxf', mime: 'application/dxf', label: 'DXF teknik çizimi' })
  });

  const TURKISH_ASCII = Object.freeze({
    'Ç': 'C', 'ç': 'c', 'Ğ': 'G', 'ğ': 'g', 'İ': 'I', 'ı': 'i',
    'Ö': 'O', 'ö': 'o', 'Ş': 'S', 'ş': 's', 'Ü': 'U', 'ü': 'u'
  });

  const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

  function tauriInvoke() {
    const invoke = globalThis.__TAURI__?.core?.invoke;
    return typeof invoke === 'function' ? invoke : null;
  }

  function isTauriDesktop() {
    // `__TAURI__` is the supported API exposed by `withGlobalTauri`. The
    // `__TAURI_INTERNALS__` object is an implementation detail and must not be
    // used as a feature gate: doing so can silently send a desktop build down
    // the browser-download path.
    return Boolean(tauriInvoke());
  }

  function normalizeExportType(type, fileName = '') {
    const explicit = String(type || '').trim().toLowerCase().replace(/^\./, '');
    const inferred = String(fileName).split('.').pop().toLowerCase();
    const key = EXPORT_TYPES[explicit] ? explicit : inferred;
    if (!EXPORT_TYPES[key]) throw new TypeError('Yalnızca PDF, XLSX ve DXF çıktıları kaydedilebilir.');
    return key;
  }

  function safeFileName(input, type) {
    const extension = EXPORT_TYPES[type].extension;
    const transliterated = String(input || `TYANA_EXPORT.${extension}`)
      .replace(/[ÇçĞğİıÖöŞşÜü]/g, character => TURKISH_ASCII[character])
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '');
    const withoutExtension = transliterated.replace(/\.(pdf|xlsx|dxf)$/i, '');
    let stem = withoutExtension
      .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/[ ._]+$/g, '')
      .replace(/^[ .]+/g, '')
      .slice(0, 100);
    if (!stem) stem = 'TYANA_EXPORT';
    if (WINDOWS_RESERVED_NAMES.test(stem)) stem = `TYANA_${stem}`;
    return `${stem}.${extension}`;
  }

  async function toBytes(data) {
    let bytes;
    if (data instanceof Uint8Array) bytes = data;
    else if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
    else if (ArrayBuffer.isView(data)) bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    else if (typeof Blob !== 'undefined' && data instanceof Blob) bytes = new Uint8Array(await data.arrayBuffer());
    else throw new TypeError('Çıktı verisi Blob, ArrayBuffer veya Uint8Array olmalıdır.');

    if (!bytes.byteLength) throw new RangeError('Boş bir çıktı kaydedilemez.');
    if (bytes.byteLength > MAX_EXPORT_BYTES) throw new RangeError('Tek çıktı boyutu 64 MB sınırını aşıyor.');
    return bytes;
  }

  function containsSequence(bytes, sequence) {
    if (!sequence.length || bytes.byteLength < sequence.length) return false;
    let offset = bytes.indexOf(sequence[0]);
    while (offset >= 0 && offset <= bytes.byteLength - sequence.length) {
      let matches = true;
      for (let index = 0; index < sequence.length; index += 1) {
        if (bytes[offset + index] !== sequence[index]) {
          matches = false;
          break;
        }
      }
      if (matches) return true;
      offset = bytes.indexOf(sequence[0], offset + 1);
    }
    return false;
  }

  function validateSignature(bytes, type) {
    const ascii = value => new TextEncoder().encode(value);
    if (type === 'pdf') {
      return containsSequence(bytes.subarray(0, 5), ascii('%PDF-'))
        && containsSequence(bytes.subarray(Math.max(0, bytes.byteLength - 2048)), ascii('%%EOF'));
    }
    if (type === 'xlsx') {
      return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
        && containsSequence(bytes, ascii('[Content_Types].xml'))
        && containsSequence(bytes, ascii('xl/workbook.xml'));
    }
    if (type === 'dxf') {
      for (const byte of bytes) if (byte === 0 || byte > 0x7f) return false;
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replaceAll('\r\n', '\n');
      return text.trimStart().startsWith('0\nSECTION') && text.trimEnd().endsWith('EOF');
    }
    return false;
  }

  async function saveWithTauri(bytes, fileName, type) {
    const invoke = tauriInvoke();
    if (!invoke) throw new Error('Tauri native kaydetme köprüsü kullanılamıyor.');

    let ticket;
    try {
      ticket = await invoke('prepare_export', { suggestedName: fileName, exportType: type });
    } catch (error) {
      throw new Error(`Windows kayıt penceresi açılamadı: ${typeof error === 'string' ? error : error?.message || 'Bilinmeyen yerel iletişim hatası.'}`);
    }
    if (ticket === null || ticket === undefined) return Object.freeze({ cancelled: true, mode: 'tauri', fileName, type });
    if (typeof ticket !== 'string' || !/^[a-f0-9]{32}$/i.test(ticket)) throw new Error('Windows kayıt oturumu doğrulanamadı.');

    let result;
    try {
      // Passing a Uint8Array as the second invoke argument is Tauri's raw IPC
      // path. It avoids JSON/base64 expansion while Rust still validates the
      // selected format and the one-time export ticket.
      result = await invoke('write_export', bytes, { headers: { 'x-tyana-export-ticket': ticket } });
    } catch (error) {
      throw new Error(`Dosya Windows diskine yazılamadı: ${typeof error === 'string' ? error : error?.message || 'Bilinmeyen yerel iletişim hatası.'}`);
    }
    if (!result || result.exportType !== type || result.bytesWritten !== bytes.byteLength || typeof result.fileName !== 'string') {
      throw new Error('Windows dosya yazma doğrulaması başarısız oldu.');
    }
    return Object.freeze({ cancelled: false, mode: 'tauri', ...result });
  }

  async function saveWithFilePicker(bytes, fileName, type) {
    const definition = EXPORT_TYPES[type];
    const handle = await globalThis.showSaveFilePicker({
      suggestedName: fileName,
      excludeAcceptAllOption: true,
      types: [{ description: definition.label, accept: { [definition.mime]: [`.${definition.extension}`] } }]
    });
    const writable = await handle.createWritable();
    try {
      await writable.write(bytes);
      await writable.close();
    } catch (error) {
      try { await writable.abort(); } catch {}
      throw error;
    }
    return Object.freeze({ cancelled: false, mode: 'file-picker', fileName, type, bytesWritten: bytes.byteLength });
  }

  function saveWithDownload(bytes, fileName, type) {
    const blob = new Blob([bytes], { type: EXPORT_TYPES[type].mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return Object.freeze({ cancelled: false, mode: 'download', fileName, type, bytesWritten: bytes.byteLength });
  }

  async function saveArtifact(options = {}) {
    const source = options.data ?? options.blob ?? options.bytes;
    const type = normalizeExportType(options.type ?? options.extension, options.fileName);
    const fileName = safeFileName(options.fileName, type);
    const bytes = await toBytes(source);
    if (!validateSignature(bytes, type)) throw new TypeError('Çıktı içeriği seçilen dosya türüyle uyuşmuyor.');

    if (isTauriDesktop()) return saveWithTauri(bytes, fileName, type);

    if (typeof globalThis.showSaveFilePicker === 'function' && globalThis.isSecureContext && !navigator.webdriver) {
      try {
        return await saveWithFilePicker(bytes, fileName, type);
      } catch (error) {
        if (error?.name === 'AbortError') return Object.freeze({ cancelled: true, mode: 'file-picker', fileName, type });
      }
    }
    return saveWithDownload(bytes, fileName, type);
  }

  function invokeDesktop(command, args = {}) {
    const invoke = tauriInvoke();
    if (!invoke) return Promise.reject(new Error('TYANA masaüstü veri köprüsü kullanılamıyor.'));
    return invoke(command, args).catch(error => {
      throw new Error(typeof error === 'string' ? error : error?.message || 'Yerel veri işlemi tamamlanamadı.');
    });
  }

  const LIBRARY_ASSET_PATHS = Object.freeze({
    'product-engineering': '/data/product-engineering-library.json',
    'pfmea-engineering': '/data/pfmea-engineering-library.json',
    'bom-engineering': '/data/bom-engineering-library.json',
    'quality-document': '/data/quality-document-library.json',
    'operation-code': '/data/operation-code-library.tr-en.v1.0.0.json'
  });

  async function loadJsonAsset(assetId) {
    const id = String(assetId || '').trim();
    if (!Object.hasOwn(LIBRARY_ASSET_PATHS, id)) throw new Error('Mühendislik kütüphanesi kimliği geçersiz.');
    if (isTauriDesktop()) return invokeDesktop('library_asset_get', { assetId: id });
    const response = await fetch(LIBRARY_ASSET_PATHS[id], { cache: 'no-store' });
    if (!response.ok) throw new Error(`Mühendislik kütüphanesi açılamadı (${response.status}).`);
    return response.json();
  }

  const WEB_PERMANENT_LICENSE_KEY = 'tyana-qflow-web-permanent-v1';
  const PERMANENT_KEY_HASH = '3b9cec43d8f4714fb4ce887c703d11e35db140cff4ce7244fb060c2b0ca76a44';

  async function licenseStatus() {
    if (isTauriDesktop()) return invokeDesktop('license_status');
    const permanent = globalThis.localStorage?.getItem(WEB_PERMANENT_LICENSE_KEY) === 'active';
    return Object.freeze({
      active: true,
      state: permanent ? 'permanent' : 'development',
      trialDays: 30,
      daysRemaining: permanent ? -1 : 30,
      hoursRemaining: permanent ? -1 : 720,
      startedAt: '',
      expiresAt: '',
      lastSeenAt: '',
      deviceId: 'WEB-PREVIEW',
      fullFeatured: true,
      message: 'Web geliştirme ön izlemesi'
    });
  }

  async function activatePermanentLicense(key) {
    if (isTauriDesktop()) return invokeDesktop('license_activate', { key: String(key || '') });
    const normalized = String(key || '').trim().toUpperCase();
    const bytes = new TextEncoder().encode(normalized);
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (digest !== PERMANENT_KEY_HASH) throw new Error('Kalıcı lisans anahtarı geçersiz.');
    globalThis.localStorage?.setItem(WEB_PERMANENT_LICENSE_KEY, 'active');
    return licenseStatus();
  }

  async function webJson(path, { method = 'GET', body } = {}) {
    const response = await fetch(path, {
      method,
      headers: body === undefined ? { accept: 'application/json' } : { accept: 'application/json', 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `İstek tamamlanamadı (${response.status}).`);
      if (payload.currentVersion) error.currentVersion = payload.currentVersion;
      throw error;
    }
    return payload;
  }

  const WEB_MASTER_TEMPLATE_KEY = 'tyana-qflow-master-templates-v1';

  function readWebMasterTemplates() {
    try {
      const parsed = JSON.parse(globalThis.localStorage?.getItem(WEB_MASTER_TEMPLATE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(item => item && typeof item === 'object') : [];
    } catch {
      return [];
    }
  }

  function writeWebMasterTemplates(records) {
    const text = JSON.stringify(records);
    if (text.length > 8 * 1024 * 1024) throw new RangeError('Web ana şablon kütüphanesi 8 MB sınırını aşıyor. Masaüstü SQLite sürümünü kullanın.');
    if (!globalThis.localStorage) throw new Error('Web yerel depolaması kullanılamıyor.');
    globalThis.localStorage.setItem(WEB_MASTER_TEMPLATE_KEY, text);
  }

  async function webMasterTemplateDigest(payload) {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function listWebMasterTemplates(productGroup = '') {
    const group = String(productGroup || '').trim();
    const templates = readWebMasterTemplates()
      .filter(item => item.status === 'active' && (!group || item.productGroup === group))
      .sort((left, right) => `${left.productGroupLabel} ${left.name}`.localeCompare(`${right.productGroupLabel} ${right.name}`, 'tr'))
      .map(({ payload: _payload, ...metadata }) => metadata);
    return { templates };
  }

  async function getWebMasterTemplate(id) {
    const template = readWebMasterTemplates().find(item => item.id === id && item.status === 'active') || null;
    return { template: template ? JSON.parse(JSON.stringify(template)) : null };
  }

  async function saveWebMasterTemplate(payload, id = null) {
    const encoded = JSON.stringify(payload);
    if (encoded.length > 2 * 1024 * 1024) throw new RangeError('Ana şablon kaydı 2 MB sınırını aşıyor.');
    const records = readWebMasterTemplates();
    const templateId = id || crypto.randomUUID();
    const existingIndex = records.findIndex(item => item.id === templateId);
    const existing = existingIndex >= 0 ? records[existingIndex] : null;
    if (existing && Number(payload.version || 0) !== Number(existing.version || 0)) throw new Error(`Ana şablon başka bir oturumda değiştirildi; güncel sürüm v${existing.version}.`);
    const duplicate = records.find(item => item.id !== templateId && item.status === 'active' && item.productGroup === payload.productGroup && String(item.name).localeCompare(String(payload.name), 'tr', { sensitivity: 'base' }) === 0);
    if (duplicate) throw new Error('Bu ürün grubunda aynı adlı etkin ana şablon zaten var.');
    const timestamp = new Date().toISOString();
    const record = {
      id: templateId,
      name: String(payload.name || '').trim(),
      productGroup: String(payload.productGroup || '').trim(),
      productGroupLabel: String(payload.productGroupLabel || '').trim(),
      description: String(payload.description || '').trim(),
      schemaVersion: String(payload.schemaVersion || ''),
      status: 'active',
      version: existing ? Number(existing.version || 0) + 1 : 1,
      contentSha256: await webMasterTemplateDigest(payload.templatePayload),
      payload: JSON.parse(JSON.stringify(payload.templatePayload)),
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp
    };
    if (existingIndex >= 0) records.splice(existingIndex, 1, record); else records.push(record);
    writeWebMasterTemplates(records);
    return { template: JSON.parse(JSON.stringify(record)) };
  }

  async function archiveWebMasterTemplate(id, version) {
    const records = readWebMasterTemplates();
    const index = records.findIndex(item => item.id === id && item.status === 'active');
    if (index < 0) throw new Error('Etkin ana şablon bulunamadı.');
    if (Number(records[index].version) !== Number(version)) throw new Error(`Ana şablon başka bir oturumda değiştirildi; güncel sürüm v${records[index].version}.`);
    records[index] = { ...records[index], status: 'archived', version: Number(version) + 1, updatedAt: new Date().toISOString() };
    writeWebMasterTemplates(records);
    return { ok: true, version: records[index].version };
  }

  const WEB_MACHINE_LIBRARY_KEY = 'tyana-qflow-machine-library-v1';
  const WEB_ELIGIBILITY_SEED = Object.freeze({
    114: ['D24'], 200: ['I13', 'I9'], 202: ['I50', 'I20', 'I30', 'I61', 'I60'],
    355: ['T195', 'T196', 'T197', 'T191', 'T192', 'T164', 'T193'],
    356: ['T195', 'T196', 'T197', 'T191', 'T192', 'T164', 'T193'],
    429: ['M12'], 435: ['M18'], 519: ['KK25', 'KK26', 'KK27', 'KK28']
  });

  function readWebMachineLibrary() {
    try {
      const stored = JSON.parse(localStorage.getItem(WEB_MACHINE_LIBRARY_KEY) || 'null');
      return stored && Array.isArray(stored.machines) && Array.isArray(stored.eligibility) ? stored : null;
    } catch { return null; }
  }

  function writeWebMachineLibrary(library) {
    localStorage.setItem(WEB_MACHINE_LIBRARY_KEY, JSON.stringify(library));
    return JSON.parse(JSON.stringify(library));
  }

  async function getWebMachineLibrary() {
    const existing = readWebMachineLibrary();
    if (existing) return JSON.parse(JSON.stringify(existing));
    const seed = await fetch('/data/machines-master-seed.json', { cache: 'no-store' }).then(response => {
      if (!response.ok) throw new Error('Makine ana veri tohumu bulunamadı.');
      return response.json();
    });
    const timestamp = new Date().toISOString();
    const machines = (seed.machines || []).map(machine => ({
      machineCode: String(machine.machine_code || '').toUpperCase(), machineType: machine.machine_type,
      description: machine.description || '', active: machine.active !== false, version: 1,
      createdAt: timestamp, updatedAt: timestamp
    }));
    const eligibility = Object.entries(WEB_ELIGIBILITY_SEED).flatMap(([opCode, machineCodes]) => machineCodes.map(machineCode => ({ opCode, machineCode, source: 'provided-prototype', updatedAt: timestamp })));
    return writeWebMachineLibrary({ machines, eligibility });
  }

  async function saveWebMachine(payload, originalCode = null) {
    const library = await getWebMachineLibrary();
    const machineCode = String(payload.machineCode || '').trim().toUpperCase();
    if (!/^[A-Z0-9._-]{1,40}$/.test(machineCode)) throw new Error('Makine kodu geçersiz.');
    if (!['cnc_tool', 'die_fixture', 'gauge_instrument', 'assembly_station', 'ndt_gauge'].includes(payload.machineType)) throw new Error('Makine türü geçersiz.');
    const lookup = String(originalCode || machineCode).toUpperCase();
    const index = library.machines.findIndex(machine => machine.machineCode === lookup);
    if (index < 0 && library.machines.some(machine => machine.machineCode === machineCode)) throw new Error('Makine kodu zaten kayıtlı.');
    const current = index >= 0 ? library.machines[index] : null;
    if (current && Number(payload.version || 0) !== Number(current.version || 0)) throw new Error(`Makine kaydı başka bir oturumda değiştirildi; güncel sürüm v${current.version}.`);
    const timestamp = new Date().toISOString();
    const machine = { machineCode, machineType: payload.machineType, description: String(payload.description || '').trim(), active: payload.active !== false, version: current ? current.version + 1 : 1, createdAt: current?.createdAt || timestamp, updatedAt: timestamp };
    if (index >= 0) library.machines.splice(index, 1, machine); else library.machines.push(machine);
    if (lookup !== machineCode) library.eligibility.forEach(link => { if (link.machineCode === lookup) link.machineCode = machineCode; });
    writeWebMachineLibrary(library);
    return { machine };
  }

  async function deleteWebMachine(machineCode) {
    const library = await getWebMachineLibrary();
    const code = String(machineCode || '').toUpperCase();
    const index = library.machines.findIndex(machine => machine.machineCode === code);
    if (index < 0) throw new Error('Makine kaydı bulunamadı.');
    library.machines.splice(index, 1);
    library.eligibility = library.eligibility.filter(link => link.machineCode !== code);
    writeWebMachineLibrary(library);
    return { ok: true };
  }

  async function saveWebEligibility(opCode, machineCodes, source = 'user-confirmed') {
    const library = await getWebMachineLibrary();
    const code = String(opCode || '').trim().toUpperCase();
    const unique = [...new Set((machineCodes || []).map(value => String(value).trim().toUpperCase()).filter(Boolean))];
    const active = new Set(library.machines.filter(machine => machine.active).map(machine => machine.machineCode));
    if (!code || unique.some(machineCode => !active.has(machineCode))) throw new Error('Operasyon veya etkin makine seçimi geçersiz.');
    const timestamp = new Date().toISOString();
    library.eligibility = library.eligibility.filter(link => link.opCode !== code);
    library.eligibility.push(...unique.map(machineCode => ({ opCode: code, machineCode, source, updatedAt: timestamp })));
    writeWebMachineLibrary(library);
    return { opCode: code, machineCodes: unique, source, updatedAt: timestamp };
  }

  const desktop = isTauriDesktop();
  if (desktop && typeof document?.addEventListener === 'function') {
    document.addEventListener('keydown', event => {
      const blocked = event.key === 'F12'
        || (event.ctrlKey && event.shiftKey && ['I', 'J', 'C'].includes(event.key.toUpperCase()))
        || (event.ctrlKey && event.key.toUpperCase() === 'U');
      if (blocked) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }
  const data = Object.freeze({
    listProcesses: () => desktop ? invokeDesktop('process_list') : webJson('/api/processes'),
    saveProcess: (payload, id = null) => desktop ? invokeDesktop('process_save', { id, payload }) : webJson(id ? `/api/processes/${encodeURIComponent(id)}` : '/api/processes', { method: id ? 'PUT' : 'POST', body: payload }),
    archiveProcess: id => desktop ? invokeDesktop('process_archive', { id }) : webJson(`/api/processes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    currentUser: () => desktop ? invokeDesktop('user_me') : webJson('/api/users/me'),
    listUsers: () => desktop ? invokeDesktop('user_list') : webJson('/api/users'),
    saveUser: (payload, id = null) => desktop ? invokeDesktop('user_save', { id, payload }) : webJson(id ? `/api/users/${encodeURIComponent(id)}` : '/api/users', { method: id ? 'PUT' : 'POST', body: payload }),
    deactivateUser: (id, version) => desktop ? invokeDesktop('user_deactivate', { id, version }) : webJson(`/api/users/${encodeURIComponent(id)}?version=${version}`, { method: 'DELETE' }),
    latestProject: () => desktop ? invokeDesktop('project_latest') : webJson('/api/projects/latest'),
    saveProject: (payload, id = null) => desktop ? invokeDesktop('project_save', { id, payload }) : webJson(id ? `/api/projects/${encodeURIComponent(id)}` : '/api/projects', { method: id ? 'PUT' : 'POST', body: payload }),
    listMasterTemplates: (productGroup = '') => desktop ? invokeDesktop('master_template_list', { productGroup: productGroup || null }) : listWebMasterTemplates(productGroup),
    getMasterTemplate: id => desktop ? invokeDesktop('master_template_get', { id }) : getWebMasterTemplate(id),
    saveMasterTemplate: (payload, id = null) => desktop ? invokeDesktop('master_template_save', { id, payload }) : saveWebMasterTemplate(payload, id),
    archiveMasterTemplate: (id, version) => desktop ? invokeDesktop('master_template_archive', { id, version }) : archiveWebMasterTemplate(id, version)
    ,machineLibrary: () => desktop ? invokeDesktop('machine_library_get') : getWebMachineLibrary()
    ,saveMachine: (payload, originalCode = null) => desktop ? invokeDesktop('machine_save', { originalCode, payload }) : saveWebMachine(payload, originalCode)
    ,deleteMachine: machineCode => desktop ? invokeDesktop('machine_delete', { machineCode }) : deleteWebMachine(machineCode)
    ,saveOperationMachineEligibility: (opCode, machineCodes, source = 'user-confirmed') => desktop ? invokeDesktop('operation_machine_eligibility_save', { opCode, machineCodes, source }) : saveWebEligibility(opCode, machineCodes, source)
  });

  async function storeDrawing(options = {}) {
    const bytes = await toBytes(options.data ?? options.bytes ?? options.blob);
    if (bytes.byteLength > 32 * 1024 * 1024) throw new RangeError('Teknik resim 32 MB sınırını aşıyor.');
    const extension = String(options.fileName || '').split('.').pop().toLowerCase().replace('jpeg', 'jpg');
    if (!['pdf', 'png', 'jpg'].includes(extension)) throw new TypeError('Teknik resim PDF, PNG veya JPEG olmalıdır.');
    const sha256 = String(options.sha256 || '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new TypeError('Teknik resim SHA-256 özeti geçersiz.');
    if (!desktop) return Object.freeze({ storageId: null, sha256, extension, bytesStored: bytes.byteLength, mode: 'web-reference' });
    const invoke = tauriInvoke();
    if (!invoke) throw new Error('TYANA masaüstü teknik resim köprüsü kullanılamıyor.');
    const result = await invoke('drawing_store', bytes, { headers: { 'x-tyana-sha256': sha256, 'x-tyana-extension': extension } });
    return Object.freeze({ ...result, mode: 'tauri-controlled-store' });
  }

  const adapter = Object.freeze({
    isDesktop: desktop,
    maxExportBytes: MAX_EXPORT_BYTES,
    supportedExportTypes: Object.freeze(Object.keys(EXPORT_TYPES)),
    saveArtifact,
    saveFile: saveArtifact,
    storeDrawing,
    loadJsonAsset,
    licenseStatus,
    activatePermanentLicense,
    data
  });

  Object.defineProperty(globalThis, 'TyanaPlatform', {
    configurable: false,
    enumerable: true,
    writable: false,
    value: adapter
  });
})();
