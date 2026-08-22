#!/bin/bash
# Starts the emulators headlessly for Cloud Environments

export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator

echo "[*] Starting Headless Emulators..."

# -no-window: Do not launch the GUI window (essential for cloud)
# -no-audio: Disable audio backend
# -gpu swiftshader_indirect: Force software rendering so the XML UI tree is still generated correctly without a physical display

emulator -avd tokiyo_test_avd -no-window -no-audio -gpu swiftshader_indirect &
emulator -avd tokiyo_test_avd_2 -port 5556 -no-window -no-audio -gpu swiftshader_indirect &
emulator -avd tokiyo_test_avd_3 -port 5558 -no-window -no-audio -gpu swiftshader_indirect &

echo "[+] Emulators are booting in the background."
echo "Use 'adb devices' to check their status."
