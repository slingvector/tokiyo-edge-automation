# Goal: Achieve 95% Test Coverage on Core Modules

The objective is to implement comprehensive unit and integration tests for the completed phases (1, 2, and 3), ensuring 95% coverage across the core business logic, executing components, and IPC bridges. We will also integrate JaCoCo for automated coverage reporting.

## Open Questions

1. **Test Frameworks**: I plan to use `JUnit4`, `MockK` (for mocking Kotlin interfaces/objects), and `kotlinx-coroutines-test` (for testing `suspend` functions). Does this align with your preferences?
2. **Android Tests vs. Unit Tests**: For Android-specific components like `AgentBridgeService` and `ShizukuExecutor`, I plan to use **Robolectric** to keep tests fast and run them on the JVM without requiring a physical emulator for CI pipelines. Is this acceptable, or do you prefer on-device instrumentation tests (`androidTest`)?

## Proposed Changes

### Setup & Tooling

#### [MODIFY] `build.gradle.kts` (Root)
- Add the JaCoCo plugin to the classpath and configure a unified coverage report task across all modules.

#### [MODIFY] `core/*/build.gradle.kts` & `app/build.gradle.kts`
- Add test dependencies:
  - `junit:junit:4.13.2`
  - `io.mockk:mockk:1.13.8` (or `mockk-android` for Android modules)
  - `org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3`
  - `org.robolectric:robolectric:4.11.1` (for `:app` and `:core:shizuku`)

---

### `:core:domain`

#### [NEW] `JobDispatcherTest.kt`
- Mock `SignatureVerifier`, `ActionExecutor`, `UiAutomatorClient`, and `TelemetryClient`.
- Test successful payload verification and command dispatch.
- Test failed signature verification (ensure it drops payload and reports failure).
- Test `click_element` action routing to `UiAutomatorClient`.
- Test exception handling (ensure telemetry reports internal errors).

---

### `:core:security`

#### [NEW] `SecurityEngineTest.kt`
- Test `verifyPayload` with valid signatures.
- Test `verifyPayload` with tampered payloads (ensure it fails).
- Test `verifyPayload` with manipulated JSON string structures.

---

### `:core:uiautomator`

#### [NEW] `UiAutomatorServiceTest.kt`
- Mock `ActionExecutor`.
- Test `dumpHierarchy()` handles successful `uiautomator dump` and `cat` shell commands.
- Test `findNode()` parses mock XML correctly.
- Test `clickElement()` successfully retrieves coordinates and dispatches `input tap X Y`.

---

### `:core:shizuku`

#### [NEW] `ShizukuExecutorTest.kt`
- Mock the static `Shizuku` API and `ShizukuRemoteProcess`.
- Test `executeCommand()` parses `stdout` and `stderr` correctly.
- Test `executeCommand()` extracts the correct exit code.

---

### `:app`

#### [NEW] `SocketTelemetryClientTest.kt`
- Test telemetry payload serialization and WebSocket emission.

#### [NEW] `AgentBridgeServiceTest.kt` (using Robolectric)
- Test `onCreate()` initializes dependencies correctly.
- Test WebSocket connection events and job JSON parsing.

## Verification Plan

### Automated Tests
- Run `./gradlew test jacocoTestReport`.
- Parse the generated HTML/XML JaCoCo reports to verify line and branch coverage exceeds **95%** across `:core:domain`, `:core:security`, `:core:uiautomator`, and `:core:shizuku`.
