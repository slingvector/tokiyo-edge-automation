import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import * as fs from 'fs';
import { IDeviceController } from './IDeviceController';

const execAsync = util.promisify(exec);

export class LocalAdbController implements IDeviceController {
    public deviceId: string;
    private ocrScriptPath: string;

    constructor(deviceId: string) {
        this.deviceId = deviceId;
        // Assume this is run from cloud-orchestrator src/utils/ so ocr.py is up three levels
        this.ocrScriptPath = path.resolve(__dirname, '../../../ocr.py');
    }

    private async executeAdb(command: string): Promise<string> {
        const deviceFlag = `-s ${this.deviceId} `;
        const fullCommand = `adb ${deviceFlag}${command}`;
        console.log(`[ADB] ${fullCommand}`);
        const { stdout, stderr } = await execAsync(fullCommand);
        if (stderr && !stderr.includes('Warning')) {
            console.warn(`[ADB Warning] ${stderr}`);
        }
        return stdout;
    }

    public async forceStopApp(packageName: string): Promise<void> {
        await this.executeAdb(`shell am force-stop ${packageName}`);
    }

    public async openDeepLink(url: string, packageName: string = 'com.linkedin.android'): Promise<void> {
        await this.executeAdb(`shell am start -a android.intent.action.VIEW -d "${url}" ${packageName}`);
    }

    public async getUiDumpXml(): Promise<string> {
        const dumpPath = `/sdcard/window_dump_${this.deviceId}.xml`;
        const localPath = `/tmp/window_dump_${this.deviceId}.xml`;
        
        await this.executeAdb(`shell uiautomator dump ${dumpPath}`);
        await this.executeAdb(`pull ${dumpPath} ${localPath}`);
        
        return fs.readFileSync(localPath, 'utf8');
    }

    public async tapCoordinate(x: number, y: number): Promise<void> {
        await this.executeAdb(`shell input tap ${x} ${y}`);
    }

    public async inputText(text: string): Promise<void> {
        await this.executeAdb(`shell input text "${text}"`);
    }

    public async pressEnter(): Promise<void> {
        await this.executeAdb(`shell input keyevent 66`);
    }

    public async pressBack(): Promise<void> {
        await this.executeAdb(`shell input keyevent 4`);
    }

    public async pressTab(): Promise<void> {
        await this.executeAdb(`shell input keyevent 61`);
    }

    public async swipe(x1: number, y1: number, x2: number, y2: number, duration: number = 500): Promise<void> {
        await this.executeAdb(`shell input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`);
    }

    public async executeCommand(command: string): Promise<string> {
        return await this.executeAdb(`shell ${command}`);
    }

    public async verifyDeviceState(): Promise<void> {
        // For local ADB, just ensure the device is responsive
        await this.executeAdb('shell echo ok');
    }

    public async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public async getOcrCoordinates(targetText: string): Promise<{x: number, y: number} | null> {
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
                    return { x: parseInt(match[1]!), y: parseInt(match[2]!) };
                }
            }
        }
        return null;
    }
}
