import { useCallback, useEffect, useState } from 'react';
import { useI18n } from './i18n.jsx';

/*
 * 4-digit PIN pad.
 * mode "verify": calls onVerify(pin) -> Promise<boolean>.
 * mode "create": asks twice, then calls onCreate(pin).
 */
export default function PinDialog({ mode = 'verify', title, onVerify, onCreate, onCancel }) {
  const { t } = useI18n();
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const finish = useCallback(async (value) => {
    setBusy(true);
    if (mode === 'verify') {
      const ok = await onVerify(value);
      if (!ok) { setError(t('pinWrong')); setPin(''); }
    } else if (!first) {
      setFirst(value); setPin('');
    } else if (value === first) {
      await onCreate(value);
    } else {
      setError(t('pinMismatch')); setPin(''); setFirst('');
    }
    setBusy(false);
  }, [mode, first, onVerify, onCreate, t]);

  const press = useCallback((d) => {
    if (busy) return;
    setError('');
    setPin((p) => {
      if (p.length >= 4) return p;
      const next = p + d;
      if (next.length === 4) setTimeout(() => finish(next), 120);
      return next;
    });
  }, [busy, finish]);

  useEffect(() => {
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
      else if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, onCancel]);

  const heading = title || (mode === 'create' ? (first ? t('pinConfirm') : t('pinNew')) : t('pinEnter'));

  return (
    <div className="sheet-wrap" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="pin" role="dialog" aria-modal="true" aria-label={heading}>
        <h3>{heading}</h3>
        <div className="pin-dots" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <span key={i} className={i < pin.length ? 'on' : ''} />)}
        </div>
        <div className="pin-err" role="alert">{error}</div>
        <div className="pin-pad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} className="f" onClick={() => press(d)}>{d}</button>)}
          <button className="f" onClick={onCancel} aria-label={t('close')}>✕</button>
          <button className="f" onClick={() => press('0')}>0</button>
          <button className="f" onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Backspace">⌫</button>
        </div>
      </div>
    </div>
  );
}
