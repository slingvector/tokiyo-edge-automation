# Walkthrough: Compile & Dispatch Architecture

As requested, we implemented the "Compile & Dispatch" architectural foundation strictly following the rule: **"Testing and development remains as is. Write new code for production/edge-device execution."**

All existing Interactive FSM code remains completely untouched and functional for testing on the Master Simulator. We achieved the new architecture purely through new additive files and classes.

## What Was Completed

### 1. Android Edge (Shizuku-Spike)
We implemented a robust local script executor that runs directly on the device, eliminating WebSocket hops during task execution.
- **[NEW]** [`CompiledScriptExecutor.kt`](file:///Users/cortex/ventures/tokiyo-edge-automation/shizuku-spike-sandbox/core/shizuku/src/main/java/com/tokiyo/core/shizuku/CompiledScriptExecutor.kt): Uses Shizuku to write a bash script payload to `/data/local/tmp/` and execute it natively. Includes strict timeout monitoring (5 minutes) and execution duration telemetry.
- **[NEW]** [`CompiledScriptDispatcher.kt`](file:///Users/cortex/ventures/tokiyo-edge-automation/shizuku-spike-sandbox/core/domain/src/main/java/com/tokiyo/core/domain/CompiledScriptDispatcher.kt): Handles cryptographic verification and telemetry for the new compiled script payloads.
- **[MODIFY]** [`AgentBridgeService.kt`](file:///Users/cortex/ventures/tokiyo-edge-automation/shizuku-spike-sandbox/app/src/main/java/com/tokiyo/shizukuspike/service/AgentBridgeService.kt): Appended a new `socket.on("dispatch_compiled_script")` listener. The existing `dispatch_job` listener is untouched.

### 2. Cloud Orchestrator (Backend)
We built the compiler scaffolding, anti-bot delays, and structured logging per `BACKEND-STANDARDS`.
- **[NEW]** [`Logger.ts`](file:///Users/cortex/ventures/tokiyo-edge-automation/cloud-orchestrator/src/utils/Logger.ts): A JSON-structured logger for observability.
- **[NEW]** [`JitterEngine.ts`](file:///Users/cortex/ventures/tokiyo-edge-automation/cloud-orchestrator/src/utils/JitterEngine.ts): Ported from `founders-product`. It uses Box-Muller Gaussian mathematics to calculate organic, random execution delays for large batches.
- **[NEW]** [`ScriptCompilerService.ts`](file:///Users/cortex/ventures/tokiyo-edge-automation/cloud-orchestrator/src/services/ScriptCompilerService.ts): The service responsible for caching the compiled bash scripts in Redis and injecting variables (like dynamic AI comments).
- **[NEW]** [`CompiledScriptDispatcher.ts`](file:///Users/cortex/ventures/tokiyo-edge-automation/cloud-orchestrator/src/queue/CompiledScriptDispatcher.ts): A new BullMQ worker that intercepts compiled jobs, applies the `JitterEngine` delay, and broadcasts the single script payload to the edge device.

## Architectural Validation

> [!TIP]
> **Zero Network Hops:** By sending the entire script payload via `dispatch_compiled_script`, the Edge device executes the FSM entirely offline. It only connects to the cloud at the start (to receive the script) and at the end (to send the `telemetry_report` with success/fail status).

> [!NOTE]
> **Safe Testing Framework:** The Master Simulator can continue using `dispatch_job` and the old `InstagramEngager.ts` to test UI intents safely without affecting this new high-speed production pipeline.

## Next Steps
The core pipeline is built. The next logical step would be to **write a script that actually uses the Master Simulator to generate one of these relative-coordinate bash scripts** (e.g., an Instagram Like & Comment script), pass it through `ScriptCompilerService.ts`, and test it on a physical device.
