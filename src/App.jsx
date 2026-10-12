import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { LogoTile } from './Logo.jsx';
import { useI18n } from './i18n.jsx';
import { activeAccountId, deleteAccount, loadAccounts, saveAccount, setActiveAccount } from './accounts.js';
import { createProvider } from './provider.js';
import { clearCache } from './useLoad.js';
import { useRemote } from './remote.jsx';
import { useLicense } from './license.jsx';
import Login from './Login.jsx';
import Intro, { getIntroSound, useIntro } from './Intro.jsx';
import { getOrientation, immersive } from './immersive.js';
import { TV_BACK_KEYS } from './tv.js';
import { ActivationGate, MaintenanceGate, OfflineGate, UpdateGate } from './Gate.jsx';
import Player from './Player.jsx';
import Detail from './Detail.jsx';
import Settings from './Settings.jsx';
import { Catalog, Home, Live } from './Pages.jsx';

const ICONS = {
  home: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
  live: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
  movies: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  series: '<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8M10 8l5 3-5 3z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
};
const TAB_FEATURE = { live: 'live', movies: 'movies', series: 'series' };

function Main() {
  const { t } = useI18n();
  const remote = useRemote();
  const lic = useLicense();
  const { config, mustUpdate } = remote;

  const [accounts, setAccounts] = useState(() => loadAccounts());
  const [activeId, setActiveId] = useState(() => activeAccountId());
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState('home');
  const [play, setPlay] = useState(null);
  const [detail, setDetail] = useState(null);
  const [epoch, setEpoch] = useState(0);

  const account = accounts.find((a) => a.id === activeId) || null;
  const api = useMemo(() => (account ? createProvider(account) : null), [account]);
  const tabs = ['home', 'live', 'movies', 'series', 'settings'].filter((k) => !TAB_FEATURE[k] || config.features[TAB_FEATURE[k]]);

  useEffect(() => { immersive.setOrientation(getOrientation()); }, []); // restore the screen direction chosen in Settings

  // Android back button / TV remote Back: close the player, then the sheet, then go Home, then exit.
  const backState = useRef({});
  backState.current = { play, detail, tab, adding, setPlay, setDetail, setTab, setAdding };
  useEffect(() => {
    const goBack = () => {
      const s = backState.current;
      if (s.play) s.setPlay(null);
      else if (s.detail) s.setDetail(null);
      else if (s.adding) s.setAdding(false);
      else if (s.tab !== 'home') s.setTab('home');
      else if (Capacitor.isNativePlatform()) NativeApp.exitApp();
      else if (window.tizen && window.tizen.application) window.tizen.application.getCurrentApplication().exit(); // Samsung TV
    };
    const sub = Capacitor.isNativePlatform() ? NativeApp.addListener('backButton', goBack) : null;
    // The Back key on Samsung and LG remotes arrives as a key press.
    const onKey = (e) => { if (TV_BACK_KEYS.has(e.keyCode)) { e.preventDefault(); goBack(); } };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); if (sub) sub.then((h) => h.remove()); };
  }, []);

  const playLive = useCallback((list, ch) => setPlay({ kind: 'live', list, index: Math.max(0, list.indexOf(ch)) }), []);
  const zap = useCallback((i) => setPlay((p) => (p && p.kind === 'live' ? { ...p, index: i } : p)), []);
  const nextEpisode = useCallback((i) => setPlay((p) => (p && p.queue ? { ...p.queue[i], queue: p.queue, qIndex: i } : p)), []);
  const openItem = useCallback((item, kind) => setDetail({ item, kind }), []);
  const playVod = (p) => { setDetail(null); setPlay(p); };

  // From "continue watching": rebuild what to play from the saved entry.
  const playEntry = useCallback((e) => setPlay({
    kind: 'vod', src: { kind: e.kind, id: e.id, ext: e.ext }, title: e.title, subtitle: e.subtitle, key: e.key,
    entry: { key: e.key, kind: e.kind, id: e.id, ext: e.ext, title: e.title, subtitle: e.subtitle, poster: e.poster, seriesId: e.seriesId },
  }), []);

  const onAddAccount = (acc) => {
    const saved = saveAccount(acc);
    setAccounts(loadAccounts()); setActiveId(saved.id); setAdding(false); setTab('home'); setPlay(null); setDetail(null);
  };
  const onSwitch = (id) => { setActiveAccount(id); setActiveId(id); setPlay(null); setDetail(null); setTab('home'); };
  const onDelete = (id) => {
    const rest = deleteAccount(id);
    setAccounts(rest);
    setActiveId(activeAccountId(rest));
    setPlay(null); setDetail(null);
  };

  // Gates come first: maintenance, forced update, then trial / activation.
  if (config.maintenance.on) return <MaintenanceGate config={config} retry={remote.refresh} />;
  if (mustUpdate) return <UpdateGate config={config} />;
  if (lic.loading) return <div className="boot" />;
  const status = lic.license && lic.license.status;
  if (status === 'offline') return <OfflineGate retry={lic.check} />;
  if (status === 'expired' || status === 'blocked') return <ActivationGate license={lic.license} deviceId={lic.deviceId} config={config} activate={lic.activate} />;

  if (!account) return <Login onDone={onAddAccount} />;
  if (adding) return <Login onDone={onAddAccount} onCancel={() => setAdding(false)} />;

  const nav = tabs.map((k) => (
    <button key={k} className="nav f" aria-current={k === tab ? 'page' : undefined} onClick={() => setTab(k)}>
      <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: ICONS[k] }} />
      <span>{t(k)}</span>
    </button>
  ));

  return (
    <div className="app">
      <nav className="rail" aria-label="Main"><div className="logo"><LogoTile size={52} withText={false} /></div>{nav}</nav>
      <main key={`${tab}-${activeId}-${epoch}`}>
        <header className="topbar"><h1>{t(tab)}</h1></header>
        {tab === 'home' && <Home api={api} goTab={setTab} playLive={playLive} playEntry={playEntry} openItem={openItem} remote={remote} license={lic.license} features={config.features} />}
        {tab === 'live' && <Live api={api} playLive={playLive} />}
        {tab === 'movies' && <Catalog api={api} kind="movie" openItem={openItem} />}
        {tab === 'series' && <Catalog api={api} kind="series" openItem={openItem} />}
        {tab === 'settings' && (
          <Settings api={api} accounts={accounts} activeId={activeId} onSwitch={onSwitch} onAdd={() => setAdding(true)} onDelete={onDelete}
            onClearCache={() => { clearCache(); setEpoch((n) => n + 1); }} remote={remote} lic={lic} />
        )}
      </main>
      <nav className="tabbar" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }} aria-label="Main">{nav}</nav>

      {detail && <Detail api={api} item={detail.item} kind={detail.kind} onPlay={playVod} onClose={() => setDetail(null)} />}
      {play && <Player api={api} play={play} features={config.features} onZap={zap} onNext={nextEpisode} onClose={() => setPlay(null)} />}
    </div>
  );
}

// The opening animation plays once per launch, over whatever screen is underneath.
export default function App() {
  const [intro, endIntro] = useIntro();
  return (
    <>
      <Main />
      {intro && <Intro sound={getIntroSound()} onDone={endIntro} />}
    </>
  );
}
