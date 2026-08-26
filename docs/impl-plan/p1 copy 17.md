# Phase 3 Implementation Plan: Scale & Performance

With the core bot evasion and media pipeline built, Phase 3 focuses on horizontally scaling the architecture and drastically improving FSM latency. We will move away from a hardcoded single-node setup to a dynamic fleet router, and we will aggressively prune the UI hierarchy to reduce LLM token usage and latency.

## User Review Required
> [!IMPORTANT]
> **Orchestration Logic**: Should we allow the Orchestrator's API (e.g. `POST /api/v1/agent/autonomous`) to accept a request with NO `node_id`, and have the Orchestrator automatically pick an available, idle Android device from the connected fleet? If so, I will implement an `IdleNodeRouter`. Do you approve this auto-routing logic?

> [!WARNING]
> **Aggressive UI Pruning**: If we prune all layout nodes (e.g., `LinearLayout`, `FrameLayout`) that have no `text`, `content-desc`, or `clickable=true`, we drastically reduce token cost. However, in rare cases, a non-clickable layout node might contain semantic structure. Are you okay with strictly dropping these invisible layout nodes to prioritize speed?

## Proposed Changes

---

### Pillar 1: Multi-Device Fleet Orchestration (Node.js)
Currently, `test_fsm.js` and the `Dispatcher.ts` heavily rely on the hardcoded node ID `ddf1aadb5f1c38f4`. We will introduce a dynamic registry.

#### [MODIFY] `cloud-orchestrator/src/api/Server.ts`
- **Fleet Registry**: Track not just `socketId`s, but also the agent's status (`IDLE`, `BUSY`, `OFFLINE`).
- Expose a `/api/v1/fleet/status` HTTP endpoint to list all connected devices and their availability.

#### [NEW] `cloud-orchestrator/src/queue/FleetRouter.ts`
- Implement a router module. When a job is submitted without a target `node_id`, this router will query the active WebSocket connections, find an `IDLE` device, assign the job to it, and mark it as `BUSY`.

#### [MODIFY] `cloud-orchestrator/src/ai/AutonomousAgent.ts`
- Update the agent constructor to ensure it cleanly releases the device back to `IDLE` in the Fleet Registry when a session concludes (SUCCESS, ERROR, or MAX_STEPS_REACHED).

---

### Pillar 2: In-Memory UI Pruning (Android / Kotlin)
While we successfully moved to native `UiAutomation` memory traversal in Phase 2, the resulting XML payload is still extremely large and contains deeply nested, useless structural layouts. We must prune this at the Edge to save bandwidth and LLM tokens.

#### [MODIFY] `shizuku-spike-sandbox/core/shizuku/src/main/java/com/tokiyo/core/shizuku/AgentUserService.kt`
- **Smart Pruning Algorithm**: Modify the `dumpNodeRec` recursive function. 
- If a node is a structural layout (e.g., `android.widget.FrameLayout`, `android.view.View`) AND it does not have `text`, `content-desc`, `clickable=true`, `scrollable=true`, or `checkable=true`, AND it has no meaningful children, it will be excluded from the XML tree entirely.
- This will compress the UI XML payload by up to 60%, drastically reducing the LLM's context window load and decreasing Time-To-First-Token (TTFT).

## Verification Plan

### Automated Tests
- Create `test_fleet.js`: Connect multiple mock socket connections mimicking Android devices. Submit a batch of 5 jobs with no `node_id` and verify that the `FleetRouter` evenly distributes them across the mock devices without double-booking a `BUSY` node.

### Manual Verification
- Execute `dumpWindowHierarchy` on a deeply nested app (e.g., Instagram or Settings) and compare the token size of the XML output before and after the pruning algorithm is applied. Verify the token count is reduced while all actionable buttons and text remain intact.
