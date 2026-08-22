import { DeepLinkRegistry } from './src/services/DeepLinkRegistry';
async function main() {
    const apkPath = "/Users/cortex/ventures/tokiyo-edge-automation/docs/com.linkedin.android_4.1.1227-213500_minAPI28(arm64-v8a,armeabi-v7a,x86,x86_64)(nodpi)_apkmirror.com.apk";
    console.log("Starting Deep Link Ingestion...");
    await DeepLinkRegistry.ingestApk(apkPath);
    console.log("\nTesting Heuristic Lookup:");
    const goal = "Go to my profile settings page";
    const link = DeepLinkRegistry.findDeepLinkForGoal("com.linkedin.android", goal);
    if (link) {
        console.log("MATCH FOUND for goal: ", goal);
        console.log(JSON.stringify(link, null, 2));
    }
    else {
        console.log("No match found.");
    }
}
main().catch(console.error);
