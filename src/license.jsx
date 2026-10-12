import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { API_BASE, APP_VERSION } from './config.js';
import { immersive } from './immersive.js';
import { fetchJSON, useRemote } from './remote.jsx';
import { readJSON, writeJSON } from './store.js';

/*
 * Trial and activation.
 * - The device id is shown to the customer and is what an activation code gets bound to. On Android it comes from the
 *   system (survives reinstalling), elsewhere it is generated once and kept.
 * - The server decides the status: trial | active | expired | blocked. The app keeps the last answer so it can run
 *   offline for a while (graceDays) and ignores a device clock that was turned back.
 * - With no server address configured the app runs unlocked (development).
 */
const ID_KEY = 'deviceId';
const CACHE_KEY = 'licenseCache';
const DAY = 86400000;

const fmtId = (hex) => hex.toUpperCase().slice(0, 12).replace(/(.{4})(?=.)/g, '$1-');

export async function getDeviceId() {
  const saved = readJSON(ID_KEY, null);
  if (saved) return saved;
  let id = '';
  const native = Capacitor.isNativePlatform() ? await immersive.deviceId() : '';
  if (native) {
    const bytes = new TextEncoder().encode('omc-iptv:' + native);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    id = fmtId([...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join(''));
  } else {
    id = fmtId([...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, '0')).join(''));
  }
  writeJSON(ID_KEY, id);
  return id;
}

const daysLeftOf = (iso, now) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - now) / DAY)) : null);

function describe(resp, now, source) {
  const until = resp.status === 'active' ? resp.expires_at : resp.trial_ends_at;
  return {
    status: resp.status,
    plan: resp.plan || null,
    expiresAt: resp.expires_at || null,
    trialEndsAt: resp.trial_ends_at || null,
    daysLeft: daysLeftOf(until, now),
    message: resp.message || '',
    source,
  };
}

async function runCheck(deviceId, graceDays) {
  if (!API_BASE) return { status: 'active', plan: 'dev', source: 'dev', daysLeft: null, expiresAt: null, trialEndsAt: null, message: '' };
  const cache = readJSON(CACHE_KEY, null);
  try {
    const resp = await fetchJSON('/check', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId, platform: Capacitor.getPlatform(), version: APP_VERSION }),
    });
    const serverNow = resp.server_time ? new Date(resp.server_time).getTime() : Date.now();
    writeJSON(CACHE_KEY, { resp, checkedAt: Date.now(), skew: serverNow - Date.now(), seenAt: Date.now() });
    return describe(resp, serverNow, 'server');
  } catch {
    // Offline: trust the last server answer for a limited time, unless the clock went backwards.
    if (!cache) return { status: 'offline', source: 'none' };
    const now = Date.now();
    const age = now - cache.checkedAt;
    const clockBack = now < (cache.seenAt || 0) - 3600000;
    const usable = (cache.resp.status === 'trial' || cache.resp.status === 'active') && age >= -3600000 && age < graceDays * DAY && !clockBack;
    if (!usable) return cache.resp.status === 'expired' || cache.resp.status === 'blocked' ? describe(cache.resp, now, 'cache') : { status: 'offline', source: 'cache' };
    writeJSON(CACHE_KEY, { ...cache, seenAt: Math.max(now, cache.seenAt || 0) });
    const serverNow = now + (cache.skew || 0);
    const adjusted = describe(cache.resp, serverNow, 'cache');
    // A trial or subscription that ended while offline is expired.
    const until = cache.resp.status === 'trial' ? cache.resp.trial_ends_at : cache.resp.expires_at;
    if (until && new Date(until).getTime() < serverNow) return { ...adjusted, status: 'expired' };
    return adjusted;
  }
}

const Ctx = createContext(null);

export function LicenseProvider({ children }) {
  const { config } = useRemote();
  const [state, setState] = useState({ loading: true, deviceId: '', license: null });
  const graceRef = useRef(config.graceDays);
  graceRef.current = config.graceDays;

  const check = useCallback(async () => {
    const deviceId = await getDeviceId();
    const license = await runCheck(deviceId, graceRef.current);
    setState({ loading: false, deviceId, license });
  }, []);

  useEffect(() => {
    check();
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [check]);

  // Returns { ok: true } or { ok: false, error } where error is invalid_code | used | revoked | blocked | network.
  const activate = useCallback(async (code) => {
    try {
      const resp = await fetchJSON('/activate', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ device_id: state.deviceId, code: code.trim() }),
      });
      if (!resp.ok) return { ok: false, error: resp.error || 'invalid_code' };
      await check();
      return { ok: true };
    } catch { return { ok: false, error: 'network' }; }
  }, [state.deviceId, check]);

  const value = useMemo(() => ({ ...state, check, activate }), [state, check, activate]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useLicense = () => useContext(Ctx);
