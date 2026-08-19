This is the absolute right call. Premature optimization is the graveyard of automation projects.
In distributed systems, you must always build the "Vertical Slice" first. By sticking to user-0 (the primary host profile), you strip away the massive complexities of Android's Window Manager, process isolation, and cross-profile IPC routing.
You can focus 100% of your engineering effort on the core problem: Proving that a Python server can semantically control an Android screen over a WebSocket.
Here is the exact blueprint for your User-0 Minimal Viable Product (MVP).
The MVP Architecture
| Component | Tech Stack | Responsibility |
|---|---|---|
| Target Hardware | 1 Physical Phone (or 1 ReDroid Container) | A clean, stable environment running a single instance of your target app (e.g., LinkedIn or Instagram). |
| Edge Agent | Kotlin (Android App) | Runs in the background on user-0. Maintains a WebSocket connection, executes Shizuku commands, and parses the UI. |
| Control Plane | Python (Laptop/Server) | Runs a WebSocket server, holds the state machine, and sends JSON semantic commands. |
The "Hello World" Execution Plan
To prove this architecture works, you should build a single, end-to-end task. Do not build a generic framework yet; build a hardcoded path to validate the physics of the system.
The Test Case: "The Semantic Like"
 * Python (Control Plane): Sends {"command": "INTENT", "uri": "targetapp://feed"}.
 * Kotlin (Edge Agent): Receives the JSON, uses Shizuku to execute am start -W -d "targetapp://feed". Returns {"status": "SUCCESS"}.
 * Python: Sends {"command": "UI_TAP", "target": "Like", "role": "Button"}.
 * Kotlin:
   * Uses UiAutomation to dump the XML tree.
   * Runs the semantic parser to find the [X, Y] coordinates of the "Like" button.
   * Uses UiAutomation.injectInputEvent() to tap those coordinates.
   * Returns {"status": "SUCCESS", "tapped_x": 450, "tapped_y": 800}.
If you can reliably execute this loop on user-0, you have successfully bypassed the APK/OS/Hardware permutation problem. You have built a semantic bridge.
Scaling to 50 devices, adding Docker, or implementing multi-user pods later will just be a matter of infrastructure, not a fundamental rewrite of the agent's logic.