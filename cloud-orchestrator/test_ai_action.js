const { io } = require("socket.io-client");

const NODE_ID = "ddf1aadb5f1c38f4";

async function run() {
  console.log("Requesting AI Action to click on the Search bar or Home tab...");
  const res = await fetch("http://localhost:3000/api/v1/agent/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      node_id: NODE_ID,
      goal: "Click on the main Search bar at the top of the screen"
    })
  });
  
  const data = await res.json();
  console.log("Response:", JSON.stringify(data, null, 2));
  process.exit(0);
}

run();
