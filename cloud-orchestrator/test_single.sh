#!/bin/bash

ORCHESTRATOR_URL="https://tokiyo-orchestrator-507755745990.us-central1.run.app/api/v1/engage/linkedin"
NODE_3="47786930-e34b-4c"  # Emulator 2

echo "Testing single comment on Emulator 2..."

curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_3"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/anuj-kumar-b48ab63b8_rag-isnt-the-answer-we-built-our-first-ugcPost-7481399989282398208-j79i",
  "message": "Testing the new verified submission logic!"
}'

echo ""
echo "Enqueued test job!"
