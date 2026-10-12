// App-wide constants. Anything that may need to change after the app is installed lives in the remote config
// (see remote.jsx), not here, so it can be changed from the dashboard without a new APK.
export const APP_VERSION = __APP_VERSION__;

// Address of the licensing/config server. Empty = no server yet: the app runs unlocked (development mode).
export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
// Public (anon) key the Supabase gateway asks for. It is not a secret; the database is protected by its own rules.
export const API_KEY = import.meta.env.VITE_API_KEY || '';

export const DEFAULT_CONFIG = {
  minVersion: '0.0.0',        // older apps are blocked with an "update required" screen
  latestVersion: APP_VERSION, // newer than the installed app = soft "update available" notice
  updateUrl: '',              // where the APK can be downloaded
  apkSha256: '',              // optional checksum of that APK
  ota: null,                  // { version, url, sha256, minNative }: web part update, see ota.js
  maintenance: { on: false, message: '' },
  notice: null,               // { id, title, body, level: 'info' | 'warning' } shown on Home until dismissed
  // Default contact details, used until the server sends its own. International format for WhatsApp (Egypt +20, no leading 0).
  support: { whatsapp: '+201022097217', phone: '', email: 'mohamed.adel.rwash@gmail.com', telegram: '' },
  links: { privacy: 'https://rwash2024.github.io/OMC-IPTV-APP/privacy/', terms: 'https://rwash2024.github.io/OMC-IPTV-APP/terms/' },
  features: { live: true, movies: true, series: true, parental: true, externalPlayer: true },
  graceDays: 7,               // how long an activated or trial device may run without reaching the server
  texts: {},                  // optional overrides, e.g. { activationHelp: '...' }
};

// "1.2.10" vs "1.2.9": negative when a < b.
export function cmpVersion(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}
