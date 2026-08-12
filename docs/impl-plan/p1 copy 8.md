# Phase 5: Autonomous Multi-Step Agent Loop

Building on the Dynamic Perception Engine from Phase 4, we will now implement a persistent, multi-step autonomous loop in the Cloud Orchestrator. This will allow the Orchestrator to take a complex goal (e.g., "Find Anuj's profile and send him a connection request"), iteratively perceive the screen, decide on the next action (click, swipe, type, or finish), execute it, and repeat until the goal is achieved.

## User Review Required

> [!IMPORTANT]
> **Agentic Framework vs Custom Loop:**
> I propose building a lightweight, custom ReAct (Reasoning and Acting) `while` loop within our existing Node.js Orchestrator using the `@google/genai` SDK rather than bringing in heavy third-party agent frameworks (like LangChain). This gives us maximum control over the strict JSON schemas required for Android coordinate mapping. Do you agree with this custom approach?

> [!WARNING]
> **Execution Context:**
> Since these autonomous tasks can take several minutes (e.g., waiting for UI dumps, LLM inference, and physical execution), I propose offloading the loop to a new **BullMQ Queue (`agentQueue`)** rather than blocking an HTTP response. The API will return a `session_id` that you can poll or subscribe to via WebSockets.

## Proposed Changes

### `cloud-orchestrator`

#### [NEW] `src/ai/AutonomousAgent.ts`
- Implement the core ReAct loop:
  - `startSession(goal, nodeId)`
  - Loop condition: `while(stepCount < MAX_STEPS && !isFinished)`
  - **Perceive:** Dispatch `dump_ui` and wait for telemetry.
  - **Reason:** Send the `goal`, `action_history`, `xmlDump`, and `screenshot` to Gemini. Gemini returns a JSON object specifying the next action (`click`, `swipe`, `type`, `done`), the exact coordinates, and the reasoning.
  - **Act:** Dispatch the physical command (e.g., `shell input tap`) to the Edge Node.
  - **Record:** Append the action to `action_history` so the LLM knows what it just did in the next iteration.

#### [NEW] `src/queue/AgentQueue.ts`
- Create a dedicated BullMQ worker for `autonomous-jobs`.
- When a job is picked up, it instantiates `AutonomousAgent` and runs `startSession()`.

#### [MODIFY] `src/api/Server.ts`
- Add `POST /api/v1/agent/autonomous`:
  - Enqueues a job into `AgentQueue`.
  - Returns `{"status": "STARTED", "session_id": "..."}`.
- Emit WebSocket events on the `session_id` channel so a frontend can watch the agent's progress in real-time.

#### [MODIFY] `src/ai/PerceptionEngine.ts`
- Upgrade the system prompt to support `history` context.
- Expand the JSON schema to allow multiple action types: `click`, `swipe`, `type`, and `done`.

## Verification Plan

### Manual Verification
1. Call the new endpoint: `POST /api/v1/agent/autonomous` with the goal: `"Scroll down the feed once, then click the Home tab"`.
2. Monitor the Orchestrator logs to verify the loop executes:
   - Dump 1 -> LLM decides to Swipe -> Execute Swipe.
   - Dump 2 -> LLM decides to Click Home -> Execute Click.
   - Dump 3 -> LLM decides it is `done` -> Loop exits successfully.
