# Move LinkedIn Engager to the Cloud

Currently, your `LinkedInEngager` test (`test_messaging.ts`) spins up its own local server to execute the messaging workflow. Since the Orchestrator is now live on the internet, we need to move the LinkedIn execution logic into the cloud so you can trigger it remotely from anywhere.

## Proposed Changes

We will introduce a new background worker queue in the Orchestrator dedicated to executing complex app automation workflows (like LinkedIn messaging) without timing out the HTTP requests.

### [NEW] `src/queue/LinkedInQueue.ts`
- Creates a new BullMQ Queue and Worker (`linkedin-jobs`).
- When a job is picked up, it initializes the `RemoteShizukuController` and `LinkedInEngager` server-side.
- Executes either the `sendDirectMessage` (thread) or `messageProfile` (profile) workflow.

### [MODIFY] `src/api/Server.ts`
- Expose a new REST endpoint: `POST /api/v1/engage/linkedin`.
- Accepts `{ node_id, type, target_id, message }`.
- Enqueues the job into `linkedinQueue` and immediately returns the `job_id` so the request doesn't timeout while the phone is slowly navigating the UI.

### [MODIFY] `src/index.ts`
- Register the new `LinkedInQueue` worker so it boots up alongside the other workers when Render starts the container.

## Verification Plan

1. Commit and push the code to GitHub.
2. Wait for Render to automatically redeploy and go green.
3. Execute a `curl` command from your Mac Mini pointing to the live Render endpoint to command your phone to send a LinkedIn message entirely over the cloud.

> [!IMPORTANT]
> Once this is complete, your edge architecture is fully realized: Cloud API ➔ BullMQ Worker ➔ Remote WebSocket ➔ Android Service ➔ Shizuku ➔ UIAutomator.

Let me know if you approve this plan to move the Engager to the cloud!
