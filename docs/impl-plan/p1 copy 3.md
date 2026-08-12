# Phase 2: Domain Abstraction Implementation Plan

Based on the [BACKEND-STANDARDS](file:///Users/cortex/ventures/tokiyo-edge-automation/docs/BACKEND-STANDARDS), we will refactor the Android Edge Node into a strict Layered Architecture (Clean Architecture). This ensures high testability, fault tolerance, and modularity, directly mapping the successful patterns from the `RoboticDevice` project into the native Android environment.

## User Review Required

> [!IMPORTANT]
> Please review the module structure below. We are splitting the monolithic `:app` module into distinct Gradle modules to enforce the **Dependency Inversion Principle (DIP)**.

## Architectural Mapping

We will implement the following layers:

1. **Controller Layer (`:app`)**: `AgentBridgeService.kt` will handle the Socket.IO connection lifecycle, but it will no longer parse JSON or execute logic. It simply receives payloads and passes them to the Service Layer.
2. **Service Layer (`:core:domain`)**: The "Brain". A pure Kotlin module (no Android dependencies). It contains `JobDispatcher.kt` which validates security signatures and orchestrates execution via abstract interfaces.
3. **Repository/Infrastructure Layer (`:core:shizuku`)**: The physical executor. This module will depend on the domain interfaces and contain `ShizukuExecutor.kt` (which houses our bulletproof stream execution logic).

## Proposed Changes

### [NEW] Module: `:core:domain`
A pure Kotlin library module.
- `models/JobPayload.kt`, `models/ShellResult.kt`
- `interfaces/ActionExecutor.kt`: Defines `suspend fun execute(command: String): ShellResult`
- `interfaces/TelemetryClient.kt`: Defines how telemetry is sent back to the orchestrator.
- `JobDispatcher.kt`: The business logic service that links everything together.

### [NEW] Module: `:core:shizuku`
An Android library module implementing the domain interface.
- `ShizukuExecutor.kt`: Implements `ActionExecutor`. Contains the robust concurrent stream and timeout logic we built in Phase 1.

### [NEW] Module: `:core:security`
A pure Kotlin library module.
- `SecurityEngine.kt`: Extracts the ECDSA signature verification out of the controller layer.

### [MODIFY] Module: `:app`
- `AgentBridgeService.kt`: Stripped down to just be the Socket.IO listener. It will instantiate `JobDispatcher`, inject the `ShizukuExecutor`, and act purely as the **Controller Layer**.
- `build.gradle.kts`: Add dependencies on `:core:domain`, `:core:shizuku`, and `:core:security`.

## Verification Plan

### Automated Build Tests
- Execute `./gradlew build` to verify the multi-module project compiles and that dependency inversion is strictly enforced (e.g., `:core:domain` cannot import android packages).

### Integration Verification
- Execute `curl` against the Node Orchestrator to dispatch a job.
- Verify `AgentBridgeService` successfully routes the job through the Domain layer and into the Shizuku executor, returning the telemetry correctly.
