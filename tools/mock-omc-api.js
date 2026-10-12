// Fake licensing and config server for testing the app without Supabase. It follows the same contract the real
// server will: GET /config, POST /check, POST /activate.
// Run:  npm run mock:api   then start the app with  VITE_API_BASE=http://localhost:8098
// Test controls (open in a browser):
//   /_set?status=trial|expired|blocked|active   force the status for every device
//   /_set?update=1                              pretend minVersion is higher than the app (forces an update screen)
//   /_set?maintenance=1                         maintenance screen
// Test codes: YEAR-TEST-0001 (1 year), LIFE-TEST-0001 (lifetime), USED-TEST-0001 (already used), REVOKED-TEST-0001
import http from 'node:http';

const DAY = 86400000;
const state = { forced: null, update: false, maintenance: false, devices: new Map(), activated: new Map() };
const CODES = { 'YEAR-TEST-0001': 'year', 'LIFE-TEST-0001': 'lifetime', 'USED-TEST-0001': 'used', 'REVOKED-TEST-0001': 'revoked' };

const send = (res, code, obj) => {
  res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' });
  res.end(JSON.stringify(obj));
};
const body = (req) => new Promise((ok) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch { ok({}); } }); });

function statusFor(id) {
  const now = Date.now();
  if (!state.devices.has(id)) state.devices.set(id, now);
  const trialEnds = state.devices.get(id) + 60 * DAY;
  const base = { server_time: new Date(now).toISOString(), trial_ends_at: new Date(trialEnds).toISOString(), plan: null, expires_at: null, message: null };
  if (state.forced === 'blocked') return { ...base, status: 'blocked', message: 'Contact support' };
  if (state.forced === 'expired') return { ...base, status: 'expired', trial_ends_at: new Date(now - DAY).toISOString() };
  if (state.forced === 'active') return { ...base, status: 'active', plan: 'year', expires_at: new Date(now + 300 * DAY).toISOString() };
  const act = state.activated.get(id);
  if (act) return { ...base, status: 'active', plan: act, expires_at: act === 'lifetime' ? null : new Date(now + 365 * DAY).toISOString() };
  if (state.forced === 'trial') return { ...base, status: 'trial', trial_ends_at: new Date(now + 9 * DAY).toISOString() };
  return { ...base, status: now < trialEnds ? 'trial' : 'expired' };
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (u.pathname === '/_set') {
    const q = u.searchParams;
    if (q.has('status')) state.forced = q.get('status') === 'none' ? null : q.get('status');
    if (q.has('update')) state.update = q.get('update') === '1';
    if (q.has('maintenance')) state.maintenance = q.get('maintenance') === '1';
    if (q.get('reset')) { state.devices.clear(); state.activated.clear(); state.forced = null; }
    return send(res, 200, { forced: state.forced, update: state.update, maintenance: state.maintenance });
  }
  if (u.pathname === '/config') {
    return send(res, 200, {
      minVersion: state.update ? '9.0.0' : '0.0.0', latestVersion: '0.3.0', updateUrl: 'https://example.com/OMC-IPTV.apk',
      maintenance: { on: state.maintenance, message: 'Back in 10 minutes' },
      notice: { id: 'n1', title: 'Welcome', body: 'This is a test notice from the server.', level: 'info' },
      support: { whatsapp: '+201000000000', phone: '+201000000000', email: 'support@example.com', telegram: '' },
      links: { privacy: 'https://example.com/privacy', terms: 'https://example.com/terms' },
      features: { live: true, movies: true, series: true, parental: true, externalPlayer: true },
      graceDays: 7, texts: {},
    });
  }
  if (u.pathname === '/check' && req.method === 'POST') {
    const b = await body(req);
    if (!b.device_id) return send(res, 400, { error: 'device_id required' });
    return send(res, 200, statusFor(b.device_id));
  }
  if (u.pathname === '/activate' && req.method === 'POST') {
    const b = await body(req);
    const kind = CODES[String(b.code || '').toUpperCase()];
    if (!kind) return send(res, 200, { ok: false, error: 'invalid_code' });
    if (kind === 'used') return send(res, 200, { ok: false, error: 'used' });
    if (kind === 'revoked') return send(res, 200, { ok: false, error: 'revoked' });
    state.activated.set(b.device_id, kind);
    state.forced = null;
    return send(res, 200, { ok: true });
  }
  send(res, 404, { error: 'not found' });
}).listen(8098, () => console.log('Mock OMC API on http://localhost:8098'));
