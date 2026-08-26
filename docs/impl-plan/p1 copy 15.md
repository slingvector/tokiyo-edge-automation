# Feature Implementation Plan: Popup Rescue Heuristics

The FSM currently operates in a single linear loop. If an unexpected modal or OS popup appears (e.g., "Rate this app", "Location Permission"), the AI might try to blindly continue its original goal or get confused. We need a structured way to pause the main goal, dismiss the popup, and resume.

## User Review Required
> [!IMPORTANT]  
> I propose using a **Recursive Sub-Agent** architecture for this feature instead of a rigid hardcoded execution stack. 
> 
> **How it works:**
> 1. The `PerceptionEngine` prompt will be updated so the AI can return `"action": "rescue"` if it detects that the UI is blocked by an unrelated popup.
> 2. When the `AutonomousAgent` receives a `"rescue"` action, it will pause its current loop and spawn a **new, temporary `AutonomousAgent`** with the explicit goal: *"Dismiss any visible popups, dialogs, or modals."*
> 3. Once the sub-agent completes its goal and returns `SUCCESS`, the primary agent resumes its original task.
>
> This approach is extremely elegant because we can reuse our existing robust FSM logic without writing custom state-stack management code!

## Proposed Changes

### `cloud-orchestrator/src/ai/PerceptionEngine.ts`
#### [MODIFY] `PerceptionEngine.ts`
- Update the `systemPrompt` to add `"rescue"` to the allowed actions.
- Instruct the AI: *"If an unexpected popup, modal, or permission dialog is blocking the screen and preventing you from achieving the goal, return action 'rescue'."*

### `cloud-orchestrator/src/ai/AutonomousAgent.ts`
#### [MODIFY] `AutonomousAgent.ts`
- Add a new block in the `Act` phase to handle `target.action === 'rescue'`.
- When triggered, instantiate `const rescueAgent = new AutonomousAgent(this.nodeId, "Dismiss any visible popups, alerts, or modals", 3);`.
- `await rescueAgent.run()`.
- If successful, log the rescue and `continue;` the main loop. If it fails, abort the main loop.

## Verification Plan
### Automated Tests
- I will modify `test_fsm.js` to dispatch a shell command that intentionally triggers an Android popup (e.g., `am start -a android.settings.SETTINGS`) before the agent starts, or use a mock scenario to ensure the `rescue` action correctly pushes the sub-agent.
- We will verify in the terminal that a nested session starts, completes, and returns control to the parent session.
