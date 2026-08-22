#!/bin/bash
# setup_device.sh
# Configures an Android device for headless automation.

if [ -z "$1" ]; then
  echo "Usage: ./setup_device.sh <device_serial>"
  exit 1
fi

DEVICE_SERIAL=$1
echo "Configuring device $DEVICE_SERIAL..."

echo "1. Ensuring screen stays awake (prevent sleep lock)..."
adb -s $DEVICE_SERIAL shell svc power stayon true
adb -s $DEVICE_SERIAL shell settings put system screen_off_timeout 1800000

echo "2. Forcing deep links for LinkedIn..."
# Android 12+ requires explicit domain verification override
adb -s $DEVICE_SERIAL shell pm set-app-links-user-selection --user 0 --package com.linkedin.android true www.linkedin.com
adb -s $DEVICE_SERIAL shell pm set-app-links-user-selection --user 0 --package com.linkedin.android true linkedin.com

echo "3. Granting required permissions to Shizuku Sandbox..."
adb -s $DEVICE_SERIAL shell pm grant com.tokiyo.shizukuspike android.permission.DUMP || echo "Warning: DUMP permission not granted."

echo "✅ Device $DEVICE_SERIAL configured successfully!"
