# Tokiyo Edge Automation — Project Context for AI Agents

> **Read this first.** This file gives any AI assistant full project context so work can continue across accounts/sessions without loss of knowledge.

---

## What This Project Is

**Tokiyo Edge Automation** is a distributed Android device automation platform.

- **Cloud Orchestrator**: Node.js (TypeScript) service on Google Cloud Run. Manages jobs via BullMQ + Redis. Exposes REST API + WebSocket server.
- **Edge Agent**: Android app (Kotlin + Shizuku) installed on real physical Android devices across India. Receives shell commands from the cloud via WebSocket and executes them using Shizuku (root-level shell without rooting).
- **The Trick**: Instead of using fragile Android emulators or APIs, we control real apps (LinkedIn, Instagram) on real devices using `uiautomator dump` (UI hierarchy XML) + `input tap/text/swipe` — pure Android shell automation.

---

## Architecture

```
[Campaign Script / REST API]
        |
        v
[Cloud Orchestrator - Cloud Run]
  - Express + Socket.IO server
  - BullMQ queues (linkedin-jobs, instagram-jobs)
  - Redis (job queue + device registry)
  - Prisma + PostgreSQL (job history)
        |
        v (WebSocket)
[Edge Agent - Android Device]
  - AgentBridgeService.kt (WebSocket client)
  - ShizukuExecutor.kt (shell execution via Shizuku)
  - Executes: am start, uiautomator dump, input tap/text/swipe
        |
        v
[Target App - Instagram / LinkedIn on real device]
```

---

## Current Status

| Platform | Status | Version |
|---|---|---|
| LinkedIn | ✅ LIVE | v1.0.0 — 6 comments verified, 5 likes |
| Instagram | 🔨 BUILDING | v2.0.0 committed — FSM + discovery built, not deployed yet |

---

## Key Files

### Cloud Orchestrator (`/cloud-orchestrator/`)

| File | Purpose |
|---|---|
| `src/api/Server.ts` | Express + Socket.IO server. All REST endpoints. |
| `src/queue/LinkedInQueue.ts` | BullMQ worker for LinkedIn jobs |
| `src/queue/InstagramQueue.ts` | BullMQ worker for Instagram jobs (MVP: like+comment) |
| `src/queue/Dispatcher.ts` | Generic job dispatcher to edge devices |
| `src/services/LinkedInEngager.ts` | FSM for LinkedIn (Like, Comment, DM) |
| `src/services/InstagramEngager.ts` | FSM for Instagram (Like+Comment, stealth mode) |
| `src/services/InstagramDiscovery.ts` | Post discovery: manual + hashtag scraping + explore page |
| `src/utils/IDeviceController.ts` | Interface for device control (local ADB or remote Shizuku) |
| `src/utils/RemoteShizukuController.ts` | Cloud-side controller that dispatches jobs to edge devices |
| `src/utils/LocalAdbController.ts` | Local ADB controller for testing |
| `src/ai/PerceptionEngine.ts` | Gemini vision — reads UI screenshots for AI-guided taps |
| `Dockerfile` | Docker image for Cloud Run |
| `deploy.sh` | GCP Cloud Run deploy script |
| `docker-compose.yml` | Local dev: orchestrator + Redis + postgres |
| `instagram_campaign_wave1.sh` | Instagram campaign fire script |
| `campaign_wave2.sh` | LinkedIn campaign wave 2 script |

### Edge Agent (`/shizuku-spike-sandbox/`)

| File | Purpose |
|---|---|
| `app/src/main/java/com/tokiyo/shizukuspike/service/AgentBridgeService.kt` | WebSocket client, receives and dispatches jobs |
| `core/shizuku/src/main/java/com/tokiyo/core/shizuku/ShizukuExecutor.kt` | Executes shell commands via Shizuku API |

### APK Analysis (`/apk-analyzer/`)

| File | Purpose |
|---|---|
| `instagram/instagram-base.apk` | Instagram APK pulled from Samsung S24 Ultra |
| `instagram/manifest_raw.txt` | Full aapt2 xmltree dump (6195 lines) |
| `instagram/README.md` | Key findings: deep links, resource IDs, activities |
| `instagram/ig_post_dump4.xml` | UI hierarchy of loaded feed post (shows button IDs) |

---

## API Endpoints

```
POST /api/v1/engage/linkedin          — LinkedIn like+comment job
POST /api/v1/engage/instagram         — Instagram like/comment/post job
POST /api/v1/engage/instagram/discover — Discover posts + bulk enqueue
POST /api/v1/jobs                     — Generic shell job dispatch
POST /api/v1/agent/action             — AI perception → click
POST /api/v1/agent/autonomous         — Autonomous AI session
GET  /api/v1/fleet/status             — All connected devices + status
GET  /api/v1/public-key               — Crypto public key
```

---

## Instagram Automation — Key Technical Facts

### Deep Links (all verified working)
- `https://www.instagram.com/p/{shortcode}/` → opens post in feed
- `instagram://user?username={name}` → user profile
- `instagram://explore` → explore tab
- Posts open **inline in the feed** (not a standalone view like LinkedIn)

### Critical UI Element IDs (Samsung S24 Ultra, 1440×3120)
```
row_feed_button_like       content-desc="Like" / "Unlike"
row_feed_button_comment    content-desc="Comment"
row_feed_button_share      content-desc="Send post..."
row_feed_button_save       content-desc="Add to Saved"
inline_follow_button       content-desc="Follow {name}"
row_feed_view_group_buttons  (parent container)
```

### Stealth Features (InstagramEngager.ts)
- **30–90s random delay** between Like and Comment actions
- **±4px tap jitter** on all taps (breaks coordinate fingerprinting)
- **Dual comment input**: `input text` first, falls back to clipboard paste
- Resource-id based discovery + scroll-to-find (scroll-dependent layout)

### Comment Input — Dual Method
- Method A: `input text "encoded%stext"` (fast, may drop special chars)
- Method B: `am broadcast -a clipper.set` + `KEYCODE_PASTE` (reliable, slower)
- Smart fallback: tries A, verifies via UI dump, falls back to B

### Post Discovery — 3 Strategies
- A: Manual URL list
- B: Hashtag page scraping (`/explore/tags/{hashtag}/`)
- C: Instagram explore page scraping
- TOPIC_HASHTAGS presets: ai, startup, technology, india, engineering, finance, healthcare, writing

---

## Device Fleet

Devices connect via WebSocket to the cloud orchestrator. Each registers with a `node_id`.

| node_id | Device | Status |
|---|---|---|
| `RZCY110AKDZ` | Samsung S24 Ultra (SM-S938B) | Primary test device |

Device registry lives in Redis: `hgetall connectedNodes` → `{node_id: socket_id}`
Device status: `hgetall nodeStatus` → `{node_id: 'IDLE'|'BUSY'}`
Node lock key: `nodeLock_v2:{node_id}` (expires 300s, prevents concurrent jobs)

---

## Backlog (Next Steps)

| Item | Priority | Notes |
|---|---|---|
| Deploy v2.0.0 to Cloud Run | 🔴 HIGH | `./deploy.sh` — test Instagram on real device |
| Single post test (Instagram) | 🔴 HIGH | Fire one job, screen record, verify comment |
| Max actions per device/hour | 🟡 MED | Redis counter `ig:hourly:{node_id}`, check in InstagramQueue |
| Instagram Reel engagement | 🟡 MED | Full-screen UI, different button layout |
| Follow automation | 🟡 MED | FSM states exist, not wired |
| Multi-device campaign wave | 🟡 MED | Need all India devices online |
| BullMQ dashboard | 🟢 LOW | Bull Board UI for job monitoring |

---

## Environment Variables

```env
REDIS_URL=redis://...
DATABASE_URL=postgresql://...
GEMINI_API_KEY=...
PORT=3000
```

Set in `.env` (gitignored). For Cloud Run, set via `gcloud run deploy --set-env-vars`.

---

## Local Dev

```bash
cd cloud-orchestrator
docker-compose up -d          # Start Redis + Postgres + Orchestrator
npm run dev                   # Or: ts-node src/index.ts
```

## Deploy to Cloud Run

```bash
cd cloud-orchestrator
./deploy.sh
```

---

## Git History Highlights

| Tag | What |
|---|---|
| `v1.0.0` | LinkedIn automation — 6 verified comments, 5 likes |
| `v2.0.0` | Instagram automation engine — FSM + discovery + stealth |

---

## Important Patterns

1. **FSM pattern**: All engagers follow: `verifyDevice → cleanState → navigate → findButtons (scroll) → act → verify`
2. **No fixed coordinates**: Always use `resource-id` or `content-desc` from UI dump XML
3. **Node lock**: Always acquire `nodeLock_v2:{node_id}` before any job, release in `finally`
4. **verbatimModuleSyntax errors**: Pre-existing tsc config issue — does NOT affect runtime (ts-node). Ignore these.
5. **UI dump XML**: Pull with `uiautomator dump` → `adb pull` → parse with regex. The `RemoteShizukuController` handles this end-to-end.
