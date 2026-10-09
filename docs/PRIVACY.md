# Local Data and Public Releases / 本地数据与公开发布

## Storage

- `data/holdings.db`: account identifiers, positions, asset notes, cash, P&L and ledger events.
- `data/terminal.db`: legacy portfolio records.
- `data/crypto.db`: private wallet address labels, read-only balance snapshots, manual crypto positions, cash and audit records. No private keys or seed phrases are accepted. Public wallet reads send the address to the selected network's public data service; asset pricing uses public token identifiers.
- `data/ibkr.json`, `data/market-source.json`: local connection and provider preferences.
- `data/.api-key`: generated local API authentication secret.
- Other `data/` files: local backups, logs and historical runtime state. Treat the entire directory as private.
- Browser localStorage/sessionStorage and macOS WebKit/UserDefaults: layouts, watchlists,
  preferences and other client state. These are not part of a source release.
- `DATA_DIR` can override the server storage location. Such external directories also remain private.

## Network Boundaries

Account/ledger storage is local; publishing source does not upload that storage.
The application is not fully offline: market queries send symbols/contracts to IBKR
or public providers, and news/video widgets contact external services. The legacy
optional AI API, if configured and explicitly called, sends the submitted messages
and context to its AI provider. Never submit account data to that endpoint unless
you intend to share it. The source exporter itself makes no network request.

This distribution is for a single user on localhost. The web proxy has access to the
local API secret; its presence does not make a publicly exposed web UI safe for private
accounts. Keep both services on loopback. Local databases are not encrypted by this
application; protect your device and backups.

## Publication Procedure

1. Export with `node scripts/public-release.mjs /path/to/new/source-directory`.
2. Inspect the new directory and its source checksum manifest.
3. Create a new repository from that directory, with new Git history.
4. Do not add databases, environment files, logs, screenshots of real accounts,
   browser exports, application bundles, old Git history or backup folders.
5. Re-run privacy checks before each release. Automated checks reduce risk but are
   not a guarantee against every possible secret format or future code change.

The export manifest includes only reviewed source files. Ignoring a file does not
remove it from an existing Git commit, which is why the original Git history is excluded.
If a secret has already been published elsewhere, removing a file is insufficient;
revoke or rotate the credential and handle the old public history separately.

## 中文

账户、持仓、现金、盈亏及笔记在本机数据库中；连接设置、密钥、备份和日志也属于隐私。
浏览器和桌面应用的布局、偏好不随源码发布。DATA_DIR 指定的其他位置同样不能上传。

本地存储不等于完全离线：行情请求会发送标的或合约，新闻和视频也会连接外部服务。
旧的可选 AI 接口若配置并被主动调用，会向 AI 服务发送所提交的消息和上下文。
不要向它提交不希望外传的账户信息。源码导出工具本身不联网。

只上传新生成的源码目录，建立新的 Git 历史。不要把整个现有程序目录拖入 GitHub。
忽略规则不能清除旧提交里的内容。数据库本身未加密，请保护电脑和备份。
