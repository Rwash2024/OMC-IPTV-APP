import { useEffect, useMemo, useState } from 'react';
import { useI18n } from './i18n.jsx';
import { useLoad } from './useLoad.js';
import { favKey, library, useLibrary } from './library.js';
import { toEntry } from './Pages.jsx';
import { Art, Heart } from './ui.jsx';

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function Detail({ api, item, kind, onPlay, onClose }) {
  const { t } = useI18n();
  const isMovie = kind === 'movie';
  const id = isMovie ? item.stream_id : item.series_id;
  const s = useLoad(`${api.id}|${kind}-info|${id}`, () => (isMovie ? api.vodInfo(id) : api.seriesInfo(id)));
  const lib = useLibrary(api.id);
  const info = (s.data && s.data.info) || {};
  const plot = info.plot || info.description || item.plot || '';
  const rating = info.rating || item.rating;
  const [season, setSeason] = useState(null);
  const fav = lib.favSet.has(favKey(kind, id));

  const eps = s.data && s.data.episodes && !Array.isArray(s.data.episodes) ? s.data.episodes : {};
  const seasons = Object.keys(eps).sort((a, b) => Number(a) - Number(b));
  const cur = season ?? seasons[0];

  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Every episode in order, so "next episode" can continue across seasons.
  const queue = useMemo(() => seasons.flatMap((sn) => (eps[sn] || []).map((e) => {
    const key = `ep:${e.id}`;
    const subtitle = `${t('season')} ${sn} · ${t('episode')} ${e.episode_num}${e.title ? ' · ' + e.title : ''}`;
    return {
      kind: 'vod', src: { kind: 'episode', id: e.id, ext: e.container_extension }, title: item.name, subtitle, key,
      entry: { key, kind: 'episode', id: e.id, ext: e.container_extension, title: item.name, subtitle, poster: item.cover, seriesId: id },
    };
  })), [eps, seasons, item, id, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const playAt = (i) => onPlay({ ...queue[i], queue, qIndex: i });
  const movieKey = `movie:${id}`;
  const moviePlay = () => onPlay({
    kind: 'vod', src: { kind: 'movie', id, ext: item.container_extension }, title: item.name, subtitle: String(info.releasedate || info.releaseDate || '').slice(0, 4), key: movieKey,
    entry: { key: movieKey, kind: 'movie', id, ext: item.container_extension, title: item.name, subtitle: '', poster: item.stream_icon },
  });

  // For a series, the button resumes the episode watched most recently, or starts at episode 1.
  const lastIdx = queue.reduce((best, q, i) => {
    const p = lib.progress[q.key];
    return p && (best < 0 || p.at > lib.progress[queue[best].key].at) ? i : best;
  }, -1);
  const mainProgress = isMovie ? lib.progress[movieKey] : (lastIdx >= 0 ? lib.progress[queue[lastIdx].key] : null);

  return (
    <div className="sheet-wrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={item.name}>
        <div className="sheet-head">
          <Art src={isMovie ? item.stream_icon : item.cover} name={item.name} className="cover" />
          <button className="icon-btn f close" onClick={onClose} aria-label={t('close')}>✕</button>
          <h2>{item.name}</h2>
          <div className="meta">
            {rating ? <span>★ {Number(rating).toFixed ? Number(rating).toFixed(1) : rating}</span> : null}
            {info.genre ? <span>{info.genre}</span> : null}
            {info.releasedate || info.releaseDate ? <span>{String(info.releasedate || info.releaseDate).slice(0, 4)}</span> : null}
          </div>
        </div>
        <div className="sheet-body">
          {plot ? <p>{plot}</p> : null}
          <div className="actions">
            {isMovie ? (
              <button className="btn primary f" onClick={moviePlay}>▶ {mainProgress ? `${t('resumeFrom')} ${mmss(mainProgress.pos)}` : t('play')}</button>
            ) : queue.length > 0 ? (
              <button className="btn primary f" onClick={() => playAt(Math.max(0, lastIdx))}>▶ {lastIdx >= 0 ? t('continueEp') : t('play')}</button>
            ) : null}
            <Heart on={fav} onClick={() => library.toggleFav(api.id, toEntry(kind, item))} className="inline big" />
          </div>
          {!isMovie && (s.loading ? <p className="note">{t('loading')}</p> : (
            <>
              <div className="chips">
                {seasons.map((n) => <button key={n} className="chip f" aria-pressed={n === cur} onClick={() => setSeason(n)}>{t('season')} {n}</button>)}
              </div>
              <div className="ep-list">
                {(eps[cur] || []).map((e) => {
                  const i = queue.findIndex((q) => q.entry.id === e.id);
                  const p = lib.progress[`ep:${e.id}`];
                  return (
                    <button key={e.id} className="ep f" onClick={() => playAt(i)}>
                      <em>{e.episode_num}</em>
                      <b>{e.title || `${t('episode')} ${e.episode_num}`}</b>
                      <span>{p ? `${mmss(p.pos)} / ${mmss(p.dur)}` : (e.info && e.info.duration) || ''}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ))}
        </div>
      </div>
    </div>
  );
}
