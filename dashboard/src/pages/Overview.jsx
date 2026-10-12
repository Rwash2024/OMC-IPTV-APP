import { useEffect, useState } from 'react';
import { supabase } from '../supabase.js';

const CARDS = [
  ['devices', 'كل الأجهزة'],
  ['new_7d', 'أجهزة جديدة (7 أيام)'],
  ['active_7d', 'نشطة (7 أيام)'],
  ['in_trial', 'في الفترة التجريبية'],
  ['subscribed', 'مشتركين'],
  ['expired', 'انتهت تجربتهم'],
  ['blocked', 'موقوفة'],
  ['codes_unused', 'أكواد غير مستخدمة'],
  ['codes_year_used', 'اشتراكات سنة'],
  ['codes_lifetime_used', 'مدى الحياة'],
  ['activations_30d', 'تفعيلات (30 يوم)'],
];

export default function Overview() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.rpc('dashboard_stats').then(({ data, error: e }) => (e ? setError('تعذّر تحميل الإحصائيات') : setStats(data)));
  }, []);

  return (
    <>
      <h2>نظرة عامة</h2>
      {error && <div className="err">{error}</div>}
      {!stats && !error && <p className="muted">جاري التحميل…</p>}
      {stats && (
        <div className="cards">
          {CARDS.map(([k, label]) => (
            <div className="card stat" key={k}><span className="muted">{label}</span><b>{stats[k] ?? 0}</b></div>
          ))}
        </div>
      )}
    </>
  );
}
