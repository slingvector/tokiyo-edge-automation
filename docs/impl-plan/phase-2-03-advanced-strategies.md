# Phase 2 - Document 3: Advanced Tactics & App-Specific Logic

Once the core IPC and orchestration are stable, the platform must tackle modern UI frameworks (Jetpack Compose, WebViews, SDUI) and anti-bot systems.

## 1. Jetpack Compose & WebView Extraction
- **The Hurdle:** Compose semantics trees merge nodes, and WebViews hide HTML elements.
- **The Solution:**
  - Force `UiAutomation` to query unmerged semantics trees to expose raw Compose elements.
  - Recursively search WebViews for HTML-mapped accessibility roles (e.g., `role="link"`).

## 2. Advanced Social Media Tactics
- **Spatial Sibling Resolution (e.g., LinkedIn "Like"):** 
  - Instead of clicking the first "Like" button, find the **Anchor Node** (the post text). Calculate a bounding cone vertically beneath it, and only tap the "Like" button that falls within that specific coordinate cone.
- **Viewport Dwell Lock:**
  - Never dump the UI tree while the feed is inertia-scrolling. Wait for consecutive `UiAutomation.getRootInActiveWindow()` hashes to remain static.
  - Inject 1.8s - 4.2s of randomized dwell time before acting, simulating human reading speed.
- **Humanized IME Input:**
  - Do not use `AccessibilityNodeInfo.ACTION_SET_TEXT` to instantly paste comments (highly detectable).
  - Tap the input, then inject each character using `UiAutomation.injectInputEvent(KeyEvent)` with Gaussian inter-key latency (50-120ms).

## 3. Resiliency & Scale (Fleet Management)
- **App-Clone Sandboxing:** Use `dpm` (Device Policy Manager) via Shizuku to provision native Work Profiles, isolating target apps to avoid cross-contamination of cache or fingerprints.
- **The Clean Slate Protocol:** Use `pm clear <package>` via shell to instantly reset apps to a factory state between workflows, avoiding complex UI "back to home" routines.
- **Hardware Hardening:** Exempt the Edge Agent from Doze Mode. Trigger wakes via `KEYCODE_WAKEUP` (224) to ensure 24/7 headless operation on physical devices and ReDroid clusters.
