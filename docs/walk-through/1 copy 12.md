
# Epic 4: Dynamic Perception Engine

The Dynamic Perception Engine (AI Interpretation Layer) has been successfully built into the Cloud Orchestrator! This bridges the gap between high-level semantic goals and low-level Edge Node execution.

## What was built

1. **AI Perception Engine (`src/ai/PerceptionEngine.ts`)**:
   - Integrated the `@google/genai` SDK.
   - Built an XML pruner that strips out non-essential attributes (`focusable`, `password`, `checked`, etc.) to heavily optimize token consumption when passing the DOM to the LLM.
   - Formulated a strict system prompt that instructs Gemini 2.5 Flash to act as the Android Edge Automation framework's eyes, analyze the `bounds` attributes, calculate center points, and return a structured JSON response containing the exact `x`, `y`, and `action` to execute.

2. **Orchestrator AI API (`POST /api/v1/agent/action`)**:
   - Added a fully autonomous workflow endpoint in `src/api/Server.ts`.
   - **How it works:**
     1. You send a natural language goal (e.g., `"Click on the Home tab icon"`).
     2. The Orchestrator automatically dispatches a `dump_ui` job to the Edge Node.
     3. The Orchestrator waits via an internal Event Emitter for the Edge Node to return the compressed base64 telemetry (Flight Recorder).
     4. The Orchestrator decompresses the XML/Screenshot, passes it to the AI Perception Engine, and extracts coordinates.
     5. Finally, the Orchestrator dispatches a physical `shell input tap` command back to the Edge Node to complete the goal.

3. **Test Script (`test_ai_action.js`)**:
   - Created a quick Node script in the orchestrator directory that you can run to test this loop. 

## Next Steps

Since you are successfully logged into the live LinkedIn feed, you can now run the autonomous flow!

> [!IMPORTANT]
> **Action Required**: The Google GenAI SDK requires an API key to function. 
> 1. Open `cloud-orchestrator/.env` and add: `GEMINI_API_KEY="your_api_key_here"`
> 2. Restart the orchestrator if it is running manually.
> 3. Run `node test_ai_action.js` to see the Edge Agent autonomously click the target element based purely on the LLM's visual and semantic interpretation!
