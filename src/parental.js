import { useEffect, useState } from 'react';
import { createSignal, readJSON, writeJSON } from './store.js';

// Parental control: a PIN, and hiding adult categories. The PIN is stored only as a salted hash.
const KEY = 'parental';
const signal = createSignal();
const ADULT = /adult|xxx|porn|sex|erotic|\b18\s*\+|\+\s*18|للكبار|بالغين|اباح|إباح/i;

const read = () => ({ hideAdult: true, salt: '', hash: '', ...readJSON(KEY, {}) });
const save = (s) => { writeJSON(KEY, s); signal.emit(); };

async function hashPin(pin, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const isAdultCategory = (name) => ADULT.test(String(name || ''));
export const hasPin = () => !!read().hash;

export async function setPin(pin) {
  const salt = crypto.getRandomValues(new Uint32Array(2)).join('');
  save({ ...read(), salt, hash: await hashPin(pin, salt) });
}
export async function verifyPin(pin) {
  const s = read();
  return !!s.hash && (await hashPin(pin, s.salt)) === s.hash;
}
export function clearPin() { save({ ...read(), salt: '', hash: '' }); }
export function setHideAdult(on) { save({ ...read(), hideAdult: on }); }

export function useParental() {
  const [, tick] = useState(0);
  useEffect(() => signal.subscribe(() => tick((n) => n + 1)), []);
  const s = read();
  return { hideAdult: s.hideAdult, hasPin: !!s.hash };
}
