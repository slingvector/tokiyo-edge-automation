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

async function loginToLinkedIn() {
  console.log("Executing LinkedIn Login Flow via Tokiyo Edge Agent...\n");

  // 1. Tap Email Field
  await dispatchJob("execute_shell", {
    command: "input tap 160 431"
  });
  await sleep(1500);

  // 2. Securely Inject Email Address
  await dispatchJob("paste_text", {
    text: "iitr.anuj.personal@gmail.com"
  });
  await sleep(1500);

  // 3. Tap Password Field
  await dispatchJob("execute_shell", {
    command: "input tap 160 495"
  });
  await sleep(1500);

  // 4. Securely Inject Password
  await dispatchJob("paste_text", {
    text: "Anuj@ab34"
  });
  await sleep(1500);

  // 5. Hide Keyboard
  await dispatchJob("execute_shell", {
    command: "input keyevent 111" // KEYCODE_ESCAPE usually hides the keyboard
  });
  await sleep(1500);

  // 6. Tap 'Continue' / 'Sign in' Button
  await dispatchJob("execute_shell", {
    command: "input tap 160 630"
  });
  
  console.log("Waiting for authentication to complete...");
  await sleep(8000);

  console.log("\nLogin Scenario completed! Check the emulator screen.");
  process.exit(0);
}

loginToLinkedIn();
