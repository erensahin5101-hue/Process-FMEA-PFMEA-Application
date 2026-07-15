import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';

class MockStatement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
  async first() {
    if (this.sql.includes('COUNT(*) AS total FROM processes')) return { total: 1 };
    if (this.sql.includes('FROM projects ORDER BY updated_at DESC LIMIT 1')) return [...this.db.projects.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] || null;
    if (this.sql.includes('FROM projects WHERE id = ?')) return this.db.projects.get(this.args[0]) || null;
    return null;
  }
  async all() {
    if (this.sql.includes('FROM processes')) return { results: [] };
    if (this.sql.includes('FROM projects')) return { results: [...this.db.projects.values()] };
    return { results: [] };
  }
  async run() {
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
  constructor() { this.projects = new Map(); this.audit = []; }
  prepare(sql) { return new MockStatement(this, sql); }
  async batch(statements) { for (const statement of statements) await statement.run(); return []; }
}

const env = { DB: new MockDb() };
const origin = 'https://qflow.test';
const snapshot = { schemaVersion: '1.0.0', sha256: 'abc123', product: { partNumber: '5101-234-001' }, route: [], characteristics: [] };
const project = { projectCode: 'DT-2026-0042', partNumber: '5101-234-001', partName: 'Rot Başı, Sağ', productGroup: 'steering', revision: 'C', phase: 'Seri Üretim', status: 'Taslak', version: 0, payload: snapshot };

const createResponse = await worker.fetch(new Request(`${origin}/api/projects`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(project) }), env);
assert.equal(createResponse.status, 201);
const created = (await createResponse.json()).project;
assert.equal(created.version, 1);
assert.equal(created.payload.projectId, created.id);
assert.equal(env.DB.audit.length, 1);

const latestResponse = await worker.fetch(new Request(`${origin}/api/projects/latest`), env);
const latest = (await latestResponse.json()).project;
assert.equal(latest.partNumber, '5101-234-001');

const updateResponse = await worker.fetch(new Request(`${origin}/api/projects/${created.id}`, { method: 'PUT', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ ...project, version: 1, revision: 'D' }) }), env);
assert.equal(updateResponse.status, 200);
assert.equal((await updateResponse.json()).project.version, 2);

const conflictResponse = await worker.fetch(new Request(`${origin}/api/projects/${created.id}`, { method: 'PUT', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ ...project, version: 1 }) }), env);
assert.equal(conflictResponse.status, 409);

const csrfResponse = await worker.fetch(new Request(`${origin}/api/projects`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.test' }, body: JSON.stringify(project) }), env);
assert.equal(csrfResponse.status, 403);

const assetResponse = await worker.fetch(new Request(`${origin}/`), env);
assert.equal(assetResponse.status, 200);
assert.match(assetResponse.headers.get('content-security-policy'), /object-src 'none'/);
assert.equal(assetResponse.headers.get('x-content-type-options'), 'nosniff');

console.log(JSON.stringify({ projectCreate: 201, projectUpdate: 200, optimisticConflict: 409, csrfBlocked: 403, audits: env.DB.audit.length, csp: true }));
