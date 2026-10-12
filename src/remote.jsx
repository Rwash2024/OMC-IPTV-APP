import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_BASE, API_KEY, APP_VERSION, DEFAULT_CONFIG, cmpVersion } from './config.js';
import { readJSON, writeJSON } from './store.js';
import { route } from './xtream.js';
import { Capacitor } from '@capacitor/core';

const KEY = 'remoteConfig';
const merge = (base, over) => {
  const out = { ...base };
  for (const k of Object.keys(over || {})) {
    const v = over[k];
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' ? { ...base[k], ...v } : v;
  }
  return out;
};

async function fetchJSON(path, opts = {}, timeoutMs = 8000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const auth = API_KEY ? { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` } : {};
    const res = await fetch(route(`${API_BASE}${path}`), { ...opts, headers: { ...auth, ...(opts.headers || {}) }, signal: ac.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(timer); }
}
export { fetchJSON };

const Ctx = createContext(null);

// Loads the config from the server and keeps the last good copy, so the app still behaves the same offline.
export function RemoteProvider({ children }) {
  const [config, setConfig] = useState(() => merge(DEFAULT_CONFIG, readJSON(KEY, null)));

  const refresh = useCallback(async () => {
    if (!API_BASE) return;
    try {
      const platform = Capacitor.getPlatform();
      const remote = await fetchJSON(`/config?v=${encodeURIComponent(APP_VERSION)}&p=${platform}`);
      writeJSON(KEY, remote);
      setConfig(merge(DEFAULT_CONFIG, remote));
    } catch { /* keep the cached config */ }
  }, []);

  useEffect(() => {
    refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const value = useMemo(() => ({
    config,
    refresh,
    mustUpdate: cmpVersion(APP_VERSION, config.minVersion) < 0,
    updateAvailable: cmpVersion(APP_VERSION, config.latestVersion) < 0,
  }), [config, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useRemote = () => useContext(Ctx);
