#!/bin/bash

# Default device ID if none provided
DEVICE_ID=${1:-"59e3eb9e46c92b43"}
ADB_SERIAL=${2:-""}

echo "=========================================================="
echo "🚀 TOKIYO EDGE AUTOMATION - SHIZUKU PIPELINE TEST"
echo "=========================================================="
echo "Target Node ID: $DEVICE_ID"
if [ -n "$ADB_SERIAL" ]; then
    echo "ADB Target: $ADB_SERIAL"
    ADB_CMD="adb -s $ADB_SERIAL"
else
    echo "ADB Target: default device"
    ADB_CMD="adb"
fi
echo "=========================================================="
echo ""

# 1. Start Shizuku via ADB (Official method for non-rooted physical devices)
echo "[1/3] 🟢 Starting Shizuku Server via ADB..."
$ADB_CMD shell sh /storage/emulated/0/Android/data/moe.shizuku.privileged.api/start.sh

# Fallback for devices where the path is different
if [ $? -ne 0 ]; then
    echo "⚠️ Primary path failed, trying fallback SD card path..."
    $ADB_CMD shell sh /sdcard/Android/data/moe.shizuku.privileged.api/start.sh
fi

echo "⏳ Waiting for Shizuku Server to initialize (3s)..."
sleep 3

# 2. Start the Tokiyo Agent App which will bind to Shizuku and start the background service
echo "[2/3] 📱 Launching Tokiyo Edge Agent App..."
$ADB_CMD shell am force-stop com.tokiyo.shizukuspike
$ADB_CMD shell am start -n com.tokiyo.shizukuspike/.MainActivity

echo "⏳ Waiting for Agent to bind to Shizuku and connect to Orchestrator (5s)..."
sleep 5

# 3. Start the Cloud Orchestrator Test Script
echo "[3/3] ☁️ Starting Cloud Orchestrator FSM Test..."
cd cloud-orchestrator
START_SERVER=true npx tsx test_shizuku_agent.ts "$DEVICE_ID"
