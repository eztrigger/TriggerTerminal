const { app, BrowserWindow, Menu, ipcMain, dialog, shell, session } = require('electron');
const { spawn } = require('node:child_process');
const { createServer } = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const smoke = process.argv.includes('--smoke-test');
app.setName('TriggerTerminal');
if (smoke && process.env.TRIGGERTERMINAL_TEST_DIR) app.setPath('userData', process.env.TRIGGERTERMINAL_TEST_DIR);
const home = app.getPath('userData');
const data = path.join(home, 'data');
const settingsPath = path.join(home, 'desktop-settings.json');
const runtime = app.isPackaged ? path.join(process.resourcesPath, 'runtime') : path.join(__dirname, '../.desktop-stage/runtime');
let settings = {};
try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')); } catch {}
let english = settings.language === 'en';
const L = (zh, en) => english ? en : zh;
let children = [], origin = '', stopping = false, busy = false, ready = false;
const save = () => fs.writeFileSync(settingsPath, JSON.stringify(settings), { mode: 0o600 });
const local = url => { try { return Boolean(origin) && new URL(url).origin === origin; } catch { return false; } };
const trusted = event => local(event.senderFrame?.url) && event.senderFrame === event.sender.mainFrame;
function external(url) { try { if (['https:', 'http:'].includes(new URL(url).protocol)) void shell.openExternal(url); } catch {} }
function menu() {
  const file = { label: L('应用', 'App'), submenu: [
    { label: L('新交易台', 'New terminal'), accelerator: 'CmdOrCtrl+N', click: () => ready && windowAt('/') },
    { label: L('仓位与分析', 'Positions & analysis'), accelerator: 'CmdOrCtrl+1', click: () => ready && windowAt('/holdings') },
    { type: 'separator' }, { label: L('打开数据文件夹', 'Open data folder'), click: () => shell.openPath(data) },
    { label: L('重启', 'Restart'), click: restart },
    { type: 'separator' }, { label: L('退出', 'Quit'), accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
  ] };
  Menu.setApplicationMenu(Menu.buildFromTemplate([file, { label: L('编辑', 'Edit'), submenu: [
    { role: 'undo', label: L('撤销', 'Undo') }, { role: 'redo', label: L('重做', 'Redo') }, { type: 'separator' },
    { role: 'cut', label: L('剪切', 'Cut') }, { role: 'copy', label: L('复制', 'Copy') }, { role: 'paste', label: L('粘贴', 'Paste') }, { role: 'selectAll', label: L('全选', 'Select all') },
  ] }, { label: L('窗口', 'Window'), submenu: [{ role: 'minimize', label: L('最小化', 'Minimize') }, { role: 'togglefullscreen', label: L('全屏', 'Full screen') }] }]));
}
function windowAt(route) {
  const win = new BrowserWindow({ width: 1280, height: 820, minWidth: 500, minHeight: 350, title: 'TriggerTerminal', backgroundColor: '#0d1016', show: !smoke,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (local(url)) windowAt(new URL(url).pathname + new URL(url).search); else external(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (event, url) => { if (!local(url)) { event.preventDefault(); external(url); } });
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  if (ready) void win.loadURL(origin + route);
  else void win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<html><body style="background:#0d1016;color:#e8ecf4;font:18px system-ui;display:grid;place-content:center;height:90vh"><h1>TriggerTerminal</h1><p>正在启动… / Starting…</p></body></html>'));
  return win;
}
function freePort(preferred) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', error => { if (preferred && error.code === 'EADDRINUSE') resolve(freePort(0)); else reject(error); });
    server.listen(preferred, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
  });
}
function launch(entry, args, cwd, env, label) {
  const logPath = path.join(data, `desktop-${label}.log`);
  if (fs.existsSync(logPath) && fs.statSync(logPath).size > 2 * 1024 * 1024) fs.renameSync(logPath, logPath + '.previous');
  const fd = fs.openSync(logPath, 'a', 0o600);
  const node = path.join(runtime, 'node', process.platform === 'win32' ? 'node.exe' : 'bin/node');
  const child = spawn(node, [path.join(runtime, 'service-host.cjs'), entry, ...args], { cwd, env, detached: process.platform !== 'win32', windowsHide: true, stdio: ['ignore', fd, fd, 'ipc'] });
  fs.closeSync(fd); children.push(child);
  child.on('error', error => { child.launchError = error; });
  return child;
}
async function stopServices() {
  ready = false;
  const owned = children.splice(0);
  await Promise.all(owned.map(child => new Promise(resolve => {
    if (!child.pid || child.exitCode !== null) return resolve();
    const finish = () => resolve(); child.once('exit', finish);
    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      killer.on('error', () => { child.kill(); });
    } else { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
    setTimeout(() => { try { process.platform === 'win32' ? child.kill() : process.kill(-child.pid, 'SIGKILL'); } catch {} resolve(); }, 3000).unref();
  })));
}
async function startServices() {
  const apiPort = await freePort(43100);
  const webPort = await freePort(settings.webPort || 43101);
  settings.webPort = webPort; save(); origin = `http://127.0.0.1:${webPort}`;
  const env = { ...process.env, NODE_ENV: 'production', API_HOST: '127.0.0.1', API_PORT: String(apiPort), API_URL: `http://127.0.0.1:${apiPort}`, PORT: String(webPort), WEB_ORIGIN: origin,
    DATA_DIR: data, API_KEY_FILE: path.join(data, '.api-key'), NEXT_TELEMETRY_DISABLED: '1', PYTHONDONTWRITEBYTECODE: '1', PYTHONNOUSERSITE: '1',
    PYTHON_EXECUTABLE: path.join(runtime, 'python', process.platform === 'win32' ? 'python.exe' : 'bin/python3') };
  // Never inherit an unrelated development service's secrets or module injection flags.
  for (const key of ['API_KEY', 'NODE_OPTIONS', 'NODE_PATH', 'PYTHONHOME', 'PYTHONPATH', 'ELECTRON_RUN_AS_NODE']) delete env[key];
  launch(path.join(runtime, 'server/dist/index.js'), [], runtime, env, 'api');
  launch(path.join(runtime, 'node_modules/next/dist/bin/next'), ['start', '--hostname', '127.0.0.1', '--port', String(webPort)], path.join(runtime, 'web'), env, 'web');
  for (let attempt = 0; attempt < 120; attempt++) {
    const failed = children.find(c => c.launchError || c.exitCode !== null);
    if (failed) throw new Error(failed.launchError?.message || L('启动进程已退出。', 'A startup process exited.'));
    try {
      const response = await fetch(origin + '/api/status', { signal: AbortSignal.timeout(1000) });
      if (response.ok && (await response.json()).ok) { ready = true; return; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(L('启动超时。', 'Startup timed out.'));
}
async function fail(error) {
  await stopServices();
  if (smoke) { fs.writeFileSync(path.join(home, 'smoke-result.json'), JSON.stringify({ ok: false, error: String(error) })); app.exit(1); return; }
  dialog.showErrorBox(L('启动失败', 'Startup failed'), `${error.message}\n\n${L('日志位置：', 'Logs: ')}${data}`); app.quit();
}
async function restart() {
  if (busy || !ready) return;
  const answer = await dialog.showMessageBox({ type: 'question', message: L('重启 TriggerTerminal？', 'Restart TriggerTerminal?'), detail: L('未保存的编辑会丢失。IBKR Gateway 不受影响。', 'Unsaved edits will be lost. IBKR Gateway is unaffected.'), buttons: [L('取消', 'Cancel'), L('重启', 'Restart')], defaultId: 0, cancelId: 0 });
  if (answer.response !== 1) return;
  busy = true;
  const routes = BrowserWindow.getAllWindows().map(win => [win, new URL(win.webContents.getURL()).pathname + new URL(win.webContents.getURL()).search]);
  try { await stopServices(); await startServices(); for (const [win, route] of routes) if (!win.isDestroyed()) await win.loadURL(origin + route); } catch (e) { await fail(e); } finally { busy = false; }
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const win = BrowserWindow.getAllWindows()[0]; if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', event => { if (!stopping) { event.preventDefault(); stopping = true; void stopServices().then(() => app.quit()); } });
  app.whenReady().then(async () => {
    fs.mkdirSync(data, { recursive: true, mode: 0o700 });
    if (smoke) fs.writeFileSync(path.join(data, 'ibkr.json'), JSON.stringify({ port: 1, clientId: 71 }));
    menu();
    session.defaultSession.setPermissionRequestHandler((_web, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    ipcMain.on('terminal:language', (event, value) => { if (trusted(event) && ['en', 'zh-CN'].includes(value)) { english = value === 'en'; settings.language = value; save(); menu(); } });
    ipcMain.on('terminal:restart', event => { if (trusted(event)) void restart(); });
    const win = windowAt('/');
    try {
      await startServices(); await win.loadURL(origin + '/');
      if (smoke) {
        const response = await fetch(origin + '/api/holdings'); const holdings = await response.json();
        if (!response.ok || holdings.accounts?.length !== 0 || holdings.holdings?.length !== 0) throw new Error('Fresh install is not empty');
        win.showInactive();
        const waitForUI = async () => {
          for (let i = 0; i < 80; i++) {
            if (await win.webContents.executeJavaScript("document.querySelectorAll('.application-shell button').length >= 3 && document.body.innerText.length > 100")) return;
            await new Promise(resolve => setTimeout(resolve, 250));
          }
          throw new Error('Application UI did not render');
        };
        await waitForUI();
        await new Promise(resolve => setTimeout(resolve, 500));
        fs.writeFileSync(path.join(home, 'smoke-zh.png'), (await win.webContents.capturePage()).toPNG());
        await win.webContents.executeJavaScript("localStorage.setItem('openterminal-language','en')");
        await win.loadURL(origin + '/'); await waitForUI();
        win.setSize(600, 800);
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!english) throw new Error('Native language bridge failed');
        fs.writeFileSync(path.join(home, 'smoke-en.png'), (await win.webContents.capturePage()).toPNG());
        await fetch(origin + '/api/market-source', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'yahoo' }) });
        const oldPids = children.map(c => c.pid);
        await stopServices(); await startServices();
        const source = await (await fetch(origin + '/api/market-source')).json();
        if (source.active !== 'yahoo') throw new Error('Market source did not persist across service restart');
        for (const pid of oldPids) { let alive = false; try { process.kill(pid, 0); alive = true; } catch {} if (alive) throw new Error('Restart left an old service running'); }

        fs.writeFileSync(path.join(home, 'smoke-result.json'), JSON.stringify({ ok: true, platform: process.platform, arch: process.arch, title: await win.webContents.executeJavaScript('document.title'), accounts: 0, positions: 0, pids: children.map(c => c.pid) }));
        app.quit();
      }
    } catch (error) { await fail(error); }
  });
}
