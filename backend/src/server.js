import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

export function createApp() {
  return createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/api/health') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Not found' }));
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 3001;
  createApp().listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
  });
}
