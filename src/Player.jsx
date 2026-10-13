import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Capacitor } from '@capacitor/core';
import NativeLoader from './nativeLoader.js';
import { immersive, isNative } from './immersive.js';
import { useI18n } from './i18n.jsx';
import { favKey, library, useLibrary } from './library.js';
import { BUFFER_SECONDS, usePrefs } from './prefs.js';
import { toEntry } from './Pages.jsx';
import { KEY } from './tv.js';

const fmt = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
};
const hhmm = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const SPEEDS = [1, 1.25, 1.5, 2, 0.75];
const SLEEP = [0, 15, 30, 60, 90];

/*
 * play = { kind:'live', list, index }
 *      | { kind:'vod', src:{kind:'movie'|'episode', id, ext}, title, subtitle, key, entry, queue?, qIndex? }
 */
export default function Player({ api, play, features, onZap, onNext, onClose }) {
  const { t } = useI18n();
  const [prefs] = usePrefs();
  const lib = useLibrary(api.id);
  const ref = useRef(null);
  const shell = useRef(null);
  const hlsRef = useRef(null);
  const idleTimer = useRef(0);
  const toastTimer = useRef(0);
  const last = useRef({ pos: 0, dur: 0 });
  const [err, setErr] = useState(false);
  const [why, setWhy] = useState('');
  const [paused, setPaused] = useState(false);
  const [time, setTime] = useState({ cur: 0, dur: 0 });
  const [idle, setIdle] = useState(false);
  const [toast, setToast] = useState('');
  const [epg, setEpg] = useState([]);
  const [landscape, setLandscape] = useState(isNative); // on Android the player opens in full-screen landscape
  const [fill, setFill] = useState(false);              // false = whole picture, true = zoom to fill the screen
  const [tracks, setTracks] = useState({ audio: [], subs: [], audioSel: -1, subSel: -1 });
  const [panel, setPanel] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [sleepIdx, setSleepIdx] = useState(0);
  const [sleepLeft, setSleepLeft] = useState(0);        // seconds

  const live = play.kind === 'live';
  const ch = live ? play.list[play.index] : null;
  const url = live ? api.url('live', ch.stream_id) : api.url(play.src.kind, play.src.id, play.src.ext);
  const rawUrl = live ? api.raw('live', ch.stream_id) : api.raw(play.src.kind, play.src.id, play.src.ext);
  const title = live ? ch.name : play.title;
  const sub = live ? '' : play.subtitle;
  const isFav = live && lib.favSet.has(favKey('live', ch.stream_id));

  const say = useCallback((m) => { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 1400); }, []);
  const wake = useCallback(() => { setIdle(false); clearTimeout(idleTimer.current); idleTimer.current = setTimeout(() => setIdle(true), 3500); }, []);

  // Audio and subtitle tracks, from hls.js or from the video element itself.
  const readTracks = useCallback(() => {
    const hls = hlsRef.current;
    const v = ref.current;
    if (hls) {
      setTracks({
        audio: hls.audioTracks.map((x, i) => ({ i, name: x.name || x.lang || `${t('audio')} ${i + 1}` })),
        subs: hls.subtitleTracks.map((x, i) => ({ i, name: x.name || x.lang || `${t('subtitles')} ${i + 1}` })),
        audioSel: hls.audioTrack, subSel: hls.subtitleTrack,
      });
    } else if (v) {
      const aud = v.audioTracks ? [...v.audioTracks].map((x, i) => ({ i, name: x.label || x.language || `${t('audio')} ${i + 1}`, on: x.enabled })) : [];
      const txt = [...v.textTracks].filter((x) => x.kind === 'subtitles' || x.kind === 'captions').map((x, i) => ({ i, name: x.label || x.language || `${t('subtitles')} ${i + 1}`, on: x.mode === 'showing' }));
      setTracks({ audio: aud, subs: txt, audioSel: aud.findIndex((a) => a.on), subSel: txt.findIndex((a) => a.on) });
    }
  }, [t]);

  // Attach the stream.
  useEffect(() => {
    const v = ref.current; if (!v) return undefined;
    setErr(false); setWhy(''); setTime({ cur: 0, dur: 0 }); setTracks({ audio: [], subs: [], audioSel: -1, subSel: -1 });
    let hls;
    // Error details help tell a bad format from a blocked or missing stream. Login details are masked.
    const shape = url.replace(/^https?:\/\/[^/]+/i, '').replace(/\/(live|movie|series)\/[^/]+\/[^/]+\//i, '/$1/***/***/');
    const secs = BUFFER_SECONDS[prefs.buffer] || 30;
    if (/\.m3u8(\?|$)/i.test(url) && Hls.isSupported()) {
      // In the Android WebView the background worker can fail, and CORS needs the native loader.
      const native = Capacitor.isNativePlatform();
      hls = new Hls({ enableWorker: !native, maxBufferLength: secs, maxMaxBufferLength: secs * 2, ...(native ? { loader: NativeLoader } : {}) });
      hlsRef.current = hls;
      hls.subtitleDisplay = true;
      hls.on(Hls.Events.ERROR, (_, d) => {
        if (!d.fatal) return;
        const msg = d.error && d.error.message ? ` / ${d.error.message}` : d.reason ? ` / ${d.reason}` : '';
        setWhy(`hls.js ${d.type} / ${d.details}${d.response ? ' / HTTP ' + d.response.code : ''}${msg} / ${shape}`);
        setErr(true);
      });
      [Hls.Events.MANIFEST_PARSED, Hls.Events.AUDIO_TRACKS_UPDATED, Hls.Events.SUBTITLE_TRACKS_UPDATED, Hls.Events.AUDIO_TRACK_SWITCHED, Hls.Events.SUBTITLE_TRACK_SWITCH]
        .forEach((e) => hls.on(e, readTracks));
      hls.loadSource(url);
      hls.attachMedia(v);
    } else {
      hlsRef.current = null;
      v.onerror = () => {
        const e = v.error;
        setWhy(`video MEDIA_ERR ${e ? e.code : '?'}${e && e.message ? ' / ' + e.message : ''} / ${shape}`);
      };
      v.src = url;
    }
    v.play().catch(() => { /* autoplay may need a tap; controls stay available */ });
    return () => { if (hls) hls.destroy(); hlsRef.current = null; v.onerror = null; v.removeAttribute('src'); v.load(); };
  }, [url, prefs.buffer, readTracks]);

  // Now / next from the guide.
  useEffect(() => {
    if (!live) { setEpg([]); return undefined; }
    let alive = true;
    api.epg(ch.stream_id).then((e) => alive && setEpg(e)).catch(() => alive && setEpg([]));
    return () => { alive = false; };
  }, [live, ch && ch.stream_id, api]); // eslint-disable-line react-hooks/exhaustive-deps

  // Remember watched channels.
  useEffect(() => {
    if (live) library.pushRecent(api.id, { id: ch.stream_id, name: ch.name, icon: ch.stream_icon });
  }, [live, ch && ch.stream_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save where a movie or episode stopped, every 10 seconds and when leaving.
  const saveNow = useCallback((finished) => {
    if (live || !play.entry) return;
    const { pos, dur } = last.current;
    if (dur) library.saveProgress(api.id, { ...play.entry, pos: finished ? dur : pos, dur });
  }, [live, play, api]);
  useEffect(() => {
    if (live) return undefined;
    const iv = setInterval(() => saveNow(false), 10000);
    const onHide = () => saveNow(false);
    window.addEventListener('pagehide', onHide);
    return () => { clearInterval(iv); window.removeEventListener('pagehide', onHide); saveNow(false); };
  }, [live, saveNow]);

  const toggle = useCallback(() => { const v = ref.current; if (!v) return; if (v.paused) v.play().catch(() => {}); else v.pause(); }, []);
  const seekBy = useCallback((d) => { const v = ref.current; if (!v || live) return; v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + d)); say((d > 0 ? '+' : '−') + Math.abs(d) + 's'); }, [live, say]);
  const zap = useCallback((d) => { if (!live) return; const n = play.list.length; const i = (play.index + d + n) % n; onZap(i); say(play.list[i].name); }, [live, play, onZap, say]);

  // Full screen: on Android rotate and hide the system bars (native plugin); in a browser use the Fullscreen API.
  useEffect(() => {
    if (!isNative) return undefined;
    immersive.enter();
    return () => { immersive.exit(); };
  }, []);
  const full = useCallback(() => {
    if (isNative) {
      if (landscape) { immersive.exit(); setLandscape(false); } else { immersive.enter(); setLandscape(true); }
      return;
    }
    const el = shell.current;
    (document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen()).catch(() => say(t('fullscreen')));
  }, [landscape, say, t]);

  // Speed.
  useEffect(() => { const v = ref.current; if (v && !live) v.playbackRate = SPEEDS[speedIdx]; }, [speedIdx, live, url]);

  // Sleep timer: closes the player when it runs out.
  useEffect(() => {
    if (!sleepLeft) return undefined;
    const iv = setInterval(() => setSleepLeft((s) => { if (s <= 1) { clearInterval(iv); onClose(); return 0; } return s - 1; }), 1000);
    return () => clearInterval(iv);
  }, [sleepLeft > 0, onClose]); // eslint-disable-line react-hooks/exhaustive-deps
  const cycleSleep = () => {
    const i = (sleepIdx + 1) % SLEEP.length;
    setSleepIdx(i); setSleepLeft(SLEEP[i] * 60);
    say(SLEEP[i] ? `${t('sleepIn')} ${SLEEP[i]} ${t('minutes')}` : t('sleepOff'));
  };

  const chooseAudio = (i) => {
    const hls = hlsRef.current; const v = ref.current;
    if (hls) hls.audioTrack = i; else if (v && v.audioTracks) [...v.audioTracks].forEach((x, k) => { x.enabled = k === i; });
    setTimeout(readTracks, 50);
  };
  const chooseSub = (i) => {
    const hls = hlsRef.current; const v = ref.current;
    if (hls) hls.subtitleTrack = i;
    else if (v) [...v.textTracks].filter((x) => x.kind === 'subtitles' || x.kind === 'captions').forEach((x, k) => { x.mode = k === i ? 'showing' : 'disabled'; });
    setTimeout(readTracks, 50);
  };

  // Touch gestures on the picture: swipe up/down on the left half = brightness, right half = volume,
  // double tap on the left/right half = back/forward 10 s. A single tap still pauses (after a short wait, to tell it from a double tap).
  const gesture = useRef(null);
  const tap = useRef({ t: 0, side: '', timer: 0 });
  const lastTouch = useRef(0);
  useEffect(() => () => clearTimeout(tap.current.timer), []);

  const setLevel = (kind, v) => {
    if (kind === 'volume') { if (isNative) immersive.setVolume(v); else if (ref.current) ref.current.volume = v; }
    else immersive.setBrightness(v);
    say(`${kind === 'volume' ? (v === 0 ? '🔇' : '🔊') : '☀'} ${Math.round(v * 100)}%`);
  };
  const onTouchStartVideo = (e) => {
    if (e.touches.length !== 1) { gesture.current = null; return; }
    const p = e.touches[0];
    const r = e.currentTarget.getBoundingClientRect();
    gesture.current = { x: p.clientX, y: p.clientY, side: p.clientX < r.left + r.width / 2 ? 'left' : 'right', h: r.height, mode: '', ready: false, start: 0 };
  };
  const onTouchMoveVideo = (e) => {
    const g = gesture.current; if (!g || e.touches.length !== 1) return;
    const p = e.touches[0];
    const dy = p.clientY - g.y, dx = p.clientX - g.x;
    if (!g.mode) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 14) return;
      if (Math.abs(dx) >= Math.abs(dy) || (g.side === 'left' && !isNative)) { g.mode = 'none'; return; } // brightness only exists in the Android app
      g.mode = g.side === 'left' ? 'brightness' : 'volume';
      g.y = p.clientY;
      const read = g.mode === 'volume' ? (isNative ? immersive.getVolume() : Promise.resolve(ref.current ? ref.current.volume : 1)) : immersive.getBrightness();
      read.then((v) => { g.start = v; g.ready = true; });
      return;
    }
    if (g.mode === 'none' || !g.ready) return;
    const lo = g.mode === 'brightness' ? 0.02 : 0;
    const v = Math.max(lo, Math.min(1, g.start - (p.clientY - g.y) / (g.h * 0.7)));
    if (g.last !== undefined && Math.abs(v - g.last) < 0.01) return;
    g.last = v;
    setLevel(g.mode, v);
  };
  const onTouchEndVideo = () => {
    const g = gesture.current; gesture.current = null;
    lastTouch.current = Date.now();
    if (!g || g.mode) return; // it was a swipe, not a tap
    const tp = tap.current;
    if (live) { toggle(); return; }
    const now = Date.now();
    if (tp.timer && now - tp.t < 300 && tp.side === g.side) {
      clearTimeout(tp.timer); tp.timer = 0;
      seekBy(g.side === 'left' ? -10 : 10);
      return;
    }
    clearTimeout(tp.timer);
    tp.t = now; tp.side = g.side;
    tp.timer = setTimeout(() => { tp.timer = 0; toggle(); }, 280);
  };
  // A touch already acted in onTouchEnd; only mouse clicks (and the TV remote's OK) arrive here.
  const onClickVideo = () => { if (Date.now() - lastTouch.current > 700) toggle(); };

  const openExternal = () => immersive.openExternal(rawUrl, title).catch(() => say(t('noExternal')));
  const pip = () => immersive.enterPip().catch(() => say(t('pipUnavailable')));

  useEffect(() => {
    wake();
    const onKey = (e) => {
      wake();
      const onRange = e.target && e.target.type === 'range';
      const code = e.keyCode;
      if (e.key === 'Escape') { if (panel) return setPanel(false); return onClose(); }
      // TV remote media keys.
      if (code === KEY.PLAY) { const v = ref.current; if (v) v.play().catch(() => {}); return; }
      if (code === KEY.PAUSE) { const v = ref.current; if (v) v.pause(); return; }
      if (code === KEY.PLAY_PAUSE) return toggle();
      if (code === KEY.STOP) return onClose();
      if (code === KEY.FF) return seekBy(30);
      if (code === KEY.REW) return seekBy(-10);
      if (code === KEY.INFO || code === KEY.YELLOW) { const b = shell.current && shell.current.querySelector('.controls .big'); if (b) b.focus(); return; }
      if (e.key === ' ' && e.target.tagName !== 'BUTTON') { e.preventDefault(); return toggle(); }
      if (e.key === 'f') return full();
      // OK on the picture itself: pause or resume, and put the focus on the controls so the arrows can reach them.
      if (e.key === 'Enter' && !(e.target.closest && e.target.closest('button, input, a'))) {
        toggle();
        const b = shell.current && shell.current.querySelector('.controls .big');
        if (b) b.focus();
        return;
      }
      // While a control is focused the arrow keys move between controls instead of seeking or changing channel.
      const onControls = e.target.closest && e.target.closest('.p-bottom, .p-top, .track-panel');
      if (onControls && !onRange) return;
      if (live) {
        if (e.key === 'PageUp' || e.key === 'ChannelUp' || (!onRange && e.key === 'ArrowUp')) { e.preventDefault(); return zap(-1); }
        if (e.key === 'PageDown' || e.key === 'ChannelDown' || (!onRange && e.key === 'ArrowDown')) { e.preventDefault(); return zap(1); }
      } else if (!onRange) {
        if (e.key === 'ArrowRight') { e.preventDefault(); return seekBy(10); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); return seekBy(-10); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(idleTimer.current); clearTimeout(toastTimer.current); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  }, [live, toggle, zap, seekBy, full, onClose, wake, panel]);

  const now = Date.now();
  const cur = epg.find((e) => e.start <= now && now < e.end) || epg[0];
  const nxt = cur ? epg.find((e) => e.start >= cur.end) : null;
  const hasTracks = tracks.audio.length > 1 || tracks.subs.length > 0;
  const hasNext = !live && play.queue && play.qIndex + 1 < play.queue.length;

  return (
    <div className={`player${idle && !panel ? ' idle' : ''}`} ref={shell} onMouseMove={wake} onTouchStart={wake}>
      <video ref={ref} playsInline autoPlay style={{ objectFit: fill ? 'cover' : 'contain' }}
        onPlay={() => setPaused(false)} onPause={() => setPaused(true)}
        onLoadedMetadata={(e) => {
          readTracks();
          // Continue where the last viewing stopped.
          const v = e.target;
          if (!live && prefs.resume && play.key && isFinite(v.duration)) {
            const p = library.progress(api.id, play.key);
            if (p && p.pos > 10 && p.pos < v.duration * 0.95) { v.currentTime = p.pos; say(`${t('resumeFrom')} ${fmt(p.pos)}`); }
          }
        }}
        onTimeUpdate={(e) => { const v = e.target; setTime({ cur: v.currentTime, dur: v.duration }); if (!live) last.current = { pos: v.currentTime, dur: v.duration }; }}
        onEnded={() => {
          if (live) return;
          saveNow(true);
          if (hasNext && prefs.autoNext) onNext(play.qIndex + 1);
        }}
        onError={() => setErr(true)} onPlaying={() => setErr(false)} onClick={onClickVideo}
        onTouchStart={onTouchStartVideo} onTouchMove={onTouchMoveVideo} onTouchEnd={onTouchEndVideo} onTouchCancel={() => { gesture.current = null; }} />

      <div className="p-top">
        <button className="icon-btn f" onClick={onClose} aria-label={t('back')}>‹</button>
        <div className="p-title">
          <b>{title}</b>
          <span>{live ? (cur ? `${t('now')}: ${cur.title} · ${hhmm(cur.start)}–${hhmm(cur.end)}${nxt ? `   ${t('next')}: ${nxt.title}` : ''}` : '') : sub}</span>
        </div>
        {live ? <span className="badge live">LIVE</span> : <span />}
      </div>

      <div className="p-center">
        {err ? (
          <div className="p-msg">{t('playErr')}{why ? <small className="ltr p-why">{why}</small> : null}
            {isNative && features.externalPlayer && <button className="btn f p-ext" onClick={openExternal}>{t('openExternal')}</button>}
          </div>
        ) : toast ? <div className="p-toast">{toast}</div> : null}
      </div>

      {panel && (
        <div className="track-panel" onClick={() => setPanel(false)}>
          <div className="track-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('audioSubs')}>
            {tracks.audio.length > 1 && (
              <div><h4>{t('audio')}</h4>
                {tracks.audio.map((a) => <button key={a.i} className="f" aria-pressed={tracks.audioSel === a.i} onClick={() => chooseAudio(a.i)}>{a.name}</button>)}</div>
            )}
            {tracks.subs.length > 0 && (
              <div><h4>{t('subtitles')}</h4>
                <button className="f" aria-pressed={tracks.subSel === -1} onClick={() => chooseSub(-1)}>{t('off')}</button>
                {tracks.subs.map((a) => <button key={a.i} className="f" aria-pressed={tracks.subSel === a.i} onClick={() => chooseSub(a.i)}>{a.name}</button>)}</div>
            )}
          </div>
        </div>
      )}

      <div className="p-bottom">
        {!live && (
          <div className="seekline">
            <span>{fmt(time.cur)}</span>
            <input type="range" min="0" max="1000" aria-label="Seek" value={time.dur ? Math.round((time.cur / time.dur) * 1000) : 0}
              onChange={(e) => { const v = ref.current; if (v && time.dur) v.currentTime = (e.target.value / 1000) * time.dur; }} />
            <span>{fmt(time.dur)}</span>
          </div>
        )}
        <div className="controls">
          {live ? <button className="icon-btn f" onClick={() => zap(-1)} aria-label={t('prevCh')}>▲</button> : <button className="icon-btn f" onClick={() => seekBy(-10)} aria-label="-10s">⟲10</button>}
          <button className="icon-btn big f" onClick={toggle} aria-label={paused ? t('resume') : t('pause')}>{paused ? '▶' : '❚❚'}</button>
          {live ? <button className="icon-btn f" onClick={() => zap(1)} aria-label={t('nextCh')}>▼</button> : <button className="icon-btn f" onClick={() => seekBy(10)} aria-label="+10s">10⟳</button>}
          {hasNext && <button className="icon-btn f" onClick={() => onNext(play.qIndex + 1)} aria-label={t('nextEpisode')}>⏭</button>}
        </div>
        <div className="controls minor">
          <button className="icon-btn sm f" onClick={full} aria-label={t('fullscreen')}>⛶</button>
          <button className="icon-btn sm f" onClick={() => { setFill(!fill); say(fill ? t('fitWhole') : t('fitFill')); }} aria-label={t('fitFill')} aria-pressed={fill}>⤢</button>
          {hasTracks && <button className="icon-btn sm f" onClick={() => setPanel(true)} aria-label={t('audioSubs')}>CC</button>}
          {!live && <button className="icon-btn sm f" onClick={() => setSpeedIdx((speedIdx + 1) % SPEEDS.length)} aria-label={t('speed')}>{SPEEDS[speedIdx]}x</button>}
          <button className="icon-btn sm f" onClick={cycleSleep} aria-label={t('sleepTimer')} aria-pressed={sleepLeft > 0}>☾{sleepLeft ? ` ${Math.ceil(sleepLeft / 60)}` : ''}</button>
          {live && <button className="icon-btn sm f" onClick={() => library.toggleFav(api.id, toEntry('live', ch))} aria-label={isFav ? t('removeFav') : t('addFav')} aria-pressed={isFav}>{isFav ? '♥' : '♡'}</button>}
          {isNative && <button className="icon-btn sm f" onClick={pip} aria-label={t('pip')}>⧉</button>}
          {isNative && features.externalPlayer && <button className="icon-btn sm f" onClick={openExternal} aria-label={t('openExternal')}>↗</button>}
        </div>
      </div>
    </div>
  );
}
