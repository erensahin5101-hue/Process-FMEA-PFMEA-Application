(function bootstrapTyanaBom(globalScope) {
  'use strict';

  const ROOT_ID = 'FINISHED_GOOD';
  const CONTAINER_TYPES = new Set(['Alt montaj', 'Mamul', 'Yarı mamul']);
  const PURCHASED_TYPES = new Set(['Satın alınan parça', 'Satın alınan bileşen', 'Bağlantı elemanı', 'Montaj malzemesi', 'Ambalaj malzemesi', 'Dış tedarik ürünü (XD)']);
  const INTERNAL_TYPES = new Set(['İç üretim parçası', 'Üretilen bileşen', 'Yarı mamul', 'Alt montaj']);
  const PLACEHOLDER_PATTERN = /^(?:|tanımlanacak|seçiniz|seçin|gerekli|bekliyor|teknik resme göre)$/i;

  const ENGINEERING_SCHEMA_VERSION = '2.0.0';
  const ITEM_MASTER_TYPES = new Set([
    'FINISHED_GOOD',
    'SUBASSEMBLY',
    'SEMI_FINISHED',
    'MANUFACTURED_PART',
    'PURCHASED_PART',
    'ASSEMBLY_MATERIAL',
    'EXTERNAL_PURCHASED',
    'RAW_MATERIAL',
    'FASTENER',
    'CONSUMABLE',
    'PACKAGING'
  ]);
  const PROCUREMENT_TYPES = new Set(['MAKE', 'BUY', 'BOTH', 'PHANTOM', 'CUSTOMER_SUPPLIED']);
  const MASTER_VALIDATION_STATUSES = new Set(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'OBSOLETE']);

  function uid(prefix = 'ITEM') {
    const value = globalScope.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${value.slice(0, 12).toUpperCase()}`;
  }

  function text(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
  }

  function numeric(value, fallback = 0) {
    if (typeof value === 'string') value = value.trim().replace(',', '.');
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeComponent(record = {}, index = 0) {
    const source = record && typeof record === 'object' ? record : {};
    const itemMasterId = text(source.itemMasterId ?? source.partMasterId ?? source.materialMasterId);
    const internalCode = Object.prototype.hasOwnProperty.call(source, 'itemNo')
      ? text(source.itemNo)
      : text(source.internalCode ?? source.internalStockCode ?? source.partNumber);
    const revision = Object.prototype.hasOwnProperty.call(source, 'revision') ? String(source.revision ?? '').trim() : 'A';
    const itemRevision = Object.prototype.hasOwnProperty.call(source, 'itemRevision') ? String(source.itemRevision ?? '').trim() : revision;
    const drawingRevision = Object.prototype.hasOwnProperty.call(source, 'drawingRevision') ? String(source.drawingRevision ?? '').trim() : revision;
    const quantity = numeric(source.quantity ?? source.usageQuantity, 1);
    const componentType = text(source.componentType, 'İç üretim parçası');
    const makeBuy = text(source.makeBuy, PURCHASED_TYPES.has(componentType) ? 'Satın al' : 'Üret');
    const installationStage = text(source.installationStage ?? source.assemblyStage, 'Proses akışına göre');
    const prerequisiteProcessId = text(source.prerequisiteProcessId ?? source.preconditionProcessId ?? source.mustFollowProcessId);
    const normalized = {
      ...source,
      id: text(source.id, uid()),
      itemMasterId,
      partMasterId: text(source.partMasterId, itemMasterId),
      internalCode,
      internalStockCode: internalCode,
      oemNo: text(source.oemNo ?? source.oemNumber ?? source.customerPartNo ?? source.customerItemNo),
      position: text(source.position, String((index + 1) * 10)),
      parentId: text(source.parentId, ROOT_ID),
      itemNo: internalCode,
      name: text(source.name, 'Yeni bileşen'),
      componentType,
      quantity,
      usageQuantity: numeric(source.usageQuantity ?? quantity, quantity),
      uom: text(source.uom, 'adet'),
      makeBuy,
      itemRevision,
      revision,
      drawingNo: text(source.drawingNo),
      drawingRevision,
      supplier: text(source.supplier),
      critical: Boolean(source.critical),
      specialCharacteristic: text(source.specialCharacteristic, source.critical ? 'SC' : 'NONE'),
      description: text(source.description ?? source.notes),
      notes: text(source.notes ?? source.description),
      status: text(source.status, 'Taslak'),
      alternativePartNo: text(source.alternativePartNo),
      alternativeGroupId: text(source.alternativeGroupId),
      alternativeSelected: source.alternativeSelected !== false && source.alternativeSelection !== false,
      effectiveFrom: text(source.effectiveFrom ?? source.effectivityFrom),
      effectiveTo: text(source.effectiveTo ?? source.effectivityTo),
      catalogItemId: text(source.catalogItemId ?? source.itemMasterId),
      catalogRevision: text(source.catalogRevision),
      reuseMode: text(source.reuseMode, 'embedded'),
      reusable: Boolean(source.reusable),
      producedAtProcessId: text(source.producedAtProcessId ?? source.producedProcessId),
      firstUseProcessId: text(source.firstUseProcessId),
      mountedAtProcessId: text(source.mountedAtProcessId ?? source.assemblyProcessId),
      inspectedAtProcessId: text(source.inspectedAtProcessId ?? source.inspectionProcessId),
      processModuleId: text(source.processModuleId),
      operationCode: text(source.operationCode),
      operationLinkStatus: text(source.operationLinkStatus, 'Henüz atanmadı'),
      installationStage,
      prerequisiteProcessId,
      nextProcessId: text(source.nextProcessId),
      assemblySequence: text(source.assemblySequence),
      paintSensitive: Boolean(source.paintSensitive) || /boya\s+sonrası|post[-_ ]?paint/i.test(installationStage),
      installationConstraint: text(source.installationConstraint, /boya\s+sonrası|post[-_ ]?paint/i.test(installationStage) ? 'AFTER_PAINT' : ''),
      changeReason: text(source.changeReason)
    };

    normalized.quantity = quantity;
    normalized.usageQuantity = numeric(source.usageQuantity ?? quantity, quantity);
    normalized.revision = revision;
    normalized.itemRevision = itemRevision;
    normalized.drawingRevision = drawingRevision;
    normalized.installationStage = installationStage;
    normalized.prerequisiteProcessId = prerequisiteProcessId;
    normalized.alternativeSelected = source.alternativeSelected !== false && source.alternativeSelection !== false;
    normalized.paintSensitive = Boolean(source.paintSensitive) || /boya\s+sonrası|post[-_ ]?paint/i.test(installationStage);
    normalized.installationConstraint = text(source.installationConstraint, /boya\s+sonrası|post[-_ ]?paint/i.test(installationStage) ? 'AFTER_PAINT' : '');
    return normalized;
  }

  function normalizeComponents(records = []) {
    return Array.isArray(records) ? records.map(normalizeComponent) : [];
  }

  function positionCompare(left, right) {
    const a = numeric(left.position, Number.MAX_SAFE_INTEGER);
    const b = numeric(right.position, Number.MAX_SAFE_INTEGER);
    return a === b ? String(left.position).localeCompare(String(right.position), 'tr') : a - b;
  }

  function childRecords(records, parentId) {
    return records.filter(item => item.parentId === parentId).sort(positionCompare);
  }

  function tree(records = [], rootId = ROOT_ID) {
    const items = normalizeComponents(records);
    const visit = (parentId, ancestors = new Set()) => childRecords(items, parentId).map(item => {
      if (ancestors.has(item.id)) return { ...item, children: [], cycle: true };
      const next = new Set(ancestors); next.add(item.id);
      return { ...item, children: visit(item.id, next) };
    });
    return visit(rootId);
  }

  function descendants(records = [], id) {
    const items = normalizeComponents(records);
    const result = [];
    const visited = new Set([id]);
    const visit = parentId => childRecords(items, parentId).forEach(item => {
      if (visited.has(item.id)) return;
      visited.add(item.id); result.push(item); visit(item.id);
    });
    visit(id);
    return result;
  }

  function path(records = [], id, rootName = 'Ana mamul') {
    const items = normalizeComponents(records);
    const byId = new Map(items.map(item => [item.id, item]));
    const names = [];
    const visited = new Set();
    let current = byId.get(id);
    while (current && !visited.has(current.id)) {
      visited.add(current.id); names.unshift(current.name || current.itemNo || current.id);
      current = current.parentId === ROOT_ID ? null : byId.get(current.parentId);
    }
    names.unshift(rootName);
    return names;
  }

  function flatten(records = [], rootName = 'Ana mamul') {
    const items = normalizeComponents(records);
    const rows = [];
    const visit = (parentId, level, ancestors) => childRecords(items, parentId).forEach(item => {
      const cycle = ancestors.has(item.id);
      rows.push({ ...item, level, path: [...path(items, item.id, rootName)].join(' > '), childCount: childRecords(items, item.id).length, cycle });
      if (!cycle) { const next = new Set(ancestors); next.add(item.id); visit(item.id, level + 1, next); }
    });
    visit(ROOT_ID, 1, new Set());
    const known = new Set(rows.map(row => row.id));
    items.filter(item => !known.has(item.id)).forEach(item => rows.push({ ...item, level: 1, path: `${rootName} > [Yetim] > ${item.name}`, childCount: 0, orphan: true }));
    return rows;
  }

  function wouldCreateCycle(records = [], id, parentId) {
    if (!id || !parentId || parentId === ROOT_ID) return false;
    if (id === parentId) return true;
    return descendants(records, id).some(item => item.id === parentId);
  }

  function issue(code, message, componentId = '', severity = 'error', detail = {}) {
    return Object.freeze({ code, message, componentId, severity, ...detail });
  }

  function routeProcessId(step = {}) {
    return text(step.processId ?? step.routeKey).split('::')[0];
  }

  function linkedRouteIndex(route, value) {
    if (!value) return -1;
    return route.findIndex(step => step.routeKey === value || step.processId === value || routeProcessId(step) === String(value).split('::')[0] || step.operationNo === value);
  }

  function validate(records = [], context = {}) {
    const items = normalizeComponents(records);
    const route = Array.isArray(context.route) ? context.route : [];
    const characteristics = Array.isArray(context.characteristics) ? context.characteristics : [];
    const pfmea = Array.isArray(context.pfmea) ? context.pfmea : [];
    const strict = Boolean(context.strict);
    const issues = [];
    const ids = new Map();
    const byId = new Map(items.map(item => [item.id, item]));

    items.forEach(item => {
      if (ids.has(item.id)) issues.push(issue('DUPLICATE_ID', `Bileşen kimliği yineleniyor: ${item.id}`, item.id));
      ids.set(item.id, item);
      if (!item.itemNo) issues.push(issue('MISSING_ITEM_NUMBER', 'Parça/stok kodu eksik.', item.id));
      if (!item.name) issues.push(issue('MISSING_NAME', 'Bileşen adı eksik.', item.id));
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) issues.push(issue('INVALID_QUANTITY', 'Miktar sıfırdan büyük olmalıdır.', item.id));
      if (item.parentId === item.id) issues.push(issue('SELF_REFERENCE', 'Bileşen kendisini üst bileşen olarak kullanamaz.', item.id));
      else if (item.parentId !== ROOT_ID && !byId.has(item.parentId)) issues.push(issue('ORPHAN_PARENT', 'Üst bileşen BOM içinde bulunamadı.', item.id));
      else if (item.parentId !== ROOT_ID && !CONTAINER_TYPES.has(byId.get(item.parentId)?.componentType)) issues.push(issue('INVALID_PARENT_TYPE', 'Yalnız mamul, yarı mamul veya alt montaj alt bileşen taşıyabilir.', item.id));
      if (wouldCreateCycle(items, item.id, item.parentId)) issues.push(issue('BOM_CYCLE', 'Döngüsel BOM bağlantısı algılandı.', item.id));
      if (item.drawingNo && !PLACEHOLDER_PATTERN.test(item.drawingNo) && !item.drawingRevision) issues.push(issue('MISSING_DRAWING_REVISION', 'Teknik resim revizyonu eksik.', item.id));
      if ((PURCHASED_TYPES.has(item.componentType) || ['Satın al', 'Fason proses', 'Müşteri tedariki'].includes(item.makeBuy)) && PLACEHOLDER_PATTERN.test(item.supplier)) issues.push(issue('PURCHASED_SUPPLIER_MISSING', 'Satın alınan/fason bileşende tedarikçi eksik.', item.id));
    });

    const siblingPositions = new Map();
    items.forEach(item => {
      const key = `${item.parentId}\u0000${item.position}`;
      if (siblingPositions.has(key)) issues.push(issue('DUPLICATE_POSITION', `Aynı üst seviyede ${item.position} pozisyonu yineleniyor.`, item.id, 'error', { conflictingComponentId: siblingPositions.get(key) }));
      else siblingPositions.set(key, item.id);
    });

    const alternativeGroups = new Map();
    items.filter(item => item.alternativeGroupId).forEach(item => {
      const key = `${item.parentId}\u0000${item.alternativeGroupId}`;
      const group = alternativeGroups.get(key) || [];
      group.push(item); alternativeGroups.set(key, group);
    });
    alternativeGroups.forEach(group => {
      if (group.filter(item => item.alternativeSelected).length !== 1) group.forEach(item => issues.push(issue('ALTERNATIVE_SELECTION_INVALID', 'Alternatif grubunda tam olarak bir bileşen seçilmelidir.', item.id)));
    });

    if (route.length) {
      const paintIndex = route.findIndex(step => ['painting', 'coating'].includes(routeProcessId(step)) || /boya/i.test(step.name || ''));
      const usedIds = new Set(route.flatMap(step => [...(step.inputComponentIds || []), step.outputItemId].filter(Boolean)));
      items.forEach(item => {
        const mountedAt = item.mountedAtProcessId || item.firstUseProcessId;
        const mountIndex = linkedRouteIndex(route, mountedAt);
        const mapped = usedIds.has(item.id) || mountIndex >= 0 || linkedRouteIndex(route, item.producedAtProcessId) >= 0 || linkedRouteIndex(route, item.inspectedAtProcessId) >= 0;
        if (INTERNAL_TYPES.has(item.componentType) && item.makeBuy === 'Üret' && linkedRouteIndex(route, item.producedAtProcessId) < 0) issues.push(issue('INTERNAL_PROCESS_UNASSIGNED', 'İç üretim bileşeni üretildiği prosese bağlanmamış.', item.id, strict ? 'error' : 'warning'));
        if (item.critical && !mapped) issues.push(issue('CRITICAL_OPERATION_UNASSIGNED', 'Kritik bileşenin operasyon bağlantısı yok.', item.id, strict ? 'error' : 'warning'));
        if (!mapped && item.status !== 'Uygulanamaz') issues.push(issue('UNUSED_COMPONENT', 'BOM bileşeni hiçbir proseste kullanılmıyor.', item.id, 'warning'));
        if ((item.paintSensitive || item.installationConstraint === 'AFTER_PAINT' || /boya\s+sonrası|post[-_ ]?paint/i.test(item.installationStage)) && paintIndex >= 0 && (mountIndex < 0 || mountIndex <= paintIndex)) issues.push(issue('PAINT_ORDER_VIOLATION', 'Boya sonrası takılması gereken bileşen boya öncesine veya boya operasyonuna bağlanmış.', item.id));
        if (item.prerequisiteProcessId) {
          const prerequisiteIndex = linkedRouteIndex(route, item.prerequisiteProcessId);
          if (mountIndex >= 0 && prerequisiteIndex >= 0 && mountIndex <= prerequisiteIndex) issues.push(issue('PROCESS_PREREQUISITE_VIOLATION', 'Bileşen montajı tanımlı ön koşul prosesten sonra olmalıdır.', item.id));
        }
      });
    }

    items.filter(item => item.critical || !['NONE', ''].includes(item.specialCharacteristic)).forEach(item => {
      const controlled = characteristics.some(characteristic => characteristic.componentId === item.id && characteristic.controlPlanIncluded !== false && (!strict || Boolean(characteristic.controlPlanRowId || characteristic.id)) && !['NONE', 'Yok', ''].includes(characteristic.classification || characteristic.specialCharacteristic || ''));
      if (!controlled) issues.push(issue('SPECIAL_CHARACTERISTIC_MISSING_CONTROL', 'Özel/kritik bileşenin kontrol planı karakteristiği yok.', item.id, strict ? 'error' : 'warning'));
    });
    pfmea.filter(row => row.componentId && row.componentId !== ROOT_ID).forEach(row => {
      const explicitLink = row.controlPlanCharacteristicId || row.controlPlanRowId;
      const controlled = explicitLink
        ? characteristics.some(characteristic => [characteristic.id, characteristic.controlPlanRowId].includes(explicitLink) && characteristic.controlPlanIncluded !== false)
        : !strict && characteristics.some(characteristic => characteristic.componentId === row.componentId && characteristic.controlPlanIncluded !== false && (!row.routeKey || !characteristic.routeKey || characteristic.routeKey === row.routeKey));
      if (!controlled) issues.push(issue('PFMEA_RISK_MISSING_CONTROL', 'PFMEA riskinin kontrol planında bağlı karakteristiği yok.', row.componentId, strict ? 'error' : 'warning', { pfmeaId: row.id || row.sourceKey || '' }));
    });
    return issues;
  }

  function summarizeValidation(issues = []) {
    const errors = issues.filter(item => item.severity !== 'warning');
    const warnings = issues.filter(item => item.severity === 'warning');
    return Object.freeze({ valid: errors.length === 0, errors, warnings, issues });
  }

  function reorder(records = [], movedId, targetId, mode = 'after') {
    const result = normalizeComponents(records).map(item => ({ ...item }));
    const moved = result.find(item => item.id === movedId);
    const target = result.find(item => item.id === targetId);
    if (!moved || !target || moved.id === target.id) return result;
    const parentId = mode === 'inside' && CONTAINER_TYPES.has(target.componentType) ? target.id : target.parentId;
    if (wouldCreateCycle(result, moved.id, parentId)) throw new Error('Döngüsel BOM taşıması reddedildi.');
    moved.parentId = parentId;
    const siblings = childRecords(result.filter(item => item.id !== moved.id), parentId);
    let targetIndex = mode === 'inside' ? siblings.length : siblings.findIndex(item => item.id === target.id);
    if (targetIndex < 0) targetIndex = siblings.length;
    if (mode === 'after') targetIndex += 1;
    siblings.splice(targetIndex, 0, moved);
    siblings.forEach((item, index) => { item.position = String((index + 1) * 10); });
    return result;
  }

  function subtree(records = [], rootId) {
    const items = normalizeComponents(records);
    const root = items.find(item => item.id === rootId);
    return root ? [root, ...descendants(items, rootId)] : [];
  }

  function nextPosition(records = [], parentId = ROOT_ID) {
    const maximum = childRecords(normalizeComponents(records), parentId).reduce((value, item) => Math.max(value, numeric(item.position, 0)), 0);
    return String(Math.ceil(maximum / 10) * 10 + 10);
  }

  function asciiFold(value) {
    return text(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[ıİ]/g, 'i')
      .replace(/[şŞ]/g, 's')
      .replace(/[ğĞ]/g, 'g')
      .replace(/[üÜ]/g, 'u')
      .replace(/[öÖ]/g, 'o')
      .replace(/[çÇ]/g, 'c')
      .toLowerCase();
  }

  function canonicalItemType(value, fallback = 'MANUFACTURED_PART') {
    const raw = text(value);
    const upper = raw.toUpperCase().replace(/[\s-]+/g, '_');
    if (ITEM_MASTER_TYPES.has(upper)) return upper;
    const folded = asciiFold(raw);
    if (/yar[i ]+mamul|semi.finished/.test(folded)) return 'SEMI_FINISHED';
    if (/alt montaj|subassembly/.test(folded)) return 'SUBASSEMBLY';
    if (/d[iı]s tedarik|external|xd/.test(folded)) return 'EXTERNAL_PURCHASED';
    if (/montaj malzemesi|assembly material/.test(folded)) return 'ASSEMBLY_MATERIAL';
    if (/sat[i ]*n al|purchased/.test(folded)) return 'PURCHASED_PART';
    if (/hammadde|raw material/.test(folded)) return 'RAW_MATERIAL';
    if (/baglanti|fastener/.test(folded)) return 'FASTENER';
    if (/sarf|consumable/.test(folded)) return 'CONSUMABLE';
    if (/ambalaj|packaging/.test(folded)) return 'PACKAGING';
    if (/mamul|finished.good/.test(folded)) return 'FINISHED_GOOD';
    if (/uretil|ic uretim|manufactured/.test(folded)) return 'MANUFACTURED_PART';
    return ITEM_MASTER_TYPES.has(fallback) ? fallback : 'MANUFACTURED_PART';
  }

  function canonicalProcurementType(value, itemType = 'MANUFACTURED_PART') {
    const raw = text(value);
    const upper = raw.toUpperCase().replace(/[\s-]+/g, '_');
    if (PROCUREMENT_TYPES.has(upper)) return upper;
    const folded = asciiFold(raw);
    if (/musteri|customer/.test(folded)) return 'CUSTOMER_SUPPLIED';
    if (/her ikisi|both/.test(folded)) return 'BOTH';
    if (/phantom|hayalet/.test(folded)) return 'PHANTOM';
    if (/sat[i ]*n al|buy|fason|tedarik/.test(folded)) return 'BUY';
    if (/uret|make/.test(folded)) return 'MAKE';
    return ['PURCHASED_PART', 'ASSEMBLY_MATERIAL', 'EXTERNAL_PURCHASED', 'RAW_MATERIAL', 'FASTENER', 'CONSUMABLE', 'PACKAGING'].includes(itemType) ? 'BUY' : 'MAKE';
  }

  function canonicalValidationStatus(value) {
    const raw = text(value);
    const upper = raw.toUpperCase().replace(/[\s-]+/g, '_');
    if (MASTER_VALIDATION_STATUSES.has(upper)) return upper;
    const folded = asciiFold(raw);
    if (/onayl[i ]|approved|verified|dogruland/.test(folded)) return 'APPROVED';
    if (/inceleme|bekliyor|pending|review/.test(folded)) return 'PENDING_REVIEW';
    if (/redd|rejected|blocked|engell/.test(folded)) return 'REJECTED';
    if (/obsolete|iptal|kullan[i ]m disi/.test(folded)) return 'OBSOLETE';
    return 'DRAFT';
  }

  function normalizeItemMaster(record = {}, index = 0) {
    const source = record && typeof record === 'object' ? record : {};
    const itemType = canonicalItemType(source.itemType ?? source.masterType ?? source.componentType, index === 0 && source.isFinishedGood ? 'FINISHED_GOOD' : 'MANUFACTURED_PART');
    const procurementType = canonicalProcurementType(source.procurementType ?? source.makeBuy, itemType);
    const id = text(source.itemMasterId ?? source.partMasterId ?? source.materialMasterId ?? source.catalogItemId ?? source.id, uid('MAT'));
    const internalCode = text(source.internalCode ?? source.internalStockCode ?? source.stockCode ?? source.itemNo ?? source.partNumber);
    const description = text(source.description ?? source.name ?? source.partName);
    const revision = text(source.revision ?? source.itemRevision, 'A');
    const validationStatus = canonicalValidationStatus(source.validationStatus ?? source.verificationStatus ?? source.status);
    return {
      ...source,
      id,
      itemMasterId: id,
      internalCode,
      internalStockCode: internalCode,
      itemNo: internalCode,
      oemNo: text(source.oemNo ?? source.oemNumber ?? source.customerPartNo ?? source.customerItemNo),
      name: text(source.name ?? source.partName, description),
      description,
      itemType,
      componentType: text(source.componentType, itemType),
      revision,
      itemRevision: text(source.itemRevision, revision),
      uom: text(source.uom ?? source.unit, 'adet'),
      procurementType,
      makeBuy: text(source.makeBuy, procurementType === 'BUY' ? 'Satın al' : 'Üret'),
      validationStatus,
      status: text(source.status, validationStatus === 'APPROVED' ? 'Onaylı' : 'Taslak'),
      drawingNo: text(source.drawingNo),
      drawingRevision: text(source.drawingRevision, revision),
      defaultOperationCodes: Array.isArray(source.defaultOperationCodes) ? [...new Set(source.defaultOperationCodes.map(code => text(code)).filter(Boolean))] : [],
      sourceOrganization: text(source.sourceOrganization),
      changeReason: text(source.changeReason)
    };
  }

  function normalizeItemMasters(records = []) {
    return Array.isArray(records) ? records.map(normalizeItemMaster) : [];
  }

  function normalizeBomLine(record = {}, index = 0) {
    const source = record && typeof record === 'object' ? record : {};
    const quantity = numeric(source.quantity ?? source.bomQuantity ?? source.usageQuantity, 1);
    const id = text(source.id ?? source.lineId, uid('BOMLINE'));
    return {
      ...source,
      id,
      lineId: id,
      position: text(source.position, String((index + 1) * 10)),
      itemMasterId: text(source.itemMasterId ?? source.partMasterId ?? source.materialMasterId ?? source.catalogItemId),
      quantity,
      bomQuantity: quantity,
      usageQuantity: numeric(source.usageQuantity ?? quantity, quantity),
      uom: text(source.uom ?? source.unit, 'adet'),
      referencedRevision: text(source.referencedRevision ?? source.itemRevision ?? source.revision),
      effectiveFrom: text(source.effectiveFrom ?? source.validFrom ?? source.effectivityFrom),
      effectiveTo: text(source.effectiveTo ?? source.validTo ?? source.effectivityTo),
      alternativeGroupId: text(source.alternativeGroupId),
      alternativeSelected: source.alternativeSelected !== false && source.alternativeSelection !== false,
      assemblyOperationCode: text(source.assemblyOperationCode ?? source.operationCode),
      operationCode: text(source.operationCode ?? source.assemblyOperationCode),
      legacyComponentId: text(source.legacyComponentId),
      notes: text(source.notes ?? source.description)
    };
  }

  function normalizeBomDefinition(record = {}, index = 0) {
    const source = record && typeof record === 'object' ? record : {};
    const headerItemMasterId = text(source.headerItemMasterId ?? source.itemMasterId ?? source.materialMasterId ?? source.rootItemMasterId);
    const revision = text(source.revision ?? source.bomRevision, 'A');
    const rawLines = Array.isArray(source.lines) ? source.lines : Array.isArray(source.items) ? source.items : [];
    const id = text(source.id ?? source.bomId, uid('BOM'));
    return {
      ...source,
      id,
      bomId: id,
      bomNo: text(source.bomNo, `BOM-${headerItemMasterId || index + 1}`),
      headerItemMasterId,
      revision,
      bomRevision: text(source.bomRevision, revision),
      alternative: text(source.alternative, '01'),
      status: canonicalValidationStatus(source.status ?? source.validationStatus),
      baseQuantity: numeric(source.baseQuantity, 1),
      uom: text(source.uom ?? source.unit, 'adet'),
      effectiveFrom: text(source.effectiveFrom ?? source.validFrom),
      effectiveTo: text(source.effectiveTo ?? source.validTo),
      lines: rawLines.map(normalizeBomLine),
      sourceOrganization: text(source.sourceOrganization),
      changeReason: text(source.changeReason)
    };
  }

  function normalizeBomDefinitions(records = []) {
    return Array.isArray(records) ? records.map(normalizeBomDefinition) : [];
  }

  function isoDate(value) {
    const normalized = text(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
  }

  function isEffective(record = {}, asOfDate = '') {
    const date = isoDate(asOfDate);
    if (!date) return true;
    const from = isoDate(record.effectiveFrom ?? record.validFrom);
    const to = isoDate(record.effectiveTo ?? record.validTo);
    return (!from || from <= date) && (!to || date <= to);
  }

  function validateItemMasterChange(previousRecord = {}, nextRecord = {}, context = {}) {
    const previous = normalizeItemMaster(previousRecord);
    const next = normalizeItemMaster(nextRecord);
    const issues = [];
    const detail = { entityType: 'item-master', itemMasterId: next.id, previousItemMasterId: previous.id };
    if (previous.id !== next.id) issues.push(issue('ITEM_MASTER_ID_IMMUTABLE', 'Kalıcı malzeme kartı kimliği değiştirilemez.', next.id, 'error', detail));
    if (!context.allowInternalCodeChange && previous.internalCode && previous.internalCode !== next.internalCode) issues.push(issue('INTERNAL_CODE_IMMUTABLE', 'İç stok kodu kart oluşturulduktan sonra değiştirilemez; gerekiyorsa yeni kart açılmalıdır.', next.id, 'error', detail));
    const controlledFields = ['description', 'name', 'itemType', 'uom', 'procurementType', 'drawingNo', 'drawingRevision'];
    const controlledChange = controlledFields.some(field => text(previous[field]) !== text(next[field]));
    if (previous.validationStatus === 'APPROVED' && controlledChange && previous.revision === next.revision) issues.push(issue('ITEM_MASTER_REVISION_BUMP_REQUIRED', 'Onaylı karttaki kontrollü değişiklik için yeni revizyon zorunludur.', next.id, 'error', { ...detail, changedFields: controlledFields.filter(field => text(previous[field]) !== text(next[field])) }));
    return issues;
  }

  function validateItemMasters(records = [], context = {}) {
    const masters = normalizeItemMasters(records);
    const issues = [];
    const ids = new Map();
    const codes = new Map();
    masters.forEach(master => {
      const detail = { entityType: 'item-master', itemMasterId: master.id };
      if (ids.has(master.id)) issues.push(issue('DUPLICATE_ITEM_MASTER_ID', `Malzeme kartı kimliği yineleniyor: ${master.id}`, master.id, 'error', detail));
      else ids.set(master.id, master);
      if (!master.internalCode) issues.push(issue('MISSING_INTERNAL_CODE', 'Kalıcı iç stok kodu zorunludur.', master.id, 'error', detail));
      else {
        const key = master.internalCode.toLocaleUpperCase('tr-TR');
        if (codes.has(key)) issues.push(issue('DUPLICATE_INTERNAL_CODE', `İç stok kodu yineleniyor: ${master.internalCode}`, master.id, 'error', { ...detail, conflictingItemMasterId: codes.get(key) }));
        else codes.set(key, master.id);
      }
      if (!master.description && !master.name) issues.push(issue('MISSING_ITEM_DESCRIPTION', 'Malzeme/ürün kartı açıklaması zorunludur.', master.id, 'error', detail));
      if (!ITEM_MASTER_TYPES.has(master.itemType)) issues.push(issue('INVALID_ITEM_TYPE', 'Malzeme/ürün kartı tipi geçersizdir.', master.id, 'error', detail));
      if (!master.revision) issues.push(issue('MISSING_ITEM_REVISION', 'Malzeme kartı revizyonu zorunludur.', master.id, 'error', detail));
      if (!master.uom) issues.push(issue('MISSING_ITEM_UOM', 'Temel ölçü birimi zorunludur.', master.id, 'error', detail));
      if (!PROCUREMENT_TYPES.has(master.procurementType)) issues.push(issue('INVALID_PROCUREMENT_TYPE', 'Üret/satın al göstergesi geçersizdir.', master.id, 'error', detail));
      if (!MASTER_VALIDATION_STATUSES.has(master.validationStatus)) issues.push(issue('INVALID_MASTER_VALIDATION_STATUS', 'Kart doğrulama durumu geçersizdir.', master.id, 'error', detail));
      if (context.requireApproved && master.validationStatus !== 'APPROVED') issues.push(issue('ITEM_MASTER_NOT_APPROVED', 'BOM yayını için malzeme kartı onaylı olmalıdır.', master.id, 'error', detail));
    });
    return issues;
  }

  function selectedBomFor(headerItemMasterId, definitions, options = {}) {
    const candidates = definitions.filter(definition =>
      definition.headerItemMasterId === headerItemMasterId &&
      definition.status !== 'OBSOLETE' &&
      definition.status !== 'REJECTED' &&
      isEffective(definition, options.asOfDate)
    );
    const selections = options.bomSelections || options.bomIdsByHeader || {};
    if (Object.prototype.hasOwnProperty.call(selections, headerItemMasterId)) {
      const explicitId = text(selections[headerItemMasterId]);
      if (!explicitId) return null;
      return candidates.find(definition => definition.id === explicitId || definition.bomId === explicitId) || null;
    }
    if (options.bomId && (!options.rootItemMasterId || options.rootItemMasterId === headerItemMasterId)) {
      return candidates.find(definition => definition.id === options.bomId || definition.bomId === options.bomId) || null;
    }
    const selectedAlternative = options.alternatives?.[headerItemMasterId];
    const narrowed = selectedAlternative ? candidates.filter(definition => definition.alternative === selectedAlternative) : candidates;
    if (selectedAlternative && !narrowed.length) return null;
    return [...narrowed].sort((left, right) =>
      String(right.revision).localeCompare(String(left.revision), 'tr', { numeric: true }) ||
      String(left.alternative).localeCompare(String(right.alternative), 'tr', { numeric: true })
    )[0] || null;
  }

  function validateBomDefinitions(records = [], itemMasters = [], context = {}) {
    const definitions = normalizeBomDefinitions(records);
    const masters = normalizeItemMasters(itemMasters);
    const masterById = new Map(masters.map(master => [master.id, master]));
    const operationCodes = new Set((context.operationCodes || []).map(entry => text(typeof entry === 'object' ? entry.code ?? entry.operationCode : entry)).filter(Boolean));
    const issues = [];
    const definitionKeys = new Map();

    definitions.forEach(definition => {
      const detail = { entityType: 'bom-definition', bomId: definition.id, headerItemMasterId: definition.headerItemMasterId };
      if (!definition.headerItemMasterId) issues.push(issue('MISSING_BOM_HEADER_MASTER', 'BOM üst malzeme kartı zorunludur.', definition.id, 'error', detail));
      else if (!masterById.has(definition.headerItemMasterId)) issues.push(issue('UNKNOWN_BOM_HEADER_MASTER', 'BOM üst malzeme kartı, kart kütüphanesinde bulunamadı.', definition.id, 'error', detail));
      if (context.requireApproved && definition.status !== 'APPROVED') issues.push(issue('BOM_DEFINITION_NOT_APPROVED', 'BOM yayını için mamul ağacı tanımının onaylı olması gerekir.', definition.id, 'error', detail));
      const key = `${definition.headerItemMasterId}\u0000${definition.revision}\u0000${definition.alternative}`;
      if (definitionKeys.has(key)) issues.push(issue('DUPLICATE_BOM_DEFINITION', 'Aynı malzeme, revizyon ve alternatif için birden fazla BOM tanımlandı.', definition.id, 'error', { ...detail, conflictingBomId: definitionKeys.get(key) }));
      else definitionKeys.set(key, definition.id);
      if (!Number.isFinite(definition.baseQuantity) || definition.baseQuantity <= 0) issues.push(issue('INVALID_BOM_BASE_QUANTITY', 'BOM temel miktarı sıfırdan büyük olmalıdır.', definition.id, 'error', detail));
      if (isoDate(definition.effectiveFrom) && isoDate(definition.effectiveTo) && definition.effectiveFrom > definition.effectiveTo) issues.push(issue('INVALID_BOM_EFFECTIVITY', 'BOM geçerlilik başlangıcı bitişten sonra olamaz.', definition.id, 'error', detail));

      const lineIds = new Map();
      const positions = new Map();
      definition.lines.forEach(line => {
        const lineDetail = { ...detail, entityType: 'bom-line', lineId: line.id, itemMasterId: line.itemMasterId };
        if (lineIds.has(line.id)) issues.push(issue('DUPLICATE_BOM_LINE_ID', `BOM satır kimliği yineleniyor: ${line.id}`, line.id, 'error', lineDetail));
        else lineIds.set(line.id, line);
        if (positions.has(line.position)) issues.push(issue('DUPLICATE_BOM_LINE_POSITION', `BOM pozisyonu yineleniyor: ${line.position}`, line.id, 'error', { ...lineDetail, conflictingLineId: positions.get(line.position) }));
        else positions.set(line.position, line.id);
        if (!line.itemMasterId) issues.push(issue('MISSING_BOM_LINE_MASTER', 'BOM satırı mevcut bir malzeme kartına bağlanmalıdır.', line.id, 'error', lineDetail));
        else if (!masterById.has(line.itemMasterId)) issues.push(issue('UNKNOWN_BOM_LINE_MASTER', 'BOM satırındaki malzeme kartı bulunamadı.', line.id, 'error', lineDetail));
        if (line.itemMasterId && line.itemMasterId === definition.headerItemMasterId) issues.push(issue('BOM_SELF_REFERENCE', 'Bir malzemenin BOM’u kendisini doğrudan içeremez.', line.id, 'error', lineDetail));
        if (!Number.isFinite(line.quantity) || line.quantity <= 0) issues.push(issue('INVALID_BOM_LINE_QUANTITY', 'BOM satır miktarı sıfırdan büyük olmalıdır.', line.id, 'error', lineDetail));
        if (isoDate(line.effectiveFrom) && isoDate(line.effectiveTo) && line.effectiveFrom > line.effectiveTo) issues.push(issue('INVALID_BOM_LINE_EFFECTIVITY', 'BOM satırı geçerlilik başlangıcı bitişten sonra olamaz.', line.id, 'error', lineDetail));
        if (line.assemblyOperationCode && operationCodes.size && !operationCodes.has(line.assemblyOperationCode)) issues.push(issue('UNKNOWN_ASSEMBLY_OPERATION_CODE', `BOM montaj operasyon kodu kütüphanede yok: ${line.assemblyOperationCode}`, line.id, 'error', lineDetail));
        const referenced = masterById.get(line.itemMasterId);
        if (referenced && line.referencedRevision && referenced.revision && line.referencedRevision !== referenced.revision) issues.push(issue('BOM_LINE_REVISION_MISMATCH', 'BOM satırındaki referans revizyonu güncel malzeme kartı revizyonuyla uyuşmuyor.', line.id, context.strictRevision ? 'error' : 'warning', lineDetail));
      });
      const alternativeGroups = new Map();
      definition.lines.forEach(line => {
        if (!line.alternativeGroupId || !isEffective(line, context.asOfDate)) return;
        const group = alternativeGroups.get(line.alternativeGroupId) || [];
        group.push(line); alternativeGroups.set(line.alternativeGroupId, group);
      });
      alternativeGroups.forEach((lines, groupId) => {
        const active = lines.filter(line => line.alternativeSelected !== false);
        const detailForGroup = { ...detail, entityType: 'bom-alternative-group', alternativeGroupId: groupId, lineIds: lines.map(line => line.id), activeLineIds: active.map(line => line.id) };
        if (!active.length) issues.push(issue('ALTERNATIVE_GROUP_NO_ACTIVE_CHOICE', `Alternatif grupta tam bir aktif seçim bulunmalıdır: ${groupId}`, definition.id, 'error', detailForGroup));
        if (active.length > 1) issues.push(issue('ALTERNATIVE_GROUP_MULTIPLE_ACTIVE_CHOICES', `Alternatif grupta yalnız bir aktif seçim olabilir: ${groupId}`, definition.id, 'error', detailForGroup));
      });
    });

    const headers = new Set(definitions.map(definition => definition.headerItemMasterId));
    const visit = (headerId, ancestors = []) => {
      const definition = selectedBomFor(headerId, definitions, context);
      if (!definition) return;
      for (const line of definition.lines.filter(candidate => candidate.alternativeSelected !== false && isEffective(candidate, context.asOfDate))) {
        if (!headers.has(line.itemMasterId)) continue;
        if (ancestors.includes(line.itemMasterId) || line.itemMasterId === headerId) {
          issues.push(issue('MATERIAL_BOM_CYCLE', `Malzeme kartları arasında döngüsel BOM algılandı: ${[...ancestors, headerId, line.itemMasterId].join(' > ')}`, line.id, 'error', { entityType: 'bom-line', bomId: definition.id, itemMasterId: line.itemMasterId }));
          continue;
        }
        visit(line.itemMasterId, [...ancestors, headerId]);
      }
    };
    [...headers].forEach(headerId => visit(headerId));
    return issues;
  }

  function explodeBom(rootItemMasterId, itemMasters = [], bomDefinitions = [], options = {}) {
    const masters = normalizeItemMasters(itemMasters);
    const definitions = normalizeBomDefinitions(bomDefinitions);
    const masterById = new Map(masters.map(master => [master.id, master]));
    const rows = [];
    const maximumDepth = Math.max(1, numeric(options.maximumDepth, 50));

    const selectionOptions = { ...options, rootItemMasterId };
    const visit = (headerItemMasterId, parentOccurrenceId, level, cumulativeQuantity, ancestors) => {
      if (level > maximumDepth) return;
      const definition = selectedBomFor(headerItemMasterId, definitions, selectionOptions);
      if (!definition) return;
      const baseQuantity = definition.baseQuantity > 0 ? definition.baseQuantity : 1;
      definition.lines
        .filter(line => line.alternativeSelected !== false && isEffective(line, options.asOfDate))
        .sort(positionCompare)
        .forEach(line => {
          const master = masterById.get(line.itemMasterId);
          const occurrenceId = text(line.legacyComponentId, `${parentOccurrenceId || rootItemMasterId}::${line.id}`);
          const quantity = cumulativeQuantity * line.quantity / baseQuantity;
          const cycle = ancestors.has(line.itemMasterId);
          const row = {
            ...line,
            occurrenceId,
            parentOccurrenceId: parentOccurrenceId || ROOT_ID,
            headerItemMasterId,
            bomDefinitionId: definition.id,
            bomNo: definition.bomNo,
            bomRevision: definition.revision,
            bomAlternative: definition.alternative,
            itemMaster: master || null,
            internalCode: master?.internalCode || '',
            oemNo: master?.oemNo || '',
            name: master?.name || master?.description || line.itemMasterId,
            description: master?.description || master?.name || '',
            itemType: master?.itemType || '',
            procurementType: master?.procurementType || '',
            referencedRevision: line.referencedRevision || master?.revision || '',
            level,
            cumulativeQuantity: quantity,
            pathItemMasterIds: [...ancestors, line.itemMasterId],
            cycle,
            leaf: !selectedBomFor(line.itemMasterId, definitions, selectionOptions)
          };
          rows.push(row);
          if (!cycle) visit(line.itemMasterId, occurrenceId, level + 1, quantity, new Set([...ancestors, line.itemMasterId]));
        });
    };

    visit(rootItemMasterId, '', 1, numeric(options.rootQuantity, 1), new Set([rootItemMasterId]));
    return rows;
  }

  function deterministicMasterId(component = {}) {
    return text(component.itemMasterId ?? component.partMasterId ?? component.materialMasterId ?? component.catalogItemId, `MASTER-${text(component.id, uid()).replace(/[^A-Za-z0-9_-]/g, '_')}`);
  }

  function migrateLegacyComponents(records = [], options = {}) {
    const legacyComponents = normalizeComponents(records);
    const finishedGoodSource = options.finishedGood && typeof options.finishedGood === 'object' ? options.finishedGood : {};
    const rootItemMasterId = text(options.rootItemMasterId ?? finishedGoodSource.id ?? finishedGoodSource.itemMasterId, 'MASTER-FINISHED-GOOD');
    const rootMaster = normalizeItemMaster({
      ...finishedGoodSource,
      id: rootItemMasterId,
      internalCode: text(finishedGoodSource.internalCode ?? finishedGoodSource.itemNo ?? options.rootItemNo, 'LEGACY-FINISHED-GOOD'),
      oemNo: text(finishedGoodSource.oemNo ?? options.oemNo),
      name: text(finishedGoodSource.name ?? finishedGoodSource.partName ?? options.rootName, 'Ana mamul'),
      description: text(finishedGoodSource.description ?? finishedGoodSource.name ?? options.rootName, 'Ana mamul'),
      itemType: 'FINISHED_GOOD',
      procurementType: text(finishedGoodSource.procurementType, 'MAKE'),
      validationStatus: finishedGoodSource.validationStatus ?? finishedGoodSource.status ?? 'DRAFT'
    });
    const masterIdByComponentId = new Map();
    const mastersById = new Map([[rootMaster.id, rootMaster]]);

    legacyComponents.forEach(component => {
      const masterId = deterministicMasterId(component);
      masterIdByComponentId.set(component.id, masterId);
      if (!mastersById.has(masterId)) mastersById.set(masterId, normalizeItemMaster({
        ...component,
        id: masterId,
        internalCode: component.itemNo,
        oemNo: component.oemNo ?? component.customerPartNo,
        itemType: component.componentType,
        procurementType: component.makeBuy,
        validationStatus: component.verificationStatus ?? component.status
      }));
    });

    const parentIds = new Set([ROOT_ID, ...legacyComponents.map(component => component.parentId)]);
    const bomDefinitions = [];
    parentIds.forEach(parentComponentId => {
      const children = childRecords(legacyComponents, parentComponentId);
      if (!children.length) return;
      const headerItemMasterId = parentComponentId === ROOT_ID ? rootMaster.id : masterIdByComponentId.get(parentComponentId);
      if (!headerItemMasterId) return;
      const headerMaster = mastersById.get(headerItemMasterId);
      const revision = text(headerMaster?.revision, 'A');
      bomDefinitions.push(normalizeBomDefinition({
        id: `BOM-${headerItemMasterId}-${revision}`.replace(/[^A-Za-z0-9_-]/g, '_'),
        bomNo: `BOM-${headerMaster?.internalCode || headerItemMasterId}`,
        headerItemMasterId,
        revision,
        alternative: '01',
        status: headerMaster?.validationStatus || 'DRAFT',
        baseQuantity: 1,
        uom: headerMaster?.uom || 'adet',
        sourceParentComponentId: parentComponentId,
        lines: children.map(component => ({
          id: `LINE-${component.id}`,
          legacyComponentId: component.id,
          position: component.position,
          itemMasterId: masterIdByComponentId.get(component.id),
          quantity: component.quantity,
          usageQuantity: component.usageQuantity,
          uom: component.uom,
          referencedRevision: component.itemRevision || component.revision,
          effectiveFrom: component.effectiveFrom,
          effectiveTo: component.effectiveTo,
          alternativeGroupId: component.alternativeGroupId,
          alternativeSelected: component.alternativeSelected,
          assemblyOperationCode: component.operationCode,
          notes: component.notes
        }))
      }));
    });

    return {
      schemaVersion: ENGINEERING_SCHEMA_VERSION,
      architecture: 'ITEM_MASTER_THEN_BOM',
      rootItemMasterId,
      itemMasters: [...mastersById.values()],
      bomDefinitions,
      legacyComponents,
      migration: {
        sourceModel: 'flat-adjacency-list',
        sourceRecordCount: legacyComponents.length,
        preservesLegacySnapshot: true
      }
    };
  }

  function toLegacyComponents(rootItemMasterId, itemMasters = [], bomDefinitions = [], options = {}) {
    return explodeBom(rootItemMasterId, itemMasters, bomDefinitions, options).map(row => normalizeComponent({
      id: row.occurrenceId,
      parentId: row.parentOccurrenceId,
      position: row.position,
      itemMasterId: row.itemMasterId,
      partMasterId: row.itemMasterId,
      itemNo: row.internalCode,
      oemNo: row.oemNo,
      name: row.name,
      description: row.description,
      componentType: row.itemMaster?.componentType || row.itemType,
      quantity: row.quantity,
      usageQuantity: row.usageQuantity,
      uom: row.uom || row.itemMaster?.uom,
      makeBuy: row.itemMaster?.makeBuy,
      itemRevision: row.referencedRevision,
      revision: row.referencedRevision,
      drawingNo: row.itemMaster?.drawingNo,
      drawingRevision: row.itemMaster?.drawingRevision,
      status: row.itemMaster?.status,
      verificationStatus: row.itemMaster?.validationStatus,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      alternativeGroupId: row.alternativeGroupId,
      alternativeSelected: row.alternativeSelected,
      operationCode: row.assemblyOperationCode,
      assemblyOperationCode: row.assemblyOperationCode,
      sourceBomDefinitionId: row.bomDefinitionId,
      sourceBomNo: row.bomNo,
      sourceBomRevision: row.bomRevision,
      sourceBomAlternative: row.bomAlternative,
      catalogItemId: row.itemMaster?.catalogItemId,
      catalogRevision: row.itemMaster?.catalogRevision,
      reuseMode: row.itemMaster?.reuseMode,
      reusable: row.itemMaster?.reusable,
      legacyBomLineId: row.id
    }));
  }

  function validateEngineeringUniverse(universe = {}, context = {}) {
    const itemMasters = universe.itemMasters || [];
    const bomDefinitions = universe.bomDefinitions || universe.boms || [];
    const issues = [
      ...validateItemMasters(itemMasters, context),
      ...validateBomDefinitions(bomDefinitions, itemMasters, context)
    ];
    return summarizeValidation(issues);
  }

  Object.defineProperty(globalScope, 'TyanaBom', {
    configurable: false,
    enumerable: true,
    writable: false,
    value: Object.freeze({
      ROOT_ID,
      ENGINEERING_SCHEMA_VERSION,
      normalizeComponent,
      normalizeComponents,
      tree,
      flatten,
      path,
      descendants,
      subtree,
      wouldCreateCycle,
      validate,
      summarizeValidation,
      reorder,
      nextPosition,
      isContainerType: value => CONTAINER_TYPES.has(value),
      canonicalItemType,
      canonicalProcurementType,
      canonicalValidationStatus,
      normalizeItemMaster,
      normalizeItemMasters,
      normalizeBomLine,
      normalizeBomDefinition,
      normalizeBomDefinitions,
      validateItemMasters,
      validateItemMasterChange,
      validateBomDefinitions,
      validateEngineeringUniverse,
      isEffective,
      explodeBom,
      migrateLegacyComponents,
      toLegacyComponents,
      itemMasterTypes: Object.freeze([...ITEM_MASTER_TYPES]),
      procurementTypes: Object.freeze([...PROCUREMENT_TYPES]),
      masterValidationStatuses: Object.freeze([...MASTER_VALIDATION_STATUSES])
    })
  });
})(globalThis);
