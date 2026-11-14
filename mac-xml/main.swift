import Cocoa
import WebKit

final class Controller: NSObject, NSApplicationDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var web: WKWebView!
    let work = DispatchQueue(label: "cedi.biblioteca")
    func applicationDidFinishLaunching(_ n: Notification) {
        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name:"cedi")
        web = WKWebView(frame:.zero,configuration:config)
        window = NSWindow(contentRect:NSRect(x:0,y:0,width:1040,height:690),styleMask:[.titled,.closable,.miniaturizable,.resizable],backing:.buffered,defer:false)
        window.title = "CEDI · Cargas XML"
        window.contentView = web
        let file = Bundle.main.url(forResource:"index",withExtension:"html")!
        web.loadFileURL(file,allowingReadAccessTo:file)
        let menu=NSMenu(); let item=NSMenuItem(); menu.addItem(item)
        let edit=NSMenu(title:"Edición");item.submenu=edit
        for (name,action,key) in [("Copiar","copy:","c"),("Pegar","paste:","v"),("Cortar","cut:","x"),("Seleccionar todo","selectAll:","a")] { edit.addItem(withTitle:name,action:Selector(action),keyEquivalent:key) }
        NSApp.mainMenu=menu
        window.center();window.makeKeyAndOrderFront(nil);NSApp.activate(ignoringOtherApps:true)
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ app:NSApplication)->Bool {true}
    func userContentController(_ c:WKUserContentController,didReceive m:WKScriptMessage) {
        guard m.frameInfo.isMainFrame, m.frameInfo.request.url?.isFileURL == true, var req=m.body as? [String:Any],let mode=req["mode"] as? String, ["list","import","original","download"].contains(mode) else{return}
        if mode=="import" {
            let panel=NSOpenPanel();panel.allowsMultipleSelection=true;panel.allowedFileTypes=["xml"]
            req["files"]=panel.runModal() == .OK ? panel.urls.map{$0.path} : []
        }
        guard let input=try? JSONSerialization.data(withJSONObject:req) else{return}
        work.async {
            let proc=Process(), pipe=Pipe(), output=Pipe()
            proc.executableURL=URL(fileURLWithPath:"/usr/bin/python3")
            proc.arguments=["-B",Bundle.main.path(forResource:"library",ofType:"py")!]
            proc.standardInput=pipe;proc.standardOutput=output
            var response="{\"ok\":false,\"error\":\"No se pudo ejecutar el lector con Python 3 en esta Mac.\"}"
            do {try proc.run();pipe.fileHandleForWriting.write(input);pipe.fileHandleForWriting.closeFile()
                let data=output.fileHandleForReading.readDataToEndOfFile();proc.waitUntilExit()
                if (try? JSONSerialization.jsonObject(with:data)) != nil {response=String(decoding:data,as:UTF8.self)}
            } catch {}
            DispatchQueue.main.async {self.web.evaluateJavaScript("finish("+response+")",completionHandler:nil)}
        }
    }
}
let app=NSApplication.shared
let controller=Controller();app.delegate=controller;app.setActivationPolicy(.regular);app.run()
