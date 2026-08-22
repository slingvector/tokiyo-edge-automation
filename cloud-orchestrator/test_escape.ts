import { LocalAdbController } from './src/utils/LocalAdbController';

async function testEscape() {
    const device = new LocalAdbController('emulator-5554');
    const commentText = "This is highly insightful. Security is paramount in today's landscape.";
    
    console.log("Original:", commentText);
    const escapedText = commentText.replace(/ /g, '%s').replace(/"/g, '\\"');
    console.log("Escaped for ADB:", escapedText);

    try {
        await device.inputText(escapedText);
        console.log("Input sent to emulator-5554!");
        console.log("✅ Success!");
    } catch (e) {
        console.error("❌ Failed:", e);
    }
}

testEscape().catch(console.error);
