//ipc stuff
import {app, desktopCapturer, ipcMain, nativeImage, shell} from "electron";
import {mainWindow} from "./window";
import {
    getConfig,
    getDisplayVersion,
    getLang,
    getVersion,
    getWindowState,
    modInstallState,
    packageVersion,
    setConfigBulk,
    setLang
} from "./utils";
import {customTitlebar} from "./main";
import {createSettingsWindow} from "./settings/main";
import os from "os";
import path from "path";
export function registerIpc(): void {
    ipcMain.on("get-app-path", (event) => {
        event.reply("app-path", app.getAppPath());
    });
    ipcMain.on("setLang", (_event, lang: string) => {
        setLang(lang);
    });
    ipcMain.handle("getLang", (_event, toGet: string) => {
        return getLang(toGet);
    });
    ipcMain.on("open-external-link", (_event, href: string) => {
        shell.openExternal(href);
    });
    ipcMain.on("setPing", (_event, pingCount: number) => {
        switch (os.platform()) {
            case "linux" ?? "macos":
                app.setBadgeCount(pingCount);
                break;
            case "win32":
                if (pingCount > 0) {
                    let image = nativeImage.createFromPath(path.join(__dirname, "../", `/assets/ping.png`));
                    mainWindow.setOverlayIcon(image, "badgeCount");
                } else {
                    mainWindow.setOverlayIcon(null, "badgeCount");
                }
                break;
        }
    });
    ipcMain.on("win-maximize", () => {
        mainWindow.maximize();
    });
    ipcMain.on("win-isMaximized", (event) => {
        event.returnValue = mainWindow.isMaximized();
    });
    ipcMain.on("win-isNormal", (event) => {
        event.returnValue = mainWindow.isNormal();
    });
    ipcMain.on("win-minimize", () => {
        mainWindow.minimize();
    });
    ipcMain.on("win-unmaximize", () => {
        mainWindow.unmaximize();
    });
    ipcMain.on("win-show", () => {
        mainWindow.show();
    });
    ipcMain.on("win-hide", () => {
        mainWindow.hide();
    });
    ipcMain.on("win-quit", () => {
        app.exit();
    });
    ipcMain.on("get-app-version", (event) => {
        event.returnValue = getVersion();
    });
    ipcMain.on("displayVersion", (event) => {
        event.returnValue = getDisplayVersion();
    });
    ipcMain.on("modInstallState", (event) => {
        event.returnValue = modInstallState;
    });
    ipcMain.on("get-package-version", (event) => {
        event.returnValue = packageVersion;
    });
    ipcMain.on("splashEnd", async () => {
        let width = 800,
            height = 600,
            isMaximized = true,
            xValue = 0,
            yValue = 0;
        try {
            width = (await getWindowState("width")) ?? 800;
            height = (await getWindowState("height")) ?? 600;
            isMaximized = (await getWindowState("isMaximized")) ?? false;
            xValue = await getWindowState("x");
            yValue = await getWindowState("y");
        } catch (_e) {
            console.log("[Window state manager] No window state file found. Falling back to default values.");
            mainWindow.setSize(800, 600);
        }
        if (isMaximized) {
            mainWindow.setSize(800, 600); //just so the whole thing doesn't cover whole screen
            mainWindow.maximize();
        } else {
            mainWindow.setSize(width, height);
            mainWindow.setPosition(xValue, yValue);
            console.log("[Window state manager] Not maximized.");
        }
    });
    ipcMain.on("restart", () => {
        app.relaunch();
        app.exit();
    });
    ipcMain.on("saveSettings", (_event, args) => {
        setConfigBulk(args);
    });
    ipcMain.on("minimizeToTray", async (event) => {
        event.returnValue = await getConfig("minimizeToTray");
    });
    ipcMain.on("channel", async (event) => {
        event.returnValue = await getConfig("channel");
    });
    ipcMain.on("clientmod", async (event) => {
        event.returnValue = await getConfig("mods");
    });
    ipcMain.on("legacyCapturer", async (event) => {
        event.returnValue = await getConfig("useLegacyCapturer");
    });
    ipcMain.on("trayIcon", async (event) => {
        event.returnValue = await getConfig("trayIcon");
    });
    ipcMain.on("disableAutogain", async (event) => {
        event.returnValue = await getConfig("disableAutogain");
    });
    ipcMain.on("titlebar", (event) => {
        event.returnValue = customTitlebar;
    });
    ipcMain.on("mobileMode", async (event) => {
        event.returnValue = await getConfig("mobileMode");
    });
    ipcMain.on("shouldPatch", async (event) => {
        event.returnValue = await getConfig("automaticPatches");
    });
    ipcMain.on("openSettingsWindow", () => {
        createSettingsWindow();
    });
    ipcMain.on("setting-armcordCSP", async (event) => {
        if (await getConfig("armcordCSP")) {
            event.returnValue = true;
        } else {
            event.returnValue = false;
        }
    });
    ipcMain.handle("DESKTOP_CAPTURER_GET_SOURCES", (_event, opts) => desktopCapturer.getSources(opts));
}
