# Phase 6 Implementation Plan: 3-Device Orchestration & Resolution Independence

To prove our OCR-based automation is completely agnostic to screen size and aspect ratio, we will create a completely new emulator with a smaller screen (Pixel 4a format), log it into a new LinkedIn account using our Automated Login Macro, and fire three concurrent posts across three distinct devices.

## Proposed Changes

### Environment Configuration
1. **APK Extraction:** We will pull the base LinkedIn APK (`base.apk`) from `emulator-5554` so we can dynamically install it on new virtual devices.
2. **Device Creation:** We will use `avdmanager` to create a third emulator (`tokiyo_test_avd_3`) targeting a smaller form factor (e.g., Pixel 4a). We will launch it on a new port (`emulator-5558`).
3. **App Installation:** We will use `adb -s emulator-5558 install /tmp/linkedin.apk` to load the app onto the new device.

### File Modifications

#### [MODIFY] `emulator-credentials.json`
- We will add the third set of credentials provided by the user:
  ```json
  "linkedin_2": {
      "email": "iitr.anuj.wrk@gmail.com",
      "password": "Anuj@ab34"
  }
  ```
  *(Note: We will adjust the structure slightly or pass an account key to `LinkedInAuth` so it knows which credentials to use).*

#### [MODIFY] `cloud-orchestrator/src/services/LinkedInAuth.ts`
- Update the `LinkedInAuth` constructor and `getCredentials()` method to accept an `accountKey` parameter (e.g., `'linkedin_1'` vs `'linkedin_2'`). This allows the orchestrator to map specific emulators to specific accounts.

#### [MODIFY] `cloud-orchestrator/test_publisher.ts`
- We will instantiate three `LinkedInPublisher` objects:
  - `publisher1` on `emulator-5554` (Post: "Drone Technology")
  - `publisher2` on `emulator-5556` (Post: "3D Printing")
  - `publisher3` on `emulator-5558` (Post: "Distributed Systems")
- We will execute all three concurrently using `Promise.allSettled`.

## Verification Plan

### Automated Tests
1. **Login Test:** We will run `npx tsx test_login.ts` targeting `emulator-5558` and the `linkedin_2` account to prove our Login Macro works on a completely fresh, unauthenticated device with a different screen resolution.
2. **Publishing Test:** We will run `npx tsx test_publisher.ts` to execute the three distinct posts on all three emulators simultaneously.

## User Review Required

> [!WARNING]  
> Creating a new AVD and launching it requires allocating another chunk of RAM (at least 512MB to 1GB). Please ensure your host machine has enough memory to run 3 emulators concurrently.

Do you approve this plan to scale up to 3 devices?
