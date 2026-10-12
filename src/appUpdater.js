import { registerPlugin } from '@capacitor/core';
import { isNative } from './immersive.js';

// Downloads an APK inside the app and opens Android's installer (AppUpdaterPlugin.java).
const plugin = isNative ? registerPlugin('AppUpdater') : null;

// Returns { ok: true } or { ok: false, error: 'PERMISSION' | 'CHECKSUM' | message }.
export async function installApk(url, sha256, onProgress) {
  if (!plugin) { window.open(url, '_blank', 'noopener'); return { ok: true }; }
  const sub = onProgress ? await plugin.addListener('progress', (e) => onProgress(e.percent)) : null;
  try {
    await plugin.install({ url, sha256: sha256 || '' });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'failed' };
  } finally {
    if (sub) sub.remove();
  }
}
