import { Xtream } from './xtream.js';
import { M3uProvider } from './m3u.js';

// One object per saved account, with the same methods whether it is an Xtream login or an M3U link.
export function createProvider(account) {
  return account.type === 'm3u' ? new M3uProvider(account) : new Xtream(account);
}
