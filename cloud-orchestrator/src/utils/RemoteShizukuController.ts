import { IDeviceController } from './IDeviceController';
import { v4 as uuidv4 } from 'uuid';
import { telemetryEvents } from '../api/Server';
import { jobQueue } from '../queue/Dispatcher';
import { PrismaClient } from '@prisma/client';
import zlib from 'zlib';

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

        await prisma.job.create({
            data: {
                id: jobId,
                nodeId: this.deviceId,
                action: action,
                payload: params,
                status: 'PENDING'
            }
        });

        await jobQueue.add('dispatch-job', {
            node_id: this.deviceId,
            action,
            params
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
            const powerData = await this.dispatchJobAndWait('shell', { command: 'dumpsys power' });
            if (powerData.stdout && (powerData.stdout.includes('mWakefulness=Asleep') || powerData.stdout.includes('state=OFF'))) {
                console.log(`[${this.deviceId}] Screen is OFF. Attempting to wake...`);
                await this.dispatchJobAndWait('shell', { command: 'input keyevent 224' });
                await this.sleep(1000);
            }

            const windowData = await this.dispatchJobAndWait('shell', { command: 'dumpsys window' });
            if (windowData.stdout && windowData.stdout.includes('mDreamingLockscreen=true')) {
                console.log(`[${this.deviceId}] Screen is LOCKED. Attempting to unlock...`);
                await this.dispatchJobAndWait('shell', { command: 'input keyevent 82' });
                await this.sleep(1000);
                
                const windowDataAfter = await this.dispatchJobAndWait('shell', { command: 'dumpsys window' });
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

    public async openDeepLink(url: string, packageName: string = ''): Promise<void> {
        console.log(`[${this.deviceId}] [Shizuku] openDeepLink: ${url}`);
        await this.dispatchJobAndWait('deep_link', { url, package: packageName });
    }

    public async getUiDumpXml(): Promise<string> {
        console.log(`[${this.deviceId}] [Shizuku] getUiDumpXml`);
        const telemetryData = await this.dispatchJobAndWait('dump_ui', {}, 15000);
        if (!telemetryData.ui_dump) {
            throw new Error('Failed to retrieve UI dump from edge node');
        }

        const cleanUiDump = telemetryData.ui_dump.replace("UI hierchary dumped to: /data/local/tmp/dump.xml", "").trim();
        
        try {
            const xmlBuffer = zlib.gunzipSync(Buffer.from(cleanUiDump, 'base64'));
            return xmlBuffer.toString('utf-8');
        } catch (gzErr) {
            console.warn(`[${this.deviceId}] Failed to gunzip XML, falling back to raw decode`, gzErr);
            return Buffer.from(cleanUiDump, 'base64').toString('utf-8');
        }
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
}
