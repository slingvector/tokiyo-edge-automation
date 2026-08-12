# Phase 5: Autonomous Multi-Step Agent Loop

The Cloud Orchestrator now features a fully autonomous, stateful ReAct (Reasoning and Acting) loop running on BullMQ. You can now pass complex goals to the Orchestrator and watch it iteratively problem-solve!

## What was built

1. **`AgentQueue` (BullMQ)**: We instantiated a new dedicated Queue and Worker (`autonomous-jobs`). This ensures that long-running agentic loops do not block HTTP requests. We configured the worker to allow up to 10 autonomous agents to run in parallel.
2. **`AutonomousAgent` Core Logic**: We built the `while` loop that handles the state machine. 
   - **Perceive:** It dispatches `dump_ui` and waits asynchronously using Node's `EventEmitter` for the `telemetry_report`.
   - **Reason:** It parses the base64 telemetry and passes it into Gemini via the Perception Engine, along with an ongoing `action_history` log so the LLM remembers its previous actions.
   - **Act:** It intercepts the LLM's chosen action (`click`, `swipe`, `type`, or `done`), formulates the correct shell/intent payload, and dispatches it back to the Edge Agent.
   - **Evaluate:** It loops until the AI replies with `"action": "done"` or hits the `max_steps` limit.
3. **`POST /api/v1/agent/autonomous` API**: Added a new non-blocking endpoint that accepts a `goal` and `max_steps`, queues the session, and returns a `session_id`.
4. **Enhanced System Prompt**: Upgraded the Perception Engine schema to support `start_x`/`start_y` and `text` for swiping and typing actions.

## Execution Note

> [!WARNING]
> While building this, the Android Emulator process crashed unexpectedly in the background. I have rebooted the emulator for you, but it will take a minute or two to start back up and reconnect to the Orchestrator!

## How to Test

Once the emulator is back online and Shizuku is running:

1. Look inside `test_autonomous.js`. It contains a mock request pointing to the new endpoint with the goal: `"Scroll down the feed once, then click the Home tab"`.
2. Run `node test_autonomous.js`
3. Watch the Orchestrator console! You will see the agent print out:
   - `[AutonomousAgent] Step 1/5`
   - `[AutonomousAgent] Decision: swipe. Reasoning: The goal requires scrolling down first...`
   - `[AutonomousAgent] Step 2/5`
   - `[AutonomousAgent] Decision: click. Reasoning: Now I see the Home tab...`
