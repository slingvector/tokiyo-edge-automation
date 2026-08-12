const { io } = require("socket.io-client");
const socket = io("http://localhost:3000");

const NODE_ID = "ddf1aadb5f1c38f4";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
  console.log("Starting Tokiyo Edge Automation Test Scenario for LinkedIn...\n");

  // 1. Force Stop LinkedIn to ensure a clean state
  await dispatchJob("force_stop", { package: "com.linkedin.android" });
  await sleep(2000);

  // 2. Launch LinkedIn app
  await dispatchJob("execute_shell", {
    command: "monkey -p com.linkedin.android -c android.intent.category.LAUNCHER 1"
  });
  console.log("Waiting for app to load...");
  await sleep(8000);

  // 3. Human-like swipe down on the splash/login screen
  await dispatchJob("swipe", {
    start_x: "500",
    start_y: "1500",
    end_x: "500",
    end_y: "400"
  });
  await sleep(3000);

  // 4. Inject secure clipboard payload (e.g., simulating logging in)
  await dispatchJob("paste_text", {
    text: "tokiyo_linkedin_user_ai"
  });
  console.log("Injected text securely via clipboard!");
  await sleep(2000);

  console.log("\nScenario completed! Check the emulator screen.");
  process.exit(0);
}

runScenario();
