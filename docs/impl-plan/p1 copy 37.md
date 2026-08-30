# Tokiyo Edge Architecture: Testing & Deployment Plan

You asked an excellent question: **Does this require updating the `shizuku-spike` APK?**
**Answer: YES, absolutely.** Because we added new Kotlin files (`CompiledScriptExecutor.kt`, `CompiledScriptDispatcher.kt`) and modified the WebSocket listener in `AgentBridgeService.kt`, the emulator/edge devices will not know how to handle the new `execute_compiled_script` payload until we compile a new APK and install it on them.

Below is the phased plan to achieve **95% test coverage** and begin emulator testing for the new "Compile & Dispatch" architecture.

---

## Phase 5: Test Automation (95% Coverage Goal)

### 5.1 Cloud Orchestrator (Node.js) Testing
Currently, the `cloud-orchestrator` `package.json` has no test framework installed. 
- **Tooling:** We will install `Vitest` (faster than Jest and works well with TypeScript/`tsx`).
- **Unit Tests to Write:**
  1. `JitterEngine.test.ts`: Verify the Box-Muller Gaussian mathematics generate delays within the correct min/max bounds and mean.
  2. `ScriptCompilerService.test.ts`: Verify Redis caching logic and variable injection (e.g., ensuring `%%COMMENT%%` correctly replaces string literals securely).
  3. `CompiledScriptDispatcher.test.ts`: Mock BullMQ and Redis to ensure it correctly signs payloads and emits `dispatch_compiled_script` to the Socket.IO adapter.

### 5.2 Edge Device (Android) Testing
- **Tooling:** We will write JUnit tests within the Android project.
- **Unit Tests to Write:**
  1. `CompiledScriptDispatcherTest.kt`: Mock `TelemetryClient` and `ActionExecutor` to ensure it parses the payload correctly and fires telemetry (IN_PROGRESS -> SUCCESS/FAILED).
  2. `CompiledScriptExecutorTest.kt`: Since this executes raw bash scripts via Shizuku, we will test its file write logic and timeout handling.

---

## Phase 6: Emulator Deployment & Integration Testing

Once the unit tests pass with high coverage, we will move to live emulator testing.

### 6.1 APK Rebuild & Deployment
1. Run `./gradlew assembleDebug` in the `shizuku-spike-sandbox` directory to build the new APK.
2. Run `adb -s emulator-5556 install -r app-debug.apk` to deploy the new bridge to the emulator.
3. Restart the Android background service.

### 6.2 End-to-End (E2E) Test Flow
1. Start the local Cloud Orchestrator, Redis, and PostgreSQL.
2. **Compile a Script:** Write a simple test script (e.g., open calculator, tap a button). Cache it in Redis via `ScriptCompilerService`.
3. **Dispatch:** Push a job to `compiled-scripts-jobs` in BullMQ targeting the emulator's `node_id`.
4. **Verify:** Watch the emulator screen physically execute the bash script without any network hops mid-execution. Verify the success telemetry appears in the Orchestrator console.

---

## User Review Required

Before we proceed with the heavy lifting of writing test suites, please confirm:
1. Are you okay with using **Vitest** for the Node.js backend tests?
2. Do you have a running emulator (like `emulator-5556`) currently accessible via `adb` so we can deploy the new APK and run the End-to-End tests? 

If you approve this plan, I will generate the test cases and begin the Vitest installation!
