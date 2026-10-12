import { useEffect, useState } from 'react';
import { createSignal, readJSON, writeJSON } from './store.js';

// App preferences kept on the device.
const KEY = 'prefs';
const signal = createSignal();
export const DEFAULT_PREFS = {
  buffer: 'normal',   // small | normal | large: how much video is loaded ahead
  autoNext: true,     // play the next episode when one ends
  resume: true,       // continue movies and episodes where they stopped
};

export const getPrefs = () => ({ ...DEFAULT_PREFS, ...readJSON(KEY, {}) });
export function setPref(name, value) {
  writeJSON(KEY, { ...getPrefs(), [name]: value });
  signal.emit();
}

export function usePrefs() {
  const [, tick] = useState(0);
  useEffect(() => signal.subscribe(() => tick((n) => n + 1)), []);
  return [getPrefs(), setPref];
}

// How many seconds of video hls.js keeps ahead of the playhead.
export const BUFFER_SECONDS = { small: 12, normal: 30, large: 90 };
