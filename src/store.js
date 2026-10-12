// Tiny helpers for values kept on the device. Every read and write is guarded because storage can be unavailable.
const mem = new Map();

export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? (mem.has(key) ? mem.get(key) : fallback) : JSON.parse(raw);
  } catch { return mem.has(key) ? mem.get(key) : fallback; }
}

export function writeJSON(key, value) {
  mem.set(key, value);
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* kept in memory only */ }
}

export function removeKey(key) {
  mem.delete(key);
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// A store other components can subscribe to, so a change in one place (a favourite, a setting) updates every view.
export function createSignal() {
  const subs = new Set();
  return {
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    emit() { subs.forEach((fn) => fn()); },
  };
}
