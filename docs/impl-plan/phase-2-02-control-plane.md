# Phase 2 - Document 2: Control Plane & Orchestration

This document outlines the architecture for the Python-based Control Plane. It treats the Android devices as "dumb Mars Rovers" while the Control Plane acts as "Houston", maintaining all logic, state, and decision-making.

## 1. Prototype 5: APK Intelligence & Static Analysis
**Goal:** Understand what an app is capable of before interacting with it, avoiding fragile UI navigation where possible.
- **Action:** Build a FastAPI endpoint to ingest APKs.
- **Implementation:**
  - Use `pyaxmlparser` or `androguard` to statically analyze `AndroidManifest.xml` in memory (avoiding heavy CLI tools like `apktool`).
  - Extract **Deep Links** (`intent-filters`), **Exported Activities**, and version details.
  - Hash the APK (SHA-256) to ensure immutability.
- **Result:** The Control Plane knows that instead of clicking through UI menus, it can just send `{"command": "INTENT", "uri": "linkedin://messaging/compose"}`.

## 2. Prototype 6: The Finite State Machine (FSM)
**Goal:** Create a closed-loop execution system to prevent race conditions and double-taps.
- **Action:** Implement the **ACTION -> OBSERVE -> VERIFY** loop.
- **Implementation:**
  - When instructing the Agent to "Tap Follow", do not assume success.
  - The State Machine enters a `VERIFYING` state, waiting for the Agent to dump the UI again and confirm the UI node changed from "Follow" to "Following".
  - If a popup (e.g., "Rate this App") blocks the action, the FSM triggers a fallback heuristic (Popup Rescue) before retrying.

## 3. Prototype 7: Media Relay Pipeline (MCR)
**Goal:** Safely inject heavy binary files (images/videos) into the Edge Agent's environment for social media posting.
- **Action:** Build a multipart HTTP transport and OS-level indexer.
- **Implementation:**
  - **Transport:** Use a standard HTTP POST endpoint on the Edge Agent (Ktor) to stream `.mp4`/`.jpg` files directly to disk (avoiding WebSocket memory bloat and synchronous `adb push` bottlenecks).
  - **Isolation:** Save files to a sandboxed directory (`/sdcard/DCIM/MCR_Relay/`).
  - **Indexing:** The Edge Agent invokes `MediaScannerConnection.scanFile()` to force the Android OS to recognize the file instantly, making it available in the target app's gallery picker.
  - **Cleanup:** Issue a command to delete the injected media immediately after a successful post to prevent ENOSPC (Out of Space) errors.

## Execution Path
Once the Edge Agent (Doc 1) can successfully tap buttons and read text, the Control Plane will be scaffolded to orchestrate these capabilities securely.
