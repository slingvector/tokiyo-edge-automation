# Goal: Epic 4 - Entropy-Driven Execution Engine

We will build out the final piece of the perception-execution loop. This will allow the agent to dispatch physical clicks and text injections with human-like entropy, avoiding simple anti-bot heuristics, and guarantee strict application lifecycles.

## Open Questions

1. **Non-Linear Swipes via Shell**: Android's native `input swipe x1 y1 x2 y2` shell command strictly performs linear swipes. Simulating non-linear, continuous, multi-waypoint swipes via shell requires either injecting raw `/dev/input/eventX` bytes (which differ per device model) or executing a custom compiled Java binary via `app_process` to inject `MotionEvent`s manually. 
   **Recommendation**: For this iteration, I recommend we apply Gaussian jitter to the start/end coordinates and swipe durations using the standard `input swipe` command. Is this acceptable, or do you want to invest the heavy complexity into a custom `app_process` `MotionEvent` injector?
2. **New Module**: The master plan specifies a `:feature:execution` module. Do you want me to create this new module for these classes, or should I place them inside the existing `:core:uiautomator` and `:core:domain` to minimize Gradle boilerplate? (I lean toward keeping them in the existing `:core:domain` and `:core:uiautomator` to move fast, but will defer to your clean architecture preference).

## Proposed Changes

### `:core:domain`

#### [NEW] `com.tokiyo.core.domain.interfaces.ITouchDispatcher`
- Interface for dispatching taps and swipes with Gaussian random entropy boundaries.

#### [NEW] `com.tokiyo.core.domain.interfaces.IClipboardInjector`
- Interface for safely copying text to the Android clipboard and triggering paste events.

#### [NEW] `com.tokiyo.core.domain.interfaces.IAppLifecycleController`
- Interface for launching deep links, force stopping, and clearing app cache.

#### [MODIFY] `com.tokiyo.core.domain.JobDispatcher`
- Add support for new JSON payloads:
  - `action = "paste_text"` (delegates to `IClipboardInjector`)
  - `action = "deep_link"` (delegates to `IAppLifecycleController`)
  - `action = "force_stop"` (delegates to `IAppLifecycleController`)
  - Modify `click_element` to use the new `ITouchDispatcher` instead of raw `uiautomator` tap.

---

### `:core:uiautomator` (or `:core:execution` if preferred)

#### [NEW] `TouchDispatcherImpl.kt`
- Implements `ITouchDispatcher`.
- **Gaussian Jitter**: Computes a random point within a `UiNode`'s bounding box using the 3-Sigma rule (`nextGaussian()`) so clicks naturally land off-center but safely inside the target area.
- Dispatches via `ActionExecutor` (`input tap X Y`).

#### [NEW] `ClipboardInjectorImpl.kt`
- Implements `IClipboardInjector`.
- Uses Android's `ClipboardManager` (since our Edge Agent is a Foreground Service, it bypasses Android 10+ background clipboard restrictions).
- Once the payload is in the clipboard, uses `ActionExecutor` to send `input keyevent 279` (PASTE).
- Schedules a cleanup to wipe the clipboard ~100ms later to prevent data leaks.

#### [NEW] `AppLifecycleControllerImpl.kt`
- Implements `IAppLifecycleController`.
- Dispatches `am start -W -a android.intent.action.VIEW -d "<url>" <pkg>` for deep links.
- Dispatches `am force-stop <pkg>` and `pm clear <pkg>` for aggressive cleanup.

---

### `:app`

#### [MODIFY] `AgentBridgeService.kt`
- Instantiate the new interfaces and inject them into `JobDispatcher`.

## Verification Plan

### Automated Tests
- Unit tests for Gaussian coordinate math to prove that 99.7% of clicks fall within the expected bounding box logic.
- Unit tests for the new `JobDispatcher` routing commands.

### Manual Verification
- We will dispatch a physical `paste_text` action to the running emulator via WebSocket and verify that large, emoji-rich Unicode text is successfully pasted into an input field.
- We will dispatch a `click_element` action and trace the logcat to ensure the tap coordinates are varied on consecutive runs.
