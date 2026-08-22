import { LinkedInEngager } from './src/services/LinkedInEngager';
import { RemoteShizukuController } from './src/utils/RemoteShizukuController';

// We must also import the Server so that the Socket.IO instance boots up on port 3000
// This allows the Android Agent to connect to this orchestrator process during the test.
import './src/api/Server';

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSequentialTest() {
    console.log("=== STARTING SHIZUKU EDGE AGENT FSM TEST ===");

    // In a real environment, you would use the actual Android secure Settings.Secure.ANDROID_ID
    // For this test, we assume you have 1 physical device with the ID '59e3eb9e46c92b43'
    const deviceId = process.argv[2] || '59e3eb9e46c92b43';
    console.log(`Using Device ID: ${deviceId}`);
    
    console.log(`⏳ Waiting 5 seconds for the Android Agent to connect to ws://localhost:3000...`);
    await delay(5000);

    const controller = new RemoteShizukuController(deviceId);
    const engager = new LinkedInEngager(deviceId, controller);

    const posts = [
        {
            url: "https://www.linkedin.com/posts/sakshi-pathak-902040240_linkedingrowth-personalbranding-linkedintips-ugcPost-7495712311618318336-FBjp/?",
            comment: "Great insights on personal branding! Consistency really is the key to LinkedIn growth."
        }
    ];

    for (let p = 0; p < posts.length; p++) {
        const postUrl = posts[p].url;
        const commentText = posts[p].comment;

        console.log(`\n=============================================`);
        console.log(`🚀 PROCESSING POST ${p + 1}: ${postUrl}`);
        console.log(`=============================================\n`);

        console.log(`\n--- PHASE 1: LIKE EVENT ---`);
        try {
            const likeResult = await engager.likePost(postUrl);
            if (likeResult) {
                console.log(`✅ [${deviceId}] Like FSM Event Passed`);
            } else {
                console.error(`❌ [${deviceId}] Like FSM Event Failed`);
            }
        } catch (e) {
             console.error(`❌ [${deviceId}] Like FSM Error:`, e);
        }

        console.log(`\n--- PHASE 2: COMMENT EVENT ---`);
        try {
            const commentResult = await engager.commentOnPost(postUrl, commentText);
            if (commentResult) {
                console.log(`✅ [${deviceId}] Comment FSM Event Passed`);
            } else {
                console.error(`❌ [${deviceId}] Comment FSM Event Failed`);
            }
        } catch (e) {
            console.error(`❌ [${deviceId}] Comment FSM Error:`, e);
        }

        console.log(`\n🎉 POST ${p + 1} ENGAGEMENT CYCLE COMPLETE!`);

        if (p < posts.length - 1) {
            console.log(`\n⏳ Waiting 20 seconds before starting the next post...`);
            await delay(20000);
        }
    }
    
    console.log(`\n✅ SHIZUKU AGENT TEST FULLY COMPLETE!`);
    process.exit(0);
}

runSequentialTest().catch(console.error);
