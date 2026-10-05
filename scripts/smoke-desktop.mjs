import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, cpSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
const binary = resolve(process.argv[2]);
const testDir = mkdtempSync(join(tmpdir(), 'triggerterminal-desktop-smoke-'));
console.log('Smoke profile: ' + testDir);
// Relocate outside the checkout: otherwise Node can accidentally resolve missing
// packaged dependencies from the developer's parent node_modules directory.
const installDir = join(testDir, 'Installed App'); mkdirSync(installDir);
const appRoot = process.platform === 'darwin' ? resolve(dirname(binary), '../..') : dirname(binary);
const relocated = join(installDir, process.platform === 'darwin' ? 'TriggerTerminal.app' : 'TriggerTerminal');
cpSync(appRoot, relocated, { recursive: true, verbatimSymlinks: true });
const installedBinary = process.platform === 'darwin' ? join(relocated, 'Contents/MacOS/TriggerTerminal') : join(relocated, 'TriggerTerminal.exe');
const child = spawn(installedBinary, ['--smoke-test'], { env: { ...process.env, TRIGGERTERMINAL_TEST_DIR: testDir }, stdio: 'inherit' });
const timer = setTimeout(() => { child.kill(); console.error('Desktop smoke test timed out'); process.exit(1); }, 120000);
child.on('error', error => { clearTimeout(timer); console.error(error); process.exitCode = 1; });
child.on('exit', code => {
  clearTimeout(timer);
  const file = join(testDir, 'smoke-result.json');
  const result = existsSync(file) ? JSON.parse(readFileSync(file)) : { ok: false, error: 'No smoke result' };
  console.log(JSON.stringify(result));
  if (code !== 0 || !result.ok) process.exitCode = 1;
  for (const pid of result.pids || []) {
    try { process.kill(pid, 0); console.error('Service still running: ' + pid); process.exitCode = 1; } catch {}
  }
});
