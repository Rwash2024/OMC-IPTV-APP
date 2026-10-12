import { Capacitor, registerPlugin } from '@capacitor/core';

// Native full-screen mode (landscape, hidden system bars). The WebView can't do this itself, so the Android app
// has a small plugin (ImmersivePlugin.java). On the web these calls do nothing.
export const isNative = Capacitor.isNativePlatform();
const plugin = isNative ? registerPlugin('Immersive') : null;

export const immersive = {
  enter: () => (plugin ? plugin.enter().catch(() => {}) : Promise.resolve()),
  setOrientation: (mode) => (plugin ? plugin.setOrientation({ mode }).catch(() => {}) : Promise.resolve()),
  deviceId: () => (plugin ? plugin.deviceId().then((r) => r.id).catch(() => '') : Promise.resolve('')),
  openExternal: (url, title) => (plugin ? plugin.openExternal({ url, title }) : Promise.reject(new Error('web'))),
  enterPip: () => (plugin ? plugin.enterPip() : Promise.reject(new Error('web'))),
  exit: () => (plugin ? plugin.exit().catch(() => {}) : Promise.resolve()),
};

const KEY = 'orientation';
export const getOrientation = () => { try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; } };
export const saveOrientation = (mode) => { try { localStorage.setItem(KEY, mode); } catch { /* storage unavailable */ } };
