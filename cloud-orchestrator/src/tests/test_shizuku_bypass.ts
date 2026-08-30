import 'dotenv/config';
import { RemoteShizukuController } from '../utils/RemoteShizukuController';

async function main() {
    const deviceId = process.argv[2];
    if (!deviceId) {
        console.error("Usage: npx tsx test_shizuku_bypass.ts <node_id>");
        process.exit(1);
    }

    const controller = new RemoteShizukuController(deviceId);
    console.log(`Testing Shizuku bypass on node ${deviceId}...`);

    console.log("1. Checking connection & executing 'id' command:");
    const idOut = await controller.executeCommand("id");
    console.log("->", idOut.trim());

    console.log("2. Checking device state:");
    await controller.verifyDeviceState();
    
    console.log("3. Pressing HOME (keyevent 3):");
    await controller.executeCommand("input keyevent 3");

    console.log("4. Fetching screen size:");
    const size = await controller.getScreenSize();
    console.log("->", size);

    console.log("Test completed successfully!");
    process.exit(0);
}

main().catch(e => {
    console.error("Test failed:", e);
    process.exit(1);
});
