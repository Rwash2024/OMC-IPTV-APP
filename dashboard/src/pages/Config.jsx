import { useEffect, useState } from 'react';
import { supabase } from '../supabase.js';

const VERSION = /^\d+(\.\d+){0,2}$/;
const FEATURES = [['live', 'القنوات المباشرة'], ['movies', 'الأفلام'], ['series', 'المسلسلات'], ['parental', 'الرقابة الأبوية'], ['externalPlayer', 'زر المشغّل الخارجي']];

function Field({ label, hint, children }) {
  return <label className="field">{label}{children}{hint ? <small className="muted">{hint}</small> : null}</label>;
}

export default function Config() {
  const [cfg, setCfg] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('app_config').select('config').eq('id', 1).single().then(({ data, error: e }) => {
      if (e || !data) { setError('تعذّر تحميل الإعدادات'); return; }
      const c = data.config || {};
      setCfg({
        minVersion: c.minVersion || '0.0.0', latestVersion: c.latestVersion || '0.0.0', updateUrl: c.updateUrl || '',
        maintenance: { on: !!(c.maintenance && c.maintenance.on), message: (c.maintenance && c.maintenance.message) || '' },
        notice: c.notice || null, noticeId: c.notice ? c.notice.id : null,
        noticeTitle: (c.notice && c.notice.title) || '', noticeBody: (c.notice && c.notice.body) || '', noticeLevel: (c.notice && c.notice.level) || 'info',
        support: { whatsapp: '', phone: '', email: '', telegram: '', ...(c.support || {}) },
        links: { privacy: '', terms: '', ...(c.links || {}) },
        features: { live: true, movies: true, series: true, parental: true, externalPlayer: true, ...(c.features || {}) },
        graceDays: c.graceDays || 7, trialDays: (c.trial && c.trial.days) || 60, texts: c.texts || {},
        activationHelp: (c.texts && c.texts.activationHelp) || '',
      });
    });
  }, []);

  const set = (patch) => { setCfg({ ...cfg, ...patch }); setMsg(''); };
  const nest = (key, patch) => set({ [key]: { ...cfg[key], ...patch } });

  async function save() {
    setError(''); setMsg('');
    if (!VERSION.test(cfg.minVersion) || !VERSION.test(cfg.latestVersion)) { setError('رقم الإصدار لازم يكون زي 0.2.0'); return; }
    const trial = Number(cfg.trialDays), grace = Number(cfg.graceDays);
    if (!(trial >= 1 && trial <= 365) || !(grace >= 1 && grace <= 60)) { setError('أيام التجربة من 1 لـ 365، وأيام العمل بدون إنترنت من 1 لـ 60'); return; }

    const hasNotice = cfg.noticeTitle.trim() || cfg.noticeBody.trim();
    const same = cfg.notice && cfg.notice.title === cfg.noticeTitle.trim() && cfg.notice.body === cfg.noticeBody.trim() && cfg.notice.level === cfg.noticeLevel;
    const notice = hasNotice ? { id: same ? cfg.notice.id : String(Date.now()), title: cfg.noticeTitle.trim(), body: cfg.noticeBody.trim(), level: cfg.noticeLevel } : null;

    const texts = { ...cfg.texts };
    if (cfg.activationHelp.trim()) texts.activationHelp = cfg.activationHelp.trim(); else delete texts.activationHelp;

    const config = {
      minVersion: cfg.minVersion, latestVersion: cfg.latestVersion, updateUrl: cfg.updateUrl.trim(),
      maintenance: cfg.maintenance, notice, support: cfg.support, links: cfg.links, features: cfg.features,
      graceDays: grace, trial: { days: trial }, texts,
    };
    setBusy(true);
    const { error: e } = await supabase.from('app_config').update({ config, updated_at: new Date().toISOString() }).eq('id', 1);
    setBusy(false);
    if (e) { setError('تعذّر الحفظ'); return; }
    setCfg({ ...cfg, notice, noticeId: notice && notice.id });
    setMsg('اتحفظ. التطبيقات هتاخد التغيير عند أول فتح.');
  }

  if (error && !cfg) return <div className="err">{error}</div>;
  if (!cfg) return <p className="muted">جاري التحميل…</p>;

  return (
    <>
      <div className="row-actions between"><h2>إعدادات التطبيق</h2><button className="btn primary" onClick={save} disabled={busy}>{busy ? 'جاري الحفظ…' : 'حفظ'}</button></div>
      {error && <div className="err">{error}</div>}
      {msg && <div className="note-line">{msg}</div>}

      <section className="card">
        <h3>الإصدارات والتحديث</h3>
        <div className="grid2">
          <Field label="أقل إصدار مسموح" hint="أي نسخة أقدم بتتحجب وتطلب تحديث"><input className="ltr" value={cfg.minVersion} onChange={(e) => set({ minVersion: e.target.value })} /></Field>
          <Field label="آخر إصدار" hint="لو أكبر من اللي عند العميل بيظهرله إشعار تحديث"><input className="ltr" value={cfg.latestVersion} onChange={(e) => set({ latestVersion: e.target.value })} /></Field>
        </div>
        <Field label="رابط تحميل التطبيق (APK)"><input className="ltr" placeholder="https://..." value={cfg.updateUrl} onChange={(e) => set({ updateUrl: e.target.value })} /></Field>
      </section>

      <section className="card">
        <h3>الصيانة</h3>
        <label className="check"><input type="checkbox" checked={cfg.maintenance.on} onChange={(e) => nest('maintenance', { on: e.target.checked })} /> تشغيل وضع الصيانة (التطبيق بيقفل عند كل العملاء)</label>
        <Field label="رسالة الصيانة"><input value={cfg.maintenance.message} onChange={(e) => nest('maintenance', { message: e.target.value })} /></Field>
      </section>

      <section className="card">
        <h3>إشعار في الصفحة الرئيسية</h3>
        <div className="grid2">
          <Field label="العنوان"><input value={cfg.noticeTitle} onChange={(e) => set({ noticeTitle: e.target.value })} /></Field>
          <Field label="النوع"><select value={cfg.noticeLevel} onChange={(e) => set({ noticeLevel: e.target.value })}><option value="info">معلومة</option><option value="warning">تنبيه</option></select></Field>
        </div>
        <Field label="النص" hint="سيب العنوان والنص فاضيين لإخفاء الإشعار"><textarea rows={2} value={cfg.noticeBody} onChange={(e) => set({ noticeBody: e.target.value })} /></Field>
      </section>

      <section className="card">
        <h3>بيانات الدعم</h3>
        <div className="grid2">
          <Field label="واتساب" hint="بالصيغة الدولية، مثلاً +201022097217"><input className="ltr" value={cfg.support.whatsapp} onChange={(e) => nest('support', { whatsapp: e.target.value })} /></Field>
          <Field label="تليفون"><input className="ltr" value={cfg.support.phone} onChange={(e) => nest('support', { phone: e.target.value })} /></Field>
          <Field label="إيميل"><input className="ltr" value={cfg.support.email} onChange={(e) => nest('support', { email: e.target.value })} /></Field>
          <Field label="تيليجرام"><input className="ltr" placeholder="@username" value={cfg.support.telegram} onChange={(e) => nest('support', { telegram: e.target.value })} /></Field>
          <Field label="رابط سياسة الخصوصية"><input className="ltr" value={cfg.links.privacy} onChange={(e) => nest('links', { privacy: e.target.value })} /></Field>
          <Field label="رابط شروط الاستخدام"><input className="ltr" value={cfg.links.terms} onChange={(e) => nest('links', { terms: e.target.value })} /></Field>
        </div>
      </section>

      <section className="card">
        <h3>التجربة والتفعيل</h3>
        <div className="grid2">
          <Field label="أيام الفترة التجريبية" hint="بتتطبق على الأجهزة الجديدة بس"><input type="number" min="1" max="365" value={cfg.trialDays} onChange={(e) => set({ trialDays: e.target.value })} /></Field>
          <Field label="أيام العمل بدون إنترنت" hint="بعد آخر تحقق من السيرفر"><input type="number" min="1" max="60" value={cfg.graceDays} onChange={(e) => set({ graceDays: e.target.value })} /></Field>
        </div>
        <Field label="نص شاشة التفعيل (اختياري)"><textarea rows={2} value={cfg.activationHelp} onChange={(e) => set({ activationHelp: e.target.value })} /></Field>
      </section>

      <section className="card">
        <h3>ميزات التطبيق</h3>
        <div className="checks">
          {FEATURES.map(([k, label]) => <label className="check" key={k}><input type="checkbox" checked={!!cfg.features[k]} onChange={(e) => nest('features', { [k]: e.target.checked })} /> {label}</label>)}
        </div>
      </section>
    </>
  );
}
