// Lets `npm run dev` serve the /api/* functions locally with the same code Vercel runs in production.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function createApiMiddleware(root) {
  const apiDir = path.join(root, 'api');
  return async function apiMiddleware(req, res, next) {
    const url = new URL(req.url, 'http://localhost');
    const m = /^\/api\/([a-z0-9-]+)\/?$/i.exec(url.pathname);
    if (!m) return next();
    const file = path.join(apiDir, `${m[1]}.js`);
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); return res; };
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const rawBuf = Buffer.concat(chunks);
      req.rawBody = rawBuf; // used by the Razorpay webhook signature check
      const raw = rawBuf.toString('utf8');
      if (raw && /json/i.test(req.headers['content-type'] || '')) { try { req.body = JSON.parse(raw); } catch { req.body = {}; } } else if (raw) req.body = raw;
      const mod = await import(`${pathToFileURL(file).href}?v=${fs.statSync(file).mtimeMs}`);
      await mod.default(req, res);
    } catch (e) {
      console.error('[api]', e);
      if (!res.writableEnded) res.status(500).json({ error: e.message || 'Server error' });
    }
  };
}
