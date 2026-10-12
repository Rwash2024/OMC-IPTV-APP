import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_BASE, API_KEY, APP_VERSION, DEFAULT_CONFIG, cmpVersion } from './config.js';
import { readJSON, writeJSON } from './store.js';
import { route } from './xtream.js';
import { Capacitor } from '@capacitor/core';
import { checkForOta, getNativeVersion } from './ota.js';

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
  const [nativeVersion, setNativeVersion] = useState(APP_VERSION);
  const [otaState, setOtaState] = useState('none');

  const refresh = useCallback(async () => {
    if (!API_BASE) return;
    try {
      const platform = Capacitor.getPlatform();
      const remote = await fetchJSON(`/config?v=${encodeURIComponent(APP_VERSION)}&p=${platform}`);
      writeJSON(KEY, remote);
      setConfig(merge(DEFAULT_CONFIG, remote));
    } catch { /* keep the cached config */ }
  }, []);

  useEffect(() => { getNativeVersion().then(setNativeVersion); }, []);

  // Fetch a newer web version in the background; it is used the next time the app starts.
  useEffect(() => { checkForOta(config.ota, nativeVersion).then(setOtaState); }, [config.ota, nativeVersion]);

  useEffect(() => {
    refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const value = useMemo(() => ({
    config,
    refresh,
    nativeVersion,
    otaState,
    // minVersion / latestVersion are about the installed APK. The web part updates by itself (see ota.js).
    mustUpdate: cmpVersion(nativeVersion, config.minVersion) < 0,
    updateAvailable: cmpVersion(nativeVersion, config.latestVersion) < 0,
  }), [config, refresh, nativeVersion, otaState]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useRemote = () => useContext(Ctx);
