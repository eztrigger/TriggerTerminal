import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync, renameSync, existsSync, readdirSync, lstatSync } from 'node:fs';
import { join, resolve, dirname, delimiter, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stage = join(root, '.desktop-stage');
const runtime = join(stage, 'runtime');
const lock = JSON.parse(readFileSync(join(root, 'desktop/runtime-lock.json')));
const target = lock.platforms[`${process.platform}-${process.arch}`];
if (!target) throw new Error('Build on macOS arm64/x64 or Windows x64.');
if (!existsSync(join(root, 'web/.next/BUILD_ID')) || !existsSync(join(root, 'server/dist/index.js'))) throw new Error('Run npm run build first.');
const cache = join(root, '.desktop-cache'); mkdirSync(cache, { recursive: true });
async function download(url, name, hash) {
  const file = join(cache, name);
  if (!existsSync(file)) {
    console.log('Downloading ' + name);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed: ${response.status} ${url}`);
    writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  }
  if (createHash('sha256').update(readFileSync(file)).digest('hex') !== hash) { rmSync(file); throw new Error('Runtime checksum mismatch: ' + name); }
  return file;
}
const nodeArchive = await download(`https://nodejs.org/dist/v${lock.nodeVersion}/${target.nodeFile}`, target.nodeFile, target.nodeSha256);
const pythonFile = `cpython-${lock.pythonVersion}+${lock.pythonRelease}-${target.pythonTarget}-install_only_stripped.tar.gz`;
const pythonArchive = await download(`https://github.com/astral-sh/python-build-standalone/releases/download/${lock.pythonRelease}/${encodeURIComponent(pythonFile)}`, pythonFile, target.pythonSha256);
rmSync(stage, { recursive: true, force: true }); mkdirSync(runtime, { recursive: true });
execFileSync('tar', ['-xf', nodeArchive, '-C', stage]);
renameSync(join(stage, target.nodeFile.replace(/\.(tar.gz|zip)$/, '')), join(runtime, 'node'));
execFileSync('tar', ['-xf', pythonArchive, '-C', runtime]);
const node = join(runtime, 'node', process.platform === 'win32' ? 'node.exe' : 'bin/node');
const python = join(runtime, 'python', process.platform === 'win32' ? 'python.exe' : 'bin/python3');
const npm = join(runtime, 'node', process.platform === 'win32' ? 'node_modules/npm/bin/npm-cli.js' : 'lib/node_modules/npm/bin/npm-cli.js');
const env = { ...process.env, PATH: dirname(node) + delimiter + process.env.PATH, PYTHONDONTWRITEBYTECODE: '1', PYTHONNOUSERSITE: '1', NEXT_TELEMETRY_DISABLED: '1' };
for (const key of ['NODE_OPTIONS', 'NODE_PATH', 'PYTHONPATH', 'PYTHONHOME']) delete env[key];
for (const name of ['package.json', 'package-lock.json', 'server/package.json', 'web/package.json', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) {
  mkdirSync(dirname(join(runtime, name)), { recursive: true }); cpSync(join(root, name), join(runtime, name));
}
for (const name of ['licenses', 'docs', 'server/dist']) cpSync(join(root, name), join(runtime, name), { recursive: true, filter: p => !p.endsWith('.map') });
mkdirSync(join(runtime, 'bridge'));
for (const name of ['ibkr.py', 'ibkr_market_worker.py', 'watchlist_worker.py']) cpSync(join(root, 'bridge', name), join(runtime, 'bridge', name));
cpSync(join(root, 'web/.next'), join(runtime, 'web/.next'), { recursive: true, filter: p => !['cache', 'dev', 'diagnostics'].includes(basename(p)) && !p.endsWith('.map') });
if (existsSync(join(root, 'web/public'))) cpSync(join(root, 'web/public'), join(runtime, 'web/public'), { recursive: true });
// Production dependencies are installed from the source lock with the bundled Node ABI.
execFileSync(node, [npm, 'ci', '--omit=dev', '--no-audit', '--no-fund'], { cwd: runtime, env, stdio: 'inherit' });
execFileSync(python, ['-m', 'pip', 'install', '--no-cache-dir', '--only-binary=:all:', '-r', join(root, 'desktop/python-requirements.txt')], { env, stdio: 'inherit' });
execFileSync(python, ['-c', 'import ssl, sqlite3, zoneinfo, ib_async, numpy; print("Bundled Python OK")'], { env, stdio: 'inherit' });
execFileSync(node, ['-e', "const D=require('better-sqlite3');const d=new D(':memory:');d.close();console.log('Bundled SQLite OK')"], { cwd: runtime, env, stdio: 'inherit' });
cpSync(join(root, 'desktop/service-host.cjs'), join(runtime, 'service-host.cjs'));
const shell = join(stage, 'shell'); mkdirSync(join(shell, 'desktop'), { recursive: true });
for (const name of ['main.cjs', 'preload.cjs', 'service-host.cjs']) cpSync(join(root, 'desktop', name), join(shell, 'desktop', name));
const pkg = JSON.parse(readFileSync(join(root, 'package.json')));
writeFileSync(join(shell, 'package.json'), JSON.stringify({ name: 'triggerterminal', version: pkg.version, description: 'A local market terminal and investment journal', author: 'TriggerTerminal contributors', license: 'MIT', main: 'desktop/main.cjs' }, null, 2));
await sharp(join(root, 'desktop/icon.svg')).resize(1024, 1024).png().toFile(join(stage, 'icon.png'));
// Explicit app inputs only. Dependencies may contain public test fixtures, but no local state is copied.
for (const name of ['data', '.env', '.git', '.api-key']) if (existsSync(join(runtime, name))) throw new Error('Private runtime state in package: ' + name);
console.log(`Desktop runtime ready: ${process.platform}-${process.arch}`);
