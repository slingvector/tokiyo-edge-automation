import { LocalAdbController } from '../utils/LocalAdbController';
import { InstagramEngager } from '../services/InstagramEngager';

async function main() {
    const deviceId = process.argv[2];
    if (!deviceId) {
        console.error("Usage: npx tsx test_final_ig_all.ts <deviceId>");
        process.exit(1);
    }

    console.log(`\n======================================================`);
    console.log(`🚀 STARTING FINAL COMPREHENSIVE INSTAGRAM TEST`);
    console.log(`📱 Device: ${deviceId}`);
    console.log(`======================================================\n`);

    const controller = new LocalAdbController(deviceId);
    const engager = new InstagramEngager(deviceId, controller);

    try {
        console.log("------------------------------------------------------");
        console.log("STEP 0: Clean State");
        console.log("------------------------------------------------------");
        console.log("Force stopping Instagram...");
        await controller.forceStopApp('com.instagram.android');
        await controller.sleep(2000);

        console.log("\n------------------------------------------------------");
        console.log("STEP 1: Navigate to Explore & Find a Valid Post");
        console.log("------------------------------------------------------");
        await controller.openDeepLink("instagram://explore");
        await controller.sleep(5000);
        
        console.log("Tapping first post in explore grid...");
        await controller.tapCoordinate(200, 500);
        await controller.sleep(4000);

        console.log("\n------------------------------------------------------");
        console.log("STEP 2: Engage Post (Like & Comment)");
        console.log("------------------------------------------------------");
        // Using SKIP_NAV to run on the currently opened post
        const commentText = "Incredible stuff! Great post!";
        await engager.engagePost('SKIP_NAV', commentText, false, false);
        await controller.sleep(3000);

        // Press back to dismiss keyboard or any comment popups
        console.log("Dismissing keyboard/comment modal...");
        await controller.pressBack();
        await controller.sleep(1500);

        console.log("\n------------------------------------------------------");
        console.log("STEP 3: Repost Post (Share to Story)");
        console.log("------------------------------------------------------");
        // Using SKIP_NAV to run on the currently opened post
        await engager.repostPost('SKIP_NAV');

        console.log("\n======================================================");
        console.log("✅ FINAL TEST SUITE COMPLETED SUCCESSFULLY!");
        console.log("======================================================");

    } catch (e) {
        console.error("\n❌ FINAL TEST FAILED:", e);
    } finally {
        // Release lock if any (engager acquires redis-based locks inside FSM,
        // but since this is a local test, it relies on LocalAdbController which 
        // doesn't heavily depend on Redis locks, but we should make sure we don't leave things hanging).
        console.log("Test finished.");
        process.exit(0);
    }
}

main();
