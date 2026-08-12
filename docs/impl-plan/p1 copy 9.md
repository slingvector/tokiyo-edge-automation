# Phase 6: On-Device Semantic Perception Strategy

Implement the `ISemanticPerceptionStrategy` natively inside the Android Edge Agent to drastically reduce the latency of autonomous operations. By resolving semantic UI queries directly on the device (e.g., finding the bounds for a "Home" button), the Orchestrator won't need to request a 5MB UI dump and wait for Gemini Vision inference just to execute deterministic actions.

## User Review Required

> [!IMPORTANT]
> **XML Parsing Strategy**: I propose using standard Java XML Pull Parsing (`org.xmlpull.v1.XmlPullParser`) on-device to rapidly scan the `uiautomator dump` string for matching `UiSelector` criteria (text, content-desc, resource-id) and extracting the `bounds` attribute. This is significantly faster and less memory-intensive than building a full DOM tree. Do you agree?

## Open Questions

> [!WARNING]
> If a UI element isn't found during a `click_element` action, should the `UiAutomatorClient` automatically run a **Double-Pass Validation** (wait 500ms, dump again, retry) internally, or should we bubble up the failure immediately to the Orchestrator and let the LLM handle the retry via visual fallback?

## Proposed Changes

### `shizuku-spike-sandbox/core/uiautomator`
#### [NEW] `src/main/java/com/tokiyo/core/uiautomator/UiAutomatorClientImpl.kt`
- Implements `com.tokiyo.core.domain.interfaces.UiAutomatorClient`.
- `dumpHierarchy()`: Executes `uiautomator dump /data/local/tmp/dump.xml` and reads the XML string.
- `findNode(selector: UiSelector)`:
    - Runs `dumpHierarchy()`.
    - Parses the XML using `XmlPullParser`.
    - Scans for nodes and returns the first `UiNode` matching the `UiSelector`.
    - Optional: Includes double-pass logic if the element is not found on the first attempt to account for Server-Driven UI (SDUI) latency.

### `shizuku-spike-sandbox/app`
#### [MODIFY] `src/main/java/com/tokiyo/shizukuspike/service/AgentBridgeService.kt`
- Inject the new `UiAutomatorClientImpl` into the `JobDispatcher` instantiation (right now, it appears to be passing a dummy object or is missing).

### `cloud-orchestrator/src/ai`
#### [MODIFY] `AutonomousAgent.ts`
- Update the ReAct Loop to leverage the new deterministic `click_element` capability:
  - When Gemini decides to click an element, instead of returning an arbitrary coordinate, the Orchestrator will issue a `click_element` job payload with the semantic target (e.g., `text="Home"`).
  - The Orchestrator will only request a full `dump_ui` if it is uncertain of the current state or needs to make a complex reasoning decision.

## Verification Plan

### Automated Tests
- Unit tests for `UiAutomatorClientImpl` simulating a raw `uiautomator` XML dump and asserting that `findNode` correctly extracts bounds for specific text and resource-ids.

### Manual Verification
1. Re-run `node cloud-orchestrator/test_autonomous.js`.
2. The Orchestrator should issue a `click_element` command with `text="Home"` directly, bypassing the UI dump step.
3. The Edge Agent parses the DOM locally, taps the Home tab, and reports `SUCCESS` in milliseconds rather than seconds.
