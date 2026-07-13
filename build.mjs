import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = new URL('.', import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, '$1');
const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8']
};

const assets = {};
for (const [pathname, [file, contentType]] of Object.entries(files)) {
  assets[pathname] = { contentType, body: await readFile(resolve(root, file), 'utf8') };
}

const worker = `const assets = ${JSON.stringify(assets)};

export default {
  async fetch(request) {
    const url = new URL(request.url);
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
`;

const output = resolve(root, 'dist', 'server');
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'index.js'), worker, 'utf8');
console.log(`Q-Flow build ready: ${Object.keys(assets).length} web routes.`);
