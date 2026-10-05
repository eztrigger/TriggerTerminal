# Upload Checklist / 上传检查清单

This is a source release, not a prebuilt installer. Install dependencies and build
using README.md. Upload only the exported source directory or its matching ZIP.

## Verified on 2026-10-05

- Clean `npm ci` installation and production server/web builds passed.
- 131 TypeScript tests, 21 Python bridge tests and 4 export safety tests passed.
- Fresh isolated startup: zero user accounts, positions, groups, cash balances,
  ledger events, corrections and transactions. The legacy empty `Main` container
  is a built-in default, not a personal account or imported portfolio.
- Crypto market/wallet/holdings features, CSP screening and portfolio analysis
  pages, navigation, dedicated APIs, workers and providers are excluded.
- The removed web pages and dedicated API paths return 404.
- Yahoo Finance option-chain support and all other retained features are included.
- Export excludes databases, connection/provider settings, keys, logs, backups,
  personal screenshots, browser profiles, dependencies, build output and old Git history.
- Default watchlist symbols and the AAPL example chart are built-in examples;
  no personal watchlist, layout or account was copied.
- Existing local installation and records were not deleted or reset.

- Detailed Chinese and English user guides are included; local documentation links
  and the README export template were checked after the documentation update.

## Before GitHub Upload

1. Use only the exported `triggerterminal` folder, not the working installation
   or the parent folder that contains verification screenshots.
2. Create a new repository with new Git history. Do not copy an existing `.git`.
3. Keep LICENSE and third_party attribution files.
4. Include dotfiles such as `.gitignore` and `.github/workflows/ci.yml`.
5. Review staged files before committing. Never add private screenshots or data.
6. Keep newly generated data, dependencies and build output ignored after local use.

仅上传导出的 triggerterminal 文件夹内容；也可以先解压对应 ZIP，再上传其中的源码。
不要上传原始安装目录、上级文件夹、测试截图、旧 Git 历史或本机数据。
账户、持仓、现金和交易记录首次启动为空；默认行情代码仅是通用示例。
虚拟币、CSP 筛选和持仓分析功能已从此公开版移除，原来的个人版本未修改。
此包是源码，按照 README 安装依赖并构建；你可以自行创建 GitHub 仓库并上传。
自动检查不能保证覆盖未来加入的所有敏感信息，每次发布仍需检查待提交文件。
