import { useCallback, useEffect, useMemo, useState } from 'react';
import { fmtDate, supabase } from '../supabase.js';

const PLAN = { year: 'سنة', lifetime: 'مدى الحياة' };
const STATUS = { unused: 'غير مستخدم', used: 'مستخدم', revoked: 'ملغي' };

function copy(text) { return navigator.clipboard.writeText(text).catch(() => {}); }

function download(name, text) {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Generator({ onDone }) {
  const [plan, setPlan] = useState('year');
  const [qty, setQty] = useState(10);
  const [batch, setBatch] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [made, setMade] = useState([]);

  async function generate(e) {
    e.preventDefault();
    setBusy(true); setError(''); setMade([]);
    const { data, error: err } = await supabase.rpc('generate_codes', { p_plan: plan, p_qty: Number(qty), p_batch: batch.trim() || null, p_note: note.trim() || null });
    setBusy(false);
    if (err) { setError(err.message.includes('quantity') ? 'العدد لازم يكون من 1 لـ 500' : 'تعذّر توليد الأكواد'); return; }
    setMade(data || []);
    onDone();
  }

  return (
    <section className="card">
      <h3>توليد أكواد جديدة</h3>
      <form className="row-form" onSubmit={generate}>
        <label>الباقة
          <select value={plan} onChange={(e) => setPlan(e.target.value)}><option value="year">سنة</option><option value="lifetime">مدى الحياة</option></select>
        </label>
        <label>العدد<input type="number" min="1" max="500" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
        <label>اسم الدفعة (اختياري)<input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="مثلاً: موزع أحمد" /></label>
        <label>ملاحظة (اختياري)<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <button className="btn primary" disabled={busy}>{busy ? 'جاري التوليد…' : 'ولّد الأكواد'}</button>
      </form>
      {error && <div className="err">{error}</div>}
      {made.length > 0 && (
        <div className="made">
          <div className="row-actions">
            <b>{made.length} كود جديد ({PLAN[plan]})</b>
            <button className="btn" onClick={() => copy(made.join('\n'))}>نسخ الكل</button>
            <button className="btn" onClick={() => download(`codes-${plan}-${Date.now()}.csv`, 'code,plan\n' + made.map((c) => `${c},${plan}`).join('\n'))}>تنزيل CSV</button>
          </div>
          <textarea className="ltr" readOnly rows={Math.min(10, made.length)} value={made.join('\n')} onFocus={(e) => e.target.select()} />
        </div>
      )}
    </section>
  );
}

export default function Codes() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [q, setQ] = useState('');
  const [transfer, setTransfer] = useState(null); // { id, value }
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from('codes').select('*, devices(device_id, customer_name)').order('created_at', { ascending: false }).limit(1000);
    if (e) setError('تعذّر تحميل الأكواد'); else { setRows(data); setError(''); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows || []).filter((r) => (!status || r.status === status) && (!plan || r.plan === plan)
      && (!needle || [r.code, r.batch, r.note, r.devices && r.devices.device_id, r.devices && r.devices.customer_name].some((v) => v && String(v).toLowerCase().includes(needle))));
  }, [rows, status, plan, q]);

  async function setCodeStatus(id, next) {
    const { error: e } = await supabase.from('codes').update({ status: next }).eq('id', id);
    if (e) setMsg('تعذّر التعديل'); else load();
  }
  async function doTransfer() {
    const { data, error: e } = await supabase.rpc('transfer_license', { p_code_id: transfer.id, p_new_device_id: transfer.value.trim() });
    if (e || !data || !data.ok) { setMsg('تعذّر النقل. تأكد من رقم الجهاز.'); return; }
    setTransfer(null); setMsg('اتنقل الاشتراك للجهاز الجديد'); load();
  }

  return (
    <>
      <h2>أكواد التفعيل</h2>
      <Generator onDone={load} />
      <section className="card">
        <div className="filters">
          <input placeholder="بحث: كود، دفعة، جهاز، عميل" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">كل الحالات</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select value={plan} onChange={(e) => setPlan(e.target.value)}><option value="">كل الباقات</option>{Object.entries(PLAN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <span className="muted">{shown.length} كود</span>
          {shown.length > 0 && <button className="btn" onClick={() => copy(shown.filter((r) => r.status === 'unused').map((r) => r.code).join('\n'))}>نسخ غير المستخدم</button>}
        </div>
        {msg && <div className="note-line">{msg}</div>}
        {error && <div className="err">{error}</div>}
        {!rows && !error && <p className="muted">جاري التحميل…</p>}
        {rows && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>الكود</th><th>الباقة</th><th>الحالة</th><th>الجهاز / العميل</th><th>التفعيل</th><th>ينتهي</th><th>الدفعة</th><th /></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td className="ltr mono">{r.code}</td>
                    <td>{PLAN[r.plan]}</td>
                    <td><span className={`pill ${r.status}`}>{STATUS[r.status]}</span></td>
                    <td className="ltr">{r.devices ? <>{r.devices.device_id}{r.devices.customer_name ? <small className="muted"> · {r.devices.customer_name}</small> : null}</> : '—'}</td>
                    <td>{fmtDate(r.activated_at)}</td>
                    <td>{r.status === 'used' ? (r.plan === 'lifetime' ? 'مدى الحياة' : fmtDate(r.expires_at)) : '—'}</td>
                    <td>{r.batch || '—'}</td>
                    <td className="actions">
                      <button className="btn sm" onClick={() => copy(r.code)}>نسخ</button>
                      {r.status === 'unused' && <button className="btn sm danger" onClick={() => setCodeStatus(r.id, 'revoked')}>إلغاء</button>}
                      {r.status === 'revoked' && !r.device_uuid && <button className="btn sm" onClick={() => setCodeStatus(r.id, 'unused')}>استرجاع</button>}
                      {r.status === 'used' && <button className="btn sm" onClick={() => setTransfer({ id: r.id, value: '' })}>نقل لجهاز</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {transfer && (
        <div className="modal" onClick={(e) => e.target === e.currentTarget && setTransfer(null)}>
          <div className="card modal-box">
            <h3>نقل الاشتراك لجهاز جديد</h3>
            <p className="muted">اكتب رقم الجهاز الجديد زي ما بيظهر في التطبيق. الاشتراك هيتشال من الجهاز القديم.</p>
            <input className="ltr" placeholder="XXXX-XXXX-XXXX" value={transfer.value} onChange={(e) => setTransfer({ ...transfer, value: e.target.value })} autoFocus />
            <div className="row-actions">
              <button className="btn primary" onClick={doTransfer} disabled={transfer.value.trim().length < 8}>نقل</button>
              <button className="btn" onClick={() => setTransfer(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
