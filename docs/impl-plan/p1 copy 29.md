# Resilient Edge Automation Implementation Plan

To ensure the issues we encountered (silent failures, device locking, deep links breaking, shell crashes) never happen again, and to make the setup of new edge clients incredibly easy and stable, we need to implement a **Resilient Edge Architecture**.

This plan outlines the specific code changes required across both the Cloud Orchestrator and the Android Edge Agent.

## Open Questions
- Do you want the `setup_device.sh` script to be run manually once per new device, or should the Orchestrator attempt to run it automatically when it detects a new device locally? (For pure cloud deployments, it must be run locally once before the device is shipped/deployed).

## Proposed Changes

### 1. The "One-Click" Device Setup Script
To make setting up a new client easy and stable, we will create a master setup script that configures the device to never sleep, bypasses app link restrictions, and prepares it for headless automation.

#### [NEW] `cloud-orchestrator/setup_device.sh`
A bash script that runs the following ADB commands on a target device:
- `adb shell settings put system screen_off_timeout 1800000` (Sets timeout to 30 mins, or uses `svc power stayon true`)
- `adb shell pm set-app-links-user-selection --user 0 --set 1 com.linkedin.android www.linkedin.com` (Forces deep links to work natively)
- `adb shell pm grant com.tokiyo.shizukuspike android.permission.DUMP` (Ensures it has all permissions)

### 2. Android Edge Agent: Rich Telemetry & Error Handling
We must stop the Android agent from swallowing errors. If a shell command fails, it must return *why* it failed.

#### [MODIFY] `shizuku-spike-sandbox/core/domain/src/main/java/com/tokiyo/core/domain/JobDispatcher.kt`
- Modify the `executeOrganicType` (and other shell-based commands) to capture `stderr` alongside `stdout`.
- If the exit code is non-zero, include the `stderr` string in the FAILED telemetry payload sent back via WebSocket.

### 3. Orchestrator: Pre-Flight Checks & Defensive FSMs
The Orchestrator must verify the device is in a healthy state before sending jobs, and it must throw loud, descriptive errors if a state machine step fails.

#### [MODIFY] `cloud-orchestrator/src/utils/RemoteShizukuController.ts`
- Add a new method: `verifyDeviceState()`
- This method will dispatch a job to check if the screen is on (`dumpsys power | grep 'Display Power: state='`) and if the keyguard is locked (`dumpsys window | grep mDreamingLockscreen`).
- If the device is locked, it will attempt to wake and unlock it automatically, or throw a critical error aborting the job.

#### [MODIFY] `cloud-orchestrator/src/services/LinkedInEngager.ts`
- Refactor the FSM to stop using silent `return false;` statements.
- Replace them with explicit errors: `throw new Error("[Node ID] FSM Failed: Expected Compose Box, but it was not found on screen.")`.
- Add an automatic UI dump save to a local `logs/` directory whenever an error is thrown, so we can visually debug what the agent saw.

## Verification Plan

### Automated Tests
- Run `setup_device.sh` on a fresh Android emulator or device and verify all configurations apply successfully.
- Run a modified `test_messaging.ts` that intentionally sends a broken shell command to verify the Orchestrator prints the exact `stderr` from the Android Agent.

### Manual Verification
- We will lock the device screen manually, then run the test. The Orchestrator's new pre-flight check should detect the lock screen and explicitly report it before even trying to open LinkedIn.
