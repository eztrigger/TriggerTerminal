# triggerterminal

一个在本机运行的行情终端和持仓账本。支持中英文界面、IBKR 只读连接、Yahoo Finance 行情与期权链，以及按账户、币种分开的持仓和资金记录。

A local market terminal and holdings ledger with Chinese and English interfaces, read-only IBKR integration, Yahoo Finance quotes and option chains, and account-by-account records in their original currencies.

**[中文使用说明](docs/USER_GUIDE.zh-CN.md) · [English user guide](docs/USER_GUIDE.en.md)**

## 中文

### 可以做什么

- 把图表、行情、自选、新闻和期权链放在同一交易台，保存布局或打开独立窗口。
- 在 IBKR 和 Yahoo Finance 两种行情模式之间切换。
- 手动记录股票、ETF、期权和多腿持仓，填写成本、估值、佣金和资产备注。
- 按账户、币种记录现金、入出金、平仓、行权与已实现盈亏。
- 从本机 IB Gateway / TWS 读取账户和持仓快照。

账本里的操作不会向券商下单。本公开版不包含虚拟币、CSP 筛选和持仓分析；普通股票筛选仍保留。

### 安装和启动

以下命令适用于 macOS / Linux。需要 Node.js 22 或更高版本和 npm。进入源码根目录后运行：

```sh
npm ci
npm run build
```

然后在两个终端中分别启动：

```sh
# 终端一：后台
npm run start -w server
```

```sh
# 终端二：网页
npm run start -w web -- --hostname 127.0.0.1
```

打开 [http://localhost:3000](http://localhost:3000)。使用期间保留两个终端，停止时分别按 `Ctrl+C`。

需要 IBKR 时，再用 Python 3.11 或更高版本安装桥接环境：

```sh
python3 -m venv bridge/.venv
bridge/.venv/bin/python -m pip install -r bridge/requirements.txt
```

没有 IBKR 也可以使用 Yahoo 图表、期权链和手动账本。**选择 Yahoo 后要重启服务，刷新网页不会让新的行情源配置生效。** 当前的代码搜索仍依赖 IBKR；没有连接时可以直接在自选中输入代码，或修改面板标题旁的代码。

完整步骤、界面操作和常见报错见[中文使用说明](docs/USER_GUIDE.zh-CN.md)。macOS 原生窗口是可选项，见[桌面版说明](desktop/README.md)。本包是源码，不是双击即可安装的桌面应用。

### 首次使用与数据

新安装的个人账户、持仓、现金和交易记录为空。默认图表和自选中的代码是通用示例，旧版账本里的 `Main` 是空容器，不含作者的记录。

使用后，账户与账本数据保存在本机 `data/`；布局、自选和语言偏好保存在浏览器或桌面应用中。备份前先停止服务，再复制整个 `data/`。不要把这个目录上传到 GitHub。

这是单用户的本机应用。不要把它当作有用户登录与权限隔离的公共网站部署，也不要把账户数据放到 GitHub Pages。行情和新闻仍会连接外部来源。详见[隐私说明](docs/PRIVACY.md)。

## English

### What it does

- Arrange charts, quotes, watchlists, news and option chains in one workspace, with saved layouts and detached windows.
- Switch between IBKR and Yahoo Finance market-data modes.
- Record stocks, ETFs, options and multiple-leg positions, including costs, valuations, commissions and asset notes.
- Keep cash, deposits, withdrawals, closes, exercise and realized P&L by account and currency.
- Read account and position snapshots from a local IB Gateway / TWS session.

Ledger actions do not send orders to a broker. This public edition excludes cryptocurrency features, CSP screening and portfolio analysis. The ordinary stock screener remains available.

### Install and start

The commands below use a macOS / Linux shell. Install Node.js 22 or later and npm, then run these commands from the source root:

```sh
npm ci
npm run build
```

Start the services in separate terminals:

```sh
# Terminal one: API
npm run start -w server
```

```sh
# Terminal two: web app
npm run start -w web -- --hostname 127.0.0.1
```

Open [http://localhost:3000](http://localhost:3000). Keep both terminals running while using the app. Stop each process with `Ctrl+C`.

For IBKR, install the bridge using Python 3.11 or later:

```sh
python3 -m venv bridge/.venv
bridge/.venv/bin/python -m pip install -r bridge/requirements.txt
```

Yahoo charts, option chains and manual bookkeeping can be used without IBKR. **Restart the services after selecting Yahoo; refreshing the browser does not activate a saved source change.** Symbol search still uses IBKR. Without it, enter a symbol directly in the watchlist or edit a panel's symbol.

See the [English user guide](docs/USER_GUIDE.en.md) for the full setup, daily use and troubleshooting. The [native macOS wrapper](desktop/README.md) is optional. This release is source code, not a ready-made desktop installer.

### First use and storage

A fresh installation has no personal accounts, positions, cash entries or trades. Initial chart and watchlist symbols are general examples. The legacy `Main` container is empty and contains no author records.

After you use the app, account and ledger data live in the local `data/` folder. Layouts, watchlists and language preferences live in browser or native-app storage. Stop the services before backing up the entire `data/` folder. Do not upload it to GitHub.

This is a single-user local application, without the user authentication and account isolation needed for a public hosted service. Do not deploy private records to GitHub Pages. Market data and news still contact external providers. See the [privacy document](docs/PRIVACY.md).

## 文档 / Documentation

| 文档 / Document | 内容 / Contents |
| --- | --- |
| [中文使用说明](docs/USER_GUIDE.zh-CN.md) | 安装、行情、期权链、持仓、记账、备份和排错 |
| [English user guide](docs/USER_GUIDE.en.md) | Setup, market data, options, holdings, bookkeeping, backups and troubleshooting |
| [账本规则 / Ledger reference](docs/HOLDINGS_LEDGER.md) | 现金与盈亏计算、交割及更正 / Cash, P&L, delivery and corrections |
| [隐私说明 / Privacy](docs/PRIVACY.md) | 本地存储与外部请求 / Local storage and external requests |
| [桌面窗口 / macOS wrapper](desktop/README.md) | 可选原生窗口的构建 / Building the optional native wrapper |
| [上传检查清单 / Upload checklist](scripts/release/RELEASE-CHECKLIST.md) | 发布包的范围与上传前检查 / Release scope and upload checks |

## 开发与源码导出 / Development and source export

```sh
npm test
npm run build
node --test scripts/public-release.test.mjs
```

安装 Python 桥接依赖后，可运行桥接测试。After installing the Python bridge dependencies, run its tests with:

```sh
bridge/.venv/bin/python -m unittest discover -s bridge -p 'test_*.py'
```

界面改动须同时支持中英文，见 [AGENTS.md](AGENTS.md)。Interface changes must support both languages.

导出到一个尚不存在的新目录：Export to a new destination that does not already exist:

```sh
node scripts/public-release.mjs ../triggerterminal-public-new
```

导出工具使用源码白名单，生成目录、ZIP 和校验清单，不复制数据库、密钥、运行日志或旧 Git 历史。以后新增文件时，检查并更新 `scripts/public-release-files.json`。只上传导出的目录内容，不要上传自己的运行目录。

The exporter creates a source folder, ZIP and checksum list from an explicit manifest. It excludes databases, keys, runtime logs and old Git history. Review and update `scripts/public-release-files.json` when adding files. Upload the export, not your working installation.

`SOURCE-SHA256SUMS.txt` 记录的是安装和构建之前的源码校验值。It records source checksums before installation and building.

## 来源与许可 / Credits and license

基于 [ErTasselli/OpenTerminal](https://github.com/ErTasselli/OpenTerminal)，主项目使用 MIT 许可证，见 [LICENSE](LICENSE)。改编的 IBKR 代码位于 `bridge/ibkr_market_worker.py`，其 Apache-2.0 许可与来源见 [第三方声明](THIRD_PARTY_NOTICES.md)。上游应用源码不再随项目分发。

Based on [ErTasselli/OpenTerminal](https://github.com/ErTasselli/OpenTerminal). The main project is MIT licensed; see [LICENSE](LICENSE). Adapted IBKR code lives in `bridge/ibkr_market_worker.py`; its Apache-2.0 license and attribution are listed in [Third-party notices](THIRD_PARTY_NOTICES.md). The upstream application source is no longer bundled.

行情数据可能缺失、延迟或受权限限制。账本用于投资记录，不提供投资建议，也不替代券商对账单或税务核算。

Market data can be missing, delayed or permission-limited. The ledger is an investment record, not investment advice, a broker statement or tax accounting.
