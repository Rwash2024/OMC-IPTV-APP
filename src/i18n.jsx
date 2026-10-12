import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { BRAND } from './brand.js';
import { EXTRA } from './i18nExtra.js';

const STR = {
  ar: {
    welcome: `أهلاً بك في ${BRAND.name}`, sub: 'ادخل بيانات اشتراكك لعرض القنوات والأفلام والمسلسلات.',
    server: 'عنوان السيرفر', user: 'اسم المستخدم', pass: 'كلمة المرور', remember: 'تذكّرني على هذا الجهاز', signin: 'دخول',
    help: 'البيانات (عنوان السيرفر واسم المستخدم وكلمة المرور) بتجيلك من مزود الخدمة.',
    eSrv: 'اكتب عنوان السيرفر، مثلاً http://example.com:8080', eUsr: 'اكتب اسم المستخدم', ePwd: 'اكتب كلمة المرور',
    eAuth: 'اسم المستخدم أو كلمة المرور غلط', eExpired: 'الاشتراك منتهي أو غير مفعّل', eNet: 'مقدرناش نوصل للسيرفر. اتأكد من العنوان والإنترنت.', eBad: 'السيرفر رد برد غير متوقع. اتأكد إنه عنوان Xtream صحيح.',
    showPass: 'إظهار كلمة المرور', connecting: 'جاري الاتصال…',
    home: 'الرئيسية', live: 'مباشر', movies: 'أفلام', series: 'مسلسلات', settings: 'الإعدادات',
    search: 'بحث', all: 'الكل', more: 'عرض المزيد', empty: 'مفيش نتائج.', loading: 'جاري التحميل…', retry: 'حاول تاني', loadErr: 'حصلت مشكلة في التحميل.',
    liveNow: 'مباشر الآن', popularMovies: 'أفلام', newSeries: 'مسلسلات', play: 'تشغيل', season: 'الموسم', episode: 'الحلقة', rating: 'التقييم',
    expires: 'ينتهي', logout: 'تسجيل الخروج', language: 'اللغة', theme: 'المظهر', themeSystem: 'تلقائي', themeDark: 'داكن', themeLight: 'فاتح',
    account: 'الحساب', conns: 'عدد الأجهزة المسموحة', now: 'الآن', next: 'التالي', back: 'رجوع', close: 'إغلاق',
    playErr: 'تعذّر تشغيل هذا المحتوى. جرّب قناة أو عنصر تاني، أو راجع مزود الخدمة.', fullscreen: 'ملء الشاشة', prevCh: 'القناة السابقة', nextCh: 'القناة التالية', pause: 'إيقاف', resume: 'تشغيل',
    devNote: 'وضع التطوير: الاتصال بيعدّي على بروكسي محلي.', introSound: 'صوت الافتتاحية', orientation: 'اتجاه الشاشة', orientAuto: 'تلقائي', orientLandscape: 'أفقي', orientPortrait: 'رأسي', fitFill: 'تكبير الصورة لملء الشاشة', fitWhole: 'الصورة كاملة', on: 'تشغيل', off: 'إيقاف',
  },
  en: {
    welcome: `Welcome to ${BRAND.name}`, sub: 'Enter your subscription details to watch channels, movies and series.',
    server: 'Server address', user: 'Username', pass: 'Password', remember: 'Remember me on this device', signin: 'Sign in',
    help: 'Your server address, username and password come from your service provider.',
    eSrv: 'Enter the server address, e.g. http://example.com:8080', eUsr: 'Enter your username', ePwd: 'Enter your password',
    eAuth: 'Wrong username or password', eExpired: 'This subscription has expired or is inactive', eNet: 'Could not reach the server. Check the address and your connection.', eBad: 'The server sent an unexpected reply. Check that it is a valid Xtream address.',
    showPass: 'Show password', connecting: 'Connecting…',
    home: 'Home', live: 'Live', movies: 'Movies', series: 'Series', settings: 'Settings',
    search: 'Search', all: 'All', more: 'Show more', empty: 'Nothing found.', loading: 'Loading…', retry: 'Try again', loadErr: 'Something went wrong while loading.',
    liveNow: 'Live now', popularMovies: 'Movies', newSeries: 'Series', play: 'Play', season: 'Season', episode: 'Episode', rating: 'Rating',
    expires: 'Expires', logout: 'Sign out', language: 'Language', theme: 'Appearance', themeSystem: 'System', themeDark: 'Dark', themeLight: 'Light',
    account: 'Account', conns: 'Allowed devices', now: 'Now', next: 'Next', back: 'Back', close: 'Close',
    playErr: 'This item could not be played. Try another one, or check with your provider.', fullscreen: 'Fullscreen', prevCh: 'Previous channel', nextCh: 'Next channel', pause: 'Pause', resume: 'Play',
    devNote: 'Dev mode: requests go through a local proxy.', introSound: 'Opening sound', orientation: 'Screen orientation', orientAuto: 'Auto', orientLandscape: 'Landscape', orientPortrait: 'Portrait', fitFill: 'Zoom to fill the screen', fitWhole: 'Show whole picture', on: 'On', off: 'Off',
  },
};

const Ctx = createContext(null);
const read = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => read('lang', 'ar'));
  const [theme, setTheme] = useState(() => read('theme', 'system'));
  useEffect(() => {
    const el = document.documentElement;
    el.lang = lang; el.dir = lang === 'ar' ? 'rtl' : 'ltr'; write('lang', lang);
    document.title = BRAND.name;
  }, [lang]);
  useEffect(() => {
    const el = document.documentElement;
    if (theme === 'system') delete el.dataset.theme; else el.dataset.theme = theme;
    write('theme', theme);
  }, [theme]);
  const value = useMemo(() => ({ lang, setLang, theme, setTheme, t: (k) => STR[lang][k] ?? EXTRA[lang][k] ?? k }), [lang, theme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useI18n = () => useContext(Ctx);
