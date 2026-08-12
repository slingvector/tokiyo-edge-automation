# Tokiyo Edge Automation - Master Project Plan

## Architecture Overview

**Tokiyo Edge Automation** is a highly distributed, secure automation pipeline built on:
1. **Cloud Orchestrator (Node.js)**: Distributes jobs, manages telemetry, interfaces with Postgres/Redis.
2. **Edge Node (Android App)**: Receives jobs via WebSocket, validates signatures.
3. **Execution Engine (Shizuku + UIAutomator)**: Executes high-privileged actions securely on the edge.

---

## Phase 1: Fail-Fast & Core IPC [COMPLETED]

**Objective:** Validate that the riskiest components of the architecture actually work on physical/emulated devices before building abstractions.

### Validated Components:
- **WebSocket Bridge:** `AgentBridgeService` successfully maintains a persistent connection with the Orchestrator, dynamically fetching the `ANDROID_ID` for node registration.
- **Signature Verification:** Replay attacks and unauthorized payloads are successfully blocked via ECDSA signature validation in the Edge Node.
- **Shizuku Privilege Escalation:** Validated that we can execute raw shell commands (like `ls` and `echo`) using Shizuku's daemonized `libshizuku.so`.
- **API 30+ Compatibility:** We successfully bypassed the Shizuku Provider visibility bug by injecting `<queries>` into the `AndroidManifest.xml` and registering the `ShizukuProvider`.
- **Environment Automation:** Created `dev-bootstrap.sh` to seamlessly inject the Shizuku daemon and bind the Spike App after emulator restarts, completely bypassing manual UI flows.

---

## Phase 2: Domain Abstraction & Clean Architecture

**Objective:** Move from "Spike Sandbox" to production-grade architecture using strict Separation of Concerns.

### 1. The `:core:domain` Module
Under **no circumstances** should Android framework classes (Context, UIAutomator, Shizuku, View) leak into the `:core:domain` layer.
- The Domain layer will contain pure Kotlin definitions of `Action`, `Job`, `Result`, and `Telemetry`.
- Interfaces like `ActionExecutor` will be defined here, but implemented in `:core:shizuku` or `:core:uiautomator`.

### 2. The `:core:shizuku` Module
- Encapsulates all `Shizuku.newProcess` logic.
- Implements `ActionExecutor` to translate Domain `Action` objects into raw shell commands.

### 3. The `:core:uiautomator` Module
- Encapsulates `UiDevice` and Accessibility node traversal.
- Will be used for UI-based actions (clicking, scraping).

---

## Phase 3: SDUI & Security Evasion

**Objective:** Overcome platform limitations for rendering and secure text injection.

### 1. `FLAG_SECURE` Mitigation
- We will integrate `ADBKeyboard` or similar input-injection methods via Shizuku shell to bypass `ClipboardManager` restrictions on Android 10+ and `FLAG_SECURE` screenshots.
- Fallback: Accessibility Node injection.

### 2. Server-Driven UI (SDUI)
- The Orchestrator will define UI layouts using JSON.
- The Android app will use Jetpack Compose to dynamically parse and render these layouts without requiring app updates.

---

## Deployment & Telemetry

- All jobs will report back to the Orchestrator with structured `Exit Codes`.
- `Exit 0`: Success.
- `Exit -1`: IPC or Execution failure.
- Telemetry includes rendering latency, network ping, and execution duration.

**Target Execution Agents:** Claude Code, Google Anti-Gravity, Cursor, Codex, Autonomous Coding Agents

---

## 1. System Architecture & Technical Specifications

```
                       [ CLOUD / LOCAL CONTROL PLANE ]
                 +-----------------------------------------+
                 |       Distributed Job Scheduler         |
                 |     (PostgreSQL + Redis Queue + DLQ)    |
                 +--------------------+--------------------+
                                      |
                         Ed25519 Payload Signing
                                      |
                 +--------------------v--------------------+
                 |          FCM Dispatch Engine            |
                 |      (High-Priority Data Payloads)      |
                 +--------------------+--------------------+
                                      |
======================================|======================================
                          ZERO-TRUST NETWORK BOUNDARY
======================================|======================================
                                      |
                         FCM Encrypted Ingestion
                                      |
                 +--------------------v--------------------+
                 |          Android Edge Agent             |
                 |   (Foreground Service + WorkManager)    |
                 +--------------------+--------------------+
                                      |
                      Cryptographic Signature Check
                        & Time-Drift Anti-Replay
                                      |
                 +--------------------v--------------------+
                 |     Action Controller & Orchestrator    |
                 +----------+-------------------+----------+
                            |                   |
            +---------------+                   +---------------+
            |                                                   |
+-----------v-----------+                           +-----------v-----------+
|    Perception Engine  |                           |   Execution Engine    |
| - Tier 1: XML Semantic|                           | - Shizuku Shell IPC   |
| - Tier 2: ML Kit OCR  |                           | - Touch Entropy/Jitter|
+-----------+-----------+                           | - Clipboard Injector  |
            |                                       +-----------+-----------+
            +-------------------+   +---------------------------+
                                |   |
                 +--------------v---v--------------+
                 |    System Framework & Targets   |
                 | - Shizuku Daemon (app_process)  |
                 | - Target Mobile App (Sandboxed) |
                 +---------------------------------+

```

### 1.1 Technology Stack & Ecosystem Standards

* **Android Edge Agent:**
* **Language/Runtime:** Kotlin 2.0+, JDK 17, Android SDK 34 (UpsideDownCake) minSdk 28.
* **Architecture:** Hexagonal / Clean Architecture (`domain`, `data`, `presentation`, `framework`).
* **Concurrency:** Kotlin Coroutines + Asynchronous Flow (`StateFlow`, `SharedFlow`).
* **Dependency Injection:** Dagger-Hilt / Koin (constructor-injected interfaces).
* **IPC & Privileged Execution:** Shizuku API v13+ (`moe.shizuku.privileged.api`).
* **Computer Vision / OCR:** Google ML Kit Text Recognition (`com.google.android.gms:play-services-mlkit-text-recognition`).
* **Cryptography:** Tink Crypto / BouncyCastle / Sodium (Ed25519 verification).
* **Serialization:** Kotlinx Serialization (strict JSON validation, no reflection-heavy Jackson).


* **Central Orchestrator (Backend):**
* **Language/Runtime:** Go (Golang 1.22+) or TypeScript (Node.js 20+ / Bun LTS).
* **Data Layer:** PostgreSQL 16 (Relational state & logs) + Redis 7 (Distributed Queue, Deduplication, Circuit Breakers).
* **Cloud Relay:** Firebase Admin SDK (High-Priority Data Messages).
* **Telemetry Ingestion:** Structured JSON over HTTPS/mTLS.


* **Testing & Quality Assurance Framework:**
* **Android:** MockK, JUnit 5, Robolectric, Turbine (Flow verification), AssertJ, JaCoCo (strictly enforcing $\ge$95% line and branch coverage).
* **Backend:** Go `testing` package with `testify`, `dockertest` (ephemeral DB integration tests), mock interfaces for external services.



---

### 1.2 Execution Activity Diagram

This diagram traces the precise decision logic, retry loops, and security gates executed by the Edge Agent upon receiving a job.

```
                  [Start: FCM High-Priority Push Received]
                                     │
                                     ▼
                    <Verify Ed25519 Signature & Timestamp>
                                     │
                    ┌────────────────┴────────────────┐
               [Signature Invalid                [Signature Valid &
               or Age > 60s]                     Age <= 60s]
                    │                                 │
                    ▼                                 ▼
           [Drop Payload & Log Alert]     [Acquire Partial WakeLock]
                    │                                 │
                 [Exit]                               ▼
                                          <Check Device Screen State>
                                                      │
                                    ┌─────────────────┴─────────────────┐
                             [Screen Off]                          [Screen On]
                                    │                                   │
                                    ▼                                   │
                         [Execute Keyevent 224 (Wake)                   │
                          & Keyevent 82 (Unlock)]                       │
                                    │                                   │
                                    └─────────────────┬─────────────────┘
                                                      │
                                                      ▼
                                         [Fire Deep Link Intent]
                                         (Target: com.linkedin.android)
                                                      │
                                                      ▼
                                            [Sleep Delay: 1500ms]
                                                      │
                                                      ▼
                                       <Seek Target UI Element in Loop>
                                             (Max Retries: 3)
                                                      │
                                    ┌─────────────────┴─────────────────┐
                             [Element Missing]                   [Element Found]
                                    │                                   │
                                    ▼                                   ▼
                         [Execute Scroll Swipe]             <Evaluate Action Type>
                         (input swipe 500 1500 500 500)                 │
                                    │                     ┌─────────────┴─────────────┐
                                    └──────────────────┐  │                           │
                                                       │  ▼                           ▼
                                                       │ [LIKE]                   [COMMENT]
                                                       │  │                           │
                                                       │  ▼                           ▼
                                                       │ <Check State:            [Copy String to
                                                       │  Already Liked?>          Clipboard]
                                                       │  │                           │
                                                       │  ├─────────────┐             ▼
                                                       │  │ [Yes]       │ [No]    [Tap Comment Box
                                                       │  │             │          & Send Paste Keyevent 279]
                                                       │  │             ▼             │
                                                       │  │        [Calculate Center  │
                                                       │  │         Bounds & Tap]     ▼
                                                       │  │             │        [Tap "Post" Button]
                                                       │  │             │             │
                                                       │  └─────────────┼─────────────┘
                                                       │                │
                                                       ▼                ▼
                                             [Timeout / Failure]  [Success Status]
                                                       │                │
                                                       └────────────────┬─────────────┘
                                                                        │
                                                                        ▼
                                                           [Execute Force Stop App]
                                                           (am force-stop com.linkedin.android)
                                                                        │
                                                                        ▼
                                                           [Dispatch HTTP POST Webhook]
                                                                        │
                                                                        ▼
                                                           [Release WakeLock & Exit]
```

---

## 2. Core Schemas & Communication Contracts

### 2.1 Cryptographically Signed Command Schema (`JobPayload`)

Every command dispatched from the orchestrator must strictly adhere to this schema. Payloads failing validation or schema compliance must be immediately dropped.

```json
{
  "version": "1.0.0",
  "job_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "node_id": "edge_node_pixel7_001",
  "timestamp": 1723382400,
  "ttl_seconds": 60,
  "action": "ENGAGE_POST",
  "params": {
    "target_package": "com.target.application",
    "deep_link_url": "https://www.target.com/posts/activity-123456789",
    "interaction_type": "LIKE_AND_COMMENT",
    "comment_payload": "Exceptional architectural breakdown! 🚀",
    "entropy_config": {
      "min_delay_ms": 800,
      "max_delay_ms": 2500,
      "swipe_jitter_px": 25
    },
    "ui_overrides": {
      "like_button_identifiers": ["like_button", "react_action_button"],
      "comment_box_identifiers": ["comment_input_text", "write_comment"],
      "post_submit_identifiers": ["comment_post_button", "submit_action"]
    }
  },
  "signature": "d2f5a89c4b7e1f0a3e5c7d8b9a1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a90123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
}

```

### 2.2 Telemetry & "Flight Recorder" Webhook Schema (`TelemetryPayload`)

```json
{
  "event_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "job_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "node_id": "edge_node_pixel7_001",
  "timestamp": 1723382412,
  "status": "FAILED",
  "error_code": "ERR_UI_NOT_FOUND",
  "execution_metrics": {
    "total_latency_ms": 4250,
    "shizuku_ipc_latency_ms": 320,
    "ocr_fallback_triggered": true,
    "battery_level": 58,
    "thermal_status": "NONE"
  },
  "flight_recorder": {
    "last_screen_state": "SCREEN_FOCUSED_FEED",
    "compressed_uidump_gzip_b64": "H4sICG...[GZIP+Base64 Encoded XML]...==",
    "ocr_detected_tokens": ["Home", "My Network", "Post", "Share"]
  }
}

```

### 2.3 Standard Error Code Taxonomy

| Error Code | Trigger Condition | System Action |
| --- | --- | --- |
| `ERR_SIG_INVALID` | Ed25519 public key verification failure | Drop payload, emit security incident, ban IP/source. |
| `ERR_REPLAY_ATTACK` | `current_time - timestamp > ttl_seconds` | Drop payload, log time-drift synchronization alert. |
| `ERR_SHIZUKU_UNAVAILABLE` | Shizuku binder dead or permission revoked | Transition node state to `OFFLINE`, trigger local recovery. |
| `ERR_UI_NOT_FOUND` | XML & ML OCR strategies failed to find target | GZIP encode UI tree, upload flight telemetry, fail job. |
| `ERR_CHECKPOINT` | Security wall/CAPTCHA overlay detected | Trip circuit breaker immediately, suspend edge node. |
| `ERR_THERMAL_LIMIT` | Device battery temp $>42^\circ\text{C}$ | Reject job, enter cooldown mode for 15 minutes. |

---

### 2.4 Core Use Cases

#### Use Case UC-01: Authenticated Like Action
**Primary Actor:** Cloud Orchestrator.
**Pre-conditions:** Edge Agent is active, Shizuku daemon is running in background, LinkedIn account is logged in on target device.
**Main Success Scenario:**
1. Orchestrator signs payload containing action: `LIKE`, url: `<post_url>`, timestamp, and sig.
2. Edge Agent receives FCM payload, validates signature, and wakes screen.
3. Edge Agent issues Deep Link intent to target URL.
4. Shizuku captures screen XML dump and parses bounding box for `content-desc="Like"`.
5. Edge Agent verifies post is not already liked, calculates center coordinates $(X, Y)$, and issues `input tap X Y`.
6. Edge Agent force-closes LinkedIn app and POSTs status: `SUCCESS` back to Cloud Orchestrator.

#### Use Case UC-02: Authenticated Comment Action
**Primary Actor:** Cloud Orchestrator.
**Pre-conditions:** Same as UC-01, plus payload contains non-empty comment string.
**Main Success Scenario:**
1. Orchestrator dispatches signed action: `COMMENT` payload.
2. Edge Agent opens target post via Deep Link intent.
3. Shizuku locates and taps the "Comment" button to open the input drawer.
4. Edge Agent writes comment string to Android `ClipboardManager`.
5. Shizuku taps comment text box to gain focus and dispatches `input keyevent 279` (Paste).
6. Shizuku parses bounds for "Post" button and taps it.
7. Edge Agent cleans up clipboard, force-closes LinkedIn, and sends success callback.

---

## 3. Phased Implementation Roadmap

```
PHASE 1: EDGE KERNEL & PRIVILEGED IPC
├── Epic 1: Clean Architecture Scaffolding & Dynamic Config
└── Epic 2: Shizuku IPC Subsystem & Privileged Shell Wrapper

PHASE 2: DYNAMIC PERCEPTION & EXECUTION ENGINE
├── Epic 3: Deterministic XML & Probabilistic ML Perception
└── Epic 4: Entropy-Driven Interaction & Cleanup Engine

PHASE 3: ZERO-TRUST BRIDGE & CLOUD CONTROL PLANE
├── Epic 5: Cryptographic Boundary & Edge Ingestion
└── Epic 6: Distributed Cloud/Local Orchestrator & Job Queue

PHASE 4: RESILIENCY, OBSERVABILITY & HARDENING
├── Epic 7: Telemetry "Flight Recorder" & Circuit Breaking
└── Epic 8: Hardware Hardening & 24/7 Production Fleet Lifecycle

```

---

### Epic 1: Clean Architecture Scaffolding & Dynamic Config

#### Goal

Establish a pure Kotlin multi-module / layered architecture adhering to SOLID principles. All timeouts, string identifiers, package targets, and thresholds must be dynamically injectable via configurations without hardcoded values.

#### Task 1.1: Multi-Module Dependency Architecture

* **Subtasks:**
* Configure modular Gradle setup with explicit boundaries:
* `:core:domain` (Pure Kotlin, zero Android dependencies; contains entities, use cases, repository interfaces).
* `:core:crypto` (Pure Kotlin/Java cryptography boundary for Ed25519).
* `:core:common` (Result monads, functional error wrappers, time providers).
* `:data:ipc` (Shizuku bindings, shell wrappers, root/ADB process abstractions).
* `:data:telemetry` (Flight recorder, GZIP compression, structured loggers).
* `:data:repository` (Implementations of domain repositories).
* `:feature:perception` (XML parser, ML Kit OCR strategy).
* `:feature:execution` (Touch injection, clipboard management, process lifecycle).
* `:app` (DI setup, Foreground Services, FCM Receiver, application lifecycle).


* Configure JaCoCo plugin across all modules, enforcing a strict 95% line/branch coverage build failure threshold.


* **Testing Gate:** Run `./gradlew test jacocoTestReport`. Verify coverage report parses and build succeeds with zero dead code.

#### Task 1.2: Dynamic Configuration Provider & Result Monad

* **Subtasks:**
* Define pure domain entity `EngineConfig` loaded from an encrypted local keystore or injected dynamically.
* Implement functional error-handling monad `AppResult<T, AppError>` to eliminate raw runtime exceptions.
* Create `TimeProvider` interface with deterministic mock implementations for anti-replay testing.


* **Testing Gate:** Unit test `AppResult` mapping, folding, and error propagation with 100% test coverage.

---

### Epic 2: Shizuku IPC Subsystem & Privileged Shell Wrapper

#### Goal

Implement a robust, non-crashing IPC bridge to the Shizuku privileged daemon (`app_process`) that abstracts shell execution behind a fully mockable interface.

#### Task 2.1: Shizuku Service Binder & Lifecycle Observer

* **Subtasks:**
* Implement `ShizukuBinderManager` satisfying `IShizukuManager` interface.
* Register `OnBinderReceivedListener` and `OnBinderDeadListener`.
* Implement a thread-safe `StateFlow<ShizukuState>` (`CONNECTED`, `DISCONNECTED`, `PERMISSION_DENIED`).
* Implement automatic binder reconnect loop with exponential backoff.


* **Testing Gate:** Unit test state transitions using MockK to simulate binder dead and reconnection events.

#### Task 2.2: Privileged Shell Execution Engine

* **Subtasks:**
* Create interface `IShellExecutor`:
```kotlin
interface IShellExecutor {
    suspend fun executeCommand(command: String, timeoutMs: Long = 5000): AppResult<CommandOutput, ShellError>
}

```


* Implement `ShizukuShellExecutor` using `Shizuku.newProcess()`.
* Ensure standard output (`stdout`) and error output (`stderr`) streams are consumed asynchronously in separate coroutines to prevent buffer deadlocks.
* Implement strict execution timeouts: kill orphan child processes if execution exceeds `timeoutMs`.


* **Testing Gate:** Integration test executing `echo "test"` and `whoami`. Assert that `stdout` captures `shell` or `root` uid. Mock process hangs to verify process termination on timeout.

---

### Epic 3: Dynamic Perception Engine (Tiered XML + ML OCR)

#### Goal

Build a dual-strategy perception engine that maps UI elements dynamically. The primary strategy evaluates the deterministic XML accessibility tree; if obfuscation is detected, it falls back seamlessly to an on-device ML Kit OCR computer vision strategy.

#### Task 3.1: XML Accessibility Tree Parser (Tier-1 Strategy)

* **Subtasks:**
* Create `ISemanticPerceptionStrategy`.
* Implement `dumpHierarchy()` invoking `uiautomator dump /data/local/tmp/uidump.xml` via `IShellExecutor`.
* Read and parse the resulting XML file in-memory using `XmlPullParser` into a tree of `UINode` models.
* Implement bounds parser: extract `bounds="[x1,y1][x2,y2]"` and compute geometric center:

$$X_{\text{center}} = \frac{x_1 + x_2}{2}, \quad Y_{\text{center}} = \frac{y_1 + y_2}{2}$$


* Implement multi-attribute dynamic search evaluating `resource-id`, `content-desc`, and `text` against configured identifiers/regex.


* **Testing Gate:** Unit test with 10+ diverse real-world XML dumps (Light mode, Dark mode, dynamic feed layouts). Assert exact coordinate calculations.

#### Task 3.2: On-Device ML Kit Visual Fallback (Tier-2 Strategy)

* **Subtasks:**
* Create `IVisualPerceptionStrategy`.
* Implement screenshot capture via `IShellExecutor`: `screencap -p /data/local/tmp/screen.png`.
* Load bitmap into memory using Android `BitmapFactory` with safe recycling.
* Wrap Google ML Kit's `TextRecognizer` in a coroutine-based suspending function.
* Map recognized `Text.Element` bounding boxes (`android.graphics.Rect`) to center coordinates $(X, Y)$.


* **Testing Gate:** Mock `TextRecognizer` output with sample UI screenshots. Assert that search queries (e.g., "Like", "Comment") map to the correct visual bounding boxes.

#### Task 3.3: Perception Engine Strategy Orchestrator

* **Subtasks:**
* Implement `PerceptionEngine` combining Tier-1 and Tier-2 via Chain of Responsibility / Fallback Pattern:
1. Attempt Tier-1 (Semantic XML). If found, return `TargetCoordinates`.
2. If not found, execute dynamic scroll swipe (`input swipe X1 Y1 X2 Y2 Duration`) and retry Tier-1 (up to $N$ configured retries).
3. If Tier-1 completely fails, trigger Tier-2 (Visual ML OCR).
4. If Tier-2 succeeds, flag `ocr_fallback_triggered = true` for telemetry.
5. If all fail, throw `PerceptionException.ElementNotFound`.




* **Testing Gate:** Unit test fallback sequence. Simulate XML failure $\rightarrow$ ML OCR recovery $\rightarrow$ Total failure paths.

---

### Epic 4: Entropy-Driven Execution Engine

#### Goal

Execute physical touch and text injections via Shizuku shell commands with human-like entropy (jitter, non-linear velocity, randomized timing) and ensure total state cleanup.

#### Task 4.1: Human Touch Entropy & Gesture Generator

* **Subtasks:**
* Implement `ITouchDispatcher`:
```kotlin
interface ITouchDispatcher {
    suspend fun tap(coords: TargetCoordinates, jitterPx: Int = 15): AppResult<Unit, ExecutionError>
    suspend fun scroll(direction: Direction, entropy: EntropyConfig): AppResult<Unit, ExecutionError>
}

```


* Add Gaussian random offsets to tap coordinates:

$$X_{\text{actual}} = X_{\text{target}} + \mathcal{N}(0, \sigma^2), \quad Y_{\text{actual}} = Y_{\text{target}} + \mathcal{N}(0, \sigma^2)$$


* Implement swipe with variable velocity and intermediate waypoints to defeat bot-detection heuristics that look for perfectly straight swipes.


* **Testing Gate:** Mathematical unit tests verifying coordinate generation distributions stay strictly within UI bounding boxes.

#### Task 4.2: Safe Clipboard Injection Subsystem

* **Subtasks:**
* Implement `IClipboardInjector` avoiding truncated or mangled Unicode/emojis.
* Focus target input field via `ITouchDispatcher.tap()`.
* Copy payload string to Android `ClipboardManager` on the Main Thread.
* Dispatch `input keyevent 279` (PASTE) via `IShellExecutor`.
* Clear `ClipboardManager` immediately (within 100ms) after paste confirmation to prevent clipboard leakage.


* **Testing Gate:** Unit test string preservation across full UTF-8/UTF-16 spectra (emojis, RTL text, markdown characters).

#### Task 4.3: App Lifecycle Controller & Aggressive Sandbox Cleanup

* **Subtasks:**
* Implement `IAppLifecycleController` to manage target packages:
* `launchDeepLink(url: String, package: String)`
* `forceStop(package: String)` via `am force-stop <package>`
* `clearCache(package: String)` (optional privileged command)


* Ensure `forceStop` is guaranteed to execute via a Kotlin `finally` block or coroutine cancellation handler.


* **Testing Gate:** Unit test lifecycle triggers. Verify that even during unexpected coroutine cancellation, `forceStop` executes.

---

### Epic 5: Cryptographic Boundary & Zero-Trust Command Ingestion

#### Goal

Ensure the Edge Agent operates under Zero-Trust. No incoming command is executed unless it passes Ed25519 signature verification, timestamp anti-replay validation, and target device matching.

#### Task 5.1: Ed25519 Cryptographic Verification Module

* **Subtasks:**
* Create `ISecurityEngine` in `:core:crypto`:
```kotlin
interface ISecurityEngine {
    fun verifySignature(payloadJson: String, signatureHex: String, publicKeyHex: String): Boolean
    fun validateTimestamp(timestampUnix: Long, ttlSeconds: Long): Boolean
}

```


* Implement verification using constant-time comparisons to prevent timing side-channel attacks.
* Ensure the payload canonicalization is deterministic before verifying signatures (sorted JSON keys, normalized whitespace).


* **Testing Gate:**
* Test valid payload $\rightarrow$ pass.
* Test tampered payload (modify 1 character) $\rightarrow$ fail.
* Test expired timestamp ($>\text{ttl}$) $\rightarrow$ fail.
* Test future timestamp ($>\text{current\_time} + 5\text{s}$) $\rightarrow$ fail.



#### Task 5.2: Secure FCM Receiver & Foreground Worker Bridge

* **Subtasks:**
* Implement `EdgeFirebaseMessagingService` extending `FirebaseMessagingService`.
* Ingest `RemoteMessage` high-priority data payloads.
* Pass raw payload directly to `ISecurityEngine`.
* If valid, acquire a temporary Android `PowerManager.WakeLock` and delegate to an `AppExecutionForegroundService` via Android `WorkManager` or direct Foreground Service.
* If invalid, log security incident, increment local metric, and immediately terminate.


* **Testing Gate:** Unit test FCM payload ingestion with Robolectric and mock security modules.

---

### Epic 6: Distributed Cloud/Local Orchestrator & Job Queue

#### Goal

Build a high-performance, fault-tolerant backend orchestrator in Go or TypeScript that schedules jobs, signs payloads with an Ed25519 private key, dispatches them via FCM, and tracks node state transitions.

#### Task 6.1: Relational & Distributed Queue Architecture

* **Subtasks:**
* Define PostgreSQL schema for `nodes`, `jobs`, `audit_logs`, and `telemetry_records`.
* Implement a Redis-backed queue with support for:
* Job deduplication (`job_id`).
* Node lock acquisition (ensure only 1 active job per `node_id` at a time).
* Dead Letter Queue (DLQ) with exponential backoff and randomized jitter.
* Write `docker-compose.yml` to spin up the local backend API alongside Postgres and Redis for the local orchestrator deployment.

* **Testing Gate:** Integration tests using `dockertest` / testcontainers. Verify transactional consistency and worker locking under concurrent worker contention.

#### Task 6.2: Ed25519 Payload Signer & Dispatcher Engine

* **Subtasks:**
* Implement cryptographic signing service using Go `crypto/ed25519` or Node `crypto`.
* Canonicalize JSON payload and generate hex/base64 signature.
* Integrate Firebase Admin SDK to dispatch `High-Priority` FCM data messages targeting device tokens.


* **Testing Gate:** Unit test signing output against the Android verification engine (cross-platform verification test suite).

#### Task 6.3: Webhook Ingestion & Circuit Breaker Engine

* **Subtasks:**
* Build HTTP POST endpoint `/api/v1/telemetry/report` with mTLS or API token verification.
* Implement Circuit Breaker pattern:
* If a node reports `ERR_CHECKPOINT`, trip circuit immediately $\rightarrow$ mark node `SUSPENDED`.
* If a node reports 3 consecutive `ERR_UI_NOT_FOUND`, trip circuit $\rightarrow$ mark node `MAINTENANCE_REQUIRED`.
* If a node fails to report heartbeat for 3 intervals $\rightarrow$ mark node `DEAD`.
* Configure automated incident routing: Fire HTTP webhook to a local `n8n` instance when a circuit breaker trips to dispatch instant Slack/Telegram alerts.

* **Testing Gate:** Unit test circuit breaker state machine transitions (`CLOSED` $\rightarrow$ `OPEN` $\rightarrow$ `HALF-OPEN`).

---

### Epic 7: Telemetry "Flight Recorder" & Observability

#### Goal

Equip the Edge Agent with a black-box flight recorder that captures the complete execution state, UI dump, and system metrics during failures, providing instantaneous remote forensic capability.

#### Task 7.1: In-Memory Flight Recorder & Snapshot Generator

* **Subtasks:**
* Implement `IFlightRecorder` in `:data:telemetry`.
* Maintain a ring-buffer of the last 5 state transitions and execution logs.
* On failure trigger (`ERR_UI_NOT_FOUND`, `ERR_CHECKPOINT`, unhandled crash):
1. Capture current `uidump.xml` and screen state.
2. Compress using `GZIPOutputStream`.
3. Encode using Base64.
4. Compile structured `TelemetryPayload`.




* **Testing Gate:** Unit test GZIP compression and decompression fidelity. Assert compression ratios $>85\%$ on standard Android UI XML dumps.

#### Task 7.2: Unhandled Exception & Kernel Crash Handler

* **Subtasks:**
* Register `Thread.setDefaultUncaughtExceptionHandler`.
* On catastrophic crash:
1. Immediately issue synchronous `am force-stop <target_package>` via local shell.
2. Write crash stacktrace to disk cache.
3. Attempt synchronous network flush of crash telemetry before process termination.




* **Testing Gate:** Unit test forced unhandled exception. Verify cleanup shell command is invoked before process exit.

#### Task 7.3: Centralized Log Ingestion

* **Subtasks:**
* Deploy a local log ingestion container (e.g., Loki or Elasticsearch) linked to the orchestrator API.
* Build an endpoint to ingest and index structured telemetry (`node_id`, `battery_level`, `job_id`, `latency_ms`).
* Decode and store XML snapshots for forensic querying.

* **Testing Gate:** Integration test: trigger simulated edge crash and assert telemetry payload is indexed and searchable in the local DB.

#### Task 7.4: Node Health Dashboard

* **Subtasks:**
* Spin up a local Grafana container connected to the ingestion database.
* Create a dashboard tracking active nodes, job success rates, average execution latency, and battery/thermal states across the fleet.

* **Testing Gate:** Manual verification of dashboard widgets rendering mock telemetry data.

---

### Epic 8: Hardware Hardening & 24/7 Production Fleet Lifecycle

#### Goal

Harden the physical device against Android OS lifecycle aggression (Doze mode, Phantom Process Killer, thermal throttling) for uninterrupted 24/7 operations.

#### Task 8.1: Doze Mode Exemption & Wake Sequence

* **Subtasks:**
* Implement boot check for `PowerManager.isIgnoringBatteryOptimizations()`. If false, trigger system intent `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`.
* Implement privileged wake sequence on command receipt:
* Wake screen: `input keyevent 224` (`KEYCODE_WAKEUP`)
* Unlock keyguard: `input keyevent 82` (`KEYCODE_MENU`)


* Ensure proper release of CPU `WakeLock` in `finally` blocks to prevent runaway battery drain.


* **Testing Gate:** Unit test wake sequence execution logic and verify `WakeLock` acquisition/release invariants.

#### Task 8.2: Thermal & Battery Health Monitor

* **Subtasks:**
* Register BroadcastReceiver for `Intent.ACTION_BATTERY_CHANGED`.
* Extract `BatteryManager.EXTRA_TEMPERATURE` and `BatteryManager.EXTRA_LEVEL`.
* If battery temperature exceeds $42^\circ\text{C}$:
* Reject incoming jobs with `ERR_THERMAL_LIMIT`.
* Broadcast warning to orchestrator.




* **Testing Gate:** Unit test battery broadcast handling with simulated temperature threshold values.

#### Task 8.3: Periodic Node Health Heartbeat Worker

* **Subtasks:**
* Implement a WorkManager `PeriodicWorkRequest` running every 15 minutes.
* Check:
1. Shizuku binder connectivity (`Shizuku.pingBinder()`).
2. Battery temperature & charge level.
3. Target package availability.


* Dispatch heartbeat payload to `/api/v1/telemetry/heartbeat`.


* **Testing Gate:** Unit test heartbeat worker with mock network and binder states.

---

## 4. Test Strategy & Quality Gate Enforcement

```
+-------------------------------------------------------------+
|              PULL REQUEST / CI BUILD PIPELINE               |
+------------------------------+------------------------------+
                               |
            1. Static Analysis & Lint Enforcement
            - Detekt / ktlint (Zero warnings allowed)
            - Go vet / golangci-lint
                               |
            2. Unit Test Suite Execution
            - Domain logic & State machines
            - Ed25519 Cryptographic verification
            - Coordinate math & parsing engines
                               |
            3. Branch & Line Coverage Evaluation
            - JaCoCo & Go test coverage >= 95.0%
            - Coverage regression fails build
                               |
            4. Integration & Contract Tests
            - Shizuku mock IPC integration
            - PostgreSQL & Redis testcontainers
            - Cross-platform payload signing verification
                               |
            5. E2E Sandbox Simulation
            - Headless Android Emulator execution
            - Simulated FCM dispatch -> Execute -> Cleanup
                               |
+------------------------------v------------------------------+
|                PRODUCTION DEPLOYMENT ARTIFACT               |
+-------------------------------------------------------------+

```

### 4.1 Test Cases Matrix

| Test ID | Component | Test Scenario | Input Data | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| `TC-SEC-01` | Security | Tampered Signature | Payload with modified comment string but original sig. | Verification fails; job is dropped; security alert logged. |
| `TC-SEC-02` | Security | Replay Attack | Valid payload with timestamp from 120 seconds ago. | Time-drift check fails; job dropped. |
| `TC-IPC-01` | Shizuku IPC | Daemon Disconnection | Send job while Shizuku daemon process is killed. | App catches `BinderDeadException`, attempts background restart, logs retry error. |
| `TC-UI-01` | Action Engine | Bounding Box Calculation | Bounding box `[300,1000][700,1200]`. | Calculated center coordinates must equal $X = 500, Y = 1100$. |
| `TC-UI-02` | Action Engine | Idempotent Like Check | Deep link to an already-liked post. | Node attribute check reveals `selected=true`; tap action skipped; job marked successful. |
| `TC-UI-03` | Action Engine | Unicode Injection | Comment string containing spaces, special characters, and emojis: `Great post! 🚀 #Tech`. | Text pasted accurately via `ClipboardManager` + Keyevent 279 without string truncation. |
| `TC-PWR-01` | System OS | Deep Doze Wakeup | Dispatch FCM message after device has been idle for 2 hours in screen-off state. | High-priority FCM wakes CPU, acquires WakeLock, turns on screen, and completes execution within 10s. |

### 4.2 Coverage Assertions Table

| Module / Layer | Required Line Coverage | Required Branch Coverage | Primary Test Framework |
| --- | --- | --- | --- |
| `:core:crypto` | 100% | 100% | JUnit 5, MockK |
| `:core:domain` | 100% | 98% | JUnit 5, AssertJ |
| `:feature:perception` | 95% | 95% | JUnit 5, Robolectric |
| `:feature:execution` | 95% | 92% | MockK, Robolectric |
| `:data:ipc` | 95% | 90% | MockK, Shizuku Test Harness |
| `Orchestrator Backend` | 95% | 95% | Go `testing`, `testify`, `dockertest` |

---

## 5. Execution Instructions for Autonomous Coding Agents

When implementing this codebase, follow these rules:

1. **Strict Separation of Concerns:** Under no circumstances should UIAutomator, Shizuku, or Android SDK classes leak into `:core:domain`. All external framework components must be inverted behind clean interfaces.
2. **Zero Hardcoding Policy:** Never hardcode text labels, resource strings, timeouts, or URLs. Everything must be passed via `EngineConfig`, dependency injection parameters, or cryptographically signed payload overrides.
3. **Fail-Closed Security:** If signature verification fails, if time drift exceeds threshold, or if payload canonicalization is malformed, terminate execution immediately without executing secondary actions.
4. **Idempotency:** Every operation must be idempotent. Verify state (e.g., whether a post is already liked or a comment already submitted) before dispatching tap events.
5. **Deterministic Testing:** All tests must be 100% deterministic. Never use `Thread.sleep()` in test suites; use Coroutine virtual time dispatchers (`StandardTestDispatcher`, `runTest`) and mock time providers.

Proceed to generate and scaffold each module starting with **Epic 1 (Task 1.1)**, enforcing all architectural patterns and testing gates at every step.