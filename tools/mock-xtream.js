// Tiny fake Xtream server for testing the app without a real subscription.
// Run: npm run mock   then sign in with  http://localhost:8099  /  demo  /  demo
// It serves sample JSON only. It has no real streams, so playback will show the error message.
import http from 'node:http';

const USER = 'demo', PASS = 'demo';
const b64 = (s) => Buffer.from(s).toString('base64');
const now = Math.floor(Date.now() / 1000);

const liveCats = [{ category_id: '1', category_name: 'News' }, { category_id: '2', category_name: 'Sports' }, { category_id: '3', category_name: 'Movies' }];
const live = Array.from({ length: 90 }, (_, i) => ({ num: i + 1, name: `Sample Channel ${i + 1}`, stream_id: 1000 + i, stream_icon: '', category_id: String((i % 3) + 1) }));
const vodCats = [{ category_id: '10', category_name: 'Drama' }, { category_id: '11', category_name: 'Action' }];
const vod = Array.from({ length: 70 }, (_, i) => ({ name: `Sample Movie ${i + 1}`, stream_id: 2000 + i, stream_icon: '', rating: (6 + (i % 4)).toString(), container_extension: 'mp4', category_id: String(10 + (i % 2)) }));
const serCats = [{ category_id: '20', category_name: 'Comedy' }, { category_id: '21', category_name: 'Thriller' }];
const series = Array.from({ length: 40 }, (_, i) => ({ name: `Sample Series ${i + 1}`, series_id: 3000 + i, cover: '', plot: 'A sample plot for testing the layout.', rating: '7.5', category_id: String(20 + (i % 2)) }));
const episodes = (id) => ({ 1: Array.from({ length: 6 }, (_, k) => ({ id: id * 10 + k, episode_num: k + 1, title: `Pilot ${k + 1}`, container_extension: 'mp4', info: { duration: '42:00' } })), 2: Array.from({ length: 4 }, (_, k) => ({ id: id * 10 + 50 + k, episode_num: k + 1, title: `Return ${k + 1}`, container_extension: 'mp4', info: { duration: '44:00' } })) });

const send = (res, obj) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/playlist.m3u') {
    res.writeHead(200, { 'content-type': 'audio/x-mpegurl' });
    return res.end(['#EXTM3U',
      '#EXTINF:-1 tvg-id="a" tvg-logo="" group-title="News",M3U News One', 'http://localhost:8099/live/a.m3u8',
      '#EXTINF:-1 group-title="News",M3U News Two', 'http://localhost:8099/live/b.m3u8',
      '#EXTINF:-1 group-title="Movies",M3U Movie One', 'http://localhost:8099/movie/one.mp4',
      '#EXTINF:-1 group-title="Shows",Demo Show S01E01', 'http://localhost:8099/series/s1e1.mp4',
      '#EXTINF:-1 group-title="Shows",Demo Show S01E02', 'http://localhost:8099/series/s1e2.mp4',
      '#EXTINF:-1 group-title="Adult XXX",Hidden Channel', 'http://localhost:8099/live/x.m3u8'].join('\n'));
  }
  if (u.pathname !== '/player_api.php') { res.writeHead(404); return res.end('no stream'); }
  const q = u.searchParams;
  if (q.get('username') !== USER || q.get('password') !== PASS) return send(res, { user_info: { auth: 0 } });
  switch (q.get('action')) {
    case null: case '': return send(res, { user_info: { auth: 1, status: 'Active', exp_date: String(now + 90 * 86400), max_connections: '2' }, server_info: {} });
    case 'get_live_categories': return send(res, liveCats);
    case 'get_live_streams': return send(res, live);
    case 'get_vod_categories': return send(res, vodCats);
    case 'get_vod_streams': return send(res, vod);
    case 'get_vod_info': return send(res, { info: { plot: 'A sample movie description.', genre: 'Drama', releasedate: '2024-05-01' } });
    case 'get_series_categories': return send(res, serCats);
    case 'get_series': return send(res, series);
    case 'get_series_info': return send(res, { info: { plot: 'A sample series description.', genre: 'Comedy' }, episodes: episodes(Number(q.get('series_id'))) });
    case 'get_short_epg': return send(res, { epg_listings: [
      { title: b64('Morning Briefing'), start_timestamp: String(now - 1800), stop_timestamp: String(now + 1800) },
      { title: b64('World Today'), start_timestamp: String(now + 1800), stop_timestamp: String(now + 5400) }] });
    default: return send(res, []);
  }
}).listen(8099, () => console.log('Mock Xtream on http://localhost:8099  (demo / demo)'));
