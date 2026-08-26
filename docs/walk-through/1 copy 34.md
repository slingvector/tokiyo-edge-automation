# Cloud Execution for LinkedIn Engager

We have successfully migrated the `LinkedInEngager` workflow from your local test script directly into the Cloud Orchestrator, and **we just upgraded it to support Post Engagement!**

### What Changed?
- Created a dedicated `LinkedInQueue` and worker in the cloud.
- Built a new API endpoint: `POST /api/v1/engage/linkedin`.
- Added the `engagePost` state to the FSM. This gives the Orchestrator the ability to:
  - Deep link directly to a specific LinkedIn post (even using shortened `lnkd.in` URLs).
  - Use Computer Vision (OCR/XML Parsing) to find the "Like" button and tap it.
  - Find the "Comment" button, wait for the keyboard, type a fully customized professional comment, and hit "Post".
- Pushed the changes to GitHub, triggering a fresh Render deployment.

### How it Works Now
When you hit the API, the Orchestrator immediately queues the job and replies with a `job_id`. Meanwhile, the background worker picks up the job, establishes the `RemoteShizukuController`, and begins beaming the sequence of UIAutomator commands (open post, like, comment) directly to your phone's Android Service over the persistent WebSocket.

### Testing the Cloud Workflow
Render is deploying this update right now. Once it goes green (give it ~2 minutes), you can trigger the full Post Engagement sequence from your Mac Mini to your phone over the cloud using this command:

```bash
curl -X POST https://tokiyo-orchestrator.onrender.com/api/v1/engage/linkedin \
  -H "Content-Type: application/json" \
  -d '{
    "node_id": "48e7f048198bb9d5",
    "type": "post",
    "target_id": "https://lnkd.in/p/gcJ7SWm9",
    "message": "Thanks for sharing this, Lara! This is an incredibly insightful approach to building visibility."
  }'
```
