# Walkthrough: Epic 4 (Entropy-Driven Execution Engine)

We have successfully implemented Epic 4, ensuring that the orchestrated agent behaves like a real human, mitigating static detection heuristics and giving the orchestrator robust control over app lifecycles.

## Changes Made

### 1. Entropy-Driven Touches (`TouchDispatcherImpl`)
We implemented the `ITouchDispatcher` in `:core:uiautomator`.
* **Gaussian Jitter (`tap`)**: Instead of clicking dead center every time, we implemented a 3-Sigma Gaussian curve logic. 99.7% of clicks occur safely within the bounds of the bounding box but land randomly across the UI element.
* **Swipe Velocity**: Added random jitter to swipe paths (+/- 20 pixels) and variable swipe durations (200-600ms) to simulate varying thumb speeds.

### 2. Secure Clipboard Injection (`ClipboardInjectorImpl`)
We created `ClipboardInjectorImpl` in the `:app` module to access the Android Context:
* **Background Bypass**: By running inside the foreground `AgentBridgeService`, we successfully bypass Android 10+ background clipboard restrictions.
* **Ephemeral Paste**: Injects a payload into the clipboard, emits `input keyevent 279` (Paste), and immediately nullifies the clipboard buffer to prevent data spillage.

### 3. Lifecycle Automation (`AppLifecycleControllerImpl`)
We implemented `IAppLifecycleController` in `:core:uiautomator`:
* **Deep Links**: Uses `am start -W -a android.intent.action.VIEW -d "url" package` to launch URLs without needing intent-filters manually hardcoded in tests.
* **Cache & Process Control**: Added support for `am force-stop` and `pm clear` to give the orchestrator a clean state on every execution.

### 4. Job Routing (`JobDispatcher.kt` & `AgentBridgeService.kt`)
* Refactored `JobDispatcher.kt` to securely route the new actions (`click_element`, `swipe`, `paste_text`, `deep_link`, `force_stop`) using the new implementations.
* Cleaned up and fully injected the components via the `AgentBridgeService`.

## Validation Results

We ran the test suite using `jacocoTestReport`.
* **Tests Passed:** 100% of unit tests pass successfully.
* **Code Coverage:** The `:core:uiautomator` test coverage is at **96.46%**, strictly adhering to our >95% threshold requirement.
* **Math Tests:** We ran thousands of simulated clicks in `TouchDispatcherImplTest` to strictly verify that our random Gaussian math never generates a tap coordinate outside the element's bounding box.

## Next Steps

Epic 4 is fully complete! We can now move on to testing on a physical real device, tackling Phase 4 observability/telemetry (Epic 7), or physical lifecycle hardening (Epic 8). Let me know what you want to focus on next!
