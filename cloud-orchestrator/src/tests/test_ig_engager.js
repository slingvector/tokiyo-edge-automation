import { InstagramEngager } from '../services/InstagramEngager';
import { LocalAdbController } from '../utils/LocalAdbController';
async function runTest() {
    console.log("Starting test...");
    const device = new LocalAdbController("emulator-5554");
    const engager = new InstagramEngager(device, "emulator-5554");
    // Attempt comment
    console.log("Attempting to comment...");
    const success = await engager.commentOnPost('https://www.instagram.com/reel/DcdtfD0BZsT', 'Awesome!');
    console.log("Test finished with result:", success);
}
runTest().catch(console.error);
