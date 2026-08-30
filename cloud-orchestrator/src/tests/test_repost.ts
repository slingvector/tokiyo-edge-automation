import { InstagramEngager } from '../services/InstagramEngager';
import * as fs from 'fs';

class RepostEngager extends InstagramEngager {
    public async testShareSheet() {
        console.log("Force stopping and starting reel...");
        await this.device.executeAdb(`shell am force-stop com.instagram.android`);
        await this.device.executeAdb(`shell am start -a android.intent.action.VIEW -d "https://www.instagram.com/reel/DcdtfD0BZsT" -p com.instagram.android`);
        await this.device.sleep(8000);
        
        let xmlData = await this.getSafeUiDumpXml();
        
        // Find Share button
        let shareBtn = this.findByResourceId(xmlData, 'com.instagram.android:id/row_feed_button_share') ||
                       this.findByResourceId(xmlData, 'com.instagram.android:id/share_button');
                       
        if (!shareBtn) {
             const regex = /<node [^>]*content-desc="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g;
             let match;
             while ((match = regex.exec(xmlData)) !== null) {
                 if (match[1].toLowerCase().includes('send') || match[1].toLowerCase().includes('share')) {
                     shareBtn = { x: (parseInt(match[2]) + parseInt(match[4]))/2, y: (parseInt(match[3]) + parseInt(match[5]))/2 };
                     console.log("Found via content-desc: " + match[1]);
                     break;
                 }
             }
        }
        
        if (!shareBtn) {
            console.log("Could not find Share button!");
            return;
        }
        
        console.log(`Tapping Share button at ${shareBtn.x}, ${shareBtn.y}`);
        await this.tapWithJitter(shareBtn.x, shareBtn.y);
        await this.device.sleep(4000); // wait for sheet
        
        console.log("Dumping Share sheet...");
        let sheetXml = await this.getSafeUiDumpXml();
        fs.writeFileSync('/tmp/reel_share_sheet.xml', sheetXml);
        console.log("Done");
    }
}

async function run() {
    const engager = new RepostEngager('emulator-5554');
    await engager.testShareSheet();
}
run();
