# Optional macOS Wrapper / 可选 macOS 桌面窗口

The supported source setup is the browser-based local application described in the
root README. `main.swift` is the optional native wrapper source, not a signed installer.
It expects a built `triggerterminal` directory beside the app (or in the home directory),
with `server/dist`, `web/.next`, dependencies and an executable `runtime/bin/node`.
The private bundled runtime and existing application bundle are not distributed.

To experiment locally after building, provide your installed Node executable at
`runtime/bin/node`, create `data`, and compile with Xcode Command Line Tools:

```sh
mkdir -p runtime/bin data
ln -s "$(command -v node)" runtime/bin/node
swiftc desktop/main.swift -o triggerterminal-desktop -framework Cocoa -framework WebKit
```

Run from a directory named `triggerterminal` in your home directory. A distributable,
signed macOS installer is a separate release task. Do not bundle your data directory,
WebKit/browser profile or personal application preferences in an installer.

推荐先按主 README 使用本机网页版。桌面入口保留源码，不包含个人 app、运行时或数据。
正式签名安装包需另行制作，不能直接上传现有桌面应用和数据文件夹。
