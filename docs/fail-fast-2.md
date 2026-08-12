You are 100% correct to step back. Before writing a single line of Kotlin or configuring dependency injection, you need to prove the physical layer works.

If the OS drops the connection or blocks a basic intent, the entire architecture fails. Since Samsung's OneUI (which your Galaxy S25 Ultra runs) has incredibly aggressive background process management and security policies, validating these raw shell commands first is mandatory.

Here is the 15-minute terminal gauntlet. You will run this entirely from your Mac terminal to the target phone to prove the core mechanics.

1. **Establish Wireless ADB Binding:**
Turn on **Wireless Debugging** in the phone's Developer Options. Keep the screen on.

From your Mac terminal, pair and connect:

```bash
adb pair <IP>:<PORT>  # Use the port shown in the pairing dialog
adb connect <IP>:<PORT> # Use the port shown on the main wireless debugging screen

```

**The Trap:** OneUI will automatically disable Wireless Debugging if the device disconnects from Wi-Fi or reboots. You must assign the phone a static IP in your router settings to prevent the port/IP from shifting during your 48-hour burn-in.


2. **Control Power and Lock State:**
Remove the lock screen PIN/biometrics entirely from Android Settings (set to "Swipe" or "None"). Then, lock the screen using the physical power button and wait 10 seconds.

Run these commands sequentially from the Mac:

```bash
adb shell input keyevent 224  # KEYCODE_WAKEUP - turns on the screen
adb shell input keyevent 82   # KEYCODE_MENU - dismisses the keyguard (if set to Swipe)

```

**The Trap:** If `keyevent 82` fails to swipe away the lock screen on OneUI, you will need to replace it with a physical swipe simulation: `adb shell input swipe 500 1500 500 500`.


3. **Route and Open the Target App:**
Prove you can launch a specific app and route it to a precise view (Deep Linking) without touching the screen.

```bash
# Option A: Standard App Launch (Opens to default feed)
adb shell monkey -p com.linkedin.android -c android.intent.category.LAUNCHER 1

# Option B: Deep Link Launch (Forces the app to open a specific URL)
adb shell am start -a android.intent.action.VIEW -d "https://www.linkedin.com/in/" com.linkedin.android

```


4. **Bootstrap Shizuku:**
Install the Shizuku APK on the phone, open it, and leave it on the home screen. Now, trigger the daemon from your Mac:

```bash
adb shell sh /sdcard/Android/data/moe.shizuku.privileged.api/start.sh

```

If successful, the Shizuku app UI will instantly update from "Not running" to "Running".


If you can execute all four of these steps successfully from your Mac terminal, the physical constraints of the device are cleared, and we know the architecture is viable.