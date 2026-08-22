process.env.START_SERVER = 'true';
import { RemoteShizukuController } from './src/utils/RemoteShizukuController';
import { execSync } from 'child_process';
import { io } from './src/api/Server'; // ensure server binds

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function run() {
    const orchestratorNodeId = '48e7f048198bb9d5';
    const adbDeviceId = 'RZCY110AKDZ';

    console.log("Bridging network...");
    execSync(`adb -s ${adbDeviceId} reverse tcp:3000 tcp:3000`);
    execSync(`adb -s ${adbDeviceId} shell am force-stop com.tokiyo.shizukuspike`);
    execSync(`adb -s ${adbDeviceId} shell am start -n com.tokiyo.shizukuspike/.MainActivity`);
    
    console.log("⏳ Waiting 10 seconds for the Android Agent to connect...");
    await delay(10000);

    const controller = new RemoteShizukuController(orchestratorNodeId);
    try {
        console.log("Sending a broken shell command to the device...");
        await (controller as any).dispatchJobAndWait('shell', { command: 'ls /root_which_is_denied' }, 10000);
        console.log("Success (which is wrong, it should fail)");
    } catch (error: any) {
        console.error("Test Error Output:", error.message);
    }
    process.exit(0);
}

run();
