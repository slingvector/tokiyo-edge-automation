# Phase 4, Epic 3: Jetpack Compose Unmerging & WebView Extraction

This epic focuses on solving the "Black Box" problem in modern Android apps. Jetpack Compose and WebViews often hide their internal interactive elements from the standard Android Accessibility tree (`dump_ui`). We will implement a highly robust, visual-first "Black-Box" heuristic to unmerge these elements and test it against a custom-built malicious app.

## User Review Required
> [!IMPORTANT]
> **Implementation Strategy:** Since 3rd-party production apps cannot be modified to expose their Compose unmerged trees via Accessibility, attempting to use Kotlin Reflection to read memory (the White-Box approach) is highly brittle and often breaks across Android versions. 
> 
> Therefore, we will implement the **Visual Heuristics (Black-Box) Approach**. We will leverage the Orchestrator to crop the device screenshot to the bounds of the merged node, and use a specialized Vision pass to extract the exact X/Y offset of the target element. Do you approve of this visual-fallback approach?

## Open Questions
> [!WARNING]
> For the visual unmerging, should we rely on the existing LLM `PerceptionEngine` (by sending it the cropped image of the merged block and asking for coordinates), or should we build a localized OpenCV template-matching endpoint into our new Python Microservice? (Recommendation: Use the Python Microservice with OpenCV/EasyOCR for faster, cheaper, and deterministic coordinate extraction).

## Proposed Changes

---

### 1. The "Poisoned Compose" Minefield App
We will build a dedicated Android Jetpack Compose app to serve as our security testing grounds. It will implement the threats outlined in our security model.

#### [NEW] `tokiyo-poisoned-compose/`
A new Android project containing:
- **Semantic Poisoning View:** A "Delete" button disguised with a "Like" `contentDescription`.
- **Tap-Jacking View:** A transparent, high Z-index layer positioned over a legitimate button to intercept clicks.
- **Clock Problem View:** A continuously animating, invisible spinner designed to paralyze our Epic 1 Dwell Lock.

---

### 2. Python Vision Microservice (The Unmerger)
We will expand the existing APK Analyzer microservice to include a robust Image Processing endpoint.

#### [MODIFY] `apk-analyzer/main.py`
- Add a `POST /unmerge` endpoint.
- **Input:** A Base64 cropped image (the bounds of the merged Compose node or WebView), and a target descriptor (e.g., "heart icon" or "Login text").
- **Logic:** Use `EasyOCR` (for text) or OpenCV (for icons) to find the target *within* the crop.
- **Output:** The relative `(X, Y)` offset of the target within the cropped image.

#### [NEW] `apk-analyzer/requirements.txt`
- Add `opencv-python-headless` and `easyocr`.

---

### 3. Orchestrator Integration
The Orchestrator will intercept LLM decisions that target merged nodes or WebViews and trigger the unmerging routine before taking physical action.

#### [MODIFY] `cloud-orchestrator/src/ai/AutonomousAgent.ts`
- **Detection:** If `PerceptionEngine` selects a node that is a `WebView` or a generic `FrameLayout` with excessive text but no clickable children (a merged Compose block), intercept the action.
- **Cropping:** Crop the `telemetryData.screenshot` to the bounds of that node.
- **Unmerging:** Send the cropped image and the target intent to the Python `/unmerge` endpoint.
- **Execution:** Add the returned relative offset to the absolute bounds of the parent node, and dispatch an `organic_tap` to that precise location.

## Verification Plan
1. Compile and install the `tokiyo-poisoned-compose` APK onto the emulator.
2. Command the `AutonomousAgent` to navigate the minefield app.
3. **Validation 1 (Unmerging):** Verify the agent successfully identifies and clicks the actual heart icon inside the merged Compose block, rather than the center of the block.
4. **Validation 2 (Security):** Verify the agent detects and avoids the Tap-Jacking layer and does not fall for the Semantic Poisoning trap.
