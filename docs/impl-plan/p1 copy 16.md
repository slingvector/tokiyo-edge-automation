# Feature Implementation Plan: Popup Rescue Heuristics

The FSM currently operates in a single linear loop. If an unexpected modal or OS popup appears (e.g., "Rate this app", "Location Permission"), the AI might try to blindly continue its original goal or get confused. We need a structured way to pause the main goal, dismiss the popup, and resume.
# Implementation Plan: Organic Touch Injection & Media Relay

This plan completes the remaining Phase 2 requirements for the Tokiyo Edge Automation system. It focuses on bot-evasion via human-like UI interactions and robust media injection for social media workflows.

## User Review Required
> [!IMPORTANT]
> - **Media Relay Strategy:** Sending large videos (e.g., 50MB) over WebSocket as Base64 strings can cause memory bloat on both the Node.js and Android sides. We can either chunk the Base64 strings (1MB pieces) over WebSocket, OR we can have the Android app download the media file directly via HTTP from a URL provided by the orchestrator. I recommend the **HTTP Download Strategy** where the Orchestrator sends `{"command": "download_media", "url": "..."}` and the Android app fetches it. Do you approve this strategy?

## Proposed Changes

---

### Pillar 1: Organic Touch Injection & IME (Bot Evasion)
Current actions use the standard `input tap` and `input swipe` shell commands, which trace perfect robotic lines and lack Gaussian variance. We will migrate touch injection natively into the Shizuku Daemon for total control over raw `MotionEvent`s.

#### [MODIFY] `core/shizuku/src/main/aidl/com/tokiyo/core/shizuku/IAgentUserService.aidl`
- Add new methods:
  - `boolean injectOrganicTap(int x, int y);`
  - `boolean injectOrganicSwipe(int startX, int startY, int endX, int endY, int durationMs);`
  - `boolean injectOrganicText(String text);`

#### [MODIFY] `core/shizuku/src/main/java/com/tokiyo/core/shizuku/AgentUserService.kt`
- **Gaussian Taps:** Implement `injectOrganicTap` by adding a small randomized Gaussian offset to the target coordinates, then synthesizing `MotionEvent.ACTION_DOWN`, sleeping 40-80ms, and `MotionEvent.ACTION_UP`.
- **Bezier Swipes:** Implement `injectOrganicSwipe` using cubic-bezier curves for the `ACTION_MOVE` coordinates, simulating a natural thumb arc rather than a perfectly straight line.
- **Human IME:** Implement `injectOrganicText` by mapping string characters to Android `KeyEvent`s and injecting them with a randomized latency of 50-150ms between each stroke.
- Inject all events via reflection on `UiAutomation.injectInputEvent(event, true)`.

#### [MODIFY] `cloud-orchestrator/src/ai/AutonomousAgent.ts`
- Update the action executor to emit `organic_tap`, `organic_swipe`, and `organic_type` jobs over the WebSocket instead of raw `shell` commands.

---

### Pillar 2: Media Relay Pipeline
To post images/videos autonomously, the target app's gallery picker must "see" the file natively in the Android MediaStore. 

#### [NEW] `app/src/main/java/com/tokiyo/app/media/MediaRelayWorker.kt`
- Implement a worker that listens for `download_media` socket commands containing a `file_url`.
- Download the file directly to `/sdcard/DCIM/TokiyoRelay/` using Kotlin Coroutines and Ktor/OkHttp.
- Immediately trigger `MediaScannerConnection.scanFile()` on the downloaded file. This forces the Android OS to index it instantly, making it the most recent item in the system gallery picker.

#### [MODIFY] `cloud-orchestrator/src/queue/Dispatcher.ts`
- Add support for the `download_media` job type, passing the target CDN/HTTP URL to the edge agent.

## Verification Plan

### Automated Tests
- Run `node test_fsm.js` and verify that the AI successfully types text using the slow, organic IME mechanism instead of instant `adb` shell injection.

### Manual Verification
- Dispatch an `organic_swipe` and observe the physical emulator using "Pointer Location" in Android Developer Options. Verify that the swipe line is curved and velocity varies during the swipe.
- Dispatch a `download_media` job with a test image URL. Open the Android Gallery app and verify the image appears instantly without requiring a device reboot.
# Feature Implementation Plan: Popup Rescue Heuristics

The FSM currently operates in a single linear loop. If an unexpected modal or OS popup appears (e.g., "Rate this app", "Location Permission"), the AI might try to blindly continue its original goal or get confused. We need a structured way to pause the main goal, dismiss the popup, and resume.
# Implementation Plan: Organic Touch Injection & Media Relay

This plan completes the remaining Phase 2 requirements for the Tokiyo Edge Automation system. It focuses on bot-evasion via human-like UI interactions and robust media injection for social media workflows.

## User Review Required
> [!IMPORTANT]
> - **Media Relay Strategy:** Sending large videos (e.g., 50MB) over WebSocket as Base64 strings can cause memory bloat on both the Node.js and Android sides. We can either chunk the Base64 strings (1MB pieces) over WebSocket, OR we can have the Android app download the media file directly via HTTP from a URL provided by the orchestrator. I recommend the **HTTP Download Strategy** where the Orchestrator sends `{"command": "download_media", "url": "..."}` and the Android app fetches it. Do you approve this strategy?

## Proposed Changes

---

### Pillar 1: Organic Touch Injection & IME (Bot Evasion)
Current actions use the standard `input tap` and `input swipe` shell commands, which trace perfect robotic lines and lack Gaussian variance. We will migrate touch injection natively into the Shizuku Daemon for total control over raw `MotionEvent`s.

#### [MODIFY] `core/shizuku/src/main/aidl/com/tokiyo/core/shizuku/IAgentUserService.aidl`
- Add new methods:
  - `boolean injectOrganicTap(int x, int y);`
  - `boolean injectOrganicSwipe(int startX, int startY, int endX, int endY, int durationMs);`
  - `boolean injectOrganicText(String text);`

#### [MODIFY] `core/shizuku/src/main/java/com/tokiyo/core/shizuku/AgentUserService.kt`
- **Gaussian Taps:** Implement `injectOrganicTap` by adding a small randomized Gaussian offset to the target coordinates, then synthesizing `MotionEvent.ACTION_DOWN`, sleeping 40-80ms, and `MotionEvent.ACTION_UP`.
- **Bezier Swipes:** Implement `injectOrganicSwipe` using cubic-bezier curves for the `ACTION_MOVE` coordinates, simulating a natural thumb arc rather than a perfectly straight line.
- **Human IME:** Implement `injectOrganicText` by mapping string characters to Android `KeyEvent`s and injecting them with a randomized latency of 50-150ms between each stroke.
- Inject all events via reflection on `UiAutomation.injectInputEvent(event, true)`.

#### [MODIFY] `cloud-orchestrator/src/ai/AutonomousAgent.ts`
- Update the action executor to emit `organic_tap`, `organic_swipe`, and `organic_type` jobs over the WebSocket instead of raw `shell` commands.

---

### Pillar 2: Media Relay Pipeline
To post images/videos autonomously, the target app's gallery picker must "see" the file natively in the Android MediaStore. 

#### [NEW] `app/src/main/java/com/tokiyo/app/media/MediaRelayWorker.kt`
- Implement a worker that listens for `download_media` socket commands containing a `file_url`.
- Download the file directly to `/sdcard/DCIM/TokiyoRelay/` using Kotlin Coroutines and Ktor/OkHttp.
- Immediately trigger `MediaScannerConnection.scanFile()` on the downloaded file. This forces the Android OS to index it instantly, making it the most recent item in the system gallery picker.

#### [MODIFY] `cloud-orchestrator/src/queue/Dispatcher.ts`
- Add support for the `download_media` job type, passing the target CDN/HTTP URL to the edge agent.

## Verification Plan

### Automated Tests
- Run `node test_fsm.js` and verify that the AI successfully types text using the slow, organic IME mechanism instead of instant `adb` shell injection.

### Manual Verification
- Dispatch an `organic_swipe` and observe the physical emulator using "Pointer Location" in Android Developer Options. Verify that the swipe line is curved and velocity varies during the swipe.
- Dispatch a `download_media` job with a test image URL. Open the Android Gallery app and verify the image appears instantly without requiring a device reboot.
# Feature Implementation Plan: Popup Rescue Heuristics

The FSM currently operates in a single linear loop. If an unexpected modal or OS popup appears (e.g., "Rate this app", "Location Permission"), the AI might try to blindly continue its original goal or get confused. We need a structured way to pause the main goal, dismiss the popup, and resume.
# Implementation Plan: Organic Touch Injection & Media Relay

This plan completes the remaining Phase 2 requirements for the Tokiyo Edge Automation system. It focuses on bot-evasion via human-like UI interactions and robust media injection for social media workflows.

## User Review Required
> [!IMPORTANT]
> - **Media Relay Strategy:** Sending large videos (e.g., 50MB) over WebSocket as Base64 strings can cause memory bloat on both the Node.js and Android sides. We can either chunk the Base64 strings (1MB pieces) over WebSocket, OR we can have the Android app download the media file directly via HTTP from a URL provided by the orchestrator. I recommend the **HTTP Download Strategy** where the Orchestrator sends `{"command": "download_media", "url": "..."}` and the Android app fetches it. Do you approve this strategy?

## Proposed Changes

---

### Pillar 1: Organic Touch Injection & IME (Bot Evasion)
Current actions use the standard `input tap` and `input swipe` shell commands, which trace perfect robotic lines and lack Gaussian variance. We will migrate touch injection natively into the Shizuku Daemon for total control over raw `MotionEvent`s.

#### [MODIFY] `core/shizuku/src/main/aidl/com/tokiyo/core/shizuku/IAgentUserService.aidl`
- Add new methods:
  - `boolean injectOrganicTap(int x, int y);`
  - `boolean injectOrganicSwipe(int startX, int startY, int endX, int endY, int durationMs);`
  - `boolean injectOrganicText(String text);`

#### [MODIFY] `core/shizuku/src/main/java/com/tokiyo/core/shizuku/AgentUserService.kt`
- **Gaussian Taps:** Implement `injectOrganicTap` by adding a small randomized Gaussian offset to the target coordinates, then synthesizing `MotionEvent.ACTION_DOWN`, sleeping 40-80ms, and `MotionEvent.ACTION_UP`.
- **Bezier Swipes:** Implement `injectOrganicSwipe` using cubic-bezier curves for the `ACTION_MOVE` coordinates, simulating a natural thumb arc rather than a perfectly straight line.
- **Human IME:** Implement `injectOrganicText` by mapping string characters to Android `KeyEvent`s and injecting them with a randomized latency of 50-150ms between each stroke.
- Inject all events via reflection on `UiAutomation.injectInputEvent(event, true)`.

#### [MODIFY] `cloud-orchestrator/src/ai/AutonomousAgent.ts`
- Update the action executor to emit `organic_tap`, `organic_swipe`, and `organic_type` jobs over the WebSocket instead of raw `shell` commands.

---

### Pillar 2: Media Relay Pipeline
To post images/videos autonomously, the target app's gallery picker must "see" the file natively in the Android MediaStore. 

#### [NEW] `app/src/main/java/com/tokiyo/app/media/MediaRelayWorker.kt`
- Implement a worker that listens for `download_media` socket commands containing a `file_url`.
- Download the file directly to `/sdcard/DCIM/TokiyoRelay/` using Kotlin Coroutines and Ktor/OkHttp.
- Immediately trigger `MediaScannerConnection.scanFile()` on the downloaded file. This forces the Android OS to index it instantly, making it the most recent item in the system gallery picker.

#### [MODIFY] `cloud-orchestrator/src/queue/Dispatcher.ts`
- Add support for the `download_media` job type, passing the target CDN/HTTP URL to the edge agent.

## Verification Plan

### Automated Tests
- Run `node test_fsm.js` and verify that the AI successfully types text using the slow, organic IME mechanism instead of instant `adb` shell injection.

### Manual Verification
- Dispatch an `organic_swipe` and observe the physical emulator using "Pointer Location" in Android Developer Options. Verify that the swipe line is curved and velocity varies during the swipe.
- Dispatch a `download_media` job with a test image URL. Open the Android Gallery app and verify the image appears instantly without requiring a device reboot.
# Feature Implementation Plan: Popup Rescue Heuristics

The FSM currently operates in a single linear loop. If an unexpected modal or OS popup appears (e.g., "Rate this app", "Location Permission"), the AI might try to blindly continue its original goal or get confused. We need a structured way to pause the main goal, dismiss the popup, and resume.
# Implementation Plan: Organic Touch Injection & Media Relay

This plan completes the remaining Phase 2 requirements for the Tokiyo Edge Automation system. It focuses on bot-evasion via human-like UI interactions and robust media injection for social media workflows.

## User Review Required
> [!IMPORTANT]
> - **Media Relay Strategy:** Sending large videos (e.g., 50MB) over WebSocket as Base64 strings can cause memory bloat on both the Node.js and Android sides. We can either chunk the Base64 strings (1MB pieces) over WebSocket, OR we can have the Android app download the media file directly via HTTP from a URL provided by the orchestrator. I recommend the **HTTP Download Strategy** where the Orchestrator sends `{"command": "download_media", "url": "..."}` and the Android app fetches it. Do you approve this strategy?

## Proposed Changes

---

### Pillar 1: Organic Touch Injection & IME (Bot Evasion)
Current actions use the standard `input tap` and `input swipe` shell commands, which trace perfect robotic lines and lack Gaussian variance. We will migrate touch injection natively into the Shizuku Daemon for total control over raw `MotionEvent`s.

#### [MODIFY] `core/shizuku/src/main/aidl/com/tokiyo/core/shizuku/IAgentUserService.aidl`
- Add new methods:
  - `boolean injectOrganicTap(int x, int y);`
  - `boolean injectOrganicSwipe(int startX, int startY, int endX, int endY, int durationMs);`
  - `boolean injectOrganicText(String text);`

#### [MODIFY] `core/shizuku/src/main/java/com/tokiyo/core/shizuku/AgentUserService.kt`
- **Gaussian Taps:** Implement `injectOrganicTap` by adding a small randomized Gaussian offset to the target coordinates, then synthesizing `MotionEvent.ACTION_DOWN`, sleeping 40-80ms, and `MotionEvent.ACTION_UP`.
- **Bezier Swipes:** Implement `injectOrganicSwipe` using cubic-bezier curves for the `ACTION_MOVE` coordinates, simulating a natural thumb arc rather than a perfectly straight line.
- **Human IME:** Implement `injectOrganicText` by mapping string characters to Android `KeyEvent`s and injecting them with a randomized latency of 50-150ms between each stroke.
- Inject all events via reflection on `UiAutomation.injectInputEvent(event, true)`.

#### [MODIFY] `cloud-orchestrator/src/ai/AutonomousAgent.ts`
- Update the action executor to emit `organic_tap`, `organic_swipe`, and `organic_type` jobs over the WebSocket instead of raw `shell` commands.

---

### Pillar 2: Media Relay Pipeline
To post images/videos autonomously, the target app's gallery picker must "see" the file natively in the Android MediaStore. 

#### [NEW] `app/src/main/java/com/tokiyo/app/media/MediaRelayWorker.kt`
- Implement a worker that listens for `download_media` socket commands containing a `file_url`.
- Download the file directly to `/sdcard/DCIM/TokiyoRelay/` using Kotlin Coroutines and Ktor/OkHttp.
- Immediately trigger `MediaScannerConnection.scanFile()` on the downloaded file. This forces the Android OS to index it instantly, making it the most recent item in the system gallery picker.

#### [MODIFY] `cloud-orchestrator/src/queue/Dispatcher.ts`
- Add support for the `download_media` job type, passing the target CDN/HTTP URL to the edge agent.

## Verification Plan

### Automated Tests
- Run `node test_fsm.js` and verify that the AI successfully types text using the slow, organic IME mechanism instead of instant `adb` shell injection.

### Manual Verification
- Dispatch an `organic_swipe` and observe the physical emulator using "Pointer Location" in Android Developer Options. Verify that the swipe line is curved and velocity varies during the swipe.
- Dispatch a `download_media` job with a test image URL. Open the Android Gallery app and verify the image appears instantly without requiring a device reboot.
