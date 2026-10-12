import { useState } from 'react';
import { useI18n } from './i18n.jsx';

const hueOf = (key) => { let h = 7; for (const c of String(key)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
export const grad = (key) => { const h = hueOf(key); return `linear-gradient(155deg, hsl(${h} 62% 38%), hsl(${(h + 50) % 360} 70% 16%))`; };

// Remote artwork with a gradient + initial fallback when a provider has no image or it fails to load.
export function Art({ src, name, className = '' }) {
  const [bad, setBad] = useState(false);
  return (
    <div className={`art ${className}`} style={{ background: grad(name) }} data-initial={(name || '?').trim()[0]}>
      {src && !bad ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} /> : null}
    </div>
  );
}

export function Heart({ on, onClick, className = '' }) {
  const { t } = useI18n();
  return (
    <button className={`heart f ${className}`} aria-pressed={on} aria-label={on ? t('removeFav') : t('addFav')}
      onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 21s-7-4.6-9.3-9.1C1.1 8.6 3 5 6.5 5c2 0 3.6 1.1 5.5 3.2C13.900 6.100 15.500 5 17.500 5 21 5 22.900 8.600 21.300 11.900 19 16.400 12 21 12 21z" /></svg>
    </button>
  );
}

// progress: 0..1 shows a resume bar.
export function Poster({ item, kind, onOpen, fav, onFav, progress }) {
  const name = item.name;
  return (
    <div className="poster-wrap">
      <button className="poster f" onClick={() => onOpen(item, kind)} aria-label={name}>
        <Art src={kind === 'series' ? item.cover : item.stream_icon} name={name} />
        {progress != null && <span className="bar"><i style={{ width: `${Math.round(progress * 100)}%` }} /></span>}
        <span className="poster-title">{name}</span>
      </button>
      {onFav && <Heart on={!!fav} onClick={onFav} />}
    </div>
  );
}

export function ChannelRow({ ch, onPlay, fav, onFav }) {
  return (
    <div className="ch-item">
      <button className="ch-row f" onClick={() => onPlay(ch)}>
        <Art src={ch.stream_icon} name={ch.name} className="logo" />
        <span className="ch-name">{ch.name}</span>
        <span className="badge live">LIVE</span>
      </button>
      {onFav && <Heart on={!!fav} onClick={onFav} className="inline" />}
    </div>
  );
}

export function Chips({ items, value, onChange, allLabel, favLabel }) {
  return (
    <div className="chips" role="group">
      <button className="chip f" aria-pressed={value === ''} onClick={() => onChange('')}>{allLabel}</button>
      {favLabel && <button className="chip f" aria-pressed={value === 'fav'} onClick={() => onChange('fav')}>♥ {favLabel}</button>}
      {items.map((c) => (
        <button key={c.category_id} className="chip f" aria-pressed={value === String(c.category_id)} onClick={() => onChange(String(c.category_id))}>{c.category_name}</button>
      ))}
    </div>
  );
}

export function State({ s, children }) {
  const { t } = useI18n();
  if (s.loading) return <p className="note">{t('loading')}</p>;
  if (s.error) return <div className="note"><p>{t('loadErr')}</p><button className="btn f" onClick={s.retry}>{t('retry')}</button></div>;
  return children;
}

export function SearchBox({ value, onChange }) {
  const { t } = useI18n();
  return (
    <label className="search">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
      <input type="search" placeholder={t('search')} value={value} onChange={(e) => onChange(e.target.value)} aria-label={t('search')} />
    </label>
  );
}

export function Banner({ level = 'info', title, children, onClose, action }) {
  return (
    <div className={`banner ${level}`} role="status">
      <div className="banner-text">
        {title ? <b>{title}</b> : null}
        {children ? <span>{children}</span> : null}
      </div>
      {action}
      {onClose ? <button className="banner-x f" onClick={onClose} aria-label="Close">✕</button> : null}
    </div>
  );
}
