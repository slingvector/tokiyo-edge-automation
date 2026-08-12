#!/bin/bash

# Tokiyo Edge Automation - Dev Environment Bootstrap
# Run this script whenever the emulator restarts to automatically inject Shizuku and start the Spike app.

echo "==========================================="
echo " Tokiyo Edge Automation Bootstrap Script   "
echo "==========================================="

# 1. Wait for emulator to be fully booted
echo "[*] Waiting for device to come online..."
adb wait-for-device

# Wait for sys.boot_completed to ensure package manager is ready
echo "[*] Waiting for Android system to finish booting..."
while [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" != "1" ]; do
    sleep 1
done
echo "[+] Device is fully booted."

# 2. Elevate adb to root
echo "[*] Elevating ADB to root..."
adb root
adb wait-for-device
sleep 2 # Give adbd a moment to restart as root

# 3. Locate Shizuku and Inject Server
echo "[*] Locating Shizuku installation..."
SHIZUKU_PKG="moe.shizuku.privileged.api"
APK_PATH=$(adb shell pm path $SHIZUKU_PKG | cut -d: -f2 | tr -d '\r')

if [ -z "$APK_PATH" ]; then
    echo "[-] Shizuku is not installed on the emulator. Please install it first."
    exit 1
fi

BASE_DIR=$(dirname "$APK_PATH")
echo "[+] Found Shizuku at $BASE_DIR"

# Check architectures
echo "[*] Injecting Shizuku server..."
# We try arm64 first, then x86_64, then arm
COMMAND="LIB_PATH=\"$BASE_DIR/lib/arm64/libshizuku.so\"; \
if [ ! -f \"\$LIB_PATH\" ]; then LIB_PATH=\"$BASE_DIR/lib/x86_64/libshizuku.so\"; fi; \
if [ ! -f \"\$LIB_PATH\" ]; then LIB_PATH=\"$BASE_DIR/lib/arm/libshizuku.so\"; fi; \
if [ ! -f \"\$LIB_PATH\" ]; then LIB_PATH=\"$BASE_DIR/lib/x86/libshizuku.so\"; fi; \
\$LIB_PATH"

# Run it in the background on the device
adb shell "$COMMAND" > /dev/null 2>&1 &
sleep 2

# Verify it's running
if adb shell ps -A | grep -q "shizuku_server"; then
    echo "[+] Shizuku server successfully injected and running."
else
    echo "[-] Failed to inject Shizuku server. Please check logs."
    exit 1
fi

# 4. Restart the Spike App
echo "[*] Restarting Tokiyo Spike App..."
SPIKE_PKG="com.tokiyo.shizukuspike"
adb shell am force-stop $SPIKE_PKG
adb shell am start -n $SPIKE_PKG/.MainActivity

echo "==========================================="
echo "[+] Bootstrap Complete!"
echo "[*] The Spike App should now say 'Shizuku Binder Active'."
echo "==========================================="
