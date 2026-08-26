# Cloud Orchestrator Migration to Google Cloud Run

This plan outlines the architecture and steps required to migrate the local `cloud-orchestrator` to a fully managed, scalable deployment on **Google Cloud Run**. Because Cloud Run is stateless and autoscales container instances, we must refactor our in-memory states to be distributed.

## User Review Required

> [!IMPORTANT]
> Migrating to Cloud Run requires external Google Cloud resources (Cloud SQL and Memorystore). This will incur costs on your GCP billing account.

## Open Questions

> [!WARNING]
> 1. Do we have a Google Cloud Project with billing enabled ready to use?
> 2. Have you installed and authenticated the `gcloud` CLI tool locally?
> 3. Do you want to set up an automated CI/CD pipeline (e.g., GitHub Actions) for deployment, or deploy directly from our local machine for Phase 3?

---

## Proposed Changes

### 1. Containerization

We need to package the Orchestrator into a production-ready Docker container.

#### [NEW] `cloud-orchestrator/Dockerfile`
A multi-stage Dockerfile that:
1. Installs Node.js dependencies.
2. Runs `npx prisma generate` to build the PostgreSQL client.
3. Compiles the TypeScript code to JavaScript for a smaller production footprint.
4. Exposes port `3000`.

#### [NEW] `cloud-orchestrator/.dockerignore`
Excludes `node_modules`, `.env`, and temporary local files from the build context.

---

### 2. Distributed State & Scaling (Crucial for WebSockets)

Currently, the Orchestrator stores connected nodes in-memory:
`export const connectedNodes = new Map<string, string>();`
If Cloud Run spins up 5 instances, instance A won't know about the phones connected to instance B.

#### [MODIFY] `cloud-orchestrator/package.json`
- Add `@socket.io/redis-adapter` to sync WebSocket events across multiple containers.

#### [MODIFY] `cloud-orchestrator/src/api/Server.ts`
- Replace the in-memory Maps (`connectedNodes` and `nodeStatus`) with Redis `HSET` / `HGET` logic using `ioredis`.
- Attach the Redis Adapter to the Socket.IO server: `io.adapter(createAdapter(pubClient, subClient))`.

---

### 3. Edge Agent Networking Updates

The Android agent currently connects to localhost over an ADB reverse tunnel. We need to point it to the public cloud.

#### [MODIFY] `shizuku-spike-sandbox/.../AgentBridgeService.kt`
- Change the hardcoded WebSocket URI from `ws://127.0.0.1:3000` to read from a `BuildConfig` variable (e.g., `wss://tokiyo-orchestrator-xxxxxx.a.run.app`).

---

### 4. Managed Services Provisioning & Deployment

We will create a deployment script to automate the rollout to GCP.

#### [NEW] `cloud-orchestrator/deploy.sh`
A bash script that executes the `gcloud run deploy` command. Key features of this deployment:
- **Session Affinity**: We will explicitly enable `--session-affinity` in Cloud Run so that a device's WebSocket upgrade request hits the same container as its HTTP handshake.
- **VPC Serverless Connector**: Connects Cloud Run to the internal VPC to securely access Cloud SQL (PostgreSQL) and Memorystore (Redis).
- **Secrets Management**: Injects `DATABASE_URL`, `REDIS_URL`, and cryptographic keys securely.

---

## Verification Plan

### Automated Checks
- Run `npm run build` locally to verify TypeScript compilation.
- Run `docker build -t tokiyo-orchestrator .` to ensure the container builds successfully.

### Manual Verification
1. **Provision GCP Resources**: I will guide you through creating the PostgreSQL and Redis instances.
2. **Execute Deployment**: Run `./deploy.sh`.
3. **Public Handshake Test**: Compile the Android app, install it on the physical phone, and verify it successfully connects to the new `wss://...run.app` endpoint without a tethered USB connection.
