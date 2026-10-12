// Xtream Codes client. All requests go through `route()` so the dev proxy can step in.

const b64u = (s) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// In dev the browser talks to the local proxy (see vite.config.js). In native builds this is a no-op.
export function route(url) {
  if (!import.meta.env.DEV) return url;
  const u = new URL(url);
  return `/p/${b64u(u.origin)}${u.pathname}${u.search}`;
}

export function normalizeServer(input) {
  let s = String(input || '').trim();
  if (!s) throw new Error('empty');
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
  const u = new URL(s);
  return u.origin + u.pathname.replace(/\/+$/, '');
}

const decodeB64 = (s) => {
  try {
    const bin = atob(s || '');
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch { return s || ''; }
};

export class Xtream {
  constructor({ id, server, username, password }) {
    this.id = id;
    this.kind = 'xtream';
    this.server = server;
    this.username = username;
    this.password = password;
  }

  async call(action, extra = {}) {
    const qs = new URLSearchParams({ username: this.username, password: this.password, ...(action ? { action } : {}), ...extra });
    const res = await fetch(route(`${this.server}/player_api.php?${qs}`));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    try { return JSON.parse(text); } catch { throw new Error('BAD_RESPONSE'); }
  }

  // Resolves to { expires: Date|null, status, maxConnections } or throws Error('AUTH' | 'EXPIRED' | ...).
  async login() {
    const d = await this.call('');
    const info = d && typeof d === 'object' ? d.user_info : null;
    // Dev aid: shows the shape of the reply (never the password) in the browser console.
    if (import.meta.env.DEV) console.debug('[xtream] login reply', { keys: d && typeof d === 'object' ? Object.keys(d) : typeof d, auth: info && info.auth, status: info && info.status, message: info && info.message });
    if (!info) throw new Error('BAD_RESPONSE');
    if (Number(info.auth) !== 1) throw new Error('AUTH');
    if (info.status && String(info.status).toLowerCase() !== 'active') throw new Error('EXPIRED');
    const exp = Number(info.exp_date);
    return { expires: exp ? new Date(exp * 1000) : null, status: info.status, maxConnections: info.max_connections };
  }

  liveCategories() { return this.call('get_live_categories'); }
  live() { return this.call('get_live_streams'); }
  vodCategories() { return this.call('get_vod_categories'); }
  vod() { return this.call('get_vod_streams'); }
  vodInfo(id) { return this.call('get_vod_info', { vod_id: id }); }
  seriesCategories() { return this.call('get_series_categories'); }
  series() { return this.call('get_series'); }
  seriesInfo(id) { return this.call('get_series_info', { series_id: id }); }

  async epg(streamId) {
    const d = await this.call('get_short_epg', { stream_id: streamId, limit: 2 });
    return (d.epg_listings || []).map((e) => ({
      title: decodeB64(e.title),
      start: Number(e.start_timestamp) * 1000,
      end: Number(e.stop_timestamp) * 1000,
    }));
  }

  #auth() { return `${encodeURIComponent(this.username)}/${encodeURIComponent(this.password)}`; }
  // kind: 'live' | 'movie' | 'episode'. url() goes through the dev proxy in a browser; raw() is the real address.
  raw(kind, id, ext = 'mp4') {
    const folder = kind === 'live' ? 'live' : kind === 'movie' ? 'movie' : 'series';
    const base = `${this.server}/${folder}/${this.#auth()}/${id}`;
    return kind === 'live' ? `${base}.m3u8` : `${base}.${ext || 'mp4'}`;
  }
  url(kind, id, ext) { return route(this.raw(kind, id, ext)); }
}
