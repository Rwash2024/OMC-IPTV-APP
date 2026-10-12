import { useState } from 'react';
import { LogoTile } from './Logo.jsx';
import { useI18n } from './i18n.jsx';
import UpdateButton from './UpdateButton.jsx';
import { CopyButton, SupportLinks, WhatsAppButton } from './Support.jsx';

// Full-screen blockers shown before the app: update required, maintenance, no connection, activation.
function Shell({ children }) {
  const { lang, setLang } = useI18n();
  return (
    <div className="login-page">
      <div className="login-card gate">
        <div className="top-line">
          <span />
          <button type="button" className="pill" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{lang === 'ar' ? 'EN' : 'عربي'}</button>
        </div>
        <div className="brand"><LogoTile size={88} /></div>
        {children}
      </div>
    </div>
  );
}

export function UpdateGate({ config }) {
  const { t } = useI18n();
  return (
    <Shell>
      <h1 className="gate-title">{t('updateRequired')}</h1>
      <p className="gate-text">{t('updateRequiredText')}</p>
      <UpdateButton config={config} className="cta gate-btn" label={t('updateNow')} />
      <SupportLinks config={config} deviceId="" />
    </Shell>
  );
}

export function MaintenanceGate({ config, retry }) {
  const { t } = useI18n();
  return (
    <Shell>
      <h1 className="gate-title">{t('maintenance')}</h1>
      <p className="gate-text">{config.maintenance.message || t('maintenanceText')}</p>
      <button className="cta" onClick={retry}>{t('retry')}</button>
    </Shell>
  );
}

export function OfflineGate({ retry }) {
  const { t } = useI18n();
  return (
    <Shell>
      <h1 className="gate-title">{t('needInternet')}</h1>
      <p className="gate-text">{t('needInternetText')}</p>
      <button className="cta" onClick={retry}>{t('retry')}</button>
    </Shell>
  );
}

const ERRORS = { invalid_code: 'codeInvalid', used: 'codeUsed', revoked: 'codeRevoked', blocked: 'deviceBlocked', network: 'eNet', too_many_attempts: 'tooMany', already_lifetime: 'alreadyLifetime' };

export function ActivationGate({ license, deviceId, config, activate }) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const blocked = license.status === 'blocked';

  async function submit(e) {
    e.preventDefault();
    if (!code.trim()) { setError(t('codeEmpty')); return; }
    setBusy(true); setError('');
    const res = await activate(code);
    if (!res.ok) { setError(t(ERRORS[res.error] || 'codeInvalid')); setBusy(false); }
  }

  return (
    <Shell>
      <h1 className="gate-title">{blocked ? t('deviceBlocked') : t('trialEnded')}</h1>
      <p className="gate-text">{blocked ? (license.message || t('contactSupport')) : (config.texts.activationHelp || t('activationHelp'))}</p>

      <div className="device-box">
        <span className="device-label">{t('deviceId')}</span>
        <b className="ltr device-id">{deviceId}</b>
        <CopyButton text={deviceId}>{t('copy')}</CopyButton>
      </div>

      {!blocked && (
        <form onSubmit={submit} noValidate autoComplete="off">
          <div className="field">
            <label htmlFor="code">{t('activationCode')}</label>
            <input id="code" className="ltr" autoCapitalize="characters" autoCorrect="off" spellCheck="false" placeholder="XXXX-XXXX-XXXX"
              value={code} onChange={(e) => { setCode(e.target.value); setError(''); }} aria-invalid={!!error} />
            {error ? <div className="err" role="alert">{error}</div> : null}
          </div>
          <button className="cta" type="submit" disabled={busy}>{busy ? t('connecting') : t('activate')}</button>
        </form>
      )}

      <WhatsAppButton config={config} deviceId={deviceId} label={blocked ? t('contactWhatsapp') : t('activateWhatsapp')} />
    </Shell>
  );
}
