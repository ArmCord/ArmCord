// To allow seamless switching between custom titlebar and native os titlebar,
// I had to add most of the window creation code here to split both into seperete functions
// WHY? Because I can't use the same code for both due to annoying bug with value `frame` not responding to variables
// I'm sorry for this mess but I'm not sure how to fix it.
import {BrowserWindow, shell, app, dialog, nativeImage} from "electron";
import path from "path";
import {checkIfConfigIsBroken, firstRun, getConfig, contentPath, setConfig, setLang, setWindowState} from "./utils";
import {registerIpc} from "./ipc";
import {setMenu} from "./menu";
import * as fs from "fs";
import startServer from "./socket";
import contextMenu from "electron-context-menu";
import os from "os";
import {tray} from "./tray";
import {iconPath} from "./main";
export let mainWindow: BrowserWindow;
export let inviteWindow: BrowserWindow;

var osType = os.type();
contextMenu({
    showSaveImageAs: true,
    showCopyImageAddress: true,
    showSearchWithGoogle: false,
    prepend: (defaultActions, parameters, browserWindow) => [
        {
            label: "Search with Google",
            // Only show it when right-clicking text
            visible: parameters.selectionText.trim().length > 0,
            click: () => {
                shell.openExternal(`https://google.com/search?q=${encodeURIComponent(parameters.selectionText)}`);
            }
        },
        {
            label: "Search with DuckDuckGo",
            // Only show it when right-clicking text
            visible: parameters.selectionText.trim().length > 0,
            click: () => {
                shell.openExternal(`https://duckduckgo.com/?q=${encodeURIComponent(parameters.selectionText)}`);
            }
        }
    ]
});
async function doAfterDefiningTheWindow() {
    var ignoreProtocolWarning = await getConfig("ignoreProtocolWarning");
    await checkIfConfigIsBroken();
    registerIpc();
    if (await getConfig("mobileMode")) {
        mainWindow.webContents.userAgent =
            "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.149 Mobile Safari/537.36";
    } else {
        // A little sloppy but it works :p
        if (osType == "Windows_NT") {
            osType = "Windows " + os.release().split(".")[0] + " (" + os.release() + ")";
        }
        mainWindow.webContents.userAgent = `Mozilla/5.0 (X11; ${osType} ${os.arch()}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36`; //fake useragent for screenshare to work
    }

    mainWindow.webContents.setWindowOpenHandler(({url}) => {
        if (url.startsWith("https:" || url.startsWith("http:") || url.startsWith("mailto:"))) {
            shell.openExternal(url);
        } else {
            if (ignoreProtocolWarning) {
                shell.openExternal(url);
            } else {
                const options = {
                    type: "question",
                    buttons: ["Yes, please", "No, I don't"],
                    defaultId: 1,
                    title: url,
                    message: `Do you want to open ${url}?`,
                    detail: "This url was detected to not use normal browser protocols. It could mean that this url leads to a local program on your computer. Please check if you recognise it, before proceeding!",
                    checkboxLabel: "Remember my answer and ignore this warning for future sessions",
                    checkboxChecked: false
                };

                dialog.showMessageBox(mainWindow, options).then(({response, checkboxChecked}) => {
                    console.log(response, checkboxChecked);
                    if (checkboxChecked) {
                        if (response == 0) {
                            setConfig("ignoreProtocolWarning", true);
                        } else {
                            setConfig("ignoreProtocolWarning", false);
                        }
                    }
                    if (response == 0) {
                        shell.openExternal(url);
                    } else {
                        return;
                    }
                });
            }
        }
        return {action: "deny"};
    });
    mainWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
        if (/api\/v\d\/science$/g.test(details.url)) return callback({cancel: true});
        return callback({});
    });
    if ((await getConfig("trayIcon")) == "default") {
        mainWindow.webContents.on("page-favicon-updated", async (event) => {
            var faviconBase64 = await mainWindow.webContents.executeJavaScript(`
                var getFavicon = function(){
                var favicon = undefined;
                var nodeList = document.getElementsByTagName("link");
                for (var i = 0; i < nodeList.length; i++)
                {
                    if((nodeList[i].getAttribute("rel") == "icon")||(nodeList[i].getAttribute("rel") == "shortcut icon"))
                    {
                        favicon = nodeList[i].getAttribute("href");
                    }
                }
                return favicon;        
                }
                getFavicon()
            `);
            var buf = new Buffer(faviconBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
            fs.writeFileSync(path.join(app.getPath("temp"), "/", "tray.png"), buf, "utf-8");
            let trayPath = nativeImage.createFromPath(path.join(app.getPath("temp"), "/", "tray.png"));
            if (process.platform === "darwin" && trayPath.getSize().height > 22)
                trayPath = trayPath.resize({height: 22});
            tray.setImage(trayPath);
        });
    }
    const userDataPath = app.getPath("userData");
    const themesFolder = userDataPath + "/themes/";
    if (!fs.existsSync(themesFolder)) {
        fs.mkdirSync(themesFolder);
        console.log("Created missing theme folder");
    }
    mainWindow.webContents.on("did-finish-load", () => {
        fs.readdirSync(themesFolder).forEach((file) => {
            try {
                const manifest = fs.readFileSync(`${themesFolder}/${file}/manifest.json`, "utf8");
                var themeFile = JSON.parse(manifest);
                mainWindow.webContents.send(
                    "themeLoader",
                    fs.readFileSync(`${themesFolder}/${file}/${themeFile.theme}`, "utf-8")
                );
                console.log(`%cLoaded ${themeFile.name} made by ${themeFile.author}`, "color:red");
            } catch (err) {
                console.error(err);
            }
        });
    });
    await setMenu();
    mainWindow.on("close", async (e) => {
        let [width, height] = mainWindow.getSize();
        await setWindowState({
            width: width,
            height: height,
            isMaximized: mainWindow.isMaximized()
        });
        if (await getConfig("minimizeToTray")) {
            e.preventDefault();
            mainWindow.hide();
        } else if (!(await getConfig("minimizeToTray"))) {
            e.preventDefault();
            app.quit();
        }
    });

    mainWindow.on("focus", () => {
        mainWindow.webContents.executeJavaScript(`document.body.removeAttribute("unFocused");`);
    });
    mainWindow.on("blur", () => {
        mainWindow.webContents.executeJavaScript(`document.body.setAttribute("unFocused", "");`);
    });

    mainWindow.on("maximize", () => {
        mainWindow.webContents.executeJavaScript(`document.body.setAttribute("isMaximized", "");`);
    });
    mainWindow.on("unmaximize", () => {
        mainWindow.webContents.executeJavaScript(`document.body.removeAttribute("isMaximized");`);
    });
    console.log(contentPath);
    if ((await getConfig("inviteWebsocket")) == true) {
        await startServer();
    }
    if (firstRun) {
        await setLang(Intl.DateTimeFormat().resolvedOptions().locale);
        mainWindow.setSize(390, 470);
        await mainWindow.loadFile(path.join(__dirname, "/content/setup.html"));
    } else {
        if ((await getConfig("skipSplash")) == true) {
            switch (await getConfig("channel")) {
                case "stable":
                    await mainWindow.loadURL("https://discord.com/app");
                    break;
                case "canary":
                    await mainWindow.loadURL("https://canary.discord.com/app");
                    break;
                case "ptb":
                    await mainWindow.loadURL("https://ptb.discord.com/app");
                    break;
                case "hummus":
                    await mainWindow.loadURL("https://hummus.sys42.net/");
                    break;
                case undefined:
                    await mainWindow.loadURL("https://discord.com/app");
                    break;
                default:
                    await mainWindow.loadURL("https://discord.com/app");
            }
        } else {
            await mainWindow.loadFile(path.join(__dirname, "/content/splash.html"));
        }
    }
}
export function createCustomWindow() {
    mainWindow = new BrowserWindow({
        width: 300,
        height: 350,
        title: "ArmCord",
        darkTheme: true,
        icon: iconPath,
        frame: false,
        autoHideMenuBar: true,
        webPreferences: {
            sandbox: false,
            preload: path.join(__dirname, "preload/preload.js"),
            spellcheck: true
        }
    });
    doAfterDefiningTheWindow();
}
export function createNativeWindow() {
    mainWindow = new BrowserWindow({
        width: 300,
        height: 350,
        title: "ArmCord",
        darkTheme: true,
        icon: iconPath,
        frame: true,
        autoHideMenuBar: true,
        webPreferences: {
            sandbox: false,
            preload: path.join(__dirname, "preload/preload.js"),
            spellcheck: true
        }
    });
    doAfterDefiningTheWindow();
}

export function createInviteWindow() {
    inviteWindow = new BrowserWindow({
        width: 800,
        height: 600,
        title: "ArmCord Invite Manager",
        darkTheme: true,
        icon: iconPath,
        frame: true,
        autoHideMenuBar: true,
        webPreferences: {
            sandbox: false,
            spellcheck: true
        }
    });
    inviteWindow.hide();
}
