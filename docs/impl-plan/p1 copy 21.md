# Phase 4 Implementation Plan: Node.js Orchestrator Integration

This plan outlines the integration of our validated ADB macros and UI findings into the `cloud-orchestrator` Node.js service. The goal is to move away from brittle, hard-coded bash scripts and replace them with robust, dynamic, OCR-backed TypeScript classes.

## Proposed Changes

We will introduce a dedicated service class in the Cloud Orchestrator to handle the LinkedIn publishing flow.

### `cloud-orchestrator/src/services`

#### [NEW] `LinkedInPublisher.ts`
This new service class will encapsulate the entire deterministic publishing macro. 
It will orchestrate the following steps:
1. **State Cleansing:** Execute an ADB `force-stop` on `com.linkedin.android` to ensure the Deep Link intent is not swallowed by an existing `MainActivity`.
2. **Media Injection:** Push the target media to `/sdcard/Pictures/` and immediately broadcast `android.intent.action.MEDIA_SCANNER_SCAN_FILE`.
3. **Teleportation:** Send the `android.intent.action.VIEW` intent with the `https://www.linkedin.com/shareArticle` Deep Link to bypass standard feed navigation.
4. **Dynamic UI Interaction (The OCR Fallback Strategy):** Instead of using hard-coded coordinates (which broke on the Android 13 photo picker), we will use the `ApkAnalyzerClient` to request OCR bounding boxes:
   - Request OCR for `"Add (1)"` and tap its bounding box (bypassing the new photo picker).
   - Request OCR for `"Share your thoughts"` to focus the text editor.
   - Use `adb shell input text` (or Accessibility keys) to inject the post payload.
   - Request OCR for `"Post"` and tap it to finalize.

#### [MODIFY] `ApkAnalyzerClient.ts`
- Add a new helper method `getOcrCoordinates(imageBase64: string, targetText: string)` that proxies the `/unmerge` or a new `/ocr` endpoint on our Python analyzer.

### `cloud-orchestrator/src/api` or `index.ts`

#### [MODIFY] API Route/Endpoint
- Create or update an API endpoint (e.g., `/api/v1/jobs` or a dedicated test route) to trigger `LinkedInPublisher.publish(...)` so we can run our end-to-end test via Node.js instead of `post_test.sh`.

## User Review Required

> [!WARNING]
> Moving to Node.js means the `cloud-orchestrator` needs direct access to ADB to push media and trigger broadcasts. 
> Does the orchestrator currently have an `AdbClient` or helper function available in `src/utils/` to execute shell commands, or should I use the standard Node.js `child_process.exec`?

> [!TIP]
> Our bash script used `adb shell screencap -p`. For the Node.js implementation, we will need to capture the screen, convert it to Base64, and send it to `ApkAnalyzerClient`. I will implement a quick `captureScreenBase64()` utility function.

## Verification Plan

### Automated Tests
- We will execute the existing `test_linkedin_poster.js` (modified to trigger the deterministic macro instead of the LLM autonomous agent) to ensure it correctly drives the emulator end-to-end.

### Manual Verification
- We will review the emulator screen live as Node.js takes control, verifying that it correctly taps the "Add (1)" button using dynamic OCR bounding boxes.
