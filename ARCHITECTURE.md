# 🏛️ Architecture Overview

The Tokiyo Edge Automation repository adheres to Clean Architecture principles, heavily prioritizing separation of concerns, testability, and security.

## 📦 Module Breakdown (Android)

> [!IMPORTANT]
> To maintain millisecond-level CI/CD performance, business logic is isolated in pure Kotlin JVM modules. Android dependencies are abstracted behind interfaces.

| Module | Type | Responsibility |
| :--- | :--- | :--- |
| `:app` | Android Application | Contains the UI layer, foreground service bindings, and DI injection graphs (Hilt/Koin). |
| `:core:domain` | Pure Kotlin (JVM) | The brain of the agent. Contains `JobDispatcher`, interfaces, and data models. **Must not contain Android dependencies.** |
| `:core:uiautomator` | Pure Kotlin (JVM) | Handles shell string parsing, UI Hierarchy tree processing, and calculating visual bounds. |
| `:core:security` | Pure Kotlin (JVM) | Contains `SecurityEngine` for RSA signature verification and payload validation. |
| `:core:shizuku` | Android Library | Implementations of domain interfaces (e.g., `ShizukuActionExecutor`). Wraps the Shizuku IPC binder calls. |

## 🧠 The Orchestrator AI Pipeline

The Cloud Orchestrator implements an intelligent fallback mechanism for interacting with mobile elements:

1. **Semantic Understanding:** The orchestrator fetches a Base64 snapshot and XML dump from the device.
2. **Context Resolution:** The Gemini Pro Vision model parses the screenshot and XML side-by-side to determine the user's intent.
3. **Coordinate Mapping:** Instead of guessing coordinates, the LLM identifies the target `resource-id` or `content-desc`. The orchestrator maps this to exact bounds using the XML dump, falling back to a geometric tap if necessary.
4. **Execution Validation:** If an action fails (non-zero exit code), the agent immediately attaches a fresh snapshot to the telemetry trace, allowing the AI to re-evaluate its state and self-correct on the next loop iteration.
