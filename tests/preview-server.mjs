import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const routes = {
  '/': ['index.html', 'text/html; charset=utf-8'], '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/seed-processes.json': ['seed-processes.json', 'application/json; charset=utf-8'], '/manifest.json': ['manifest.json', 'application/manifest+json; charset=utf-8'],
  '/qflow-icon.svg': ['qflow-icon.svg', 'image/svg+xml'], '/service-worker.js': ['service-worker.js', 'text/javascript; charset=utf-8'],
  '/vendor/pdfmake.min.js': ['node_modules/pdfmake/build/pdfmake.min.js', 'text/javascript; charset=utf-8'],
  '/vendor/vfs_fonts.js': ['node_modules/pdfmake/build/vfs_fonts.js', 'text/javascript; charset=utf-8'],
  '/vendor/exceljs.min.js': ['node_modules/exceljs/dist/exceljs.min.js', 'text/javascript; charset=utf-8']
};
const processes = JSON.parse(await readFile(resolve(root, 'seed-processes.json'), 'utf8'));
let project = null;
const readBody = request => new Promise((resolveBody, reject) => { const chunks = []; request.on('data', chunk => chunks.push(chunk)); request.on('end', () => { try { resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (error) { reject(error); } }); });

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:4173');
  if (url.pathname === '/api/processes' && request.method === 'GET') { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ processes })); return; }
  if (url.pathname === '/api/projects/latest' && request.method === 'GET') { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ project })); return; }
  if (url.pathname === '/api/projects' && request.method === 'POST') { const body = await readBody(request); project = { id: 'local-preview-project', version: 1, payload: { ...body.payload, projectId: 'local-preview-project' } }; response.statusCode = 201; response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ project })); return; }
  if (url.pathname === '/api/projects/local-preview-project' && request.method === 'PUT') { const body = await readBody(request); project = { id: 'local-preview-project', version: (project?.version || 1) + 1, payload: { ...body.payload, projectId: 'local-preview-project' } }; response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ project })); return; }
  const route = routes[url.pathname];
  if (!route) { response.statusCode = 404; response.end('Not found'); return; }
  response.setHeader('content-type', route[1]); response.setHeader('cache-control', 'no-store'); response.end(await readFile(resolve(root, route[0])));
});

server.listen(4173, '127.0.0.1', () => console.log('Q-Flow preview: http://127.0.0.1:4173'));
setTimeout(() => server.close(), 180000).unref();
