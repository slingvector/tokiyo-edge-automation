#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Instagram Engagement Campaign — Wave 1
# Phase 2: "Fireworks Start Before Diwali"
#
# Discovers posts across AI, Startup, Technology, India topics
# then distributes engagement jobs across all connected edge devices.
#
# Usage:
#   ./instagram_campaign_wave1.sh [ORCHESTRATOR_URL]
#
# Requires: curl, jq
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
ORCHESTRATOR_URL="${1:-https://tokiyo-orchestrator-XXXX-uc.a.run.app}"
ENDPOINT_FLEET="${ORCHESTRATOR_URL}/api/v1/fleet/status"
ENDPOINT_DISCOVER="${ORCHESTRATOR_URL}/api/v1/engage/instagram/discover"
ENDPOINT_ENGAGE="${ORCHESTRATOR_URL}/api/v1/engage/instagram"

LOG_FILE="./logs/ig_campaign_wave1_$(date +%Y%m%d_%H%M%S).log"
mkdir -p ./logs

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

# ── 1. Get Connected Nodes ────────────────────────────────────────────────────
log "=== Instagram Campaign Wave 1 ==="
log "Fetching connected fleet..."

FLEET_JSON=$(curl -s "$ENDPOINT_FLEET")
NODE_IDS=$(echo "$FLEET_JSON" | jq -r '.fleet[] | select(.status == "IDLE") | .node_id' 2>/dev/null || echo "")

if [ -z "$NODE_IDS" ]; then
    log "ERROR: No idle nodes found. Check fleet status."
    echo "$FLEET_JSON"
    exit 1
fi

NODE_ARRAY=$(echo "$NODE_IDS" | jq -R -s 'split("\n") | map(select(length > 0))')
NODE_COUNT=$(echo "$NODE_IDS" | wc -l | tr -d ' ')
log "Found $NODE_COUNT idle node(s): $NODE_IDS"

# ── 2. Discover Posts ─────────────────────────────────────────────────────────
log ""
log "=== Phase A: Post Discovery ==="

# Strategy mix: topics (hashtag scraping) + explore + manual seed URLs
DISCOVER_PAYLOAD=$(cat <<EOF
{
  "node_ids": $NODE_ARRAY,
  "topics": ["ai", "startup", "technology", "india", "engineering"],
  "hashtags": ["buildinginpublic", "sideproject", "indiehacker", "productlaunch"],
  "use_explore": true,
  "max_posts": $((NODE_COUNT * 4)),
  "auto_enqueue": true,
  "comment_template": null
}
EOF
)

log "Sending discovery + bulk enqueue request..."
DISCOVER_RESPONSE=$(curl -s -X POST "$ENDPOINT_DISCOVER" \
    -H "Content-Type: application/json" \
    -d "$DISCOVER_PAYLOAD")

log "Discovery response:"
echo "$DISCOVER_RESPONSE" | jq . | tee -a "$LOG_FILE"

ENQUEUED=$(echo "$DISCOVER_RESPONSE" | jq -r '.enqueued // 0')
DISCOVERED=$(echo "$DISCOVER_RESPONSE" | jq -r '.discovered // 0')
log "Discovered: $DISCOVERED posts | Enqueued: $ENQUEUED jobs"

# ── 3. Optional: Manual URL Override ─────────────────────────────────────────
# Uncomment and add specific post URLs to target specific content
# log ""
# log "=== Phase B: Manual Post Targeting ==="
# MANUAL_POSTS=(
#   "https://www.instagram.com/p/SHORTCODE1/"
#   "https://www.instagram.com/p/SHORTCODE2/"
# )
# 
# FIRST_NODE=$(echo "$NODE_IDS" | head -1)
# for POST_URL in "${MANUAL_POSTS[@]}"; do
#     COMMENT="Great insight! This is exactly the kind of thinking we need more of."
#     RESPONSE=$(curl -s -X POST "$ENDPOINT_ENGAGE" \
#         -H "Content-Type: application/json" \
#         -d "{\"node_id\": \"$FIRST_NODE\", \"type\": \"post\", \"target_id\": \"$POST_URL\", \"message\": \"$COMMENT\"}")
#     JOB_ID=$(echo "$RESPONSE" | jq -r '.job_id // "ERROR"')
#     log "Enqueued manual job $JOB_ID for $POST_URL"
# done

# ── 4. Summary ────────────────────────────────────────────────────────────────
log ""
log "=== Campaign Wave 1 Summary ==="
log "Devices:   $NODE_COUNT"
log "Posts:     $DISCOVERED discovered"
log "Jobs:      $ENQUEUED enqueued"
log "Log:       $LOG_FILE"
log ""
log "Stealth delays: 30-90s between actions per device."
log "Each device will process ~$((ENQUEUED / NODE_COUNT)) posts."
log ""
log "Monitor: docker-compose logs -f orchestrator"
log ""
log "✅ Wave 1 fired. Check BullMQ dashboard for job status."
