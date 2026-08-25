import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const routes = {
  '/': ['index.html', 'text/html; charset=utf-8'], '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'], '/product-universe.css': ['product-universe.css', 'text/css; charset=utf-8'], '/operator-instruction.css': ['operator-instruction.css', 'text/css; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/bom-domain.js': ['bom-domain.js', 'text/javascript; charset=utf-8'],
  '/master-template-domain.js': ['master-template-domain.js', 'text/javascript; charset=utf-8'],
  '/master-template-ui.js': ['master-template-ui.js', 'text/javascript; charset=utf-8'],
  '/product-definition-workspace.js': ['product-definition-workspace.js', 'text/javascript; charset=utf-8'],
  '/apqp-traceability.js': ['apqp-traceability.js', 'text/javascript; charset=utf-8'],
  '/fmea-governance.js': ['fmea-governance.js', 'text/javascript; charset=utf-8'],
  '/guided-experience.js': ['guided-experience.js', 'text/javascript; charset=utf-8'],
  '/platform-adapter.js': ['platform-adapter.js', 'text/javascript; charset=utf-8'],
  '/seed-processes.json': ['seed-processes.json', 'application/json; charset=utf-8'], '/manifest.json': ['manifest.json', 'application/manifest+json; charset=utf-8'],
  '/data/product-engineering-library.json': ['data/product-engineering-library.json', 'application/json; charset=utf-8'],
  '/data/pfmea-engineering-library.json': ['data/pfmea-engineering-library.json', 'application/json; charset=utf-8'],
  '/data/bom-engineering-library.json': ['data/bom-engineering-library.json', 'application/json; charset=utf-8'],
  '/data/quality-document-library.json': ['data/quality-document-library.json', 'application/json; charset=utf-8'],
  '/data/operation-code-library.tr-en.v1.0.0.json': ['data/operation-code-library.tr-en.v1.0.0.json', 'application/json; charset=utf-8'],
  '/data/machines-master-seed.json': ['files/machines_master_seed.json', 'application/json; charset=utf-8'],
  '/qflow-icon.svg': ['qflow-icon.svg', 'image/svg+xml'], '/service-worker.js': ['service-worker.js', 'text/javascript; charset=utf-8'],
  '/vendor/pdfmake.min.js': ['node_modules/pdfmake/build/pdfmake.min.js', 'text/javascript; charset=utf-8'],
  '/vendor/vfs_fonts.js': ['node_modules/pdfmake/build/vfs_fonts.js', 'text/javascript; charset=utf-8'],
  '/vendor/exceljs.min.js': ['node_modules/exceljs/dist/exceljs.min.js', 'text/javascript; charset=utf-8']
};
const processes = JSON.parse(await readFile(resolve(root, 'seed-processes.json'), 'utf8'));
let project = null;
let users = [{ id: 'user-eren', email: 'eren@tyana.local', displayName: 'Eren', role: 'admin', status: 'active', plant: 'Kullanıcı Tanımlı Tesis', department: 'Kalite', version: 1 }];
const readBody = request => new Promise((resolveBody, reject) => { const chunks = []; request.on('data', chunk => chunks.push(chunk)); request.on('end', () => { try { resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (error) { reject(error); } }); });

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:4173');
  if (url.pathname === '/api/processes' && request.method === 'GET') { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ processes })); return; }
  if (url.pathname === '/api/projects/latest' && request.method === 'GET') { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ project })); return; }
  if (url.pathname === '/api/projects' && request.method === 'POST') { const body = await readBody(request); project = { id: 'local-preview-project', version: 1, payload: { ...body.payload, projectId: 'local-preview-project' } }; response.statusCode = 201; response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ project })); return; }
  if (url.pathname === '/api/projects/local-preview-project' && request.method === 'PUT') { const body = await readBody(request); project = { id: 'local-preview-project', version: (project?.version || 1) + 1, payload: { ...body.payload, projectId: 'local-preview-project' } }; response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ project })); return; }
  if (url.pathname === '/api/users/me' && request.method === 'GET') { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ user: users[0], identity: { email: 'preview@localhost', displayName: 'Eren', source: 'local-demo' }, bootstrapProfile: true })); return; }
  if (url.pathname === '/api/users' && request.method === 'GET') { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ users })); return; }
  if (url.pathname === '/api/users' && request.method === 'POST') { const body = await readBody(request); const user = { ...body, id: `preview-${Date.now()}`, version: 1 }; users.push(user); response.statusCode = 201; response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ user })); return; }
  if (url.pathname.startsWith('/api/users/') && request.method === 'PUT') { const id = decodeURIComponent(url.pathname.slice('/api/users/'.length)); const body = await readBody(request); const index = users.findIndex(user => user.id === id); if (index < 0) { response.statusCode = 404; response.end(JSON.stringify({ error: 'Kullanıcı bulunamadı.' })); return; } users[index] = { ...users[index], ...body, id, version: users[index].version + 1 }; response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ user: users[index] })); return; }
  if (url.pathname.startsWith('/api/users/') && request.method === 'DELETE') { const id = decodeURIComponent(url.pathname.slice('/api/users/'.length)); const index = users.findIndex(user => user.id === id); if (index < 0) { response.statusCode = 404; response.end(JSON.stringify({ error: 'Kullanıcı bulunamadı.' })); return; } users[index] = { ...users[index], status: 'inactive', version: users[index].version + 1 }; response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ user: users[index] })); return; }
  const route = routes[url.pathname];
  if (!route) { response.statusCode = 404; response.end('Not found'); return; }
  response.setHeader('content-type', route[1]); response.setHeader('cache-control', 'no-store'); response.end(await readFile(resolve(root, route[0])));
});

server.listen(4173, '127.0.0.1', () => console.log('Q-Flow preview: http://127.0.0.1:4173'));
setTimeout(() => server.close(), 180000).unref();
