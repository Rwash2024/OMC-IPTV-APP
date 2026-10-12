import { useEffect, useState } from 'react';
import { ARCH, IPTV_PATH, OMC_BOX, OMC_PATH, RED } from './logoData.js';
import { playIntroSound } from './introSound.js';

const SHOW_MS = 2900;   // when the fade-out starts
const FADE_MS = 450;

// Opening animation: the arch draws itself, the bar drops in with a ripple, IPTV and OMC appear, then it fades out.
export default function Intro({ sound, onDone }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (sound) playIntroSound();
    const a = setTimeout(() => setLeaving(true), SHOW_MS);
    const b = setTimeout(onDone, SHOW_MS + FADE_MS);
    return () => { clearTimeout(a); clearTimeout(b); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => { setLeaving(true); setTimeout(onDone, 250); };
  const [x, y, w, h] = OMC_BOX;

  return (
    <div className={`intro${leaving ? ' leaving' : ''}`} onClick={skip} role="presentation">
      <svg className="intro-mark" viewBox="0 0 120 120" aria-hidden="true">
        <circle className="i-ripple" cx="60" cy="58" r="14" fill="none" stroke={RED} strokeWidth="2" />
        <path className="i-arch" d={ARCH} fill="none" stroke={RED} strokeWidth="11.5" pathLength="100" />
        <rect className="i-bar" x="54.6" y="41" width="10.8" height="34" rx="5.4" fill={RED} />
        <path className="i-iptv" d={IPTV_PATH} fill="#fff" />
      </svg>
      <svg className="intro-word" viewBox={`${x} ${y} ${w} ${h}`} aria-hidden="true">
        <path d={OMC_PATH} fill="#fff" />
      </svg>
    </div>
  );
}

export function useIntro() {
  const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [show, setShow] = useState(!reduce);
  return [show, () => setShow(false)];
}

const KEY = 'introSound';
export const getIntroSound = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
export const setIntroSound = (on) => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ } };
