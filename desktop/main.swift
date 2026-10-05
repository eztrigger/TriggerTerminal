import Cocoa
import WebKit

final class TradingApp: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate, NSWindowDelegate, WKScriptMessageHandler {
    var windows: [NSWindow] = []
    var processes: [Process] = []
    var restarting = false
    var english = UserDefaults.standard.string(forKey: "language") == "en"
    func L(_ value:String)->String {
        if !english { return value }
        return [
            "重启交易台？":"Restart terminal?",
            "所有窗口将重新加载，未保存的编辑和正在运行的扫描会中断。IBKR Gateway 不受影响。":"All windows will reload. Unsaved edits and running scans will be interrupted. IBKR Gateway is unaffected.",
            "重启":"Restart", "取消":"Cancel",
            "服务由外部程序启动，请退出并重启对应服务。":"Services were started externally. Restart them in their original process.",
            "服务尚未停止，请稍后重试。":"Services have not stopped yet. Try again shortly.",
            "退出 triggerterminal":"Quit triggerterminal", "窗口":"Window",
            "新交易台":"New Terminal", "仓位与持仓":"Positions & Holdings",
            "编辑":"Edit", "撤销":"Undo", "剪切":"Cut", "复制":"Copy", "粘贴":"Paste", "全选":"Select All",
            "交易台服务未能启动，请检查 triggerterminal/data 中的 desktop 日志。":"Terminal services failed to start. Check the desktop logs in triggerterminal/data.",
            "交易台启动失败":"Terminal startup failed", "triggerterminal":"triggerterminal"
        ][value] ?? value
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let url = message.frameInfo.request.url, local(url) else { return }
        if message.name == "setLanguage", let value=message.body as? String, ["en","zh-CN"].contains(value) {
            english = value == "en"; UserDefaults.standard.set(value, forKey:"language"); buildMenu(); return
        }
        guard message.name == "restartTerminal", !restarting else { return }
        let alert = NSAlert(); alert.messageText = L("重启交易台？"); alert.informativeText = L("所有窗口将重新加载，未保存的编辑和正在运行的扫描会中断。IBKR Gateway 不受影响。"); alert.addButton(withTitle: L("重启")); alert.addButton(withTitle: L("取消"))
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        guard processes.filter({ $0.isRunning }).count == 2 else { let warning=NSAlert();warning.messageText=L("服务由外部程序启动，请退出并重启对应服务。");warning.runModal();return }
        restarting = true
        Task { @MainActor in
            for process in processes where process.isRunning { process.terminate() }
            for _ in 0..<50 { if processes.allSatisfy({ !$0.isRunning }) { break }; try? await Task.sleep(nanoseconds:100_000_000) }
            guard processes.allSatisfy({ !$0.isRunning }) else { restarting=false;let warning=NSAlert();warning.messageText=L("服务尚未停止，请稍后重试。");warning.runModal();return }
            processes.removeAll()
            await startServices()
            restarting = false
        }
    }
    let root: URL = {
        let home = URL(fileURLWithPath: NSHomeDirectory())
        let candidates = [
            Bundle.main.bundleURL.deletingLastPathComponent().appendingPathComponent("triggerterminal"),
            home.appendingPathComponent("triggerterminal"),
            home.appendingPathComponent("Desktop/triggerterminal")
        ]
        return candidates.first { FileManager.default.fileExists(atPath: $0.appendingPathComponent("server/dist/index.js").path) && FileManager.default.isExecutableFile(atPath: $0.appendingPathComponent("runtime/bin/node").path) } ?? home.appendingPathComponent("triggerterminal")
    }()
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        buildMenu()
        Task { await startServices() }
    }
    func buildMenu() {
        let menu = NSMenu()
        let appItem = NSMenuItem(); menu.addItem(appItem)
        let appMenu = NSMenu(); appItem.submenu = appMenu
        appMenu.addItem(withTitle: L("退出 triggerterminal"), action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let windowItem = NSMenuItem(); menu.addItem(windowItem)
        let windowMenu = NSMenu(title: L("窗口")); windowItem.submenu = windowMenu
        for (title,path,key) in [(L("新交易台"),"/","n"),(L("仓位与持仓"),"/holdings","1")] {
            let item=NSMenuItem(title:title,action:#selector(openMenu(_:)),keyEquivalent:key);item.target=self;item.representedObject=path;windowMenu.addItem(item)
        }
        let editItem=NSMenuItem();menu.addItem(editItem);let edit=NSMenu(title:L("编辑"));editItem.submenu=edit
        for (title,action,key) in [(L("撤销"),"undo:","z"),(L("剪切"),"cut:","x"),(L("复制"),"copy:","c"),(L("粘贴"),"paste:","v"),(L("全选"),"selectAll:","a")] {edit.addItem(withTitle:title,action:Selector(action),keyEquivalent:key)}
        NSApp.mainMenu=menu
    }
    func reachable(_ port:Int) async -> Bool {
        guard let url=URL(string:"http://127.0.0.1:\(port)/api/status") else{return false}
        do { let (_,response)=try await URLSession.shared.data(for:URLRequest(url:url,timeoutInterval:2)); return (response as? HTTPURLResponse)?.statusCode == 200 } catch {return false}
    }
    @MainActor func startServices() async {
        for (port,args,dir) in [(4000,["server/dist/index.js"],root),(3000,["../node_modules/next/dist/bin/next","start","--hostname","127.0.0.1"],root.appendingPathComponent("web"))] {
            if await reachable(port) {continue}
            let process=Process();process.executableURL=root.appendingPathComponent("runtime/bin/node");process.arguments=args;process.currentDirectoryURL=dir
            var env=ProcessInfo.processInfo.environment;env["API_HOST"]="127.0.0.1";env["API_URL"]="http://127.0.0.1:4000";env["API_KEY_FILE"]=root.appendingPathComponent("data/.api-key").path;env["DATA_DIR"]=root.appendingPathComponent("data").path;env["NEXT_TELEMETRY_DISABLED"]="1";process.environment=env
            let log=root.appendingPathComponent("data/desktop-\(port).log");if !FileManager.default.fileExists(atPath:log.path){FileManager.default.createFile(atPath:log.path,contents:nil)}
            if let handle=try? FileHandle(forWritingTo:log){handle.seekToEndOfFile();process.standardOutput=handle;process.standardError=handle}
            do{try process.run();processes.append(process)}catch{showError((english ? "Could not start services: " : "无法启动服务：")+error.localizedDescription);return}
        }
        for _ in 0..<60 {
            if await reachable(3000), await reachable(4000) { if restarting { for window in windows { (window.contentView as? WKWebView)?.reload() } } else { _ = makeWindow(URL(string:"http://localhost:3000/")!) }; NSApp.activate(ignoringOtherApps:true);return }
            try? await Task.sleep(nanoseconds:1_000_000_000)
        }
        showError(L("交易台服务未能启动，请检查 triggerterminal/data 中的 desktop 日志。"))
    }
    func showError(_ message:String){let alert=NSAlert();alert.messageText=L("交易台启动失败");alert.informativeText=message;alert.runModal();NSApp.terminate(nil)}
    @objc func openMenu(_ sender:NSMenuItem){ _=makeWindow(URL(string:"http://localhost:3000"+(sender.representedObject as? String ?? "/"))!) }
    func local(_ url:URL)->Bool {url.scheme=="http" && url.host=="localhost" && url.port==3000}
    @discardableResult func makeWindow(_ url:URL, configuration:WKWebViewConfiguration?=nil)->WKWebView {
        let config=configuration ?? WKWebViewConfiguration();config.websiteDataStore = .default();config.preferences.javaScriptCanOpenWindowsAutomatically=true;config.mediaTypesRequiringUserActionForPlayback=[]
        config.userContentController.removeScriptMessageHandler(forName:"restartTerminal")
        config.userContentController.add(self,name:"restartTerminal")
        config.userContentController.removeScriptMessageHandler(forName:"setLanguage")
        config.userContentController.add(self,name:"setLanguage")
        let web=WKWebView(frame:.zero,configuration:config);web.uiDelegate=self;web.navigationDelegate=self
        let window=NSWindow(contentRect:NSRect(x:120+windows.count*24,y:100+windows.count*24,width:1280,height:820),styleMask:[.titled,.closable,.miniaturizable,.resizable],backing:.buffered,defer:false)
        window.title=L("triggerterminal");window.minSize=NSSize(width:500,height:350);window.isReleasedWhenClosed=false;window.delegate=self;window.tabbingMode = .disallowed;window.contentView=web;windows.append(window);window.makeKeyAndOrderFront(nil)
        if configuration == nil {web.load(URLRequest(url:url))};return web
    }
    func webView(_ webView:WKWebView,createWebViewWith configuration:WKWebViewConfiguration,for navigationAction:WKNavigationAction,windowFeatures:WKWindowFeatures)->WKWebView?{
        guard let url=navigationAction.request.url else{return nil};if !local(url){NSWorkspace.shared.open(url);return nil};return makeWindow(url,configuration:configuration)
    }
    func webView(_ webView:WKWebView,decidePolicyFor navigationAction:WKNavigationAction,decisionHandler:@escaping(WKNavigationActionPolicy)->Void){
        if navigationAction.targetFrame?.isMainFrame == true,let url=navigationAction.request.url,!local(url){if ["http","https"].contains(url.scheme ?? ""){NSWorkspace.shared.open(url)};decisionHandler(.cancel);return};decisionHandler(.allow)
    }
    func webView(_ webView:WKWebView,didFinish navigation:WKNavigation!){webView.window?.title=webView.title ?? L("triggerterminal")}
    func webView(_ webView:WKWebView,runJavaScriptAlertPanelWithMessage message:String,initiatedByFrame frame:WKFrameInfo,completionHandler:@escaping()->Void){let alert=NSAlert();alert.messageText=message;alert.runModal();completionHandler()}
    func windowWillClose(_ notification:Notification){if let window=notification.object as? NSWindow{windows.removeAll{$0===window}}}
    func applicationShouldTerminateAfterLastWindowClosed(_ sender:NSApplication)->Bool {true}
    func applicationWillTerminate(_ notification:Notification){for process in processes where process.isRunning{process.terminate()}}
}
let app=NSApplication.shared
let delegate=TradingApp();app.delegate=delegate;app.run()
