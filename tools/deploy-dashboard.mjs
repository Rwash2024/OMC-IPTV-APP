// Publishes the admin dashboard to GitHub Pages (the gh-pages branch of this repo).
//   npm run deploy:dashboard
// It builds the dashboard with the public Supabase address and key from dashboard/.env.local, then force-pushes the
// result to the gh-pages branch. The site appears at https://rwash2024.github.io/OMC-IPTV-APP/
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dash = path.join(root, 'dashboard');
const REMOTE = 'https://github.com/Rwash2024/OMC-IPTV-APP.git';
const sh = process.platform === 'win32';
// Only npx needs a shell on Windows. Git gets its arguments as they are, so a commit message with spaces stays one argument.
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: sh && cmd === 'npx' });

console.log('Building the dashboard...');
run('npx', ['vite', 'build', '--base=/OMC-IPTV-APP/'], dash);

const tmp = mkdtempSync(path.join(tmpdir(), 'omc-pages-'));
try {
  cpSync(path.join(dash, 'dist'), tmp, { recursive: true });
  writeFileSync(path.join(tmp, '.nojekyll'), '');
  run('git', ['init', '-q', '-b', 'gh-pages'], tmp);
  run('git', ['add', '-A'], tmp);
  run('git', ['-c', 'user.name=omc-deploy', '-c', 'user.email=deploy@users.noreply.github.com', 'commit', '-q', '-m', 'Deploy dashboard'], tmp);
  console.log('Publishing to GitHub Pages...');
  run('git', ['push', '-f', REMOTE, 'gh-pages'], tmp);
  console.log('\nDone. The dashboard is at https://rwash2024.github.io/OMC-IPTV-APP/ (it can take a minute to appear).');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
