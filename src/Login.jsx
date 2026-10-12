import { useState } from 'react';
import { LogoTile, Wordmark } from './Logo.jsx';
import { useI18n } from './i18n.jsx';
import { normalizeServer } from './xtream.js';
import { createProvider } from './provider.js';

// Add a service account: Xtream login or M3U link. Shown on first launch and from Settings > Accounts.
export default function Login({ onDone, onCancel }) {
  const { t, lang, setLang } = useI18n();
  const [type, setType] = useState('xtream');
  const [f, setF] = useState({ name: '', server: '', username: '', password: '', url: '' });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErr({ ...err, [k]: '', all: '' }); };

  async function submit(e) {
    e.preventDefault();
    const next = {};
    let account;
    if (type === 'xtream') {
      let server = '';
      try { server = normalizeServer(f.server); } catch { next.server = t('eSrv'); }
      if (!f.username.trim()) next.username = t('eUsr');
      if (!f.password.trim()) next.password = t('ePwd');
      // Pasted values often carry a trailing space or newline, so trim.
      account = { type, server, username: f.username.trim(), password: f.password.trim(), name: f.name.trim() || (server ? new URL(server).host : '') };
    } else {
      const url = f.url.trim();
      if (!/^https?:\/\/\S+$/i.test(url)) next.url = t('eM3u');
      account = { type, url, name: f.name.trim() || (next.url ? '' : new URL(url).host) };
    }
    if (Object.keys(next).length) { setErr(next); return; }

    setBusy(true); setErr({});
    try {
      await createProvider({ ...account, id: 'probe' }).login();
      onDone(account);
    } catch (ex) {
      const m = ex && ex.message;
      setErr({ all: m === 'AUTH' ? t('eAuth') : m === 'EXPIRED' ? t('eExpired') : m === 'BAD_RESPONSE' ? t('eBad') : t('eNet') });
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="top-line">
          {onCancel ? <button type="button" className="pill" onClick={onCancel}>{t('back')}</button> : <span />}
          <button type="button" className="pill" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{lang === 'ar' ? 'EN' : 'عربي'}</button>
        </div>
        <div className="brand">
          <LogoTile size={104} />
          <div className="wordmark"><Wordmark height={30} /></div>
          <h1>{t('welcome')}</h1>
          <p>{t('sub')}</p>
        </div>

        <div className="seg center-seg" role="group" aria-label={t('accountType')}>
          <button type="button" className="f" aria-pressed={type === 'xtream'} onClick={() => { setType('xtream'); setErr({}); }}>{t('typeXtream')}</button>
          <button type="button" className="f" aria-pressed={type === 'm3u'} onClick={() => { setType('m3u'); setErr({}); }}>{t('typeM3u')}</button>
        </div>

        <form onSubmit={submit} noValidate autoComplete="off">
          {type === 'xtream' ? (
            <>
              <Field id="server" label={t('server')} error={err.server}>
                <input id="server" className="ltr" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck="false" placeholder="http://example.com:8080"
                  value={f.server} onChange={set('server')} aria-invalid={!!err.server} />
              </Field>
              <Field id="username" label={t('user')} error={err.username}>
                <input id="username" className="ltr" autoCapitalize="none" autoCorrect="off" spellCheck="false"
                  value={f.username} onChange={set('username')} aria-invalid={!!err.username} />
              </Field>
              <Field id="password" label={t('pass')} error={err.password}>
                <div className="with-eye">
                  <input id="password" className="ltr" type={show ? 'text' : 'password'} autoCapitalize="none" autoCorrect="off" spellCheck="false"
                    value={f.password} onChange={set('password')} aria-invalid={!!err.password} />
                  <button type="button" className="eye" onClick={() => setShow(!show)} aria-label={t('showPass')} aria-pressed={show}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
                  </button>
                </div>
              </Field>
            </>
          ) : (
            <Field id="url" label={t('m3uUrl')} error={err.url}>
              <input id="url" className="ltr" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck="false" placeholder="http://example.com/playlist.m3u"
                value={f.url} onChange={set('url')} aria-invalid={!!err.url} />
            </Field>
          )}
          <Field id="name" label={t('accountName')} error="">
            <input id="name" value={f.name} onChange={set('name')} />
          </Field>
          <button className="cta" type="submit" disabled={busy}>{busy ? t('connecting') : t('signin')}</button>
          {err.all && <div className="err center" role="alert">{err.all}</div>}
        </form>

        <div className="help">{t('help')}</div>
      </div>
    </div>
  );
}

function Field({ id, label, error, children }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? <div className="err" role="alert">{error}</div> : null}
    </div>
  );
}
