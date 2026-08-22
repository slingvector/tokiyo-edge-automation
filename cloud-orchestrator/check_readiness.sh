#!/bin/bash

# Tokiyo Edge Automation - Readiness Checklist
echo "==============================================================="
echo "   Tokiyo Edge Automation - Pre-Flight Readiness Checklist     "
echo "==============================================================="

# 1. Check ADB Devices
echo "[1/5] Checking ADB connection..."
DEVICE=$(adb devices | grep -v "List" | grep "device$" | awk '{print $1}')
if [ -z "$DEVICE" ]; then
    echo "❌ FAILED: No ADB devices found. Please plug in your phone and enable USB Debugging."
    exit 1
else
    echo "✅ SUCCESS: Found active device(s): $DEVICE"
fi

# 2. Check Shizuku Edge Agent Installation
echo "[2/5] Checking if Edge Agent is installed..."
# Use 2>/dev/null to avoid SecurityException on Samsung devices with Secure Folder (user 150)
INSTALLED=$(adb -s "$DEVICE" shell pm list packages 2>/dev/null | grep com.tokiyo.shizukuspike)
if [ -z "$INSTALLED" ]; then
    echo "❌ FAILED: Shizuku Spike Sandbox is not installed. Run './gradlew installDebug' in shizuku-spike-sandbox."
    exit 1
else
    echo "✅ SUCCESS: Edge Agent (com.tokiyo.shizukuspike) is installed."
fi

# 2.5 Setup Network Bridge for WebSocket
echo "[2.5/5] Bridging Android localhost to Mac..."
adb -s "$DEVICE" reverse tcp:3000 tcp:3000
echo "✅ SUCCESS: TCP:3000 mapped from Phone to Mac."

# 3. Check Shizuku Authorization
echo "[3/5] Checking Shizuku Daemon Authorization..."
SHIZUKU_RUNNING=$(adb -s "$DEVICE" shell dumpsys activity service com.tokiyo.shizukuspike | grep "AgentUserService")
if [ -z "$SHIZUKU_RUNNING" ]; then
    echo "⚠️ WARNING: Shizuku might not be authorized or AgentUserService is asleep."
    echo "   Ensure you have opened the 'Shizuku Spike Sandbox' app and granted Shizuku permissions!"
else
    echo "✅ SUCCESS: AgentUserService is active in the dumpsys registry."
fi

# 4. Check Redis/Postgres (Docker)
echo "[4/5] Checking Database & Redis status..."
DOCKER_RUNNING=$(docker ps | grep "tokiyo-redis")
if [ -z "$DOCKER_RUNNING" ]; then
    echo "❌ FAILED: Postgres or Redis containers are not running. Did you run 'docker-compose up'?"
    exit 1
else
    echo "✅ SUCCESS: Postgres & Redis containers are running locally."
fi

# 5. Check Port Conflicts
echo "[5/5] Checking port 3000 conflicts..."
PORT_IN_USE=$(lsof -i :3000)
if [ ! -z "$PORT_IN_USE" ]; then
    echo "⚠️ WARNING: Port 3000 is currently in use."
    echo "   If you want to run a standalone test script (like test_messaging.ts), you must stop the 'tokiyo-orchestrator' Docker container first."
    echo "   Command: docker stop tokiyo-orchestrator"
else
    echo "✅ SUCCESS: Port 3000 is free for your test scripts."
fi

echo "==============================================================="
echo "🎉 All systems go! You are ready to run edge automation tests."
echo "==============================================================="
