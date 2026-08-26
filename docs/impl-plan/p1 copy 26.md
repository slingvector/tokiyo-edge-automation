# Device Controller Dual-Mode Architecture Refactor

This plan details the architectural shift to separate the `LinkedInEngager`'s core state machine logic from the underlying execution transport layer (ADB vs. Shizuku). By abstracting all device interactions behind an `IDeviceController` interface, the Orchestrator can seamlessly drive both local Emulators and remote physical Edge Devices.

## User Review Required

> [!WARNING]
> This refactor will eliminate the use of raw `executeAdb` strings inside `LinkedInEngager.ts`. All device commands will be upgraded to strongly-typed semantic methods (e.g., `device.forceStopApp("com.linkedin.android")`).

## Open Questions

1. **Remote Node Registry**: For the `RemoteShizukuController`, do you plan to use raw WebSockets (Socket.io/ws) for bidirectional communication, or a polling HTTP API? (I will leave the Shizuku controller as a stub for now, but this dictates its internal implementation).
2. **XML Caching**: Should the `getUiDumpXml()` method handle the temporary `/tmp/` file saving internally for the local ADB controller, returning only the raw XML string to the Engager? (I recommend YES to decouple file-system logic from the FSM).

## Proposed Changes

---

### Cloud Orchestrator Interfaces

#### [NEW] `src/utils/IDeviceController.ts`
Create the core interface that both controllers will implement:
```typescript
export interface IDeviceController {
    deviceId: string;
    
    // Core FSM Execution API
    forceStopApp(packageName: string): Promise<void>;
    openDeepLink(url: string, packageName?: string): Promise<void>;
    tapCoordinate(x: number, y: number): Promise<void>;
    inputText(text: string): Promise<void>;
    pressEnter(): Promise<void>;
    swipe(x1: number, y1: number, x2: number, y2: number, duration?: number): Promise<void>;
    
    // Perception API
    getUiDumpXml(): Promise<string>;
    getOcrCoordinates(targetText: string): Promise<{x: number, y: number} | null>;
    
    // Utilities
    sleep(ms: number): Promise<void>;
}
```

#### [MODIFY] `src/utils/DeviceController.ts` -> `LocalAdbController.ts`
Rename the file and implement the interface using the existing `execAsync` ADB logic. The `executeAdb` method will become `private` to ensure the interface contract is strictly enforced. It will also internally handle the `uiautomator dump` and `/tmp/` file I/O for `getUiDumpXml()`.

#### [NEW] `src/utils/RemoteShizukuController.ts`
Create a stub implementation of `IDeviceController`. This will eventually hold the WebSocket emission logic to stream JSON payloads to the Tokiyo Edge Agent Android App (e.g., `emit("organic_tap", { x, y })`).

---

### FSM Logic

#### [MODIFY] `src/services/LinkedInEngager.ts`
Refactor the FSM to use the new semantic API instead of raw bash shell commands.
* Replace all `executeAdb('shell am force-stop ...')` with `forceStopApp(...)`.
* Replace `executeAdb('shell uiautomator dump ...')` and `fs.readFileSync(...)` with a single call to `const xml = await this.device.getUiDumpXml()`.
* Replace `executeAdb('shell input text ...')` with `inputText(text)`.

#### [MODIFY] `src/server.ts`
Update the initialization to use `new LocalAdbController(id)` instead of the old `DeviceController`.

## Verification Plan

### Automated Tests
- Run `npx tsx test_engager_sequential.ts` using the new `LocalAdbController`.
- Verify the system still perfectly engages with both posts concurrently on all 3 emulators, proving the abstraction didn't break the existing local workflow.
