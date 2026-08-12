# Tokiyo Edge Automation: Physical Device Testing Guide

This guide provides a step-by-step checklist to deploy, configure, and test the Tokiyo Edge Agent on a physical Android device. 

> [!WARNING]
> **Network Configuration Requirement**
> Currently, `AgentBridgeService.kt` hardcodes the orchestrator URL to `http://10.0.2.2:3000`, which only works for the Android Emulator. **Before building the APK for a physical device, you must update this URL** to your PC's local LAN IP address (e.g., `http://192.168.1.5:3000`). Both your PC and the Android device must be on the same Wi-Fi network.

---

## Pre-requisites Checklist

- [ ] Android physical device running Android 11+ (recommended for Wireless Debugging) or Android 8+ (requires PC connection for Shizuku).
- [ ] Device and Development PC are connected to the **same Wi-Fi network**.
- [ ] PC's Local IP Address is known (run `ifconfig` on Mac/Linux or `ipconfig` on Windows).
- [ ] Node.js installed on PC to run the Cloud Orchestrator.

---

## Step 1: Update Agent Network Config

1. Open `app/src/main/java/com/tokiyo/shizukuspike/service/AgentBridgeService.kt`.
2. Locate the orchestrator URL:
   ```kotlin
   private val orchestratorUrl = "http://10.0.2.2:3000" // Change this!
   ```
3. Update it to your PC's IP:
   ```kotlin
   private val orchestratorUrl = "http://<YOUR_PC_IP>:3000" 
   ```
4. Build the Debug APK:
   ```bash
   ./gradlew assembleDebug
   ```

## Step 2: Device Preparation & Shizuku Setup

1. **Enable Developer Options**: Go to Settings > About Phone > Tap "Build Number" 7 times.
2. **Enable USB Debugging**: Go to Settings > System > Developer Options > Enable "USB debugging".
3. **Enable Wireless Debugging (Android 11+)**: In Developer Options, enable "Wireless debugging".
4. **Install Shizuku**: Download and install the Shizuku app from the [Google Play Store](https://play.google.com/store/apps/details?id=moe.shizuku.privileged.api) or [GitHub Releases](https://github.com/RikkaApps/Shizuku/releases).
5. **Start Shizuku**:
   - *Android 11+*: Open Shizuku -> Tap "Pairing" -> Follow the on-screen instructions to pair via Wireless Debugging, then tap "Start".
   - *Android 10 and below*: Connect the device to your PC via USB and run this ADB command:
     ```bash
     adb shell sh /sdcard/Android/data/moe.shizuku.privileged.api/start.sh
     ```
6. Verify Shizuku says **"Shizuku is running"** at the top of the app.

## Step 3: Install & Authorize the Tokiyo Agent

1. Install the APK you built in Step 1 onto the physical device:
   ```bash
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```
2. Open the **Shizuku** app.
3. Tap on **Authorized applications**.
4. Find **Tokiyo Shizuku Spike** (or your app name) and toggle the switch to **ON**. 
   *(This grants the app the ability to execute shell commands via the Shizuku IPC).*

## Step 4: Start Orchestrator & Connect

1. Start the Cloud Orchestrator on your PC:
   ```bash
   cd cloud-orchestrator
   npm install
   npm run dev
   ```
2. Launch the Tokiyo Edge app on your physical device.
3. Check the Orchestrator terminal on your PC. You should see a log indicating that a new node has registered:
   ```
   [Server] Node registered: <physical_device_node_id>
   ```

## Step 5: Test Execution

Using a tool like Postman, `curl`, or your orchestrator UI, dispatch a job to the physical device.

**Example `click_element` Payload:**
```json
{
  "job_id": "test-physical-1",
  "node_id": "<physical_device_node_id>",
  "timestamp": 1718000000000,
  "ttl_seconds": 60,
  "action": "click_element",
  "params": {
    "text": "Settings"
  },
  "signature": "ignore_for_now"
}
```

**Verification:**
- [ ] Does the orchestrator terminal log the telemetry response from the physical device?
- [ ] Did the physical device actually perform the tap/swipe/paste?
- [ ] Is the action completely native and fluid (no accessibility service lag)?

---

> [!TIP]
> **Troubleshooting Connection Issues**
> If the app cannot connect to the orchestrator, ensure your PC's firewall is not blocking port `3000`. You can test connectivity by opening Chrome on the physical Android device and navigating to `http://<YOUR_PC_IP>:3000`.
