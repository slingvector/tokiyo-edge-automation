# Implementation Plan: Remote Shizuku Edge Agent Integration

This plan details the process of connecting the newly abstracted `IDeviceController` pipeline to the existing Tokiyo Android Agent. Thanks to the significant foundation already built in the `shizuku-spike-sandbox`, the Android side is mostly complete and heavily simplifies this integration!

## Open Questions
1. **BullMQ vs Direct Emit**: The existing `Server.ts` uses BullMQ (`jobQueue.add`) to dispatch jobs to edge devices and then waits on `telemetryEvents`. Should the new `RemoteShizukuController` reuse this BullMQ flow (which adds DB persistence and retry logic) or should it emit to Socket.io directly to minimize latency for rapid FSM steps? *(I strongly recommend reusing BullMQ for resilience, but let me know if you prefer direct socket emissions for speed)*.
2. **Action Support**: The Android Agent's `JobDispatcher` currently implements `organic_tap`, `organic_swipe`, `organic_type`, `force_stop`, `dump_ui`, `deep_link`, etc. I will implement the exact counterparts in `RemoteShizukuController`. Does this align with your expectations?

## Proposed Changes

---

### Cloud Orchestrator Layer

#### [MODIFY] `src/utils/RemoteShizukuController.ts`
Implement the stub methods by creating a private `dispatchJobAndWait(action, params)` method. This method will:
1. Generate a UUID for the job.
2. Insert a PENDING record in the database using Prisma.
3. Push the job to the BullMQ `jobQueue` (which uses `signer.signPayload()` and handles the Socket.IO emission).
4. Return a Promise that resolves when `telemetryEvents.once('telemetry_<uuid>')` fires, extracting the status and stdout/ui_dump.

Implement all `IDeviceController` methods to map directly to the Android `JobPayload` actions:
- `tapCoordinate(x,y)` -> `dispatchJobAndWait('organic_tap', { x, y })`
- `swipe(x1,y1,x2,y2,dur)` -> `dispatchJobAndWait('organic_swipe', { start_x: x1, start_y: y1, ... })`
- `inputText(text)` -> `dispatchJobAndWait('organic_type', { text })`
- `forceStopApp(pkg)` -> `dispatchJobAndWait('force_stop', { package: pkg })`
- `openDeepLink(url)` -> `dispatchJobAndWait('deep_link', { url, package: pkg })`
- `getUiDumpXml()` -> `dispatchJobAndWait('dump_ui', {})`, then unzip/decode the returned Base64 XML.
- `pressBack() / pressEnter() / pressTab()` -> `dispatchJobAndWait('shell', { command: 'input keyevent X' })`

#### [MODIFY] `src/api/Server.ts`
Ensure the Socket.IO server `telemetry_report` listener correctly extracts and caches the `ui_dump` payload so that `RemoteShizukuController` can immediately access the returned XML structure. (Currently, it saves it to disk, but we need to pass it back via the event emitter).

---

### Verification Plan

#### Automated Tests
- We will duplicate `test_engager_sequential.ts` into a new `test_shizuku_agent.ts` file.
- We will replace `new LocalAdbController()` with `new RemoteShizukuController('test-device-id')`.
- The test will fire jobs into BullMQ. You can then launch the Android Agent app on a physical device, and watch the Cloud Orchestrator successfully control the physical phone without ADB!
