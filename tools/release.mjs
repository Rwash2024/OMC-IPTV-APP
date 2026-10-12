// Publishes updates for the app. Uses the GitHub CLI (gh) that is already signed in on this computer.
//
//   npm run release:ota          build the web part, publish it as an over-the-air update, print the dashboard values
//   npm run release:ota -- --bump   same, but first raise the version's last number (0.2.0 -> 0.2.1)
//   npm run release:apk          publish OMC-IPTV.apk (built by build-apk.cmd) as the downloadable app, print the values
//
// Then open the dashboard > App settings and paste the printed values. Nothing reaches customers until you save there.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'Rwash2024/OMC-IPTV-APP';
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', ...opts });
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const gradle = readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
const nativeVersion = (gradle.match(/versionName "([^"]+)"/) || [])[1] || '0.0.0';

function ota() {
  if (process.argv.includes('--bump')) {
    const parts = pkg.version.split('.').map(Number);
    parts[parts.length - 1] += 1;
    pkg.version = parts.join('.');
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`Version raised to ${pkg.version}`);
  }
  const version = pkg.version;
  console.log(`Building the web part, version ${version}...`);
  run('npm', ['run', 'build']);

  const out = path.join(root, 'release');
  mkdirSync(out, { recursive: true });
  const zip = path.join(out, `ota-${version}.zip`);
  // bsdtar (included with Windows 10 and later) writes zip files; the app files go at the top level of the archive.
  // Use Windows' own tar, because other tar programs on the PATH (such as Git's) cannot write zip files.
  const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
  // List the top-level names so the archive has no "./" prefix on its entries.
  const names = readdirSync(path.join(root, 'dist')).map((n) => `"${n}"`);
  run(`"${tar}"`, ['-a', '-c', '-f', `"${zip}"`, '-C', `"${path.join(root, 'dist')}"`, ...names]);

  const tag = `ota-${version}`;
  console.log(`Publishing ${tag} on GitHub...`);
  run('gh', ['release', 'create', tag, zip, '--repo', REPO, '--title', `Web update ${version}`, '--notes', `Over-the-air web update ${version}. Needs APK ${nativeVersion} or newer.`]);

  print({
    'Web update version (إصدار الواجهة)': version,
    'File link (رابط الملف)': `https://github.com/${REPO}/releases/download/${tag}/ota-${version}.zip`,
    'SHA-256': sha256(zip),
    'Oldest APK that runs it (أقل APK بيشغّله)': nativeVersion,
  });
}

function apk() {
  const file = path.join(root, 'OMC-IPTV.apk');
  if (!existsSync(file)) { console.error('OMC-IPTV.apk not found. Build it first with .\\build-apk.cmd'); process.exit(1); }
  const tag = `apk-${nativeVersion}`;
  console.log(`Publishing ${tag} on GitHub...`);
  run('gh', ['release', 'create', tag, file, '--repo', REPO, '--title', `App ${nativeVersion}`, '--notes', `Android app ${nativeVersion}.`]);
  // The download page always links to the same address, so keep one "apk-latest" release with the newest file.
  try { execFileSync('gh', ['release', 'view', 'apk-latest', '--repo', REPO], { stdio: 'ignore', shell: process.platform === 'win32' }); }
  catch { run('gh', ['release', 'create', 'apk-latest', '--repo', REPO, '--title', 'Latest app', '--notes', 'Always the newest Android app. Linked from the download page.']); }
  run('gh', ['release', 'upload', 'apk-latest', file, '--repo', REPO, '--clobber']);
  print({
    'Latest APK version (آخر نسخة APK)': nativeVersion,
    'APK link (رابط تحميل التطبيق)': `https://github.com/${REPO}/releases/download/${tag}/OMC-IPTV.apk`,
    'SHA-256 (optional)': sha256(file),
  });
}

function print(values) {
  console.log('\nPaste these into the dashboard > App settings, then press Save:\n');
  for (const [k, v] of Object.entries(values)) console.log(`  ${k}\n    ${v}\n`);
}

const command = process.argv[2];
if (command === 'ota') ota();
else if (command === 'apk') apk();
else { console.error('Usage: node tools/release.mjs ota [--bump] | apk'); process.exit(1); }
