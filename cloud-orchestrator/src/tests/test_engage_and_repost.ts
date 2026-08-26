import { InstagramEngager } from '../services/InstagramEngager';

async function runTest() {
    console.log("Starting test...");
    const engager = new InstagramEngager('emulator-5554');

    const reelUrl = 'https://www.instagram.com/reel/DcdtfD0BZsT';
    
    try {
        console.log("Attempting to Like and Comment...");
        await engager.engagePost(reelUrl, "Awesome! Love this.");
        
        console.log("Attempting to Repost (Add to story)...");
        await engager.repostPost(reelUrl);
        
        console.log("Test finished successfully.");
    } catch (err) {
        console.error(err);
    }
}
runTest();
