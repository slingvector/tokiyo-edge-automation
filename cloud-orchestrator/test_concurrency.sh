#!/bin/bash

ORCHESTRATOR_URL="https://tokiyo-orchestrator-507755745990.us-central1.run.app/api/v1/engage/linkedin"

NODE_1="d0e49434-75da-43"  # Real Device
NODE_2="eff871c7-f596-48"  # Emulator 1
NODE_3="47786930-e34b-4c"  # Emulator 2

echo "Testing Concurrency across 3 Devices..."
echo "Enqueueing jobs concurrently..."

# DEVICE 1 (Real Device)
curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_1"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/anuj-kumar-b48ab63b8_spacex-is-revolutionizing-orbital-mechanics-share-7496190423942455296-FvGs",
  "message": "Incredible advancements from SpaceX!"
}' &

curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_1"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/anuj-kumar-b48ab63b8_the-integration-of-computer-vision-and-edge-share-7496210900035702784-MEYB",
  "message": "Edge computing is the future of CV!"
}' &

curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_1"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/anuj-kumar-b48ab63b8_ai-in-healthcare-is-transforming-lives-share-7496190423942455296-ABCD",
  "message": "AI is truly transforming healthcare for the better."
}' &

# DEVICE 2 (Emulator 1)
curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_2"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/anuj-kumar-b48ab63b8_the-evolution-of-drone-technology-is-transforming-share-7496210342738542594-kwye",
  "message": "Drone tech is moving so fast!"
}' &

curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_2"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/anuj-kumar-b48ab63b8_log-n-a-backend-lie-we-often-learn-that-ugcPost-7487469440754782209-1MoI",
  "message": "Interesting take on backend complexity."
}' &

curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_2"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/anuj-kumar-b48ab63b8_quantum-computing-is-closer-than-we-think-share-7496210342738542594-WXYZ",
  "message": "Quantum computing will break all our current crypto!"
}' &

# DEVICE 3 (Emulator 2)
curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_3"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/anuj-kumar-b48ab63b8_rag-isnt-the-answer-we-built-our-first-ugcPost-7481399989282398208-j79i",
  "message": "RAG has limitations, great post outlining them."
}' &

curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_3"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/anuj-kumar-b48ab63b8_resumes-dead-ugcPost-7478090806134894592-9zpl",
  "message": "Resumes are definitely evolving!"
}' &

curl -s -X POST $ORCHESTRATOR_URL -H "Content-Type: application/json" -d '{
  "node_id": "'"$NODE_3"'",
  "type": "post",
  "target_id": "https://www.linkedin.com/posts/anuj-kumar-b48ab63b8_the-future-of-work-is-remote-share-7478090806134894592-1234",
  "message": "Remote work is here to stay, no matter what."
}' &

wait
echo ""
echo "All 9 jobs have been concurrently enqueued to the Orchestrator!"
