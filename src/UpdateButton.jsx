import { useState } from 'react';
import { installApk } from './appUpdater.js';
import { useI18n } from './i18n.jsx';
import { isTV } from './platform.js';

// "Update now": downloads the APK inside the app and opens the installer. In a browser it opens the link.
export default function UpdateButton({ config, className = 'btn primary f', label }) {
  const { t } = useI18n();
  const [pct, setPct] = useState(null);
  const [error, setError] = useState('');
  if (!config.updateUrl || isTV) return null; // TVs update through their own store or by reinstalling

  async function run() {
    setError(''); setPct(0);
    const res = await installApk(config.updateUrl, config.apkSha256, setPct);
    setPct(null);
    if (!res.ok) setError(res.error === 'PERMISSION' ? t('allowInstall') : res.error === 'CHECKSUM' ? t('updateCorrupt') : t('updateFailed'));
  }

  return (
    <span className="update-wrap">
      <button type="button" className={className} onClick={run} disabled={pct !== null}>
        {pct !== null ? `${t('downloading')} ${pct}%` : (label || t('updateNow'))}
      </button>
      {error ? <small className="err" role="alert">{error}</small> : null}
    </span>
  );
}
