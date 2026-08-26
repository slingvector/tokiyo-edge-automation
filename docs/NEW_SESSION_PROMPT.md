# 🚀 Tokiyo Edge Automation — New Session Onboarding Prompt

Copy everything between the dashed lines and paste it as your first message.

---

---

Hey, I'm continuing work on **Tokiyo Edge Automation** — a distributed Android device automation platform. Before we start, read the project context file at the workspace root:

**Workspace path:** `/Users/cortex/ventures/tokiyo-edge-automation`

First, read this file completely:
```
/Users/cortex/ventures/tokiyo-edge-automation/AGENTS.md
```

Then confirm you understand the project by summarizing:
1. What the platform does
2. Current status of LinkedIn vs Instagram automation
3. What v2.0.0 added
4. What the immediate next step is

---

## Where We Are Right Now

We just completed **Phase 2: "Fireworks Start Before Diwali"** — the Instagram automation engine.

### What was built in this session (v2.0.0):

**New files:**
- `cloud-orchestrator/src/services/InstagramEngager.ts` — FSM for Like + Comment on Instagram posts
- `cloud-orchestrator/src/services/InstagramDiscovery.ts` — Multi-strategy post discovery (hashtag scraping + explore page + manual URLs)
- `cloud-orchestrator/src/queue/InstagramQueue.ts` — BullMQ worker for `instagram-jobs` queue
- `cloud-orchestrator/instagram_campaign_wave1.sh` — Campaign fire script
- `apk-analyzer/instagram/README.md` — Full APK analysis findings

**Modified files:**
- `cloud-orchestrator/src/api/Server.ts` — Added 2 new endpoints:
  - `POST /api/v1/engage/instagram`
  - `POST /api/v1/engage/instagram/discover`
- `cloud-orchestrator/src/utils/IDeviceController.ts` — Added `executeCommand` + `verifyDeviceState` to interface
- `cloud-orchestrator/src/utils/LocalAdbController.ts` — Implements new interface methods

### Key technical decisions made:

| Decision | Choice | Reason |
|---|---|---|
| MVP scope | Like + Comment only | Same as LinkedIn v1 — prove it works first |
| Stealth delays | 30–90s random between actions | Breaks Instagram's fixed-interval fingerprinting |
| Comment input | Dual method (input text → clipboard fallback) | `input text` can drop special chars on some devices |
| Tap jitter | ±4px random offset on all taps | Breaks coordinate pattern fingerprinting |
| Post discovery | All 3 strategies (manual + hashtag + explore) | Maximum reach |
| Follow/Save | Backlog (v2.1) | Not in MVP |
| Max actions/device/hour | Backlog | Redis counter `ig:hourly:{node_id}` in InstagramQueue |

---

## The Immediate Next Step

**Deploy v2.0.0 to Cloud Run and run the first real Instagram test.**

Steps:
1. `cd /Users/cortex/ventures/tokiyo-edge-automation/cloud-orchestrator`
2. `./deploy.sh` — builds Docker image + deploys to GCP Cloud Run
3. Ensure edge device `RZCY110AKDZ` (Samsung S24 Ultra) is connected and registered
4. Fire a single test job on one known public Instagram post
5. Screen record on device to verify Like + Comment automation works
6. Then fire `instagram_campaign_wave1.sh` for multi-post campaign

---

## Things to Know Before Touching Any Code

1. **verbatimModuleSyntax tsc errors** — pre-existing issue in tsconfig, affects ALL files. Does NOT break runtime (`ts-node` handles it fine). Ignore these.

2. **Instagram posts open in feed, not standalone** — deep links like `https://www.instagram.com/p/{shortcode}/` open the post inline in the main feed. The Like/Comment buttons are scroll-dependent. The FSM has scroll-to-find logic for this.

3. **Node lock** — always use `nodeLock_v2:{node_id}` with 300s TTL before running any job on a device. Already implemented in both LinkedIn and Instagram queues.

4. **No fixed coordinates** — always use `resource-id` or `content-desc` from UI dump XML. Never hardcode pixel coordinates.

5. **Primary test device** — `RZCY110AKDZ` is a Samsung S24 Ultra (SM-S938B), 1440×3120 display. All UI element bounds in the codebase are from this device.

6. **Edge agent needs no changes** — the Kotlin edge agent (`AgentBridgeService.kt` + `ShizukuExecutor.kt`) is generic. All platform-specific logic lives in the cloud orchestrator.

---

## Useful Commands

```bash
# Check what devices are connected
curl https://YOUR-CLOUD-RUN-URL/api/v1/fleet/status | jq

# Fire a single Instagram post engagement
curl -X POST https://YOUR-CLOUD-RUN-URL/api/v1/engage/instagram \
  -H "Content-Type: application/json" \
  -d '{
    "node_id": "RZCY110AKDZ",
    "type": "post",
    "target_id": "https://www.instagram.com/p/SHORTCODE/",
    "message": "Really insightful take on this!"
  }'

# Discover posts + bulk enqueue
curl -X POST https://YOUR-CLOUD-RUN-URL/api/v1/engage/instagram/discover \
  -H "Content-Type: application/json" \
  -d '{
    "node_ids": ["RZCY110AKDZ"],
    "topics": ["ai", "startup", "india"],
    "use_explore": true,
    "max_posts": 10,
    "auto_enqueue": true
  }'

# Local dev
cd cloud-orchestrator && docker-compose up -d

# Deploy to Cloud Run
cd cloud-orchestrator && ./deploy.sh

# Watch orchestrator logs
docker-compose logs -f orchestrator
```

---

## Git State

```
v1.0.0 — LinkedIn automation (LIVE — 6 verified comments, 5 likes)
v2.0.0 — Instagram automation engine (BUILT — not yet deployed/tested)
HEAD   — docs: AGENTS.md + .agents/rules for AI context continuity
```

---

Now confirm you have full context and tell me what you see in `AGENTS.md`. Then we'll deploy v2.0.0 and fire the first Instagram test.

---

---

> **Note:** Replace `YOUR-CLOUD-RUN-URL` with the actual Cloud Run service URL from `deploy.sh` output.
> The `.env` file (gitignored) has `REDIS_URL`, `DATABASE_URL`, and `GEMINI_API_KEY`.
