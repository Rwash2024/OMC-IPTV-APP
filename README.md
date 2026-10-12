# IPTV app (working name: OMC)

Xtream Codes player: login, live channels with now/next, movies, series with seasons, player with HLS.
Arabic (RTL) and English, dark and light.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173 and sign in with your own server address, username and password.
Your login stays on your device only (localStorage if "remember me" is ticked, otherwise sessionStorage).

## Test without a subscription

```bash
npm run mock
```

Then sign in with `localhost:8099` / `demo` / `demo`. It serves sample lists only, so playback shows the error message.

## Change the name

Edit `src/brand.js` (name, logo letters, tagline) and `<title>` in `index.html`.

## Where things are

| File | What it does |
|---|---|
| `src/xtream.js` | Xtream API client and stream URLs |
| `src/Login.jsx` | Sign-in screen |
| `src/Pages.jsx` | Home, Live, Movies/Series lists, Settings |
| `src/Detail.jsx` | Movie and series details, seasons and episodes |
| `src/Player.jsx` | Player (hls.js), channel zapping, keyboard and remote keys |
| `vite.config.js` | Dev-only proxy so the browser can reach Xtream servers |

## Android (phone, tablet, Android TV, Fire TV)

The `android/` folder is a Capacitor project that wraps the web app. Requirements: Android Studio (it brings JDK 21 and the Android SDK 36).

```bash
npm run android:sync   # build the web app and copy it into the Android project
npm run android:open   # open it in Android Studio, then Build > Build APK(s)
npm run android:apk    # or build a debug APK from the command line (needs JDK 21 + SDK)
```

The APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`. Copy it to the phone and open it (allow "install unknown apps" for your file manager).
The native app calls the Xtream server directly, so the dev proxy is not used.
The app id (`com.omc.iptv`) and name are in `capacitor.config.json`. Change them before publishing, and again whenever the brand name changes.

## Known limits

- The proxy exists only in `npm run dev`. A hosted web build can't call most Xtream servers (CORS, http). The Android and TV builds call the server directly, so they don't have this problem.
- Browsers can't play some formats (MKV, some audio codecs). Live channels use HLS (.m3u8).
- Android and Smart TV packaging (Capacitor, Tizen, webOS) is the next step and isn't done yet.

## Testing licensing and remote config without a server

```bash
npm run mock        # fake Xtream server on :8099 (demo / demo, M3U sample at /playlist.m3u)
npm run mock:api    # fake licensing + config server on :8098
```

Start the app with `VITE_API_BASE=http://localhost:8098`. Without that variable the app has no server and runs unlocked.
Test controls: `/_set?status=expired|trial|blocked|active|none`, `/_set?update=1`, `/_set?maintenance=1`, `/_set?reset=1`.
Test codes: `YEAR-TEST-0001`, `LIFE-TEST-0001`, `USED-TEST-0001`, `REVOKED-TEST-0001`.

The real server (Supabase) will implement the same three calls: `GET /config`, `POST /check`, `POST /activate`.

## Server and dashboard (Supabase)

- Project: OMC IPTV APP (`jjjfqkhqwrqpvqptgvzb`). Tables: `devices`, `codes`, `app_config`, `audit_log`, `admin_users`. All locked by row level security; only accounts in `admin_users` can read or change them.
- Edge Functions the app calls: `config` (GET), `check` (POST), `activate` (POST). They need the project's anon key in the `apikey` header.
- The release build reads `.env.production` (not in git, see `.env.example`): `VITE_API_BASE` and `VITE_API_KEY`.
- Dashboard: `npm run dashboard` (first time: `npm --prefix dashboard install`), then open http://localhost:5174 and sign in with the admin account.
  It needs `dashboard/.env.local` (see `dashboard/.env.example`).
- Add another admin: create the user in Supabase Auth, then `insert into public.admin_users (user_id) values ('<user id>');`.
