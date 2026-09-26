import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve('dist');
const port = Number(process.env.PORT || 8082);
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.apk': 'application/vnd.android.package-archive', '.ipa': 'application/octet-stream', '.zip': 'application/zip', '.gz': 'application/gzip' };

/** Serves the exported app with the isolation required by the SQLite worker. */
async function respond(request, response) {
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(root + sep)) { response.writeHead(403); response.end(); return; }
    const content = await readFile(file).catch(() => extname(file) ? null : readFile(resolve(root, 'index.html')));
    if (!content) { response.writeHead(404); response.end(); return; }
    if (extname(file) === '.html') response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', mime[extname(file)] || 'text/html'); response.end(content);
  } catch { response.writeHead(400); response.end('Invalid request'); }
}
createServer(respond).listen(port, () => console.log(`Web preview: http://localhost:${port}`));
