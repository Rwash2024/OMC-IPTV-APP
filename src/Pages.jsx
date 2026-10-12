import { useMemo, useState } from 'react';
import { useI18n } from './i18n.jsx';
import { useLoad } from './useLoad.js';
import { library, favKey, useLibrary } from './library.js';
import { isAdultCategory, useParental } from './parental.js';
import { readJSON, writeJSON } from './store.js';
import { Banner, Chips, ChannelRow, Poster, SearchBox, State } from './ui.jsx';

const STEP = 60;
const key = (api, k) => `${api.id}|${k}`;
const asList = (d) => (Array.isArray(d) ? d : []);

// Item shapes <-> saved favourite entries.
export const toEntry = (kind, it) => ({
  kind,
  id: kind === 'series' ? it.series_id : it.stream_id,
  name: it.name,
  icon: kind === 'series' ? it.cover : it.stream_icon,
  ...(kind === 'movie' ? { ext: it.container_extension } : {}),
});
export const entryToItem = (e) => (e.kind === 'series'
  ? { series_id: e.id, name: e.name, cover: e.icon }
  : { stream_id: e.id, name: e.name, stream_icon: e.icon, container_extension: e.ext });

const CAT_LOADERS = { live: (a) => a.liveCategories(), movie: (a) => a.vodCategories(), series: (a) => a.seriesCategories() };
const LIST_LOADERS = { live: (a) => a.live(), movie: (a) => a.vod(), series: (a) => a.series() };
const LIST_KEYS = { live: 'live', movie: 'vod', series: 'series' };

function useCats(api, kind) { return useLoad(key(api, kind + '-cats'), () => CAT_LOADERS[kind](api)); }
function useItems(api, kind) { return useLoad(key(api, LIST_KEYS[kind]), () => LIST_LOADERS[kind](api)); }

// Items from adult categories are dropped while "hide adult content" is on.
function useVisible(api, kind) {
  const items = useItems(api, kind);
  const cats = useCats(api, kind);
  const { hideAdult } = useParental();
  const adult = useMemo(
    () => new Set(hideAdult ? asList(cats.data).filter((c) => isAdultCategory(c.category_name)).map((c) => String(c.category_id)) : []),
    [cats.data, hideAdult],
  );
  const data = useMemo(() => (adult.size ? asList(items.data).filter((i) => !adult.has(String(i.category_id))) : asList(items.data)), [items.data, adult]);
  return { items, cats, adult, data };
}

function useFav(api) {
  const lib = useLibrary(api.id);
  return {
    lib,
    isFav: (kind, id) => lib.favSet.has(favKey(kind, id)),
    toggle: (kind, item) => library.toggleFav(api.id, toEntry(kind, item)),
  };
}

export function Home({ api, goTab, playLive, playEntry, openItem, remote, license, features }) {
  const { t } = useI18n();
  const live = useVisible(api, 'live');
  const vod = useVisible(api, 'movie');
  const ser = useVisible(api, 'series');
  const { lib, isFav, toggle } = useFav(api);
  const [dismissed, setDismissed] = useState(() => readJSON('dismissedNotice', null));
  const { config, updateAvailable } = remote;
  const notice = config.notice && config.notice.id !== dismissed ? config.notice : null;
  const trialSoon = license && license.status === 'trial' && license.daysLeft != null && license.daysLeft <= 14;
  const favLive = lib.favorites.filter((f) => f.kind === 'live').map(entryToItem);
  const favOther = lib.favorites.filter((f) => f.kind !== 'live');

  return (
    <>
      {notice && (
        <Banner level={notice.level} title={notice.title} onClose={() => { writeJSON('dismissedNotice', notice.id); setDismissed(notice.id); }}>{notice.body}</Banner>
      )}
      {updateAvailable && config.updateUrl && (
        <Banner level="info" title={t('updateAvailable')} action={<a className="btn f" href={config.updateUrl} target="_blank" rel="noreferrer">{t('downloadUpdate')}</a>} />
      )}
      {trialSoon && <Banner level="warning" title={t('trialLeft').replace('{n}', license.daysLeft)}>{t('trialHint')}</Banner>}

      {lib.continueList.length > 0 && (
        <section className="row"><div className="row-head"><h3>{t('continueWatching')}</h3></div>
          <div className="hscroll">{lib.continueList.map((e) => (
            <Poster key={e.key} item={{ name: e.title, stream_icon: e.poster, stream_id: e.id }} kind="movie" onOpen={() => playEntry(e)} progress={e.pos / e.dur} />
          ))}</div></section>
      )}
      {favLive.length > 0 && features.live && (
        <section className="row"><div className="row-head"><h3>{t('favoriteChannels')}</h3></div>
          <div className="hscroll">{favLive.map((c) => <ChannelRow key={c.stream_id} ch={c} onPlay={(ch) => playLive(favLive, ch)} fav onFav={() => toggle('live', c)} />)}</div></section>
      )}
      {favOther.length > 0 && (
        <section className="row"><div className="row-head"><h3>{t('favorites')}</h3></div>
          <div className="hscroll">{favOther.map((e) => { const it = entryToItem(e); return <Poster key={favKey(e.kind, e.id)} item={it} kind={e.kind} onOpen={openItem} fav onFav={() => toggle(e.kind, it)} />; })}</div></section>
      )}
      {lib.recent.length > 0 && features.live && (
        <section className="row"><div className="row-head"><h3>{t('recentChannels')}</h3></div>
          <div className="hscroll">{lib.recent.slice(0, 8).map((c) => {
            const it = { stream_id: c.id, name: c.name, stream_icon: c.icon };
            return <ChannelRow key={c.id} ch={it} onPlay={(ch) => playLive(lib.recent.map((r) => ({ stream_id: r.id, name: r.name, stream_icon: r.icon })), ch)} fav={isFav('live', c.id)} onFav={() => toggle('live', it)} />;
          })}</div></section>
      )}

      {features.live && (
        <Row title={t('liveNow')} onMore={() => goTab('live')} s={live.items}>
          <div className="hscroll">{live.data.slice(0, 14).map((c) => <ChannelRow key={c.stream_id} ch={c} onPlay={(ch) => playLive(live.data, ch)} fav={isFav('live', c.stream_id)} onFav={() => toggle('live', c)} />)}</div>
        </Row>
      )}
      {features.movies && (
        <Row title={t('popularMovies')} onMore={() => goTab('movies')} s={vod.items}>
          <div className="hscroll">{vod.data.slice(0, 20).map((m) => <Poster key={m.stream_id} item={m} kind="movie" onOpen={openItem} fav={isFav('movie', m.stream_id)} onFav={() => toggle('movie', m)} />)}</div>
        </Row>
      )}
      {features.series && (
        <Row title={t('newSeries')} onMore={() => goTab('series')} s={ser.items}>
          <div className="hscroll">{ser.data.slice(0, 20).map((m) => <Poster key={m.series_id} item={m} kind="series" onOpen={openItem} fav={isFav('series', m.series_id)} onFav={() => toggle('series', m)} />)}</div>
        </Row>
      )}
    </>
  );
}

function Row({ title, onMore, s, children }) {
  return (
    <section className="row">
      <div className="row-head"><h3>{title}</h3><button className="link f" onClick={onMore}>›</button></div>
      <State s={s}>{children}</State>
    </section>
  );
}

function filterItems(list, cat, q, kind, favSet) {
  const needle = q.trim().toLowerCase();
  return list.filter((i) => {
    if (cat === 'fav') { if (!favSet.has(favKey(kind, kind === 'series' ? i.series_id : i.stream_id))) return false; }
    else if (cat && String(i.category_id) !== cat) return false;
    return !needle || String(i.name).toLowerCase().includes(needle);
  });
}

export function Live({ api, playLive }) {
  const { t } = useI18n();
  const { items, cats, adult, data } = useVisible(api, 'live');
  const { lib, isFav, toggle } = useFav(api);
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(STEP);
  const list = useMemo(() => filterItems(data, cat, q, 'live', lib.favSet), [data, cat, q, lib.favSet]);
  const shownCats = asList(cats.data).filter((c) => !adult.has(String(c.category_id)));
  return (
    <>
      <div className="page-tools"><SearchBox value={q} onChange={(v) => { setQ(v); setLimit(STEP); }} /></div>
      <State s={cats}><Chips items={shownCats} value={cat} onChange={(v) => { setCat(v); setLimit(STEP); }} allLabel={t('all')} favLabel={t('favorites')} /></State>
      <State s={items}>
        {list.length ? (
          <div className="ch-list">{list.slice(0, limit).map((c) => <ChannelRow key={c.stream_id} ch={c} onPlay={(ch) => playLive(list, ch)} fav={isFav('live', c.stream_id)} onFav={() => toggle('live', c)} />)}</div>
        ) : <p className="note">{t('empty')}</p>}
        {list.length > limit && <button className="btn f center-btn" onClick={() => setLimit(limit + STEP)}>{t('more')}</button>}
      </State>
    </>
  );
}

export function Catalog({ api, kind, openItem }) {
  const { t } = useI18n();
  const { items, cats, adult, data } = useVisible(api, kind);
  const { lib, isFav, toggle } = useFav(api);
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(STEP);
  const list = useMemo(() => filterItems(data, cat, q, kind, lib.favSet), [data, cat, q, kind, lib.favSet]);
  const shownCats = asList(cats.data).filter((c) => !adult.has(String(c.category_id)));
  return (
    <>
      <div className="page-tools"><SearchBox value={q} onChange={(v) => { setQ(v); setLimit(STEP); }} /></div>
      <State s={cats}><Chips items={shownCats} value={cat} onChange={(v) => { setCat(v); setLimit(STEP); }} allLabel={t('all')} favLabel={t('favorites')} /></State>
      <State s={items}>
        {list.length ? (
          <div className="grid">{list.slice(0, limit).map((m) => {
            const id = kind === 'series' ? m.series_id : m.stream_id;
            return <Poster key={id} item={m} kind={kind} onOpen={openItem} fav={isFav(kind, id)} onFav={() => toggle(kind, m)} />;
          })}</div>
        ) : <p className="note">{t('empty')}</p>}
        {list.length > limit && <button className="btn f center-btn" onClick={() => setLimit(limit + STEP)}>{t('more')}</button>}
      </State>
    </>
  );
}
