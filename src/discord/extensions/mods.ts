import {writeFileSync} from "fs";
import {getConfig} from "../../common/config.js";
import {app} from "electron";
import {join} from "path";

async function fetchMod(fileName: string, url: string) {
    try {
        await fetch(url).then(async (contents) => {
            const fileContent = await contents.text();
            if (!contents.ok || !fileContent) {
                throw new Error("BAD_RESPONSE");
            }
            writeFileSync(join(app.getPath("userData"), fileName), fileContent);
        });
    } catch (error) {
        console.error(error);
        console.error(`Something went wrong downloading ${fileName} from ${url} - skipping!`);
    }
}

export async function fetchMods() {
    const mods = getConfig("mods");
    if (mods.includes("shelter")) {
        console.log("Downloading Shelter");
        await fetchMod("shelter.js", "https://raw.githubusercontent.com/uwu/shelter-builds/main/shelter.js");
    }
    if (mods.includes("vencord")) {
        console.log("Downloading Vencord");
        await fetchMod("vencord.asar", "https://github.com/Vendicated/Vencord/releases/download/devbuild/desktop.asar");
    }
}

export function runMods() {
    const mods = getConfig("mods");
    if (mods.includes("vencord")) {
        console.log("Starting Vencord");
    }
}
