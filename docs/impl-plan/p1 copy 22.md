# Multi-Device Orchestration Implementation Plan

To run our LinkedIn macro on multiple emulators concurrently, we must update the `LinkedInPublisher` to be device-aware and ensure that temporary files (like screenshots) do not collide when multiple instances run simultaneously.

## Proposed Changes

### `cloud-orchestrator/src/services`

#### [MODIFY] [`LinkedInPublisher.ts`](file:///Users/cortex/ventures/tokiyo-edge-automation/cloud-orchestrator/src/services/LinkedInPublisher.ts)
- **Device Routing**: Update the constructor to accept an optional `deviceId: string`. 
- **ADB Command Wrapper**: Modify `executeAdb(command: string)` to prepend `-s ${this.deviceId}` to the shell commands whenever a `deviceId` is provided. If not provided, it will fallback to standard `adb` (useful for single-device testing).
- **Concurrency Safety**: Update `getOcrCoordinates()` to use a unique local path for the screenshot based on the device ID (e.g., `/tmp/node_screen_${this.deviceId || 'default'}.png`). This ensures that if two orchestrator instances take a screenshot at the exact same millisecond, they don't overwrite each other's files before the Python OCR script processes them.

### `cloud-orchestrator`

#### [MODIFY] [`test_publisher.ts`](file:///Users/cortex/ventures/tokiyo-edge-automation/cloud-orchestrator/test_publisher.ts)
- Update the test file to demonstrate parallel execution. We will instantiate two publishers:
  - `const pub1 = new LinkedInPublisher('emulator-5554');`
  - `const pub2 = new LinkedInPublisher('emulator-5556');`
- Use `Promise.all([pub1.publishPost(...), pub2.publishPost(...)])` to run both macros concurrently and prove true multi-device scale.

## Verification Plan

### Automated Tests
- We will execute the updated `test_publisher.ts` using `npx tsx test_publisher.ts`.

### Manual Verification
- We will rely on ADB log output to verify that commands are being routed with the `-s emulator-XXXX` flag.
- **Note on execution**: We currently only have `emulator-5554` running. Running this multi-device test against `emulator-5556` will throw a "device not found" error, which proves the routing is working as intended. If you'd like to spin up a second emulator before we execute the test, let me know!

## Open Questions

> [!WARNING]
> Do you have a second emulator (e.g., `emulator-5556`) ready to be launched, or should we just test the routing logic and expect the second one to fail gracefully with "device not found"?
