#!/bin/bash
# AWS mac2.metal Instance Setup Script for Android Headless Automation
# Run this directly on the fresh EC2 instance

echo "==========================================="
echo " Setting up AWS mac2.metal EC2 Instance"
echo "==========================================="

# 1. Install Node & PM2
echo "[*] Installing Node.js and PM2..."
if ! command -v node &> /dev/null; then
    brew install node
fi
npm install -g pm2 tsx

# 2. Install Android Commandline Tools
echo "[*] Installing Android Command Line Tools..."
brew install --cask android-commandlinetools

export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator

# Accept licenses
yes | sdkmanager --licenses > /dev/null

# 3. Download Android System Image
echo "[*] Downloading Android 34 System Image..."
sdkmanager "system-images;android-34;google_apis;x86_64" "platforms;android-34" "emulator"

# 4. Provision AVDs
echo "[*] Creating AVDs for Headless Automation..."

echo "no" | avdmanager create avd -n tokiyo_test_avd -k "system-images;android-34;google_apis;x86_64" --force
echo "no" | avdmanager create avd -n tokiyo_test_avd_2 -k "system-images;android-34;google_apis;x86_64" --force
echo "no" | avdmanager create avd -n tokiyo_test_avd_3 -k "system-images;android-34;google_apis;x86_64" --force

echo "==========================================="
echo "[+] Instance Provisioning Complete!"
echo "==========================================="
