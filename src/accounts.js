// Saved service accounts (Xtream login or M3U link). They stay on this device. Several can be saved and switched.
import { readJSON, removeKey, writeJSON } from './store.js';

const LIST = 'accounts';
const ACTIVE = 'activeAccount';

const newId = () => (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : String(Date.now()));

// Older versions saved a single login as 'session'. Bring it over once.
function migrate() {
  const legacy = readJSON('session', null) || (() => { try { return JSON.parse(sessionStorage.getItem('session')); } catch { return null; } })();
  if (!legacy || !legacy.server) return;
  const acc = { id: newId(), type: 'xtream', name: new URL(legacy.server).host, ...legacy };
  writeJSON(LIST, [acc]);
  writeJSON(ACTIVE, acc.id);
  removeKey('session');
  try { sessionStorage.removeItem('session'); } catch { /* ignore */ }
}

export function loadAccounts() {
  if (!readJSON(LIST, null)) migrate();
  return readJSON(LIST, []);
}

export function activeAccountId(list = loadAccounts()) {
  const id = readJSON(ACTIVE, null);
  return list.some((a) => a.id === id) ? id : (list[0] ? list[0].id : null);
}

export function saveAccount(account) {
  const list = loadAccounts();
  const acc = { ...account, id: account.id || newId() };
  const next = list.some((a) => a.id === acc.id) ? list.map((a) => (a.id === acc.id ? acc : a)) : [...list, acc];
  writeJSON(LIST, next);
  writeJSON(ACTIVE, acc.id);
  return acc;
}

export function setActiveAccount(id) { writeJSON(ACTIVE, id); }

export function deleteAccount(id) {
  const next = loadAccounts().filter((a) => a.id !== id);
  writeJSON(LIST, next);
  removeKey('lib:' + id);
  if (readJSON(ACTIVE, null) === id) writeJSON(ACTIVE, next[0] ? next[0].id : null);
  return next;
}
