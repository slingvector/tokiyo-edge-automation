import { InstagramEngager } from '../services/InstagramEngager';

async function runTest() {
    console.log("Starting test...");
    const deviceId = process.argv[2] || 'emulator-5554';
    const engager = new InstagramEngager(deviceId);

    const reelUrl = 'https://www.instagram.com/reel/DcdtfD0BZsT';
    
    try {
        console.log("Attempting to Like, Save, Follow, and Comment...");
        await engager.engagePost(reelUrl, "Awesome! Love this.", true, true);
        
        console.log("Attempting to Repost (Add to story)...");
        await engager.repostPost(reelUrl);
        
        console.log("Test finished successfully.");
    } catch (err) {
        console.error(err);
    }
}
runTest();
