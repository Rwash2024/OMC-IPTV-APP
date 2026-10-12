import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { Readable } from 'node:stream';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/*
 * Dev-only proxy. Browsers block calls to most Xtream servers (CORS, plain http).
 * The app asks for /p/<base64url(origin)>/<path>?<query> and this forwards it.
 * It only runs with `npm run dev`; native builds (Android, TV) call the server directly.
 */
const b64u = (s) => Buffer.from(s).toString('base64url');
const proxied = (url) => {
  const u = new URL(url);
  return `/p/${b64u(u.origin)}${u.pathname}${u.search}`;
};

function xtreamProxy() {
  return {
    name: 'xtream-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/p', async (req, res) => {
        try {
          const m = req.url.match(/^\/([A-Za-z0-9_-]+)(\/[^]*)?$/);
          if (!m) { res.statusCode = 400; return res.end('bad proxy path'); }
          const origin = Buffer.from(m[1], 'base64url').toString();
          if (!/^https?:\/\/[^/\s]+$/.test(origin)) { res.statusCode = 400; return res.end('bad origin'); }
          const target = origin + (m[2] || '/');

          const ac = new AbortController();
          res.on('close', () => ac.abort());
          // Some providers only answer player-like clients, so identify as a media player rather than a browser.
          const headers = { 'user-agent': 'VLC/3.0.20 LibVLC/3.0.20' };
          if (req.headers.range) headers.range = req.headers.range;
          for (const h of ['apikey', 'authorization']) if (req.headers[h]) headers[h] = req.headers[h];
          // Forward POST requests (the licensing server uses them) with their body.
          let body;
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks = [];
            for await (const c of req) chunks.push(c);
            body = Buffer.concat(chunks);
            if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
          }
          const r = await fetch(target, { method: req.method, headers, body, redirect: 'follow', signal: ac.signal });

          res.statusCode = r.status;
          const ct = r.headers.get('content-type') || '';
          res.setHeader('access-control-allow-origin', '*');
          if (ct) res.setHeader('content-type', ct);

          const isPlaylist = /mpegurl/i.test(ct) || /\.m3u8(\?|$)/i.test(r.url);
          if (isPlaylist) {
            const text = await r.text();
            const out = text.split(/\r?\n/).map((line) => {
              if (!line || line.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_, u) => `URI="${proxied(new URL(u, r.url).href)}"`);
              return proxied(new URL(line, r.url).href);
            }).join('\n');
            return res.end(out);
          }
          for (const h of ['content-length', 'content-range', 'accept-ranges']) {
            const v = r.headers.get(h);
            if (v) res.setHeader(h, v);
          }
          if (!r.body) return res.end();
          Readable.fromWeb(r.body).on('error', () => res.destroy()).pipe(res);
        } catch (e) {
          if (!res.headersSent) { res.statusCode = 502; res.end('proxy error: ' + (e?.message || e)); }
          else res.destroy();
        }
      });
    },
  };
}

// The Android project holds a synced copy of the web build; watching it crashes the dev server on Windows.
export default defineConfig({
  plugins: [react(), xtreamProxy()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { watch: { ignored: ['**/android/**', '**/dist/**'] } },
});
