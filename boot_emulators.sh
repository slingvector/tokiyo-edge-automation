#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Tokiyo Edge Automation - Fleet Emulator Boot Script
# Boots 2 concurrent emulators for testing distributed queue routing.
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "=== Booting Emulator Fleet ==="

# Define the AVD names. You can check yours with: ~/Library/Android/sdk/emulator/emulator -list-avds
AVD1="tokiyo_test_avd"  
AVD2="tokiyo_test_avd_2"

export PATH=$PATH:$HOME/Library/Android/sdk/emulator

echo "[1/2] Starting Node 1 (Port 5554)..."
nohup emulator -avd $AVD1 -port 5554 -no-snapshot-save -gpu swiftshader_indirect > /dev/null 2>&1 &
sleep 5

echo "[2/2] Starting Node 2 (Port 5556)..."
nohup emulator -avd $AVD2 -port 5556 -no-snapshot-save -gpu swiftshader_indirect > /dev/null 2>&1 &

echo "Fleet is booting! Use 'adb devices' to check when they come online."
