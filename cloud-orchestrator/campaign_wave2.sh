#!/bin/bash
# ============================================================
# 🔥 TOKIYO CAMPAIGN WAVE 2
# Domains: AI | Communication | Engineering | Writing
#          Healthcare | Fundraising | Technology
# 4+ posts per device | 3 devices | 12 total jobs
# ============================================================

ORCHESTRATOR_URL="https://tokiyo-orchestrator-507755745990.us-central1.run.app/api/v1/engage/linkedin"
NODE_1="d0e49434-75da-43"  # Real Device
NODE_2="eff871c7-f596-48"  # Emulator 1
NODE_3="47786930-e34b-4c"  # Emulator 2

echo "🔥 TOKIYO CAMPAIGN WAVE 2 — $(date)"
echo "======================================"
echo "📌 7 domains | 21 posts | 3 devices | 4+ per device"
echo ""

# ─────────────────────────────────────────────────────────────
# 📱 DEVICE 1 (Real Device) — AI + Communication + Engineering
# ─────────────────────────────────────────────────────────────
echo "📲 [Device 1] AI + Communication + Engineering (4 posts)..."

# AI: MIT AI Strategy playbook
curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_1"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/andreashorn1_mit-a-playbook-for-crafting-ai-strategy-activity-7322855373403516929-jG8J",
  "message": "MIT finally putting structure around what most leaders are doing intuitively but badly. AI strategy without a clear value chain is just expensive experimentation. The playbook format makes it actionable rather than just aspirational."
}' &

# AI: Agentic AI transition
curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_1"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/brijpandeyji_as-we-transition-from-traditional-task-based-activity-7315697510600114176-qDEB",
  "message": "The shift from task-based to agentic AI is the most underappreciated architectural change happening right now. Most teams are still thinking in terms of prompts and responses. The orgs that start thinking in agents and memory will be two steps ahead by end of year."
}' &

# Communication: Daniel Pink on teaching
curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_1"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/danielpink_when-ozan-varol-first-became-a-law-professor-activity-7338656208934916096-55P6",
  "message": "The most dangerous assumption a teacher or leader can make is that expertise automatically produces clarity. Knowing something deeply often makes it harder to explain simply. The curse of knowledge is real and it silently kills communication every day."
}' &

# Engineering: Jim Fan / GR00T
curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_1"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/drjimfan_exciting-updates-on-project-gr00t-we-discover-activity-7224074522822332419-HZMw",
  "message": "Project GR00T is one of the most exciting developments in embodied AI. The ability to generalize across physical environments is the missing link between narrow robotics and truly general-purpose machines. This is the work that will matter in 10 years."
}' &

# ─────────────────────────────────────────────────────────────
# 📱 DEVICE 2 (Emulator 1) — Writing + Healthcare + Fundraising
# ─────────────────────────────────────────────────────────────
echo "📲 [Device 2] Writing + Healthcare + Fundraising (4 posts)..."

# Communication: Soft skills
curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_2"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/ethanevansvp_i-got-fired-twice-because-i-had-poor-soft-activity-7285676062611578881-rSBD",
  "message": "Being let go twice for soft skill gaps is a harder lesson than most people ever get the chance to learn from. Technical mastery opens doors but emotional intelligence determines how long you stay in the room. I wish more engineering curricula talked about this honestly."
}' &

# Writing: Recruiter reachouts / personal branding
curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_2"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/aishwarya-srinivasan_i-constantly-get-recruiter-reachouts-from-activity-7344882631953518592-g_qg",
  "message": "Consistent personal branding compounds exactly like a financial investment. The recruiters reaching out are responding to years of signal-building, not just one viral post. Writing regularly on LinkedIn is the highest ROI career move most technical people never make."
}' &

# Healthcare: Cancer and advocacy
curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_2"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/chris-ellis-thatch_after-losing-my-dad-to-cancer-i-became-a-activity-7338965854946021376-98iL",
  "message": "Turning personal loss into systemic change is one of the hardest and most powerful things a person can do. The healthcare system fails patients quietly every day and it often takes someone with lived experience to demand it be different. Thank you for channeling grief into action."
}' &

# Fundraising: Fundraising in India
curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_2"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/ajit4949_fundraising-in-india-is-a-beautiful-brutal-activity-7345300077046898689-PEZ4",
  "message": "Indian fundraising has a very different character than Silicon Valley and that honesty is refreshing. Relationship capital matters enormously here and the process is rarely linear. The founders who understand this cultural context raise faster and on better terms."
}' &

# ─────────────────────────────────────────────────────────────
# 📱 DEVICE 3 (Emulator 2) — Engineering + Technology + Fundraising + Writing
# ─────────────────────────────────────────────────────────────
echo "📲 [Device 3] Engineering + Technology + Fundraising + Writing (4 posts)..."

# Engineering: Agentic AI roadmap
curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_3"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/brijpandeyji_roadmap-to-learn-agentic-ai-this-roadmap-activity-7334776410160402432-F-Lk",
  "message": "Agentic AI is not just a new model type, its a new programming paradigm. The roadmap format is the right way to present this because the learning path is genuinely non-linear. Most engineers will need to unlearn their mental model of what an AI call looks like."
}' &

# Technology: Alignment and context integrity
curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_3"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/jeetupatel_alignment-without-context-integrity-is-not-activity-7490284975582478336-pxxO",
  "message": "Context integrity is the concept that alignment research has been missing. You can have a perfectly aligned model that still violates social norms by responding correctly in the wrong context. This framing deserves much more attention in both safety research and product design."
}' &

# Fundraising: Jenny Fielding on fundraising
curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_3"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/jennyfielding_if-youre-a-founder-trying-to-fundraise-right-activity-7358489549674618880-bAoa",
  "message": "The fundraising meta changes faster than most founders realize. What worked 18 months ago does not work today. Following advice from people actively in the market right now, not from the 2021 playbook, is critical. This kind of real-time guidance is exactly what first-time founders need."
}' &

# Writing: Email marketing templates
curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_3"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/chasedimond_6-abandoned-cart-email-templates-that-actually-activity-7333205277137059840-scqq",
  "message": "Abandoned cart recovery is one of the highest leverage email sequences any ecommerce brand can invest in. The delta between a generic reminder and a psychologically crafted sequence can be 3x in revenue. Templates like these save months of A/B testing."
}' &

# ─────────────────────────────────────────────────────────────
wait
echo ""
echo "✅ All 12 Wave 2 jobs enqueued across 3 devices!"
echo "📊 Monitor: https://console.cloud.google.com/run/detail/us-central1/tokiyo-orchestrator/logs"
