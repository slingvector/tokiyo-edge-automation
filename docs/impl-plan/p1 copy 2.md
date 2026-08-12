# Goal
Implement **Epic 6: Distributed Cloud/Local Orchestrator & Job Queue**.
Per your request, we are parking the app-specific XML perception (Epic 3) and treating the Android Agent as a "black-box" execution unit. We will now shift focus entirely to **Scale and Seamless Distribution** by building the central control plane that dispatches and tracks jobs across the edge fleet.

## User Review Required
> [!IMPORTANT]
> **Stack Selection:** The blueprint offers Go or Node.js. Since I verified you have Node v25.2 installed on your Mac, I propose building this in **TypeScript (Node.js)** using:
> 1. **BullMQ + Redis:** For high-performance, fault-tolerant job queues, dead-letter queues, and node-locking (1 job per node).
> 2. **PostgreSQL (via Prisma ORM):** To maintain relational state of `nodes`, `jobs`, and `telemetry`.
> 3. **Docker Compose:** To instantly spin up the local Redis and Postgres instances.

## Proposed Changes

### 1. Scaffolding the Orchestrator
We will create a new directory `cloud-orchestrator` at the root of the project.
#### [NEW] [docker-compose.yml](file:///Users/cortex/ventures/tokiyo-edge-automation/cloud-orchestrator/docker-compose.yml)
- Spins up `postgres:16` and `redis:7` locally for our queue and DB.
#### [NEW] [package.json](file:///Users/cortex/ventures/tokiyo-edge-automation/cloud-orchestrator/package.json)
- Add dependencies: `bullmq`, `prisma`, `express`, `zod`, `ioredis`.

### 2. Database Schema (PostgreSQL)
We will define the relational schema to track our fleet.
#### [NEW] [schema.prisma](file:///Users/cortex/ventures/tokiyo-edge-automation/cloud-orchestrator/prisma/schema.prisma)
- `Node`: Tracking node ID, IP, status (ACTIVE, DEAD, MAINTENANCE).
- `Job`: Tracking job lifecycle (PENDING, RUNNING, SUCCESS, FAILED), retries, and associated `nodeId`.

### 3. Distributed Queue & Node Locking (Redis)
#### [NEW] [QueueManager.ts](file:///Users/cortex/ventures/tokiyo-edge-automation/cloud-orchestrator/src/queue/QueueManager.ts)
- Configure BullMQ to dispatch jobs.
- **Node Locking:** Ensure a node only receives one job at a time. If `node-1` is running a job, subsequent jobs for `node-1` remain queued.
#### [NEW] [Signer.ts](file:///Users/cortex/ventures/tokiyo-edge-automation/cloud-orchestrator/src/crypto/Signer.ts)
- Implement Node's native `crypto.sign('ed25519', ...)` to programmatically sign the `JobPayload` right before it is dispatched to the worker queue, ensuring it passes the Android agent's Zero-Trust check.

### 4. Dispatcher & Webhooks API
#### [NEW] [Dispatcher.ts](file:///Users/cortex/ventures/tokiyo-edge-automation/cloud-orchestrator/src/queue/Dispatcher.ts)
- A BullMQ Worker that consumes the queue. Instead of Firebase Cloud Messaging (FCM), it will fire an HTTP POST to our local `127.0.0.1:8080` Android Ktor listener to seamlessly test the end-to-end flow locally.
#### [NEW] [Server.ts](file:///Users/cortex/ventures/tokiyo-edge-automation/cloud-orchestrator/src/api/Server.ts)
- Expose an Express endpoint `/api/v1/jobs` to ingest new jobs from a developer or external system.
- Expose `/api/v1/telemetry/report` where the Android Agent can POST its success/failure flight recorder data to complete the loop.

## Verification Plan
### Local Integration Test
1. I will run `docker-compose up -d`.
2. I will run `npx prisma db push` to initialize the database.
3. I will start the Orchestrator via `npm run dev`.
4. We will POST 5 jobs simultaneously to the Orchestrator's API. We will verify that BullMQ queues them, signs them, dispatches them sequentially to the emulator, and successfully records the 200 OK responses in the PostgreSQL database!
