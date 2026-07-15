const assets = __ASSETS__;
const processSeed = __PROCESS_SEED__;

const schemaSql = `CREATE TABLE IF NOT EXISTS processes (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  family TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  input_material TEXT NOT NULL DEFAULT '',
  output_material TEXT NOT NULL DEFAULT '',
  equipment TEXT NOT NULL DEFAULT '',
  tooling TEXT NOT NULL DEFAULT '',
  special_process INTEGER NOT NULL DEFAULT 0,
  outsourced INTEGER NOT NULL DEFAULT 0,
  control_method TEXT NOT NULL DEFAULT '',
  characteristics TEXT NOT NULL DEFAULT '[]',
  risk_template TEXT NOT NULL DEFAULT '[]',
  reaction_plan TEXT NOT NULL DEFAULT '',
  work_instruction TEXT NOT NULL DEFAULT '',
  cycle_time_sec REAL NOT NULL DEFAULT 0,
  setup_time_min REAL NOT NULL DEFAULT 0,
  owner TEXT NOT NULL DEFAULT 'Kalite Mühendisliği',
  revision TEXT NOT NULL DEFAULT 'A',
  status TEXT NOT NULL DEFAULT 'active',
  approval_status TEXT NOT NULL DEFAULT 'draft',
  document_ref TEXT NOT NULL DEFAULT '',
  pfmea_function TEXT NOT NULL DEFAULT '',
  process_standard TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

const projectSchemaSql = `CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  project_code TEXT NOT NULL,
  part_number TEXT NOT NULL,
  part_name TEXT NOT NULL,
  product_group TEXT NOT NULL,
  revision TEXT NOT NULL DEFAULT 'A',
  phase TEXT NOT NULL DEFAULT 'Prototip',
  status TEXT NOT NULL DEFAULT 'Taslak',
  version INTEGER NOT NULL DEFAULT 1,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

const auditSchemaSql = `CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
)`;

const userSchemaSql = `CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  status TEXT NOT NULL DEFAULT 'active',
  plant TEXT NOT NULL DEFAULT 'TYANA OTOMOTİV',
  department TEXT NOT NULL DEFAULT 'Kalite',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (role IN ('admin', 'quality_manager', 'quality_engineer', 'process_engineer', 'approver', 'operator', 'viewer')),
  CHECK (status IN ('active', 'inactive', 'invited')),
  CHECK (length(email) BETWEEN 3 AND 254),
  CHECK (length(display_name) BETWEEN 2 AND 100),
  CHECK (length(plant) BETWEEN 1 AND 120),
  CHECK (length(department) BETWEEN 1 AND 120),
  CHECK (version >= 1)
)`;

const processColumns = [
  'id', 'code', 'name', 'family', 'category', 'description', 'input_material',
  'output_material', 'equipment', 'tooling', 'special_process', 'outsourced',
  'control_method', 'characteristics', 'risk_template', 'reaction_plan',
  'work_instruction', 'cycle_time_sec', 'setup_time_min', 'owner', 'revision',
  'status', 'approval_status', 'document_ref', 'pfmea_function', 'process_standard',
  'created_at', 'updated_at'
];

const userColumns = [
  'id', 'email', 'display_name', 'role', 'status', 'plant', 'department',
  'version', 'created_at', 'updated_at'
];

const userRoles = new Set(['admin', 'quality_manager', 'quality_engineer', 'process_engineer', 'approver', 'operator', 'viewer']);
const userStatuses = new Set(['active', 'inactive', 'invited']);
const defaultUser = {
  id: 'user-eren',
  email: 'eren@tyana.local',
  displayName: 'Eren',
  role: 'admin',
  status: 'active',
  plant: 'TYANA OTOMOTİV',
  department: 'Kalite'
};

function toDb(process, now = new Date().toISOString()) {
  return {
    id: process.id || crypto.randomUUID(), code: String(process.code || '').trim().toUpperCase(),
    name: String(process.name || '').trim(), family: String(process.family || '').trim(),
    category: String(process.category || 'Üretim').trim(), description: String(process.desc ?? process.description ?? '').trim(),
    input_material: String(process.inputMaterial || '').trim(), output_material: String(process.outputMaterial || '').trim(),
    equipment: String(process.equipment || '').trim(), tooling: String(process.tooling || '').trim(),
    special_process: process.special ? 1 : 0, outsourced: process.outsource ? 1 : 0,
    control_method: String(process.controlMethod || '').trim(),
    characteristics: JSON.stringify(Array.isArray(process.characteristics) ? process.characteristics : []),
    risk_template: JSON.stringify(Array.isArray(process.riskTemplate) ? process.riskTemplate : []),
    reaction_plan: String(process.reactionPlan || '').trim(), work_instruction: String(process.workInstruction || '').trim(),
    cycle_time_sec: Number(process.cycleTimeSec) || 0, setup_time_min: Number(process.setupTimeMin) || 0,
    owner: String(process.owner || 'Kalite Mühendisliği').trim(), revision: String(process.revision || 'A').trim().toUpperCase(),
    status: String(process.status || 'active'), approval_status: String(process.approvalStatus || 'draft'),
    document_ref: String(process.documentRef || '').trim(), pfmea_function: String(process.pfmeaFunction || '').trim(),
    process_standard: String(process.processStandard || '').trim(),
    created_at: process.createdAt || now, updated_at: now
  };
}

function fromDb(row) {
  const parse = value => { try { return JSON.parse(value || '[]'); } catch { return []; } };
  return {
    id: row.id, code: row.code, name: row.name, family: row.family, category: row.category,
    desc: row.description, inputMaterial: row.input_material, outputMaterial: row.output_material,
    equipment: row.equipment, tooling: row.tooling, special: Boolean(row.special_process),
    outsource: Boolean(row.outsourced), controlMethod: row.control_method,
    characteristics: parse(row.characteristics), riskTemplate: parse(row.risk_template),
    reactionPlan: row.reaction_plan, workInstruction: row.work_instruction,
    cycleTimeSec: row.cycle_time_sec, setupTimeMin: row.setup_time_min, owner: row.owner,
    revision: row.revision, status: row.status, approvalStatus: row.approval_status,
    documentRef: row.document_ref, pfmeaFunction: row.pfmea_function,
    processStandard: row.process_standard, createdAt: row.created_at, updatedAt: row.updated_at
  };
}

function toUserDb(user, now = new Date().toISOString()) {
  return {
    id: user.id || crypto.randomUUID(),
    email: String(user.email || '').trim().toLowerCase(),
    display_name: String(user.displayName || '').trim(),
    role: String(user.role || 'viewer').trim(),
    status: String(user.status || 'active').trim(),
    plant: String(user.plant || 'TYANA OTOMOTİV').trim(),
    department: String(user.department || 'Kalite').trim(),
    version: Number(user.version) || 1,
    created_at: user.createdAt || now,
    updated_at: now
  };
}

function fromUserDb(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    plant: row.plant,
    department: row.department,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function ensureDatabase(env) {
  if (!env.DB) throw new Error('D1 binding DB is unavailable');
  await env.DB.batch([
    env.DB.prepare(schemaSql),
    env.DB.prepare(projectSchemaSql),
    env.DB.prepare(auditSchemaSql),
    env.DB.prepare(userSchemaSql),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS processes_family_idx ON processes (family)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS processes_status_idx ON processes (status)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS projects_updated_idx ON projects (updated_at DESC)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_events (entity_type, entity_id, created_at DESC)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS users_status_idx ON users (status)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS users_role_idx ON users (role)')
  ]);
  const insertProcessSql = `INSERT OR IGNORE INTO processes (${processColumns.join(', ')}) VALUES (${processColumns.map(() => '?').join(', ')})`;
  await env.DB.batch(processSeed.map(process => {
    const record = toDb(process);
    return env.DB.prepare(insertProcessSql).bind(...processColumns.map(column => record[column]));
  }));
  const record = toUserDb(defaultUser);
  const insertUserSql = `INSERT OR IGNORE INTO users (${userColumns.join(', ')}) VALUES (${userColumns.map(() => '?').join(', ')})`;
  await env.DB.prepare(insertUserSql).bind(...userColumns.map(column => record[column])).run();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' } });
}

function validateProcess(process) {
  const missing = ['code', 'name', 'family', 'category', 'equipment', 'controlMethod'].filter(field => !String(process[field] || '').trim());
  if (missing.length) return `Zorunlu alanlar eksik: ${missing.join(', ')}`;
  if (Number(process.cycleTimeSec) < 0 || Number(process.setupTimeMin) < 0) return 'Süre değerleri negatif olamaz.';
  return null;
}

function cleanHeader(value, maxLength = 254) {
  const text = String(value || '').trim();
  return text && text.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(text) ? text : '';
}

function identityFrom(request) {
  const oaiEmail = cleanHeader(request.headers.get('oai-authenticated-user-email'));
  const cfEmail = cleanHeader(request.headers.get('cf-access-authenticated-user-email'));
  const email = (oaiEmail || cfEmail).toLowerCase();
  const source = oaiEmail ? 'openai-workspace' : cfEmail ? 'cloudflare-access' : 'site-default';
  let displayName = '';
  if (request.headers.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
    const encodedName = cleanHeader(request.headers.get('oai-authenticated-user-full-name'), 500);
    if (encodedName) {
      try { displayName = cleanHeader(decodeURIComponent(encodedName), 100); } catch {}
    }
  }
  return {
    actor: email || 'Eren',
    email,
    displayName: displayName || (email ? email.split('@')[0] : 'Eren'),
    source
  };
}

async function authorizeRequest(env, request, allowedRoles = null) {
  await ensureDatabase(env);
  const identity = identityFrom(request);
  if (!identity.email || identity.source === 'site-default') return json({ error: 'Doğrulanmış TYANA çalışma alanı oturumu gerekli.' }, 401);
  let row = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(identity.email).first();
  let bootstrapProfile = false;
  if (!row) {
    const seeded = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(defaultUser.id).first();
    if (seeded && seeded.email === defaultUser.email && seeded.role === 'admin' && seeded.status === 'active') { row = seeded; bootstrapProfile = true; }
  }
  if (!row) return json({ error: 'Çalışma alanı kimliğiniz TYANA kullanıcı profiline bağlı değil.' }, 403);
  if (row.status !== 'active') return json({ error: 'Kullanıcı profili aktif değil.' }, 403);
  if (allowedRoles && !allowedRoles.includes(row.role)) return json({ error: 'Bu işlem için kullanıcı rolünüz yetkili değil.' }, 403);
  return { identity, user: fromUserDb(row), bootstrapProfile };
}

async function writeAudit(env, request, entityType, entityId, action, detail = {}) {
  const identity = identityFrom(request);
  const requestId = cleanHeader(request.headers.get('cf-ray') || request.headers.get('x-request-id'), 100);
  await env.DB.prepare('INSERT INTO audit_events (id, entity_type, entity_id, action, actor, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), entityType, entityId, action, identity.actor, JSON.stringify({ ...detail, actorEmail: identity.email, actorName: identity.displayName, actorSource: identity.source, ...(requestId ? { requestId } : {}) }), new Date().toISOString()).run();
}

function validateUser(user) {
  if (!user || typeof user !== 'object' || Array.isArray(user)) return 'Kullanıcı kaydı geçersiz.';
  const required = ['email', 'displayName', 'role', 'status', 'plant', 'department'];
  const missing = required.filter(field => !String(user[field] || '').trim());
  if (missing.length) return `Zorunlu kullanıcı alanları eksik: ${missing.join(', ')}`;
  const email = String(user.email).trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Geçerli bir e-posta adresi girin.';
  const limits = { displayName: 100, plant: 120, department: 120 };
  for (const [field, limit] of Object.entries(limits)) {
    const value = String(user[field]).trim();
    if (value.length < (field === 'displayName' ? 2 : 1) || value.length > limit || /[\u0000-\u001f\u007f]/.test(value)) return `${field} alanı geçersiz.`;
  }
  if (!userRoles.has(String(user.role))) return 'Kullanıcı rolü desteklenmiyor.';
  if (!userStatuses.has(String(user.status))) return 'Kullanıcı durumu desteklenmiyor.';
  return null;
}

async function removingLastActiveAdmin(env, current, nextRole, nextStatus) {
  if (current.role !== 'admin' || current.status !== 'active' || (nextRole === 'admin' && nextStatus === 'active')) return false;
  const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND status = 'active'").first();
  return Number(count?.total || 0) <= 1;
}

function fromProjectDb(row) {
  let payload = {};
  try { payload = JSON.parse(row.payload || '{}'); } catch {}
  return { id: row.id, projectCode: row.project_code, partNumber: row.part_number, partName: row.part_name, productGroup: row.product_group, revision: row.revision, phase: row.phase, status: row.status, version: row.version, payload, createdAt: row.created_at, updatedAt: row.updated_at };
}

function validateProject(project) {
  const missing = ['projectCode', 'partNumber', 'partName', 'productGroup', 'revision', 'phase'].filter(field => !String(project[field] || '').trim());
  if (missing.length) return `Zorunlu proje alanları eksik: ${missing.join(', ')}`;
  if (!project.payload || typeof project.payload !== 'object') return 'Proje veri anlık görüntüsü geçersiz.';
  if (JSON.stringify(project.payload).length > 750000) return 'Proje kaydı izin verilen boyutu aşıyor.';
  return null;
}

async function readObjectBody(request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'JSON nesnesi gerekli.' };
    return { body };
  } catch {
    return { error: 'Geçerli bir JSON gövdesi gerekli.' };
  }
}

async function handleUsers(request, env, url) {
  await ensureDatabase(env);
  const id = decodeURIComponent(url.pathname.replace('/api/users', '').replace(/^\//, ''));
  if (request.method === 'GET' && id === 'me') {
    const access = await authorizeRequest(env, request);
    if (access instanceof Response) return access;
    return json({ user: access.user, identity: access.identity, bootstrapProfile: access.bootstrapProfile });
  }
  const access = await authorizeRequest(env, request, ['admin', 'quality_manager']);
  if (access instanceof Response) return access;
  if (request.method === 'GET' && !id) {
    const result = await env.DB.prepare('SELECT * FROM users ORDER BY status ASC, display_name ASC LIMIT 200').all();
    return json({ users: result.results.map(fromUserDb) });
  }
  if (request.method === 'GET' && id) {
    const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
    return row ? json({ user: fromUserDb(row) }) : json({ error: 'Kullanıcı bulunamadı.' }, 404);
  }
  if (request.method === 'POST' && !id) {
    const parsed = await readObjectBody(request);
    if (parsed.error) return json({ error: parsed.error }, 400);
    const error = validateUser(parsed.body);
    if (error) return json({ error }, 400);
    const record = toUserDb({ ...parsed.body, id: crypto.randomUUID(), version: 1 });
    const sql = `INSERT INTO users (${userColumns.join(', ')}) VALUES (${userColumns.map(() => '?').join(', ')})`;
    try {
      await env.DB.prepare(sql).bind(...userColumns.map(column => record[column])).run();
      await writeAudit(env, request, 'user', record.id, 'created', { email: record.email, role: record.role, status: record.status });
      return json({ user: fromUserDb(record) }, 201);
    } catch (error) {
      return json({ error: String(error).includes('UNIQUE') ? 'Bu e-posta adresi zaten kayıtlı.' : 'Kullanıcı kaydı oluşturulamadı.' }, 409);
    }
  }
  if (request.method === 'PUT' && id) {
    const parsed = await readObjectBody(request);
    if (parsed.error) return json({ error: parsed.error }, 400);
    const current = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
    if (!current) return json({ error: 'Kullanıcı bulunamadı.' }, 404);
    if (!Number.isInteger(Number(parsed.body.version)) || Number(parsed.body.version) !== Number(current.version)) {
      return json({ error: `Kullanıcı kaydı başka bir oturumda değiştirildi. Güncel sürüm v${current.version}.`, currentVersion: current.version }, 409);
    }
    const merged = { ...fromUserDb(current), ...parsed.body, id, createdAt: current.created_at };
    const error = validateUser(merged);
    if (error) return json({ error }, 400);
    if (await removingLastActiveAdmin(env, current, merged.role, merged.status)) return json({ error: 'Son aktif yönetici pasife alınamaz veya yönetici rolünden çıkarılamaz.' }, 409);
    const nextVersion = Number(current.version) + 1;
    const record = toUserDb({ ...merged, version: nextVersion });
    const updateColumns = ['email', 'display_name', 'role', 'status', 'plant', 'department', 'version', 'updated_at'];
    const sql = `UPDATE users SET ${updateColumns.map(column => `${column} = ?`).join(', ')} WHERE id = ? AND version = ?`;
    try {
      const result = await env.DB.prepare(sql).bind(...updateColumns.map(column => record[column]), id, current.version).run();
      if (!result.meta?.changes) return json({ error: 'Eşzamanlı güncelleme algılandı; kullanıcı kaydını yeniden yükleyin.' }, 409);
      await writeAudit(env, request, 'user', id, 'updated', { fromVersion: current.version, toVersion: nextVersion, email: record.email, role: record.role, status: record.status });
      return json({ user: fromUserDb({ ...record, id, created_at: current.created_at }) });
    } catch (error) {
      return json({ error: String(error).includes('UNIQUE') ? 'Bu e-posta adresi başka bir kullanıcıda kayıtlı.' : 'Kullanıcı kaydı güncellenemedi.' }, 409);
    }
  }
  if (request.method === 'DELETE' && id) {
    const current = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
    if (!current) return json({ error: 'Kullanıcı bulunamadı.' }, 404);
    const expectedVersion = Number(url.searchParams.get('version'));
    if (!Number.isInteger(expectedVersion) || expectedVersion !== Number(current.version)) {
      return json({ error: `Kullanıcıyı pasife almak için güncel sürüm gerekli (v${current.version}).`, currentVersion: current.version }, 409);
    }
    if (await removingLastActiveAdmin(env, current, current.role, 'inactive')) return json({ error: 'Son aktif yönetici pasife alınamaz.' }, 409);
    const now = new Date().toISOString();
    const nextVersion = Number(current.version) + 1;
    const result = await env.DB.prepare("UPDATE users SET status = 'inactive', version = ?, updated_at = ? WHERE id = ? AND version = ?")
      .bind(nextVersion, now, id, current.version).run();
    if (!result.meta?.changes) return json({ error: 'Eşzamanlı güncelleme algılandı; kullanıcı kaydını yeniden yükleyin.' }, 409);
    await writeAudit(env, request, 'user', id, 'deactivated', { fromVersion: current.version, toVersion: nextVersion, email: current.email });
    const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
    return json({ user: fromUserDb(row) });
  }
  return json({ error: 'Desteklenmeyen kullanıcı işlemi.' }, 405);
}

async function handleProjects(request, env, url) {
  await ensureDatabase(env);
  const suffix = decodeURIComponent(url.pathname.replace('/api/projects', '').replace(/^\//, ''));
  if (request.method === 'GET' && suffix === 'latest') {
    const row = await env.DB.prepare('SELECT * FROM projects ORDER BY updated_at DESC LIMIT 1').first();
    return json({ project: row ? fromProjectDb(row) : null });
  }
  if (request.method === 'GET' && !suffix) {
    const result = await env.DB.prepare('SELECT id, project_code, part_number, part_name, product_group, revision, phase, status, version, created_at, updated_at FROM projects ORDER BY updated_at DESC LIMIT 100').all();
    return json({ projects: result.results.map(row => ({ id: row.id, projectCode: row.project_code, partNumber: row.part_number, partName: row.part_name, productGroup: row.product_group, revision: row.revision, phase: row.phase, status: row.status, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at })) });
  }
  if (request.method === 'GET' && suffix) {
    const row = await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(suffix).first();
    return row ? json({ project: fromProjectDb(row) }) : json({ error: 'Proje bulunamadı.' }, 404);
  }
  if (request.method === 'POST' && !suffix) {
    const body = await request.json();
    const error = validateProject(body); if (error) return json({ error }, 400);
    const now = new Date().toISOString(); const id = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO projects (id, project_code, part_number, part_name, product_group, revision, phase, status, version, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)')
      .bind(id, body.projectCode.trim(), body.partNumber.trim(), body.partName.trim(), body.productGroup.trim(), body.revision.trim(), body.phase.trim(), String(body.status || 'Taslak'), JSON.stringify({ ...body.payload, projectId: id }), now, now).run();
    await writeAudit(env, request, 'project', id, 'created', { revision: body.revision, snapshotSha256: body.payload.sha256 || '' });
    const row = await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first();
    return json({ project: fromProjectDb(row) }, 201);
  }
  if (request.method === 'PUT' && suffix) {
    const body = await request.json();
    const error = validateProject(body); if (error) return json({ error }, 400);
    const current = await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(suffix).first();
    if (!current) return json({ error: 'Proje bulunamadı.' }, 404);
    if (Number(body.version) !== Number(current.version)) return json({ error: `Kayıt başka bir oturumda değiştirildi. Güncel sürüm v${current.version}.`, currentVersion: current.version }, 409);
    const nextVersion = Number(current.version) + 1; const now = new Date().toISOString();
    const result = await env.DB.prepare('UPDATE projects SET project_code = ?, part_number = ?, part_name = ?, product_group = ?, revision = ?, phase = ?, status = ?, version = ?, payload = ?, updated_at = ? WHERE id = ? AND version = ?')
      .bind(body.projectCode.trim(), body.partNumber.trim(), body.partName.trim(), body.productGroup.trim(), body.revision.trim(), body.phase.trim(), String(body.status || 'Taslak'), nextVersion, JSON.stringify({ ...body.payload, projectId: suffix }), now, suffix, current.version).run();
    if (!result.meta?.changes) return json({ error: 'Eşzamanlı güncelleme algılandı; proje yeniden yüklenmeli.' }, 409);
    await writeAudit(env, request, 'project', suffix, 'updated', { fromVersion: current.version, toVersion: nextVersion, revision: body.revision, snapshotSha256: body.payload.sha256 || '' });
    const row = await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(suffix).first();
    return json({ project: fromProjectDb(row) });
  }
  return json({ error: 'Desteklenmeyen proje işlemi.' }, 405);
}

async function handleProcesses(request, env, url) {
  await ensureDatabase(env);
  const id = decodeURIComponent(url.pathname.replace('/api/processes', '').replace(/^\//, ''));
  if (request.method === 'GET' && !id) {
    const result = await env.DB.prepare('SELECT * FROM processes ORDER BY status ASC, family ASC, code ASC').all();
    return json({ processes: result.results.map(fromDb) });
  }
  if (request.method === 'POST' && !id) {
    const body = await request.json();
    const error = validateProcess(body);
    if (error) return json({ error }, 400);
    const record = toDb(body);
    const sql = `INSERT INTO processes (${processColumns.join(', ')}) VALUES (${processColumns.map(() => '?').join(', ')})`;
    try {
      await env.DB.prepare(sql).bind(...processColumns.map(column => record[column])).run();
      await writeAudit(env, request, 'process', record.id, 'created', { code: record.code, revision: record.revision });
      return json({ process: fromDb(record) }, 201);
    } catch (error) {
      return json({ error: String(error).includes('UNIQUE') ? 'Proses kodu veya adı zaten kayıtlı.' : 'Kayıt oluşturulamadı.' }, 409);
    }
  }
  if (request.method === 'PUT' && id) {
    const current = await env.DB.prepare('SELECT * FROM processes WHERE id = ?').bind(id).first();
    if (!current) return json({ error: 'Proses bulunamadı.' }, 404);
    const body = await request.json();
    const merged = { ...fromDb(current), ...body, id, createdAt: current.created_at };
    const error = validateProcess(merged);
    if (error) return json({ error }, 400);
    const record = toDb(merged);
    const updateColumns = processColumns.filter(column => !['id', 'created_at'].includes(column));
    const sql = `UPDATE processes SET ${updateColumns.map(column => `${column} = ?`).join(', ')} WHERE id = ?`;
    try {
      await env.DB.prepare(sql).bind(...updateColumns.map(column => record[column]), id).run();
      await writeAudit(env, request, 'process', id, 'updated', { code: record.code, revision: record.revision });
      return json({ process: fromDb({ ...record, id, created_at: current.created_at }) });
    } catch (error) {
      return json({ error: String(error).includes('UNIQUE') ? 'Proses kodu veya adı başka bir kayıtta kullanılıyor.' : 'Kayıt güncellenemedi.' }, 409);
    }
  }
  if (request.method === 'DELETE' && id) {
    const result = await env.DB.prepare("UPDATE processes SET status = 'archived', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
    if (result.meta?.changes) await writeAudit(env, request, 'process', id, 'archived');
    return result.meta?.changes ? json({ ok: true }) : json({ error: 'Proses bulunamadı.' }, 404);
  }
  return json({ error: 'Desteklenmeyen işlem.' }, 405);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.get('origin');
      if (!origin || origin !== url.origin) return json({ error: 'Aynı kaynak doğrulaması olmayan değişiklik isteği reddedildi.' }, 403);
      const length = Number(request.headers.get('content-length') || 0);
      if (length > 1000000) return json({ error: 'İstek gövdesi çok büyük.' }, 413);
      if (['POST', 'PUT', 'PATCH'].includes(request.method) && !String(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return json({ error: 'JSON içerik türü gerekli.' }, 415);
    }
    if (url.pathname.startsWith('/api/projects')) {
      const roles = ['GET', 'HEAD'].includes(request.method) ? [...userRoles] : ['admin', 'quality_manager', 'quality_engineer', 'process_engineer'];
      const access = await authorizeRequest(env, request, roles); if (access instanceof Response) return access;
    }
    if (url.pathname.startsWith('/api/processes') && !['GET', 'HEAD'].includes(request.method)) {
      const access = await authorizeRequest(env, request, ['admin', 'quality_manager', 'quality_engineer', 'process_engineer']); if (access instanceof Response) return access;
    }
    if (url.pathname.startsWith('/api/projects')) {
      try { return await handleProjects(request, env, url); }
      catch { return json({ error: 'Proje veritabanı işlemi tamamlanamadı.' }, 500); }
    }
    if (url.pathname.startsWith('/api/users')) {
      try { return await handleUsers(request, env, url); }
      catch { return json({ error: 'Kullanıcı veritabanı işlemi tamamlanamadı.' }, 500); }
    }
    if (url.pathname.startsWith('/api/processes')) {
      try { return await handleProcesses(request, env, url); }
      catch { return json({ error: 'Proses veritabanı işlemi tamamlanamadı.' }, 500); }
    }
    const asset = assets[url.pathname] || assets['/'];
    return new Response(asset.body, {
      headers: {
        'content-type': asset.contentType,
        'cache-control': url.pathname === '/' || url.pathname === '/index.html' ? 'no-cache' : 'public, max-age=3600',
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'SAMEORIGIN',
        'referrer-policy': 'no-referrer',
        'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
        'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'; worker-src 'self' blob:"
      }
    });
  }
};
