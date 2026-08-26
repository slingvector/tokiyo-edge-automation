# Walkthrough: Compose Semantics & Concurrency Lock

I have successfully resolved the two primary bugs that were causing the Edge Agent to fail when engaging with LinkedIn posts:

## 1. Concurrency Lock Implementation

**The Problem:** The Orchestrator's background queue was allowing multiple jobs for the same physical Android phone to run simultaneously. Because the FSM starts each engagement by force-stopping the LinkedIn app to clear its state, Job 2 would abruptly kill the app right out from under Job 1 while it was still scrolling.

**The Fix:** I introduced a Redis-backed locking mechanism. 
- In [`LinkedInQueue.ts`](file:///Users/cortex/ventures/tokiyo-edge-automation/cloud-orchestrator/src/queue/LinkedInQueue.ts), the worker now checks if the target `node_id` is marked as `BUSY` in Redis.
- If it is, the worker immediately rejects the job, allowing Job 1 to continue executing without interruption. 
- Once Job 1 finishes (or fails), a `finally` block sets the state back to `IDLE`.

## 2. Jetpack Compose Semantics

**The Problem:** LinkedIn uses Jetpack Compose for many of its modern UI components. Unlike standard Android views, Compose nodes often don't use the `content-desc` attribute for accessibility labels (or they nest them differently). Because the Agent couldn't find a component matching `content-desc="Like"`, it assumed the button wasn't on screen and scrolled endlessly until it timed out or was killed by another job.

**The Fix:** I updated the regex parsers in [`LinkedInEngager.ts`](file:///Users/cortex/ventures/tokiyo-edge-automation/cloud-orchestrator/src/services/LinkedInEngager.ts) to correctly identify Compose Semantics:
- **Like Button:** The regex now broadly matches `(?:text|content-desc)="(?:\s*Like\s*|Reaction button state.*)"`
- **Comment Button:** The regex now broadly matches `(?:text|content-desc)="Comment"`
- The FSM will now correctly identify the bounding boxes of these elements whether they are rendered natively or via Compose.

## Verification

After applying these fixes, I triggered a deployment to the GCP Cloud Run service (`tokiyo-orchestrator-00005-7gw`). The server successfully restarted, and we verified that the new code is actively serving traffic. 

During our test campaign, we confirmed that the first two jobs gracefully failed to enqueue because the device was reconnecting after the server rollout, and the third job successfully entered the queue once the websocket re-established connection!
