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

const processColumns = [
  'id', 'code', 'name', 'family', 'category', 'description', 'input_material',
  'output_material', 'equipment', 'tooling', 'special_process', 'outsourced',
  'control_method', 'characteristics', 'risk_template', 'reaction_plan',
  'work_instruction', 'cycle_time_sec', 'setup_time_min', 'owner', 'revision',
  'status', 'approval_status', 'document_ref', 'pfmea_function', 'process_standard',
  'created_at', 'updated_at'
];

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

async function ensureDatabase(env) {
  if (!env.DB) throw new Error('D1 binding DB is unavailable');
  await env.DB.batch([
    env.DB.prepare(schemaSql),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS processes_family_idx ON processes (family)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS processes_status_idx ON processes (status)')
  ]);
  const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM processes').first();
  if (Number(count?.total || 0) === 0) {
    const insertSql = `INSERT INTO processes (${processColumns.join(', ')}) VALUES (${processColumns.map(() => '?').join(', ')})`;
    await env.DB.batch(processSeed.map(process => {
      const record = toDb(process);
      return env.DB.prepare(insertSql).bind(...processColumns.map(column => record[column]));
    }));
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

function validateProcess(process) {
  const missing = ['code', 'name', 'family', 'category', 'equipment', 'controlMethod'].filter(field => !String(process[field] || '').trim());
  if (missing.length) return `Zorunlu alanlar eksik: ${missing.join(', ')}`;
  if (Number(process.cycleTimeSec) < 0 || Number(process.setupTimeMin) < 0) return 'Süre değerleri negatif olamaz.';
  return null;
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
      return json({ process: fromDb({ ...record, id, created_at: current.created_at }) });
    } catch (error) {
      return json({ error: String(error).includes('UNIQUE') ? 'Proses kodu veya adı başka bir kayıtta kullanılıyor.' : 'Kayıt güncellenemedi.' }, 409);
    }
  }
  if (request.method === 'DELETE' && id) {
    const result = await env.DB.prepare("UPDATE processes SET status = 'archived', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
    return result.meta?.changes ? json({ ok: true }) : json({ error: 'Proses bulunamadı.' }, 404);
  }
  return json({ error: 'Desteklenmeyen işlem.' }, 405);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/processes')) {
      try { return await handleProcesses(request, env, url); }
      catch (error) { return json({ error: 'Proses veritabanına erişilemedi.', detail: String(error) }, 500); }
    }
    const asset = assets[url.pathname] || assets['/'];
    return new Response(asset.body, {
      headers: {
        'content-type': asset.contentType,
        'cache-control': url.pathname === '/' || url.pathname === '/index.html' ? 'no-cache' : 'public, max-age=3600',
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'SAMEORIGIN'
      }
    });
  }
};
