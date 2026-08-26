# Fix Job Queue Concurrency & Compose Semantics

The Edge Agent is failing its LinkedIn Campaign due to two overlapping issues:
1. **Concurrency Race Condition:** The campaign script staggers jobs by 60 seconds. However, if a job takes longer than 60 seconds (due to scrolling and waiting), the second job begins execution on a background thread. When Job 2 starts, it executes a clean-state command (`forceStopApp`), which abruptly kills the LinkedIn app right out from under Job 1.
2. **Jetpack Compose Semantics:** Job 1 is taking longer than 60 seconds because it is endlessly scrolling, unable to find the "Like" button. This is because the latest version of LinkedIn uses Jetpack Compose, which structures accessibility nodes differently (often using `text` instead of `content-desc`, or nesting descriptions differently).

## User Review Required

I will implement a robust locking mechanism in Redis and update the Regex to be more permissive of Jetpack Compose UI trees. Please review the plan below.

## Proposed Changes

### Queue Logic

#### [MODIFY] src/queue/LinkedInQueue.ts
- We will add a Redis-backed locking mechanism using the existing `nodeStatus` hash.
- Before executing a job, the worker will check if `nodeStatus` for that `node_id` is `BUSY`. 
- If `BUSY`, we will throw a soft `Error("Device is currently busy")`.
- We will configure the BullMQ worker to automatically retry failed jobs with an exponential or fixed backoff (e.g., wait 30 seconds and try again) so that Job 2 waits gracefully for Job 1 to finish instead of force-closing it.

### Compose Semantics

#### [MODIFY] src/services/LinkedInEngager.ts
- We will expand the regex for the "Like" button to cover Compose Semantics.
  - Currently: `/content-desc="Reaction button state: no reaction"[^>]*bounds="(\[\d+,\d+\]\[\d+,\d+\])"/`
  - New Compose Fallback: `/(?:text|content-desc)="(?:\s*Like\s*|Reaction button state.*)"[^>]*bounds="(\[\d+,\d+\]\[\d+,\d+\])"/i`
- We will expand the regex for the "Comment" button similarly.
  - New Compose Fallback: `/(?:text|content-desc)="Comment"[^>]*bounds="(\[\d+,\d+\]\[\d+,\d+\])"/i`
- This ensures that whether LinkedIn renders a component as a standard XML View (using `content-desc`) or a Compose node (sometimes exposing as `text`), the FSM will find it.

## Verification Plan

### Automated Tests
- I will run the deployment script `deploy.sh` to push these code changes to the GCP Cloud Run container.

### Manual Verification
- After deployment, you will re-run `./schedule_campaign.sh`. We will verify that Job 1 completes fully without being interrupted by Job 2, and that the agent successfully taps the Like and Comment buttons.
