# TriggerTerminal desktop 0.1.0

[中文使用说明](../docs/USER_GUIDE.zh-CN.md) · [English guide](../docs/USER_GUIDE.en.md)

Windows x64: run the installer. macOS 14+ Apple Silicon: open the DMG and drag TriggerTerminal to Applications. Node.js and Python are bundled. IB Gateway or TWS is installed separately; see the connection instructions in the project README.

Windows x64：运行安装向导。macOS 14+ Apple Silicon：打开 DMG，将 TriggerTerminal 拖入应用程序。内置 Node.js 和 Python；IB Gateway / TWS 需另外安装，API 设置见项目首页。

Build on the target platform / 在对应平台构建：

```sh
npm ci
npm run build
npm run desktop:prepare
npm run desktop:package
```

Installers are written to `releases/desktop/`. Personal data is stored outside the application and is not bundled. Updating the application preserves the local data directory. Back it up before updating.

安装包生成在 `releases/desktop/`。个人数据保存在应用程序外，不会打入安装包；升级保留本地数据，更新前请备份。

Unsigned builds may trigger operating-system warnings. Only use files from this repository’s release page and verify published checksums. Intel Macs are not included in this release.

未签名构建可能触发系统提示。请只使用本仓库发布页文件，并核对公布的校验值。本版未提供 Intel Mac 安装包。
