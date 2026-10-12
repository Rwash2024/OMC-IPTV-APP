// Favourites, resume positions and recently watched channels. Kept per account on this device.
import { useEffect, useState } from 'react';
import { createSignal, readJSON, writeJSON } from './store.js';

const signal = createSignal();
const key = (acc) => 'lib:' + acc;
const empty = () => ({ fav: {}, prog: {}, recent: [] });
const read = (acc) => ({ ...empty(), ...readJSON(key(acc), {}) });
const write = (acc, lib) => { writeJSON(key(acc), lib); signal.emit(); };

const MAX_RECENT = 20;
const MAX_PROG = 60;

export const favKey = (kind, id) => `${kind}:${id}`;

export const library = {
  get: read,

  isFav(acc, kind, id) { return !!read(acc).fav[favKey(kind, id)]; },

  // item: { kind: 'live'|'movie'|'series', id, name, icon, ext? }
  toggleFav(acc, item) {
    const lib = read(acc);
    const k = favKey(item.kind, item.id);
    if (lib.fav[k]) delete lib.fav[k]; else lib.fav[k] = { ...item, at: Date.now() };
    write(acc, lib);
    return !!lib.fav[k];
  },

  pushRecent(acc, ch) {
    const lib = read(acc);
    lib.recent = [{ ...ch, at: Date.now() }, ...lib.recent.filter((c) => c.id !== ch.id)].slice(0, MAX_RECENT);
    write(acc, lib);
  },

  progress(acc, k) { return read(acc).prog[k] || null; },

  // entry: { key, kind: 'movie'|'episode', id, ext, title, subtitle, poster, seriesId?, pos, dur }
  saveProgress(acc, entry) {
    if (!entry.dur || !isFinite(entry.dur)) return;
    const lib = read(acc);
    if (entry.pos / entry.dur >= 0.95) delete lib.prog[entry.key];
    else if (entry.pos >= 10) lib.prog[entry.key] = { ...entry, at: Date.now() };
    else return;
    const keep = Object.values(lib.prog).sort((a, b) => b.at - a.at).slice(0, MAX_PROG);
    lib.prog = Object.fromEntries(keep.map((e) => [e.key, e]));
    write(acc, lib);
  },

  clearProgress(acc, k) { const lib = read(acc); delete lib.prog[k]; write(acc, lib); },
};

// Re-renders when anything changes. Returns the current library and the account id helpers.
export function useLibrary(acc) {
  const [, tick] = useState(0);
  useEffect(() => signal.subscribe(() => tick((n) => n + 1)), []);
  const lib = acc ? read(acc) : empty();
  return {
    favorites: Object.values(lib.fav).sort((a, b) => b.at - a.at),
    favSet: new Set(Object.keys(lib.fav)),
    recent: lib.recent,
    continueList: Object.values(lib.prog).sort((a, b) => b.at - a.at).slice(0, 20),
    progress: lib.prog,
  };
}
