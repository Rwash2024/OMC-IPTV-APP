import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { APP_VERSION, cmpVersion } from './config.js';

/*
 * Over-the-air updates for the app's screens and logic (the web part). The new version is downloaded in the
 * background and used the next time the app starts, so nobody has to reinstall anything.
 * Anything that changes the Android part (new permissions, the native plugins) still needs a new APK.
 *
 * The dashboard's remote config says which web version is current:
 *   config.ota = { version, url, sha256, minNative }
 * minNative is the oldest installed APK that can run that web version.
 */
const native = Capacitor.isNativePlatform();

// Tells the updater this web version started fine. If it never calls this, the updater goes back to the last good one.
export async function markReady() {
  if (!native) return;
  try { await CapacitorUpdater.notifyAppReady(); } catch { /* not fatal */ }
}

// The installed APK's version. In a browser it is the same as the web version.
export async function getNativeVersion() {
  if (!native) return APP_VERSION;
  try { return (await NativeApp.getInfo()).version; } catch { return APP_VERSION; }
}

let busy = false;

// Downloads the web version the server asks for. apply = true reloads right away, otherwise it is used on the next start.
export async function checkForOta(ota, nativeVersion, { apply = false } = {}) {
  if (!native || busy || !ota || !ota.version || !ota.url) return 'none';
  if (cmpVersion(ota.version, APP_VERSION) <= 0) return 'current';
  if (ota.minNative && cmpVersion(nativeVersion, ota.minNative) < 0) return 'needs-apk';
  busy = true;
  try {
    const bundle = await CapacitorUpdater.download({ url: ota.url, version: ota.version, checksum: ota.sha256 || undefined });
    if (apply) await CapacitorUpdater.set(bundle); else await CapacitorUpdater.next(bundle);
    return apply ? 'applied' : 'ready';
  } catch {
    return 'failed';
  } finally {
    busy = false;
  }
}
