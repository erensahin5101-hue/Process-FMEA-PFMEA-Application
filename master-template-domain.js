(function initializeMasterTemplateDomain(global) {
  'use strict';

  const SCHEMA_VERSION = '1.0.0';
  const IDENTITY_FIELDS = Object.freeze([
    Object.freeze({ key: 'partName', label: 'Mamul adı', required: true, maxLength: 200 }),
    Object.freeze({ key: 'partNumber', label: 'OEM No', required: true, maxLength: 120 }),
    Object.freeze({ key: 'internalProductCode', label: 'Kuruluş içi ürün / stok kodu', required: true, maxLength: 120 }),
    Object.freeze({ key: 'customer', label: 'Müşteri / OEM', required: true, maxLength: 160 }),
    Object.freeze({ key: 'customerPartNumber', label: 'Müşteri ek referansı', required: false, maxLength: 120 }),
    Object.freeze({ key: 'projectCode', label: 'Proje / APQP no', required: true, maxLength: 100 }),
    Object.freeze({ key: 'controlPlanNumber', label: 'Kontrol planı no', required: true, maxLength: 100 }),
    Object.freeze({ key: 'drawingNumber', label: 'Teknik resim no', required: true, maxLength: 120 }),
    Object.freeze({ key: 'drawingRevision', label: 'Teknik resim revizyonu', required: true, maxLength: 20 }),
    Object.freeze({ key: 'productionPhase', label: 'Üretim fazı', required: true, maxLength: 80 }),
    Object.freeze({ key: 'annualVolume', label: 'Yıllık üretim adedi', required: false, maxLength: 24 })
  ]);
  const VOLATILE_SNAPSHOT_KEYS = Object.freeze(['snapshotId', 'generatedAt', 'projectId', 'sha256']);

  function clone(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function safeText(value, maxLength = 200) {
    const text = String(value ?? '').trim();
    if (text.length > maxLength || /[\u0000-\u001f\u007f]/.test(text)) throw new TypeError('Alan uzunluğu veya içeriği geçersiz.');
    return text;
  }

  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    return JSON.stringify(value);
  }

  function hashSummary(value) {
    // Fast deterministic summary for web fallback and change comparison. The
    // desktop backend calculates the authoritative SHA-256 before persistence.
    const text = stableStringify(value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}-${text.length}`;
  }

  function identityValues(source = {}) {
    return Object.fromEntries(IDENTITY_FIELDS.map(field => [field.key, safeText(source[field.key], field.maxLength)]));
  }

  function requiredIdentityIssues(source = {}) {
    const values = identityValues(source);
    return IDENTITY_FIELDS.filter(field => field.required && !values[field.key]).map(field => ({
      code: `IDENTITY_${field.key.toUpperCase()}`,
      severity: 'error',
      message: `${field.label} zorunludur.`
    }));
  }

  function routeOperationCode(step = {}) {
    return safeText(step.operationCode || step.operationCodeId || '', 80);
  }

  function assessReadiness(snapshot = {}) {
    const issues = [];
    const product = snapshot.product || {};
    issues.push(...requiredIdentityIssues(product));
    if (!safeText(product.productGroup, 100) || product.productGroup === '__custom__') issues.push({ code: 'PRODUCT_GROUP', severity: 'error', message: 'Kalıcı bir ürün grubu seçilmelidir.' });
    if (!safeText(product.productGroupLabel, 160)) issues.push({ code: 'PRODUCT_GROUP_LABEL', severity: 'error', message: 'Ürün grubu adı bulunamadı.' });

    const universe = snapshot.engineeringUniverse || {};
    const masters = Array.isArray(universe.itemMasters) ? universe.itemMasters : [];
    const definitions = Array.isArray(universe.bomDefinitions) ? universe.bomDefinitions : [];
    const root = masters.find(master => master.id === universe.rootItemMasterId);
    if (!root) issues.push({ code: 'ROOT_ITEM_MASTER', severity: 'error', message: 'Ana mamul malzeme kartı bulunamadı.' });
    if (product.productStructureType !== 'single_part' && !definitions.some(definition => definition.headerItemMasterId === universe.rootItemMasterId)) issues.push({ code: 'ROOT_BOM', severity: 'error', message: 'Ana mamul için aktif ürün ağacı tanımlanmalıdır.' });

    const route = Array.isArray(snapshot.route) ? snapshot.route : [];
    if (!route.length) issues.push({ code: 'ROUTE_EMPTY', severity: 'error', message: 'En az bir operasyon içeren proses rotası kurulmalıdır.' });
    route.forEach((step, index) => {
      if (!routeOperationCode(step)) issues.push({ code: 'ROUTE_OPERATION_CODE', severity: 'error', message: `OP ${step.operationNo || index + 1}: standart operasyon kodu bağlanmalıdır.` });
      if (!safeText(step.machineId || step.equipment || '', 300)) issues.push({ code: 'ROUTE_MACHINE', severity: 'warning', message: `OP ${step.operationNo || index + 1}: makine / ekipman bağı henüz tanımlanmadı.` });
    });

    const characteristics = Array.isArray(snapshot.characteristics) ? snapshot.characteristics : [];
    if (!characteristics.length) issues.push({ code: 'CHARACTERISTICS_EMPTY', severity: 'error', message: 'Kontrol planı için en az bir ölçü veya karakteristik tanımlanmalıdır.' });
    const pfmea = Array.isArray(snapshot.pfmea) ? snapshot.pfmea : [];
    if (!pfmea.length) issues.push({ code: 'PFMEA_EMPTY', severity: 'error', message: 'Ana şablon kaydından önce PFMEA risk satırları oluşturulmalıdır.' });
    const unlinkedCharacteristics = characteristics.filter(item => !item.routeKey && !item.processId);
    if (unlinkedCharacteristics.length) issues.push({ code: 'CHARACTERISTIC_ROUTE_LINK', severity: 'warning', message: `${unlinkedCharacteristics.length} karakteristik proses rotasına bağlı değil.` });

    const errors = issues.filter(issue => issue.severity === 'error');
    const warnings = issues.filter(issue => issue.severity === 'warning');
    return Object.freeze({
      ready: errors.length === 0,
      issues: Object.freeze(issues),
      errors: Object.freeze(errors),
      warnings: Object.freeze(warnings),
      metrics: Object.freeze({
        itemMasters: masters.length,
        bomDefinitions: definitions.length,
        components: Array.isArray(snapshot.components) ? snapshot.components.length : 0,
        routeSteps: route.length,
        codedOperations: route.filter(step => routeOperationCode(step)).length,
        characteristics: characteristics.length,
        pfmeaRows: pfmea.length
      })
    });
  }

  function resetControlledStatuses(snapshot) {
    const universe = snapshot.engineeringUniverse || {};
    if (Array.isArray(universe.itemMasters)) universe.itemMasters = universe.itemMasters.map(master => ({
      ...master,
      status: 'Taslak',
      validationStatus: 'PENDING_REVIEW',
      changeReason: 'Ürün grubu ana şablonundan yeni ürün oluşturuldu'
    }));
    if (Array.isArray(universe.bomDefinitions)) universe.bomDefinitions = universe.bomDefinitions.map(definition => ({
      ...definition,
      status: 'DRAFT',
      changeReason: 'Ürün grubu ana şablonundan yeni ürün oluşturuldu'
    }));
  }

  function sanitizeSnapshot(snapshot) {
    const source = clone(snapshot || {});
    const originalDrawing = safeText(source.product?.drawingNumber, 120);
    VOLATILE_SNAPSHOT_KEYS.forEach(key => delete source[key]);
    source.schemaVersion = source.schemaVersion || '4.0.0';
    source.product = { ...(source.product || {}) };
    IDENTITY_FIELDS.forEach(field => { source.product[field.key] = ''; });
    source.product.productTemplate = 'blank';
    source.product.documentStatus = 'Taslak';
    source.approval = { ...(source.approval || {}), preparedAt: '', status: 'Taslak' };
    delete source.drawingSource;
    if (source.ppap) source.ppap = { ...source.ppap, generatedDocuments: [] };
    if (source.bom) source.bom = { ...source.bom, history: [] };

    const universe = source.engineeringUniverse || {};
    const rootId = universe.rootItemMasterId;
    if (Array.isArray(universe.itemMasters)) universe.itemMasters = universe.itemMasters.map(master => master.id === rootId ? {
      ...master,
      internalCode: '', oemNo: '', name: '', description: '', drawingNo: '', drawingRevision: '',
      status: 'Taslak', validationStatus: 'PENDING_REVIEW', changeReason: 'Ana şablon kimlik alanı'
    } : { ...master });
    if (Array.isArray(universe.bomDefinitions)) universe.bomDefinitions = universe.bomDefinitions.map(definition => definition.headerItemMasterId === rootId ? {
      ...definition, bomNo: '', status: 'DRAFT', changeReason: 'Ana şablon kök BOM kimliği'
    } : { ...definition });
    source.engineeringUniverse = universe;
    resetControlledStatuses(source);

    if (Array.isArray(source.characteristics) && originalDrawing) {
      source.characteristics = source.characteristics.map(item => ({
        ...item,
        sourceDrawing: safeText(item.sourceDrawing, 160) === originalDrawing ? '{{DRAWING_NUMBER}}' : item.sourceDrawing
      }));
    }
    return source;
  }

  function createTemplatePayload(snapshot, options = {}) {
    const readiness = assessReadiness(snapshot);
    if (!readiness.ready && options.allowIncomplete !== true) {
      const error = new Error(readiness.errors[0]?.message || 'Ana şablon kalite kapısı geçilemedi.');
      error.code = 'MASTER_TEMPLATE_NOT_READY';
      error.readiness = readiness;
      throw error;
    }
    const name = safeText(options.name, 160);
    if (!name) throw new TypeError('Ana şablon adı zorunludur.');
    const description = safeText(options.description, 500);
    const productGroup = safeText(snapshot?.product?.productGroup, 100);
    const productGroupLabel = safeText(snapshot?.product?.productGroupLabel, 160);
    const sanitized = sanitizeSnapshot(snapshot);
    const payload = {
      schemaVersion: SCHEMA_VERSION,
      kind: 'PRODUCT_GROUP_MASTER_TEMPLATE',
      name,
      description,
      productGroup,
      productGroupLabel,
      source: {
        projectId: safeText(snapshot?.projectId, 120),
        snapshotSchemaVersion: safeText(snapshot?.schemaVersion, 30),
        templateVersion: safeText(snapshot?.templateVersion, 80),
        capturedAt: new Date().toISOString()
      },
      identityContract: {
        strategy: 'REPLACE_ROOT_PRODUCT_IDENTITY',
        requiredFields: IDENTITY_FIELDS.filter(field => field.required).map(field => field.key),
        clearedFields: IDENTITY_FIELDS.map(field => field.key),
        preserveChildItemMasters: true,
        resetApprovals: true,
        resetGeneratedDocuments: true
      },
      metrics: { ...readiness.metrics },
      snapshot: sanitized
    };
    payload.changeDigest = hashSummary(payload);
    return payload;
  }

  function validateTemplateRecord(record = {}) {
    const payload = record.payload || record.templatePayload || record;
    const issues = [];
    if (payload.schemaVersion !== SCHEMA_VERSION) issues.push(`Desteklenmeyen ana şablon şeması: ${payload.schemaVersion || 'yok'}`);
    if (payload.kind !== 'PRODUCT_GROUP_MASTER_TEMPLATE') issues.push('Kayıt ürün grubu ana şablonu değildir.');
    if (!safeText(payload.name, 160)) issues.push('Ana şablon adı eksik.');
    if (!safeText(payload.productGroup, 100)) issues.push('Ana şablon ürün grubu eksik.');
    if (!payload.snapshot || typeof payload.snapshot !== 'object') issues.push('Ana şablon snapshot omurgası eksik.');
    if (payload.snapshot?.product?.productGroup !== payload.productGroup) issues.push('Şablon ürün grubu ile snapshot ürün grubu eşleşmiyor.');
    const required = payload.identityContract?.requiredFields;
    if (!Array.isArray(required) || IDENTITY_FIELDS.filter(field => field.required).some(field => !required.includes(field.key))) issues.push('Yeni ürün kimlik sözleşmesi eksik.');
    return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
  }

  function instantiate(record = {}, incomingIdentity = {}, options = {}) {
    const payload = record.payload || record.templatePayload || record;
    const validation = validateTemplateRecord(payload);
    if (!validation.valid) throw new TypeError(validation.issues[0]);
    const identity = identityValues(incomingIdentity);
    const issues = requiredIdentityIssues(identity);
    if (issues.length) {
      const error = new TypeError(issues[0].message);
      error.code = 'MASTER_TEMPLATE_IDENTITY_REQUIRED';
      error.issues = issues;
      throw error;
    }
    const snapshot = clone(payload.snapshot);
    snapshot.snapshotId = options.snapshotId || (global.crypto?.randomUUID?.() || `SNAP-${Date.now()}`);
    snapshot.generatedAt = options.generatedAt || new Date().toISOString();
    snapshot.projectId = null;
    delete snapshot.sha256;
    snapshot.product = { ...(snapshot.product || {}), ...identity, productTemplate: 'blank', documentStatus: 'Taslak' };
    snapshot.product.productGroup = payload.productGroup;
    snapshot.product.productGroupLabel = payload.productGroupLabel;
    const today = (options.generatedAt || new Date().toISOString()).slice(0, 10);
    snapshot.product.originalDate = today;
    snapshot.product.revisionDate = today;
    snapshot.approval = { ...(snapshot.approval || {}), preparedAt: '', status: 'Taslak' };
    delete snapshot.drawingSource;
    if (snapshot.ppap) snapshot.ppap = { ...snapshot.ppap, generatedDocuments: [] };
    if (snapshot.bom) snapshot.bom = { ...snapshot.bom, history: [] };

    const universe = snapshot.engineeringUniverse || {};
    const rootId = universe.rootItemMasterId;
    if (Array.isArray(universe.itemMasters)) universe.itemMasters = universe.itemMasters.map(master => master.id === rootId ? {
      ...master,
      internalCode: identity.internalProductCode,
      oemNo: identity.partNumber,
      name: identity.partName,
      description: identity.partName,
      drawingNo: identity.drawingNumber,
      drawingRevision: identity.drawingRevision,
      status: 'Taslak', validationStatus: 'PENDING_REVIEW',
      changeReason: `Ana şablondan yeni ürün: ${payload.name}`
    } : { ...master });
    if (Array.isArray(universe.bomDefinitions)) universe.bomDefinitions = universe.bomDefinitions.map(definition => definition.headerItemMasterId === rootId ? {
      ...definition,
      bomNo: `BOM-${identity.internalProductCode}`,
      status: 'DRAFT',
      changeReason: `Ana şablondan yeni ürün: ${payload.name}`
    } : { ...definition });
    snapshot.engineeringUniverse = universe;
    resetControlledStatuses(snapshot);
    if (Array.isArray(snapshot.characteristics)) snapshot.characteristics = snapshot.characteristics.map(item => ({
      ...item,
      sourceDrawing: item.sourceDrawing === '{{DRAWING_NUMBER}}' ? identity.drawingNumber : item.sourceDrawing
    }));
    snapshot.masterTemplateOrigin = {
      id: safeText(record.id, 120),
      name: payload.name,
      productGroup: payload.productGroup,
      version: Number(record.version || 1),
      schemaVersion: payload.schemaVersion,
      changeDigest: payload.changeDigest || ''
    };
    return snapshot;
  }

  global.TyanaMasterTemplates = Object.freeze({
    SCHEMA_VERSION,
    IDENTITY_FIELDS,
    assessReadiness,
    createTemplatePayload,
    validateTemplateRecord,
    instantiate,
    sanitizeSnapshot,
    stableStringify
  });
})(globalThis);
