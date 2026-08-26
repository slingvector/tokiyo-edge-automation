# Phase 2: The Control Plane & Finite State Machine

## Goal
Now that the Edge Agent is capable of sub-millisecond native `UiAutomation` over IPC, we must implement the "Brain" of the system: the **Finite State Machine (FSM)**. 

Currently, the `test_scenario.js` script dispatches actions (`swipe`, `tap`) in a linear, blind "fire-and-forget" sequence. To achieve true autonomy, we need an intelligent closed-loop system: **ACTION -> OBSERVE -> VERIFY**.

## Open Questions

> [!WARNING]
> The original Phase 2 documentation proposed building the Control Plane in Python. However, we have already successfully integrated and deployed a robust Node.js Orchestrator (with BullMQ, Redis, and WebSockets). 
> 
> **Decision Required:** Should we implement the Finite State Machine (FSM) natively within our existing Node.js orchestrator, or spin up a new Python microservice specifically for Orchestration logic? 
> *(Recommended: Stay in Node.js to leverage the existing WebSocket infrastructure, BullMQ queues, and avoid architectural fragmentation. Modern LLM logic can easily run in TS).*

## Proposed Changes

### 1. FSM Engine (`cloud-orchestrator/src/fsm/`)
- Implement a robust State Machine loop (using `xstate` or custom async generators).
- **Transitions:** `IDLE` -> `OBSERVING` (requesting screen dump) -> `EVALUATING` (parsing UI) -> `EXECUTING` (injecting touch) -> `VERIFYING` (dumping screen again to verify UI mutation).

### 2. Semantic Verification
- When instructing the Agent to "Tap Follow", the FSM will not just blindly inject coordinates and assume success.
- It will wait for the next UI dump telemetry from the Edge Agent to semantically confirm that the UI node transitioned from "Follow" to "Following".

### 3. Fallback Heuristics (Popup Rescue)
- If the FSM detects an unexpected UI state (e.g., an OS-level "Rate this App" modal, or "Turn on Notifications"), it will pause the primary workflow, push a `PopupRescue` sub-routine to the execution stack, dismiss the modal, and then seamlessly resume the primary workflow.

## Verification Plan
### End-to-End Resilience Test
- We will execute a robust Node.js workflow against the emulator.
- During execution, we will intentionally trigger an unexpected popup on the emulator screen.
- The FSM must detect the anomaly, rescue the state, and complete its original objective without failing.
