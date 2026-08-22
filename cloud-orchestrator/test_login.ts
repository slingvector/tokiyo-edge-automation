import { LinkedInAuth } from './src/services/LinkedInAuth';

async function main() {
    console.log("Starting the Node.js Automated Login Macro test...");
    
    // Instantiate the Auth service targeting the new emulator and new account
    const authService = new LinkedInAuth('emulator-5554', 'linkedin_2');
    
    console.log("Executing login on emulator-5554...");

    const success = await authService.login();

    if (success) {
        console.log(`✅ [emulator-5558] Test Passed: Successfully authenticated and logged in!`);
    } else {
        console.error(`❌ [emulator-5558] Test Failed: Login flow did not complete.`);
    }
}

main().catch(console.error);
