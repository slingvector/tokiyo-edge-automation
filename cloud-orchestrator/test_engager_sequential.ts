import { LinkedInEngager } from './src/services/LinkedInEngager';

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSequentialTest() {
    console.log("=== STARTING SEQUENTIAL FSM TEST ===");

    const devices = ['emulator-5554', 'emulator-5556', 'emulator-5558'];
    const engagers = devices.map(id => new LinkedInEngager(id));

    const posts = [
        {
            url: "https://www.linkedin.com/posts/nihal8132_ive-worked-with-founders-who-spent-months-share-7495802404295241728-Zq0e",
            comment: "This is so true! Focusing on the right metrics from day one is essential. Great insights!"
        },
        {
            url: "https://www.linkedin.com/posts/sreelakshmiac_the-more-leads-i-get-from-linkedin-the-more-share-7496070299382210562-ChJK",
            comment: "Absolutely agree. Quality over quantity always wins when it comes to lead generation."
        }
    ];

    for (let p = 0; p < posts.length; p++) {
        const postUrl = posts[p].url;
        const commentText = posts[p].comment;

        console.log(`\n=============================================`);
        console.log(`🚀 PROCESSING POST ${p + 1}: ${postUrl}`);
        console.log(`=============================================\n`);

        console.log(`\n--- PHASE 1: LIKE EVENT ---`);
        const likePromises = engagers.map((engager, index) => {
            return engager.likePost(postUrl).then(result => {
                if (result) {
                    console.log(`✅ [Emulator ${index + 1}] Like FSM Event Passed`);
                } else {
                    console.error(`❌ [Emulator ${index + 1}] Like FSM Event Failed`);
                }
            }).catch(e => {
                console.error(`❌ [Emulator ${index + 1}] Like FSM Error:`, e);
            });
        });
        await Promise.allSettled(likePromises);

        console.log(`\n--- PHASE 2: COMMENT EVENT ---`);
        const commentPromises = engagers.map((engager, index) => {
            return engager.commentOnPost(postUrl, commentText).then(result => {
                if (result) {
                    console.log(`✅ [Emulator ${index + 1}] Comment FSM Event Passed`);
                } else {
                    console.error(`❌ [Emulator ${index + 1}] Comment FSM Event Failed`);
                }
            }).catch(e => {
                console.error(`❌ [Emulator ${index + 1}] Comment FSM Error:`, e);
            });
        });
        await Promise.allSettled(commentPromises);

        console.log(`\n🎉 POST ${p + 1} ENGAGEMENT CYCLE COMPLETE!`);

        if (p < posts.length - 1) {
            console.log(`\n⏳ Waiting 20 seconds before starting the next post...`);
            await delay(20000);
        }
    }
    
    console.log(`\n✅ SEQUENTIAL TEST FULLY COMPLETE!`);
    process.exit(0);
}

runSequentialTest().catch(console.error);
