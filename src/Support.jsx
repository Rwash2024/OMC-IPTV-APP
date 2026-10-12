import { useState } from 'react';
import { useI18n } from './i18n.jsx';
import { isTV } from './platform.js';

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
    return ok;
  }
}

export function CopyButton({ text, className = 'btn f', children }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <button type="button" className={className} onClick={async () => { if (await copyText(text)) { setDone(true); setTimeout(() => setDone(false), 1500); } }}>
      {done ? t('copied') : children}
    </button>
  );
}

// One big WhatsApp button. Activation goes through WhatsApp only, so this is all the activation screen shows for contact.
export function WhatsAppButton({ config, deviceId, label }) {
  const { t } = useI18n();
  const number = String((config.support || {}).whatsapp || '').replace(/\D/g, '');
  if (!number) return null;
  // A TV has no browser or WhatsApp, so show the number to message from a phone.
  if (isTV) return <div className="wa-btn tv-number"><span>{label}</span><b className="ltr">+{number}</b></div>;
  const href = `https://wa.me/${number}?text=${encodeURIComponent(`${t('supportMsg')} ${deviceId}`)}`;
  return <a className="wa-btn f" href={href} target="_blank" rel="noreferrer">{label}</a>;
}

// Contact buttons built from the remote config. The device id is added to the WhatsApp message so support can find the device.
export function SupportLinks({ config, deviceId }) {
  const { t } = useI18n();
  const s = config.support || {};
  const links = [];
  if (s.whatsapp) links.push(['whatsapp', t('whatsapp'), `https://wa.me/${String(s.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(`${t('supportMsg')} ${deviceId}`)}`]);
  if (s.telegram) links.push(['telegram', t('telegram'), `https://t.me/${String(s.telegram).replace('@', '')}`]);
  if (s.phone) links.push(['phone', s.phone, `tel:${s.phone}`]);
  if (s.email) links.push(['email', s.email, `mailto:${s.email}`]);
  if (!links.length) return null;
  if (isTV) return <div className="support tv-support">{links.map(([k, label, href]) => <span key={k} className="ltr">{k === 'whatsapp' ? '+' + String(s.whatsapp).replace(/\D/g, '') : label}</span>)}</div>;
  return (
    <div className="support">
      {links.map(([k, label, href]) => (
        <a key={k} className="btn f" href={href} target="_blank" rel="noreferrer">{label}</a>
      ))}
    </div>
  );
}
