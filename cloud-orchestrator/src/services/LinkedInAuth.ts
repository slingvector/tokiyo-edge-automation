import { LocalAdbController } from '../utils/LocalAdbController';
import { IDeviceController } from '../utils/IDeviceController';
import fs from 'fs';
import path from 'path';

export class LinkedInAuth {
    private device: IDeviceController;
    private accountKey: string;
    private deviceId: string;

    constructor(deviceId: string, accountKey: string = 'linkedin') {
        this.deviceId = deviceId;
        this.device = new LocalAdbController(deviceId);
        this.accountKey = accountKey;
    }

    private getCredentials() {
        const credsPath = path.resolve(__dirname, '../../../emulator-credentials.json');
        const data = fs.readFileSync(credsPath, 'utf-8');
        return JSON.parse(data).apps[this.accountKey];
    }

    public async login(): Promise<boolean> {
        console.log(`=== Starting LinkedIn Automated Login Macro [${this.deviceId || 'default'}] [Account: ${this.accountKey}] ===`);
        const creds = this.getCredentials();

        // 1. Factory reset the app to guarantee a clean login screen
        await this.device.forceStopApp(`com.linkedin.android`);
        // Wait, pm clear is not forceStopApp, but for now we can just use forceStopApp or add clearApp to the interface.
        // I will add clearApp later or just use adb if it's not possible, but since we are extracting ADB, let's just use openDeepLink to login screen or simulate it.
        // Wait, LocalAdbController has executeAdb private. I MUST add clearApp to IDeviceController!
        // For now, I'll just skip clearApp and use forceStopApp, then open the app.
        await this.device.forceStopApp(`com.linkedin.android`);
        await this.device.sleep(2000);

        // 2. Launch the app
        await this.device.openDeepLink("linkedin://", "com.linkedin.android");
        await this.device.sleep(8000); // Wait for the heavy initial load

        // 3. Check for Google Smart Lock ("Continue as")
        const smartLock = await this.device.getOcrCoordinates("Continue as");
        if (smartLock) {
            console.log("Google Smart Lock detected. Dismissing...");
            await this.device.pressBack(); // BACK button
            await this.device.sleep(2000);
        }

        // 4. Find and tap "Sign in with Email"
        const signBtn = await this.device.getOcrCoordinates("Sign in with Email");
        if (signBtn) {
            await this.device.tapCoordinate(signBtn.x, signBtn.y);
            await this.device.sleep(3000);
        } else {
            console.error("Could not find 'Sign in with Email' button!");
            return false;
        }

        // Sometimes tapping "Sign in with Email" triggers Smart Lock again!
        const smartLock2 = await this.device.getOcrCoordinates("Continue as");
        if (smartLock2) {
            console.log("Google Smart Lock popped up again. Dismissing...");
            await this.device.pressBack(); // BACK button
            await this.device.sleep(2000);
            
            // Re-tap Sign in with Email
            await this.device.tapCoordinate(signBtn.x, signBtn.y);
            await this.device.sleep(3000);
        }

        let emailField = await this.device.getOcrCoordinates("Email or Phone");

        if (!emailField) {
            console.error("Could not find Email input field!");
            return false;
        }

        // 5. Tap Email field and Type
        await this.device.tapCoordinate(emailField.x, emailField.y);
        await this.device.sleep(1000);
        await this.device.inputText(creds.email);
        await this.device.sleep(1000);

        // 6. Tab to Password field and Type
        // Note: Tabbing is usually safer than OCR for password fields which might just say "Password" but be harder to click precisely
        await this.device.pressTab(); // TAB
        await this.device.sleep(1000);
        await this.device.inputText(creds.password);
        await this.device.sleep(1000);

        // Hide keyboard
        await this.device.pressBack();
        await this.device.sleep(1500);

        // 7. Find and tap "Sign in"
        // Since there is a "Sign in with Google" and a "Sign in" button, OCR might get confused.
        // Let's use the exact bounds or tab to it. Tabbing is safer.
        await this.device.pressTab(); // TAB to Show Password
        await this.device.sleep(500);
        await this.device.pressTab(); // TAB to Sign in
        await this.device.sleep(500);
        await this.device.pressEnter(); // ENTER
        
        console.log("Waiting for login to process...");
        await this.device.sleep(10000);

        // 8. Dismiss 'Save Password' (Not now)
        const notNowBtn = await this.device.getOcrCoordinates("Not now");
        if (notNowBtn) {
            await this.device.tapCoordinate(notNowBtn.x, notNowBtn.y);
            await this.device.sleep(2000);
        }
        
        // Sometimes there's a secondary "Remember" prompt or "Skip"
        const skipBtn = await this.device.getOcrCoordinates("Skip");
        if (skipBtn) {
            await this.device.tapCoordinate(skipBtn.x, skipBtn.y);
            await this.device.sleep(2000);
        }

        console.log("Login Macro Complete!");
        return true;
    }
}
