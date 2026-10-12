import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import Overview from './pages/Overview.jsx';
import Codes from './pages/Codes.jsx';
import Devices from './pages/Devices.jsx';
import Config from './pages/Config.jsx';
import Activity from './pages/Activity.jsx';

const TABS = [
  ['overview', 'نظرة عامة', Overview],
  ['codes', 'أكواد التفعيل', Codes],
  ['devices', 'الأجهزة', Devices],
  ['config', 'إعدادات التطبيق', Config],
  ['activity', 'سجل العمليات', Activity],
];

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) { setError('الإيميل أو كلمة المرور غلط'); setBusy(false); }
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="logo-mark">OMC</div>
        <h1>لوحة التحكم</h1>
        <label>الإيميل<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="ltr" autoComplete="username" required /></label>
        <label>كلمة المرور<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="ltr" autoComplete="current-password" required /></label>
        {error && <div className="err" role="alert">{error}</div>}
        <button className="btn primary" disabled={busy}>{busy ? 'جاري الدخول…' : 'دخول'}</button>
      </form>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [isAdmin, setIsAdmin] = useState(null);
  const [tab, setTab] = useState(() => { try { return localStorage.getItem('tab') || 'overview'; } catch { return 'overview'; } });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setIsAdmin(null); return; }
    supabase.rpc('is_admin').then(({ data }) => setIsAdmin(!!data));
  }, [session]);

  const go = (k) => { setTab(k); try { localStorage.setItem('tab', k); } catch { /* ignore */ } };

  if (session === undefined) return <div className="boot">…</div>;
  if (!session) return <Login />;
  if (isAdmin === null) return <div className="boot">…</div>;
  if (!isAdmin) {
    return (
      <div className="login"><div className="login-card">
        <h1>غير مصرّح</h1>
        <p className="muted">الحساب ده مش مضاف كأدمن.</p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>تسجيل الخروج</button>
      </div></div>
    );
  }

  const Page = (TABS.find((t) => t[0] === tab) || TABS[0])[2];
  return (
    <div className="shell">
      <aside>
        <div className="brand"><span className="logo-mark sm">OMC</span><b>IPTV</b></div>
        <nav>
          {TABS.map(([k, label]) => <button key={k} className={k === tab ? 'on' : ''} onClick={() => go(k)}>{label}</button>)}
        </nav>
        <div className="side-foot">
          <small className="ltr muted">{session.user.email}</small>
          <button className="btn" onClick={() => supabase.auth.signOut()}>تسجيل الخروج</button>
        </div>
      </aside>
      <main>
        <Page />
      </main>
    </div>
  );
}
