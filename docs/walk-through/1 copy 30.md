# Cloud Migration Walkthrough

The codebase has been refactored to support a fully distributed, horizontally scalable deployment on **Google Cloud Run**. 

Because Cloud Run can spin up multiple containers on demand, we had to eliminate all "in-memory" state (like local Maps) and replace them with centralized Redis stores.

Here is what was accomplished in this phase:

### 1. Dockerization
- Created `cloud-orchestrator/Dockerfile` and `.dockerignore`.
- The multi-stage build will install dependencies, generate the Prisma client, and run the Node server on port 3000.

### 2. Distributed State Management
- Replaced the local `connectedNodes` and `nodeStatus` `Map` objects in [`Server.ts`](file:///Users/cortex/ventures/tokiyo-edge-automation/cloud-orchestrator/src/api/Server.ts) with `redisClient.hset` and `redisClient.hget`.
- Upgraded the WebSocket server to use `@socket.io/redis-adapter`. Now, if a device connects to Container A and the AI engine is running on Container B, they can still communicate seamlessly.
- Updated [`FleetRouter.ts`](file:///Users/cortex/ventures/tokiyo-edge-automation/cloud-orchestrator/src/queue/FleetRouter.ts) to become an async service that queries Redis for IDLE devices across the entire fleet.

### 3. Edge Agent Networking Updates
- Updated the Android app's [`build.gradle.kts`](file:///Users/cortex/ventures/tokiyo-edge-automation/shizuku-spike-sandbox/app/build.gradle.kts) to dynamically inject the `ORCHESTRATOR_URL` based on the build type.
  - **Debug/Default**: Connects to `ws://127.0.0.1:3000`
  - **Release**: Connects to the public `wss://tokiyo-orchestrator-cloud.run.app`
- The `AgentBridgeService` now uses `BuildConfig.ORCHESTRATOR_URL` instead of hardcoded strings.

### 4. Deployment Automation
- Created a [`deploy.sh`](file:///Users/cortex/ventures/tokiyo-edge-automation/cloud-orchestrator/deploy.sh) script to handle the GCP rollout.
- The script automatically configures `--session-affinity`, which is mandatory for Socket.IO on Cloud Run.

### Next Steps (Manual Verification)
1. Provision your GCP Cloud SQL and Memorystore (Redis) instances.
2. Ensure you have authenticated with `gcloud auth login`.
3. Open `cloud-orchestrator/deploy.sh` and uncomment the `docker push` and `gcloud run deploy` lines once your variables are set.
4. Execute `./deploy.sh` from inside the `cloud-orchestrator` directory.
