// Smart TV support (Samsung Tizen, LG webOS): remote control keys, arrow-key navigation, and the TV's own device id.
import { isTV, isTizen, isWebOS } from './platform.js';

export const TV_BACK_KEYS = new Set([10009, 461]); // Tizen Back, webOS Back
export const KEY = { PLAY: 415, PAUSE: 19, PLAY_PAUSE: 10252, STOP: 413, FF: 417, REW: 412, INFO: 457, YELLOW: 405 };

// ---------- device id ----------
function lunaCall(uri, params) {
  return new Promise((resolve, reject) => {
    try {
      const bridge = new window.PalmServiceBridge();
      const timer = setTimeout(() => reject(new Error('timeout')), 3000);
      bridge.onservicecallback = (msg) => { clearTimeout(timer); try { resolve(JSON.parse(msg)); } catch (e) { reject(e); } };
      bridge.call(uri, JSON.stringify(params));
    } catch (e) { reject(e); }
  });
}

// Returns the TV's MAC address (Samsung) as 12 hex digits, or another stable id (LG), or '' when unavailable.
export async function tvDeviceId() {
  try {
    if (isTizen && window.webapis) {
      try {
        const mac = String(window.webapis.network.getMac() || '').replace(/[^0-9a-fA-F]/g, '');
        if (mac.length === 12) return mac.toUpperCase();
      } catch { /* fall through to the DUID */ }
      return String(window.webapis.productinfo.getDuid() || '');
    }
    if (isWebOS) {
      const res = await lunaCall('luna://com.webos.service.sm/deviceid/getIDs', { idType: ['LGUDID'] });
      const item = (res.idList || []).find((x) => x.idType === 'LGUDID');
      return item ? String(item.idValue) : '';
    }
  } catch { /* the caller falls back to a generated id */ }
  return '';
}

// ---------- arrow-key navigation ----------
const FOCUSABLE = '.f, a[href], button:not([disabled]), input[type=range]';
const visible = (el) => el.offsetParent !== null || el === document.activeElement;

function scopeEl() {
  return document.querySelector('.track-panel') || document.querySelector('.player') || document.querySelector('.pin')
    || document.querySelector('.sheet') || document;
}

function move(dir) {
  const items = [...scopeEl().querySelectorAll(FOCUSABLE)].filter(visible);
  const cur = document.activeElement;
  if (!items.includes(cur)) { if (items[0]) items[0].focus(); return; }
  const a = cur.getBoundingClientRect();
  const ac = [a.left + a.width / 2, a.top + a.height / 2];
  const horizontal = dir === 'ArrowLeft' || dir === 'ArrowRight';
  let best = null, bestScore = Infinity;
  for (const el of items) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const dx = b.left + b.width / 2 - ac[0], dy = b.top + b.height / 2 - ac[1];
    const ok = dir === 'ArrowRight' ? dx > 4 : dir === 'ArrowLeft' ? dx < -4 : dir === 'ArrowDown' ? dy > 4 : dy < -4;
    if (!ok) continue;
    const main = horizontal ? Math.abs(dx) : Math.abs(dy);
    const cross = horizontal ? Math.abs(dy) : Math.abs(dx);
    const score = main + cross * 2.5;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) { best.focus(); best.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
}

function onKey(e) {
  if (e.defaultPrevented) return;
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const t = e.target;
  if (t && t.tagName === 'INPUT' && t.type !== 'range') return; // arrows move the caret in text boxes
  e.preventDefault();
  move(e.key);
}

export function initTv() {
  if (!isTV) return;
  document.documentElement.classList.add('tv');
  if (isTizen && window.tizen && window.tizen.tvinputdevice) {
    ['MediaPlay', 'MediaPause', 'MediaPlayPause', 'MediaStop', 'MediaFastForward', 'MediaRewind', 'Info', 'ColorF2Yellow'].forEach((k) => {
      try { window.tizen.tvinputdevice.registerKey(k); } catch { /* key not available on this TV */ }
    });
  }
  window.addEventListener('keydown', onKey);
}
