import { createClient } from '@supabase/supabase-js';

// The anon key is public by design. What a signed-in person can do is decided by the database rules
// (only accounts listed in admin_users can read or change anything).
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const daysFromNow = (n) => new Date(Date.now() + n * 86400000).toISOString();

// What a device is right now, from its row and its used codes.
export function deviceStatus(device, codes) {
  const now = Date.now();
  if (device.blocked) return 'blocked';
  const live = codes.some((c) => c.plan === 'lifetime' || (c.expires_at && new Date(c.expires_at).getTime() > now));
  if (live) return 'subscribed';
  return new Date(device.trial_ends_at).getTime() > now ? 'trial' : 'expired';
}
export const STATUS_LABEL = { blocked: 'موقوف', subscribed: 'مشترك', trial: 'تجربة', expired: 'منتهي' };
