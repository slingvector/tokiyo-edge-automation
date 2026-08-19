# Implementation Plan: LinkedIn Post Generation & FCM Transport

Based on your request, we are introducing two major architectural changes: generating LinkedIn posts autonomously, and migrating the primary transport layer from WebSockets to Firebase Cloud Messaging (FCM) to ensure reliable background execution on edge devices.

## User Review Required

> [!WARNING]
> **Firebase Setup Required:** Integrating FCM requires a Firebase Project. We will need the `google-services.json` file for the Android app and a Service Account JSON for the Node.js Orchestrator. 
> 
> *Have you already created a Firebase project for Tokiyo Edge Automation?*

## Open Questions

1. **FCM vs WebSockets:** Are we entirely replacing WebSockets with FCM for dispatching payloads, or will FCM be used as a fallback mechanism to wake up the app when the WebSocket connection drops?
2. **Post Content Source:** For testing the simple text-based post, where will the content come from? Should I build the test script to read post texts from a new Excel sheet, or just use hardcoded strings for now?

---

## Proposed Changes

### 1. FCM Transport Architecture

#### [MODIFY] `cloud-orchestrator/package.json`
- Install `firebase-admin` dependency.

#### [NEW] `cloud-orchestrator/src/fcm/FirebaseAdmin.ts`
- Initialize the Firebase Admin SDK using a service account key.

#### [MODIFY] `cloud-orchestrator/src/queue/Dispatcher.ts`
- Update the job dispatcher to send a `High-Priority Data Message` via FCM containing the cryptographically signed `JobPayload`. 

#### [MODIFY] `shizuku-spike-sandbox/app/build.gradle.kts`
- Add Firebase BoM and `firebase-messaging` dependencies.

#### [NEW] `shizuku-spike-sandbox/app/src/main/java/.../fcm/EdgeFirebaseMessagingService.kt`
- Create a service that extends `FirebaseMessagingService`.
- **Background Execution:** When a data message is received, it will extract the payload, verify the RSA signature via the `SecurityEngine`, acquire a `WakeLock` / turn on the screen (if needed), and dispatch the action to Shizuku natively.

#### [MODIFY] `cloud-orchestrator/prisma/schema.prisma`
- Add an `fcmToken` string column to the `Node` model so the Orchestrator knows where to route jobs.

### 2. LinkedIn Post Generator Feature

#### [NEW] `cloud-orchestrator/test_linkedin_poster.js`
- Create a new testing script dedicated to creating posts.
- **Smart Goal Prompt:** `Navigate to the Home feed, click the 'Start a post' button, type the following text: '{payload_text}', and click 'Post'.`
- For Phase 1, we will only supply simple text payloads. 
- The script will utilize the newly built telemetry polling endpoint to report success metrics for post creation.

## Verification Plan

### Automated Tests
- N/A (End-to-end requires a real Firebase environment).

### Manual Verification
- Provide the orchestrator with Firebase Admin credentials.
- Add `google-services.json` to the Android app and build the APK.
- Kill the Android app completely (swipe away from recents).
- Run `test_linkedin_poster.js`.
- **Expected Result:** The device screen wakes up automatically, Shizuku executes the UI commands, and a new text post is successfully published to LinkedIn, confirming the FCM background execution pathway works flawlessly.
