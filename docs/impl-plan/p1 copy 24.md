# FSM Modular Refactor for Engagement Macros

This plan outlines the architectural change to convert the monolithic `engageWithFeed` function into granular, independent state machine tasks.

## User Review Required

> [!NOTE]
> This refactor will decouple the Like and Comment actions. Each action will be a completely isolated execution loop:
> 1. Close the app.
> 2. Open the app via Deep Link.
> 3. Perform a single event (e.g., Like).
> 4. End the state.

## Open Questions

None. This strictly follows your FSM logic pattern.

## Proposed Changes

### [MODIFY] [LinkedInEngager.ts](file:///Users/cortex/ventures/tokiyo-edge-automation/cloud-orchestrator/src/services/LinkedInEngager.ts)
- Replace `engageWithFeed` with two independent methods:
  - `likePost(postUrl: string)`
  - `commentOnPost(postUrl: string, commentText: string)`
- Each method will independently force-stop the LinkedIn app before execution to guarantee a pristine state.

### [MODIFY] [test_engager_concurrent.ts](file:///Users/cortex/ventures/tokiyo-edge-automation/cloud-orchestrator/test_engager_concurrent.ts)
- Update the test script to execute `likePost` concurrently across all 3 emulators.
- Upon completion of the Like phase, the script will then execute `commentOnPost` concurrently across all 3 emulators.

## Verification Plan
1. We will need a specific LinkedIn post URL to test this on. (I will use a placeholder in the script, and you can provide one via the CLI).
2. The orchestrator will print logs showing the app being forcefully restarted before the Like event, and again before the Comment event.
