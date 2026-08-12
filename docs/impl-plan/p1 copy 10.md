# Goal: Achieve 95% Code Coverage via JUnit/Robolectric Tests

The Android Edge Agent's core modules (`domain`, `uiautomator`, `security`, `shizuku`) need robust unit testing to ensure stability and maintainability.

Currently, we have failing tests due to the recent architectural changes in Phase 5 and Phase 6 (e.g., swapping to `XmlPullParser`, updating `FlightRecorder` gzip commands, and changing `UiAutomatorService` dump paths).

## User Review Required

> [!IMPORTANT]
> **Coverage Threshold Enforcement**: Gradle's Jacoco plugin will be configured to strictly fail the build if coverage falls below 95% across the `core` modules. This ensures high code quality going forward.

## Open Questions

> [!WARNING]
> Do you want to include UI/instrumentation tests (Robolectric) for the `AgentBridgeService` (the Foreground Service), or should we keep the 95% coverage target strictly to the business logic modules (`:core:domain`, `:core:uiautomator`, `:core:security`) which run as pure JVM tests? JVM tests are much faster and less brittle.

## Proposed Changes

### 1. Fix Existing Test Failures
- **`build.gradle.kts` in `:core:uiautomator`**: Change `compileOnly("net.sf.kxml:kxml2:2.3.0")` to include `testImplementation("net.sf.kxml:kxml2:2.3.0")` so that `XmlPullParserFactory` is available during JVM test execution.
- **`UiAutomatorServiceTest.kt`**: Update MockK command expectations. The test currently expects `uiautomator dump /sdcard/window_dump.xml`, but the implementation was updated to use `/data/local/tmp/dump.xml` with stdout redirection.
- **`FlightRecorderImplTest.kt`**: Update the mocked shell command expectations to match the new `cat ... | gzip` pipeline implemented in Phase 5 to fix permission issues.

### 2. Expand Test Coverage to >95%

#### `:core:domain`
- `JobDispatcher`: Add tests to cover error handling (e.g., invalid job ID, missing parameters for deep link, touch dispatcher failures).
- `SecurityEngine`: Add tests for invalid signatures, expired keys, and boundary conditions.

#### `:core:uiautomator`
- `UiHierarchyParser`: Add comprehensive XML dump parsing tests, asserting edge cases like missing attributes, deeply nested hierarchies, and empty XML strings.
- `TouchDispatcherImpl`: Add tests for coordinate calculation, boundary checks, and shell command generation for taps and swipes.

### 3. Jacoco Verification
- Add Jacoco verification rules in the root `build.gradle` or module-level build files to enforce the 0.95 line/branch coverage ratio.

## Verification Plan

### Automated Tests
1. Run `./gradlew test jacocoTestReport jacocoTestCoverageVerification`.
2. Ensure the build passes and the Jacoco report confirms >95% instruction and branch coverage.
