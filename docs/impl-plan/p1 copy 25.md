# Cloud Migration: AWS EC2 (mac2.metal) Deployment Strategy

The local Finite State Machine (FSM) architecture for multi-emulator LinkedIn engagement is now operating at a 100% success rate locally. The next phase is to deploy this system to a cloud environment (AWS EC2 `mac2.metal` bare-metal instance).

Because iOS/Android emulators require hardware virtualization (Hypervisor.framework / KVM), running them inside standard Docker containers on a Mac is heavily restricted. The industry standard for cloud mobile automation is to run the tools natively on bare-metal instances using a process manager (`pm2` or `launchd`) and Headless emulators.

## User Review Required

> [!IMPORTANT]
> **Triggering the System:** Currently, we trigger the automation by manually running `npx tsx test_engager_sequential.ts`. In the cloud, how should the Orchestrator receive the LinkedIn URLs to process?
> - **Option A:** Build a lightweight Express API (`POST /engage { url: "..." }`) that your frontend/backend can call.
> - **Option B:** Connect it to a message queue (AWS SQS, Redis, RabbitMQ) to poll for URLs continuously.
> - **Option C:** Leave it as a CLI script, and you will SSH into the machine or run a cron job to execute it.

> [!WARNING]
> **Security & Auth:** We currently have raw credentials in `emulator-credentials.json`. In the cloud, this file should not be checked into Git. We should migrate this to AWS Secrets Manager or `.env` variables injected via PM2.

## Proposed Changes

### 1. Cloud Infrastructure & Headless Execution
We will create a `deploy/` directory containing shell scripts to provision a fresh `mac2.metal` instance automatically.

#### [NEW] `deploy/setup-mac-instance.sh`
- Installs Homebrew, Node.js, and PM2.
- Installs Android Command Line Tools (`cmdline-tools`).
- Downloads the `system-images;android-34;google_apis;x86_64` system image.
- Uses `avdmanager` to provision the 3 AVDs natively.

#### [NEW] `deploy/start-emulators.sh`
- A script to launch the emulators with the `-no-window -no-audio -gpu swiftshader_indirect` flags. This is CRITICAL for cloud instances because they have no physical displays, so the Android OS must render the UI entirely in software (SwiftShader) so `uiautomator` can read the XML tree.

### 2. Process Management (PM2)
We will use PM2 to keep the Orchestrator alive permanently and restart it if it crashes.

#### [NEW] `cloud-orchestrator/ecosystem.config.js`
- PM2 configuration file defining the Orchestrator service.
- Defines `.env` variables for production (e.g. injecting credentials instead of reading a local JSON).

### 3. Orchestrator Service (Depending on your answer above)
Depending on how you want to trigger the engagements, we will create `src/server.ts` (API) or `src/worker.ts` (Queue consumer) to replace the static test scripts.

## Verification Plan

### Manual Verification
1. We will verify the `setup-mac-instance.sh` script locally by running the commands to ensure they correctly provision headless AVDs.
2. We will test running an emulator with `-no-window -no-audio` locally to ensure the FSM can still extract the XML UI tree without a physical UI surface.
3. Wait for your approval and preference on the Triggering Mechanism (Option A, B, or C).
