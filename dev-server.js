import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const contentTypes = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };
const port = Number(process.env.PORT) || 8765;

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const path = normalize(join(root, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')));
    if (path !== root && !path.startsWith(root + '\\') && !path.startsWith(root + '/')) throw new Error('Invalid path');
    const body = await readFile(path);
    response.writeHead(200, { 'Content-Type': contentTypes[extname(path)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404); response.end('Not found');
  }
}).listen(port, () => console.log(`MapMaker 3000 running at http://localhost:${port}`));
