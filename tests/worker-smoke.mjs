import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';

const processColumns = [
  'id', 'code', 'name', 'family', 'category', 'description', 'input_material',
  'output_material', 'equipment', 'tooling', 'special_process', 'outsourced',
  'control_method', 'characteristics', 'risk_template', 'reaction_plan',
  'work_instruction', 'cycle_time_sec', 'setup_time_min', 'owner', 'revision',
  'status', 'approval_status', 'document_ref', 'pfmea_function', 'process_standard',
  'created_at', 'updated_at'
];
const userColumns = ['id', 'email', 'display_name', 'role', 'status', 'plant', 'department', 'version', 'created_at', 'updated_at'];

class MockStatement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
  async first() {
    if (this.sql.includes("COUNT(*) AS total FROM users WHERE role = 'admin'")) return { total: [...this.db.users.values()].filter(row => row.role === 'admin' && row.status === 'active').length };
    if (this.sql.includes('FROM projects ORDER BY updated_at DESC LIMIT 1')) return [...this.db.projects.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] || null;
    if (this.sql.includes('FROM projects WHERE id = ?')) return this.db.projects.get(this.args[0]) || null;
    if (this.sql.includes('FROM users WHERE email = ?')) return [...this.db.users.values()].find(row => row.email === this.args[0]) || null;
    if (this.sql.includes('FROM users WHERE id = ?')) return this.db.users.get(this.args[0]) || null;
    if (this.sql.includes('FROM processes WHERE id = ?')) return this.db.processes.get(this.args[0]) || null;
    return null;
  }
  async all() {
    if (this.sql.includes('FROM processes')) return { results: [...this.db.processes.values()] };
    if (this.sql.includes('FROM projects')) return { results: [...this.db.projects.values()] };
    if (this.sql.includes('FROM users')) return { results: [...this.db.users.values()] };
    return { results: [] };
  }
  async run() {
    if (this.sql.startsWith('INSERT OR IGNORE INTO processes')) {
      const row = Object.fromEntries(processColumns.map((column, index) => [column, this.args[index]]));
      const duplicate = [...this.db.processes.values()].some(existing => existing.id === row.id || existing.code === row.code || existing.name === row.name);
      if (!duplicate) this.db.processes.set(row.id, row);
      return { meta: { changes: duplicate ? 0 : 1 } };
    }
    if (this.sql.startsWith('INSERT OR IGNORE INTO users')) {
      const row = Object.fromEntries(userColumns.map((column, index) => [column, this.args[index]]));
      const duplicate = [...this.db.users.values()].some(existing => existing.id === row.id || existing.email === row.email);
      if (!duplicate) this.db.users.set(row.id, row);
      return { meta: { changes: duplicate ? 0 : 1 } };
    }
    if (this.sql.startsWith('INSERT INTO users')) {
      const row = Object.fromEntries(userColumns.map((column, index) => [column, this.args[index]]));
      if ([...this.db.users.values()].some(existing => existing.email === row.email)) throw new Error('UNIQUE constraint failed: users.email');
      this.db.users.set(row.id, row);
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith('UPDATE users SET email')) {
      const [email, display_name, role, status, plant, department, version, updated_at, id, expectedVersion] = this.args;
      const current = this.db.users.get(id);
      if (!current || current.version !== expectedVersion) return { meta: { changes: 0 } };
      this.db.users.set(id, { ...current, email, display_name, role, status, plant, department, version, updated_at });
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith("UPDATE users SET status = 'inactive'")) {
      const [version, updated_at, id, expectedVersion] = this.args;
      const current = this.db.users.get(id);
      if (!current || current.version !== expectedVersion) return { meta: { changes: 0 } };
      this.db.users.set(id, { ...current, status: 'inactive', version, updated_at });
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith('INSERT INTO projects')) {
      const [id, project_code, part_number, part_name, product_group, revision, phase, status, payload, created_at, updated_at] = this.args;
      this.db.projects.set(id, { id, project_code, part_number, part_name, product_group, revision, phase, status, version: 1, payload, created_at, updated_at });
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith('UPDATE projects SET')) {
      const [project_code, part_number, part_name, product_group, revision, phase, status, version, payload, updated_at, id, expectedVersion] = this.args;
      const current = this.db.projects.get(id);
      if (!current || current.version !== expectedVersion) return { meta: { changes: 0 } };
      this.db.projects.set(id, { ...current, project_code, part_number, part_name, product_group, revision, phase, status, version, payload, updated_at });
      return { meta: { changes: 1 } };
    }
    if (this.sql.startsWith('INSERT INTO audit_events')) { this.db.audit.push(this.args); return { meta: { changes: 1 } }; }
    return { meta: { changes: 0 } };
  }
}

class MockDb {
  constructor() {
    this.projects = new Map();
    this.users = new Map();
    this.audit = [];
    this.processes = new Map([['incoming', {
      id: 'incoming', code: 'PR-010', name: 'Kullanıcı Düzenlemesi Korunur', family: 'Kalite', category: 'Kontrol',
      description: '', input_material: '', output_material: '', equipment: '', tooling: '', special_process: 0, outsourced: 0,
      control_method: '', characteristics: '[]', risk_template: '[]', reaction_plan: '', work_instruction: '', cycle_time_sec: 0,
      setup_time_min: 0, owner: 'Eren', revision: 'Z', status: 'active', approval_status: 'approved', document_ref: '',
      pfmea_function: '', process_standard: '', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z'
    }]]);
  }
  prepare(sql) { return new MockStatement(this, sql); }
  async batch(statements) { for (const statement of statements) await statement.run(); return []; }
}

const env = { DB: new MockDb() };
const origin = 'https://qflow.test';
const authHeaders = {
  'oai-authenticated-user-email': 'eren@example.test',
  'oai-authenticated-user-full-name': 'Eren%20Karasoy',
  'oai-authenticated-user-full-name-encoding': 'percent-encoded-utf-8'
};

const meResponse = await worker.fetch(new Request(`${origin}/api/users/me`, { headers: authHeaders }), env);
assert.equal(meResponse.status, 200);
assert.equal((await meResponse.json()).bootstrapProfile, true);
const usersResponse = await worker.fetch(new Request(`${origin}/api/users`, { headers: authHeaders }), env);
assert.equal(usersResponse.status, 200);
const seededUsers = (await usersResponse.json()).users;
assert.equal(seededUsers.length, 1);
assert.equal(seededUsers[0].displayName, 'Eren');
assert.equal(seededUsers[0].plant, 'Kullanıcı Tanımlı Tesis');
assert.equal(env.DB.processes.get('incoming').name, 'Kullanıcı Düzenlemesi Korunur');
assert.equal(env.DB.processes.get('integrated-assembly').name, 'Entegre Tesis Montaj Prosesi');

const newUser = { email: 'kalite@tyana.local', displayName: 'Kalite Uzmanı', role: 'quality_engineer', status: 'active', plant: 'Kullanıcı Tanımlı Tesis', department: 'Kalite' };
const createUserResponse = await worker.fetch(new Request(`${origin}/api/users`, { method: 'POST', headers: { 'content-type': 'application/json', origin, ...authHeaders }, body: JSON.stringify(newUser) }), env);
assert.equal(createUserResponse.status, 201);
const createdUser = (await createUserResponse.json()).user;
assert.equal(createdUser.version, 1);
const userAudit = env.DB.audit.at(-1);
assert.equal(userAudit[4], 'eren@example.test');
assert.deepEqual(JSON.parse(userAudit[5]).actorName, 'Eren Karasoy');

const invalidRoleResponse = await worker.fetch(new Request(`${origin}/api/users`, { method: 'POST', headers: { 'content-type': 'application/json', origin, ...authHeaders }, body: JSON.stringify({ ...newUser, email: 'other@tyana.local', role: 'superuser' }) }), env);
assert.equal(invalidRoleResponse.status, 400);

const lastAdminResponse = await worker.fetch(new Request(`${origin}/api/users/user-eren?version=1`, { method: 'DELETE', headers: { origin, ...authHeaders } }), env);
assert.equal(lastAdminResponse.status, 409);

const updateUserResponse = await worker.fetch(new Request(`${origin}/api/users/${createdUser.id}`, { method: 'PUT', headers: { 'content-type': 'application/json', origin, ...authHeaders }, body: JSON.stringify({ ...createdUser, version: 1, department: 'Kalite Sistemleri' }) }), env);
assert.equal(updateUserResponse.status, 200);
const updatedUser = (await updateUserResponse.json()).user;
assert.equal(updatedUser.version, 2);

const staleUserResponse = await worker.fetch(new Request(`${origin}/api/users/${createdUser.id}`, { method: 'PUT', headers: { 'content-type': 'application/json', origin, ...authHeaders }, body: JSON.stringify({ ...createdUser, version: 1 }) }), env);
assert.equal(staleUserResponse.status, 409);

const deactivateUserResponse = await worker.fetch(new Request(`${origin}/api/users/${createdUser.id}?version=2`, { method: 'DELETE', headers: { origin, ...authHeaders } }), env);
assert.equal(deactivateUserResponse.status, 200);
assert.equal((await deactivateUserResponse.json()).user.status, 'inactive');

const snapshot = { schemaVersion: '1.0.0', sha256: 'abc123', product: { partNumber: '5101-234-001' }, route: [], characteristics: [] };
const project = { projectCode: 'TY-2026-0042', partNumber: '5101-234-001', partName: 'Rot Başı, Sağ', productGroup: 'steering', revision: 'C', phase: 'Seri Üretim', status: 'Taslak', version: 0, payload: snapshot };

const createResponse = await worker.fetch(new Request(`${origin}/api/projects`, { method: 'POST', headers: { 'content-type': 'application/json', origin, ...authHeaders }, body: JSON.stringify(project) }), env);
assert.equal(createResponse.status, 201);
const created = (await createResponse.json()).project;
assert.equal(created.version, 1);
assert.equal(created.payload.projectId, created.id);

const latestResponse = await worker.fetch(new Request(`${origin}/api/projects/latest`, { headers: authHeaders }), env);
const latest = (await latestResponse.json()).project;
assert.equal(latest.partNumber, '5101-234-001');

const updateResponse = await worker.fetch(new Request(`${origin}/api/projects/${created.id}`, { method: 'PUT', headers: { 'content-type': 'application/json', origin, ...authHeaders }, body: JSON.stringify({ ...project, version: 1, revision: 'D' }) }), env);
assert.equal(updateResponse.status, 200);
assert.equal((await updateResponse.json()).project.version, 2);

const conflictResponse = await worker.fetch(new Request(`${origin}/api/projects/${created.id}`, { method: 'PUT', headers: { 'content-type': 'application/json', origin, ...authHeaders }, body: JSON.stringify({ ...project, version: 1 }) }), env);
assert.equal(conflictResponse.status, 409);

const csrfResponse = await worker.fetch(new Request(`${origin}/api/users`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.test', ...authHeaders }, body: JSON.stringify(newUser) }), env);
assert.equal(csrfResponse.status, 403);
const unauthenticatedResponse = await worker.fetch(new Request(`${origin}/api/users`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(newUser) }), env);
assert.equal(unauthenticatedResponse.status, 401);

const assetResponse = await worker.fetch(new Request(`${origin}/`), env);
assert.equal(assetResponse.status, 200);
assert.match(assetResponse.headers.get('content-security-policy'), /object-src 'none'/);
assert.equal(assetResponse.headers.get('x-content-type-options'), 'nosniff');

console.log(JSON.stringify({ usersSeeded: 1, userCreate: 201, userUpdate: 200, userDeactivate: 200, identityAudit: true, workspaceAuthRequired: true, integratedAssemblySeeded: true, seedEditsPreserved: true, projectCreate: 201, projectUpdate: 200, optimisticConflicts: 2, csrfBlocked: 403, audits: env.DB.audit.length, csp: true }));
