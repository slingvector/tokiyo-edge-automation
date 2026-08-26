import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import * as fs from 'fs';
const execAsync = util.promisify(exec);
export class LocalAdbController {
    deviceId;
    ocrScriptPath;
    constructor(deviceId) {
        this.deviceId = deviceId;
        // Assume this is run from cloud-orchestrator src/utils/ so ocr.py is up three levels
        this.ocrScriptPath = path.resolve(__dirname, '../../../ocr.py');
    }
    async executeAdb(command) {
        const deviceFlag = `-s ${this.deviceId} `;
        const fullCommand = `adb ${deviceFlag}${command}`;
        console.log(`[ADB] ${fullCommand}`);
        const { stdout, stderr } = await execAsync(fullCommand);
        if (stderr && !stderr.includes('Warning')) {
            console.warn(`[ADB Warning] ${stderr}`);
        }
        return stdout;
    }
    async forceStopApp(packageName) {
        await this.executeAdb(`shell am force-stop ${packageName}`);
    }
    async openDeepLink(url, packageName) {
        const packageArg = packageName ? ` -p ${packageName}` : '';
        await this.executeAdb(`shell am start -a android.intent.action.VIEW -d "${url}"${packageArg}`);
    }
    async getUiDumpXml() {
        const dumpPath = `/sdcard/window_dump_${this.deviceId}.xml`;
        const localPath = `/tmp/window_dump_${this.deviceId}.xml`;
        // Remove old dumps so we don't pull stale data if dump fails
        try {
            await this.executeAdb(`shell rm ${dumpPath}`);
        }
        catch (e) { }
        try {
            fs.unlinkSync(localPath);
        }
        catch (e) { }
        try {
            await this.executeAdb(`shell uiautomator dump --compressed ${dumpPath}`);
        }
        catch (e) {
            console.warn(`[ADB Warning] uiautomator dump failed: ${e}`);
        }
        try {
            await this.executeAdb(`pull ${dumpPath} ${localPath}`);
        }
        catch (e) {
            console.error(`[ADB Error] Failed to pull dump. The screen might not be idle.`);
            return ''; // Return empty string so caller knows it failed
        }
        if (fs.existsSync(localPath)) {
            return fs.readFileSync(localPath, 'utf8');
        }
        return '';
    }
    async tapCoordinate(x, y) {
        await this.executeAdb(`shell input tap ${x} ${y}`);
    }
    async inputText(text) {
        await this.executeAdb(`shell input text "${text}"`);
    }
    async pressEnter() {
        await this.executeAdb(`shell input keyevent 66`);
    }
    async pressBack() {
        await this.executeAdb(`shell input keyevent 4`);
    }
    async pressTab() {
        await this.executeAdb(`shell input keyevent 61`);
    }
    async swipe(x1, y1, x2, y2, duration = 500) {
        await this.executeAdb(`shell input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`);
    }
    async executeCommand(command) {
        return await this.executeAdb(`shell ${command}`);
    }
    async verifyDeviceState() {
        // For local ADB, just ensure the device is responsive
        await this.executeAdb('shell echo ok');
    }
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async getOcrCoordinates(targetText) {
        console.log(`[OCR] Searching for "${targetText}" on screen...`);
        const safeId = this.deviceId.replace(/[^a-zA-Z0-9]/g, '_');
        const screenPath = `/sdcard/node_screen_${safeId}.png`;
        const localPath = `/tmp/node_screen_${safeId}.png`;
        await this.executeAdb(`shell screencap -p ${screenPath}`);
        await this.executeAdb(`pull ${screenPath} ${localPath}`);
        // Execute python OCR script
        const pythonExecutable = path.resolve(__dirname, '../../../apk-analyzer/venv/bin/python3');
        const { stdout } = await execAsync(`${pythonExecutable} ${this.ocrScriptPath} ${localPath}`);
        const lines = stdout.split('\n');
        for (const line of lines) {
            if (line.toLowerCase().includes(targetText.toLowerCase())) {
                const match = line.match(/at \((\d+),\s*(\d+)\)/);
                if (match) {
                    return { x: parseInt(match[1]), y: parseInt(match[2]) };
                }
            }
        }
        return null;
    }
}
