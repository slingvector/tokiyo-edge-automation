# Phase 2: Dynamic Perception & Execution Engine

I have thoroughly reviewed the Phase 2 research documentation and synthesized the massive platform architecture into three comprehensive implementation documents. These documents break down the architecture into fail-fast, executable Proof-of-Concepts (POCs):

#### [NEW] [phase-2-01-edge-agent.md](file:///Users/cortex/ventures/tokiyo-edge-automation/docs/impl-plan/phase-2-01-edge-agent.md)
Defines the core Android Kotlin worker. Focuses on Shizuku IPC, Semantic Node parsing, organic touch injection, and the Ktor WebSocket client.

#### [NEW] [phase-2-02-control-plane.md](file:///Users/cortex/ventures/tokiyo-edge-automation/docs/impl-plan/phase-2-02-control-plane.md)
Defines the Python Orchestrator. Focuses on the Finite State Machine (ACTION -> OBSERVE -> VERIFY), APK Static Analysis, and the Media injection pipeline.

#### [NEW] [phase-2-03-advanced-strategies.md](file:///Users/cortex/ventures/tokiyo-edge-automation/docs/impl-plan/phase-2-03-advanced-strategies.md)
Defines tactics for defeating modern UI frameworks (Jetpack Compose) and anti-bot systems, as well as hardware hardening for fleet scale.

> [!IMPORTANT]  
> To prevent premature optimization, we must stick strictly to the **Fail-Fast MVP Approach** (User-0, 1 physical device, hardcoded workflows).

## User Review Required
Please review the generated documents in the `docs/impl-plan` directory.
If you approve the architecture breakdown, we will immediately begin executing **Phase 2 - Prototype 1**: building the Shizuku IPC Handshake (the barebones Kotlin Agent) to validate the lowest-level dependency of the entire system.

## Proposed Changes
We will begin executing **Phase 2 - Prototype 2**: Native UiAutomation over IPC.

### Target: Edge Agent App
- **AIDL Update**: Add `String dumpWindowHierarchy()` and `boolean injectTouch(int x, int y)` to `IAgentUserService.aidl`.
- **Native Implementation**: In `AgentUserService.kt`, acquire `UiAutomation` via reflection/hidden APIs or Shizuku utilities. Implement the native methods.
- **Refactoring**: Update `UiAutomatorService.kt` to call the AIDL typed methods instead of translating actions into `uiautomator dump` and `input tap` string commands. Remove reliance on `ActionExecutor` for UI tasks.

## Verification Plan
### Manual Verification
- Compile and flash the APK to the emulator.
- Rerun the `test_scenario.js` script.
- Verify that the execution lag is completely eliminated, as we are no longer spawning shell processes to dump the screen or inject taps.
