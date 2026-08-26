# Phase 2 - Document 1: Edge Agent & Execution Prototypes

This document defines the fail-fast implementation plan for the Android Edge Agent (Kotlin/Shizuku). It focuses on breaking down the monolithic agent into isolated Proof-of-Concepts (POCs) to validate the riskiest components first.

## 1. Prototype 1: The Shizuku IPC Handshake (Fail-Fast Spike)
**Goal:** Prove reliable, cross-process communication bypassing standard Android restrictions.
- **Action:** Build a headless Android app (User-0 only). Implement `Shizuku.addBinderReceivedListener`.
- **Implementation:** 
  - Do not use `newProcess` (shell execution). It is too slow and brittle.
  - Implement an **AIDL Contract** (`IAgentUserService.aidl`).
  - Escalate privileges by calling `Shizuku.bindUserService()`.
  - Validate by retrieving Linux UID (must return `2000` / shell).
- **Failure Condition:** If the binder drops or `PhantomProcessKiller` terminates the background service, the test fails. (Needs Doze Mode exemption).

## 2. Prototype 2: The Semantic Parser (Eyes of the Agent)
**Goal:** Extract and map the UI safely without exhausting Binder memory (1MB limit).
- **Action:** Acquire `UiAutomation` via the elevated UserService.
- **Implementation:**
  - Call `uiAutomation.rootInActiveWindow`.
  - Recursively parse `AccessibilityNodeInfo` into lightweight `SemanticNode` data classes.
  - **CRITICAL:** Aggressively call `.recycle()` on every node immediately to prevent memory leaks and crashes.
- **Testing:** Dump the LinkedIn/Instagram UI tree and ensure coordinates and attributes are extracted accurately.

## 3. Prototype 3: Organic Touch Injection (Anti-Bot Execution)
**Goal:** Execute physical clicks that mimic human thumbs.
- **Action:** Inject `MotionEvent` directly via `UiAutomation.injectInputEvent()`.
- **Implementation:**
  - Use the bounds found by the Semantic Parser.
  - **Humanizer:** Apply Gaussian blur to the target bounds so the tap lands organically, not in the dead-center.
  - **Duration:** Inject an `ACTION_DOWN`, wait a randomized duration (40ms-90ms), then `ACTION_UP`.
  - **Bezier Swipes:** For dating apps and infinite scrolls, implement curved trajectories using multiple `ACTION_MOVE` steps.

## 4. Prototype 4: The WebSocket Edge Client
**Goal:** Dial out to the Control Plane to receive instructions, bypassing NAT/DHCP issues.
- **Action:** Integrate Ktor WebSocket Client (`ktor-client-cio`).
- **Implementation:**
  - Agent initiates the connection: `ws://control-plane.local/agent/connect`.
  - Establishes a persistent bidirectional stream.
  - Emits telemetry and state changes (`UNKNOWN` -> `READY` -> `BUSY`).

## Execution Path
We will build these incrementally in the `:feature:execution` and `:feature:perception` modules. Do not move to Document 2 until Prototype 1 and 2 succeed flawlessly on a physical device.
