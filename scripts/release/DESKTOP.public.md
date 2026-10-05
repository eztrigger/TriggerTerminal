# 桌面安装包 / Desktop installers

## 给使用者 / For users

安装包内置 Node.js、Python 和应用依赖。使用者不需要命令行、npm 或 Python。IBKR Gateway / TWS 是独立的券商软件，使用 IBKR 数据时仍需自行安装、登录并打开 API；只使用 Yahoo Finance 图表与期权链时不需要连接 IBKR。

The installers include Node.js, Python and application dependencies. Users do not need a terminal, npm or Python. IBKR Gateway / TWS is separate broker software: install it, sign in and enable its API to use IBKR data. Yahoo Finance charts and option chains do not require an IBKR connection.

- **Apple 芯片 Mac / Apple silicon Mac:** `TriggerTerminal-0.1.0-mac-arm64.dmg`
- **Windows 10/11 x64:** `TriggerTerminal-0.1.0-win-x64.exe`

Mac：打开 DMG，把 TriggerTerminal 拖到 Applications（应用程序），弹出安装盘，再从“应用程序”双击打开。桌面包最低支持 macOS 14。Windows：双击 EXE，选择安装位置并完成安装，以后从开始菜单或桌面快捷方式打开。Windows ARM 原生包暂未提供。

On Mac, open the DMG, drag TriggerTerminal to Applications, eject the disk image, then launch it from Applications. The desktop package requires macOS 14 or later. On Windows, open the EXE, choose an installation location and finish setup. Launch it later from the Start menu or desktop shortcut. A native Windows ARM installer is not included.

首次启动的账户、持仓、现金和交易记录为空。程序不会读取开发者的交易台数据，也不需要先联网下载运行环境。行情和新闻仍然需要网络。

Accounts, positions, cash balances and transaction records start empty. The app does not read the developer's trading-terminal data or download runtimes on first launch. Market data and news still require internet access.

### 当前签名状态 / Signing status

没有配置签名证书时，构建产物为测试版，可能触发 macOS Gatekeeper 或 Windows SmartScreen 提示。正式向客户分发前，建议使用下述签名流程。不要要求使用者关闭系统安全保护。

Builds made without signing credentials are test builds and may trigger macOS Gatekeeper or Windows SmartScreen. Use the signing steps below before broad customer distribution. Do not ask users to disable system security protections.

### 数据与升级 / Data and upgrades

通过应用菜单中的“打开数据文件夹 / Open data folder”查看本机账本与配置。默认位置：

Use the app menu's “Open data folder” to find the local ledger and configuration. Default locations:

- macOS: `~/Library/Application Support/TriggerTerminal/data`
- Windows: `%APPDATA%/TriggerTerminal/data`

工作区布局、语言等浏览器设置保存在同一应用用户目录的浏览器配置中。完整迁移时应退出应用，再备份整个 `TriggerTerminal` 用户目录。不要将这个目录上传到 GitHub。替换 Mac 应用或运行新版 Windows 安装程序会保留数据；Windows 卸载默认也保留用户数据。本版不自动更新，请手动安装后续版本。

Workspace layout, language and other browser settings live in the same application user directory. Quit the app and back up the entire `TriggerTerminal` user directory for a complete migration. Do not upload it to GitHub. Replacing the Mac application or installing a newer Windows version preserves data; the Windows uninstaller also leaves user data in place by default. This version uses manual updates.

## 构建 / Building

在目标系统及架构上构建。Apple 芯片 Mac 生成 arm64，Windows x64 生成 Windows 安装程序。需要 Node 22、Git，以及原生依赖需要时的编译工具；使用者不需要这些工具。

Build on the target OS and architecture. Apple silicon Macs produce arm64 builds, and Windows x64 produces the Windows installer. Builders need Node 22, Git and native compilation tools if required by a dependency; end users do not.

```sh
npm ci
npm run build
npm run desktop:prepare
npm run desktop:package
```

输出在 `releases/desktop`。准备脚本只复制明确列出的代码、生产依赖和新下载的运行环境，不复制本地 `data`、浏览器配置或密钥。Node 和 Python 下载版本及 SHA-256 固定在 `desktop/runtime-lock.json`，Python 依赖固定在 `desktop/python-requirements.txt`。每个安装包保留随运行环境分发的许可文件。

Output is written to `releases/desktop`. Preparation copies an explicit set of application files, production dependencies and freshly downloaded runtimes. It does not copy local data, browser profiles or keys. Node and Python versions and SHA-256 checksums are pinned in `desktop/runtime-lock.json`; Python dependencies are pinned in `desktop/python-requirements.txt`. Runtime license files remain in each installer.

`npm run desktop:start` 可从准备好的运行环境启动开发版桌面窗口。`desktop/main.swift` 是旧的可选 macOS 窗口启动器；新版安装包使用 Electron 入口 `desktop/main.cjs`，不再依赖外置源码目录。

`npm run desktop:start` launches the development desktop shell using the prepared runtime. `desktop/main.swift` is the legacy optional macOS wrapper. New installers use `desktop/main.cjs` and do not depend on an external source checkout.

### GitHub 构建 / GitHub builds

进入仓库 Actions → Desktop installers → Run workflow。两个任务分别生成 Apple 芯片 Mac 和 Windows x64 安装包，并启动实际打包应用检查页面、空白账户和退出后的服务清理。Windows 还会先运行安装程序。结果保存在该次运行的 Artifacts 中；确认后可放入 GitHub Releases 供用户下载。

Open Actions → Desktop installers → Run workflow. Separate jobs build Apple silicon Mac and Windows x64 installers, then launch the packaged app to check the page, empty accounts and service cleanup. Windows also runs the installer first. Downloads appear under that run's Artifacts; validated packages can then be attached to a GitHub Release.

### 签名 / Signing

macOS 需要 Apple Developer Program 的 Developer ID Application 证书和公证凭据。GitHub repository secrets：`CSC_LINK`（P12 证书的 Base64 内容）、`CSC_KEY_PASSWORD`、`APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID`。不要提交证书或密码到仓库。Windows 可配置 `WIN_CSC_LINK` 与 `WIN_CSC_KEY_PASSWORD`；硬件或云签名服务需按所选服务扩展工作流。

macOS distribution uses an Apple Developer Program Developer ID Application certificate and notarization credentials. Set repository secrets `CSC_LINK` (Base64-encoded P12), `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`. Never commit certificates or passwords. Windows certificate signing uses `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`; hardware or cloud signing requires adapting the workflow to that service.

## 启动问题 / Startup problems

启动失败时，提示框会给出日志目录，文件名为 `desktop-api.log` 和 `desktop-web.log`。应用自动避开被占用的默认端口；请勿修改应用包内部文件。切换行情源后，点击应用中的“重启”让设置生效。IBKR 无法连接时检查 Gateway / TWS 的登录状态、API 开关、端口及 Client ID。

Startup errors show the log directory containing `desktop-api.log` and `desktop-web.log`. The app chooses available local ports; do not edit files inside the installed application. After changing the market source, use Restart in the app. For IBKR connection errors, check the Gateway / TWS login, API setting, port and Client ID.
