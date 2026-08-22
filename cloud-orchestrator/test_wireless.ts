import { LinkedInEngager } from './src/services/LinkedInEngager';
import { RemoteShizukuController } from './src/utils/RemoteShizukuController';
import { server } from './src/api/Server';

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
    const orchestratorNodeId = '48e7f048198bb9d5'; // Must match device's ANDROID_ID
    
    console.log("⏳ Waiting 15 seconds for Edge Agent to connect wirelessly over Wi-Fi...");
    await delay(15000);

    const controller = new RemoteShizukuController(orchestratorNodeId);
    const engager = new LinkedInEngager(orchestratorNodeId, controller);
    const messagePayload = "Hey there! Testing completely wireless WebSocket automation!";

    try {
        if (type === 'thread') {
            console.log(`🚀 Triggering direct thread deep link for: ${targetId}`);
            await engager.sendDirectMessage(targetId, messagePayload);
        } else if (type === 'profile') {
            console.log(`🚀 Triggering profile deep link for: ${targetId}`);
            await engager.messageProfile(targetId, messagePayload);
        } else {
            console.error("Invalid type. Use 'thread' or 'profile'.");
        }
    } catch (e) {
        console.error("❌ Test failed:", e);
    }
    
    process.exit(0);
}

runTest();
