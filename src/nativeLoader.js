import { CapacitorHttp } from '@capacitor/core';

/*
 * hls.js loader for the Android app. The WebView blocks cross-origin requests that hls.js makes
 * (playlists, segments, keys) because IPTV servers don't send CORS headers. Going through Android's
 * own HTTP stack avoids that, so every request here is made natively.
 */
const b64ToBuffer = (b64) => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};

export default class NativeLoader {
  constructor() {
    this.aborted = false;
    this.context = null;
    // hls.js reads and writes loader.stats before load() is called (it copies the retry count in), so it must exist now.
    this.stats = {
      aborted: false, loaded: 0, retry: 0, total: 0, chunkCount: 0, bwEstimate: 0,
      loading: { start: 0, first: 0, end: 0 }, parsing: { start: 0, end: 0 }, buffering: { start: 0, first: 0, end: 0 },
    };
  }

  destroy() { this.aborted = true; this.context = null; }
  abort() { this.aborted = true; this.stats.aborted = true; }

  load(context, config, callbacks) {
    const now = () => performance.now();
    const stats = this.stats;
    this.context = context;
    stats.loading.start = now();
    const binary = context.responseType === 'arraybuffer';
    const headers = {};
    if (context.rangeStart !== undefined && context.rangeEnd !== undefined) headers.Range = `bytes=${context.rangeStart}-${context.rangeEnd - 1}`;
    const timeout = (config && config.timeout) || 20000;

    CapacitorHttp.request({
      url: context.url, method: 'GET', headers,
      responseType: binary ? 'arraybuffer' : 'text',
      connectTimeout: timeout, readTimeout: timeout,
    }).then((res) => {
      if (this.aborted) return;
      stats.loading.first = stats.loading.end = now();
      if (res.status >= 200 && res.status < 300) {
        const data = binary ? b64ToBuffer(res.data) : String(res.data);
        stats.loaded = stats.total = binary ? data.byteLength : data.length;
        callbacks.onSuccess({ url: res.url || context.url, data }, stats, context, res);
      } else {
        callbacks.onError({ code: res.status, text: `HTTP ${res.status}` }, context, res, stats);
      }
    }).catch((e) => {
      if (this.aborted) return;
      const msg = String((e && e.message) || e);
      if (/timeout|timed out/i.test(msg)) callbacks.onTimeout(stats, context, null);
      else callbacks.onError({ code: 0, text: msg }, context, null, stats);
    });
  }
}
