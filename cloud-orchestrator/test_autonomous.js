const { io } = require("socket.io-client");

const NODE_ID = "ddf1aadb5f1c38f4";

async function run() {
  console.log("Starting Autonomous Session: Scroll down the feed once, then click the Home tab...");
  const res = await fetch("http://localhost:3000/api/v1/agent/autonomous", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      node_id: NODE_ID,
      goal: "Scroll down the feed once, then click the Home tab",
      max_steps: 5
    })
  });
  
  const data = await res.json();
  console.log("Response:", JSON.stringify(data, null, 2));
  
  // The Orchestrator will run the loop in the background!
  console.log("Check the Orchestrator console output to watch the agent's thought process!");
}

run();
