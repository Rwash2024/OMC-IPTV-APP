// Builds the Smart TV versions of the app.
//   npm run build:tv
// Produces:
//   tv/build/tizen/   Samsung project folder (open it in Tizen Studio, or package it with the Tizen CLI)
//   tv/build/webos/   LG project folder
//   release/*.ipk     the LG installable package, made with LG's ares-package (no TV needed to build it)
//   release/OMC-IPTV-tizen-project.zip   the Samsung folder zipped for Tizen Studio
// Installing on a real TV needs the TV in developer mode; see tv/README.md.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const win = process.platform === 'win32';
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit', shell: win && /^(npx|npm)$/.test(cmd), ...opts });

const icon = (size) => new Resvg(readFileSync(path.join(root, 'public/icon.svg')), { fitTo: { mode: 'width', value: size } }).render().asPng();

function buildWeb(target) {
  rmSync(path.join(root, 'dist-tv'), { recursive: true, force: true });
  run('npx', ['vite', 'build', '--mode', 'tv'], { env: { ...process.env, TV_TARGET: target } });
}

function assemble(target, files) {
  const out = path.join(root, 'tv/build', target);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(path.join(root, 'dist-tv'), out, { recursive: true });
  for (const [name, content] of Object.entries(files)) writeFileSync(path.join(out, name), content);
  return out;
}

// ---- Samsung (Tizen) ----
console.log('\n== Samsung TV ==');
buildWeb('tizen');
const tizenDir = assemble('tizen', {
  'icon.png': icon(117),
  'config.xml': `<?xml version="1.0" encoding="UTF-8"?>
<widget xmlns="http://www.w3.org/ns/widgets" xmlns:tizen="http://tizen.org/ns/widgets" id="http://omc-iptv.app/omciptv" version="${version}" viewmodes="maximized">
  <tizen:application id="OMCIPTV001.OMCIPTV" package="OMCIPTV001" required_version="5.0"/>
  <content src="index.html"/>
  <feature name="http://tizen.org/feature/screen.size.all"/>
  <icon src="icon.png"/>
  <name>OMC IPTV</name>
  <tizen:profile name="tv"/>
  <tizen:setting screen-orientation="landscape" context-menu="disable" background-support="disable" encryption="disable" install-location="auto" hwkey-event="enable"/>
  <access origin="*" subdomains="true"/>
  <tizen:privilege name="http://tizen.org/privilege/internet"/>
  <tizen:privilege name="http://developer.samsung.com/privilege/network.public"/>
  <tizen:privilege name="http://developer.samsung.com/privilege/productinfo"/>
  <tizen:privilege name="http://tizen.org/privilege/tv.inputdevice"/>
</widget>
`,
});
mkdirSync(path.join(root, 'release'), { recursive: true });
const tizenZip = path.join(root, 'release/OMC-IPTV-tizen-project.zip');
rmSync(tizenZip, { force: true });
const tar = win ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
run(`"${tar}"`, ['-a', '-c', '-f', `"${tizenZip}"`, '-C', `"${tizenDir}"`, ...readdirSync(tizenDir).map((n) => `"${n}"`)], { shell: win });
console.log(`Samsung project folder: ${tizenDir}`);

// ---- LG (webOS) ----
console.log('\n== LG TV ==');
buildWeb('webos');
const webosDir = assemble('webos', {
  'icon.png': icon(80),
  'largeIcon.png': icon(130),
  'appinfo.json': JSON.stringify({
    id: 'com.omc.iptv', version, vendor: 'OMC', type: 'web', main: 'index.html', title: 'OMC IPTV',
    icon: 'icon.png', largeIcon: 'largeIcon.png', bgColor: '#0a0c15', iconColor: '#E8301C', resolution: '1920x1080', disableBackHistoryAPI: true,
  }, null, 2) + '\n',
});
try {
  const ares = path.join(root, 'node_modules/.bin', win ? 'ares-package.cmd' : 'ares-package');
  run(win ? `"${ares}"` : ares, [`"${webosDir}"`, '-o', `"${path.join(root, 'release')}"`], { shell: win });
  console.log('LG package written to release/');
} catch {
  console.log('Could not run ares-package. The LG project folder is ready at ' + webosDir);
}
rmSync(path.join(root, 'dist-tv'), { recursive: true, force: true });
console.log('\nDone. See tv/README.md for how to install on a TV.');
