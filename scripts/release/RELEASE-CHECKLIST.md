# Upload Checklist / 上传检查清单

This is a source release, not a prebuilt installer. Install dependencies and build
using README.md. User records are created locally on first use.

## Verified for This Release

- Clean dependency installation and production server/web builds passed.
- 88 TypeScript tests, 28 Python bridge tests and 2 export safety tests passed.
- Fresh isolated startup returned zero accounts, positions and ledger events.
- Export excludes databases, configuration state, secrets, logs, backups, screenshots,
  browser profiles, installed dependencies, build output and original Git history.
- Local account identifiers, position names and notes were compared against the
  source package without copying those values into this report.
- Existing local installation and personal records were not deleted or reset.

## Before GitHub Upload

1. Use only the generated triggerterminal source folder, not your old installation.
2. Start a new Git repository. Do not copy an existing .git directory.
3. Keep LICENSE and third_party attribution files.
4. Review all staged files before committing; never add personal screenshots or data.
5. After running the app locally, keep data, build output and dependency folders ignored.

仅上传生成的 triggerterminal 源码目录。不要上传原始安装目录、旧 Git 历史或本机数据。
此包是源码，不是双击即用的安装程序；按照 README 安装依赖并构建。
账户、持仓及笔记不会随源码发布。本机原有安装和个人记录未删除、未重置。
自动检查不能保证覆盖未来加入的所有敏感信息，每次发布仍需检查待提交文件。
