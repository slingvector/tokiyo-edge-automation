# Environment Bootstrap & Architecture Walkthrough

We've completely overhauled the Android emulator development workflow to solve the Shizuku connection flakiness and finalized the master project architecture.

## 1. Automated Environment Bootstrap (`dev-bootstrap.sh`)

Instead of fighting with Wireless Debugging or manual UI taps in the emulator, we now have a single host-side command that reliably provisions the environment:

```bash
# Run this from the project root anytime the emulator restarts
./dev-bootstrap.sh
```

**What it does under the hood:**
- Uses `adb wait-for-device` and checks `sys.boot_completed` to ensure the system is ready.
- Escalates ADB to root (`adb root`).
- Dynamically queries the Android Package Manager to locate the exact installation path of the Shizuku base APK.
- Detects the emulator architecture (e.g., `arm64`, `x86_64`) and executes the embedded `libshizuku.so` binary directly via `app_process`, completely bypassing the UI and root manager dialogs.
- Force-stops and restarts our `com.tokiyo.shizukuspike` app so it immediately binds to the freshly started Shizuku daemon.

## 2. Manifest Provider Patch

We discovered that Android 11+ (API 30+) requires explicit `<queries>` to allow apps to bind to the Shizuku provider. We updated our `AndroidManifest.xml` to include:

```xml
<queries>
    <provider android:authorities="moe.shizuku.manager.shizuku.provider" />
</queries>

<provider
    android:name="rikka.shizuku.ShizukuProvider"
    android:authorities="${applicationId}.shizuku"
    ... />
```
This guarantees our Edge Node app immediately receives the Shizuku Binder without hanging.

## 3. Project Plan Formalization

We updated the `docs/project-plan.md` to formally transition out of the Sandbox phase. 

> [!TIP]
> **Phase 1 (IPC & Execution) is 100% complete.**
> We successfully demonstrated pushing a command from the Node Orchestrator -> WebSocket -> Android App -> ECDSA Signature Verification -> Shizuku Shell, resulting in an `Exit: 0`.

The master plan now strictly defines **Phase 2**: building the Clean Architecture Domain layer (`:core:domain`) and isolating the Android dependencies (`:core:shizuku`, `:core:uiautomator`) to prevent tight coupling.
