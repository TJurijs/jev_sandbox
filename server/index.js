import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createApp } from './app.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
const dev = process.argv.includes('--dev');
const app = createApp({ apiKey: process.env.OPENROUTER_API_KEY });
const server = createServer(app);
let vite;

if (dev) {
  const { createServer: createViteServer } = await import('vite');
  vite = await createViteServer({
    root,
    // Keep dependency URLs compatible with the server's dotfile protections.
    cacheDir: path.join(root, 'node_modules', 'vite-cache'),
    server: { middlewareMode: true, hmr: { server }, allowedHosts: ['localhost', '127.0.0.1'] },
    appType: 'custom',
  });
  app.use(vite.middlewares);
  app.use(async (req, res, next) => {
    if (req.method !== 'GET' || !req.accepts('html')) return next();
    try {
      const html = await vite.transformIndexHtml(req.originalUrl, readFileSync(path.join(root, 'index.html'), 'utf8'));
      res.status(200).type('html').send(html);
    } catch (error) {
      vite.ssrFixStacktrace(error);
      next(error);
    }
  });
} else {
  const dist = path.join(root, 'dist');
  if (!existsSync(path.join(dist, 'index.html'))) throw new Error('Build the app first with npm run build.');
  app.use(express.static(dist, { dotfiles: 'deny' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || !req.accepts('html') || path.extname(req.path)) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.use((_req, res) => res.sendStatus(404));
app.use((_error, _req, res, _next) => res.status(500).type('text').send('The local app could not serve this page.'));
server.listen(port, '127.0.0.1', () => console.log(`Jev Lab is running at http://127.0.0.1:${port}`));
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is in use. Set PORT to use another port.` : 'Unable to start the local server.');
  process.exitCode = 1;
});

async function stop() {
  await vite?.close();
  server.close(() => process.exit(0));
  server.closeIdleConnections();
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
