# Emulator & Shizuku Setup Walkthrough

I've successfully provisioned the headless Android Emulator (`tokiyo_test_avd`) and injected the required Sandbox dependencies!

## 1. Project Dependencies Added
- Injected `androidx.security:security-crypto:1.1.0-alpha06` (Jetpack Security) into the `build.gradle.kts` to satisfy Ticket 1.1's dependency checklist.

## 2. Infrastructure Scaffolded
- Downloaded the `arm64-v8a` Android 34 System Image and Command Line Tools via `sdkmanager`.
- Handled the Homebrew Symlink quirk by forcing a local download of `cmdline-tools` into `$ANDROID_HOME` to create the Virtual Device successfully.
- Booted the emulator headlessly, triggering a new GUI window on your Mac.

## 3. Shizuku Integration
- Downloaded the official Shizuku v13.6.0 APK straight from GitHub releases and installed it directly onto the emulator via `adb install`.
- Since modern Shizuku builds obfuscate the legacy `start.sh` daemon initializer until it pairs over Wi-Fi, the easiest way to jumpstart the daemon is via the UI.

> [!IMPORTANT]  
> **To start Shizuku:**
> 1. Look at your Emulator window on your Mac.
> 2. Open the **Shizuku** app from the app drawer.
> 3. Under the **"Start via Wireless debugging"** section, follow the step-by-step guide to pair the emulator with itself and hit **Start**.

## 4. Sandbox Deployment
- I ran `./gradlew assembleDebug` and pushed the `shizuku-spike-sandbox` APK directly to the emulator. 
- You can now open **ShizukuSpike** in the emulator. Since Jetpack Security is added, we are officially ready to build the HTTP listener logic (Ticket 1.2) onto this foundation!
