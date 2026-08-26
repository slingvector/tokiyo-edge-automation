# LinkedIn Post Engagement

You want to give the Agent the ability to autonomously react and comment on specific LinkedIn posts (like `https://lnkd.in/p/gcJ7SWm9`).

To achieve this, we need to add a new `engagePost` capability to the `LinkedInEngager` and update the Cloud Orchestrator to support a `post` job type.

## Proposed Changes

### [MODIFY] `src/services/LinkedInEngager.ts`
Add a new method `engagePost(url: string, comment: string)` which will execute the following UIAutomator sequence on the phone:
1. **Deep Link**: Open the post URL via `android.intent.action.VIEW`. Chrome will automatically bounce the intent into the LinkedIn app.
2. **React**: Parse the UI dump to find the "React" button (which LinkedIn uniquely labels as `Reaction button state: no reaction`) and tap it.
3. **Comment**: Parse the UI dump to find the "Comment" button, tap it, wait for the comment input box to appear, inject the text, and tap "Post".

### [MODIFY] `src/queue/LinkedInQueue.ts`
Update the BullMQ worker to handle `type: 'post'`:
```typescript
if (type === 'post') {
  await engager.engagePost(target_id, message); // target_id will be the URL
}
```

### [MODIFY] `src/api/Server.ts`
No changes are strictly needed here, as the endpoint already accepts `{ node_id, type, target_id, message }`. You'll just pass `"type": "post"` and `"target_id": "https://lnkd.in/p/gcJ7SWm9"`.

## Open Questions

> [!WARNING]
> UI Elements on LinkedIn change based on the post format (Articles vs Images vs Text). I'll use standard OCR bounds searching to find the Comment button to avoid tapping the persistent floating "Messages" bubble that sometimes covers the screen.

Do you approve this plan to add professional Post Engagement to the Orchestrator?
