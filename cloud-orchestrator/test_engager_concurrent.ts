import { LinkedInEngager } from './src/services/LinkedInEngager';

async function main() {
    console.log("Starting FSM Concurrent Engagement Test...");

    const postUrl = process.argv[2];
    
    if (!postUrl) {
        console.error("❌ Please provide a LinkedIn Post URL as an argument!");
        console.error("Usage: npx tsx test_engager_concurrent.ts <LINKEDIN_POST_URL>");
        process.exit(1);
    }

    console.log(`Targeting Post URL: ${postUrl}`);

    const engager1 = new LinkedInEngager('emulator-5554');
    const engager2 = new LinkedInEngager('emulator-5556');
    const engager3 = new LinkedInEngager('emulator-5558');

    const comment1 = "This is a fantastic perspective! I completely agree that edge AI is revolutionizing the industry.";
    const comment2 = "Great post! The impact of these technologies on supply chain logistics cannot be overstated.";
    const comment3 = "Insightful analysis. The shift towards decentralized compute is definitively the future.";

    console.log("\n=============================================");
    console.log("🔥 PHASE 1: LIKE EVENT (CLEAN STATE)");
    console.log("=============================================\n");

    const likeResults = await Promise.allSettled([
        engager1.likePost(postUrl),
        engager2.likePost(postUrl),
        engager3.likePost(postUrl)
    ]);

    likeResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
            console.log(`✅ [Emulator ${index + 1}] Like FSM Event Passed`);
        } else {
            console.error(`❌ [Emulator ${index + 1}] Like FSM Event Failed:`, result);
        }
    });

    console.log("\n=============================================");
    console.log("💬 PHASE 2: COMMENT EVENT (CLEAN STATE)");
    console.log("=============================================\n");

    const commentResults = await Promise.allSettled([
        engager1.commentOnPost(postUrl, comment1),
        engager2.commentOnPost(postUrl, comment2),
        engager3.commentOnPost(postUrl, comment3)
    ]);

    commentResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
            console.log(`✅ [Emulator ${index + 1}] Comment FSM Event Passed`);
        } else {
            console.error(`❌ [Emulator ${index + 1}] Comment FSM Event Failed:`, result);
        }
    });

    console.log("\n🎉 FSM ENGAGEMENT CYCLE COMPLETE!");
}

main().catch(console.error);
