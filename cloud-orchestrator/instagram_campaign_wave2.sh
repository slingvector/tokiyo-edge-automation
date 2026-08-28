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
ORCHESTRATOR_URL="${1:-https://tokiyo-orchestrator-XXXX-uc.a.run.app}"
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
    "https://www.instagram.com/reel/DcIFknJT1el/",
    "https://www.instagram.com/reel/DcXN-ShzHjT/",
    "https://www.instagram.com/reel/DcXNWvNT1BB/"
  ],
  "use_explore": false,
  "max_posts": $((NODE_COUNT * 4)),
  "auto_enqueue": true,
  "shouldFollow": true,
  "shouldSave": true,
  "comment_template": "Absolutely brilliant execution here! 🚀 Would love to connect and see what you build next."
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
