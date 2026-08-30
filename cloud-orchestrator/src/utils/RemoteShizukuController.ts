import { IDeviceController } from './IDeviceController';
import { v4 as uuidv4 } from 'uuid';
import { telemetryEvents } from '../api/Server';
import { jobQueue } from '../queue/Dispatcher';
import { PrismaClient } from '@prisma/client';
import zlib from 'zlib';
import { signer } from '../crypto/Signer';

const prisma = new PrismaClient();

export class RemoteShizukuController implements IDeviceController {
    public deviceId: string;

    constructor(deviceId: string) {
        this.deviceId = deviceId;
    }

    private async dispatchJobAndWait(action: string, params: Record<string, any>, timeoutMs: number = 30000): Promise<any> {
        const jobId = uuidv4();
        
        await prisma.node.upsert({
            where: { id: this.deviceId },
            update: {},
            create: { id: this.deviceId }
        });

        // Sign the payload freshly on every dispatch (crucial for BullMQ retries)
        const signedPayload = signer.signPayload({
            job_id: jobId,
            node_id: this.deviceId,
            action,
            params
        });

        await prisma.job.create({
            data: {
                id: jobId,
                nodeId: this.deviceId,
                action: action,
                payload: signedPayload,
                status: 'PENDING'
            }
        });

        await jobQueue.add('dispatch-job', {
            node_id: this.deviceId,
            action,
            params: signedPayload
        }, { jobId });

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Timeout waiting for telemetry for job ${jobId}`));
            }, timeoutMs);

            telemetryEvents.once(`telemetry_${jobId}`, (data) => {
                clearTimeout(timeout);
                if (data.status === 'SUCCESS') {
                    resolve(data);
                } else {
                    reject(new Error(`Job failed: ${data.stderr}`));
                }
            });
        });
    }

    public async verifyDeviceState(): Promise<void> {
        console.log(`[${this.deviceId}] [Shizuku] verifyDeviceState`);
        try {
            const powerData = await this.dispatchJobAndWait('shell', { command: 'dumpsys power | grep -E "mWakefulness|state="' });
            if (powerData.stdout && (powerData.stdout.includes('mWakefulness=Asleep') || powerData.stdout.includes('state=OFF'))) {
                console.log(`[${this.deviceId}] Screen is OFF. Attempting to wake...`);
                await this.dispatchJobAndWait('shell', { command: 'input keyevent 224' });
                await this.sleep(1000);
            }

            const windowData = await this.dispatchJobAndWait('shell', { command: 'dumpsys window | grep mDreamingLockscreen' });
            if (windowData.stdout && windowData.stdout.includes('mDreamingLockscreen=true')) {
                console.log(`[${this.deviceId}] Screen is LOCKED. Attempting to unlock...`);
                await this.dispatchJobAndWait('shell', { command: 'input keyevent 82' });
                await this.sleep(1000);
                
                const windowDataAfter = await this.dispatchJobAndWait('shell', { command: 'dumpsys window | grep mDreamingLockscreen' });
                if (windowDataAfter.stdout && windowDataAfter.stdout.includes('mDreamingLockscreen=true')) {
                     throw new Error(`[${this.deviceId}] Critical Error: Device is locked with a secure Keyguard (PIN/Pattern). Automation cannot proceed. Please unlock manually or run setup_device.sh.`);
                }
            }
            console.log(`[${this.deviceId}] [Shizuku] verifyDeviceState: OK`);
        } catch (error: any) {
            throw new Error(`[${this.deviceId}] verifyDeviceState failed: ${error.message}`);
        }
    }

    public async forceStopApp(packageName: string): Promise<void> {
        console.log(`[${this.deviceId}] [Shizuku] forceStopApp: ${packageName}`);
        await this.dispatchJobAndWait('force_stop', { package: packageName });
    }

    public async openDeepLink(url: string, packageName?: string): Promise<void> {
        // We drop the packageName (-p) argument because Android 12+ strict intent resolution 
        // will reject it if it doesn't perfectly match the component's intent filter.
        // Instead, we rely on Android's verified App Links (`pm set-app-links`).
        await this.executeCommand(`am start -a android.intent.action.VIEW -d "${url}"`);
    }

    public async getUiDumpXml(): Promise<string> {
        console.log(`[${this.deviceId}] [Shizuku] getUiDumpXml`);
        const telemetryData = await this.dispatchJobAndWait('dump_ui', {}, 15000);
        if (!telemetryData.ui_dump) {
            throw new Error('Failed to retrieve UI dump from edge node');
        }

        const cleanUiDump = telemetryData.ui_dump.replace("UI hierchary dumped to: /data/local/tmp/dump.xml", "").trim();
        return Buffer.from(cleanUiDump, 'base64').toString('utf-8');
    }

    public async tapCoordinate(x: number, y: number): Promise<void> {
        console.log(`[${this.deviceId}] [Shizuku] tapCoordinate: ${x}, ${y}`);
        await this.dispatchJobAndWait('organic_tap', { x, y });
    }

    public async executeCommand(command: string): Promise<string> {
        console.log(`[${this.deviceId}] [Shizuku] executeCommand: ${command}`);
        const data = await this.dispatchJobAndWait('shell', { command });
        return data.stdout || '';
    }

    public async inputText(text: string): Promise<void> {
        console.log(`[${this.deviceId}] [Shizuku] inputText`);
        await this.dispatchJobAndWait('organic_type', { text });
    }

    public async pasteText(text: string): Promise<void> {
        console.log(`[${this.deviceId}] [Shizuku] pasteText`);
        await this.dispatchJobAndWait('paste_text', { text });
    }

    public async pressEnter(): Promise<void> {
        console.log(`[${this.deviceId}] [Shizuku] pressEnter`);
        await this.dispatchJobAndWait('shell', { command: 'input keyevent 66' });
    }

    public async pressBack(): Promise<void> {
        console.log(`[${this.deviceId}] [Shizuku] pressBack`);
        await this.dispatchJobAndWait('shell', { command: 'input keyevent 4' });
    }

    public async pressTab(): Promise<void> {
        console.log(`[${this.deviceId}] [Shizuku] pressTab`);
        await this.dispatchJobAndWait('shell', { command: 'input keyevent 61' });
    }

    public async swipe(x1: number, y1: number, x2: number, y2: number, duration: number = 500): Promise<void> {
        console.log(`[${this.deviceId}] [Shizuku] swipe: ${x1},${y1} -> ${x2},${y2}`);
        await this.dispatchJobAndWait('organic_swipe', { start_x: x1, start_y: y1, end_x: x2, end_y: y2, duration_ms: duration });
    }

    public async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public async getOcrCoordinates(targetText: string): Promise<{x: number, y: number} | null> {
        console.log(`[${this.deviceId}] [Shizuku] getOcrCoordinates: ${targetText}`);
        return null;
    }

    public async getScreenSize(): Promise<{ width: number, height: number }> {
        const out = await this.executeCommand('wm size');
        const match = out.match(/(\d+)x(\d+)/);
        if (match) {
            return { width: parseInt(match[1]!), height: parseInt(match[2]!) };
        }
        return { width: 1080, height: 2340 }; // fallback
    }
}
