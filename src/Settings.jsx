import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { APP_VERSION } from './config.js';
import { useI18n } from './i18n.jsx';
import { getIntroSound, setIntroSound } from './Intro.jsx';
import { getOrientation, immersive, isNative, saveOrientation } from './immersive.js';
import { clearPin, setHideAdult, setPin, useParental, verifyPin } from './parental.js';
import { usePrefs } from './prefs.js';
import { useLoad } from './useLoad.js';
import PinDialog from './PinDialog.jsx';
import { CopyButton, SupportLinks } from './Support.jsx';

function Section({ title, children }) {
  return (
    <section className="set-sec">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Toggle({ label, on, onChange, hint }) {
  return (
    <div className="toggle-row">
      <div><div>{label}</div>{hint ? <small className="note">{hint}</small> : null}</div>
      <button className="switch f" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}><i /></button>
    </div>
  );
}

function Seg({ value, options, onChange, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, text]) => <button key={v} className="f" aria-pressed={value === v} onClick={() => onChange(v)}>{text}</button>)}
    </div>
  );
}

export default function Settings({ api, accounts, activeId, onSwitch, onAdd, onDelete, onClearCache, remote, lic }) {
  const { t, lang, setLang, theme, setTheme } = useI18n();
  const [prefs, setPref] = usePrefs();
  const parental = useParental();
  const info = useLoad(`${api.id}|login`, () => api.login());
  const [snd, setSnd] = useState(getIntroSound);
  const [orient, setOrient] = useState(getOrientation);
  const [pin, setPinDialog] = useState(null);       // null | 'create' | 'disable' | 'change' | 'remove'
  const [confirmDel, setConfirmDel] = useState('');
  const [cacheMsg, setCacheMsg] = useState(false);
  const { config, updateAvailable } = remote;
  const license = lic.license || {};

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
  const accExpires = info.data && info.data.expires ? fmtDate(info.data.expires) : '—';
  const pickOrient = (m) => { setOrient(m); saveOrientation(m); immersive.setOrientation(m); };

  const planName = license.plan === 'lifetime' ? t('planLifetime') : license.plan === 'year' ? t('planYear') : license.plan === 'dev' ? 'Dev' : '—';
  const statusText = license.status === 'active' ? t('statusActive') : license.status === 'trial' ? t('statusTrial') : license.status || '—';
  const licenseUntil = license.status === 'active' ? (license.expiresAt ? fmtDate(license.expiresAt) : t('forever')) : license.trialEndsAt ? fmtDate(license.trialEndsAt) : '—';

  const diagnostics = [
    `OMC IPTV ${APP_VERSION}`,
    `Device: ${lic.deviceId}`,
    `Status: ${license.status} (${license.source || '-'})`,
    `Platform: ${Capacitor.getPlatform()}`,
    `Account type: ${api.kind}`,
    `UA: ${navigator.userAgent}`,
  ].join('\n');

  const onToggleAdult = (on) => {
    if (on) setHideAdult(true);
    else if (parental.hasPin) setPinDialog('disable');
    else setHideAdult(false);
  };

  return (
    <div className="panel settings">
      <Section title={t('accounts')}>
        <div className="acc-list">
          {accounts.map((a) => (
            <div key={a.id} className={`acc${a.id === activeId ? ' on' : ''}`}>
              <button className="acc-main f" onClick={() => onSwitch(a.id)} aria-pressed={a.id === activeId}>
                <b>{a.name || a.id}</b>
                <small className="ltr">{a.type === 'm3u' ? 'M3U' : `Xtream · ${a.username}`}</small>
              </button>
              {confirmDel === a.id
                ? <button className="btn danger f" onClick={() => { setConfirmDel(''); onDelete(a.id); }}>{t('confirmDelete')}</button>
                : <button className="btn f" onClick={() => setConfirmDel(a.id)} aria-label={t('deleteAccount')}>🗑</button>}
            </div>
          ))}
        </div>
        <button className="btn f" onClick={onAdd}>＋ {t('addAccount')}</button>
        {api.kind === 'xtream' && <dl className="kv"><dt>{t('expires')}</dt><dd>{accExpires}</dd>{info.data && info.data.maxConnections ? (<><dt>{t('conns')}</dt><dd>{info.data.maxConnections}</dd></>) : null}</dl>}
      </Section>

      <Section title={t('licenseTitle')}>
        <dl className="kv">
          <dt>{t('status')}</dt><dd>{statusText}</dd>
          <dt>{t('plan')}</dt><dd>{planName}</dd>
          <dt>{license.status === 'trial' ? t('trialEnds') : t('validUntil')}</dt><dd>{licenseUntil}</dd>
          <dt>{t('deviceId')}</dt><dd className="ltr">{lic.deviceId}</dd>
        </dl>
        <CopyButton text={lic.deviceId}>{t('copyDeviceId')}</CopyButton>
      </Section>

      <Section title={t('language')}>
        <Seg value={lang} options={[['ar', 'عربي'], ['en', 'English']]} onChange={setLang} label={t('language')} />
      </Section>
      <Section title={t('theme')}>
        <Seg value={theme} options={[['system', t('themeSystem')], ['dark', t('themeDark')], ['light', t('themeLight')]]} onChange={setTheme} label={t('theme')} />
      </Section>
      {isNative && (
        <Section title={t('orientation')}>
          <Seg value={orient} options={[['auto', t('orientAuto')], ['landscape', t('orientLandscape')], ['portrait', t('orientPortrait')]]} onChange={pickOrient} label={t('orientation')} />
        </Section>
      )}

      <Section title={t('playerSettings')}>
        <div className="field-row"><span>{t('bufferSize')}</span>
          <Seg value={prefs.buffer} options={[['small', t('bufSmall')], ['normal', t('bufNormal')], ['large', t('bufLarge')]]} onChange={(v) => setPref('buffer', v)} label={t('bufferSize')} /></div>
        <small className="note">{t('bufferHint')}</small>
        <Toggle label={t('autoNext')} on={prefs.autoNext} onChange={(v) => setPref('autoNext', v)} />
        <Toggle label={t('resumeSetting')} on={prefs.resume} onChange={(v) => setPref('resume', v)} />
        <Toggle label={t('introSound')} on={snd} onChange={(v) => { setSnd(v); setIntroSound(v); }} />
      </Section>

      {config.features.parental && (
        <Section title={t('parental')}>
          <Toggle label={t('hideAdult')} on={parental.hideAdult} onChange={onToggleAdult} hint={parental.hasPin ? t('hideAdultPin') : t('hideAdultNoPin')} />
          <div className="row-actions">
            {!parental.hasPin && <button className="btn f" onClick={() => setPinDialog('create')}>{t('setPin')}</button>}
            {parental.hasPin && <button className="btn f" onClick={() => setPinDialog('change')}>{t('changePin')}</button>}
            {parental.hasPin && <button className="btn danger f" onClick={() => setPinDialog('remove')}>{t('removePin')}</button>}
          </div>
        </Section>
      )}

      <Section title={t('about')}>
        <dl className="kv">
          <dt>{t('version')}</dt><dd className="ltr">{APP_VERSION}</dd>
        </dl>
        {updateAvailable && config.updateUrl && <a className="btn primary f" href={config.updateUrl} target="_blank" rel="noreferrer">{t('updateAvailable')} · {t('downloadUpdate')}</a>}
        <button className="btn f" onClick={remote.refresh}>{t('checkUpdate')}</button>
        <SupportLinks config={config} deviceId={lic.deviceId} />
        <div className="row-actions">
          {config.links.privacy && <a className="link-text f" href={config.links.privacy} target="_blank" rel="noreferrer">{t('privacy')}</a>}
          {config.links.terms && <a className="link-text f" href={config.links.terms} target="_blank" rel="noreferrer">{t('terms')}</a>}
        </div>
        <div className="row-actions">
          <button className="btn f" onClick={() => { onClearCache(); setCacheMsg(true); setTimeout(() => setCacheMsg(false), 1800); }}>{cacheMsg ? t('cacheCleared') : t('clearCache')}</button>
          <CopyButton text={diagnostics}>{t('copyDiagnostics')}</CopyButton>
        </div>
        {import.meta.env.DEV && <p className="note small">{t('devNote')}</p>}
      </Section>

      {pin === 'create' && <PinDialog mode="create" onCancel={() => setPinDialog(null)} onCreate={async (p) => { await setPin(p); setPinDialog(null); }} />}
      {pin === 'change' && <PinDialog mode="verify" onCancel={() => setPinDialog(null)} onVerify={async (p) => { const ok = await verifyPin(p); if (ok) setPinDialog('create'); return ok; }} />}
      {pin === 'disable' && <PinDialog mode="verify" onCancel={() => setPinDialog(null)} onVerify={async (p) => { const ok = await verifyPin(p); if (ok) { setHideAdult(false); setPinDialog(null); } return ok; }} />}
      {pin === 'remove' && <PinDialog mode="verify" onCancel={() => setPinDialog(null)} onVerify={async (p) => { const ok = await verifyPin(p); if (ok) { clearPin(); setPinDialog(null); } return ok; }} />}
    </div>
  );
}
