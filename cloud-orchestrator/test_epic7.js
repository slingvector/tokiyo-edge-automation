const { io } = require("socket.io-client");
const socket = io("http://localhost:3000");

const NODE_ID = "ddf1aadb5f1c38f4";

async function dispatchJob(action, params) {
  console.log(`[Test] Dispatching ${action}...`);
  const res = await fetch("http://localhost:3000/api/v1/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      node_id: NODE_ID,
      action: action,
      params: params
    })
  });
  const data = await res.json();
  console.log(`[Test] Enqueued: ${data.job_id}`);
}

async function run() {
  await dispatchJob("dump_ui", {});
  console.log("Waiting for 10 seconds to allow dump and processing...");
  setTimeout(() => process.exit(0), 10000);
}

run();
