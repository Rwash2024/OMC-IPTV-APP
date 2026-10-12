import { useCallback, useEffect, useMemo, useState } from 'react';
import { STATUS_LABEL, daysFromNow, deviceStatus, fmtDate, fmtDateTime, supabase } from '../supabase.js';

const PLAN = { year: 'سنة', lifetime: 'مدى الحياة' };

function Editor({ device, codes, onClose, onSaved }) {
  const [name, setName] = useState(device.customer_name || '');
  const [phone, setPhone] = useState(device.customer_phone || '');
  const [notes, setNotes] = useState(device.notes || '');
  const [reason, setReason] = useState(device.blocked_reason || '');
  const [msg, setMsg] = useState('');

  async function update(patch, done) {
    const { error } = await supabase.from('devices').update(patch).eq('id', device.id);
    if (error) { setMsg('تعذّر الحفظ'); return; }
    setMsg(done); onSaved();
  }
  const extend = (days) => {
    const base = Math.max(Date.now(), new Date(device.trial_ends_at).getTime());
    update({ trial_ends_at: new Date(base + days * 86400000).toISOString() }, `التجربة اتمدّدت ${days} يوم`);
  };

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card modal-box wide">
        <div className="row-actions between"><h3>الجهاز</h3><button className="btn sm" onClick={onClose}>إغلاق</button></div>
        <p className="ltr mono">{device.device_id}</p>
        <p className="muted">{device.platform || '—'} · إصدار {device.app_version || '—'} · أول ظهور {fmtDateTime(device.first_seen_at)} · آخر ظهور {fmtDateTime(device.last_seen_at)}</p>

        <div className="grid2">
          <label>اسم العميل<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>رقم العميل<input className="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        </div>
        <label>ملاحظات<textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <button className="btn primary" onClick={() => update({ customer_name: name.trim() || null, customer_phone: phone.trim() || null, notes: notes.trim() || null }, 'اتحفظ')}>حفظ البيانات</button>

        <h4>الفترة التجريبية</h4>
        <p className="muted">تنتهي {fmtDate(device.trial_ends_at)}</p>
        <div className="row-actions">
          <button className="btn" onClick={() => extend(7)}>+7 أيام</button>
          <button className="btn" onClick={() => extend(30)}>+30 يوم</button>
          <button className="btn" onClick={() => extend(60)}>+60 يوم</button>
        </div>

        <h4>الأكواد المرتبطة</h4>
        {codes.length === 0 ? <p className="muted">مفيش</p> : (
          <ul className="plain">{codes.map((c) => <li key={c.id}><span className="ltr mono">{c.code}</span> · {PLAN[c.plan]} · {c.plan === 'lifetime' ? 'مدى الحياة' : `ينتهي ${fmtDate(c.expires_at)}`}</li>)}</ul>
        )}

        <h4>إيقاف الجهاز</h4>
        {device.blocked ? (
          <div className="row-actions"><span className="pill blocked">موقوف</span><button className="btn" onClick={() => update({ blocked: false, blocked_reason: null }, 'اتفك الإيقاف')}>فك الإيقاف</button></div>
        ) : (
          <div className="row-actions">
            <input placeholder="سبب الإيقاف (يظهر للعميل)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button className="btn danger" onClick={() => update({ blocked: true, blocked_reason: reason.trim() || null }, 'الجهاز اتوقف')}>إيقاف</button>
          </div>
        )}
        {msg && <div className="note-line">{msg}</div>}
      </div>
    </div>
  );
}

export default function Devices() {
  const [devices, setDevices] = useState(null);
  const [codes, setCodes] = useState([]);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    const [d, c] = await Promise.all([
      supabase.from('devices').select('*').order('last_seen_at', { ascending: false }).limit(1000),
      supabase.from('codes').select('id, code, plan, expires_at, device_uuid').eq('status', 'used').limit(5000),
    ]);
    if (d.error || c.error) { setError('تعذّر تحميل الأجهزة'); return; }
    setError(''); setDevices(d.data); setCodes(c.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const byDevice = useMemo(() => {
    const m = new Map();
    codes.forEach((c) => m.set(c.device_uuid, [...(m.get(c.device_uuid) || []), c]));
    return m;
  }, [codes]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (devices || []).map((d) => ({ d, st: deviceStatus(d, byDevice.get(d.id) || []) }))
      .filter(({ d, st }) => (!status || st === status)
        && (!needle || [d.device_id, d.customer_name, d.customer_phone, d.notes].some((v) => v && String(v).toLowerCase().includes(needle))));
  }, [devices, byDevice, q, status]);

  const opened = open && devices ? devices.find((d) => d.id === open) : null;

  return (
    <>
      <h2>الأجهزة</h2>
      <section className="card">
        <div className="filters">
          <input placeholder="بحث: رقم جهاز، اسم، تليفون" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">كل الحالات</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <span className="muted">{rows.length} جهاز</span>
          <button className="btn" onClick={load}>تحديث</button>
        </div>
        {error && <div className="err">{error}</div>}
        {!devices && !error && <p className="muted">جاري التحميل…</p>}
        {devices && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>الحالة</th><th>رقم الجهاز</th><th>العميل</th><th>النظام</th><th>آخر ظهور</th><th>التجربة تنتهي</th><th>الاشتراك</th></tr></thead>
              <tbody>
                {rows.map(({ d, st }) => {
                  const cs = byDevice.get(d.id) || [];
                  const life = cs.find((c) => c.plan === 'lifetime');
                  const lastYear = cs.filter((c) => c.plan === 'year').sort((a, b) => new Date(b.expires_at) - new Date(a.expires_at))[0];
                  return (
                    <tr key={d.id} className="clickable" onClick={() => setOpen(d.id)}>
                      <td><span className={`pill ${st}`}>{STATUS_LABEL[st]}</span></td>
                      <td className="ltr mono">{d.device_id}</td>
                      <td>{d.customer_name || '—'}{d.customer_phone ? <small className="muted ltr"> {d.customer_phone}</small> : null}</td>
                      <td className="ltr">{d.platform || '—'} {d.app_version || ''}</td>
                      <td>{fmtDateTime(d.last_seen_at)}</td>
                      <td>{fmtDate(d.trial_ends_at)}</td>
                      <td>{life ? 'مدى الحياة' : lastYear ? `حتى ${fmtDate(lastYear.expires_at)}` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {opened && <Editor key={opened.id + opened.last_seen_at} device={opened} codes={byDevice.get(opened.id) || []} onClose={() => setOpen(null)} onSaved={load} />}
    </>
  );
}
