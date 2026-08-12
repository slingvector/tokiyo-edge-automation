const { io } = require("socket.io-client");
const socket = io("http://localhost:3000");

// We need the node ID from the previous run
const NODE_ID = "ddf1aadb5f1c38f4";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function dispatch(action, params) {
  return new Promise((resolve) => {
    const payload = {
      job_id: `test-scenario-${Date.now()}`,
      node_id: NODE_ID,
      timestamp: Date.now(),
      ttl_seconds: 60,
      action: action,
      params: params,
      signature: "" 
    };
    console.log(`[Test] Emitting ${action}...`);
    socket.emit("dispatch_job_to_node", payload);
    
    // We can't easily wait for the exact telemetry here without tapping into the server side, 
    // so we'll just resolve and wait a fixed delay.
    resolve();
  });
}

// Since the socket connection goes to the orchestrator but the orchestrator only exposes the REST API 
// for enqueueing jobs (and "dispatch_job_to_node" isn't a valid event on the server, it expects POST /api/v1/jobs)
// Wait! In `test_deep_link.js` earlier, I used `socket.emit("dispatch_job_to_node")` but that didn't work.
// I had to use `curl -X POST`. So let's use fetch in Node.js instead!

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

async function runScenario() {
  console.log("Starting Tokiyo Edge Automation Test Scenario...\n");

  // 1. Force Stop Chrome to ensure a clean state
  await dispatchJob("force_stop", { package: "com.android.chrome" });
  await sleep(2000);

  // 2. Deep link to Instagram web in Chrome
  await dispatchJob("deep_link", { 
    url: "https://www.instagram.com", 
    package: "com.android.chrome" 
  });
  console.log("Waiting for page to load...");
  await sleep(6000);

  // 3. Human-like swipe down to view content
  await dispatchJob("swipe", {
    start_x: "500",
    start_y: "1500",
    end_x: "500",
    end_y: "400"
  });
  await sleep(3000);

  // 4. Tap the 'Log In' button (simulated via coordinate for now)
  // Assuming 'click_element' supports resource_id or text, but let's test coordinate tap via 'execute_shell' as fallback
  // Wait, our TouchDispatcherImpl can do `tap("[x1,y1][x2,y2]")` which is hooked up to `click_element`.
  // If we want a raw tap, we can just use `execute_shell`.
  await dispatchJob("execute_shell", {
    command: "input tap 500 1000"
  });
  await sleep(2000);

  // 5. Inject secure clipboard payload
  await dispatchJob("paste_text", {
    text: "tokiyo_test_user_ai"
  });
  console.log("Injected text securely via clipboard!");
  await sleep(2000);

  console.log("\nScenario completed! Check the emulator screen.");
  process.exit(0);
}

runScenario();
