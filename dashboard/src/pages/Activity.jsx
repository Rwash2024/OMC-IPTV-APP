import { useEffect, useState } from 'react';
import { fmtDateTime, supabase } from '../supabase.js';

const EVENT = { activated: 'تفعيل', activate_fail: 'محاولة تفعيل فاشلة', transferred: 'نقل اشتراك' };
const REASON = { invalid_code: 'كود غلط', used: 'كود مستخدم', revoked: 'كود ملغي' };

export default function Activity() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [event, setEvent] = useState('');

  useEffect(() => {
    let query = supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(300);
    if (event) query = query.eq('event', event);
    query.then(({ data, error: e }) => (e ? setError('تعذّر تحميل السجل') : (setError(''), setRows(data))));
  }, [event]);

  const detail = (r) => {
    const d = r.detail || {};
    return [d.reason && (REASON[d.reason] || d.reason), d.code, d.plan, d.expires_at && `ينتهي ${fmtDateTime(d.expires_at)}`].filter(Boolean).join(' · ');
  };

  return (
    <>
      <h2>سجل العمليات</h2>
      <section className="card">
        <div className="filters">
          <select value={event} onChange={(e) => setEvent(e.target.value)}><option value="">كل العمليات</option>{Object.entries(EVENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
        {error && <div className="err">{error}</div>}
        {!rows && !error && <p className="muted">جاري التحميل…</p>}
        {rows && (rows.length === 0 ? <p className="muted">مفيش عمليات لسه.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>الوقت</th><th>العملية</th><th>الجهاز</th><th>التفاصيل</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id}><td>{fmtDateTime(r.at)}</td><td>{EVENT[r.event] || r.event}</td><td className="ltr mono">{r.device_id}</td><td className="ltr">{detail(r)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        ))}
      </section>
    </>
  );
}
