// M3U playlist support. A playlist is one flat list, so channels, movies and series are told apart by their URL, group
// name and title. The result has the same shape as the Xtream client, so every screen works with either.
import { route } from './xtream.js';

const ATTR = /([\w-]+)="([^"]*)"/g;
const EP = /^(.*?)[\s._-]*S(\d{1,2})[\s._-]*E(\d{1,3})/i;
const VOD_GROUP = /movie|film|vod|cinema|أفلام|فيلم/i;
const SERIES_GROUP = /series|serie|season|episode|مسلسل|حلقات/i;
const VIDEO_EXT = /\.(mp4|mkv|avi|mov|wmv|flv|m4v)(\?|$)/i;

export function parseM3U(text) {
  const entries = [];
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      const attrs = {};
      for (const m of line.matchAll(ATTR)) attrs[m[1].toLowerCase()] = m[2];
      cur = { name: line.slice(line.lastIndexOf(',') + 1).trim() || attrs['tvg-name'] || '', logo: attrs['tvg-logo'] || '', group: attrs['group-title'] || '', tvgId: attrs['tvg-id'] || '' };
    } else if (line.startsWith('#EXTGRP:') && cur) {
      cur.group = cur.group || line.slice(8).trim();
    } else if (!line.startsWith('#') && cur) {
      cur.url = line;
      entries.push(cur);
      cur = null;
    }
  }
  return entries;
}

const extOf = (url) => ((url.split('?')[0].match(/\.([a-z0-9]{2,4})$/i) || [])[1] || 'mp4').toLowerCase();

function classify(e) {
  if (/\/series\//i.test(e.url) || EP.test(e.name)) return 'episode';
  if (/\/movie\//i.test(e.url) || VIDEO_EXT.test(e.url) || VOD_GROUP.test(e.group)) return 'movie';
  if (SERIES_GROUP.test(e.group)) return 'episode';
  return 'live';
}

export class M3uProvider {
  constructor({ id, url }) {
    this.id = id;
    this.kind = 'm3u';
    this.url = url;
    this.ready = null;
  }

  load() {
    if (!this.ready) this.ready = this.#build();
    return this.ready;
  }

  async #build() {
    const res = await fetch(route(this.url));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const entries = parseM3U(await res.text());
    if (!entries.length) throw new Error('BAD_RESPONSE');

    const cats = { live: new Map(), movie: new Map(), series: new Map() };
    const catId = (kind, name) => {
      const n = name || '—';
      if (!cats[kind].has(n)) cats[kind].set(n, String(cats[kind].size + 1));
      return cats[kind].get(n);
    };
    this.urls = new Map();
    this.liveList = []; this.vodList = []; this.seriesList = [];
    this.episodes = new Map();
    const seriesByName = new Map();

    entries.forEach((e, i) => {
      const kind = classify(e);
      if (kind === 'live') {
        const id = 'L' + i;
        this.urls.set(id, e.url);
        this.liveList.push({ num: this.liveList.length + 1, name: e.name, stream_id: id, stream_icon: e.logo, category_id: catId('live', e.group), epg_channel_id: e.tvgId });
      } else if (kind === 'movie') {
        const id = 'M' + i;
        this.urls.set(id, e.url);
        this.vodList.push({ name: e.name, stream_id: id, stream_icon: e.logo, rating: '', container_extension: extOf(e.url), category_id: catId('movie', e.group) });
      } else {
        const m = e.name.match(EP);
        const sname = (m ? m[1] : e.name).trim() || e.name;
        const season = m ? String(parseInt(m[2], 10)) : '1';
        const epNum = m ? parseInt(m[3], 10) : this.episodes.size + 1;
        let s = seriesByName.get(sname);
        if (!s) {
          s = { name: sname, series_id: 'S' + seriesByName.size, cover: e.logo, plot: '', rating: '', category_id: catId('series', e.group) };
          seriesByName.set(sname, s);
          this.seriesList.push(s);
          this.episodes.set(s.series_id, {});
        }
        const id = 'E' + i;
        this.urls.set(id, e.url);
        const bySeason = this.episodes.get(s.series_id);
        (bySeason[season] = bySeason[season] || []).push({ id, episode_num: epNum, title: e.name, container_extension: extOf(e.url), info: {} });
      }
    });
    for (const bySeason of this.episodes.values()) for (const list of Object.values(bySeason)) list.sort((a, b) => a.episode_num - b.episode_num);

    const toList = (map) => [...map.entries()].map(([name, id]) => ({ category_id: id, category_name: name }));
    this.cats = { live: toList(cats.live), movie: toList(cats.movie), series: toList(cats.series) };
  }

  async login() { await this.load(); return { expires: null, status: 'Active', maxConnections: null }; }
  async liveCategories() { await this.load(); return this.cats.live; }
  async live() { await this.load(); return this.liveList; }
  async vodCategories() { await this.load(); return this.cats.movie; }
  async vod() { await this.load(); return this.vodList; }
  async vodInfo() { return { info: {} }; }
  async seriesCategories() { await this.load(); return this.cats.series; }
  async series() { await this.load(); return this.seriesList; }
  async seriesInfo(id) { await this.load(); return { info: {}, episodes: this.episodes.get(id) || {} }; }
  async epg() { return []; }

  raw(kind, id) { return this.urls.get(id); }
  url(kind, id) { return route(this.urls.get(id)); }
}
