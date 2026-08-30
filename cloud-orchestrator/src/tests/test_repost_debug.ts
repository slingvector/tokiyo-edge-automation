import "dotenv/config";

import { LocalAdbController } from '../utils/LocalAdbController';
import { InstagramEngager } from '../services/InstagramEngager';

async function main() {
    const deviceId = process.argv[2];
    if (!deviceId) throw new Error("Provide deviceId");

    const controller = new LocalAdbController(deviceId);
    const engager = new InstagramEngager(deviceId, controller);

    console.log("Navigating to explore to find a valid post...");
    await controller.openDeepLink("instagram://explore");
    await controller.sleep(5000);
    
    // Tap the first post in the explore grid (approx x=200, y=500)
    console.log("Tapping first post in explore grid...");
    await controller.tapCoordinate(200, 500);
    await controller.sleep(3000);

    // Now we are on a valid post. We will hack repostPost to skip navigation.
    const targetPost = 'SKIP_NAV';
    
    console.log("Attempting to Repost...");
    await engager.repostPost(targetPost);
    
    // Dump the screen after repostPost to see where we are
    const dump = await controller.getUiDumpXml();
    const fs = require('fs');
    fs.writeFileSync('/tmp/final_repost_screen.xml', dump);
    console.log("Final screen dumped to /tmp/final_repost_screen.xml");
}

main().catch(console.error);
