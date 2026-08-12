# Phase 3: UiAutomator Integration (Intelligent DOM Parsing)

The goal of this phase is to give the Edge Node "eyes" by allowing it to parse the live Android screen natively, enabling semantic element selection (like finding a button by its text or resource-id) instead of relying on blind X/Y coordinates.

## User Review Required

> [!IMPORTANT]
> Please review the strategy below. We will use `uiautomator dump` via our hardened Shizuku shell executor to extract the XML hierarchy instantly, and a lightweight Kotlin XML parser to extract node boundaries.

## Open Questions
- Do you want to support complex selectors (like XPath) immediately, or start with basic attribute matching (e.g., `text`, `resource-id`, `content-desc`, `class`)?

## Proposed Changes

### [NEW] Module: `:core:uiautomator`
We will create a new pure Kotlin module (or Android library) responsible for UI analysis.
- `models/UiNode.kt`: Represents a parsed UI element (attributes and bounds).
- `models/UiSelector.kt`: Represents a query (e.g., find by text).
- `UiHierarchyParser.kt`: A lightweight XML parser that converts the raw UI Automator XML dump into a searchable tree of `UiNode` objects.
- `UiAutomatorService.kt`: Orchestrates the flow. It uses the `ActionExecutor` (Shizuku) to trigger `uiautomator dump`, pulls the XML, parses it, and calculates the exact X/Y center coordinate of the desired element.

### [MODIFY] Module: `:core:domain`
- `JobDispatcher.kt`: Add support for new semantic actions. 
  - For example, if `action == "click_element"`, the dispatcher will call `UiAutomatorService` to find the X/Y coordinates, and then pass those coordinates to `ShizukuExecutor` to execute the tap.

### [MODIFY] Module: `settings.gradle.kts` & `app/build.gradle.kts`
- Add the `:core:uiautomator` module to the Gradle workspace and link it to the app.

## Verification Plan

### Automated Tests
- We will write a unit test in `:core:uiautomator` with a mock XML dump to verify that `UiHierarchyParser` correctly extracts bounds (e.g., `[189,501][247,616]`) and calculates the center X/Y accurately.

### Manual Verification
- We will dispatch a JSON job to the Android Emulator: `{"action": "click_element", "params": {"text": "Settings"}}`
- We will verify that the app successfully parses the home screen, finds the "Settings" icon bounds, calculates the tap coordinates, and opens the Settings app natively.
