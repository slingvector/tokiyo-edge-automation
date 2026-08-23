#!/bin/bash

# ============================================================
# 🔥 TOKIYO CAMPAIGN FIRE - Top LinkedIn Posts Engagement
# Sources: AI Trends, Technology, Finance, Innovation
# ============================================================

ORCHESTRATOR_URL="https://tokiyo-orchestrator-507755745990.us-central1.run.app/api/v1/engage/linkedin"

NODE_1="d0e49434-75da-43"  # Real Device
NODE_2="eff871c7-f596-48"  # Emulator 1
NODE_3="47786930-e34b-4c"  # Emulator 2

echo "🚀 TOKIYO CAMPAIGN FIRE - Engaging $(date)"
echo "=========================================="
echo "📌 Devices: Real Device | Emulator 1 | Emulator 2"
echo "📌 Posts per device: 3"
echo "📌 Total jobs: 9"
echo ""

# -----------------------------------------------------------
# 🤖 DEVICE 1 (Real Device) — AI Trends & Innovation Posts
# -----------------------------------------------------------
echo "📲 [Device 1] Enqueueing AI Trends + Innovation posts..."

curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_1"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/alexey6_ai-is-changing-lives-far-beyond-chatbots-activity-7471137107621629952-DxT3",
  "message": "This is spot on. Most people still think AI is just about chatbots, but the real transformation is happening quietly in healthcare diagnostics, supply chain optimization, and materials science. The hype cycle misses all the unglamorous but world-changing work."
}' &

curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_1"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/kyle-poyar_ai-products-like-cursor-bolt-and-replit-activity-7299461810691162113-AWb6",
  "message": "The developer tools space is being completely redefined. What used to take hours of boilerplate now takes minutes. Cursor alone changed how my entire team approaches new features — the IDE is no longer just an editor, its a thinking partner."
}' &

curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_1"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/markus-j-buehler-2245682_big-breakthrough-a-few-months-my-lab-at-activity-7346523780338397184-JmOt",
  "message": "Groundbreaking work. The intersection of AI and materials science is one of the most underreported breakthroughs of this decade. Designing at the molecular level with AI assistance will accelerate discovery timelines from years to weeks."
}' &

# -----------------------------------------------------------
# 💻 DEVICE 2 (Emulator 1) — Technology Posts
# -----------------------------------------------------------
echo "📲 [Device 2] Enqueueing Technology posts..."

curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_2"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/andy-jassy-8b1615_every-cloud-provider-faces-the-same-ai-infrastructure-activity-7392215685701132288-goTE",
  "message": "The AI infrastructure race is fundamentally a compute and energy problem. Every major cloud provider is now an energy company by necessity. The winner wont just have the best models — theyll have the most efficient chips and the greenest power."
}' &

curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_2"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/jain-arvind_two-strikingly-similar-headlines-surfaced-activity-7364073773404180480-b61j",
  "message": "The convergence of similar narratives from competing tech giants is always a signal worth paying attention to. When the same story gets told from different sides simultaneously, it usually means the market is approaching an inflection point."
}' &

curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_2"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/brijpandeyji_basics-of-cybersecurity-what-every-tech-activity-7294914635437096960-DLlY",
  "message": "Cybersecurity fundamentals should be part of every tech curriculum from day one, not an afterthought. The biggest vulnerabilities we see in production systems come from teams that skipped the basics in favor of moving fast. Security is a mindset, not a feature."
}' &

# -----------------------------------------------------------
# 💰 DEVICE 3 (Emulator 2) — Finance Posts
# -----------------------------------------------------------
echo "📲 [Device 3] Enqueueing Finance posts..."

curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_3"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/alfonsopeccatiello_pay-attention-this-is-the-most-important-activity-7308097515248091136-ltOr",
  "message": "The macro signals right now are genuinely contradictory and thats exactly what makes this moment so tricky. Credit spreads saying one thing, yield curve saying another. Paying very close attention to liquidity flows feels like the most rational approach here."
}' &

curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_3"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/joshaharonoff_audit-the-process-every-company-should-understand-activity-7318626825058856961-ScpL",
  "message": "Financial due diligence is only as good as the process behind it. Most teams audit the numbers but never audit the assumptions baked into those numbers. The real risk always hides in the methodology, not the spreadsheet."
}' &

curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_3"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/cakeshavgupta_how-to-do-financial-due-diligence-before-activity-7298322523094401024-mGCl",
  "message": "A thorough DD process is the difference between a good investment and a nightmare. The firms that cut corners on due diligence are always the ones with post-deal surprises. This breakdown is exactly what founders and investors should both be reading."
}' &

# -----------------------------------------------------------
wait
echo ""
echo "✅ All 9 jobs enqueued across 3 devices!"
echo "📊 Monitor: https://console.cloud.google.com/run/detail/us-central1/tokiyo-orchestrator/logs"
echo ""
