import { InstagramEngager } from '../services/InstagramEngager';
import { LocalAdbController } from '../utils/LocalAdbController';

async function runReelTest() {
    const deviceId = 'emulator-5554';
    const controller = new LocalAdbController(deviceId);
    const engager = new InstagramEngager(deviceId, controller);

    const reelUrl = 'https://www.instagram.com/reel/DcdtfD0BZsT';
    const commentText = 'Absolutely agree! 💯 Great stuff.';

    console.log(`Starting Reel Test on ${deviceId}...`);
    try {
        await engager.commentOnPost(reelUrl, commentText);
        console.log('✅ Reel test completed successfully.');
    } catch (e) {
        console.error('❌ Reel test failed:', e);
    }
}

runReelTest().catch(console.error);
