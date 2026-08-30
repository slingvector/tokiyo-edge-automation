import { LocalAdbController } from '../utils/LocalAdbController';
import * as fs from 'fs';

async function run() {
    const device = new LocalAdbController('emulator-5554');
    
    console.log("Force stopping and starting reel...");
    await device.executeAdb(`shell am force-stop com.instagram.android`);
    await device.executeAdb(`shell am start -a android.intent.action.VIEW -d "https://www.instagram.com/reel/DcdtfD0BZsT" -p com.instagram.android`);
    await device.sleep(8000);
    
    console.log("Tapping center of screen to pause video...");
    await device.executeAdb(`shell input tap 160 300`);
    await device.sleep(2000); // wait for it to actually pause
    
    console.log("Dumping screen...");
    let xml = await device.getUiDumpXml();
    fs.writeFileSync('/tmp/reel_paused.xml', xml);
    console.log("Done");
}
run();
