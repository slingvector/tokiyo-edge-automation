# Epic 7: Observability and Telemetry (Flight Recorder)

Implement a robust, in-memory flight recorder for the Agent that captures the device's screen state (Screenshot + XML UI Dump), compresses it (GZIP), and streams it back to the Cloud Orchestrator as Base64 telemetry. This provides the Orchestrator's LLM agents with the "eyes" needed to detect and bypass unexpected modals (like force updates) dynamically.

## User Review Required

> [!WARNING]
> Streaming Base64 encoded images and XML dumps over WebSockets can increase payload sizes (e.g., ~100-200KB per telemetry event). We are mitigating this by capturing screenshots at a reduced resolution/quality and applying GZIP compression. Let me know if you have strict bandwidth constraints on the edge nodes.

## Proposed Changes

### `:core:domain`

#### [NEW] `core/domain/src/main/java/com/tokiyo/core/domain/interfaces/IFlightRecorder.kt`
- Create interface `IFlightRecorder` exposing a suspend function `captureSnapshot(): SnapshotData?`
- Define `SnapshotData` data class containing `uiDumpBase64` and `screenshotBase64`.

#### [MODIFY] `core/domain/src/main/java/com/tokiyo/core/domain/interfaces/TelemetryClient.kt`
- Update `sendTelemetry` signature to accept optional `uiDump` and `screenshot` parameters.

#### [MODIFY] `core/domain/src/main/java/com/tokiyo/core/domain/JobDispatcher.kt`
- Inject `IFlightRecorder` into the dispatcher.
- Update the job execution loop: If a job fails (e.g., `click_element` fails to find a node), trigger `flightRecorder.captureSnapshot()` and append the snapshot data to the failed telemetry report.
- Alternatively, support a specific `"dump_ui"` action that explicitly triggers a snapshot and returns it as a success payload.

---

### `:core:uiautomator`

#### [NEW] `core/uiautomator/src/main/java/com/tokiyo/core/uiautomator/FlightRecorderImpl.kt`
- Implement `IFlightRecorder` using `ShizukuExecutor`.
- **UI Dump**: Execute `uiautomator dump /data/local/tmp/dump.xml` and `cat /data/local/tmp/dump.xml`. Gzip the resulting string and encode to Base64.
- **Screenshot**: Execute `screencap -p`. Compress the raw bytes using Gzip and encode to Base64.

---

### `:app`

#### [MODIFY] `app/src/main/java/com/tokiyo/shizukuspike/service/AgentBridgeService.kt`
- Inject `FlightRecorderImpl` into `JobDispatcher`.
- Update `sendTelemetry()` to include `"ui_dump"` and `"screenshot"` keys in the JSON payload emitted to `telemetry_report`.

---

### `cloud-orchestrator`

#### [MODIFY] `cloud-orchestrator/src/api/Server.ts`
- Update the `telemetry_report` socket event listener to extract `ui_dump` and `screenshot` fields.
- Modify Prisma schema (or `payload` JSON handling) to persist the snapshots, or write them to local disk for debugging (e.g., `orchestrator/snapshots/<job_id>.xml.gz` and `.png.gz`) so that LLM workers can process them.

## Verification Plan

### Automated Tests
- Unit test GZIP compression and Base64 encoding in the JVM to ensure lossless data transformation.
- Unit test `JobDispatcher` to ensure it requests snapshots specifically when jobs fail.

### Manual Verification
- We will issue a `click_element` job for a non-existent UI element while the LinkedIn "Update" modal is open.
- We will verify that the Orchestrator receives the FAILED job telemetry, complete with a Base64 payload.
- We will decode the Orchestrator payload locally to visually verify the screenshot contains the LinkedIn modal and the XML tree is properly dumped.
