import { LinkedInEngager } from './src/services/LinkedInEngager';
import { RemoteShizukuController } from './src/utils/RemoteShizukuController';
import { server } from './src/api/Server';
import { execSync } from 'child_process';

server.listen(3000, () => {
    console.log("WebSocket server listening on port 3000 for Agent connection...");
});

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error("❌ Please provide a target type and an ID!");
        process.exit(1);
    }

    const type = args[0];
    const targetId = args[1];
    const adbDeviceId = 'RZCY110AKDZ';
    const orchestratorNodeId = '48e7f048198bb9d5';
    
    console.log("⏳ Bridging network, waking device, and restarting Edge Agent...");
    execSync(`adb -s ${adbDeviceId} shell input keyevent 224`); // Wakeup
    execSync(`adb -s ${adbDeviceId} shell input keyevent 82`);  // Unlock
    execSync(`adb -s ${adbDeviceId} reverse tcp:3000 tcp:3000`);
    execSync(`adb -s ${adbDeviceId} shell am force-stop com.tokiyo.shizukuspike`);
    execSync(`adb -s ${adbDeviceId} shell am start -n com.tokiyo.shizukuspike/.MainActivity`);
    await delay(5000);

    const controller = new RemoteShizukuController(orchestratorNodeId);
    const engager = new LinkedInEngager(orchestratorNodeId, controller);
    const messagePayload = "Hey there! This is an automated outreach message triggered via deep link handoff. Lets connect!";

    try {
        if (type === 'thread') {
            console.log(`🚀 Triggering direct thread deep link for: ${targetId}`);
            await engager.sendDirectMessage(targetId!, messagePayload);
        } else if (type === 'profile') {
            console.log(`🚀 Triggering profile deep link for: ${targetId}`);
            await engager.messageProfile(targetId!, messagePayload);
        } else {
            console.error("Invalid type. Use 'thread' or 'profile'.");
        }
    } catch (e) {
        console.error("❌ Test failed:", e);
    }
    
    process.exit(0);
}

runTest();
