const path = require('node:path');
const fs = require('node:fs');
// The bundled runtimes make ultra compression slow on hosted Windows runners.
// Keep a normal compression level unless the builder explicitly overrides it.
if (process.platform === 'win32' && !process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL) {
  process.env.ELECTRON_BUILDER_COMPRESSION_LEVEL = '5';
}
// Missing optional GitHub secrets arrive as empty strings, not undefined.
for (const key of ['CSC_LINK', 'CSC_KEY_PASSWORD', 'WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD', 'APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']) {
  if (process.env[key] === '') delete process.env[key];
}
module.exports = {
  appId: 'com.eztrigger.triggerterminal', productName: 'TriggerTerminal',
  directories: { app: '.desktop-stage/shell', output: 'releases/desktop', buildResources: '.desktop-stage' },
  files: ['package.json', 'desktop/*.cjs'], asar: true, npmRebuild: false,
  // Copy the complete isolated production tree before code signing. Generic file
  // filters omit node_modules; these are Node's dependencies, not Electron's.
  afterPack: async context => {
    const resources = context.electronPlatformName === 'darwin'
      ? path.join(context.appOutDir, 'TriggerTerminal.app', 'Contents', 'Resources')
      : path.join(context.appOutDir, 'resources');
    const sourceRoot = fs.realpathSync(path.join(__dirname, '../.desktop-stage/runtime'));
    const destination = path.join(resources, 'runtime');
    fs.rmSync(destination, { recursive: true, force: true });
    // Materialize runtime symlinks explicitly. Absolute build-machine links are
    // invalid in signed apps and would break Python after dragging the app.
    const copy = (source, target) => {
      const actual = fs.realpathSync(source);
      if (actual !== sourceRoot && !actual.startsWith(sourceRoot + path.sep)) throw new Error('Runtime link escapes package: ' + source);
      const info = fs.statSync(source);
      if (info.isDirectory()) {
        fs.mkdirSync(target, { recursive: true });
        for (const name of fs.readdirSync(source)) copy(path.join(source, name), path.join(target, name));
      } else {
        fs.copyFileSync(source, target);
        fs.chmodSync(target, info.mode & 0o777);
      }
    };
    copy(sourceRoot, destination);
  },
  artifactName: 'TriggerTerminal-${version}-${os}-${arch}.${ext}',
  mac: { target: ['dmg'], category: 'public.app-category.finance', icon: '.desktop-stage/icon.png', minimumSystemVersion: '14.0', identity: process.env.CSC_LINK ? undefined : '-', hardenedRuntime: Boolean(process.env.CSC_LINK), notarize: Boolean(process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID) },
  dmg: { title: 'TriggerTerminal', contents: [{ x: 150, y: 160, type: 'file' }, { x: 450, y: 160, type: 'link', path: '/Applications' }] },
  win: { target: ['nsis'], icon: '.desktop-stage/icon.png' },
  // Updates are manual, so differential 7z payloads only add build time here.
  nsis: { differentialPackage: false, useZip: true, oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true, createDesktopShortcut: true, createStartMenuShortcut: true, deleteAppDataOnUninstall: false, installerLanguages: ['en_US', 'zh_CN'], displayLanguageSelector: true },
  publish: null,
};
