// Which kind of device the app is running on.
const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
export const isTizen = /Tizen/i.test(ua);                                    // Samsung TV
export const isWebOS = /Web0S|webOS/i.test(ua) || (typeof window !== 'undefined' && typeof window.PalmSystem !== 'undefined'); // LG TV
export const isTV = isTizen || isWebOS;
