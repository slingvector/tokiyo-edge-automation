import { LocalAdbController } from '../utils/LocalAdbController';
import { IDeviceController } from '../utils/IDeviceController';

export class LinkedInPublisher {
    private device: IDeviceController;
    private deviceId: string;

    constructor(deviceId: string) {
        this.deviceId = deviceId;
        this.device = new LocalAdbController(deviceId);
    }

    public async publishPost(postText: string): Promise<boolean> {
        console.log(`=== Starting LinkedIn Publisher Macro [${this.device.deviceId || 'default'}] ===`);

        // 1. Force Stop to clear intent routing
        await this.device.forceStopApp(`com.linkedin.android`);
        await this.device.sleep(3000);

        // 2. Teleport to Editor
        await this.device.openDeepLink(`https://www.linkedin.com/shareArticle`, `com.linkedin.android`);
        await this.device.sleep(6000);

        // Hide keyboard in case it opened
        await this.device.pressBack();
        await this.device.sleep(1000);

        // 3. Dynamic OCR: Find text editor "your thoughts" (robust to OCR misreads like 'Fhare')
        const editorBox = await this.device.getOcrCoordinates("your thoughts");
        if (editorBox) {
            await this.device.tapCoordinate(editorBox.x, editorBox.y);
            await this.device.sleep(2000);
            
            // Format text for ADB input
            const chunkSize = 100;
            for (let i = 0; i < postText.length; i += chunkSize) {
                const chunk = postText.substring(i, i + chunkSize);
                await this.device.inputText(chunk);
            }
            await this.device.sleep(2000);
        } else {
            console.warn("Could not find text box. Trying to tab to editor...");
            await this.device.pressTab();
            await this.device.pressTab();
            
            const chunkSize = 100;
            for (let i = 0; i < postText.length; i += chunkSize) {
                const chunk = postText.substring(i, i + chunkSize);
                await this.device.inputText(chunk);
            }
            await this.device.sleep(2000);
        }

        // Hide keyboard so it doesn't block Post button
        await this.device.pressBack();
        await this.device.sleep(2000);

        // 4. Dynamic OCR: Find "Post"
        const postBtn = await this.device.getOcrCoordinates("Post");
        if (postBtn) {
            await this.device.tapCoordinate(postBtn.x, postBtn.y);
            console.log("Post submitted successfully!");
            await this.device.sleep(5000);
            return true;
        } else {
            console.error("Could not find Post button!");
            return false;
        }
    }
}
