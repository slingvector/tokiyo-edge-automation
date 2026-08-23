#!/bin/bash

# Target Node ID
NODE_ID="48e7f048198bb9d5"
ORCHESTRATOR_URL="https://tokiyo-orchestrator-507755745990.us-central1.run.app/api/v1/engage/linkedin"

echo "Scheduling AI Engagement Campaign..."

# Post 1 (Immediate)
echo "Enqueueing Post 1..."
curl -s -X POST $ORCHESTRATOR_URL \
  -H "Content-Type: application/json" \
  -d '{
    "node_id": "'"$NODE_ID"'",
    "type": "post",
    "target_id": "https://www.linkedin.com/posts/dr-donald-high_enterpriseai-rag-contextengineering-activity-7490757534279114752-4HW6",
    "message": "Fascinating perspective on Enterprise AI and RAG architecture!"
  }'
echo -e "\n"

echo "Waiting 60 seconds before next engagement..."
sleep 60

# Post 2
echo "Enqueueing Post 2..."
curl -s -X POST $ORCHESTRATOR_URL \
  -H "Content-Type: application/json" \
  -d '{
    "node_id": "'"$NODE_ID"'",
    "type": "post",
    "target_id": "https://www.linkedin.com/posts/ai-ladder-with-kapil-powered-by-sarlayash_ailadderwithkapil-datascientists-dataquality-activity-7491973914001063936-VfYt",
    "message": "Data quality is indeed the foundation of all AI success. Great read."
  }'
echo -e "\n"

echo "Waiting 60 seconds before next engagement..."
sleep 60

# Post 3
echo "Enqueueing Post 3..."
curl -s -X POST $ORCHESTRATOR_URL \
  -H "Content-Type: application/json" \
  -d '{
    "node_id": "'"$NODE_ID"'",
    "type": "post",
    "target_id": "https://www.linkedin.com/posts/aguchiedoxie_most-companies-are-failing-at-ai-not-because-activity-7494120731908358144-55Sx",
    "message": "Completely agree! AI strategy matters more than the models themselves."
  }'
echo -e "\n"

echo "Campaign Scheduled and Complete!"
