#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Instagram Engagement Campaign — Wave 2 (Reels & Follows)
# Phase 3: "Scaling the Fleet"
#
# Discovers posts across AI, Startup, Technology, India topics
# then distributes engagement jobs across all connected edge devices.
# This wave enables Follow and Save automation for maximum engagement.
#
# Usage:
#   ./instagram_campaign_wave2.sh [ORCHESTRATOR_URL]
#
# Requires: curl, jq
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
ORCHESTRATOR_URL="${1:-http://localhost:3000}"
ENDPOINT_FLEET="${ORCHESTRATOR_URL}/api/v1/fleet/status"
ENDPOINT_DISCOVER="${ORCHESTRATOR_URL}/api/v1/engage/instagram/discover"
ENDPOINT_ENGAGE="${ORCHESTRATOR_URL}/api/v1/engage/instagram"

LOG_FILE="./logs/ig_campaign_wave2_$(date +%Y%m%d_%H%M%S).log"
mkdir -p ./logs

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

# ── 1. Get Connected Nodes ────────────────────────────────────────────────────
log "=== Instagram Campaign Wave 2 (Follow + Save) ==="
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
  "manual_urls": [
    "https://www.instagram.com/p/Dckt7aMyEV6/",
    "https://www.instagram.com/reels/DcipTdiNrIg/",
    "https://www.instagram.com/reels/Dcdn00joIxS/",
    "https://www.instagram.com/reels/DXFBOdbjIo9/",
    "https://www.instagram.com/reels/DcfuM6nIU7a/",
    "https://www.instagram.com/reels/DceXA9wPi7X/",
    "https://www.instagram.com/reels/DZaMwAoNx0u/",
    "https://www.instagram.com/reels/DcS7mwvJZNZ/",
    "https://www.instagram.com/reels/DcktTykpl48/",
    "https://www.instagram.com/reels/Dcfto9hSVM5/"
  ],
  "use_explore": false,
  "max_posts": 20,
  "auto_enqueue": true,
  "comment_template": "The aerial perspective here is absolutely stunning! 🔥 What drone setup are you flying? The framing and movement are so smooth. Would love to connect!"
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

# ── 3. Summary ────────────────────────────────────────────────────────────────
log ""
log "=== Campaign Wave 2 Summary ==="
log "Devices:   $NODE_COUNT"
log "Posts:     $DISCOVERED discovered"
log "Jobs:      $ENQUEUED enqueued"
log "Log:       $LOG_FILE"
log ""
log "Stealth delays: 30-90s between actions per device."
log "Features enabled: Like, Comment, Save, Follow."
log "Each device will process ~$((ENQUEUED / NODE_COUNT)) posts."
log ""
log "Monitor: docker-compose logs -f orchestrator (local) or gcloud run services logs read (cloud)"
log ""
log "✅ Wave 2 fired. Check BullMQ dashboard for job status."
